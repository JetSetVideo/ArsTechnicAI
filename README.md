# Ars TechnicAI

A **desktop-grade, browser-delivered creative production suite** for authoring **prompts, images, videos, comics, and AI-assisted pipelines** — with a file-manager-class **Explorer**, a **ComfyUI-style node graph**, an **infinite free-form canvas**, and a **multi-track timeline**.

---

## What Ars TechnicAI is

An **AI production IDE** that treats media creation as a **graph + timeline problem**:

- **Explorer (left)**: Local file tree + Cloud asset library (generated images synced to your account). Search/filter across both tabs. Drag assets directly onto the canvas.
- **Canvas (center)**: Infinite pan/zoom 2D canvas with free-form image placement, 8-handle resize, rotation, undo/redo (50 steps), snap-to-grid, and PNG export.
- **Node Graph (Rework mode)**: ComfyUI-inspired workflow editor — Prompt, Negative, Generator, Image-In, Transform, Blend, and Output nodes connected with bezier edges. Executes the graph and adds results to the canvas.
- **Inspector (right)**: Prompt authoring, API key, Selected Item properties, Version History (restore any snapshot), Prompt Templates library, Recent Generations.
- **Timeline (bottom)**: Multi-track sequencing (toggleable).
- **Top Bar**: Mode switcher (Create / Rework / Video / Comic / 3D), project controls (New / Open / Save / Recent), user account.

---

## Implemented features

### Account & auth
- NextAuth 4 JWT: credentials (email + password) + Google/GitHub OAuth
- In-app auth modal — Login and Register tabs, no page redirect
- Account panel (avatar, stats, device list, session list, sign out)
- Device fingerprinting (SHA-256 hash) + geo lookup (ip-api.com, server-side)
- `UserDevice` + `UserSession` tracked per login
- Session duration recorded on sign-out

### Project & versioning
- DB-backed projects (Prisma PostgreSQL)
- Auto-save canvas state on dirty + every 30 s when logged in
- Project versioning: snapshot on Generate, manual Save (Cmd+S), Delete, and Restore
- Version list in Inspector with one-click restore

### Canvas
- Infinite pan + zoom (Ctrl+Wheel zooms to cursor)
- Free-form image placement with drag-and-drop
- 8 resize handles (NW/N/NE/E/SE/S/SW/W) — fully functional
- Rotation (CCW / CW in 15° steps)
- Undo/redo stack (Cmd+Z / Cmd+Shift+Z, 50 steps)
- Export canvas to PNG (offscreen render)
- Grid toggle, zoom controls

### Node graph (Rework mode)
- 7 node types: Prompt, Negative Prompt, Generator, Image Input, Transform, Blend, Output
- Drag nodes, click ports to connect, click connections to remove
- Bezier SVG connections
- Viewport pan (alt+drag / middle-click) + zoom (Ctrl+wheel)
- Execute workflow → topological sort → run nodes → add output to canvas
- Save/Load workflow JSON

### Explorer
- **Local tab**: file tree, folder expand/collapse, drag assets to canvas
- **Cloud tab**: 2-column asset grid pulled from DB, drag-to-canvas or double-click-to-add, thumbnail previews

### Inspector
- Image generation via Google Imagen (direct, no worker needed)
- Authenticated users: assets saved to DB automatically
- Version History section (loads from DB, restore button)
- Prompt Templates section (loads from DB, "Use" populates prompt)
- Recent Generations job list with thumbnails

### Settings & sync
- Settings DB sync: loads from DB on login, debounced PUT on change
- Settings override: DB wins for display prefs, local wins for API key
- Cross-device settings via UserSettings model

### Connection status
- 4 states: **pending** (orange), **connected** (green), **denied** (red — server error), **unauthenticated** (teal — server OK, not logged in)
- Unauthenticated is NOT shown as an error

### API
- `GET/PATCH /api/users/me` — user profile + stats + devices + sessions
- `GET/DELETE/PATCH /api/users/me/devices/[id]` — device management
- `GET/POST /api/projects/[id]/versions` — version list + create snapshot
- `POST /api/projects/[id]/versions/[id]/restore` — restore version
- `GET /api/assets` — paginated asset library
- `GET text/event-stream /api/jobs/[id]/stream` — SSE job status
- `POST /api/generate` — direct generation (Google Imagen), saves Asset to DB if authenticated

---

## Tech stack

| Layer | Tech |
|---|---|
| Runtime | Deno 2 |
| Framework | Next.js 14 (Pages Router) |
| Language | TypeScript (strict) |
| UI | React 18 + CSS Modules + CSS Variables |
| State | Zustand (canvas, file, settings, generation, project, node stores) |
| Database | PostgreSQL + pgvector + Prisma ORM |
| Auth | NextAuth 4 (JWT, credentials + Google/GitHub) |
| Cache/Queue | Redis (ioredis) — queue not yet used for generation |
| AI | Google Imagen (via REST) |
| Reverse proxy | Nginx → :3002 |

---

## Getting started

### Prerequisites

