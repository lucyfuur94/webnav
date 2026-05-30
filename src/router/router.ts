import type { Goal } from '../mapstore/types.js';
import type { Candidate, RecallResponse } from '../protocol.js';
import { parseSnapshot } from '../playwright/snapshot.js';

export interface RecallBrowser {
  callCount: () => number;
  nextSnapshot: () => string;   // advances through the route, returns snapshot YAML
}

export interface RecallArgs {
  query: string;
  goal: Goal;
  browser: RecallBrowser;
  /** Extract goal signals from a repo-detail snapshot (absent signals omitted). */
  extractSignals: (detailYaml: string) => Record<string, unknown>;
  nowMs?: number; // injectable for deterministic wall_ms in tests
}

/**
 * One recall. Travels the result list -> top-N candidates -> each detail page,
 * surfaces the goal's signals, and returns the EVIDENCE BUNDLE. webnav does
 * NOT rank - the calling agent does. Zero LLM. Cost = playwright-cli calls.
 */
export function recall(args: RecallArgs): RecallResponse {
  const { query, goal, browser, extractSignals } = args;
  const start = args.nowMs ?? 0;

  // 1. Result list (search term already injected upstream by the CLI/live wiring).
  const resultNodes = parseSnapshot(browser.nextSnapshot());
  const repoLinks = resultNodes
    .filter((n) => n.role === 'link' && /github\.com\/[^/]+\/[^/]+/.test(n.url ?? ''))
    .slice(0, goal.candidateLimit);

  if (repoLinks.length === 0) {
    return { status: 'failed', reason: 'no repository links found in search results' };
  }

  // 2. Visit each candidate's detail, surface the goal's signals.
  const candidates: Candidate[] = [];
  for (const link of repoLinks) {
    const detail = browser.nextSnapshot();
    const signals = extractSignals(detail);
    candidates.push({ id: link.url!.replace('https://github.com/', ''), url: link.url!, signals });
  }

  // 3. Return raw evidence. No ranking here (principle #5/#5a).
  return {
    status: 'done',
    evidence: {
      goal: goal.name, query, candidates,
      cost: { playwright_calls: browser.callCount(), wall_ms: (args.nowMs ?? 0) - start },
    },
  };
}
