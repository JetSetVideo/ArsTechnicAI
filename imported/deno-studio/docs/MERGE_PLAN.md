# Merging JetSetVideo/ArsTechnicAI into the Workshop

Two programs share the name. They do not share a line of code.

|             | **GitHub** `JetSetVideo/ArsTechnicAI`                           | **Desktop** `~/Desktop/ArsTechnicAI`              |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Stack       | Next.js 14 · React · Zustand · Prisma/Postgres · Redis          | Deno 2 · vanilla TS · zero deps                   |
| Size        | 67 801 lines, 45 commits (`df2761d` → `bd07b76`)                | 15 117 lines                                      |
| Engine      | Remote AI providers (Fal, Replicate, OpenAI, Imagen, Stability) | Local `~/Desktop/ArchiveRestorer` — OpenCV/Python |
| Canvas      | Free 2D placement — drag/resize/rotate/group                    | Node graph with typed ports + oblique Z depth     |
| Persistence | Postgres + localStorage + disk reconciliation                   | `workspace/<id>/graph.json` + localStorage        |
| State       | 17 Zustand stores                                               | module-level `let` + `commit()`                   |

**The Desktop app is the base.** It is the one with the ComfyUI/Weave feel, the typed-port contract,
the depth loop, and a real restoration engine underneath. The GitHub app is the donor: it is where
the interaction vocabulary and the asset ontology were worked out.

Nothing is ported as code. Every item below is **rebuilt against the Desktop app's own primitives**
(`core/graph.ts`, `core/lineage.ts`, `core/spatial.ts`) because the donor's React/Zustand idioms
have no meaning in a zero-dependency Deno bundle.

---

## 1. What the GitHub version had

### 1.1 Panels

| Panel                 | What it did                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Explorer** (left)   | Two tabs — **Local** disk tree and **Cloud** asset library. Recursive folder tree with expand/collapse, per-row rename + delete, drag-to-move between folders, drag-to-canvas. Type filter (image/video/audio/text/3D/folder), A-Z / Recent sort, deferred substring search. Empty folders greyed to 0.35 opacity; folders holding assets tinted amber. |
| **Canvas** (centre)   | Infinite pan/zoom plane. Rectangle marquee select, group/ungroup, 8-handle resize, rotate, z-order, connection anchors between cards, breakable wires (drag >20 px off an anchor and it snaps, with a shake).                                                                                                                                           |
| **Inspector** (right) | Tabbed: prompt authoring, provider/model picker, property editor, generation history, version restore, template save.                                                                                                                                                                                                                                   |
| **Node Graph**        | ComfyUI-style workflow editor — topological execution, per-node status, queue with pause/resume/retry/cancel, ComfyUI workflow import.                                                                                                                                                                                                                  |
| **Timeline**          | 9 track kinds (video ×2, audio, voice, SFX, caption, FX, prompt, group). UI only, never wired.                                                                                                                                                                                                                                                          |
| **Floating Toolbar**  | Frosted quick tools — pointer / lasso / hand, pen, shape, text.                                                                                                                                                                                                                                                                                         |

### 1.2 The four things explicitly lost

1. **Rectangle select** — `hooks/useCanvasPointerInteractions.ts::finalizeMarquee`. Drag on empty
   canvas → screen-space rect → converted to canvas space → every item whose AABB _intersects_ (not
   contains) is selected. 4 px dead zone before it counts as a drag; a 150 ms `lassoJustFinished`
   latch stops the trailing click from clearing the selection.

2. **Run** — `lib/modules/graph-executor.ts::executeGraph`. Kahn topological sort → per-node
   `resolveInputs` from upstream results → `module.execute(ctx)` → results keyed by output port.
   Per-node status `idle | queued | running | done | error`, progress callback, `AbortSignal`. Plus
   `workflow-queue.ts` — a job queue with enqueue/batch/cancel/retry/pause/resume/clear and live
   stats.

3. **Explorer showing real folders and workflows** — `pages/api/workspace/scan.ts` walks disk and
   returns files with their sidecar metadata (`prompt`, `model`, `seed`, `parentIds`, `childIds`,
   `imageVersion`, `variations`). `lib/modules/assembly/workflow-templates.ts` ships 6 built-in
   graphs; `workflow-io.ts` serialises/deserialises them and imports ComfyUI JSON.

