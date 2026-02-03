# Ars TechnicAI — Product Requirements & Feature Inventory (PRD)

This document consolidates the idea space into a coherent specification for **Ars TechnicAI**: an AI production suite to create **prompts, images, videos, comics**, and **3D scenes**, assembling them into final deliverables via a **graph-based pipeline** and **timeline**.

> **Implementation Status**: See `Structure.md` for current state. See `ARCHITECTURE.md` for critical analysis.

For UI and CSS specs, see `Design.md`. For repo/module boundaries, see `Structure.md`.

---

## 1) Vision

Ars TechnicAI is a **multi-modal creative IDE** that lets users:

- **Author and version prompts** (templates + variables + vocab libraries).
- **Generate, edit, and remix** images and video via multiple AI providers.
- Build a reproducible **blueprint pipeline** on an infinite canvas.
- Sequence outputs into a final **comic/video timeline** with audio, captions, effects.
- Export variations for multiple social platforms (aspect ratios, durations, formats).

---

## 2) Primary personas

- **Creator / Solo filmmaker**: rapid ideation → iterate → publish shorts.
- **Comics artist**: character consistency + panel layout + dialogue bubbles.
- **Content producer**: batch generation and variant management for campaigns.
- **Motion designer**: timeline + effects + transitions + audio syncing.

---

## 3) Operating model (what users “do”)

### The canonical workflow

1. **Collect assets** (files, refs, prompts, vocab presets) in Explorer.
2. **Drag assets onto the canvas** to create a pipeline.
3. **Connect nodes** to define data flow (prompt → generator → rework → upscale → export).
4. **Run jobs** (queued/processing/completed/failed), inspect results, branch variations.
5. **Drop results onto the timeline** to create a comic/video.
6. **Export** to target formats with presets.

### Always-visible pillars

- **Explorer**: asset source of truth.
- **Canvas**: how it’s made (pipeline blueprint).
- **Inspector**: details and parameters.
- **Timeline**: final assembly.

---

## 4) Modes (top bar)

Modes change the “default toolset”, not the app shell.

### 4.1 Image Creation

- Prompt authoring + vocab picker (camera, lenses, lighting, composition, materials).
- Reference board assembly (images, frames, palettes).
- Generation node palette (provider adapters + model presets).
- Variation browser + compare.

### 4.2 Image Rework (editing)

- Non-destructive editing stack (masking, inpaint/outpaint, upscaling, color grade).
- Layer-like workflow: “edits as nodes” (reproducible).
- Before/after compare, side-by-side, onion-skin for comics.

### 4.3 Video (shot → sequence)

- Shot list + storyboard frames
- Timeline editing: clips, audio, subtitles, transitions
- Render/export presets: resolution, fps, codec targets

### 4.4 Comic

- Panel layout templates (grid, manga, cinematic widescreen)
- Speech bubbles, captions, SFX typography
- Character consistency (profiles + style locks)

### 4.5 3D Scene

- Scene graph: objects, lights, cameras
- Camera rigs (dolly, crane, handheld simulation)
- Renders that feed back into the 2D pipeline (plate generation, matte passes)

---

## 5) Asset taxonomy

Assets are first-class; everything should be searchable, taggable, and linkable.

- **Prompt assets**: templates, variables, examples, version history
- **Vocabulary assets**: structured libraries (JSON) for cameras/angles/lights/materials
- **Reference assets**: images/videos/frames + notes + palettes
- **Character assets**: identity + look constraints + voice + wardrobe + lore
- **Scene assets**: locations, time-of-day, props, notes
- **Audio assets**: dialogue, music, SFX, ambience
- **Generated outputs**: images/videos/audio with provenance
- **Presets**: provider presets, color grades, LUTs, export presets

---

## 6) Canvas (blueprint graph) requirements

### Node categories (initial)

- **Inputs**: Prompt, Text, Image, Video, Audio, Palette, Script, Storyboard
- **Transform**: Resize, Crop, Pad, Mask, Merge, Split, Stabilize (video), Time remap
- **AI**: Provider Call (image/video/audio), Upscale, Inpaint, Outpaint, Style Transfer
- **Organization**: Frame/Group, Comment, Bookmark, Reference Board
- **Outputs**: Export Image, Export Video, Export Comic Pages, Publish Package

### Graph behaviors

- Typed ports (image/video/audio/text/data)
- Edge validation and helpful error messages
- Per-node runs with cached results
- Undo/redo for graph edits
- Graph serialization in project files

---

## 7) Timeline requirements

