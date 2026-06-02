import { MapStore } from './mapstore/store.js';
import { seedGraph } from './graph/seed.js';
import { startServer } from './server.js';

const port = Number(process.env.WEBNAV_PORT ?? 7777);
const store = new MapStore(process.env.WEBNAV_DB ?? 'webnav.db');
// Seed once if the map is empty (DB is the source of truth; this populates it).
if (!store.getNode('github.com')) seedGraph(store);
startServer(store, port);
console.log(`webnav graph viewer → http://127.0.0.1:${port}`);
