# Ars TechnicAI — Repository & Module Structure

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> This document describes how Ars TechnicAI's codebase and product modules are organized. It catalogs every file, module, store, and API route with their current implementation status.

---

## Current File Layout

```
/
├── pages/
│   ├── index.tsx                       # App entry (dynamic import AppShell, SSR disabled)
│   ├── _app.tsx                        # SessionProvider + global styles + telemetry startup
│   ├── auth/
│   │   ├── signin.tsx                  # Custom NextAuth sign-in page
│   │   ├── register.tsx                # Registration form
│   │   └── error.tsx                   # Auth error page
│   ├── home.tsx                        # Homepage/Dashboard entry
│   ├── project/
│   │   └── [id].tsx                    # Project editor entry (loads AppShell)
│   └── api/
│       ├── auth/[...nextauth].ts       # NextAuth handler
│       ├── health.ts                   # DB + Redis health check
│       ├── generate.ts                 # Image generation (Google Imagen + placeholder)
│       ├── video/create.ts             # Video assembly endpoint
│       ├── audio/sfx.ts                # SFX generation (ElevenLabs / offline)
│       ├── users/
│       │   ├── me.ts                   # GET/PATCH profile + stats + devices + sessions
│       │   ├── me/settings.ts          # GET/PUT cross-device settings
│       │   ├── me/devices.ts           # GET device list
│       │   └── me/devices/[id].ts      # PATCH/DELETE device
│       ├── projects/
│       │   ├── index.ts                # GET list / POST create
│       │   └── [id]/
│       │       ├── index.ts            # GET/PATCH/DELETE project
│       │       ├── canvas/index.ts     # GET/PUT canvas items + edges
│       │       ├── files/index.ts      # GET/PUT file nodes
│       │       └── versions/
│       │           ├── index.ts        # GET list / POST create snapshot
│       │           └── [versionId]/restore.ts
│       ├── assets/
│       │   ├── index.ts               # GET paginated list / POST upload
│       │   ├── search.ts              # Semantic search (pgvector)
│       │   └── [id]/                  # GET/PATCH/DELETE single asset
│       ├── jobs/
│       │   ├── index.ts               # GET list / POST create job
│       │   └── [id]/
│       │       ├── index.ts           # GET/PATCH/DELETE job
│       │       └── stream.ts          # GET SSE stream
│       ├── prompts/
│       │   ├── index.ts               # Prompt CRUD
│       │   └── templates/index.ts     # GET prompt template library
│       ├── providers/                 # Provider status + model list + key validate
│       ├── admin/                     # Admin-only routes
│       ├── tags/                      # Tag CRUD
│       ├── publish/                   # Publishing accounts + post jobs
│       ├── telemetry/
│       │   ├── snapshot.ts            # POST startup snapshot
│       │   └── events.ts              # POST error events batch
│       └── workspace/
│           ├── save.ts                # POST save workspace to disk
│           ├── load.ts                # GET load workspace from disk
│           └── scan.ts                # GET scan disk for project files
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx               # Root: panels + workspace + mode routing
│   │   ├── AppShell.module.css
│   │   ├── TopBar.tsx                 # Mode switch, project breadcrumb, account
│   │   ├── TopBar.module.css
│   │   ├── ExplorerPanel.tsx          # Local (file tree) + Cloud (asset grid) tabs
│   │   ├── ExplorerPanel.module.css
│   │   ├── InspectorPanel.tsx         # Generate, Templates, API key, Selection, Versions, Jobs
│   │   ├── InspectorPanel.module.css
│   │   ├── Canvas.tsx                 # Infinite 2D canvas, 8-handle resize, undo/redo
│   │   ├── Canvas.module.css
│   │   ├── NodeGraph.tsx              # ComfyUI-style node workflow editor
│   │   ├── NodeGraph.module.css
│   │   ├── Timeline.tsx               # Multi-track timeline (UI only)
│   │   ├── Timeline.module.css
│   │   ├── ActionLog.tsx              # Floating action log overlay
│   │   ├── ActionLog.module.css
│   │   ├── SettingsModal.tsx          # Settings dialog (8 tabs)
│   │   ├── SettingsModal.module.css
│   │   ├── DashboardLayout.tsx        # Homepage dashboard
│   │   ├── DashboardLayout.module.css
│   │   ├── FloatingToolbar.tsx        # Workshop floating icon bar
│   │   ├── FloatingToolbar.module.css
│   │   ├── ConnectionOverlay.tsx      # Canvas-to-timeline connection lines
│   │   └── ConnectionOverlay.module.css
│   ├── ui/
│   │   ├── Button.tsx / Button.module.css
│   │   ├── Input.tsx / Input.module.css
│   │   ├── Select.tsx / Select.module.css
│   │   ├── ConnectionBanner.tsx       # Health status banner
│   │   ├── ConnectionBanner.module.css
│   │   ├── ConnectionStatus.tsx       # Status indicator with halo
│   │   ├── ConnectionStatus.module.css
│   │   ├── AuthModal.tsx              # Login + Register modal
│   │   ├── AuthModal.module.css
│   │   ├── PanelErrorBoundary.tsx     # React class boundary: wraps each major panel
│   │   ├── PanelErrorBoundary.module.css
│   │   ├── EmptyState.tsx             # Standardized empty panel state (icon + title + CTA)
│   │   ├── EmptyState.module.css
│   │   ├── Skeleton.tsx               # Shimmer skeletons: ProjectCard, AssetCard, ExplorerRow, GenImage, InspectorSection
│   │   └── Skeleton.module.css
│   └── dashboard/
│       ├── ProjectsGrid.tsx           # Project cards grid
│       ├── AssetsGrid.tsx             # Asset grid view
│       └── ServicesUsagePanel.tsx     # Usage statistics panel
│
├── stores/
│   ├── index.ts                       # Re-exports all stores
│   ├── canvasStore.ts                 # Items, selection, undo/redo (50 steps)
│   ├── fileStore.ts                   # Local file tree, assets map
│   ├── settingsStore.ts               # AI provider, display prefs
│   ├── generationStore.ts             # Job queue, prompt/dims state
│   ├── logStore.ts                    # Action log entries
│   ├── projectStore.ts                # Shared project state
│   ├── nodeStore.ts                   # Workflow nodes/connections
│   ├── userStore.ts                   # Device info, session stats
│   ├── toastStore.ts                  # Error codes, notifications
│   ├── telemetryStore.ts              # Startup snapshots, health
│   ├── errorStore.ts                  # Error events, sync queue
│   ├── blueprintStore.ts              # Blueprint CRUD + import/export
│   ├── modulesStore.ts                # Module registry status
│   ├── techniquesStore.ts             # Style techniques catalog
│   ├── profileStore.ts                # User preferences
│   ├── agentsStore.ts                 # Agent tasks/executions
│   ├── socialStore.ts                 # Social posts/connections
│   └── dashboardStore.ts              # Dashboard state
│
├── hooks/
│   ├── useConnectionStatus.ts         # Polls /api/health → 4 status states
│   ├── useProjectSync.ts              # DB autosave, versions, canvas sync
│   ├── useAssetLibrary.ts             # Fetch assets from /api/assets
│   ├── useSettingsSync.ts             # Cross-device settings sync
│   ├── useDiskReconciliation.ts       # Disk → store reconciliation on startup
│   └── useDiskSave.ts                 # Save workspace to disk
│
├── lib/
│   ├── auth/
│   │   └── options.ts                 # NextAuth config (device tracking, JWT)
│   ├── ai/
│   │   └── providers/
│   │       └── google-imagen.ts       # Google Imagen REST client
│   ├── services/                      # Service layer (business logic, isolated from React)
│   │   ├── GenerationService.ts       # PLANNED: wraps generation jobs + event emission
│   │   ├── ProjectService.ts          # PLANNED: create, archive, restore, snapshot, duplicate
│   │   └── ExportService.ts           # PLANNED: PNG, video bundle, .arsproj export
│   ├── events/                        # Typed event bus for cross-cutting communication
│   │   └── bus.ts                     # PLANNED: createEventBus<DomainEventMap>()
│   ├── middleware/                    # API route middleware
│   │   ├── rateLimit.ts               # PLANNED: Redis-backed rate limiting
│   │   └── csrf.ts                    # PLANNED: CSRF token validation
│   ├── modules/                       # Module registry + processing modules
│   │   ├── registry.ts                # ModuleRegistry with all module IDs
│   │   ├── ingest/                    # 14 import/read modules (Phase 1)
│   │   │   ├── import-file.ts         # Universal file import
│   │   │   ├── decode-image.ts        # Image metadata extraction
│   │   │   ├── decode-video.ts        # Video probe + filmstrip
│   │   │   ├── decode-audio.ts        # Audio waveform + metadata
│   │   │   └── decode-text.ts         # SRT/JSON/CSV/MD parser
│   │   ├── generate/                  # 17 generation module stubs
│   │   ├── edit/                      # 21 edit/transform module stubs
│   │   ├── spatial/                   # 9 3D/spatial module stubs
│   │   ├── intelligence/              # 10 AI intelligence module stubs
│   │   ├── assembly/                  # 7 assembly/compositing module stubs
│   │   └── publish/                   # 4 publish + platform adapter stubs
│   ├── media/
│   │   ├── image.ts                   # sharp-based image ops
│   │   ├── video.ts                   # fluent-ffmpeg video ops
│   │   ├── audio.ts                   # Web Audio API ops
│   │   ├── processor.ts              # Universal media processor
│   │   └── ffmpegPath.ts             # Cross-platform ffmpeg detection
│   ├── formats/
│   │   └── profiles.ts               # 10 platform format profiles
│   ├── project/
│   │   └── bundle.ts                 # .arsproj manifest spec
│   ├── storage/
│   │   └── local.ts                  # localStorage / IndexedDB helpers
│   ├── redis.ts                       # ioredis client singleton
│   ├── prisma.ts                      # Prisma client singleton
│   └── validation/
│       └── schemas.ts                 # Zod schemas for all API bodies
│
├── prisma/
│   ├── schema.prisma                  # Full DB schema (922 lines)
│   └── seed.ts                        # Seed script
│
├── types/
│   ├── index.ts                       # Core TS types (CanvasItem, Asset, etc.)
│   ├── module.ts                      # ModuleDef, ModulePort, ModuleResult
│   ├── format.ts                      # FormatProfile, ExportSettings
│   ├── blueprint.ts                   # Blueprint types
│   ├── dashboard.ts                   # Dashboard-specific types
│   ├── production.ts                  # Production tracking types
│   └── next-auth.d.ts                 # Session type augmentation
│
├── constants/
│   └── workspace.ts                   # STORAGE_KEYS, paths, defaults
│
├── styles/
│   └── globals.css                    # Design tokens + parametric knobs + reset
│
├── public/                            # Static assets
├── nginx-arstechnicai.conf            # Nginx reverse proxy config
├── ecosystem.config.cjs               # PM2 config
├── deno.json                          # Deno tasks
├── package.json                       # npm deps
├── .env.example                       # Environment template
└── .env.local                         # Local environment (git-ignored)
```

