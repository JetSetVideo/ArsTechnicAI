# Ars TechnicAI — Product Requirements & Feature Inventory (PRD)

> **Document Version**: 2.0 · **Last Updated**: June 2026 · **Status**: Living Document
>
> This document consolidates the complete idea space into a coherent specification for Ars TechnicAI: an AI production suite to create prompts, images, videos, comics, and 3D scenes, assembling them into final deliverables via a graph-based pipeline and timeline.
>
> For UI and CSS specs, see `Design.md`. For code boundaries, see `Structure.md`. For architecture critique, see `ARCHITECTURE.md`.

---

## 1. Vision

Ars TechnicAI is a **multi-modal creative IDE** that lets users:

- **Author and version prompts** (templates + variables + vocab libraries).
- **Generate, edit, and remix** images, video, audio, and 3D via multiple AI providers.
- Build a reproducible **blueprint pipeline** on an infinite canvas.
- Sequence outputs into a final **video/comic/audio timeline** with effects, transitions, and captions.
- Export variations for multiple social platforms (aspect ratios, durations, formats).
- **Publish directly** to social media via platform APIs.
- Maintain **full provenance** — every pixel traces back to its prompt, seed, and model.

---

## 2. Primary Personas (Expanded)

| Persona | Needs | Primary Workflow | Critical Feature |
|---------|-------|-----------------|------------------|
| **Solo Filmmaker** | Rapid ideation → iterate → publish shorts | Prompt → generate images → assemble video → auto-post | Timeline + Multi-platform export |
| **Comics Artist** | Character consistency + panel layout + dialogue | Character profiles → generate panels → layout → speech bubbles | Character consistency system |
| **Content Producer** | Batch generation + variant management | Batch prompt → 4× variants per prompt → pick best → schedule posts | Batch generation |
| **Motion Designer** | Timeline + effects + transitions + audio sync | Storyboard → motion prompts → timeline assembly → effects | Real timeline playback |
| **Game Developer** | 3D assets + textures + concept art | 3D generation → texture mapping → concept art → export | 3D module |
| **Social Media Manager** | Cross-platform posting, analytics, scheduling | Quick-create → format-aware generation → publish → track | Auto-publish + analytics |
| **AI Researcher** | Prompt engineering, model comparison, reproducibility | Prompt templates → A/B test models → compare → export provenance | Versioned prompts + provenance |
| **Educator** | Visual aids, explainer videos, course materials | Script → generate visuals → assemble → export | Text-to-image + timeline |

---

## 3. Operating Model (What Users "Do")

### The Canonical Workflow

```
1. COLLECT ASSETS
   Files, references, prompts, vocab presets → Explorer

2. DRAG TO CANVAS
   Assets become nodes on the infinite canvas → Blueprint

3. CONNECT NODES
   Define data flow: prompt → generator → transform → export

4. RUN JOBS
   Queued → processing → completed → inspect → branch variations

5. SEQUENCE ON TIMELINE
   Drop results onto timeline tracks → order → trim → transition

6. EXPORT & PUBLISH
   Format profiles → render → auto-post to social platforms
```

### Always-Visible Pillars

- **Explorer**: Asset source of truth
- **Canvas**: How it's made (pipeline blueprint)
- **Inspector**: Details and parameters
- **Timeline**: Final assembly

---

## 4. Modes (Top Bar)

Modes change the default toolset without changing the app shell.

### 4.1 Image Creation
- Prompt authoring + vocab picker (camera, lenses, lighting, composition, materials)
- Reference board assembly (images, frames, palettes)
- Generation node palette (provider adapters + model presets)
- Variation browser + side-by-side compare
- Batch generation (N variants per prompt)

### 4.2 Image Rework (Editing)
- Non-destructive editing stack (masking, inpaint/outpaint, upscaling, color grade)
- Layer-like workflow: "edits as nodes" (reproducible)
- Before/after compare, side-by-side, onion-skin for comics
- Background removal (one-click)
- Color analysis with precision cursor

### 4.3 Video (Shot → Sequence)
- Shot list + storyboard frames
- Timeline editing: clips, audio, subtitles, transitions
- Render/export presets: resolution, fps, codec targets
- AI interpolation: start frame → end frame → sequence

### 4.4 Comic
- Panel layout templates (grid, manga, cinematic widescreen)
- Speech bubbles, captions, SFX typography
- Character consistency (profiles + style locks)

### 4.5 3D Scene
- Scene graph: objects, lights, cameras
- Puppet system with skeletal animation
- Camera rigs (dolly, crane, handheld simulation)
- Renders that feed back into 2D pipeline (plate generation, matte passes)

---