- Track types: **Video**, **Audio**, **Subtitles/Text**, **FX/Data**
- Multi-clip selection, trim handles, snapping
- Markers: todo, chapter, cue, comment
- Red playhead with triangle head
- Zoomable ruler with timecode + frame stepping

---

## 8) Prompt system requirements

### Prompt templates

- Variables with types: string/number/enum/asset
- Optional constraints: min/max, regex, allowed values
- Provider capability mapping (some providers don’t support certain params)

### Vocab libraries (structured)

Maintain curated libraries for:

- **Camera**: shot types, angles, focal length, aperture, sensor, film stock, ISO
- **Lighting**: key/fill/rim, color temperature, modifiers, motivated lighting
- **Composition**: thirds, golden ratio, leading lines, negative space
- **Materials/Textures**: PBR terms, roughness/metalness, SSS, anisotropy
- **FX**: film grain, chromatic aberration, halation, bloom, lens distortion

---

## 9) Provider integration (architecture requirements)

Providers vary (REST, websocket, human-in-the-loop). Ars TechnicAI needs:

- A **unified adapter interface** (capabilities, parameter schema, job lifecycle)
- A **job queue** with retry/cancel and rate-limit awareness
- **Provenance recording**: provider, model, parameters, seed, timestamps, cost estimate
- **Content policy compliance hooks** (warnings, blocked content, safe defaults)

---

## 10) Non-functional requirements

- **Performance**: virtualize large lists; keep canvas interactions 60fps.
- **Reliability**: persist graph/timeline state; resilient job recovery.
- **Security**: secrets never stored in plain text in exports; avoid leaking prompt history.
- **Accessibility**: keyboard-first navigation; WCAG AA.
- **Cross-platform**: Windows/macOS + browser; anticipate future native wrapper.

---

## 11) MVP definition (first coherent slice)

**MVP = a usable pipeline editor**, not full provider coverage.

- App shell with docking panels + resizers
- Explorer: import, tag, rename, search, drag to canvas
- Canvas: nodes, connections, selection, comments, undo/redo
- Prompt editor node: variables + presets
- Job system stub: “runs” with mock provider + result gallery
- Timeline: drop images as clips, markers, red playhead + basic playback UI shell

---

## 12) Current Implementation Status (February 2026)

### Completed Features

| Feature | Implementation | Notes |
|---------|---------------|-------|
| App Shell | ✅ Complete | Resizable panels, responsive layouts |
| Explorer Panel | ✅ Complete | File tree, import, drag-drop, thumbnails |
| Infinite Canvas | ✅ Complete | Pan/zoom, item management, selection |
| Inspector Panel | ✅ Complete | Generation form, property editing |
| Timeline | ⚠️ UI Only | Visual only, no actual playback |
| AI Generation | ✅ Complete | Google Imagen with fallback placeholders |
| Settings | ✅ Complete | API keys, appearance, font scaling |
| Action Log | ✅ Complete | Activity tracking with timestamps |
| Toast System | ✅ Complete | Error codes, categorized notifications |
| User Profiling | ✅ Complete | Anonymous session/device info |
| Responsive Design | ✅ Complete | Desktop/tablet/mobile breakpoints |

### In Progress

| Feature | Status | Blockers |
|---------|--------|----------|
| Undo/Redo | Actions logged | Need replay mechanism |
| Multi-provider | Foundation ready | Need adapter implementations |
| Video Playback | Not started | Need ffmpeg.wasm integration |

### Deferred to Phase 2+

- Node-based graph editing
- Audio waveform visualization
- Character consistency system
- Comic panel layouts
- 3D scene integration
- Collaborative editing
- Cloud sync

---

## 13) AI-First Architecture Principles

Ars TechnicAI is designed as a **next-generation AI-first application**:

### Data-Driven Optimization

1. **User Profiling**: Anonymous session data collected to optimize UX
   - Device capabilities (screen, memory, CPU cores)
   - Usage patterns (generation counts, session duration)
   - Locale/timezone for appropriate defaults

2. **Space Optimization Over Time**
   - Action log pruning (max 1000 entries)
   - Asset deduplication (planned)
   - Intelligent caching strategies

3. **ML-Ready Data Collection**
   - Prompt history with parameters
   - Generation success/failure rates
   - User workflow patterns

### Security by Design

1. **No PII Storage**: Only anonymous UUIDs
2. **API Key Isolation**: User-specific, not shared
3. **Local-First**: Data stays on device by default
4. **Explicit Export**: User controls what leaves the system

### Modularity for AI Integration

1. **Provider Abstraction**: Easy to add new AI services
2. **Pipeline Architecture**: Composable generation workflows
3. **Extensible Type System**: New asset types without refactoring
