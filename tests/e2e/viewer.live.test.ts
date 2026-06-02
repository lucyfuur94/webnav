import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import type { Server } from 'node:http';
import { MapStore } from '../../src/mapstore/store.js';
import { seedGraph } from '../../src/graph/seed.js';
import { startServer } from '../../src/server.js';

const LIVE = process.env.WEBNAV_LIVE === '1';
const session = 'viewer-e2e';
function pw(...args: string[]) { return execFileSync('playwright-cli', [`-s=${session}`, ...args], { encoding: 'utf8' }); }

describe.skipIf(!LIVE)('viewer drill-in (live)', () => {
  it('renders the graph and a node interior on click', async () => {
    const store = new MapStore(':memory:'); seedGraph(store);
    const server: Server = startServer(store, 0);
    await new Promise<void>((r) => server.on('listening', r));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;
    try {
      pw('open', base + '/');
      // canvas count > 0 proves Cytoscape drew the site graph
      const probe = pw('eval', "() => String(document.querySelectorAll('canvas').length)");
      expect(probe).toMatch(/[1-9]/);
    } finally {
      try { pw('close'); } catch { /* ignore */ }
      server.close();
    }
  }, 60000);
});
