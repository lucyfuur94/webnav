import { describe, it, expect } from 'vitest';
import { MapStore } from '../../src/mapstore/store.js';
import { makeState } from '../../src/mapstore/types.js';

describe('states.node_id', () => {
  it('round-trips nodeId through upsert/get', () => {
    const store = new MapStore(':memory:');
    store.upsertState(makeState({ id: 'github:repo-detail', nodeId: 'github.com',
      semanticName: 'github:repo-detail', urlPattern: 'https://github.com/*/*',
      role: 'detail', availableSignals: ['stars'], fingerprint: ['heading'] }));
    const got = store.getState('github:repo-detail');
    expect(got?.nodeId).toBe('github.com');
  });
});