---

## Product Modules (Detailed)

### 1. App Shell (`components/layout/AppShell.tsx`)
- Mode routing: `create`, `rework`, `composite`, `timeline`
- Resizable panels (explorer, inspector, timeline) via drag handles
- Keyboard shortcuts: Cmd+1/2/3 (panels), Cmd+, (settings)
- Auto-save every 15 seconds + beforeunload sendBeacon
- **Panel Error Boundaries** (implemented): Each panel (Explorer, Canvas, Inspector, Timeline, NodeGraph) is wrapped in `<PanelErrorBoundary panelName="...">`. A crash in one panel shows a recovery UI without killing the rest of the app. Error is logged to errorStore and emitted to the event bus.

### 2. Explorer (`components/layout/ExplorerPanel.tsx`)
- **Local tab**: file tree from `fileStore`; drag assets to canvas
- **Cloud tab**: DB asset grid via `useAssetLibrary`
- Filter bar with deferred search
- Upload button (browser file picker)
- **NEEDS**: left margin reduction, empty folder greying, active folder orange, virtualization

### 3. Canvas (`components/layout/Canvas.tsx`)
- Infinite pan/zoom with zoom-to-cursor on wheel
- Item selection (click, Shift+click, Cmd+A)
- 8 resize handles (direction-aware math per handle)
- Rotate CCW/CW 15° per click
- Undo/redo (Cmd+Z / Cmd+Shift+Z)
- Export PNG (offscreen canvas renders all items sorted by z-index)
- Grid toggle, keyboard shortcuts
- **NEEDS**: connection dots, multiselect rectangle, group contour, WebGL for scale