- Deno 2 (`deno -V`)
- PostgreSQL running
- Redis running (optional for current generation path)
- Google AI Studio API key for image generation

### Setup

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, GOOGLE_GENERATIVE_AI_API_KEY
deno task install
deno task prisma:push   # create/sync DB schema
deno task prisma:seed   # optional: seed admin user + sample data
deno task dev           # dev server on :3002
```

### Production

```bash
deno task build
deno task start
# Or use PM2:
pm2 start ecosystem.config.cjs
```

### Database migration (optional)

If you use PostgreSQL (DATABASE_URL set), run migrations to create telemetry tables:

```bash
npx prisma migrate dev --name add_telemetry
```

This creates `TelemetrySnapshot` and `TelemetryErrorEvent` tables for telemetry sync.

---

## Environment variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/arstechnicai

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-here

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# AI providers
GOOGLE_GENERATIVE_AI_API_KEY=   # or pass per-request from client
```

### Startup connection to home server

At startup, the app tries to connect to your **home server** (configured via `BACKEND_URL`, e.g. your desktop hosting PostgreSQL). If `BACKEND_URL` is not configured, it will try to connect directly to the local PostgreSQL database using Prisma. A **connection banner** appears at the top:

- **Green**: All services connected (Backend API, PostgreSQL). Ephemeral—auto-dismisses after a few seconds.
- **Orange**: Degraded (partial connectivity).
- **Red**: Cannot reach the home server or local database. Use the X button to dismiss.

Configure `BACKEND_URL` in `.env.local` to point to your home server (e.g. `http://192.168.1.100:8000` or `http://your-desktop.local:8000`).

The app runs locally and accesses **local assets** via the Explorer panel—you can import files from your machine and store project data in the browser. Backend/PostgreSQL connectivity is optional for generation and persistence on your home server.

### Telemetry & Client Signature

At startup, the app **gathers** device, session, usage, paths, logs, and settings data; **digests** it into derived metrics (device tier, connectivity tier); and **stores** snapshots locally. Errors are persisted in the error store. When telemetry sync is enabled (Settings > About), snapshots and error events are sent to the backend.

A **client signature** (e.g. `v1.0.0-a3f2c1`) uniquely identifies your version + environment for bug/performance tracking. It is computed offline and shown in Settings > About. You can copy it when reporting bugs.

### Plug frontend to local backend + PostgreSQL (Ubuntu)

You can run the UI in this repo and delegate generation requests to your own backend (for example Python/FastAPI + PostgreSQL) on the same machine.

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Enable backend delegation in `.env.local`:

```bash
BACKEND_GENERATION_ENABLED=true
BACKEND_URL=http://localhost:8000
BACKEND_GENERATION_PATH=/api/v1/generate
```

3. Start PostgreSQL locally (Docker example):

```bash
docker run --name arstechnicai-postgres \
  -e POSTGRES_USER=ars \
  -e POSTGRES_PASSWORD=ars_pass \
  -e POSTGRES_DB=ars_technicai \
  -p 5432:5432 -d postgres:16
```

4. Start your backend on Ubuntu (example URL `http://localhost:8000`) and point it to PostgreSQL:

```bash
export DATABASE_URL="postgresql://ars:ars_pass@localhost:5432/ars_technicai"
# then run your backend server (uvicorn, gunicorn, etc.)
```

5. Run this frontend:

```bash
npm run dev
```

When enabled, `POST /api/generate` in this frontend will try your backend first and only fall back to direct provider calls if possible.

Backend response contract (minimum):

```json
{
  "dataUrl": "data:image/png;base64,...",
  "imageUrl": "https://optional-hosted-image",
  "seed": 12345,
  "modelUsed": "optional-model-name"
}
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Cmd/Ctrl+S | Save project |
| Cmd/Ctrl+1 | Toggle Explorer |
| Cmd/Ctrl+2 | Toggle Timeline |
| Cmd/Ctrl+3 | Toggle Inspector |
| Cmd/Ctrl+, | Open Settings |
| Delete / Backspace | Delete selected canvas items |
| Escape | Deselect |
| G | Toggle grid |
| Scroll | Zoom (on canvas) |
| Space+drag | Pan canvas |

---

## Roadmap

- [x] App shell with resizable panels
- [x] NextAuth with device tracking + geo
- [x] Project + asset DB persistence
- [x] Project versioning with restore
- [x] Google Imagen generation (direct)
- [x] Canvas undo/redo + resize handles + export PNG
- [x] ComfyUI-style node graph (Rework mode)
- [x] Cloud asset library in Explorer
- [x] Version history + prompt templates in Inspector
- [x] SSE job streaming endpoint
- [x] Settings cross-device sync
- [ ] Video timeline editing
- [ ] Comic panel layout
- [ ] More AI providers (Midjourney, Higgsfield, etc.)
- [ ] Collaborative multi-user projects
- [ ] Worker daemon for queued jobs
- [ ] 3D scene mode

---

## License

MIT — see `LICENSE`.
