# xyflow Graph Viewer — Design

**Date:** 2026-06-05 · **Status:** approved (brainstorm complete) · **Increment:** graph-viewer-v2 (replace Cytoscape with xyflow + elkjs)

## Problem

webnav's live graph viewer renders with **Cytoscape.js** (CDN-loaded) via a hand-written, framework-free HTML string (`src/graph/html.ts`) plus a static `webnav dev graph --html` export. As the graph becomes something an **agent builds and a human/agent corrects** (we just shipped `graph-edit` + agent-driven site mapping), the viewer wants richer per-node UI (capabilities, signals, access/door terms) and a foundation that can later become an editor. Cytoscape nodes are shapes+labels; rich in-node UI and an editing future fit **xyflow (React Flow)** far better. This increment swaps the *rendering layer* to xyflow + **elkjs** layout, while leaving the map's data and logic untouched.

## Scope (settled in brainstorm)

- **Q1 = A:** A new isolated **`web/`** Vite + React + TypeScript app renders the graph; `npm run build` builds it to `web/dist/`; the existing Node server serves that static dist at `/`.
- **Q2 = elkjs:** one layout engine for BOTH the clustered top-level graph AND the interior state-machines (incl. cyclic fork edges). dagre rejected (unmaintained, no native grouping, weak on cycles).
- **Q3 = A:** **replace cleanly** — remove `src/graph/html.ts` and the `graph --html` flag/branch + their tests. Keep the JSON APIs and data-builders (`export.ts`, `interior.ts`) exactly as-is.
- **Q4 = A:** **read-only viewer** with drill-in parity + rich node cards + fork-edge marking. NO live editing in v1 (server stays read-only; editing is a later increment). Drop the copy-paste teach forms.

## Invariants (the logic the user confirmed)

1. **Read-only.** The viewer shows the map; it never edits it. The server gains NO write endpoints.
2. **Map data + logic untouched.** Only the rendering changes. Same APIs (`/api/graph`, `/api/node/:id/interior`), same builders (`buildGraphView`, `buildNodeInterior`).
3. **`web/` is isolated.** React/xyflow/elk live in `web/`'s own package; the root webnav package stays dependency-light (better-sqlite3 + yaml only).
4. **Never a blank screen.** API-down, no-interior, empty-graph, and layout-failure all degrade to a clear message or a still-rendered fallback.

## User-facing behavior