### 4. Node Graph (`components/layout/NodeGraph.tsx`)
- 7 node types: Prompt, Negative, Generator, Image Input, Transform, Blend, Output
- Drag to move, click port → click port to connect
- Viewport: alt+drag pan, Ctrl+wheel zoom
- Execute: topological sort → run each node → add outputs to canvas
- Save/Load workflow JSON
- **NEEDS**: more node types (upscale, inpaint, segment, 3D, LLM)

### 5. Inspector (`components/layout/InspectorPanel.tsx`)
- Generate Image: prompt, negative prompt, W×H, Generate button
- Prompt Templates: load from API, "Use" populates prompt
- API Settings: multi-provider key inputs with validation
- Selected Item: position, size, rotation, asset ID, prompt
- Version History: list from DB, restore to any version
- Recent Generations: job thumbnails with status dots

### 6. FloatingToolbar (`components/layout/FloatingToolbar.tsx`)
- Frosted glass vertical icon bar, 5 tool groups with dividers
- Group 0: Selection (Pointer V, Lasso L, Pan H)
- Group 1: Creation (AI Prompt P, Pen B, Shape R, Text T, Eyedropper I)
- Group 2: History (Undo ⌘Z, Redo ⌘⇧Z)
- Group 3: View (Zoom In +, Zoom Out -, Fit ⌘0)
- Group 4: Output (Make Video, Add Audio, Layers, Export ⌘E, Publish)
- **Tool redundancy audit**:
  - Generate: FloatingToolbar "AI Prompt" OR Inspector generate form (pick ONE canonical location: Inspector for detailed generation, FloatingToolbar for quick prompt)
  - Export: FloatingToolbar "Export" OR right-click menu (keep both — toolbar for primary, context menu for accelerator)
  - Layers: FloatingToolbar "Layers" button ONLY (removed from other locations)
  - Undo/Redo: FloatingToolbar + keyboard shortcuts (removed from TopBar if present)

