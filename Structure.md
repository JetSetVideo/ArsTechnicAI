# Ars TechnicAI — Repository & Module Structure

This document describes how Ars TechnicAI's codebase and product modules are organized.

---

## Current file layout

```
/
├── pages/
│   ├── index.tsx                       # App entry (dynamic import AppShell, SSR disabled)
│   ├── _app.tsx                        # SessionProvider + global styles
│   ├── auth/
│   │   ├── signin.tsx                  # Custom NextAuth sign-in page
│   │   ├── register.tsx                # Registration form
│   │   └── error.tsx                   # Auth error page
│   └── api/
│       ├── auth/[...nextauth].ts       # NextAuth handler
│       ├── health.ts                   # DB + Redis health check
│       ├── generate.ts                 # Image generation (Google Imagen, direct)
│       ├── users/
│       │   ├── me.ts                   # GET/PATCH own profile + stats + devices + sessions
│       │   ├── me/settings.ts          # GET/PUT UserSettings (cross-device sync)
│       │   ├── me/devices.ts           # GET device list
│       │   ├── me/devices/[id].ts      # PATCH (rename) / DELETE (revoke) device
│       │   └── me/api-keys/            # API key management
│       ├── projects/
│       │   ├── index.ts                # GET list / POST create project
│       │   └── [id]/
│       │       ├── index.ts            # GET/PATCH/DELETE project
│       │       ├── canvas/index.ts     # GET/PUT canvas items + edges
│       │       ├── files/index.ts      # GET/PUT file nodes
│       │       └── versions/
│       │           ├── index.ts        # GET list / POST create snapshot
│       │           └── [versionId]/
│       │               └── restore.ts  # POST restore snapshot
│       ├── assets/
│       │   ├── index.ts               # GET paginated list / POST upload
│       │   ├── search.ts              # Semantic search (pgvector)
│       │   └── [id]/                  # GET / PATCH / DELETE single asset
│       ├── jobs/
│       │   ├── index.ts               # GET list / POST create job
│       │   └── [id]/
│       │       ├── index.ts           # GET / PATCH / DELETE job
│       │       └── stream.ts          # GET SSE stream (polls DB every 1.5s)
│       ├── prompts/
│       │   ├── index.ts               # Prompt CRUD
│       │   └── templates/index.ts     # GET prompt template library
│       ├── providers/                 # Provider status + model list + key validate
│       ├── admin/                     # Admin-only routes
│       ├── tags/                      # Tag CRUD
│       └── publish/                   # Publishing accounts + jobs
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx               # Root: panels + workspace + mode routing
│   │   ├── AppShell.module.css
│   │   ├── TopBar.tsx                 # Mode switch, project (New/Open/Save/Recent), account
│   │   ├── TopBar.module.css
│   │   ├── ExplorerPanel.tsx          # Local (file tree) + Cloud (asset grid) tabs
│   │   ├── ExplorerPanel.module.css
│   │   ├── InspectorPanel.tsx         # Generate, Templates, API key, Selection, Versions, Jobs
│   │   ├── InspectorPanel.module.css
│   │   ├── Canvas.tsx                 # Infinite 2D canvas, 8-handle resize, undo/redo, export
│   │   ├── Canvas.module.css
│   │   ├── NodeGraph.tsx              # ComfyUI-style node workflow editor
│   │   ├── NodeGraph.module.css
│   │   ├── Timeline.tsx               # Multi-track timeline
│   │   ├── Timeline.module.css
│   │   ├── ActionLog.tsx              # Floating action log overlay
│   │   ├── ActionLog.module.css
│   │   ├── SettingsModal.tsx          # Settings dialog
│   │   └── SettingsModal.module.css
│   └── ui/
│       ├── Button.tsx / Button.module.css
│       ├── Input.tsx / Input.module.css
│       ├── Select.tsx / Select.module.css
│       ├── ConnectionStatus.tsx       # Teal/orange/green/red halo; AuthModal or account panel
│       ├── ConnectionStatus.module.css
│       ├── AuthModal.tsx              # In-app Login + Register modal with OAuth
│       └── AuthModal.module.css
│
├── stores/
│   ├── index.ts                       # Re-exports all stores
│   ├── canvasStore.ts                 # Items, selection, undo/redo (50-step history)
│   ├── fileStore.ts                   # Local file tree (in-memory)
│   ├── settingsStore.ts               # AI provider, display prefs (localStorage persist)
│   ├── generationStore.ts             # Job queue (in-memory), prompt/dims state
│   ├── logStore.ts                    # Action log entries
│   ├── projectStore.ts                # Shared projectId, projectName, isDirty, lastSynced
│   └── nodeStore.ts                   # Workflow nodes/connections, execution engine, 7 node types
│
├── hooks/
│   ├── useConnectionStatus.ts         # Polls /api/health + session → 4 status states
│   ├── useProjectSync.ts              # DB autosave (30s), saveVersion(), syncCanvas(), loadProjectFromDb()
│   ├── useAssetLibrary.ts             # Fetch user assets from /api/assets
│   └── useSettingsSync.ts             # Load DB settings on login, debounced PUT on change
│
├── lib/
│   ├── auth/
│   │   ├── options.ts                 # NextAuth config (device tracking, session events)
│   │   └── device.ts                  # SHA-256 fingerprint, ip-api.com geo, upsertDeviceFromHeaders()
│   ├── ai/
│   │   └── providers/
│   │       └── google-imagen.ts       # Google Imagen REST client
│   ├── redis.ts                       # ioredis client singleton
│   ├── prisma.ts                      # Prisma client singleton
│   └── validation/
│       └── schemas.ts                 # Zod schemas for all API bodies
│
├── prisma/
│   ├── schema.prisma                  # Full DB schema (all models)
│   └── seed.ts                        # Seed script (admin user, sample data)
│
├── types/
│   ├── index.ts                       # Shared TS types (CanvasItem, Asset, FileNode, etc.)
│   └── next-auth.d.ts                 # Session type augmentation
│
├── styles/
│   └── globals.css                    # CSS variables + base styles
│
├── public/                            # Static assets
├── nginx-arstechnicai.conf            # Nginx reverse proxy config
├── ecosystem.config.cjs               # PM2 config
├── deno.json                          # Deno tasks (dev/build/start/prisma:*)
├── package.json                       # npm deps (for Deno npm: compat)
└── .env.example                       # Environment variable template
```

