# Workshop — Design Critique & Feature Roadmap

> **Version**: 1.0 · **Date**: 2026-07-16
> A designer's methodical audit of the Workshop (pipeline flow), panel by panel,
> with synthesis trees. Legend: ✅ shipped · ⚠️ shipped but needs work · ❌ missing ·
> 🆕 shipped in this iteration (layers/versions/info system).

---

## 1. General Critique

**What works.** The workshop's core thesis is right and now visible in the UI:
*horizontality* (stage lanes moodboard → delivery) narrates the creation process
spatially, and *verticality* (variant decks stacking alternatives) turns iteration
into a first-class object instead of a chat history. Auto-grouping by stage removes
the #1 failure mode of node editors (spaghetti canvases). The 3D card language —
depth, glow, stacked ghosts — communicates "this node holds several possibilities"
without reading a manual.

**What's weak, honestly:**

1. **Discoverability beats density.** The dropdown existed but was cramped, clipped
   at the canvas top, and single-purpose (variants only). A node is a *container of
   an asset with a history* — its dropdown must expose layers, versions, and
   provenance, not just thumbnails. 🆕 *Fixed: tabbed deck (Layers / Versions /
   Info), flips below near the top, wider, arrowed.*
2. **Generation without refinement is a slot machine.** Before this iteration the
   only "edit" was re-prompting. Manual, local, non-destructive control (layers,
   masks, forms, text, collage, filters) is what turns generation into *authoring*.
   🆕 *Shipped a Photoshop-inspired layer system (see §4).*
3. **Metadata was invisible.** Seed, model, prompt, dates, version lineage existed
   in memory but had no surface. Trust requires provenance. 🆕 *Info tab + Versions
   list with created/updated/version/seed/model/prompt/derived-from.*
4. **Edges communicate type but not state.** No flow animation while running, no
   dimming of stale downstream results after an upstream regenerate. ❌
5. **No undo/history.** Every serious tool has ⌘Z. The store is centralised, so a
   command-log with inverse ops is feasible. ❌ (highest-priority next)
6. **Scale limits.** Base64 images inside zustand-persist (localStorage ~5–10 MB)
   will hit the wall quickly; variants must move to IndexedDB blobs with metadata
   pointers. ❌
7. **Multi-select & keyboard model.** No marquee select, no arrow-key nudging, no
   shortcuts for tools (V/M/T…). ❌
8. **The banana2 dependency is honest but under-communicated.** The toolbar shows
   "no key" but nodes should show a *why-disabled* state on Generate. ⚠️

---

## 2. Synthesis Tree — the whole Workshop

```
WORKSHOP
├── Canvas
│   ├── ✅ Pan/zoom, dotted grid, reset view
│   ├── ✅ Stage lanes (auto-groups) w/ collapse
│   ├── ⚠️ Lane collapse hides edges (should reroute to lane header)
│   ├── ❌ Minimap for long pipelines
│   ├── ❌ Marquee multi-select + bulk ops (move, delete, run)
│   ├── ❌ Undo/redo command log (⌘Z / ⇧⌘Z)
│   └── ❌ Auto-fit / focus-node animation (double-click lane header)
├── Node card
│   ├── ✅ 3D card, status ring, stage color, preview
│   ├── 🆕 Layer overlay rendered on preview (masks, shapes, text)
│   ├── ✅ Variant ghost stack (up to 3 behind card)
│   ├── 🆕 Dropdown = tabbed panel: Layers / Versions / Info
│   ├── ⚠️ Fixed node height — text nodes waste space, port-dense nodes crowd
│   ├── ❌ Inline title rename on double-click
│   ├── ❌ Context menu (duplicate node, disconnect, run-from-here)
│   └── ❌ "Stale" badge when upstream changed after last run
├── Edges & ports
│   ├── ✅ Typed, color-coded, glow, click-to-delete, rubber band
│   ├── ⚠️ No hover tooltip on edge (from → to, type)
│   ├── ❌ Animated flow pulse while running
│   └── ❌ Auto-suggest connections (compatible ports highlight on drag)
├── Inspector
│   ├── ✅ Catalog-driven parameter sections (14 widget types)
│   ├── 🆕 Tabs: Params / Layers / Info
│   ├── 🆕 Clickable preview → opens Layer Editor
│   ├── 🆕 Versions list (v1, v2… select to restore)
│   ├── ❌ Param search/filter for long forms
│   ├── ❌ Per-param reset-to-default + "changed" dot
│   ├── ❌ Prompt preview ("what will actually be sent") before Generate
│   └── ❌ A/B compare two versions side-by-side
├── Layer system (🆕 this iteration — see §4)
├── Toolbar
│   ├── ✅ Add node (grouped by stage), Run pipeline, Stop, zoom, clear
│   ├── ⚠️ Clear has no confirm dialog (destructive!)
│   ├── ❌ Save/load pipeline as file (.arsflow JSON)
│   └── ❌ Run-selection / run-stage (not only whole pipeline)
└── Execution
    ├── ✅ Topological run, per-node status, variant stacking
    ├── 🆕 Include/exclude mask directives injected into banana2 edit prompts
    ├── ⚠️ Sequential only — independent branches could run in parallel
    ├── ❌ Cost/latency estimate before run
    └── ❌ Job queue UI with per-node cancel
```

---

## 3. Panel-by-Panel Detail Trees

### 3.1 Node dropdown ("deck")