4. **Clickable options on cards** — `components/layout/NodeEtiquette.tsx`. A label overlaid on each
   card: type dot, type icon, inline-rename name, eye/lock toggles, and a round "orb" that expands a
   panel of collapsible sections — **Prompt** (model, seed, negative, copy), **Annotation Layers**
   (add/hide/detach/delete sublayers), **Related Assets** (derived-from thumbnails + related, click
   to focus), **Info** (type, size, position, model, seed, gen size, generated-at, duration, format,
   codec, asset id), **Versions** (variation list) — then a footer: Bring to Front, Ungroup, Parent,
   Delete.

### 1.3 The asset ontology — the part worth taking whole

`ARCHITECTURE.md §1.6` ("Data Scientist / Information Architect") is the most valuable document in
the repo. Its audit of the donor's own model:

**Right:** stable UUIDs, provenance on every asset (`parentId`, `lineageId`, `promptId`,
`generatedAt`, `model`, `seed`), well-defined status enums, pgvector for similarity.

**Missing, and it names the cost of each:**

- No asset-to-asset relation table — lineage exists but cannot be _queried_ sideways.
- No analytics aggregation — per-project stats recomputed ad-hoc in the client every render.
- No soft delete — deletion is unrecoverable and the audit trail lies.
- No change history on assets — `PATCH` overwrites, so "restore previous edit" is impossible.

Its proposed `RelationType` vocabulary is the right one and is adopted here verbatim:
`DERIVED_FROM · USED_IN · REFERENCES · VARIANT_OF · GROUPED_WITH`.

Lifecycles it defines:

```
INGEST → CLASSIFY → ENRICH → TRANSFORM → COMPOSE → EXPORT → PUBLISH → ARCHIVE
draft → in_progress → ready → published → archived
                              ↘ failed → retry
```

Source vocabulary: `imported · generated · remixed · duplicated · manual · external`.

### 1.4 Module catalog

~200 module files across 7 categories
(`ingest · generate · edit · spatial · intelligence ·
assembly · publish`), all registered through
one `ModuleDef { id, name, category, status, ports,
execute }`. The README's own audit marks most
**stub**: live are `import-file`, the four `decode-*`, `generate-image`, `edit-resize`,
`edit-rotate`. Everything else — video gen, audio gen, 3D, inpaint, outpaint, upscale, background
removal, segmentation, timeline assembly, social publish — is a signature with no body.

**This matters for the merge:** the donor's breadth is mostly declared, not built. The Desktop app's
ten `stage.*` nodes are _generated from a running engine's schema_ and actually execute. Merging the
catalog wholesale would import 190 stubs and dilute a working tool. Only the module **registry
shape** and the **port-type contract** are worth taking.

---

## 2. What the Desktop version already has that the donor never did

- Typed ports with connection rules, range clamping, and refusal _during_ the drag with a message.
- `compileGraph()` — linearises a stage run into exactly one engine call.
- Graded diagnostics (warning vs error) instead of binary validity.
- Cabinet-oblique Z depth: the loop is an axis, not a feedback edge. 4000 slices cost what 12 do.
- Copy-on-write lineage with byte-budget compaction and `replayPlan()` rebuild.
- `nodeDigest()` cache key that excludes position — dragging never invalidates a render.
- Codegen freshness check: the node types cannot drift from the engine's schema.
- 119 tests + a runtime check that drives the real page in Chrome. (168 and 32 now — the cinema port
  and the reference library brought their own suites.)

None of this is at risk. The merge adds to it.

---

## 3. Merge phases

| # | Item                                       | Source                              | Target                       |
| - | ------------------------------------------ | ----------------------------------- | ---------------------------- |
| 1 | Rectangle select (right-drag) + multi-drag | `useCanvasPointerInteractions`      | `ui/app.ts`                  |
| 2 | Run selected workflow + per-node status    | `graph-executor` + `workflow-queue` | `bridge/`, `ui/app.ts`       |
| 3 | Left panel: Nodes / Files / Workflows tabs | `ExplorerPanel` + `workspace/scan`  | `server.ts`, `ui/app.ts`     |
| 4 | Card options (etiquette)                   | `NodeEtiquette`                     | `ui/render.ts`               |
| 5 | Loop authoring from selection              | — (new)                             | `ui/app.ts`, `core/scope.ts` |
| 6 | Asset ledger: versions, relations, state   | `ARCHITECTURE.md §1.6`              | `core/assets.ts` (new)       |

