# Ars TechnicAI — AI-First Creative Production Suite

> **Status**: Active Development · **Version**: 1.0.0-α · **Last Updated**: June 2026
>
> *"Prompt → media in any format → assembled short → auto-posted to social networks."*
>
> Ars TechnicAI is a browser-first creative production suite that treats media creation as a **graph + timeline problem** — think Figma + Blender + Photoshop + ComfyUI + CapCut, unified under a single AI-native interface.

---

## Critical Reviews — The Professional Lens

### 🎨 Artist & Creative Director's Verdict
*"Ars TechnicAI understands a fundamental truth: provenance matters. Every pixel should be traceable back to a prompt, a seed, a version. The blueprint canvas is the right metaphor — but the blank canvas is terrifying. A first-run experience with editorial guidance (shot lists, mood-based prompt starters, style transfer galleries) transforms it from a tool into a creative partner. The asset taxonomy is ambitious and correct: a 'character' is not a 'file'; it has intent, lore, appearance constraints. The timeline must render actual video, not just visualize it. Without real playback, it's a storyboard, not an editor."*

### 🎬 Film Director & Producer's Verdict
*"The pipeline is filmic in the right ways: ideation → script → storyboard → shot list → assembly → post → distribution. But the timeline gap is critical. Directors think in shots and sequences, not in 'generated images on a canvas.' The 3D camera rig system is visionary: pre-visualize camera moves before generation, not after. Audio is dangerously under-specified — music, dialogue, and SFX need their own generation pipelines with waveform visualization. Social platform presets with aspect ratio and duration awareness are spot-on. This could become the 'DaVinci Resolve for AI-native content' if the media engines ship."*

### 🏗️ Software Architect's Verdict
*"The modular architecture is sound: Zustand stores → service layer → components. But the service layer barely exists. Business logic lives in components and stores. The store topology is correct (domain-aligned, not feature-aligned) but coupling is high. Providers are well-abstracted; the Provider Adapter pattern is correct. What's missing: a pub/sub event bus, CQRS-style read/write separation for canvas vs timeline, and proper dependency injection for testability. The offline-first architecture is smart and necessary — but reconciliation from disk to store must be deterministic, not heuristic. Project bundles (.arsproj) are the right long-term answer."*

### 📊 Data Analyst & Information Architect's Verdict
*"The data model has strong bones: identity (UUID), classification (type/MIME), spatial (x,y,zIndex), temporal (timeline), provenance (lineage/generationMeta), and relational (edges/groupIds). This is the complete ontology of a media asset. What's missing is aggregation and analytics: per-project statistics, usage heatmaps, generation cost tracking, error clustering. The telemetry pipeline (gather → digest → store → sync) is neatly designed but only partially implemented. The filter taxonomy for the homepage must support multi-dimensional queries: media type × status × date × platform × generation source (AI/manual/remixed). Every asset must carry a 'lifecycle status' — active, archived, in-progress, failed."*

### 🎮 UX Designer's Verdict
*"The dark theme with parametric CSS variables is excellent — density, roundness, glow, and contrast as first-class knobs. But the homepage is under-baked. Projects should be cards with rich metadata: cover image, media type badges (🎬 for video, 📱 for mobile, 🎥 for short film), active/inactive indicator, last-modified timestamp, asset count breakdown. The filter system needs a proper faceted search: multi-select type filters, date range picker, sort by (alpha/recent/size/status). The workshop needs spatial organization: layers panel, grouping with visual contours, and connection dots for node-linking. Most critically: redundant tools must be consolidated — there should be exactly one way to perform each action, surfaced in the most contextually relevant location."*

### 🔒 Security Engineer's Verdict
*"API keys should never transit from client to provider directly. At minimum, use the server as a proxy with env-var secrets. The localStorage session and API key storage demands encryption-at-rest. Provider calls need rate limiting, request signing, and audit trails. The auth architecture (services/auth/ARCHITECTURE.md) is aspirational (quantum-resistant, zero-knowledge proofs) but the implementation uses standard NextAuth JWT with bcrypt — which is correct and pragmatic. CSRF protection, Content-Security-Policy headers, and RBAC at the API route level are the immediate priorities."*

### ⚡ Performance Engineer's Verdict
*"The canvas on 1000+ items will need WebGL. The explorer tree on 10,000+ files will need windowed virtualization (react-window). The timeline on 100+ tracks will need canvas-based rendering, not DOM. Image loading must be progressive (thumbnail → medium → full) with cancellation tokens. The three-tier persistence (localStorage → disk → DB) is correct but needs IndexedDB as the localStorage graduation path for large assets. ffmpeg.wasm in a Web Worker for video processing, not main thread."*

---

## Table of Contents

