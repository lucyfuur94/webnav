import { describe, it, expect } from 'vitest';
import { runRecallLive } from '../../src/router/live.js';

const LIVE = process.env.WEBNAV_LIVE === '1';

describe.skipIf(!LIVE)('recall (goal-driven, live)', () => {
  it('github-repos goal returns real repo evidence', async () => {
    const r = await runRecallLive('python retry', 3, ':memory:', 'github-repos');
    expect(r.status).toBe('done');
    if (r.status !== 'done') throw new Error('expected done');
    expect(r.evidence.candidates.length).toBeGreaterThan(0);
    expect(r.evidence.candidates[0]).toHaveProperty('signals');
  }, 120000);
});