## 5. Asset Taxonomy (Complete)

Assets are first-class; everything should be searchable, taggable, and linkable.

### Asset Categories

| Category | Sub-types | AI-Generatable? | Manual? | Remixable? |
|----------|-----------|-----------------|---------|------------|
| **Prompt** | Template, Variable Set, Vocab Library, Example, History | ✅ LLM | ✅ | ✅ |
| **Image** | Raster (PNG/JPEG/WebP/EXR/HDR), Vector (SVG), Generated, Placeholder | ✅ | ✅ | ✅ |
| **Video** | MP4, WebM, MOV, Image Sequence, Filmstrip | ✅ | ✅ | ✅ |
| **Audio** | WAV, MP3, AAC, Generated TTS, Music, SFX, Ambience | ✅ | ✅ | ✅ |
| **Text** | Script (SRT/VTT), Markdown, JSON, CSV, Subtitle | ✅ LLM | ✅ | ✅ |
| **3D** | GLTF, GLB, OBJ, Gaussian Splat (PLY) | ✅ | ✅ | ✅ |
| **Reference** | Image/Video/Frame + Notes + Palette + Mood Board | N/A | ✅ | ✅ |
| **Character** | Identity + Look + Voice + Wardrobe + Lore | ✅ LLM | ✅ | ✅ |
| **Scene** | Location + Time-of-Day + Props + Notes | ✅ LLM | ✅ | ✅ |
| **Vocabulary** | Cameras, Lenses, Lighting, Materials, FX (structured JSON) | ✅ LLM | ✅ | ✅ |
| **Preset** | Provider Presets, Color Grades, LUTs, Export Presets | ✅ | ✅ | ✅ |
| **Blueprint** | Reusable Pipeline (nodes + edges) | ✅ Agent | ✅ | ✅ |
| **Generated Output** | Any AI output with full provenance | ✅ | N/A | ✅ |

### Asset Provenance (Tracked per Asset)

```
{
  "identity": { "id": "uuid", "name": "...", "type": "image" },
  "classification": { "mime": "image/png", "size": 245760, "dimensions": [512, 512] },
  "spatial": { "canvasX": 100, "canvasY": 200, "zIndex": 5, "rotation": 0, "scale": 1 },
  "temporal": { "timelineStart": 0, "timelineDuration": 5000 },
  "provenance": {
    "source": "generated",
    "parentId": "uuid-of-parent",
    "lineageId": "uuid-of-lineage",
    "generationMeta": {
      "prompt": "...",
      "negativePrompt": "...",
      "model": "google/imagen-3",
      "seed": 1234567890,
      "width": 512,
      "height": 512,
      "steps": 30,
      "guidanceScale": 7.5,
      "generatedAt": 1719000000000,
      "providerCallId": "uuid-of-call"
    }
  },
  "relations": {
    "parentAssetId": "uuid",
    "childAssetIds": ["uuid1", "uuid2"],
    "groupIds": ["group-uuid"],
    "timelineClipIds": ["clip-uuid"],
    "projectIds": ["project-uuid"]
  },
  "administrative": {
    "createdAt": 1719000000000,
    "modifiedAt": 1719000000000,
    "deletedAt": null,
    "versionId": "version-uuid",
    "status": "ready"
  }
}
```

---

## 6. Canvas (Blueprint Graph) Requirements

### Node Categories (Complete)

| Category | Node Types | Ports |
|----------|-----------|-------|
| **Inputs** | Prompt, Text, Image, Video, Audio, Palette, Script, Storyboard, Reference | Out: typed media |
| **Generation** | Provider Call (image/video/audio), LLM Call, 3D Gen | In: prompts + params, Out: generated |
| **Transform** | Resize, Crop, Pad, Flip, Rotate, Mask, Merge, Split, Stabilize, Time Remap | In: media, Out: transformed |
| **AI Edit** | Upscale, Inpaint, Outpaint, Style Transfer, Background Remove, Face Swap, Depth Estimate, Segment | In: image + params, Out: edited |
| **Color** | Color Grade (LUT), Color Analysis, Auto White Balance, Palette Extract | In: image, Out: image + data |
| **3D** | 3D Scene, Camera Rig, Puppet Animation, Render Pass | In: models + params, Out: 2D render |
| **Organization** | Frame/Group, Comment, Bookmark, Reference Board, Sub-graph | No exec |
| **Outputs** | Export Image, Export Video, Export Comic Pages, Publish Package, Format Transcode | In: final media, Out: file |

