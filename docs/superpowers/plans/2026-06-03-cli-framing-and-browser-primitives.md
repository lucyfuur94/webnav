# webnav CLI Framing + Browser Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe webnav's CLI the way playwright-cli frames itself — group `--help` by purpose (Find/Read/Navigate) and teach data-flow in per-verb help — then add browser primitives `eval`/`network`/`go-back`/`reload`, each with playwright-style descriptions.

**Architecture:** Phase 1 is presentation-only: add a `group` field to `CommandSpec`, tag consumer commands, render `topLevelHelp` under group headers, enrich arg descriptions to name where inputs come from / outputs go. Phase 2 adds 4 thin adapter methods + 4 CLI verbs (in the Navigate group), each wrapping playwright-cli via the existing `PlaywrightAdapter`. Zero behavior change in Phase 1; Phase 2 only adds verbs.

**Tech Stack:** TypeScript (strict), Node 18+, vitest, playwright-cli. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-03-cli-framing-and-browser-primitives-design.md`

---

## File structure

- **Modify** `src/cli-spec.ts` — add `group` to `CommandSpec`; tag consumer commands; add `eval`/`network`/`go-back`/`reload` specs; enrich arg descriptions with data-flow.
- **Modify** `src/cli-help.ts` — render `topLevelHelp` grouped by `group`.
- **Modify** `src/playwright/adapter.ts` — add `evalJs`, `network`, `goBack`, `reload` methods.
- **Create** `src/router/browse.ts` — `runEval`/`runNetwork`/`runGoBack`/`runReload` (thin, injectable, unit-testable wrappers returning result objects).
- **Modify** `src/cli.ts` — parse + handle the 4 new verbs.
- **Test:** `tests/cli/help-groups.test.ts`, `tests/router/browse.test.ts`, extend `tests/cli/surface.test.ts`, gated `tests/e2e/browse.live.test.ts`.

---

## Task 1: Add `group` to CommandSpec + tag consumer commands (Phase 1 data)

**Files:**
- Modify: `src/cli-spec.ts`
- Test: `tests/cli/spec-groups.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/spec-groups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CONSUMER_COMMANDS } from '../../src/cli-spec.js';

