# Data architecture, persistence, and node catalog

This document explains **why projects can look empty after restart**, how data currently flows, what **user types** need from the product, and an **exhaustive catalog** of node and asset categories (current + planned).

---

## 1. Why the home page / project can look empty after `deno task dev`

The app uses **several persistence layers that are not one unified “project folder”**:

| Layer | What it holds | Survives restart? | Typical failure mode |
|--------|----------------|-------------------|----------------------|
| **Browser `localStorage`** | File tree mirror (`ars-technicai-files`), per-project file snapshots (`ars-technicai-file-states`), canvas snapshots (`ars-technicai-canvas-states:*`), dashboard projects (`ars-technicai-projects`), user session prefs (`ars-technicai-user`) | Yes **only for the same browser profile + origin** (e.g. `http://localhost:3002`) | Cleared site data, private window, another browser, or code calling `clearAllWorkspaceData()` |
| **Next.js `public/generated/`** | PNGs + optional `generations.json` from the API | Yes **on the same machine and repo path** until deleted | New clone of repo, `git clean`, different working directory, deploy without copying `public/` |
| **PostgreSQL (Prisma)** | Project records, canvas JSON, versions (when signed in + `DATABASE_URL` OK) | Yes if DB is reachable | DB not running, wrong `DATABASE_URL`, or user not authenticated so sync never runs |
| **In-memory Zustand** | Live explorer tree & assets map | No | Always cleared on reload; must rehydrate from storage above |

So “empty after restart” usually means one of:

1. **localStorage was cleared or is a fresh profile** → explorer + dashboard cards lose their mirror of `/projects/.../generated`, even if PNGs still sit under `public/generated/`.
2. **No cloud sync** (guest / DB down) → nothing re-hydrates the tree from disk automatically.
3. **Generated files on disk are not scanned back into the file store** → binary files exist but the app’s virtual tree doesn’t list them until something rebuilds the tree from a manifest or API.

**Product implication:** Users expect **“my project = a folder on disk.”** Today, the **authoritative UX state** is often **localStorage + DB**, not a **single project directory** that is always read on startup.

---

## 2. Architectural direction: one project bundle (recommended)

### 2.1 Principle: **project root = single portable unit**

For **flawless import/export** and clear categories, each project should map to a **directory** (or zip) like:

```text
MyProject.arsproj/   (or plain folder)
├── manifest.json          # version, app build, checksums
├── workspace.json         # layout, modes, panel sizes (optional)
├── canvas.json            # items, viewport, z-order, links to assets
├── timeline.json          # tracks, clips, timebase (optional)
├── graph.json             # node graph: nodes + edges (rework mode)
├── assets/
│   ├── index.json         # asset registry: id, path, type, ACL, relations
│   ├── generated/         # binaries + sidecar .meta.json per file
│   ├── imports/
│   ├── exports/
│   └── prompts/
└── permissions.json       # optional: sharing, roles (future)
```

**Startup rule:** If `manifest.json` + `assets/index.json` exist, **hydrate** file store + canvas from disk **before** trusting stale localStorage.

### 2.2 Automatic behaviors (UX)

| User type | Needs |
|-----------|--------|
| **Solo offline** | Everything in a folder; double-click project opens; no DB required. |
| **Solo + cloud backup** | Folder is primary; optional background sync to S3/DB. |
| **Team** | ACL on assets, locking, merge rules; DB or Git LFS for binaries. |
| **Pipeline / automation** | CLI: `ars export`, `ars import`, CI reads `manifest.json`. |

**Import:** Drag folder or `.zip` → validate manifest → merge or replace.  
**Export:** Always produce the same tree + manifest for reproducibility.

---

## 3. What the software should remember (data manager checklist)

For **every asset** and **every node**:

- **Identity:** stable UUID, human name, filesystem path (or blob key).
- **Classification:** type, MIME, role (generated vs import vs library).
- **Spatial:** canvas `x, y, width, height, rotation, scale, zIndex` (canvas items); graph `x, y` (workflow nodes).
- **Temporal:** timeline clip start/duration/track (if used).
- **Provenance:** parent/child asset ids, lineage, generation job id, source prompts.
- **Parameters:** model, seed, steps, guidance, width/height, provider, negative prompt.
- **User inputs:** custom tags, notes, ratings, approval status.
- **Relations:** graph edges, “this canvas item ↔ this timeline clip,” soft links to library assets.
- **Rights:** owner, license, `read|write|export` (future ACL).
- **Administrative:** createdAt, modifiedAt, deleted (tombstone), version id.

Store **sidecar JSON** next to large binaries where possible so data survives without the DB.

---

## 4. Exhaustive catalog: node & category types

### 4.1 Canvas items (`CanvasItem.type` — **current app**)

| Type | Role |
|------|------|
| `image` | Imported or referenced raster/vector preview (often from explorer). |
| `generated` | AI output; carries `generationMeta` / prompts when present. |
| `placeholder` | Reserved / loading / layout stub. |

**Recommended extensions (planned categories):**