1. [What It Is](#what-it-is)
2. [Complete Feature Taxonomy](#complete-feature-taxonomy)
3. [Media & Format Matrix](#media--format-matrix)
4. [Three Modes of Operation](#three-modes-of-operation)
5. [Quick Start](#quick-start)
6. [Architecture Deep Dive](#architecture-deep-dive)
7. [Homepage Specification](#homepage-specification)
8. [Workshop Specification](#workshop-specification)
9. [Module Catalog](#module-catalog)
10. [Timeline Specification](#timeline-specification)
11. [Settings & Configuration](#settings--configuration)
12. [Security & Compliance](#security--compliance)
13. [Performance & Optimization](#performance--optimization)
14. [Roadmap](#roadmap)
15. [Contributing](#contributing)

---

## What It Is

Ars TechnicAI is a **multi-modal creative IDE** that bridges the gap between an author's raw vision and a finished, published media deliverable. It covers the complete creative arc:

### The Author's Vision Pipeline

```
PRE-PRODUCTION                PRODUCTION               POST-PRODUCTION
────────────────              ─────────────            ────────────────
Script / Logline         →    Prompt Authoring    →    Timeline Assembly
Character Profiles       →    Image Generation   →    Transitions & FX
World Building           →    Video Generation   →    Audio Mix
Mood Board               →    Audio (TTS/Music)  →    Color Grade
Shot List / Storyboard   →    Node Graph (Canvas) →   Export & Publish
```

The system is designed so that **inspiration assets** (reference images, sketches, imported footage, color palettes) feed directly into **prompt engineering** (templates, vocabulary libraries, character injection), which drives **AI generation** (images, video, audio), which assembles into **final deliverables** (platform-formatted video, comic pages, social posts).

### Core Capabilities

1. **Ingest any media** — images, videos, audio, 3D models, Gaussian splats, text, subtitles, URL references, sketches, mood boards
2. **Generate new media** via AI providers — image (DALL·E, Imagen, Stable Diffusion, Midjourney, Flux), video (Runway, Pika, Sora), audio (ElevenLabs, Suno, MusicGen), 3D (Rodin, Luma)
3. **Author prompts** — structured templates with named variables, cinematography vocabulary libraries, character profile injection, style transfer from reference images
4. **Build storyboards** — canvas-based shot nodes with camera specs, dialogue cues, and ordered animatics
5. **Edit non-destructively** — every transform is a node in a graph; source assets are never mutated
6. **Assemble on a timeline** — multi-track sequencing with transitions, audio, captions, effects
7. **Export to any format** — 9:16 mobile short, 1:1 Instagram, 16:9 YouTube, 2.35:1 cinematic, with platform presets
8. **Publish directly** — auto-post to TikTok, Instagram, YouTube, Twitter/X via platform APIs
9. **Track provenance** — every pixel traces back to a prompt, seed, model, version, and inspiration source

### Core Panels

| Panel | Role | Status |
|-------|------|--------|
| **Explorer** | File tree + asset library + search/filter | ✅ Live |
| **Canvas** | Infinite 2D workspace — drag, resize, rotate, layer, group assets | ✅ Live |
| **Inspector** | Prompt authoring, provider/model selector, property editor, generation history, version restore | ✅ Live |
| **Node Graph** | ComfyUI-style workflow editor (Rework mode) — chain prompts, transforms, blends | ✅ Live |
| **Timeline** | Multi-track video/audio/captions/FX sequencer | ⚠️ UI only |
| **Floating Toolbar** | Frosted-glass quick-access tool palette above canvas | ✅ Live |

---

## Complete Feature Taxonomy

### A. Asset Lifecycle

```
INGEST → CLASSIFY → ENRICH → TRANSFORM → COMPOSE → EXPORT → PUBLISH → ARCHIVE
  │          │         │          │           │         │         │
  ▼          ▼         ▼          ▼           ▼         ▼         ▼
 Files     Auto-tag  Metadata   Edit    Timeline  Format   Social   Cold
 URLs      MIME     Dimensions  Gen     Stack    Presets  Platforms Storage
 API       Type     Provenance  AI Gen  Scene                          │
 Scrape    Source   Relations   Remove  Transition                     ▼
           Date     License     BG      Audio Mix                 Analytics
```

### B. Media Type Matrix

| Media Type | Ingest | Generate | Edit | Timeline | Export | Status |
|-----------|--------|----------|------|----------|--------|--------|
| **Image** (PNG/JPEG/WebP/EXR/HDR) | ✅ | ✅ | ✅ | ✅ | ✅ | Live |
| **Video** (MP4/WebM/MOV) | ✅ | ⬜ | ⬜ | ⚠️ | ⬜ | Ingest only |
| **Audio** (WAV/MP3/AAC) | ✅ | ⬜ | ⬜ | ⚠️ | ⬜ | Ingest only |
| **Text/Data** (MD/JSON/CSV/SRT/VTT) | ✅ | ⬜ | ✅ | ⬜ | ⬜ | Live |
| **3D Model** (GLTF/GLB/OBJ) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Stub |
| **Gaussian Splat** (PLY/SPLAT) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Stub |
| **ZIP Archive** | ✅ | N/A | N/A | N/A | N/A | Explode on import |
| **URL Reference** | ✅ | N/A | N/A | N/A | N/A | Live |

### C. Generation Sources

Every media asset carries a `source` field:

| Source | Meaning |
|--------|---------|
| `imported` | Uploaded or dragged from local filesystem |
| `generated` | Created via AI provider (carries `generationMeta`) |
| `remixed` | Derived from a generated asset (edited, upscaled, inpainted) |
| `duplicated` | Exact copy of another asset |
| `manual` | Created via drawing/writing tools in the Workshop |
| `external` | URL reference — always fetchable, never cached as primary |

### D. Asset Status Lifecycle

```
draft → in_progress → ready → published → archived
                                         ↘ failed → retry
```

Every asset carries:
- **Status badge** visible in Explorer and Homepage
- **Health indicator** (processing spinner, error icon, ready checkmark)
- **Last modified timestamp**
- **Usage count** across projects

---

## Media & Format Matrix

### Platform Format Profiles

| Platform | Aspect | Resolution | Duration | Codec | Bitrate |
|----------|--------|------------|----------|-------|---------|
| **TikTok** | 9:16 | 1080×1920 | ≤10 min (≤3 min for music) | H.264 MP4 | 12 Mbps |
| **Instagram Reels** | 9:16 | 1080×1920 | ≤90 sec | H.264 MP4 | 12 Mbps |
| **Instagram Feed** | 1:1 / 4:5 | 1080×1080 | ≤60 sec | H.264 MP4 | 8 Mbps |
| **Instagram Stories** | 9:16 | 1080×1920 | ≤60 sec | H.264 MP4 | 8 Mbps |
| **YouTube Shorts** | 9:16 | 1080×1920 | ≤60 sec | VP9 / H.264 | 16 Mbps |
| **YouTube Standard** | 16:9 | 1920×1080 / 3840×2160 | Any | VP9 / H.264 / AV1 | 16-50 Mbps |
| **YouTube Cinema** | 2.35:1 | 2560×1080 | Any | VP9 / H.264 | 25 Mbps |
| **Twitter/X** | 16:9 / 1:1 | 1280×720 | ≤140 sec | H.264 MP4 | 8 Mbps |
| **LinkedIn** | 16:9 / 1:1 | 1920×1080 | ≤10 min | H.264 MP4 | 10 Mbps |
| **Custom** | Any | Any | Any | Any | Any |

### Social Platform Quick-Create

On the **Homepage**, users select a target platform before creation:

```
[TikTok 9:16] [Instagram 1:1] [YouTube 16:9] [Twitter/X 16:9] → auto-applies aspect ratio, duration cap, output preset
```

---

## Three Modes of Operation

### Mode 1 — Offline / Standalone
No server. No database. No account. Full localStorage persistence.
- ✅ All canvas, explorer, generation features
- ✅ Provider calls direct from browser (with user API keys)
- ✅ Images embedded as base64 in project state
- ❌ Cross-device sync
- ❌ Version history (no DB)

### Mode 2 — Local Full Stack
PostgreSQL + Redis on the same machine. Full feature set.
- ✅ All Mode 1 features
- ✅ Account auth (email/password, Google, GitHub)
- ✅ Project versioning (named snapshots, point-in-time restore)
- ✅ Asset library persisted to disk + DB
- ❌ Cross-device sync

### Mode 3 — Connected Server
Point at a shared Linux server. One account, all devices.
- ✅ All Mode 2 features
- ✅ Cross-device canvas sync
- ✅ Offline queue — autoplay on reconnect
- ✅ Health banner — live server status
- ✅ Centralized asset library

---

## Quick Start

### Deno 2 (Recommended)

```bash
# Install Deno 2
curl -fsSL https://deno.land/install.sh | sh

# Clone and install
git clone https://github.com/JetSetVideo/ArsTechnicAI.git
cd ArsTechnicAI
deno task install     # Download platform-specific binaries
cp .env.example .env.local

# Start
deno task dev
# → http://localhost:3002
```

For offline-only: comment out `DATABASE_URL` and `REDIS_URL` in `.env.local`.

### npm / Node.js

```bash
npm install
npx prisma generate
cp .env.example .env.local
npm run dev
```

---

## Architecture Deep Dive

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Explorer │  │  Canvas  │  │Inspector │  │  Timeline  │ │
│  │   (tree) │  │ (infinite│  │(params)  │  │ (sequence) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│       │              │              │               │       │
│       └──────┬───────┴──────┬───────┴───────────────┘       │
│              ▼              ▼                                │
│       ┌──────────────────────────┐                          │
│       │     Zustand Stores       │                          │
│       │  canvas file settings    │                          │
│       │  project generation log  │                          │
│       └──────┬──────────┬────────┘                          │
│              ▼          ▼                                    │
│       localStorage   IndexedDB (future)                      │
│              │                                               │
│              ▼ Offline Queue                                 │
└──────────────┼──────────────────────────────────────────────┘
               │ HTTP / WebSocket
               ▼
┌──────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                         │
│  /api/generate  /api/projects/*  /api/assets/*               │
│  /api/workspace/*  /api/health  /api/auth/*                  │
│  /api/publish/*  /api/telemetry/*                            │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐     │
│  │ PostgreSQL 16 │  │ Redis 7  │  │ Filesystem         │     │
│  │ (pgvector)   │  │ (cache,  │  │ /storage/projects/ │     │
│  │              │  │  queue)  │  │ /storage/assets/   │     │
│  └──────────────┘  └──────────┘  └────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Zustand Store Topology

| Store | Purpose | Persistence | Key |
|-------|---------|-------------|-----|
| `canvasStore` | Items, selection, viewport, undo/redo (50 steps) | localStorage + DB | `ars-technicai-canvas-states` |
| `fileStore` | File tree, assets map, navigation state | localStorage + DB | `ars-technicai-files` |
| `settingsStore` | Theme, AI provider, appearance, output prefs | localStorage | `ars-technicai-settings` |
| `generationStore` | Job queue, active generation state | Memory only | — |
| `projectStore` | Project list, sort/filter, favorites | localStorage | `ars-technicai-projects` |
| `userStore` | Device info, session stats, current project | localStorage | `ars-technicai-user` |
| `logStore` | Action log (max 1000 entries) | localStorage | `ars-technicai-log` |
| `nodeStore` | Workflow graph nodes, edges, execution engine | Memory | — |
| `blueprintStore` | Blueprint CRUD, import/export | localStorage | — |
| `telemetryStore` | Startup snapshots, device, usage, health | localStorage | `ars-technicai-telemetry` |
| `errorStore` | Error events, client signature, sync queue | localStorage | `ars-technicai-errors` |
| `modulesStore` | Module registry status, favorites | localStorage | `ars-technicai-modules` |
| `techniquesStore` | Style techniques catalog | localStorage | `ars-technicai-techniques` |
| `profileStore` | User preferences, creative profile | localStorage | `ars-technicai-profile` |
| `agentsStore` | Autonomous agents, tasks, executions | localStorage | `ars-technicai-agents` |
| `socialStore` | Social posts, connections | localStorage | `ars-technicai-social` |

### Offline Sync Architecture

```
┌────────────────────────────────────────────────────────┐
│                   THREE-TIER LOAD                        │
│                                                         │
│  1. localStorage  ── instant (already in browser)       │
│  2. Disk cache    ── via /api/workspace/load            │
│  3. Database      ── via /api/projects/[id]/canvas      │
│                                                         │
│  Priority: local → disk → DB                            │
│  Images: always embedded as base64 in canvas items      │
│  Offline queue: buffers saves, flushes on reconnect      │
└────────────────────────────────────────────────────────┘
```

---

## Homepage Specification

### Goals
The Homepage is the **mission control** for creative production. It must show:

1. **All projects** with rich metadata
2. **Filter system** for multi-dimensional browsing
3. **Quick-create flow** with platform targeting
4. **Asset visibility** per project
5. **Status awareness** — what's active, generating, published

### Div / Bubble Hierarchy (Redesigned)

```
dashboard-layout-root-page-region
├── connection-banner-status-at-startup        ← fixed top overlay
│
├── dashboard-layout-header-primary-at-top      ← Top Bar
│   ├── brand-logo                           ← "Ars TechnicAI"
│   ├── search-box                           ← global search
│   └── avatar-button-account-settings        ← user avatar + settings
│
├── creation-hero-section-main                 ← Hero Area (collapsible)
│   ├── platform-selector-row                ← target platform chips
│   ├── prompt-input-group                   ← textarea + Generate btn
│   │   ├── prompt-textarea
│   │   └── generate-button-primary
│   ├── prompt-controls-row                   ← style picker + image count
│   ├── pipeline-visualizer                   ← Prompt → Images → Video → Publish
│   └── module-badges-row                     ← Image Gen, Video, Sound FX, Style Transfer
│
├── content-filter-bar-secondary               ← Filter + Tab bar
│   ├── tab-nav (Projects | Assets)           ← main tab switcher
│   ├── filter-chips (type, status, date)    ← multi-select filters
│   ├── sort-selector (Alpha/Date/Size)      ← sort order
│   └── new-project-button                   ← create action
│
└── content-grid-main-scrollable               ← Main content area
    └── project-cards-grid
        └── project-card-component (per project)
            ├── card-thumbnail-cover
            ├── card-header (name, platform badges)
            ├── card-meta-row (asset count, last modified, status)
            ├── card-media-badges (type icons + counts)
            ├── card-expand-toggle           ← click to expand
            └── card-expanded-detail (visible when expanded)
                ├── asset-preview-strip      ← quick preview of recent assets
                ├── asset-status-list        ← active / archived / failed
                ├── platform-links           ← links to published posts
                └── quick-actions (Open, Duplicate, Archive, Delete)
```

### Filter System (Multi-Dimensional)

```
┌──────────────────────────────────────────────────────────┐
│  [All Types ▾]  [All Status ▾]  [All Platforms ▾]        │
│  [Sort: Recent ▾]  [Search projects...]       [+ New]    │
│                                                           │
│  Type Filters:      Status Filters:                       │
│  ☐ Video            ☐ Active (editing)                    │
│  ☐ Short (mobile)   ☐ Ready (published)                   │
│  ☐ Feature Film     ☐ Archived                            │
│  ☐ Comic            ☐ Failed                              │
│  ☐ Storyboard       ☐ Generating                          │
│  ☐ Script           ☐ Draft                               │
│  ☐ Audio Drama                                               │
│                                                           │
│  Platform Filters:   Source Filters:                      │
│  ☐ TikTok           ☐ AI Generated                        │
│  ☐ Instagram        ☐ Manual / Imported                   │
│  ☐ YouTube          ☐ Remixed                             │
│  ☐ Twitter/X        ☐ External URL                        │
│  ☐ LinkedIn                                              │
│                                                           │
│  Sort Options:       Date Range:                          │
│  ◉ Most Recent       From: [____]  To: [____]            │
│  ○ Alphabetical                                           │
│  ○ Largest (assets)                                        │
│  ○ Most Published                                          │
└──────────────────────────────────────────────────────────┘
```

### Project Card Component (Expanded)

Each card shows:

- **Cover thumbnail** (first generated image or video frame)
- **Project name** (editable in place)
- **Project type badge** — 🎬 Video, 📱 Short, 🎥 Film, 📖 Comic, 🎭 Storyboard
- **Target platform** icons with aspect ratio badges
- **Asset count breakdown** — 🖼 12 images, 🎵 3 audio, 🎬 2 videos, 📝 1 script
- **Generation source breakdown** — 8 AI-generated, 3 imported, 1 remixed
- **Status indicator** — green pulse (active editing), grey (idle), orange (generating), red (error)
- **Last modified** timestamp (relative: "3 hours ago")
- **Expand/collapse** arrow → reveals:
  - Asset preview strip (last 5 generated/imported)
  - Published platform links with status
  - Quick actions: Open, Duplicate, Archive, Delete, Export

### Color Code & Variable Relations

The homepage (and entire app) uses a **parametric design system**:

```
Density Knob    (0→2): affects all spacing via calc()
Roundness Knob  (0→2): affects all border radii
Glow Knob       (0→2): affects shadow spread + accent glow
Contrast Knob   (0→2): affects shadow depth + border contrast
Speed Knob      (0→2): affects animation durations
```

These cascade through `calc()` into every visual token. User-adjustable in Settings → Appearance.

```css
--param-density:   1;   /* 0=airy, 1=balanced, 2=compact */
--param-roundness: 1;   /* 0=sharp, 1=rounded, 2=pill */
--param-glow:      1;   /* 0=flat,  1=subtle, 2=vivid */
--param-contrast:  1;   /* 0=soft,  1=normal, 2=crisp */
--param-speed:     1;   /* 0=instant, 1=default, 2=slow */

/* Cascading computed tokens */
--sp-sm: calc(4px * (1.5 - var(--param-density) * 0.5) * 2);
--r-md: calc((2px + var(--param-roundness) * 4px) * 1.75);
--shadow-glow-accent: 0 0 calc(var(--param-glow) * 10px) rgba(0,212,170, calc(var(--param-glow) * 0.18));
```

---

## Workshop Specification

The Workshop is the **main editing environment** — Canvas + Explorer + Inspector + FloatingToolbar + Timeline.

### Asset Placement & Groups

- Assets dragged onto canvas appear at drop position
- **Layer button** (Layers icon in FloatingToolbar) opens the Layers Panel
- Layers Panel shows all assets in a vertical, reorderable list with:
  - Name, type icon, visibility toggle, lock toggle, z-index
  - Color-coded left border: **blue** = original, **red** = user-added, **grey** = hidden/removed, **green** = imported from other asset
- Assets can be **dynamically grouped**: select → right-click → Group (Cmd+G)
- **Connection dots**: small circle at bottom edge of each asset — drag from dot to dot to create colored lines (connection edges)
  - Lines inherit the media type color of connected nodes
  - Click a connection line to show "Group?" prompt

### Multiselect & Grouping

- **Rectangle select**: hold left mouse button on empty canvas → drag → rectangle selects all elements partially/totally inside
- Multiple selected items can be grouped (Group button appears in context toolbar)
- **Grouped component** gets:
  - Thick external contour made of stacked colored stripes (one stripe per media type inside)
  - Group-level transform (move, resize, rotate applies to all children)
  - Expand/collapse animation — groups animate open/close without displacing other elements
  - Double-click group to enter it (nested canvas view)

### Explorer Left Bar (Improvements)

- **Reduce left-margin**: file icons sit at `padding-left: 4px` from screen edge, not 16px
- **Empty folders**: greyed-out icon + greyed-out name (opacity: 0.35)
- **Active/open folders with assets**: orange accent color on icon + name (#f59e0b)
- **Empty state**: italic "Empty folder" text in muted color
- **Tool redundancy elimination**: Consolidate tools — each action has exactly one canonical location:
  - **Import** → Explorer top bar (upload button) — remove from other panels
  - **Generate** → FloatingToolbar "AI Prompt" button OR Inspector panel generate form
  - **Export** → FloatingToolbar "Export" button OR right-click context menu
  - **Undo/Redo** → FloatingToolbar OR keyboard shortcuts (⌘Z/⌘⇧Z)
  - **Zoom** → FloatingToolbar OR canvas scroll wheel
  - **Settings** → Top Bar gear icon OR ⌘, shortcut

### Filter System (Explorer)

- **Fixed**: files matching letters not showing properly → use normalized case-insensitive substring match on `node.name.toLowerCase()`
- **New filter dimensions**:
  - By type: filter dropdown with checkboxes for image/video/audio/text/3D/splat
  - By date: sort by creation date (ascending/descending)
  - By status: active / archived / error
- Filter is a **deferred search** (useDeferredValue) to avoid blocking UI on large trees

---

## Module Catalog

### Module Registration System
All modules register via `lib/modules/registry.ts` with a `ModuleDef` interface:
```typescript
interface ModuleDef {
  id: string;
  name: string;
  category: 'ingest' | 'generate' | 'edit' | 'spatial' | 'intelligence' | 'assembly' | 'publish';
  description: string;
  status: 'live' | 'stub' | 'planned';
  ports: ModulePort[];         // typed input/output ports
  execute: (ctx: ModuleContext) => Promise<ModuleResult>;
}
```

### Module Status Audit

| Module ID | Category | Status | Redundancy Notes |
|-----------|----------|--------|------------------|
| `import-file` | ingest | ✅ Live | Universal file importer |
| `decode-image` | ingest | ✅ Live | Metadata + thumbnail |
| `decode-video` | ingest | ✅ Live | Probe + filmstrip |
| `decode-audio` | ingest | ✅ Live | Waveform + metadata |
| `decode-text` | ingest | ✅ Live | SRT/JSON/CSV/MD parser |
| `decode-3d` | ingest | ⬜ Stub | GLTF/OBJ loader |
| `decode-splat` | ingest | ⬜ Stub | Gaussian splat loader |
| `generate-image` | generate | ✅ Live | Google Imagen → placeholder fallback |
| `generate-video` | generate | ⬜ Stub | Runway/Pika/Kling integration |
| `generate-audio` | generate | ⬜ Stub | ElevenLabs/MusicGen |
| `generate-3d` | generate | ⬜ Stub | Rodin/Luma integration |
| `generate-prompt` | generate | ⬜ Stub | LLM prompt assistance |
| `edit-inpaint` | edit | ⬜ Stub | Mask-based inpainting |
| `edit-outpaint` | edit | ⬜ Stub | Canvas expansion |
| `edit-upscale` | edit | ⬜ Stub | Super-resolution |
| `edit-crop` | edit | ⬜ Stub | Canvas cropping |
| `edit-resize` | edit | ✅ Live | Canvas item resize |
| `edit-rotate` | edit | ✅ Live | Canvas item rotation |
| `edit-remove-bg` | edit | ⬜ Stub | Background removal (RMBG/SAM) |
| `edit-color-grade` | edit | ⬜ Stub | LUT application |
| `edit-draw` | edit | ⬜ Stub | Freehand drawing on images |
| `edit-text-overlay` | edit | ⬜ Stub | Text/write on images |
| `edit-color-analysis` | edit | ⬜ Stub | Color palette extraction |
| `edit-segment` | edit | ⬜ Stub | Identify elements + silhouettes |
| `edit-mask` | edit | ⬜ Stub | Manual/auto masking |
| `spatial-3d-scene` | spatial | ⬜ Stub | Simple 3D scene editor |
| `spatial-camera-rig` | spatial | ⬜ Stub | Camera movement recording |
| `spatial-puppet` | spatial | ⬜ Stub | Skeletal animation puppets |
| `spatial-render` | spatial | ⬜ Stub | 3D → 2D render pass |
| `intelligence-tag` | intelligence | ⬜ Stub | Auto-tagging via vision AI |
| `intelligence-storyboard` | intelligence | ⬜ Stub | Script → storyboard |
| `intelligence-character` | intelligence | ⬜ Stub | Character consistency |
| `assembly-sequence` | assembly | ⬜ Stub | Image sequence from start/end frame |
| `assembly-transition` | assembly | ⬜ Stub | Between-clip transitions |
| `assembly-composite` | assembly | ⬜ Stub | Multi-layer compositing |
| `publish-social` | publish | ⬜ Stub | Platform API posting |
| `publish-format` | publish | ⬜ Stub | Format transcoding |

### Specific Module Specifications

#### Color Analysis Module
- Extracts dominant color palette from an image
- Displays colors as hexadecimal swatches
- **Precision cursor (slider)**: 0-100 — at 0, many small distinct clusters; at 100, few dominant colors
- Output: sorted list of hex values with percentage coverage
- Used by: Color Grade module, Style Transfer, Palette reference

#### Sequence Generation Module
- Takes a **start image** and an **end image**
- Generates intermediate frames for a specified duration (seconds or frame count)
- Uses AI interpolation (frame blending, optical flow, or video model)
- Outputs: image sequence folder or single composite strip
- Settings: FPS, total frames, interpolation method (linear / AI / optical flow)

#### Drawing & Writing Module
- Freehand pen tool (pressure-sensitive on tablets)
- Text tool with font selection, size, color
- All added elements tracked in a **vertical element list**:
  - Collapsible panel showing all drawn/written elements
  - Each element has: visibility toggle, lock, delete, reorder
  - Elements can be grouped, merged, flattened
- Color coding in element list:
  - **Blue** (#3b82f6) = original elements (from source image)
  - **Red** (#ef4444) = user-added elements (drawn/written)
  - **Grey** (#6b7280) = hidden or removed elements
  - **Green** (#22c55e) = elements imported from other assets

#### Background Removal Module
- One-click background removal via RMBG model or SAM
- Preview toggle: show/hide original background
- Output: PNG with transparency
- Mask extraction: save the mask as a separate asset for reuse

#### Element Identification (Segmentation) Module
- Runs segmentation model (SAM or similar) on an image
- Identifies distinct elements: person, car, tree, sky, etc.
- Displays silhouette outlines on canvas
- Lists identified elements in the element panel
- Each identified element can be:
  - Selected (highlighted)
  - Masked (hide/show)
  - Extracted (save as separate asset)
  - Re-colored

#### 3D Scene Module
- Simple 3D viewport with basic primitives (cube, sphere, cylinder, plane)
- **Puppet system**: skeletal rigs for humanoid characters
  - Pre-built skeletons with joint hierarchies
  - Pose library (standing, sitting, walking, running, T-pose)
  - Joint manipulation: click + drag joints to pose
- **Camera system**:
  - Record camera movement as keyframed paths
  - Export camera path as a "camera move" asset
  - Used as input for AI video generation (specify framing)
- Scene export: render to 2D image sequence or single frame

---

## Timeline Specification

### Track Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Timecode Ruler  │  00:00  │  00:05  │  00:10  │  00:15  │
├──────────────────────────────────────────────────────────┤
│ 🎬 Video Track 1 │ [clip] [clip] [transition] [clip]    │
│ 🎬 Video Track 2 │        [overlay clip]                 │
│ 🎵 Audio Track   │ [bg music─────────────────────]       │
│ 🎤 Voice Track   │  [dialogue1]     [dialogue2]          │
│ 🔊 SFX Track     │    [boom!]              [swoosh]      │
│ 📝 Caption Track │  "Hello"            "World"           │
│ 🎨 FX Track      │  [color grade─────────────────]       │
│ 💬 Prompt Track  │  [gen: sunset]  [gen: closeup]        │
│ 📦 Group Track   │  [Group A────────────]                │
├──────────────────────────────────────────────────────────┤
│ Transport: [⏮] [⏪] [▶/⏸] [⏩] [⏭]  │ Volume: ▁▂▃▄▅ │
└──────────────────────────────────────────────────────────┘
```

### Key Features (At Full Spec)
- **Multiple track lanes**: video, audio, voice, SFX, captions, effects, prompts, groups — vertical stacking or collapsible
- **Transitions**: cross-fade, dissolve, wipe, push — drag between clips
- **Scene timing**: each scene has a labeled duration region, can be dragged to adjust
- **Visual preview**: before final video render, a low-res preview plays in the canvas area
- **Prompt tracks**: place prompt nodes on a dedicated track to trigger AI generation at specific timestamps
- **Asset drop**: drag from Explorer or Canvas directly onto a track at the playhead position
- **Keyboard shuttle**: J (reverse), K (stop), L (forward), Space (play/pause), ←→ (frame step)

---

## Settings & Configuration

### Variable Customization Philosophy

Every important variable in the app should be:
1. **Visible** — findable in Settings
2. **Customizable** — adjustable via UI control
3. **Relational** — linked to dependent variables with clear relationship visualization
4. **Resettable** — one-click return to default
5. **Exportable** — share settings as JSON presets

### Settings Categories (Current + Planned)

#### Account
- Profile: name, email, avatar
- Sessions: active devices, revoke
- Role: current role + permissions
- Plan: usage statistics

#### API Keys (per provider)
- Google Imagen, OpenAI, Stability AI, Fal, Replicate, Midjourney
- ElevenLabs, Runway, Pika
- Key validation on entry (green check / red X)
- Keys NEVER stored in exports or shared states

#### Appearance (Parametric Knobs)
```
┌──────────────────────────────────────────────┐
│  Appearance                                  │
│                                               │
│  Font Size:   [Small] [Medium] [Large]       │
│  Density:     ○────●────○  (airy→compact)    │
│  Roundness:   ○────●────○  (sharp→pill)      │
│  Glow:        ○────●────○  (flat→vivid)      │
│  Contrast:    ○────●────○  (soft→crisp)      │
│  Speed:       ○────●────○  (instant→slow)    │
│                                               │
│  ☐ Compact Mode (reduces spacing ~30%)       │
│  ☐ Show Canvas Filenames                     │
│  ☐ Show Grid                                 │
│  Grid Size: [16px ▾]                         │
│  ☐ Snap to Grid                              │
└──────────────────────────────────────────────┘
```

#### Shortcuts
- Full keyboard shortcut reference
- Customizable bindings (future)

#### Publishing
- Connected social accounts per platform
- Default caption templates
- Auto-hashtag generation (AI-assisted)
- Post scheduling

#### Usage & Analytics
- Session stats: generations, imports, exports, project count
- Client signature (for bug reports)
- Telemetry toggle (opt-in anonymous usage data)
- Storage usage: localStorage quota, project sizes

#### About
- Version: 1.0.0-alpha
- Build ID: from Next.js `__NEXT_DATA__`
- Client signature: `v1.0.0-a3f2c1` (version + env hash)
- Dependencies: Next.js, React, TypeScript, Zustand, Prisma, Deno

---

## Security & Compliance

### Data Classification

| Category | Examples | Storage | Encryption | PII? |
|----------|----------|---------|------------|------|
| **Public** | Project names, tags | DB | At rest | No |
| **Internal** | Prompt history, generation params | DB + localStorage | At rest | No |
| **Sensitive** | API keys, session tokens | server env / localStorage | At rest + transit | Yes |
| **Restricted** | Email, OAuth tokens, IP logs | DB | At rest + transit | Yes |

### Security Architecture

```
┌──────────────────────────────────────────────────────┐
│ CLIENT                                              │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │ CSP Headers  │  │CSRF Tokens │  │Encrypted LS │ │
│  └──────────────┘  └────────────┘  └─────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS
┌──────────────────────┴───────────────────────────────┐
│ SERVER                                              │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │ Nginx TLS   │  │Rate Limiter│  │API Auth MW  │ │
│  └──────────────┘  └────────────┘  └─────────────┘ │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │ API Key     │  │JWT Verify  │  │Role Guard   │ │
│  │ Proxy       │  │            │  │              │ │
│  └──────────────┘  └────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Immediate Security Priorities
1. **[ ] Move API keys server-side** — never transmit from client
2. **[ ] Add CSRF protection** to all state-changing API routes
3. **[ ] Implement rate limiting** on generation endpoints
4. **[ ] Add CSP headers** via next.config.js
5. **[ ] Sanitize all user inputs** (prompts) — prevent prompt injection
6. **[ ] Add audit logging** for sensitive operations
7. **[ ] Encrypt localStorage** for API keys and session data

---

## Performance & Optimization

### Current State
| Metric | Target | Status |
|--------|--------|--------|
| Canvas FPS (100 items) | 60fps | ✅ DOM-based, adequate for <500 items |
| Explorer (1000 files) | 30fps scroll | ⚠️ No virtualization — degrades past ~200 |
| Generation latency | <5s placeholder | ✅ Instant SVG placeholder |
| Startup time (offline) | <500ms | ✅ localStorage hydration is instant |
| Canvas sync (100 items) | <2s | ⚠️ Depends on network + DB latency |
| Image load (base64) | <100ms per item | ⚠️ Base64 inlining bloats JSON — move to IndexedDB |

### Optimization Roadmap

#### Phase 1: Quick Wins (< 1 week)
- [x] `React.memo()` on list items
- [x] `useDeferredValue` for search/filter
- [ ] Image lazy loading with Intersection Observer
- [ ] Debounce resize and search operations

#### Phase 2: Medium Effort (1-2 weeks)
- [ ] Virtualize Explorer tree (react-window)
- [ ] Virtualize Timeline tracks
- [ ] Code splitting per workspace mode (Create/Rework/Comic/3D)
- [ ] Service worker for asset caching

#### Phase 3: Major Investment (1+ month)
- [ ] WebGL canvas renderer for 1000+ items at 60fps
- [ ] Web Worker for image processing (sharp, resize, color grade)
- [ ] IndexedDB migration from localStorage for large assets
- [ ] ffmpeg.wasm in Web Worker for video/audio processing

---

## Roadmap

### ✅ Phase 0: Foundations (Complete)
- Module registry with typed ports
- Extended PortType (video, audio, 3D, data, mask)
- Format profiles for all platforms
- Project bundle spec (.arsproj)
- Blueprint types and store

### ✅ Phase 1: Read Everything (Complete)
- Universal file import with metadata extraction
- Image/video/audio/text/3D decoders
- Disk → store reconciliation

### ✅ Phase 1.5: UI Overhaul (Complete)
- Parametric CSS variable system
- Compact homepage with quick-create flow
- Frosted-glass floating toolbar
- Blueprint stacking and asset grouping
- Design system knobs in Settings
- Offline-first auth

### ⬜ Phase 2: Image Edit Modules (Pending)
- Non-destructive image editing pipeline
- Inpaint, outpaint, upscale, crop, resize, rotate
- Background removal (RMBG/SAM)
- Color analysis with precision slider
- Freehand drawing and text overlay on images

### ⬜ Phase 3: Video Engine (Pending)
- ffmpeg.wasm integration
- Real timeline playback
- Multi-track video/audio mixing
- Transitions library
- Render/export pipeline

### ⬜ Phase 4: Audio Engine (Pending)
- TTS via ElevenLabs
- Music generation via Suno/MusicGen
- SFX library and AI generation
- Waveform visualization
- Multi-track audio mixing

### ⬜ Phase 5: 3D + Gaussian Splat (Pending)
- Three.js viewport
- Simple 3D scene editor with primitives
- Puppet system with skeletal animation
- Camera movement recording
- 3D → 2D render passes

### ⬜ Phase 6: Intelligence Modules (Pending)
- Auto-tagging with vision AI
- Storyboard generation from script
- Character consistency across shots
- Style transfer and LUT application

### ⬜ Phase 7: Blueprints + Agents (Pending)
- Reusable pipeline blueprints
- Autonomous agent orchestration
- Batch generation and variant management

### ⬜ Phase 8: Automations + Social Posting (Pending)
- Scheduled content creation
- Hands-free generation → edit → publish pipeline
- Analytics dashboard for published content

### Planned (Future)
- Real-time multi-user collaboration (WebSocket / Liveblocks)
- Asset CDN (S3 / Cloudflare R2)
- Team workspaces with RBAC
- Plugin API for custom AI providers and modules
- Mobile/tablet touch support
- Native desktop wrapper (Tauri)

---

## Contributing

See `HERMES_SUPERPROMPT.md` for the standing directive for AI coding agents.

### Naming Conventions
- **Components**: PascalCase — `DashboardLayout`, `ExplorerPanel`
- **Hooks**: camelCase, `use` prefix — `useProjectSync`, `useAssetLibrary`
- **Stores**: camelCase, `Store` suffix — `canvasStore`, `settingsStore`
- **API routes**: RESTful under `pages/api/`
- **CSS classes**: camelCase with goal+location+state — `dashboardLayoutHeaderPrimaryAtTop`
- **HTML IDs**: kebab-case — `dashboard-layout-main-content-region`

### Commit Convention
`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `security:`

---

## License
MIT — see `LICENSE`.