### 7. Timeline (`components/layout/Timeline.tsx`)
- **Current**: UI only — visual track display, no playback
- **Target**: Full multi-track editor with real video/audio playback
- Tracks: Video, Audio, Captions, Effects, Prompts, Groups
- Playhead: red 2px line with triangle head
- **NEEDS**: ffmpeg.wasm integration, waveform rendering, J/K/L shuttle, transitions

### 8. Homepage (`components/layout/DashboardLayout.tsx`)
- **Information hierarchy (redesigned)**: Filter bar + project grid visible first; quick-create hero docked at bottom, compact by default
- **Compact prompt strip**: Platform chips + prompt textarea + style picker + count + generate (single row)
- **Pipeline visualizer**: `Script → Mood Board → Prompts → Generate → Storyboard → Timeline → Publish` with completion-state dot indicators
- **Expand hero**: chevron button reveals negative prompt, cinematic controls (composition/lighting/camera), character creator, prompt templates, full module catalog
- **Faceted filter bar** (implemented): Platform (TikTok / IG / YouTube / X) + Source (AI Generated / Imported / Remixed / Manual) + Sort (Recent / A–Z / By Size / Most Published) — chip UI with dropdown, Escape to close, clear-all pill
- Filter state: `ActiveFilters { platform, source, sortBy }` stored in component state; dropdowns close on outside click via `useEffect` + `data-filter-drop` attrs
- Project grid (Projects | Assets tabs) with search, tag filters, sort, favorites
- Generated results strip: docked between grid and hero; drag to reorder, Edit in Workshop / Save actions
- Character creator: name, appearance, wardrobe, pose, background
- Prompt templates: 6 built-in + create new
- Module catalog: Generate, Edit, 3D/Spatial, Intelligence, Assembly, Ingest, Publish
- Semantic HTML IDs: `dashboard-layout-header-primary-at-top`, `creation-hero-section-main`, `content-filter-bar-secondary`, `faceted-filter-chips-row`, `content-grid-main-scrollable`, `pipeline-visualizer-steps-row`, `prompt-input-group-flex`, `generate-button-primary-gradient`, `module-badges-row`
- **NEEDS**: wire filter state to ProjectsGrid (currently visual only), expanded project cards with pipeline phase indicator, Synopsis/Logline field in project creation

### 9. Settings (`components/layout/SettingsModal.tsx`)
- 8 tabs: Account, API Keys, Appearance, Shortcuts, Publishing, Usage, Help, About
- Appearance knobs: density, roundness, glow, contrast, speed (sliders 0-2)
- API key validation per provider
- Client signature display in About tab