### Graph Behaviors
- Typed ports (image/video/audio/text/data/mask/3D)
- Edge validation with helpful error messages
- Per-node runs with cached results (skip re-run if inputs unchanged)
- Undo/redo for graph edits
- Graph serialization in project files (`.arsproj/graph.json`)
- Export graph as JSON for sharing

---

## 7. Timeline Requirements (Complete)

### Track Types

| Track | Icon | Color | Height | Content |
|-------|------|-------|--------|---------|
| Video Primary | 🎬 | `--t-video` (#8b5cf6) | 52px | Main video clips |
| Video Overlay | 🎬 | `--t-video` 60% | 40px | Picture-in-picture, overlay |
| Audio Music | 🎵 | `--t-audio` (#22c55e) | 36px | Background music |
| Audio Voice | 🎤 | `--t-audio` 70% | 36px | Dialogue, voiceover |
| SFX | 🔊 | `--t-audio` 50% | 30px | Sound effects |
| Captions | 📝 | `--t-text` (#60a5fa) | 28px | Subtitle text |
| Effects | 🎨 | `--a-tertiary` (#f59e0b) | 30px | Color grade, filters |
| Prompts | 💬 | `--t-prompt` (#c084fc) | 30px | AI generation triggers at timestamps |
| Groups | 📦 | `--a-secondary` (#7c3aed) | 40px | Grouped multi-track regions |

### Timeline Features
- **Multi-track editing**: vertical or collapsible tracks
- **Transitions**: cross-fade, dissolve, wipe, push — drag between clips
- **Scene timing**: labeled duration regions, draggable boundaries
- **Visual preview**: low-res preview plays in canvas area before final render
- **Asset drop**: drag from Explorer/Canvas onto track at playhead position
- **Keyboard shuttle**: J (reverse), K (stop), L (forward), Space (play/pause), ←→ (frame step)
- **Markers**: todo, chapter, cue, comment — colored markers on ruler
- **Snapping**: clip edges snap to playhead, markers, and other clip edges
- **Trim handles**: drag clip edges to adjust in/out points
- **Ripple edit** (future): trimming shifts subsequent clips

---

## 8. Prompt System Requirements

### Prompt Templates
- Variables with types: string, number, enum, asset reference
- Optional constraints: min/max, regex, allowed values
- Provider capability mapping (some params unsupported by some providers)
- Version history with model context (provider, model, seed, size, steps, guidance, errors, outputs)

### Prompt Run Provenance (Implemented)
For each generation run, the system tracks:
- Prompt draft and version labels (`v1`, `v2`, ...)
- Provider + model
- Generation params (negative prompt, seed, width/height, steps, guidance)
- Run status (`queued`, `running`, `completed`, `failed`, `cancelled`)
- Output asset IDs and generation job IDs
- Error message when runs fail
- Cost estimate (token count × provider pricing)

### Vocab Libraries (Structured JSON)

| Library | Fields |
|---------|--------|
| **Camera** | shot_type, angle, focal_length, aperture, sensor, film_stock, ISO |
| **Lighting** | key, fill, rim, color_temperature, modifiers, motivated_by |
| **Composition** | thirds, golden_ratio, leading_lines, negative_space, symmetry |
| **Materials** | PBR_roughness, metalness, SSS, anisotropy, displacement |
| **FX** | film_grain, chromatic_aberration, halation, bloom, lens_distortion |
| **Mood** | tone, atmosphere, color_palette, era, emotion |

---

## 9. Provider Integration (Architecture Requirements)

### Unified Adapter Interface

```typescript
interface ProviderAdapter {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  models: ModelDef[];
  
  validateApiKey(key: string): Promise<boolean>;
  getCapabilities(): ProviderCapability[];
  
  generateImage(params: ImageGenParams): Promise<GenResult>;
  generateVideo?(params: VideoGenParams): Promise<GenResult>;
  generateAudio?(params: AudioGenParams): Promise<GenResult>;
  
  cancelJob(jobId: string): Promise<void>;
  getJobStatus(jobId: string): Promise<JobStatus>;
}
```

### Integrated Providers

| Provider | Image | Video | Audio | 3D | Status |
|----------|-------|-------|-------|----|--------|
| Google Imagen | ✅ | ⬜ | ⬜ | ⬜ | Live |
| OpenAI DALL·E | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Stability AI | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Fal.ai | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Replicate | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Midjourney | ⬜ | ⬜ | ⬜ | ⬜ | Planned (API pending) |
| Runway | ⬜ | Planned | ⬜ | ⬜ | Planned |
| Pika | ⬜ | Planned | ⬜ | ⬜ | Planned |
| ElevenLabs | ⬜ | ⬜ | Planned | ⬜ | Planned |
| Suno/MusicGen | ⬜ | ⬜ | Planned | ⬜ | Planned |
| Rodin/Luma | ⬜ | ⬜ | ⬜ | Planned | Planned |

---

## 10. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | Canvas FPS (100 items) | 60fps |
| **Performance** | Explorer scroll (1000 files) | 30fps+ |
| **Performance** | Generation placeholder | < 50ms |
| **Performance** | Image load (thumbnail) | < 200ms |
| **Reliability** | Offline queue retries | 5 attempts, exponential backoff |
| **Reliability** | Autosave interval | 30 seconds |
| **Security** | API key storage | Server-side only (env vars) |
| **Security** | Password hashing | bcrypt, cost factor 12 |
| **Security** | JWT tokens | HTTP-only, Secure, SameSite=Strict |
| **Accessibility** | Keyboard navigation | WCAG AA |
| **Accessibility** | Color contrast | ≥ 4.5:1 body, ≥ 3:1 UI |
| **Accessibility** | Touch targets | ≥ 44×44px (touch mode) |
| **Cross-platform** | Browsers | Chrome, Firefox, Safari, Edge (last 2 versions) |
| **Cross-platform** | OS | Windows, macOS, Linux |
| **Cross-platform** | Runtime | Deno 2 (primary), Node.js (secondary) |

---

## 11. Current Implementation Status (June 2026)

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| App Shell with docking panels + resizers | ✅ | CSS Grid, 3 panels |
| Explorer Panel | ✅ | File tree, import, drag-drop, thumbnails |
| Infinite Canvas | ✅ | Pan/zoom, item management, selection, resize, rotate |
| Inspector Panel | ✅ | Generation form, property editing, history |
| Node Graph (Rework mode) | ✅ | 7 node types, typed ports, execution |
| Timeline (UI only) | ⚠️ | Visual only, no playback engine |
| AI Generation (Google Imagen) | ✅ | With placeholder fallback |
| Settings | ✅ | 8 tabs including account, API keys, appearance knobs |
| Action Log | ✅ | Activity tracking with timestamps |
| Toast System | ✅ | Error codes, categorized notifications |
| User Profiling | ✅ | Anonymous session/device info |
| Homepage | ✅ | Quick-create flow, project grid |
| Connection Banner | ✅ | Health status overlay |
| Telemetry Pipeline | ✅ | Gather, digest, store, sync |
| Client Signature | ✅ | Offline-unique version fingerprint |
| Offline Queue | ✅ | Buffers changes, flushes on reconnect |
| Module Registry | ✅ | 81 stubs, typed ports, format profiles |
| Universal File Import | ✅ | Image, video, audio, text, 3D metadata extraction |

### In Progress

| Feature | Status | Blockers |
|---------|--------|----------|
| API key server-side migration | In progress | Need server env config |
| Service layer extraction | Planned | Refactoring in progress |
| Virtualization | Planned | Phase 2 |

### Upcoming Phases

| Phase | Features | Timeline |
|-------|----------|----------|
| Phase 2 | Image Edit Modules (inpaint, upscale, remove BG, color analysis, draw/write) | Q3 2026 |
| Phase 3 | Video Engine (ffmpeg.wasm, real timeline playback) | Q4 2026 |
| Phase 4 | Audio Engine (TTS, music, SFX, waveform, mixing) | Q4 2026 |
| Phase 5 | 3D + Gaussian Splat (Three.js, puppet system, camera rigs) | Q1 2027 |
| Phase 6 | Intelligence Modules (auto-tag, storyboard, character consistency) | Q2 2027 |
| Phase 7 | Blueprints + Agents (reusable pipelines, autonomous workflows) | Q3 2027 |
| Phase 8 | Automations + Social Posting (scheduled creation, analytics, CDN) | Q4 2027 |

---

## 12. AI-First Architecture Principles

### Data-Driven Optimization
1. **User Profiling**: Anonymous session data to optimize UX
2. **Space Optimization**: Action log pruning, asset dedup, intelligent caching
3. **ML-Ready Data Collection**: Prompt history, success/failure rates, workflow patterns

### Security by Design
1. **No PII Storage**: Only anonymous UUIDs locally
2. **API Key Isolation**: Server-side, user-specific, never in exports
3. **Local-First**: Data stays on device by default
4. **Explicit Export**: User controls what leaves the system

### Modularity for AI Integration
1. **Provider Abstraction**: Unified adapter interface
2. **Pipeline Architecture**: Composable generation workflows
3. **Extensible Type System**: New asset types without refactoring
4. **Module Registry**: Headless execution, testable, auditable

---

*This PRD should be reviewed and updated at the start of each development phase. Feature completion status must reflect the live product, not aspirations.*