1. Open the live server (`npm run dev` → http://127.0.0.1:7777) → the whole internet graph, sites grouped into capability clusters.
2. **Click a site → drill into its interior** (the mapped navigation skeleton: states + action-edges). A back affordance returns to the cluster view.
3. **Fork edges (`needs-input`) are visually distinct** (dashed/colored) — "the map stops here; a human/agent must decide."
4. Errors degrade gracefully (see Invariant 4).

## Architecture

The existing server (`src/server.ts`) already exposes the exact JSON the viewer needs:
- `GET /api/graph` → `GraphView` (`{ nodes:[{id,homeUrl,capabilities,topics,clusters}], clusters:string[], edges:[{from,to,kind,weight}] }`)
- `GET /api/node/:id/interior` → `NodeInteriorView` (`{ nodeId, states:[{id,semanticName,role,availableSignals,urlPattern}], edges:[{from,to,semanticStep,kind}] }`)

The new `web/` app is a pure client of those. Production: `src/server.ts` serves `web/dist/` static files at `/` and assets (replacing the `renderGraphHtml(...)` call), and continues to serve the JSON APIs. Development: `vite dev` runs the React app with HMR, proxying `/api/*` to the Node server (started as today).

**Removed:** `src/graph/html.ts`, the `graph --html` CLI flag + dispatch branch, `tests/graph/html.test.ts`, and the `--html` assertions in CLI/spec/surface tests. **Untouched:** `export.ts`, `interior.ts`, all API routes, all navigation/map logic.

`web/` carries its own `package.json` so React/xyflow/elk never enter the root deps. The root `package.json` only learns to (a) build `web/` as part of `npm run build` and (b) the server serves its dist.

## Components

**`web/` (each file one job):**
- `web/package.json` — deps: `react`, `react-dom`, `@xyflow/react`, `elkjs`; dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
- `web/vite.config.ts` — React plugin; dev proxy `/api → http://127.0.0.1:7777`; `build.outDir='dist'`, `base:'./'` (relative asset paths so the server can serve them).
- `web/tsconfig.json` — with a path alias to import the server's `GraphView`/`NodeInteriorView` types from `../src/graph/*` (the API drift guard) — type-only imports, no runtime coupling.
- `web/src/api.ts` — `fetchGraph()`, `fetchInterior(id)`; return the server's exported types.
- `web/src/layout.ts` — `layoutGraph(nodes, edges, mode)` wrapping elkjs: `mode:'clusters'` (compound/grouped) for the top-level, `mode:'interior'` (layered) for a site's state-machine. ALL ELK config lives here. Pure mapping (our data → ELK graph → positioned xyflow nodes/edges). elk runs in a web worker (`elkjs/lib/elk-worker`); on failure, a trivial grid fallback so render never dies.
- `web/src/nodes/SiteNode.tsx` — custom node: site id + capability/cluster chips.
- `web/src/nodes/StateNode.tsx` — custom node: state semanticName + role + signals.
- `web/src/edges.ts` (or inline edge styling) — fork/`needs-input` edges dashed+colored; normal edges solid. (Detect `needs-input` from the interior edge's `semanticStep` containing `[needs-input:` and/or `kind === 'unclassified'`.)
- `web/src/GraphView.tsx` — loads `/api/graph`, groups nodes into cluster group-nodes, elk-layouts (`clusters`), renders `<ReactFlow>` + `<MiniMap>` + `<Controls>`. Click a site → select it.
- `web/src/InteriorView.tsx` — loads `/api/node/:id/interior`, elk-layouts (`interior`), renders; back affordance.
- `web/src/App.tsx` — holds `selectedNode` state; swaps GraphView ↔ InteriorView (no router).
- `web/src/main.tsx` + `web/index.html` — mount.

**Server (`src/server.ts`):** add `serveStatic(req, res, distDir)` — resolves the request path inside `distDir`, sends the file with a content-type by extension, SPA-falls-back to `index.html` for non-asset paths, and **guards path traversal** (resolved path must stay within `distDir`). If `web/dist/` is absent, respond with a clear "run `npm run build`" hint (not a bare 404). The `/` and non-`/api` routes call `serveStatic`; `/api/*` routes are unchanged. Server remains GET-only and read-only.

## Data flow

browser → `GET /` → server serves `web/dist/index.html` + assets → React boots → `fetchGraph()` → `layoutGraph(..., 'clusters')` in worker → render clusters → click site → `fetchInterior(id)` → `layoutGraph(..., 'interior')` → render interior → back → cluster view.

## Error handling

- **API fetch fails / server down:** inline error banner per view ("couldn't reach the map API"), never a blank screen.
- **Unknown / empty interior (404 or zero states):** InteriorView shows "no interior recorded for this node yet" + back. (Real case: a `node-add`ed-but-unmapped node.)
- **Empty graph (zero nodes):** GraphView empty-state hint pointing at `webnav dev record-start` / `graph-edit`.
- **ELK layout throws:** catch → trivial grid placement so nodes still render.
- **Server static branch:** path-traversal guard; missing `web/dist/` → "run `npm run build`" message.

## Testing strategy

- **`serveStatic` (vitest, existing suite):** serves an existing asset with correct content-type; blocks `../` traversal; returns the build hint when `dist/` is absent; `/api/*` still routes to JSON; `/` falls back to `index.html`.
- **`web/src/layout.ts` (vitest in `web/`, node env):** the pure mapping — small fixture (a couple clusters + an interior with a fork edge) → assert every node gets a position, all edges preserved, fork edge flagged. Layout is the riskiest logic → primary test target.
- **API type-drift guard:** `web/src/api.ts` imports the server's `GraphView`/`NodeInteriorView`; a compile check (tsc on `web/`) fails if the contract drifts.
- **React components:** NOT unit-tested in v1 (visual, low value/high cost).
- **Acceptance gate — live render:** `npm run build && npm run dev`, drive headless via **playwright-cli** (the project's established verification path, since the Chrome MCP bridge has been flaky; playwright-cli blocks `file:` URLs so we hit the running server over http). Confirm: clusters render, drill-in loads an interior, fork edges marked, error/empty states show.

## Out of scope (v1, deliberate)

- Live editing / server write endpoints (next increment; touches the read-only invariant, deserves its own design).
- The retired static `webnav dev graph --html` single-file export (a future "export snapshot" button on the xyflow app is the better replacement if needed).
- React component unit tests.

## Migration / removals

- Delete `src/graph/html.ts` and `tests/graph/html.test.ts`.
- Remove the `graph --html` flag from `cli-spec.ts`, the `--html` branch in `cli.ts`'s `graph` dispatch, and `--html` assertions in `tests/cli-spec.test.ts` / `tests/cli/surface.test.ts` (and the `graph` verb's `--html` example).
- `src/server.ts`: replace the `renderGraphHtml(...)` import+call at `/` with `serveStatic`.
- `package.json`: `build` also builds `web/` (e.g. `tsc && cp ... && npm --prefix web run build`); a `dev:web` script runs `vite` in `web/`. `web/` added to the repo; `web/dist/` and `web/node_modules/` gitignored.