describe('consumer command groups', () => {
  it('every consumer command has a group', () => {
    for (const c of CONSUMER_COMMANDS) {
      expect(['find', 'read', 'navigate']).toContain((c as any).group);
    }
  });

  it('the core verbs land in the expected groups', () => {
    const byName = Object.fromEntries(CONSUMER_COMMANDS.map((c) => [c.name, (c as any).group]));
    expect(byName['locate']).toBe('find');
    expect(byName['route']).toBe('find');
    expect(byName['list-goals']).toBe('find');
    expect(byName['read']).toBe('read');
    expect(byName['recall']).toBe('read');
    expect(byName['search']).toBe('read');
    expect(byName['hop']).toBe('navigate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/spec-groups.test.ts`
Expected: FAIL — commands have no `group` field.

- [ ] **Step 3: Add the `group` field + tag each consumer command**

In `src/cli-spec.ts`, add to the `CommandSpec` interface (after `name`):

```typescript
  group?: 'find' | 'read' | 'navigate';
```

(Optional so DEV_COMMANDS need not set it.)

Then add `group:` to each CONSUMER_COMMANDS entry:
- `locate` → `group: 'find',`
- `read` → `group: 'read',`
- `recall` → `group: 'read',`
- `search` → `group: 'read',`
- `route` → `group: 'find',`
- `hop` → `group: 'navigate',`
- `list-goals` → `group: 'find',`

Place the `group:` line right after each command's `name:` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/spec-groups.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli-spec.ts tests/cli/spec-groups.test.ts
git commit -m "feat(cli): group field on consumer commands (find/read/navigate)"
```

---

## Task 2: Render top-level help grouped by category (Phase 1)

**Files:**
- Modify: `src/cli-help.ts`
- Test: `tests/cli/help-groups.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/help-groups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { topLevelHelp } from '../../src/cli-help.js';

describe('grouped top-level help', () => {
  const h = topLevelHelp();

  it('shows the group headers', () => {
    expect(h).toMatch(/^Find:/m);
    expect(h).toMatch(/^Read:/m);
    expect(h).toMatch(/^Navigate:/m);
  });

  it('lists locate under Find and recall under Read (ordering)', () => {
    const findIdx = h.indexOf('Find:');
    const readIdx = h.indexOf('Read:');
    const navIdx = h.indexOf('Navigate:');
    const locateIdx = h.indexOf('locate ');
    const recallIdx = h.indexOf('recall ');
    expect(findIdx).toBeGreaterThanOrEqual(0);
    expect(locateIdx).toBeGreaterThan(findIdx);
    expect(locateIdx).toBeLessThan(readIdx);     // locate is in the Find block
    expect(recallIdx).toBeGreaterThan(readIdx);
    expect(recallIdx).toBeLessThan(navIdx);      // recall is in the Read block
  });

  it('still points at the dev namespace', () => {
    expect(h).toContain('webnav dev');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/help-groups.test.ts`
Expected: FAIL — current help renders a flat `Commands:` list, no group headers.

- [ ] **Step 3: Render grouped**

In `src/cli-help.ts`, replace the body of `topLevelHelp()` between the `Version:`/blank lines and the `Global flags:` section. Replace the current flat command loop:

```typescript
  lines.push('Commands:');
  const nameWidth = Math.max(...CONSUMER_COMMANDS.map((c) => c.name.length));
  for (const c of CONSUMER_COMMANDS) {
    lines.push(`  ${pad(c.name, nameWidth)}  ${c.summary}`);
  }
```

with a grouped renderer:

```typescript
  const GROUPS: { key: 'find' | 'read' | 'navigate'; header: string }[] = [
    { key: 'find', header: 'Find:      (where is it)' },
    { key: 'read', header: 'Read:      (get content / evidence)' },
    { key: 'navigate', header: 'Navigate:  (drive a page)' },
  ];
  const nameWidth = Math.max(...CONSUMER_COMMANDS.map((c) => c.name.length));
  for (const g of GROUPS) {
    const cmds = CONSUMER_COMMANDS.filter((c) => c.group === g.key);
    if (cmds.length === 0) continue;
    lines.push(g.header);
    for (const c of cmds) {
      lines.push(`  ${pad(c.name, nameWidth)}  ${c.summary}`);
    }
    lines.push('');
  }
```

(Keep the tagline, Usage, Version lines above it and the Global flags + dev pointer below it unchanged. Remove the now-duplicate trailing blank line if doubled.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/help-groups.test.ts`
Expected: PASS (3 tests).

Also run the existing surface test to confirm no regression:
Run: `npx vitest run tests/cli/surface.test.ts`
Expected: PASS (it asserts consumer verbs are present + dev pointer — still true).

- [ ] **Step 5: Commit**

```bash
git add src/cli-help.ts tests/cli/help-groups.test.ts
git commit -m "feat(cli): render top-level help grouped by Find/Read/Navigate"
```

---

## Task 3: Teach data-flow in arg descriptions (Phase 1)

**Files:**
- Modify: `src/cli-spec.ts`
- Test: `tests/cli/dataflow-help.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/dataflow-help.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { commandHelp } from '../../src/cli-help.js';

describe('per-verb help teaches data-flow', () => {
  it('recall help points at list-goals for the goal id', () => {
    expect(commandHelp('recall')).toMatch(/list-goals/);
  });
  it('read help points at locate for the url', () => {
    expect(commandHelp('read')).toMatch(/locate/);
  });
  it('hop help says the url is the current page', () => {
    expect(commandHelp('hop')).toMatch(/current/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/dataflow-help.test.ts`
Expected: FAIL — `read` arg currently says "The URL to open and read." (no `locate` mention); `recall` goal arg says "see list-goals" already (that one may pass) but `read`/`hop` will fail.

- [ ] **Step 3: Enrich the arg descriptions**

In `src/cli-spec.ts`, update these arg `description` strings (leave everything else):

- `recall` arg `goal`: `'Goal id from `list-goals` (defaults to github-repos).'`
- `recall` arg `query`: `'Search term fed into the goal\\'s entry.'` (keep as-is if already similar)
- `read` arg `url`: `'A URL to open — e.g. a coordinate from `locate`.'`
- `locate` arg `place`: `'A known place name (list via `webnav dev list`).'`
- `hop` arg `url`: `'The page URL you are currently on.'`
- `route` arg `request`: `'What you want to do; returns candidate sites to act on.'`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/dataflow-help.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli-spec.ts tests/cli/dataflow-help.test.ts
git commit -m "docs(cli): arg descriptions teach data-flow (where inputs come from)"
```

---

## Task 4: Adapter methods for the new primitives

**Files:**
- Modify: `src/playwright/adapter.ts`
- Test: `tests/playwright/adapter-browse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/playwright/adapter-browse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PlaywrightAdapter } from '../../src/playwright/adapter.js';

function recordingAdapter() {
  const calls: string[][] = [];
  const run = async (args: string[]) => { calls.push(args); return 'OUT'; };
  const a = new PlaywrightAdapter('t', run, () => '');
  return { a, calls };
}

describe('adapter browse methods', () => {
  it('evalJs passes the js expression to playwright-cli eval', async () => {
    const { a, calls } = recordingAdapter();
    const out = await a.evalJs('() => document.title');
    expect(out).toBe('OUT');
    expect(calls[0]).toEqual(['-s=t', 'eval', '() => document.title']);
  });
  it('network calls the network verb', async () => {
    const { a, calls } = recordingAdapter();
    await a.network();
    expect(calls[0]).toEqual(['-s=t', 'network']);
  });
  it('goBack and reload call their verbs', async () => {
    const { a, calls } = recordingAdapter();
    await a.goBack();
    await a.reload();
    expect(calls[0]).toEqual(['-s=t', 'go-back']);
    expect(calls[1]).toEqual(['-s=t', 'reload']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/playwright/adapter-browse.test.ts`
Expected: FAIL — methods don't exist.

- [ ] **Step 3: Add the methods**

In `src/playwright/adapter.ts`, add these methods to the `PlaywrightAdapter` class (after `press`):

```typescript
  evalJs(func: string) { return this.exec('eval', func); }
  network() { return this.exec('network'); }
  goBack() { return this.exec('go-back'); }
  reload() { return this.exec('reload'); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/playwright/adapter-browse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/playwright/adapter.ts tests/playwright/adapter-browse.test.ts
git commit -m "feat(playwright): adapter methods eval/network/go-back/reload"
```

---

## Task 5: The browse verbs (runEval/runNetwork/runGoBack/runReload)

**Files:**
- Create: `src/router/browse.ts`
- Test: `tests/router/browse.test.ts`

These open a session, run the primitive, return a result object, and close. Injectable adapter for unit testing without a browser.

- [ ] **Step 1: Write the failing test**

Create `tests/router/browse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runEval, runNetwork } from '../../src/router/browse.js';

// A fake adapter capturing calls + returning canned outputs.
function fakeAdapter(outputs: Record<string, string>) {
  return {
    open: async () => '',
    evalJs: async (_f: string) => outputs.eval ?? '',
    network: async () => outputs.network ?? '',
    close: async () => '',
  } as any;
}

describe('runEval', () => {
  it('returns the page eval value', async () => {
    const r = await runEval('https://example.com', '() => 42', fakeAdapter({ eval: '42' }));
    expect(r.status).toBe('done');
    if (r.status !== 'done') throw new Error('expected done');
    expect(r.value).toBe('42');
    expect(r.url).toBe('https://example.com');
  });
  it('maps an open/eval error to failed', async () => {
    const bad = { open: async () => { throw new Error('boom'); }, close: async () => '' } as any;
    const r = await runEval('https://x', '() => 1', bad);
    expect(r.status).toBe('failed');
  });
});

describe('runNetwork', () => {
  it('returns the raw network output', async () => {
    const r = await runNetwork('https://example.com', fakeAdapter({ network: 'GET https://api/x 200' }));
    expect(r.status).toBe('done');
    if (r.status !== 'done') throw new Error('expected done');
    expect(r.requests).toContain('api/x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/router/browse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the browse verbs**

Create `src/router/browse.ts`:

```typescript
import { PlaywrightAdapter } from '../playwright/adapter.js';

// Minimal structural type so these helpers accept either a real PlaywrightAdapter
// or a fake (for tests). Only the methods we use are required.
export interface BrowseAdapter {
  open(url: string): Promise<string>;
  evalJs?(func: string): Promise<string>;
  network?(): Promise<string>;
  goBack?(): Promise<string>;
  reload?(): Promise<string>;
  close(): Promise<string>;
}

export type EvalResponse =
  | { status: 'done'; url: string; value: string }
  | { status: 'failed'; url: string; reason: string };

export type NetworkResponse =
  | { status: 'done'; url: string; requests: string }
  | { status: 'failed'; url: string; reason: string };

function newAdapter(): BrowseAdapter {
  return new PlaywrightAdapter(`browse-${Date.now()}`);
}

/** Open url, run a `() => value` JS expression in the page, return the value. */
export async function runEval(url: string, func: string, adapter: BrowseAdapter = newAdapter()): Promise<EvalResponse> {
  try {
    await adapter.open(url);
    const value = (await adapter.evalJs!(func)).trim();
    return { status: 'done', url, value };
  } catch (e) {
    return { status: 'failed', url, reason: String(e) };
  } finally {
    await adapter.close().catch(() => {});
  }
}

/** Open url, return the network requests the page issued (the API calls behind the DOM). */
export async function runNetwork(url: string, adapter: BrowseAdapter = newAdapter()): Promise<NetworkResponse> {
  try {
    await adapter.open(url);
    const requests = (await adapter.network!()).trim();
    return { status: 'done', url, requests };
  } catch (e) {
    return { status: 'failed', url, reason: String(e) };
  } finally {
    await adapter.close().catch(() => {});
  }
}
```

Note: `go-back`/`reload` operate on an EXISTING session, so they don't open a fresh one. They're thin and session-scoped; we expose them at the CLI layer (Task 7) by calling the adapter directly on the named session. We do NOT add runGoBack/runReload helpers here (no open/close lifecycle to wrap) — the CLI handler calls `adapter.goBack()`/`adapter.reload()` on the `-s=` session directly. (If a future caller needs them as functions, add then.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/router/browse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/router/browse.ts tests/router/browse.test.ts
git commit -m "feat(router): runEval/runNetwork browse helpers (targeted extraction)"
```

---

## Task 6: Spec entries for the new Navigate verbs (playwright-style help)

**Files:**
- Modify: `src/cli-spec.ts`
- Test: extend `tests/cli/help-groups.test.ts`

- [ ] **Step 1: Add an assertion that the new verbs render under Navigate**

Append to `tests/cli/help-groups.test.ts` (inside the describe):

```typescript
  it('eval and network appear under Navigate', () => {
    const navIdx = h.indexOf('Navigate:');
    const evalIdx = h.indexOf('eval ');
    const netIdx = h.indexOf('network ');
    expect(evalIdx).toBeGreaterThan(navIdx);
    expect(netIdx).toBeGreaterThan(navIdx);
  });
```

Note: `h` is computed once at top of the existing describe; this test re-uses it. If `h` is captured before these specs exist it still reflects the post-Task-6 spec since topLevelHelp reads CONSUMER_COMMANDS live — fine.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/help-groups.test.ts`
Expected: FAIL — eval/network not in the spec yet.

- [ ] **Step 3: Add the four command specs (group: 'navigate')**

In `src/cli-spec.ts`, add these to `CONSUMER_COMMANDS` (place after `hop`):

```typescript
  {
    name: 'eval',
    group: 'navigate',
    summary: 'Open a URL and run a JS expression in the page — returns just the value (cheap, targeted extraction).',
    args: [
      { name: 'url', required: true, description: 'A URL to open.' },
      { name: 'js', required: true, description: 'A () => <value> JS expression evaluated in the page; its return value is returned.' },
    ],
    flags: [],
    example: 'webnav eval https://github.com/psf/requests "() => document.title"',
  },
  {
    name: 'network',
    group: 'navigate',
    summary: 'Open a URL and return the network/API calls the page made (often the JSON behind the rendered DOM).',
    args: [{ name: 'url', required: true, description: 'A URL to open.' }],
    flags: [],
    example: 'webnav network https://api-backed-site.example',
  },
  {
    name: 'go-back',
    group: 'navigate',
    summary: 'Step back in the current browser session (use -s=<session> to target it).',
    args: [],
    flags: [],
    example: 'webnav -s=mysession go-back',
  },
  {
    name: 'reload',
    group: 'navigate',
    summary: 'Reload the page in the current browser session (use -s=<session> to target it).',
    args: [],
    flags: [],
    example: 'webnav -s=mysession reload',
  },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/cli/help-groups.test.ts tests/cli/spec-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli-spec.ts tests/cli/help-groups.test.ts
git commit -m "feat(cli): eval/network/go-back/reload specs (Navigate group, playwright-style help)"
```

---

## Task 7: Wire the new verbs into the CLI

**Files:**
- Modify: `src/cli.ts`
- Test: extend `tests/cli/surface.test.ts` (parser) — or `tests/cli.test.ts`

READ `src/cli.ts` fully first (ParsedArgs union, parseArgs, KNOWN_VERBS, main()).

- [ ] **Step 1: Write the failing parser test**

Append to `tests/cli.test.ts` (inside the `parseArgs` describe):

```typescript
  it('parses eval with url + js', () => {
    expect(parseArgs(['eval', 'https://x.com', '() => 1']))
      .toEqual({ cmd: 'eval', url: 'https://x.com', js: '() => 1' });
  });
  it('parses network with a url', () => {
    expect(parseArgs(['network', 'https://x.com']))
      .toEqual({ cmd: 'network', url: 'https://x.com' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL — parser returns the unknown-command shape for eval/network.

- [ ] **Step 3: Wire parser + handlers + KNOWN_VERBS**

In `src/cli.ts`:

Add to the `ParsedArgs` union:
```typescript
  | { cmd: 'eval'; url: string; js: string }
  | { cmd: 'network'; url: string }
  | { cmd: 'go-back' }
  | { cmd: 'reload' }
```

Add to `KNOWN_VERBS` (it already spreads COMMANDS.map; since these are now in CONSUMER_COMMANDS they're already included — but `list-goals`/`read` were added explicitly, so confirm eval/network/go-back/reload are picked up via COMMANDS. They are, since they're in CONSUMER_COMMANDS ⊂ COMMANDS. No change needed unless KNOWN_VERBS is hand-listed.)

Add to `parseArgs` (near the other verb parsers):
```typescript
  if (cmd === 'eval') {
    const pos = rest.filter((a) => !a.startsWith('--'));
    return { cmd, url: pos[0], js: pos[1] };
  }
  if (cmd === 'network') {
    const pos = rest.filter((a) => !a.startsWith('--'));
    return { cmd, url: pos[0] };
  }
  if (cmd === 'go-back') return { cmd };
  if (cmd === 'reload') return { cmd };
```

Add handlers in `main()`:
```typescript
  if (args.cmd === 'eval') {
    const { runEval } = await import('./router/browse.js');
    const r = await runEval(args.url, args.js);
    console.log(JSON.stringify(r, null, 2));
    if (r.status !== 'done') process.exitCode = 3;
    return;
  }
  if (args.cmd === 'network') {
    const { runNetwork } = await import('./router/browse.js');
    const r = await runNetwork(args.url);
    console.log(JSON.stringify(r, null, 2));
    if (r.status !== 'done') process.exitCode = 3;
    return;
  }
  if (args.cmd === 'go-back' || args.cmd === 'reload') {
    const { PlaywrightAdapter } = await import('./playwright/adapter.js');
    // Session targeting: webnav uses fresh per-call sessions, so go-back/reload
    // are only meaningful with an explicit -s=. The session is read from argv by
    // playwright-cli itself; here we run on a default adapter session.
    const adapter = new PlaywrightAdapter('webnav-nav');
    const out = args.cmd === 'go-back' ? await adapter.goBack() : await adapter.reload();
    console.log(JSON.stringify({ status: 'done', action: args.cmd, out: out.trim() }, null, 2));
    return;
  }
```

Note on go-back/reload session handling: webnav opens a fresh `-s=` per call, so a standalone `webnav go-back` has no prior page to go back to in that fresh session — it will be a no-op/error against an empty session. That's acceptable for v1: these verbs are documented (Task 6 help) as operating on "the current browser session" and are most useful to an agent that is driving a persistent session via playwright-cli directly. We expose them for completeness + discoverability; we do NOT build session-persistence plumbing here (out of scope). If the adapter call throws on an empty session, catch it:
```typescript
    // wrap the go-back/reload call in try/catch -> {status:'failed', reason} with exitCode 3
```
Implement that try/catch so a no-session call fails cleanly rather than throwing.

- [ ] **Step 4: Run tests + manual smoke**

Run: `npx vitest run tests/cli.test.ts` → PASS.
Run: `npx tsc --noEmit` → CLEAN.
Run: `npx tsx src/cli.ts --help` → shows eval/network/go-back/reload under `Navigate:`.
Run: `npx tsx src/cli.ts eval --help` → shows the `<url> <js>` signature + the `() => <value>` arg description.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat(cli): wire eval/network/go-back/reload verbs"
```

---

## Task 8: Gated live e2e + full suite + STATUS

**Files:**
- Create: `tests/e2e/browse.live.test.ts`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Write the gated e2e**

Create `tests/e2e/browse.live.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runEval } from '../../src/router/browse.js';

const LIVE = process.env.WEBNAV_LIVE === '1';

describe.skipIf(!LIVE)('browse primitives (live)', () => {
  it('eval returns a targeted value off a live page', async () => {
    const r = await runEval('https://github.com/psf/requests', '() => document.title');
    expect(r.status).toBe('done');
    if (r.status !== 'done') throw new Error('expected done');
    expect(r.value.toLowerCase()).toContain('requests');
  }, 60000);
});
```

- [ ] **Step 2: Run gated (skipped) + tsc + full suite**

Run: `npx vitest run tests/e2e/browse.live.test.ts` → 1 skipped.
Run: `npx tsc --noEmit` → CLEAN.
Run: `npx vitest run` → all pass, gated e2e skipped.
(The controller runs the live form `WEBNAV_LIVE=1 npx vitest run tests/e2e/browse.live.test.ts` as the final proof that eval works end-to-end — returns the page title cheaply.)

- [ ] **Step 3: Update STATUS.md**

In `docs/STATUS.md`, update the verbs section: add `eval`/`network`/`go-back`/`reload` to the Navigate group; note the help is now grouped Find/Read/Navigate with data-flow-teaching per-verb help. Add a short note:

```markdown
### CLI framing + browser primitives (DONE)

webnav's `--help` is now framed like playwright-cli's: consumer verbs grouped by
purpose (Find / Read / Navigate) and per-verb help teaches data-flow (where an
arg comes from / where output goes — e.g. recall's goal-id is "from list-goals",
read's url is "from locate"). Added Navigate primitives `eval <url> <js>` (run JS
→ just the value: cheap targeted extraction vs a full snapshot), `network <url>`
(the API/JSON calls behind the DOM), and `go-back`/`reload`. Spec:
`docs/superpowers/specs/2026-06-03-cli-framing-and-browser-primitives-design.md`.
```

Bump the test-count line (run `npx vitest run`, read the number).

- [ ] **Step 4: Build + suite green**

Run: `npm run build` → succeeds.
Run: `npx vitest run` → all pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/browse.live.test.ts docs/STATUS.md
git commit -m "test(e2e)+docs: gated browse e2e; CLI framing + primitives documented"
```

---

## Self-review notes (for the implementer)

- **Phase 1 (Tasks 1–3) is presentation-only** — no behavior change; the existing full suite must stay green throughout. If a Phase-1 change breaks a behavior test, something was over-edited.
- **`group` is optional on CommandSpec** so DEV_COMMANDS need not set it; the grouped renderer only iterates CONSUMER_COMMANDS.
- **go-back/reload are deliberately shallow** (Task 7 note): webnav uses fresh per-call sessions, so a standalone `webnav go-back` has no prior page — it fails cleanly. They're added for surface completeness + discoverability, NOT session-persistence (out of scope per spec). Don't build session plumbing.
- **eval runs the AGENT's JS** in the page — webnav passes it through; webnav reasons about nothing (zero-LLM intact).
- **escalate-not-evade:** runEval/runNetwork map any failure to `{status:'failed'}` — they never retry-to-bypass a wall.
- **Confirm KNOWN_VERBS** picks up the new verbs via COMMANDS (they're in CONSUMER_COMMANDS). If KNOWN_VERBS hand-lists names, add eval/network/go-back/reload.
- **`commandHelp(name)` already renders args/flags** — the playwright-style per-verb block exists; Tasks 3 + 6 only enrich the spec strings it renders.