---

## Product modules

### 1) App Shell (`components/layout/AppShell.tsx`)

- Mode routing: `'rework'` → NodeGraph; others → Canvas ± Timeline
- Resizable panels (explorer, inspector, timeline) via drag handles
- Keyboard shortcuts: Cmd+1/2/3 (panels), Cmd+, (settings)
- `useSettingsSync()` for cross-device settings

### 2) Explorer (`components/layout/ExplorerPanel.tsx`)

- **Local tab**: in-memory file tree from `fileStore`; drag assets to canvas
- **Cloud tab**: DB asset grid via `useAssetLibrary`; drag or double-click to add to canvas
- Filter bar searches both tabs
- Upload button (browser file picker → `fileStore.importFiles`)

### 3) Canvas (`components/layout/Canvas.tsx`)

- Infinite pan/zoom with zoom-to-cursor on wheel
- Item selection (click, Shift+click, Cmd+A)
- 8 resize handles (NW/N/NE/E/SE/S/SW/W) — direction-aware math per handle
- Rotate CCW/CW 15° per click
- Undo/redo (Cmd+Z / Cmd+Shift+Z) via `canvasStore.undo()` / `.redo()`
- Export PNG (offscreen canvas renders all items sorted by z-index)
- Grid toggle, keyboard shortcuts (Delete, Escape, G)

### 4) Node Graph (`components/layout/NodeGraph.tsx`)

- 7 node types with typed ports: Prompt, Negative, Generator, Image Input, Transform, Blend, Output
- Drag to move nodes, click port → click port to connect
- Click a bezier connection to remove it
- Viewport: alt+drag / middle-click pan, Ctrl+wheel zoom
- Execute: topological sort → run each node → add outputs to canvasStore
- Save/Load workflow JSON (download / upload)

### 5) Inspector (`components/layout/InspectorPanel.tsx`)

- **Generate Image**: prompt, negative prompt, W×H, Generate button; Cloud icon if authenticated
- **Prompt Templates**: load from `/api/prompts/templates`, "Use" populates prompt
- **API Settings**: API key input (per-session, synced to settingsStore)
- **Selected Item**: position, size, rotation, cloud asset ID, prompt
- **Version History**: list from DB, restore to any version (reload page after restore)
- **Recent Generations**: job thumbnails with status dots

### 6) Project sync (`hooks/useProjectSync.ts`)

- `loadProjectFromDb(id)`: fetch project + canvas from DB → populate canvasStore + projectStore
- `syncCanvas()`: PUT current canvas items to DB
- `saveVersion(trigger)`: syncCanvas first, then POST to versions API
- Auto-save: `setInterval(syncCanvas, 30_000)` when authenticated and project open

### 7) Connection status (`components/ui/ConnectionStatus.tsx`)

- Polls `/api/health` + `useSession` every 30 s
- States: pending (orange) → connected (green) | unauthenticated (teal) | denied (red)
- Unauthenticated: `UserCircle2` icon → click opens `AuthModal`
- Authenticated: avatar → click opens account panel (stats, last 3 devices, sign out)

### 8) Auth modal (`components/ui/AuthModal.tsx`)

- Login tab: email + password → `signIn('credentials')` + Google/GitHub OAuth buttons
- Register tab: name + email + password → POST `/api/auth/register` → auto sign-in

### 9) Providers & Jobs

- `pages/api/generate.ts`: direct Google Imagen generation; saves Asset + GenerationJob to DB if authenticated
- `pages/api/jobs/[id]/stream.ts`: SSE — polls DB every 1.5 s, heartbeat every 20 s
- Redis job queue exists but not used by current generation path (no worker daemon)

---

## Naming conventions

- **React components**: `PascalCase.tsx`
- **Hooks**: `useThing.ts`
- **CSS Modules**: `Component.module.css`
- **Stores**: `thingStore.ts`
- **API routes**: REST style under `pages/api/`

---

## Documentation

| File | Purpose |
|---|---|
| `README.md` | What it is, how to run, feature list, keyboard shortcuts, roadmap |
| `Design.md` | UI/UX + CSS + interaction specs |
| `Prompt.md` | PRD + feature inventory + vision |
| `Structure.md` | File layout + module descriptions (this doc) |