### 10. Connection Status (`components/ui/ConnectionStatus.tsx`)
- Polls `/api/health` + `useSession` every 30s
- States: pending (orange) → connected (green) | unauthenticated (teal) | denied (red)
- Unauthenticated: click opens AuthModal
- Authenticated: avatar click opens account panel

---

## Module Status Audit (Complete)

### Pre-Production Modules (Phase 0 — Planned)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `script-editor` | pre-production | ⬜ Planned | Screenplay editor (sluglines, action, dialogue) |
| `script-to-shots` | pre-production | ⬜ Planned | Parse script scenes → generate shot list |
| `character-db` | pre-production | ⬜ Planned | Character profiles (name, appearance, voice, wardrobe) |
| `location-manager` | pre-production | ⬜ Planned | Location definitions with reference images + time-of-day |
| `mood-board` | pre-production | ⬜ Planned | Reference image grid + color palette per scene |
| `storyboard-editor` | pre-production | ⬜ Planned | Canvas shot nodes with camera spec + dialogue cues |
| `animatic-sequencer` | pre-production | ⬜ Planned | Order storyboard frames into rough animatic with timing |
| `color-script` | pre-production | ⬜ Planned | Per-scene mood swatch progression (color arc) |
| `vocab-library` | pre-production | ⬜ Stub | Camera/lens/lighting/composition/materials/FX presets |
| `prompt-template-engine` | pre-production | ⬜ Stub | Templates with typed variables + provider capability map |

### Ingest Modules (Phase 1 — Complete)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `import-file` | ingest | ✅ Live | Universal file importer (drag-drop or picker) |
| `decode-image` | ingest | ✅ Live | Image metadata extraction + thumbnail generation |
| `decode-video` | ingest | ✅ Live | Video probe (duration, fps, codec) + filmstrip |
| `decode-audio` | ingest | ✅ Live | Audio waveform + metadata (duration, channels, sample rate) |
| `decode-text` | ingest | ✅ Live | SRT/JSON/CSV/MD/VTT parser → text asset |
| `decode-3d` | ingest | ⬜ Stub | GLTF/OBJ loader + thumbnail render |
| `decode-splat` | ingest | ⬜ Stub | Gaussian splat PLY loader + viewport preview |
| `import-url` | ingest | ⬜ Stub | Fetch remote URL → asset (with CORS handling) |
| `palette-extract` | ingest | ⬜ Stub | Extract dominant color palette from any image |
| `inspiration-tagger` | ingest | ⬜ Stub | Auto-classify imported assets as inspiration vs. deliverable |

### Generation Modules (Phase 2+ — In Progress)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `generate-image` | generate | ✅ Live | Google Imagen REST client + placeholder fallback |
| `generate-video` | generate | ⬜ Stub | Runway Gen-3 / Pika / Kling adapter |
| `generate-audio-sfx` | generate | ⬜ Stub | ElevenLabs SFX generation |
| `generate-audio-music` | generate | ⬜ Stub | Suno / MusicGen background score |
| `generate-tts` | generate | ⬜ Stub | ElevenLabs TTS with character voice profiles |
| `generate-3d` | generate | ⬜ Stub | Rodin / Luma / Meshy 3D model generation |
| `generate-prompt-assist` | generate | ⬜ Stub | LLM-assisted prompt expansion from short descriptions |
| `generate-storyboard-ai` | generate | ⬜ Stub | Script scene → storyboard panel image (auto-prompt + generate) |

### Edit Modules (Phase 2 — Target Q3 2026)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `edit-resize` | edit | ✅ Live | Canvas item resize (8 handles, direction-aware math) |
| `edit-rotate` | edit | ✅ Live | Canvas item rotation (±15° per click) |
| `edit-remove-bg` | edit | ⬜ Planned | Background removal via RMBG / SAM model |
| `edit-inpaint` | edit | ⬜ Stub | Mask-based inpainting (fill selection region) |
| `edit-outpaint` | edit | ⬜ Stub | Canvas expansion (extend beyond image bounds) |
| `edit-upscale` | edit | ⬜ Stub | Super-resolution (2×/4× via Real-ESRGAN or similar) |
| `edit-crop` | edit | ⬜ Stub | Non-destructive canvas cropping |
| `edit-color-grade` | edit | ⬜ Stub | LUT application (upload .cube / .3dl) |
| `edit-color-analysis` | edit | ⬜ Stub | Palette extraction + precision slider (0=granular, 100=few) |
| `edit-draw` | edit | ⬜ Stub | Freehand pen drawing on canvas items |
| `edit-text-overlay` | edit | ⬜ Stub | Add styled text/titles/captions directly on images |
| `edit-segment` | edit | ⬜ Stub | Identify elements → silhouettes → element list panel |
| `edit-mask` | edit | ⬜ Stub | Manual brush + auto-mask from segmentation |
| `edit-style-transfer` | edit | ⬜ Stub | Apply reference image style to generated output |

