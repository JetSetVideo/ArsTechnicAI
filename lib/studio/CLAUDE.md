# Ars Technic AI — working rules

Deno 2, zero-dependency strict TypeScript. The product spec is "Master System Instruction v2.0"; the
agent roles live in `.claude/agents/`.

## Commands

- `./setup.sh` (tools + engine venv, macOS/Linux) · `./start.sh` (engine :8000 + host :8090)
- `deno task verify` (codegen check + type-check + tests) · `deno task build` after any `ui/*.ts`
  change (the page loads `ui/public/wiv.js`)
- If :8090 is taken:
  `ARS_UI_PORT=8091 deno run --allow-net --allow-read --allow-env --allow-write=workflows,workspace server.ts`
- `WIV_CHECK_PROJECT=<id> WIV_UI=… deno task runtime` and `WIV_UI=…?project=<id> deno task capture`
  need a running server. Point them at a copy: a sandbox engine with
  `RESTORER_WORKSPACE=<copy> RESTORER_PORT=8012` and `WIV_BACKEND=127.0.0.1:8012` on the host.

## Guardrails (non-negotiable)

- Never `rm -rf`, drop data, or overwrite an asset/lineage/parameter file. Writes go to new
  versioned paths with `createNew: true`: `workspace/<project>/assets/v{N}/`,
  `workspace/<project>/lineage/lineage.v{N}.json`.
- `core/hybrid.ts` and `core/columnar.ts` have no update/delete by design. A changed
  prompt/parameter = new child asset + new record + edge to the parent.
- Every execution entry point awaits the pre-run gate (`ui/console.ts` `confirmBeforeRun` →
  `core/diagnostics.ts`). Auto-preview is the only exemption (enabling it is the consent).
- Verification code must not call `commit()`/`loadFlow()` or click cards — they autosave to the
  project's `graph.json`. Use `__wiv.select()`.
- `gen/` and `ui/public/tokens.css` are generated; change the generator.
- Profiles: `core/profiles.ts` ⇄ `ui/public/profiles.css` (parity tested). Chrome fonts in
  `profiles.css`/`inspect.css` must be `clamp(8px, calc(var(--fs-base, 14px) * k), 32px)`.
- Inspector: `renderInspector` runs every paint and must stay keyed (`RenderKey`). Controls that
  edit values call the row-local `setValue`, which absorbs the rebuild; never reset scroll except on
  a selection change.
- Grade layout lives in `../ArchiveRestorer/frontend/public/grade.css` under `html.embed-grade`;
  keep the desk markup unchanged (grid areas + `display: contents`).
- Desk frames: Grade mounts after `ArsPanels.projectsReady()`, Restorer on first tab open. Do not
  set their `src` earlier — that is a full extra app boot.

## Node and workflow rules

- Node types are contracts: ports carry `help`, and an input the node runs without must say
  `optional: true` rather than rely on the compiler guessing.
- `gen.*` and `llm.ask` compile to a `generate` step (a provider call), never to the engine's
  `enhance`. Only `ai.enhance` is an engine generative step.
- The reference chain resolves in `core/style_eval.ts` — pure, no engine, no network. Anything that
  needs the resolved prompt reads it from there rather than re-deriving it.
- Shipped workflows are generated: edit `tools/make_workflows.ts`, run
  `deno task workflows --force`. Never hand-edit `workflows/*.json` for the shipped ids.
  `tests/workflows_test.ts` checks every file in that folder, saved flows included.
- The README's node table comes from `deno task nodes`; regenerate rather than retype it.
- Entities (`core/entities.ts`, `bridge/entity_store.ts`) follow the asset rule: every save is a new
  `entities/<id>/entity.v{N}.json`, every upload a new `media/v{N}/` directory, `createNew: true`,
  nothing deleted. Ids match `^(character|place|prop)\.[a-z0-9-]{1,60}$` and are never paths.
- Provider keys (`bridge/key_store.ts`) never leave the host: routes return a source and the last
  four characters only. `resolveKey` is the single way out and is not reachable from a route. The
  environment wins over the store; forgetting rewrites the file without the secret.
- Card text areas (`EDITABLE_FIELDS` in `ui/render.ts`) commit through `setPortValue` on `change`,
  stop `keydown` propagation, and restore on `Escape` — never bypass `setPortValue`, or the edit
  escapes lineage.

## Engine performance rules

- Frame extraction is `_extract_with_opencv` + a bounded `ThreadPoolExecutor`; analysis runs in
  parallel windows. Both have parity harnesses (`backend/extract_test.py` byte-identical PNGs,
  `backend/analyze_test.py` field-by-field) — run them after touching either path.
- Do not reintroduce an ffmpeg extractor. It differs from OpenCV by up to 3 levels under every flag
  combination and is slower with exact frame selection; the measurements are in
  `backend/project.py`.

## Known gaps

- Generate nodes resolve, price and gate, but no provider client makes the HTTP call yet.
- `writeFlow` in server.ts overwrites when a client supplies an existing flow id.
- Grade and Restorer are two desk instances once both are open.
- Linux path not yet exercised end to end (macOS verified).
