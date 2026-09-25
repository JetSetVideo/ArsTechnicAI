# Merge backlog

Ordered. A row moves to **done** only when `conductor` has quoted the gates for it, per
`PROGRAM.md`. States: `open` · `in round <n>` · `done` · `accepted gap` (deliberately not doing it,
with the reason).

Evidence column names the run, screenshot directory or command output that established the row —
not a plan, not an intention.

## Blocking the gates

| # | Row | Why it blocks | Donor source | Destination target | State | Evidence |
|---|-----|---------------|--------------|--------------------|-------|----------|
| B1 | `@types/bcryptjs@3` is a deprecated stub (`main: ""`, no `.d.ts`) while `bcryptjs@2.4.3` ships no types, so `tsc --noEmit` fails repo-wide | no type gate = no safe merges | — | `package.json` | done | R0.3, R1.1 |
| B2 | `vitest.config.ts` and `tests/` exist, but no test runner is installed or declared | the test gate cannot run at all | donor `deno task verify` (285 tests) | `package.json`, `tests/` | open | R0.4 |
| B3 | `lib/storage/local.ts` was imported by six files and had never been committed, so `next build` failed outright | nothing ships from a repository that cannot build | — | `lib/storage/local.ts` | done | R1.2 — `✓ Compiled successfully`, 40 routes |
| B4 | 498 type errors across 158 files, revealed once B1 stopped masking them; `next.config.js` sets `typescript.ignoreBuildErrors: true` | they block nothing at build time and everything at review time | — | repo-wide | open | R1.1 |
| B5 | The data volume is 100% full (1.7 GiB free after cleanup); `next build` needs ~400 MB | the build gate may fail for space, not for code | — | the machine | open | R1.4 |

## The interface the user asked for

| # | Row | Why | Donor source | Destination target | State | Evidence |
|---|-----|-----|--------------|--------------------|-------|----------|
| U1 | Degraded-mode banner overlays the brand mark and top bar, its text overlapping itself and unreadable | first thing anyone sees; hides the product's own name | — | top-bar status strip | open | R0.5 shot `home` |
| U2 | Home: the donor's brand mark, **New/Create** button and project cards (thumbnail, id line, meta, tags) — the user's stated reference | the user judges the donor's home cleaner and wants it here | `ui/home/` | `pages/home.tsx`, `components/dashboard/ProjectsGrid` | open | R0.5 both shots |
| U3 | Left panel counts (Projects, Assets, Workflows, Characters & places, Media references) | tells you what a project contains before you open it | `ui/home/home.js` | `components/dashboard/HomeLeftPanel` | open | R0.5 |
| U4 | Right panel shows the **decision tree of connected nodes** and the loops driving them, not only flat parameters | the user's stated model of the inspector | donor Inspector `Wiring`/`Loop` | `components/layout/InspectorPanel.tsx` | open | — |
| U5 | Bottom panel as the place for long programmes — sequences, loops, progress per iteration | where a 600-frame run is watched | donor console + depth strip | `components/layout/Timeline.tsx` | open | — |
| U6 | Workflows drag from the left panel onto the canvas (insert beside, not replace) | asked for explicitly; node types and files already drag | donor `insertFlow` | `AppShell` → `Canvas` | open | R0.6 (node/file drag exists) |

## The graph

| # | Row | Why | Donor source | Destination target | State | Evidence |
|---|-----|-----|--------------|--------------------|-------|----------|
| G1 | **Loop node** — iterate a declared range of a sequence, run the body once per item, collect results, and carry the previous result forward | 115 modules and no loop; this is the user's flagship workflow | `flow.stack` + `flow.collect` | `graph-executor.ts`, new `lib/modules/flow/` | open | R0.7 |
| G2 | Pre-run cost gate: paths, iterations, calls, unit price, total, confirm before spending | a 600-frame loop on a paid model must not start by accident | `core/diagnostics.ts` | before any run that spends | open | R0.8 (no gate found) |
| G3 | Typed port compatibility refused at connect time, with the reason named | prevents graphs that cannot run | `core/ports.ts` | `types/module.ts`, canvas wiring | open | — |
| G4 | Versioned, non-destructive outputs: a re-run makes a child, never an overwrite | the user's data guarantee from the donor | `core/hybrid.ts`, `assets/v{N}` | `lib/project/bundle.ts` | open | — |

## The models

| # | Row | Why | Donor source | Destination target | State | Evidence |
|---|-----|-----|--------------|--------------------|-------|----------|
| M1 | "Nanobanana" in the interface sends `imagen-3.0-generate-002`; Nano Banana is Google's Gemini image model, and only an image-conditioned model can keep consecutive frames coherent | the flagship workflow depends on image+prompt → image | — | `lib/ai/`, `services/generation.ts` | open | R0.9 |
| M2 | `gen.image.execute` returns `{ note: 'Call /api/generate with these params' }` — the graph cannot generate | the canvas looks functional and is not | donor `generate` compile step | `lib/modules/generate/image.ts` | open | R0.10 |
| M3 | Provider keys and per-model subscription notes, key never returned to the browser | asked for in the donor and already missed here ("No API key — add one in Settings") | `bridge/key_store.ts` | `lib/ai/`, Settings modal | open | R0.5 shot |

## The library the donor already has

| # | Row | Why | Donor source | Destination target | State | Evidence |
|---|-----|-----|--------------|--------------------|-------|----------|
| L1 | Characters & places (subjects): draw, write, traits, attached media; a Subject node that grants its traits verbatim | the app has a "Character Creator" entry and `intelligence/character-consistent`; the donor has the whole system | `core/entities.ts`, `bridge/entity_store.ts` | `lib/`, explorer, a module | open | — |
| L2 | Reference library (160 cards) and the 63 cinema rules | turns a prompt into a photographable specification | `core/library.ts`, `core/cinema/` | `lib/` | open | — |
| L3 | Fast frame extraction (×6.2, byte-identical) and windowed analysis (×5.0) | the user called import "way too slow"; the donor's engine solved it with proof | `../ArchiveRestorer/backend/project.py` | `lib/media/video.ts`, ingest modules | open | — |
| L4 | Workflow library shipped as data, validated by a test that loads every file | eight donor workflows exist and are checked on every run | `tools/make_workflows.ts` | `lib/modules/assembly/workflow-templates.ts` | open | — |