### Deliberately not merged

- **Auth, Postgres, Redis, Prisma.** The Desktop app is a local tool over a local engine. Adding an
  account system to a single-user restoration desk buys nothing and costs a database.
- **The 190 stub modules.** See §1.4.
- **The Timeline.** Never worked in the donor; the Grade desk already scrubs frames.
- **Social publishing.** Out of scope for restoration; the engine exports H.264 already.
- **Remote AI providers as node types.** The Desktop README already gates network steps behind a
  consent flow that does not exist — 240 slices × one paid call per slice is the reason. Keep the
  gate.

---

## 4. Status

| # | Item                                                                          | State    |
| - | ----------------------------------------------------------------------------- | -------- |
| 1 | Right-drag rectangle select, pre-lit hits, multi-drag                         | **done** |
| 2 | Run the selected workflow, per-node lifecycle, stop-keeps-work                | **done** |
| 3 | Library: Nodes / Files / Refs / Flows, jailed disk browser, save & load flows | **done** |
| 4 | Card options — run, mute, collapse, unfold, versions, lineage, stages, info   | **done** |
| 5 | Loop authoring — wrap a selection in a Z Stack + Collect                      | **done** |
| 6 | Asset ledger — versions, relations, soft delete, aggregation                  | **done** |

Verified by `deno task verify` (168 tests) and `deno task runtime` (32 checks against the live
page), both green.

### What the merge found

Restoring a donor interaction is a good way to discover the host cannot perform it. Three defects
surfaced this way and are written up in the README:

1. **Wire-by-drag connected nothing** — pointer capture retargets the drop to `#stage`, so the
   socket hit-test was always null. Fixed with `elementFromPoint`, which is what the donor used.
2. **A required port could be folded off its own card** — the Viewer's `compare` was required,
   unwired and hidden, so the graph could not be made runnable from the canvas.
3. **A hidden tab froze its own run** — repaints went only through `requestAnimationFrame`.

The bound project's saved graph was also corrupt (an orphan duplicate `Footage`, a missing
`Frame Pick`), which is why the canvas opened on "2 errors — nothing will run". Repaired through the
UI; the original is kept as `graph.backup-*.json`.

### Second pass

| Item                                                                               | State    |
| ---------------------------------------------------------------------------------- | -------- |
| `Run stages` — one engine call per stage, so every stage keeps its own version     | **done** |
| Lineage adoption — a deduped version still takes on parents it did not know about  | **done** |
| Files: drag a reel onto the canvas; open goes to `/api/video/load`                 | **done** |
| `start.sh` names the process holding :8000 instead of "the engine failed to start" | **done** |

`runWorkflow` was split into `runPass`, so the one-shot run and the stage-by-stage run share the
recording and failure handling rather than keeping two copies of it.

**The lineage-adoption fix is the subtle one.** A whole-graph run records only the _tail_ of a
linearised chain, and at that moment none of its upstream nodes have versions — so the tail records
no parents. Running the stages afterwards produces the same tail result, which the digest correctly
dedupes... and the link would never form. `record()` now keeps the dedupe and still adopts parents
it did not previously know, so `n3 → n4 → n5` completes on the second pass. Two tests pin it.

### Left for a later pass

- **No thumbnails in the Files tab.** Would want the engine's decoder, not a browser one.
- **Flows carry no thumbnail or tags.** The donor's `WorkflowGraphMetadata` has the fields; nothing
  writes them here yet.
- **The Home page still has its own left panel.** The Files/Flows tabs were added to the Workshop
  only; Home's UTILITIES column is untouched.
- **Network steps still do not execute.** ~~The consent flow that would gate them does not exist.~~
  **Superseded.** The flow now exists — `core/providers.ts`, `consentCovers`, and the `/estimate`
  route that enforces the same estimate it displays. What remains missing is the other half: the
  provider clients that would make the HTTP call. See the README's Status section.
