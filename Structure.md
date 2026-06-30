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
│   │   └── AuthModal.module.css
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
- Quick-create flow: select platform → enter prompt → Generate
- Project grid with search and filter
- Platform selector (TikTok, Instagram, YouTube, Twitter/X)
- Style picker (10 AI art styles)
- Pipeline visualizer (Prompt → Images → Video → Platform)
- **NEEDS**: expanded project cards with media badges, faceted filter system

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

| Module ID | Category | Status | Description |
|-----------|----------|--------|-------------|
| `import-file` | ingest | ✅ Live | Universal file importer |
| `decode-image` | ingest | ✅ Live | Image metadata + thumbnail |
| `decode-video` | ingest | ✅ Live | Video probe + filmstrip |
| `decode-audio` | ingest | ✅ Live | Audio waveform + metadata |
| `decode-text` | ingest | ✅ Live | SRT/JSON/CSV/MD parser |
| `decode-3d` | ingest | ⬜ Stub | GLTF/OBJ loader |
| `decode-splat` | ingest | ⬜ Stub | Gaussian splat loader |
| `generate-image` | generate | ✅ Live | Google Imagen + placeholder |
| `generate-video` | generate | ⬜ Stub | Runway/Pika/Kling |
| `generate-audio` | generate | ⬜ Stub | ElevenLabs/MusicGen |
| `generate-3d` | generate | ⬜ Stub | Rodin/Luma |
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
| `edit-segment` | edit | ⬜ Stub | Element identification + silhouettes |
| `edit-mask` | edit | ⬜ Stub | Manual/auto masking |
| `spatial-3d-scene` | spatial | ⬜ Stub | Simple 3D scene editor |
| `spatial-camera-rig` | spatial | ⬜ Stub | Camera movement recording |
| `spatial-puppet` | spatial | ⬜ Stub | Skeletal animation puppets |
| `spatial-render` | spatial | ⬜ Stub | 3D → 2D render pass |
| `intelligence-tag` | intelligence | ⬜ Stub | Auto-tagging via vision AI |
| `intelligence-storyboard` | intelligence | ⬜ Stub | Script → storyboard |
| `intelligence-character` | intelligence | ⬜ Stub | Character consistency |
| `assembly-sequence` | assembly | ⬜ Stub | Image sequence from start/end |
| `assembly-transition` | assembly | ⬜ Stub | Between-clip transitions |
| `assembly-composite` | assembly | ⬜ Stub | Multi-layer compositing |
| `publish-social` | publish | ⬜ Stub | Platform API posting |
| `publish-format` | publish | ⬜ Stub | Format transcoding |

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
