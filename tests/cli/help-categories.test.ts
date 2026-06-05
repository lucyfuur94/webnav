import { describe, it, expect } from 'vitest';
import { topLevelHelp, devHelp, commandHelp } from '../../src/cli-help.js';

describe('help — use/dev categories', () => {
  it('top-level help shows a use section', () => {
    expect(topLevelHelp().toLowerCase()).toContain('use');
  });
  it('dev help lists the mapping verbs', () => {
    const h = devHelp();
    for (const v of ['record-start', 'record-stop', 'graph-analyse', 'graph-edit', 'graph-show']) {
      expect(h).toContain(v);
    }
  });
  it('per-verb help works for a mapping verb', () => {
    expect(commandHelp('graph-analyse').toLowerCase()).toContain('session');
  });
});
