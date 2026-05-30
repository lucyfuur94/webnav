import type { Goal } from '../mapstore/types.js';
import type { RecallResponse } from '../protocol.js';
import type { MapStore } from '../mapstore/store.js';
import { recall, type RecallBrowser } from './router.js';
// Namespace import so vi.spyOn(skeleton, 'exploreGitHub') observes the call
// (the spy patches the namespace binding we dereference at call time).
import * as skeleton from '../explorer/github-skeleton.js';

export interface RecallViaMapArgs {
  query: string;
  goal: Goal;
  store: MapStore;
  browser: RecallBrowser;                  // same shim recall() uses (pull-based snapshots)
  extractSignals: (detailYaml: string) => Record<string, unknown>;
}

/**
 * recall() + the MEMORY layer. Reads the GitHub navigation skeleton FROM the
 * MapStore; if it isn't there yet, builds it ONCE via exploreGitHub (never
 * re-explores a known skeleton — success criterion #3). Confirms the structural
 * route search-entry -> result-list -> repo-detail exists, then delegates the
 * result-list -> candidates -> evidence gathering to recall() unchanged.
 */
export function recallViaMap(args: RecallViaMapArgs): RecallResponse {
  const { query, goal, store, browser, extractSignals } = args;

  // 1. Ensure the skeleton is present in the map; build it once if missing.
  if (store.getState('github:repo-detail') === null ||
      store.edgesFrom('github:search-entry').length === 0) {
    skeleton.exploreGitHub(store);
  }

  // 2. Confirm the route exists: search step + navigate step.
  const searchEdge = store.edgesFrom('github:search-entry')
    .find(e => e.toState === 'github:result-list' && e.acceptsInput === 'query');
  const navigateEdge = store.edgesFrom('github:result-list')
    .find(e => e.toState === 'github:repo-detail' && e.kind === 'navigate');

  if (!searchEdge || !navigateEdge) {
    return { status: 'failed', reason: 'no route to repo-detail in map' };
  }

  // 3. Route confirmed — delegate candidate/evidence gathering to recall().
  return recall({ query, goal, browser, extractSignals });
}
