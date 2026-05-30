import { describe, it, expect } from 'vitest';
import { walkRoute, type WalkBrowser } from '../../src/router/walk.js';
import { MapStore } from '../../src/mapstore/store.js';
import { SAUCEDEMO_SKELETON, exploreSaucedemo } from '../../src/explorer/saucedemo-skeleton.js';

// Snapshots that match each state's fingerprint, keyed by the state we're "on".
const SNAP: Record<string, string> = {
  'sd:login': '- textbox "Username" [ref=e1]\n- button "Login" [ref=e2]',
  'sd:inventory': '- button "Add to cart" [ref=e10]',
  'sd:cart': '- button "Checkout" [ref=e20]',
  'sd:checkout-info': '- textbox "First Name" [ref=e30]\n- button "Continue" [ref=e31]',
  'sd:checkout-overview': '- button "Finish" [ref=e40]',
};
// A scripted browser: walks through a given ordered list of states, advancing on each act().
function scriptedBrowser(stateSeq: string[]): WalkBrowser {
  let i = 0; let calls = 0;
  return {
    snapshot: () => { calls++; return SNAP[stateSeq[Math.min(i, stateSeq.length - 1)]]; },
    act: () => { i = Math.min(i + 1, stateSeq.length - 1); },
    callCount: () => calls,
  };
}
const states = SAUCEDEMO_SKELETON.states;
function freshStore() { const s = new MapStore(':memory:'); exploreSaucedemo(s); return s; }

describe('walkRoute (interactive multi-step walk)', () => {
  it('walks login -> checkout-overview and halts at the Finish commit point', () => {
    const store = freshStore();
    // The scripted browser advances through the real route order:
    const seq = ['sd:login', 'sd:inventory', 'sd:cart', 'sd:checkout-info', 'sd:checkout-overview', 'sd:checkout-overview'];
    const r = walkRoute({
      goalName: 'complete-checkout-dryrun', startStateId: 'sd:login',
      goalStateId: 'sd:checkout-overview', store, states, browser: scriptedBrowser(seq),
      inputs: { credentials: 'standard_user/secret_sauce', shipping: 'A B 12345' },
    });
    expect(r.status).toBe('done');
  });

  it('returns needs-classification at the Finish commit point when goal is purchase-complete', () => {
    const store = freshStore();
    // Goal is the post-commit state; the walk must hit the unclassified Finish edge and halt.
    const seq = ['sd:login', 'sd:inventory', 'sd:cart', 'sd:checkout-info', 'sd:checkout-overview', 'sd:checkout-overview'];
    const r = walkRoute({
      goalName: 'buy', startStateId: 'sd:login',
      goalStateId: 'sd:purchase-complete', store, states, browser: scriptedBrowser(seq),
      inputs: {},
    });
    expect(r.status).toBe('needs-classification');
    if (r.status === 'needs-classification') expect(r.action).toMatch(/Finish/i);
  });

  it('escalates needs-navigation when a step lands on an unexpected state', () => {
    const store = freshStore();
    // After login, jump straight to checkout-overview (skipping inventory) — observed != toState.
    const seq = ['sd:login', 'sd:checkout-overview', 'sd:checkout-overview'];
    const r = walkRoute({
      goalName: 'x', startStateId: 'sd:login',
      goalStateId: 'sd:checkout-overview', store, states, browser: scriptedBrowser(seq),
      inputs: {},
    });
    expect(r.status).toBe('needs-navigation');
  });
});
