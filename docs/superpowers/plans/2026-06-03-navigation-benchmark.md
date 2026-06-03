# Navigation Benchmark (R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-page `search → pick → drill-in` benchmark task set and run it through the existing 3-arm harness, scoring quality + a reliability tag + tool-call count — to test whether webnav's navigation skeleton beats an agent ad-hoc-driving the browser (the A-vs-C cut single-page tasks tied on).

**Architecture:** Mostly content + orchestration. The only code change is adding `'github-nav'` to `ALLOWED_CATEGORIES` in `bench/load.ts` (+ its test). A new `bench/tasks-nav.yml` holds 8 search→drill-in tasks. The live run reuses the R1.1 3-arm harness (verbatim arm/judge prompts in `bench/README.md`); the orchestrator additionally records `tool_uses` (from each Task result) and a reliability tag (clean/recovered/lost, judged from each arm's tool-call trace). webnav itself is unchanged.

**Tech Stack:** TypeScript (strict), Node 18+ (run via Node 22 here — `npm rebuild better-sqlite3` if native errors), vitest, the `yaml` dep, the Task tool (Sonnet) + `playwright-cli` for the live run. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-03-navigation-benchmark-design.md`

---

## File structure

- **Modify** `bench/load.ts` — add `'github-nav'` to `ALLOWED_CATEGORIES`. Only code edit.
- **Modify** `tests/bench/load.test.ts` — fixtures accept `github-nav`; the verb-count/category assertions stay valid.
- **Create** `bench/tasks-nav.yml` — 8 `github-nav` search→drill-in tasks.
- **Modify** `bench/README.md` — note the nav task set + reliability/tool_uses scoring.
- **Create** `bench/results/<today>-nav.md` — the live run report.
- **Modify** `docs/STATUS.md` — note R2.

No `src/` changes.

---

## Task 1: Add `github-nav` category (the only code change) — TDD

**Files:**
- Modify: `bench/load.ts`
- Test: `tests/bench/load.test.ts`

The loader currently allows `['github-live','web-live','botwalled']` (R1.1). Add `'github-nav'`. Loader logic is unchanged — only the allowed set + a test assertion.

- [ ] **Step 1: Read the current test to see the exact category assertions**

Read `tests/bench/load.test.ts`. It has a test asserting the exact allowed-category set (R1.1 made it `['botwalled','github-live','web-live']` sorted). Note the exact text so the next edit matches.

- [ ] **Step 2: Update the test fixtures + the allowed-set assertion**

In `tests/bench/load.test.ts`:
- Change the `it('exposes exactly the live-benchmark categories', ...)` assertion (or whatever it is named) to include the new category:

```typescript
  it('exposes exactly the benchmark categories', () => {
    expect([...ALLOWED_CATEGORIES].sort()).toEqual(['botwalled', 'github-live', 'github-nav', 'web-live']);
  });
```

- Add a test that a `github-nav` task is accepted:

```typescript
  it('accepts a github-nav task', () => {
    const tasks = parseTasks(`
tasks:
  - id: nav1
    category: github-nav
    prompt: search and drill in
    gold_answer: a defensible repo + signals
`);
    expect(tasks[0].category).toBe('github-nav');
  });
```

(If the existing "rejects an unknown category" test uses a string that is now valid, leave it — it uses a clearly-bogus category like `synthesis-hard`/`not-a-real-category` which stays invalid.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/bench/load.test.ts`
Expected: FAIL — the exact-category assertion doesn't include `github-nav`; the accept test fails because `github-nav` isn't allowed yet.

- [ ] **Step 4: Add the category**

In `bench/load.ts`, change:

```typescript
export const ALLOWED_CATEGORIES = [
  'github-live', 'web-live', 'botwalled',
] as const;
```

to:

```typescript
export const ALLOWED_CATEGORIES = [
  'github-live', 'web-live', 'botwalled', 'github-nav',
] as const;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/bench/load.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bench/load.ts tests/bench/load.test.ts
git commit -m "feat(bench): add github-nav category for multi-page navigation tasks"
```

---

## Task 2: The navigation task set (`bench/tasks-nav.yml`)

**Files:**
- Create: `bench/tasks-nav.yml`

Content task — no test step here (validated by the loader check in Task 3). Every task forces search→pick→drill-in. Gold answers are rubrics accepting any defensible top result.

- [ ] **Step 1: Write the task file**

Create `bench/tasks-nav.yml`:

```yaml
# R2 navigation benchmark. Every task REQUIRES multi-page navigation:
# search GitHub -> pick a result -> drill into its DETAIL page -> read declared
# signals. This is the A-vs-C cut single-page tasks could not show (webnav's
# recall skeleton vs an agent ad-hoc-driving GitHub's search UI).
# gold_answer is a RUBRIC: correct = reached a DEFENSIBLE top repo for the query
# AND reported the asked signals with evidence of a live fetch (specific values).
# Any reasonable top result is accepted — we score navigation + accurate
# reporting, not repo taste. Answered-from-the-results-page-without-drilling-in
# = partial.
tasks:
  - id: nav-rust-web
    category: github-nav
    prompt: >
      Search GitHub for a Rust web framework. Open the most-starred result and
      report its name (owner/repo), its license, and its latest release tag.
    gold_answer: >
      Correct = a defensible Rust web framework repo (e.g. actix/actix-web,
      tokio-rs/axum, or rwf2/Rocket) reached by drilling into its detail page,
      WITH its declared license and a specific latest release tag. Partial = right
      repo but a missing/unsourced field, or answered from the search results page
      without opening the repo. Wrong = not a web framework / fabricated fields.

  - id: nav-py-cli
    category: github-nav
    prompt: >
      Find a Python command-line-argument parsing library on GitHub. From the top
      result's repo page, report its name, its open-issue count, and roughly when
      it was last committed.
    gold_answer: >
      Correct = a defensible Python CLI/arg-parsing library (e.g. pallets/click,
      google/python-fire, or argparse-adjacent) reached via its detail page, with
      a specific open-issue count + a last-commit recency read live. Partial =
      missing/unsourced signal or no drill-in. Wrong = wrong domain / fabricated.

  - id: nav-go-orm
    category: github-nav
    prompt: >
      Search GitHub for a Go ORM library. Report the top repo's name, its current
      star count, and whether it shows recent commit activity.
    gold_answer: >
      Correct = a defensible Go ORM (e.g. go-gorm/gorm, ent/ent) reached via its
      page, with a specific current star count + a recent-activity read. Partial =
      missing/unsourced field or no drill-in. Wrong = not an ORM / fabricated.

  - id: nav-js-test
    category: github-nav
    prompt: >
      Find a JavaScript testing framework on GitHub. Report the top result's name,
      its license, and its latest release tag/version.
    gold_answer: >
      Correct = a defensible JS testing framework (e.g. jestjs/jest,
      vitest-dev/vitest, mochajs/mocha) via its detail page, with license + a
      specific latest release. Partial = missing/unsourced field or no drill-in.
      Wrong = not a testing framework / fabricated.

  - id: nav-py-http
    category: github-nav
    prompt: >
      Search GitHub for a Python HTTP client library. From the top result's detail
      page, report its name, star count, and open-issue count.
    gold_answer: >
      Correct = a defensible Python HTTP client (e.g. psf/requests, encode/httpx)
      via its detail page, with a specific star count + open-issue count read live.
      Partial = missing/unsourced field or no drill-in. Wrong = fabricated/wrong.

  - id: nav-rust-cli
    category: github-nav
    prompt: >
      Find a Rust library for building command-line interfaces on GitHub. Report
      the top repo's name, its star count, and its last-commit recency.
    gold_answer: >
      Correct = a defensible Rust CLI library (e.g. clap-rs/clap) via its detail
      page, with a specific star count + last-commit recency. Partial =
      missing/unsourced field or no drill-in. Wrong = fabricated/wrong domain.

  - id: nav-data-viz
    category: github-nav
    prompt: >
      Search GitHub for a Python data-visualization library. Report the top
      result's name, its license, and its current star count.
    gold_answer: >
      Correct = a defensible Python data-viz library (e.g. matplotlib/matplotlib,
      plotly/plotly.py, bokeh/bokeh) via its detail page, with license + a specific
      star count. Partial = missing/unsourced field or no drill-in. Wrong =
      fabricated/wrong domain.

  - id: nav-k8s-tool
    category: github-nav
    prompt: >
      Find a Kubernetes command-line tool on GitHub. Report the top repo's name and
      its latest release tag/version.
    gold_answer: >
      Correct = a defensible Kubernetes CLI tool (e.g. kubernetes/kubectl context,
      derailed/k9s, kubernetes-sigs/kubectx-adjacent) via its detail page, with a
      specific latest release tag. Partial = missing/unsourced field or no
      drill-in. Wrong = not a k8s CLI / fabricated.
```

- [ ] **Step 2: Commit**

```bash
git add bench/tasks-nav.yml
git commit -m "feat(bench): R2 navigation task set (8 search->drill-in tasks)"
```

---

## Task 3: Validate the nav task set loads + document scoring in README

**Files:**
- Modify: `bench/README.md`
- Test: a throwaway load check (run, do not commit a test file)

- [ ] **Step 1: Confirm the real nav file loads through the loader**

Add a temporary test `tests/bench/_navload.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadTasks } from '../../bench/load.js';

describe('R2 nav tasks', () => {
  it('loads 8 github-nav tasks with unique ids', () => {
    const t = loadTasks('bench/tasks-nav.yml');
    expect(t).toHaveLength(8);
    expect(t.every((x) => x.category === 'github-nav')).toBe(true);
    expect(new Set(t.map((x) => x.id)).size).toBe(8);
  });
});
```

Run: `npx vitest run tests/bench/_navload.test.ts`
Expected: PASS (8 tasks, all github-nav, unique ids). If it throws, fix `bench/tasks-nav.yml` (YAML indentation). Then DELETE the throwaway test: `rm tests/bench/_navload.test.ts`.

- [ ] **Step 2: Document the nav set + scoring in README**

In `bench/README.md`, add a section (after the existing "What it measures"):

````markdown
## R2 — navigation tasks (`bench/tasks-nav.yml`)

A multi-page task set: each task is `search GitHub → pick a result → drill into
its detail page → read declared signals`. Run via the same 3-arm harness, but
scored to test the A-vs-C navigation thesis:

- **Quality** — the anonymized 3-way judge (correct/partial/wrong), same as R1.1.
- **Reliability** — the orchestrator tags each arm's run from its tool-call trace:
  `clean` (reached detail + answered), `recovered` (wrong turn/empty snapshot but
  recovered), `lost` (thrashed / gave up / answered from results page without
  drilling in). The judge does NOT see this.
- **Cost** — primary metric is **`tool_uses` count** (from the Task result,
  floor-free); `subagent_tokens` is secondary and reported with the ~18.6k
  spawn-floor caveat (it cannot show clean token savings).

Run: same recipe as R1.1 but load tasks from `bench/tasks-nav.yml`. Arm A and Arm C
both drive playwright-cli → use distinct `-s=` sessions per task.
````

- [ ] **Step 3: Commit**

```bash
git add bench/README.md
git commit -m "docs(bench): document R2 nav task set + reliability/tool_uses scoring"
```

---

## Task 4: Execute the live navigation benchmark + write the report

**Files:**
- Create: `bench/results/<today>-nav.md`

Performed by the ORCHESTRATOR (main agent) via the Task tool. Prereqs: webnav
seeded (`npx tsx src/cli.ts dev graph >/dev/null`) and the CLI verbs work; if
the suite shows `NODE_MODULE_VERSION` errors, run `npm rebuild better-sqlite3`.

- [ ] **Step 1: Smoke run (1–2 tasks, all 3 arms)**

Pick `nav-rust-web` and `nav-py-http`. Dispatch Arm A (webnav CLI: `recall`/`read`),
Arm B (WebSearch+WebFetch), Arm C (playwright-cli, distinct session) — all Sonnet,
verbatim R1.1 arm prompts with the task substituted. Confirm: each returns an
`ANSWER:` line + the Task result reports `tool_uses` + `subagent_tokens`; the 3-way
judge returns three verdicts; you can tag reliability from each arm's trace. If an
arm ignores its tool restriction or A/C collide on a session, fix and re-smoke.

- [ ] **Step 2: Full run (all 8 tasks)**

Run the recipe over every task. Per task: dispatch the three arms concurrently
(distinct playwright-cli sessions for A and C); capture each arm's answer +
`tool_uses` + `subagent_tokens`; tag reliability (clean/recovered/lost) from each
arm's tool-call trace; judge the three answers anonymized (order varied); record a row.

- [ ] **Step 3: Write the report**

Create `bench/results/<today>-nav.md` with: headline (quality tally A/B/C +
reliability tally per arm + median tool_uses per arm); the A-vs-C focus paragraph
(does webnav's skeleton complete search→drill-in more cleanly + in fewer tool calls
than ad-hoc browsing?); a per-task table (per arm: verdict, reliability, tool_uses,
tokens); and the caveats (one sample; judge fallibility; tokens floor-dominated so
tool_uses is the real cost signal; rubric accepts any defensible repo; reliability
is orchestrator judgment from the trace).

- [ ] **Step 4: Sanity-check the report**

Confirm: 8 task rows; per-arm correct-counts + reliability tallies are internally
consistent; tool_uses + tokens present for all three arms; the A-vs-C paragraph +
all caveats present. Fix arithmetic before committing.

- [ ] **Step 5: Commit**

```bash
git add bench/results/
git commit -m "bench(R2): live navigation run (8 search->drill-in tasks; webnav vs search vs raw browser)"
```

---

## Task 5: Update STATUS.md

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Add an R2 note + bump the test count**

In `docs/STATUS.md`, add (near the other bench notes):

```markdown
### R2 — navigation benchmark (DONE)

A multi-page `search → pick → drill-in` task set (`bench/tasks-nav.yml`, 8 tasks)
run through the 3-arm harness — the A-vs-C cut single-page tasks (R1/R1.1) tied on.
Scores quality + a reliability tag (clean/recovered/lost) + `tool_uses` count
(floor-free cost proxy; tokens reported with the ~18.6k-floor caveat). Tests
whether webnav's `recall` skeleton completes navigation more cleanly / in fewer
actions than an agent ad-hoc-driving GitHub's UI. Results: latest
`bench/results/<date>-nav.md`. Spec:
`docs/superpowers/specs/2026-06-03-navigation-benchmark-design.md`.
```

Bump the test-count line at the top (run `npx vitest run`, read the number — the
nav category + accept test added ~1–2 to the bench suite).

- [ ] **Step 2: Build + full suite green**

Run: `npm run build`
Expected: tsc succeeds.

Run: `npx vitest run`
Expected: all pass, gated e2e skipped. (If mass `NODE_MODULE_VERSION` failures →
`npm rebuild better-sqlite3` first.)

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs: R2 navigation benchmark done"
```

---

## Self-review notes (for the implementer)

- **Only code change is `ALLOWED_CATEGORIES`** (Task 1). Everything else is content
  (`tasks-nav.yml`, README) or the orchestrated live run (Task 4, controller-run).
- **The loader loads either task file by path** — `loadTasks('bench/tasks-nav.yml')`.
  The R1.1 `bench/tasks.yml` is untouched and still valid.
- **Gold rubrics accept any defensible repo** — do NOT pin a specific repo as the
  only correct answer; the judge scores navigation + accurate signal reporting.
- **Reliability tag is the orchestrator's**, read from each arm's tool-call trace in
  the Task result — NOT a judge output, NOT a new mechanism.
- **tool_uses is the headline cost metric** (floor-free); tokens are caveated. Do
  not claim clean token savings.
- **A and C both drive playwright-cli** → distinct `-s=` sessions per task or they
  corrupt each other's browser state.
- **Native module:** if vitest mass-fails with `NODE_MODULE_VERSION`, run
  `npm rebuild better-sqlite3` (the main checkout was built under a different Node).
