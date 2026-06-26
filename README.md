# Ars TechnicAI

> **Figma for AI assets** — generate, organize, and sync AI-generated images, videos, and productions across all your devices.

An offline-first creative production suite that works entirely in your browser. When a server is available it syncs your work across every device and OS you use; when it isn't, everything keeps working from local storage.

---

## Contents

- [What it is](#what-it-is)
- [Three modes of operation](#three-modes-of-operation)
- [Quick start](#quick-start)
- [Setup by platform](#setup-by-platform)
- [Configuration reference](#configuration-reference)
- [Connecting to the central server](#connecting-to-the-central-server)
- [Server setup (Linux)](#server-setup-linux)
- [Architecture](#architecture)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Roadmap](#roadmap)

---

## What it is

Ars TechnicAI is a desktop-quality creative tool delivered as a web app:

| Panel | What it does |
|---|---|
| **Canvas** | Infinite 2D canvas — place, resize, rotate, and layer AI-generated images freely |
| **Explorer** | Project-scoped file tree + asset library, drag assets directly to canvas |
| **Inspector** | Prompt authoring, provider/model selector, generation history, version restore |
| **Node Graph** | ComfyUI-style workflow editor (Rework mode) — chain prompts, transforms, blends |
| **Timeline** | Multi-track sequencing for video and comic productions |

All state is saved to `localStorage` first, then synced to the server in the background. If the server goes away, you keep working. When it comes back your changes upload automatically.

---

## Three modes of operation

### 🔌 Mode 1 — Offline / standalone

No database, no Redis, no account needed. Everything lives in your browser.

- Projects and canvas state persist in `localStorage`
- AI generation works directly from your browser using provider API keys (Google Imagen, OpenAI DALL·E, Stability, Fal, Replicate)
- Generated images are embedded as base64 in the canvas so they survive offline restarts
- Cross-device sync is not available in this mode

**Best for:** quick local prototyping, no server setup required.

### 🖥️ Mode 2 — Local full stack

Run the full stack on a single machine (Mac, Windows, or Linux). PostgreSQL stores your projects and assets. Redis caches sessions.

- All Mode 1 features, plus
- Account with email/password, Google, or GitHub auth
- Project versioning with named snapshots (restore any point in history)
- Asset library persisted to disk and database
- Multi-project dashboard with thumbnails

**Best for:** power users who want version history and a richer asset library.

### ☁️ Mode 3 — Connected to the central Linux server

Point the app at the shared Linux server. One account, all projects and assets available on every device.

- All Mode 2 features, plus
- Cross-device canvas sync — open a project on your Mac, continue on Windows
- Shared asset library across all sessions
- Offline queue — actions taken while the server is down are replayed on reconnect
- Health banner shows server status at a glance

**Best for:** multi-device workflows — the primary use case of the project.

---

## Quick start

> **Recommended runtime: [Deno 2](https://deno.land)** — single binary, works on macOS, Windows, and Linux without Node.js. npm also works if you prefer.

### With Deno 2

```bash
# 1 — Install Deno 2 (skip if already installed)
#   macOS / Linux:
curl -fsSL https://deno.land/install.sh | sh
#   Windows (PowerShell):
irm https://deno.land/install.ps1 | iex

# 2 — Clone the repo
git clone https://github.com/JetSetVideo/ArsTechnicAI.git
cd ArsTechnicAI

# 3 — Install dependencies and patch Next.js for Deno compatibility
deno task install

# 4 — Configure environment
cp .env.example .env.local
# Minimum edit: set NEXTAUTH_URL and NEXTAUTH_SECRET (see below)

# 5 — Start
deno task dev
# Open http://localhost:3002
```

### With npm / Node.js

```bash
npm install
npx prisma generate
cp .env.example .env.local
npm run dev
```

---

## Setup by platform

### macOS (M1 / M2 / Intel)

```bash
# Install Deno 2
curl -fsSL https://deno.land/install.sh | sh
# Add to shell (follow the installer output, or add manually):
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.zshrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Clone and install
git clone https://github.com/JetSetVideo/ArsTechnicAI.git
cd ArsTechnicAI
deno task install
cp .env.example .env.local
```

Edit `.env.local` for **offline / standalone** use (no server needed):

```env
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
```

For **Mode 3** (sync to the Linux server on LAN):

```env
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=<same secret as the server's .env.local>
DATABASE_URL=postgresql://arstechnicai:<password>@192.168.1.55:5432/arstechnicai
REDIS_URL=redis://192.168.1.55:6379
ENCRYPTION_KEY=<same key as the server's .env.local>
```

```bash
deno task dev   # open http://localhost:3002
```

### Windows

```powershell
# Install Deno 2 (PowerShell, no admin needed)
irm https://deno.land/install.ps1 | iex

# Clone and run
git clone https://github.com/JetSetVideo/ArsTechnicAI.git
cd ArsTechnicAI
deno task install
copy .env.example .env.local
# Edit .env.local with Notepad or VS Code
deno task dev
```

> If Windows Defender flags Deno, add an exclusion for `%USERPROFILE%\.deno\bin\deno.exe`.
>
> WSL2 users: use the Linux instructions inside the WSL terminal.

### Linux (Ubuntu / Debian)

```bash
# Install Deno 2
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

git clone https://github.com/JetSetVideo/ArsTechnicAI.git
cd ArsTechnicAI
deno task install
cp .env.example .env.local
deno task dev
```

For production deployment, see [Server setup (Linux)](#server-setup-linux).

---

## Configuration reference

Copy `.env.example` to `.env.local`. Values marked **required** must be set.

| Variable | Mode | Description |
|---|---|---|
| **`NEXTAUTH_URL`** | All | Full URL where the app runs, e.g. `http://localhost:3002`. Must match what you type in the browser. |
| **`NEXTAUTH_SECRET`** | All | Random secret — `openssl rand -base64 32`. All machines sharing a DB must use the same value. |
| `DATABASE_URL` | 2 / 3 | PostgreSQL URL. Omit for offline mode (app still loads, auth will fail gracefully). |
| `REDIS_URL` | 2 / 3 | Redis URL. Defaults to `redis://localhost:6379`. |
| `ENCRYPTION_KEY` | 2 / 3 | 32-byte hex key — `openssl rand -hex 32`. Same across all machines sharing a DB. |
| `GOOGLE_IMAGEN_API_KEY` | Optional | Google Imagen key. Can also be entered in the app's **Settings → API Keys** panel. |
| `OPENAI_API_KEY` | Optional | OpenAI DALL·E key. |
| `REPLICATE_API_TOKEN` | Optional | Replicate key. |
| `FAL_KEY` | Optional | Fal.ai key. |
| `STABILITY_API_KEY` | Optional | Stability AI key. |
| `UPLOAD_DIR` | 2 / 3 | Absolute path for uploaded files. Defaults to `./storage/uploads`. |
| `NODE_ENV` | — | `development` for dev, `production` for built deployments. |

### Minimal `.env.local` for offline / Mode 1

```env
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=replace_me_with_openssl_rand_base64_32
```

Add AI provider API keys in the app's **Settings → API Keys** panel after opening.

---

## Connecting to the central server

The Linux server at `192.168.1.55` runs PostgreSQL, Redis, and the production Next.js app via PM2.

To use it from another machine on the same LAN:

1. Set these in your local `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=<copy from server's .env.local>
DATABASE_URL=postgresql://arstechnicai:<password>@192.168.1.55:5432/arstechnicai
REDIS_URL=redis://192.168.1.55:6379
ENCRYPTION_KEY=<copy from server's .env.local>
```

2. `deno task dev` on your local machine.

Your local dev server connects to the remote PostgreSQL and Redis. All projects and assets become available. Generated images are embedded as base64 in the DB so every device sees them without needing access to the Linux filesystem.

**When the server is unreachable:** The health banner turns red, canvas saves are buffered in `localStorage`, and the offline queue replays them the next time the server is reachable.

---

## Server setup (Linux)

### Prerequisites

- Ubuntu 22.04 or 24.04
- Deno 2 (see Quick start above)
- PostgreSQL 16: `sudo apt install postgresql-16`
- Redis 7: `sudo apt install redis-server`
- PM2: `npm install -g pm2` (or `deno install -g npm:pm2`)
- Nginx (optional, for HTTPS and a custom domain)

### Database and extensions

```bash
sudo -u postgres psql <<'SQL'
CREATE USER arstechnicai WITH PASSWORD 'your_strong_password';
CREATE DATABASE arstechnicai OWNER arstechnicai;
GRANT ALL PRIVILEGES ON DATABASE arstechnicai TO arstechnicai;
SQL

# pgvector extension (required for semantic search)
sudo apt install postgresql-16-pgvector
sudo -u postgres psql -d arstechnicai <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
```

### Application

```bash
git clone https://github.com/JetSetVideo/ArsTechnicAI.git ~/ArsTechnicAI
cd ~/ArsTechnicAI
deno task install
cp .env.example .env.local
# Edit .env.local — fill in DATABASE_URL, NEXTAUTH_URL (your domain or server IP),
# NEXTAUTH_SECRET, ENCRYPTION_KEY, and AI provider keys
deno task setup:db   # push schema to PostgreSQL
deno task build      # production build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # enable auto-start on reboot
```

### Nginx reverse proxy

```nginx
# /etc/nginx/sites-available/arstechnicai
server {
    listen 80;
    server_name your.domain.com;  # or the server IP

    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/arstechnicai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# HTTPS (recommended):
sudo certbot --nginx -d your.domain.com
```

### Deploying updates

```bash
cd ~/ArsTechnicAI
git pull
deno task build
pm2 restart arstechnicai
```

---

## Architecture

```
Browser (any OS)
├── React / Next.js 14 pages
│   ├── /home            Dashboard — project grid, asset library
│   └── /project/[id]    Editor — canvas, node graph, timeline
│
├── Zustand stores (localStorage-persisted, work offline)
│   ├── projectsStore    project list + metadata
│   ├── canvasStore      items, viewport, undo history (50 steps)
│   ├── fileStore        file tree, asset metadata
│   └── settingsStore    theme, AI provider, API keys
│
└── Offline queue (lib/sync/offlineQueue.ts)
    Buffers canvas saves + project updates in localStorage
    Flushes automatically on reconnect (useSyncOnReconnect hook)

Next.js API routes (Deno 2 runtime in production)
├── /api/health           DB + Redis status
├── /api/generate         AI image generation (all providers)
├── /api/projects/*       CRUD, canvas, versions
├── /api/assets/*         Upload, search, thumbnails
├── /api/workspace/*      Disk-based project load/save/scan
└── /api/auth/*           NextAuth JWT + OAuth callbacks

Data layer (optional — only needed for Modes 2 and 3)
├── PostgreSQL 16          projects, canvas items, assets, versions, users
├── Redis 7               session cache, job queue
└── Filesystem            uploaded/generated files in /storage
```

### How offline sync works

1. **Images embedded as base64.** Every AI-generated image returns a `dataUrl` (base64 PNG/JPEG). This is stored directly in the canvas item — in `localStorage` *and* in the database. Opening a project on a new device downloads the canvas from the DB and all images render immediately, no file server needed.

2. **Three-tier load order.** `loadProjectWorkspaceState` tries: (1) `localStorage` for instant load, (2) local disk cache via `/api/workspace/load`, (3) the database for cross-device access.

3. **Offline queue.** When the server is unreachable, canvas saves and project updates are buffered in `localStorage` under the key `ars:offline-queue`. The `useSyncOnReconnect` hook watches the server health status and flushes the queue as soon as the server becomes reachable again.

4. **Uploaded files.** Files uploaded while offline are queued and uploaded when connectivity returns. Generated images are always embedded, so they never depend on the file server.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + S` | Save version snapshot |
| `Cmd/Ctrl + 1` | Toggle Explorer panel |
| `Cmd/Ctrl + 2` | Toggle Timeline panel |
| `Cmd/Ctrl + 3` | Toggle Inspector panel |
| `Cmd/Ctrl + ,` | Open Settings |
| `Delete / Backspace` | Delete selected canvas items |
| `Escape` | Deselect all |
| `G` | Toggle grid |
| Scroll | Zoom in / out (on canvas) |
| `Space + drag` | Pan canvas |

---

## Roadmap

### Done
- [x] Infinite canvas — free-form placement, resize, rotate, z-order, undo/redo
- [x] ComfyUI-style node graph (Rework mode)
- [x] Multi-track timeline (basic)
- [x] Google Imagen, DALL·E, Stability AI, Fal, Replicate providers
- [x] Offline-first — localStorage-persisted stores
- [x] Offline queue — buffers actions, flushes on reconnect
- [x] Three-tier workspace load (localStorage → disk → DB)
- [x] NextAuth — email/password + Google/GitHub OAuth
- [x] Project versioning with named snapshots and point-in-time restore
- [x] Cross-device canvas sync — images embedded as base64 in DB
- [x] Health banner + automatic reconnect detection
- [x] Deno 2 as primary runtime
- [x] **Phase 0: Foundations** — Module registry (81 stubs), typed ports, format profiles, project bundles, blueprint store, Prisma schema extensions

### In progress
- [ ] **Phase 1: Read Everything** — Universal file import with metadata extraction for all media types
- [ ] **Phase 2: Image Edit Modules** — Non-destructive image editing pipeline
- [ ] **Phase 3: Video Engine** — ffmpeg.wasm + fluent-ffmpeg, real timeline playback
- [ ] **Phase 4: Audio Engine** — TTS, music, multi-track mixing
- [ ] **Phase 5: 3D + Gaussian Splat** — Three.js viewport, camera animation
- [ ] **Phase 6: Intelligence Modules** — Storyboards, character consistency, auto-tag
- [ ] **Phase 7: Blueprints + Agents** — Reusable pipelines, autonomous agents
- [ ] **Phase 8: Automations + Social Posting** — Hands-free creation and posting

### Planned
- [ ] Real-time multi-user collaboration (WebSocket / Liveblocks)
- [ ] Asset CDN — serve uploaded files from S3 or Cloudflare R2
- [ ] Team workspaces with role-based access
- [ ] Plugin API for custom AI providers
- [ ] Mobile / tablet touch support

---

## License

MIT — see `LICENSE`.
