import type { State } from '../mapstore/types.js';
import type { MapStore } from '../mapstore/store.js';
import type { RecallResponse } from '../protocol.js';
import { parseSnapshot } from '../playwright/snapshot.js';
import { matchState } from '../explorer/fingerprint.js';
import { replayStep } from './replay.js';

// Minimal browser the walk drives. The live adapter implements this; tests fake it.
export interface WalkBrowser {
  snapshot(): string;          // current page snapshot YAML
  act(ref: string): void;      // perform the resolved action (click/fill) on a ref
  callCount(): number;
}

export interface WalkArgs {
  goalName: string;
  startStateId: string;        // e.g. 'sd:login'
  goalStateId: string;         // e.g. 'sd:checkout-overview'
  store: MapStore;
  states: State[];             // known states for matchState (the skeleton's states)
  browser: WalkBrowser;
  inputs: Record<string, string>;  // runtime slot values (credentials, shipping, ...) — NOT stored as map
}

/**
 * The interactive multi-step walk (design §3). Walks a linear route edge-by-edge
 * from `startStateId` toward `goalStateId`, verifying every step (prediction vs
 * observation) and escalating to the agent on drift or at a commit point.
 *
 * Zero LLM: replayStep resolves deterministically (cached ref, then role+name);
 * any decision webnav isn't allowed to make is handed back as a `needs-*` response.
 */
export function walkRoute(args: WalkArgs): RecallResponse {
  const { goalName, startStateId, goalStateId, store, states, browser, inputs } = args;
  // `inputs` is runtime-only (credentials/shipping); the live adapter consumes it
  // when filling acceptsInput edges. The unit fake just advances on act(), so we
  // don't read it here — referencing it keeps the contract explicit.
  void inputs;

  let current = startStateId;
  let at = 0;

  // Halt as soon as we've arrived: this check at the TOP means when goalStateId is
  // a state the route passes THROUGH (e.g. sd:checkout-overview), the walk stops
  // there and never attempts the next edge (the Finish commit point).
  while (current !== goalStateId) {
    const edges = store.edgesFrom(current);
    if (edges.length === 0) {
      return { status: 'failed', reason: 'no edge from ' + current };
    }
    // Linear route: each non-goal state has exactly one outgoing edge.
    const edge = edges[0];

    // Read the CURRENT page (before acting) so commit/drift checks see this page.
    const yaml = browser.snapshot();
    const nodes = parseSnapshot(yaml);

    const r = replayStep(edge, nodes);
    if (r.status === 'blocked-commit' || r.status === 'needs-classify') {
      // Commit-point halt: NEVER act. Hand the action to the agent to classify.
      return { status: 'needs-classification', action: edge.semanticStep, snapshot: yaml };
    }
    if (r.status === 'escalate') {
      // Real drift: deterministic resolve couldn't find the step on this page.
      return {
        status: 'needs-navigation',
        at,
        semanticStep: edge.semanticStep,
        snapshot: yaml,
        question: 'expected to reach ' + edge.toState + ' but cannot resolve the step on the current page',
      };
    }

    // r.status === 'ok' — perform the resolved action. Input filling for
    // acceptsInput edges is handled by the live browser via `inputs`; the unit
    // fake's act() just advances the scripted snapshot.
    browser.act(r.ref);

    // PREDICTION vs OBSERVATION: compare the edge's expected toState against the
    // live snapshot. Mismatch or ambiguity → escalate, never march on blind.
    const afterYaml = browser.snapshot();
    const observed = matchState(parseSnapshot(afterYaml), states);
    if (observed.status !== 'matched' || observed.state.id !== edge.toState) {
      return {
        status: 'needs-navigation',
        at,
        semanticStep: edge.semanticStep,
        snapshot: afterYaml,
        question: 'expected ' + edge.toState + ' but observed '
          + (observed.status === 'matched' ? observed.state.id : observed.status),
      };
    }

    // Success: self-heal write-back, then advance.
    store.recordOutcome(edge.fromState, edge.toState, edge.semanticStep, true);
    current = edge.toState;
    at++;
  }

  // Reached the goal. Goal-state evidence is minimal for W1 (YAGNI) — the focus of
  // this increment is the WALK + escalation; a later increment enriches evidence.
  return {
    status: 'done',
    evidence: {
      goal: goalName,
      query: goalName,
      candidates: [],
      cost: {
        playwright_calls: browser.callCount(),
        savings: { raw_snapshot_tokens: 0, bundle_tokens: 0, tokens_saved: 0, chars_per_token: 4 },
      },
    },
  };
}