### Spatial / 3D Modules (Phase 5 — Target Q1 2027)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `spatial-3d-scene` | spatial | ⬜ Stub | Simple 3D scene editor with primitives (Three.js) |
| `spatial-camera-rig` | spatial | ⬜ Stub | Keyframed camera path recording |
| `spatial-puppet` | spatial | ⬜ Stub | Skeletal animation puppet with pose library |
| `spatial-render` | spatial | ⬜ Stub | 3D → 2D render pass for pipeline integration |

### Intelligence Modules (Phase 6 — Target Q2 2027)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `intelligence-tag` | intelligence | ⬜ Stub | Auto-tagging via vision AI (CLIP / GPT-4V) |
| `intelligence-storyboard` | intelligence | ⬜ Stub | Script scene → storyboard panel (camera + prompt) |
| `intelligence-character` | intelligence | ⬜ Stub | Character consistency across multiple generated images |
| `intelligence-shot-to-image` | intelligence | ⬜ Stub | Convert shot list entry → ready-to-run generation prompt |
| `intelligence-scene-analysis` | intelligence | ⬜ Stub | Analyze imported footage → extract shot descriptions |

### Assembly Modules (Phase 4 — Target Q4 2026)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `assembly-sequence` | assembly | ⬜ Stub | Image sequence interpolation (start frame → end frame → N frames) |
| `assembly-transition` | assembly | ⬜ Stub | Cross-fade, dissolve, wipe, L-cut, J-cut between clips |
| `assembly-composite` | assembly | ⬜ Stub | Multi-layer image compositing with blend modes |
| `assembly-captions` | assembly | ⬜ Stub | Auto-generate captions (whisper.cpp) + style editor |
| `assembly-comic-layout` | assembly | ⬜ Stub | Panel grid templates for comic page assembly |

### Publish Modules (Phase 8 — Target Q4 2027)

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `publish-social` | publish | ⬜ Stub | Platform API posting (TikTok, Instagram, YouTube, X, LinkedIn) |
| `publish-format` | publish | ⬜ Stub | Format transcoding via ffmpeg to platform-specific specs |
| `publish-schedule` | publish | ⬜ Stub | Post scheduling with platform calendar integration |
| `publish-analytics` | publish | ⬜ Stub | Views, likes, shares aggregated per platform post |

---

## Naming Conventions

- **Components**: `PascalCase.tsx`
- **Hooks**: `useThing.ts`
- **CSS Modules**: `Component.module.css` with `camelCase` classes
- **Stores**: `thingStore.ts`
- **API routes**: REST style under `pages/api/`
- **CSS class pattern**: `<component><goal><location><state>` (e.g., `dashboardLayoutHeaderPrimaryAtTop`)
- **HTML ID pattern**: `<component>-<goal>-<location>-<state>` (e.g., `dashboard-layout-main-content-region`)

---

## Documentation Map

| File | Purpose |
|------|---------|
| `README.md` | What it is, features, architecture, quick start, roadmap |
| `Design.md` | UI/UX, CSS, design tokens, homepage + workshop specs |
| `Prompt.md` | PRD + feature inventory + vision |
| `Structure.md` | File layout + module descriptions (this doc) |
| `ARCHITECTURE.md` | Critical analysis by role, data architecture, security, performance |
| `HERMES_SUPERPROMPT.md` | Standing directive for AI coding agents |
| `PROJECT_SYSTEM_EXPANSION.md` | Project type expansion plan |
| `DATA_ARCHITECTURE_AND_NODE_CATALOG.md` | Data architecture, persistence, node catalog |
| `HEALTH_ERROR_SYSTEM_PLAN.md` | Health/error/telemetry pipeline |
| `TEST_RESULTS.md` | Test results and coverage report |
| `services/auth/ARCHITECTURE.md` | Auth architecture specification |