```
DECK (above/below node, 384px, arrowed)      status
├── Tab: Layers                               🆕
│   ├── Add bar: Shape/Text/Image/Include/    🆕
│   │            Exclude/Filter
│   ├── Rows: kind icon, rename inline, mask  🆕
│   │         badge, eye, lock, delete
│   ├── Compact mode (no reorder/dup — use    🆕 (by design)
│   │   full editor for that)
│   └── ❌ Drag-reorder rows
├── Tab: Versions                             🆕
│   ├── v-number + label + seed + layer count 🆕
│   ├── Pin / delete / select-as-active       ✅
│   ├── ❌ Compare (diff two versions)
│   └── ❌ Restore = duplicate as new head
├── Tab: Info                                 🆕
│   ├── Editable label                        🆕
│   ├── Version, created, updated, seed,      🆕
│   │   model, layer count, derived-from
│   ├── Prompt actually used (__prompt)       🆕
│   └── ❌ Copy-prompt button, token estimate
└── Behavior
    ├── Flips below when near canvas top      🆕 (bug found & fixed)
    ├── stopPropagation vs pointer-capture    🆕 (bug found & fixed)
    └── ❌ Close on outside click
```

### 3.2 Layer Editor modal

```
LAYER EDITOR (Photoshop-inspired)             status
├── Tools: select, rect, ellipse, arrow,      🆕
│          text, include-mask, exclude-mask,
│          image (collage)
├── Stage: draw by drag, move by drag,        🆕
│          corner-dot resize, dbl-click text
├── Mask chrome: green dashed = AI edits,     🆕
│                red hatched = protected
├── Side panel: full layer list + reorder,    🆕
│               duplicate, per-kind settings
│               (blend, opacity, fill/stroke,
│               font, filter presets)
├── Flatten → new version (canvas composite)  🆕
├── ❌ Brush/freehand paint layer
├── ❌ Polygon/lasso masks (only rects now)
├── ❌ Rotation handle (model supports rotation)
├── ❌ Zoom into stage / pixel-precise nudge
├── ❌ Snapping + alignment guides
└── ❌ Layer groups / clipping masks
```

### 3.3 Include/Exclude → banana2 bridge

```
AI REGION DIRECTIVES                          status
├── Include mask + instruction → "In the      🆕
│   region 55–90% × 20–55%: {prompt}"
├── Exclude mask → "Do NOT modify … keep      🆕
│   pixel-identical"
├── Injected automatically on downstream      🆕
│   banana-image-edit runs
├── ❌ Send actual mask bitmap (when API
│     supports inpainting masks)
└── ❌ Per-mask strength / feathering
```

---

## 4. What Shipped This Iteration (established)

1. **Layer model** (`types/pipeline.ts`, `lib/pipeline/layers.ts`): 5 layer kinds
   (shape/text/image/mask/adjustment), 16 blend modes, normalized 0–1 geometry
   (survives re-generation & resolution changes), 10 filter presets, per-layer
   created/updated timestamps.
2. **Store ops** (`stores/pipelineStore.ts`): add/update/remove/duplicate/reorder
   layer, `flattenVariant` (canvas compositing → next version, keeps lineage via
   `parentVariantId`), `updateVariant`, version numbering, editor-modal state.
3. **Node dropdown** rebuilt as `NodeDeck` — tabbed (Layers/Versions/Info),
   position-aware, always available (badge shows `+` when empty).
4. **Inspector** gained the same three surfaces + clickable preview + version list.
5. **Layer Editor modal** — the interactive Photoshop-like stage described in §3.2.
6. **Preview overlays** — node cards render their active variant's layers live.
7. **Mask→prompt bridge** — include/exclude regions shape banana2 edit prompts.

## 4b. Iteration 3 additions (refinement, formats, space)

```
REFINEMENT & FORMATS                          status
├── Format & size panel (Info tab)            🆕
│   ├── Aspect re-crop: any catalog ratio,    🆕
│   │   cover (crop) or contain (letterbox)
│   ├── Resolution presets 512→2048px         🆕
│   ├── Re-encode PNG / JPEG / WebP + quality 🆕
│   └── Always → new version (non-destructive)🆕
├── Editable text versions                    🆕
│   └── Scripts/shot lists refined in place,  🆕
│       monospace editor, updatedAt tracking
├── Duplicate-as-draft + Download buttons     🆕
├── Dimensions shown in metadata              🆕
├── Space optimizations
│   ├── Inspector params → accordion sections 🆕
│   │   (first open, counts on collapsed)
│   ├── Fit-view button (frames whole flow)   🆕
│   └── Confirm dialog on destructive clear   🆕
```

## 5. Priority Queue (next iterations)

| # | Item | Why first |
|---|------|-----------|
| 1 | Undo/redo command log | Destructive ops now exist (layers, clear) |
| 2 | IndexedDB blob store for variant images | localStorage will overflow fast |
| 3 | Stale-downstream detection + re-run hints | Correctness of the pipeline story |
| 4 | Freehand/polygon masks + rotation handles | Most-wanted editor gestures |
| 5 | Version A/B compare (side-by-side slider) | Core to "choose the best take" |
| 6 | ~~Confirm dialogs (clear)~~ ✅ shipped · delete-version confirm remains | Safety |
| 7 | Parallel branch execution + job queue UI | Speed on big pipelines |
| 8 | Minimap + marquee select + shortcuts | Navigation at scale |
| 9 | Prompt copy button in Info tab (preview ✅ shipped) | Trust and reusability |
| 10 | .arsflow export/import of pipelines | Sharing / templates |
```