| Proposed `type` | Role |
|-----------------|------|
| `video` | Video clip on canvas. |
| `audio` | Waveform / clip. |
| `text` | Rich text / caption / title card. |
| `shape` | Vector primitive (rect, ellipse, arrow). |
| `group` | Container for transforms. |
| `annotation` | Arrows, masks, regions of interest. |
| `web` | Embedded preview (URL / iframe bounds). |
| `3d` | Gltf / mesh placeholder. |
| `reference` | Non-destructive link to library asset. |

---

### 4.2 Workflow graph nodes (`NodeType` — **rework mode, current app**)

| Node type | Purpose |
|-----------|---------|
| `prompt` | Text prompt source. |
| `negative` | Negative prompt source. |
| `generator` | Image generation from prompts. |
| `image-in` | Import image into the graph. |
| `transform` | Scale / rotate / flip. |
| `blend` | Composite two images. |
| `output` | Sink / export artifact. |

**Recommended extensions (catalog for product roadmap):**

| Proposed type | Purpose |
|---------------|---------|
| `llm` | General text LLM step. |
| `upscale` | Super-resolution. |
| `inpaint` | Mask-based edit. |
| `outpaint` | Extend canvas. |
| `controlnet` | Structure / depth / pose conditioning. |
| `lora` | Style / subject adapter (reference weights). |
| `segment` | SAM / segmentation. |
| `detect` | Object / face detection. |
| `color-grade` | LUT / grading. |
| `deforum` | Video / latent animation. |
| `audio-gen` | TTS / music. |
| `video-in` | Video input. |
| `mask` | User or auto mask. |
| `constant` | Numeric / enum parameter. |
| `comment` | Sticky note (no execution). |
| `switch` | Branch on condition. |
| `batch` | Fan-out / map over set. |

---

### 4.3 Explorer / workspace **folder categories** (virtual paths)

| Path (conceptual) | Purpose |
|-------------------|---------|
| `/imports` | User drops; staging before project commit. |
| `/library` | Shared reusables across projects. |
| `/projects/<slug>/generated` | Outputs tied to one project. |
| `/projects/<slug>/exports` | Renders, finals. |
| `/prompts` | Saved prompt assets / templates. |

**Extensions:** `/projects/<slug>/refs`, `/cache`, `/versions`, `/collab`.

---

### 4.4 Asset kinds (`Asset.type` and media)

**Current / typical:**

- `image`, `video`, `audio`, `text`, `prompt` (and generic file).

**Extended taxonomy (for `assets/index.json`):**

- **Raster:** `png`, `jpeg`, `webp`, `exr`, `hdr`
- **Vector:** `svg`, `pdf` (page as asset)
- **3D:** `gltf`, `glb`, `obj`
- **Video:** `mp4`, `webm`, `mov`
- **Audio:** `wav`, `mp3`, `aac`
- **Text / data:** `md`, `json`, `csv`, `srt`, `vtt`
- **Archive:** `zip` (as single asset or exploded on import)
- **Model weights:** `safetensors`, `ckpt` (governance critical)
- **Procedural:** `shader`, `node-graph` (JSON definition)

---

### 4.5 Timeline (sequential) entities

| Entity | Description |
|--------|-------------|
| **Track** | Video, audio, adjustment, subtitle. |
| **Clip** | Range on a track; links `assetId` + optional `canvasItemId`. |
| **Marker** | Bookmarks / beats. |
| **Marker / chapter** | Nested navigation. |
| **Transition** | Between clips. |
| **Automation** | Keyframed parameter lane. |

---

### 4.6 Relations (edges you should persist)

| Relation | Example |
|----------|---------|
| **Canvas ↔ asset** | `canvasItem.assetId` |
| **Canvas ↔ timeline** | cord / `timelineClipId` |
| **Asset lineage** | `parentAssetId`, `lineageId`, `childIds` |
| **Graph connection** | `NodeConnection` |
| **Version chain** | project version snapshots |
| **Semantic tag** | user tags, auto tags (model, scene) |

---

## 5. Immediate engineering actions (close the “empty after restart” gap)

Without implementing the full bundle yet, priority fixes are:

1. **Disk → store reconciliation:** On app load, scan `public/generated` (or configurable project dir) and **upsert** `FileNode` + `Asset` entries from manifest or filename conventions + `generations.json`.
2. **Single save path:** On “Save”, write **both** localStorage snapshot **and** update `project/manifest` + `assets/index.json` under a user-chosen root (not only `public/`).
3. **Dashboard source of truth:** Prefer **folder + manifest** over purely in-memory sync from Zustand when listing projects.
4. **Document for users:** “Project data lives in [path] + browser storage for UI state; clearing browser data removes the explorer mirror until re-sync.”

---

## 6. Related code (for maintainers)

- Persistence keys: `constants/workspace.ts` (`STORAGE_KEYS`, `WORKSPACE_DATA_KEYS_TO_CLEAR`)
- File tree + assets: `stores/fileStore.ts` (`persist` + `saveProjectFileState` / `loadProjectFileState`)
- Canvas / workspace: `hooks/useProjectSync.ts` (`loadProjectWorkspaceState`, `saveProjectWorkspaceState`, `clearAllWorkspaceData`)
- API-generated files: `pages/api/generate.ts`, `pages/api/generations/save-meta.ts`, `public/generated/`

---

*Last updated to reflect workspace design discussion; extend this file as new `NodeType` / `CanvasItem` variants ship.*
