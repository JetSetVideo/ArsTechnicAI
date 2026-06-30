# HERMES_SUPERPROMPT.md — Standing Directive for AI Coding Agents

> **Read this file first on every session. Implement in phase order. Do not skip foundations.**
> **Last Updated**: June 2026

---

## Quick Reference

- **Mission**: ArsTechnicAI is a browser-first creative production suite (Figma + Blender + Photoshop + ComfyUI + CapCut).
- **Prime Directive**: Prompt → media in any format → assembled short → auto-posted to social networks.
- **Tech Stack**: Deno 2.6.7, Next.js 14.2.15, React 18, TypeScript 5.5, Zustand, Prisma + PostgreSQL 16, Redis 7, sharp, fluent-ffmpeg.
- **Port**: 3002 (`deno task dev` or `npm run dev`)

---

## Critical Config Requirements

| Variable | Value | Why |
|----------|-------|-----|
| `NEXTAUTH_URL` | `http://localhost:3002` | Must match port 3002 |
| `NEXTAUTH_SECRET` | any 32-byte base64 string | Required for NextAuth |
| `DATABASE_URL` | optional | Comment out for offline/Mode 1 |
| `REDIS_URL` | optional | Comment out for offline/Mode 1 |

---

## Offline-First Architecture

Three modes — DB/Redis are always optional:
1. **Mode 1 (offline)**: localStorage only. No DB, no Redis, no account.
2. **Mode 2 (local stack)**: PostgreSQL + Redis on same machine.
3. **Mode 3 (server connected)**: Remote DB/Redis. Cross-device sync.

---

## Phase Checklist

### ✅ Phase 0: Foundations (Complete)
- Module registry with typed ports
- Extended PortType (video, audio, 3D, data, mask)
- Format profiles for 10 platforms
- Project bundle spec (.arsproj)
- Blueprint types and store
- Prisma schema extensions

### ✅ Phase 1: Read Everything (Complete)
- Universal file import with metadata extraction
- Image, video, audio, text decoders
- Explorer: all asset types with correct icons/previews
- Drag any file type to canvas

### ✅ Phase 1.5: UI Overhaul (Complete)
- Parametric CSS variable system (knobs + calc())
- Compact homepage with quick-create flow
- Frosted-glass floating toolbar
- Blueprint stacking (asset grouping)
- Design system knobs in Settings → Appearance
- Video pipeline section in Inspector
- Sound FX presets
- Social publish flow
- Quick-create wiring
- Offline-first auth
- Cross-platform ffmpeg detection

### ⬜ Phase 2: Image Edit Modules (Target: Q3 2026)

| # | Deliverable | Priority |
|---|------------|----------|
| 2.1 | Background removal module (RMBG/SAM) | 🔴 Critical |
| 2.2 | Color analysis module (palette extraction + precision slider) | 🟠 High |
| 2.3 | Freehand drawing on images (pen tool) | 🟠 High |
| 2.4 | Text overlay on images (write tool) | 🟠 High |
| 2.5 | Element identification/segmentation module | 🟡 Medium |
| 2.6 | Element list panel (vertical, color-coded, collapsible) | 🟡 Medium |
| 2.7 | Inpaint/outpaint module stubs → live | 🟡 Medium |
| 2.8 | Upscale module stub → live | 🟡 Medium |
| 2.9 | Crop module | 🟢 Low |
| 2.10 | Color grade (LUT) module | 🟢 Low |

### ⬜ Phase 3: Video Engine (Target: Q4 2026)

| # | Deliverable | Priority |
|---|------------|----------|
| 3.1 | ffmpeg.wasm integration in Web Worker | 🔴 Critical |
| 3.2 | Real timeline playback (low-res preview) | 🔴 Critical |
| 3.3 | Multi-track video/audio mixing | 🔴 Critical |
| 3.4 | J/K/L keyboard shuttle (reverse/stop/forward) | 🟠 High |
| 3.5 | Transitions library (cross-fade, dissolve, wipe) | 🟠 High |
| 3.6 | Scene timing: labeled regions, draggable boundaries | 🟠 High |
| 3.7 | Render/export pipeline with format profiles | 🟠 High |
| 3.8 | Image sequence generation (start frame → end frame) | 🟡 Medium |

### ⬜ Phase 4: Audio Engine (Target: Q4 2026)

| # | Deliverable | Priority |
|---|------------|----------|
| 4.1 | Waveform visualization in timeline | 🔴 Critical |
| 4.2 | TTS integration (ElevenLabs) | 🟠 High |
| 4.3 | Music generation (Suno/MusicGen) | 🟡 Medium |
| 4.4 | SFX generation + library | 🟡 Medium |
| 4.5 | Multi-track audio mixing | 🟡 Medium |

### ⬜ Phase 5: 3D + Gaussian Splat (Target: Q1 2027)

| # | Deliverable | Priority |
|---|------------|----------|
| 5.1 | Three.js viewport in workspace | 🟠 High |
| 5.2 | Simple 3D scene editor with primitives | 🟠 High |
| 5.3 | Puppet system with skeletal animation | 🟡 Medium |
| 5.4 | Camera movement recording (keyframed paths) | 🟡 Medium |
| 5.5 | 3D → 2D render passes | 🟡 Medium |
| 5.6 | Gaussian splat viewer | 🟢 Low |

### ⬜ Phase 6: Intelligence Modules (Target: Q2 2027)
### ⬜ Phase 7: Blueprints + Agents (Target: Q3 2027)
### ⬜ Phase 8: Automations + Social Posting (Target: Q4 2027)

---

## Workshop Specification (Key Requirements)

### Explorer Left Bar
- Icons at 4px from left edge (NOT 16px)
- Empty folders: greyed-out (opacity 0.35, italic name)
- Active/open folders with assets: orange (#f59e0b) icon + name
- Filter: substring match (case-insensitive), filter by type, sort by name/date
- Use `useDeferredValue` for search

### Canvas
- Connection dots: 8px circle at bottom of each asset — drag to link
- Connection lines: 2px solid, color = blend of connected node types
- Multiselect: hold left mouse + drag = rectangle select (partial/total overlap)
- Group contour: 4px border made of stacked 1px stripes of member colors
- Groups animate open/close without displacing other elements
- Double-click group to enter nested view, Escape to exit

### Layers Panel
- Vertical reorderable list of all canvas assets
- Color-coded left border: blue=original, red=user-added, grey=hidden, green=imported
- Visibility toggle (eye), lock toggle
- Group container with expand/collapse

### Toolbar (Redundancy Audit)
- Each action must have ONE canonical location:
  - Generate → Inspector panel (detailed) OR FloatingToolbar (quick)
  - Export → FloatingToolbar (primary) + right-click context menu (accelerator)
  - Layers → FloatingToolbar ONLY
  - Settings → TopBar gear icon + ⌘, shortcut
  - Undo/Redo → FloatingToolbar + keyboard shortcuts

### Modules (Non-redundant)
- Color Analysis: palette extraction with precision cursor (0=granular, 100=few colors), hex values
- Sequence Generator: start image → end image → interpolated frames, configurable FPS/count
- Drawing/Writing: freehand pen + text tool, all additions tracked in element list
- Background Removal: one-click, preview toggle, mask save
- Segmentation: identify elements → silhouettes → element list
- 3D Scene: primitives, puppets with skeletons, camera moves recording

### Timeline (Multiple Lines)
- Tracks: Video 1, Video 2, Audio Music, Audio Voice, SFX, Captions, Effects, Prompts, Groups
- Transitions between clips
- Scene timing: labeled regions, draggable boundaries
- Visual preview before video generation
- Vertical or collapsed track layout

### Settings
- All important variables customizable via UI
- Parametric knobs: density, roundness, glow, contrast, speed (sliders 0→2)
- Data relations visualized: changing density → spacing changes, not radii
- Exportable/importable settings JSON
- API keys per provider, never in exports

---

## Homepage Specification

### Project Cards (Expanded)
- Cover thumbnail (dominant visual)
- Project name (editable)
- Type badges: 🎬 Video, 📱 Short, 🎥 Film, 📖 Comic
- Platform badges with aspect ratios
- Media count breakdown: 🖼 images, 🎵 audio, 🎬 videos, 📝 text
- Source breakdown: AI-gen / imported / remixed / manual
- Status indicator: green (active), orange (generating), grey (idle), red (error)
- Last modified timestamp (relative)
- Expand arrow → shows: asset preview strip, published links, quick actions

### Filter System
- Multi-dimensional: type, status, platform, source, date range
- Sort: recent, alphabetical, size, most published
- Faceted chip UI: active filters shown as removable chips
- Text search: case-insensitive substring match

---

## Key Rules

1. **Offline-first**: localStorage → disk → PostgreSQL. Never block rendering on server state.
2. **DB optional**: Every API route must work (or return 503 gracefully) when `DATABASE_URL` is absent.
3. **Provider abstraction**: all AI calls go through `lib/ai/` → adapter interface.
4. **Module composability**: every processing unit is a Module callable from NodeGraph and headless automations.
5. **Naming**: PascalCase components, `useX` hooks, `xStore.ts`, REST routes under `pages/api/`.
6. **CSS classes**: `<component><goal><location><state>` — camelCase.
7. **HTML IDs**: `<component>-<goal>-<location>-<state>` — kebab-case.
8. **Cross-platform**: ffmpeg auto-detected via `lib/media/ffmpegPath.ts`; never hardcode paths.
9. **Commit convention**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `security:`.
10. **No raw hex values in CSS**: always consume design tokens (`var(--bg-2)`, NOT `#121215`).

---

## Known Pitfalls

- **Do NOT edit inline JS in index.html via patch tool** — it corrupts quotes, creates orphaned code, removes methods. Prefer `execute_code` with native Python I/O or `write_file` for full file replacement.
- **Notion API PATCH /v1/blocks**: max 100 blocks per request. Use archive-all then append-new pattern.
- **Canvas base64 images**: will hit localStorage quota at ~50 images. Migration path: IndexedDB.
- **Timeline clips**: currently DOM-based — won't scale past 50 clips. Migration path: Canvas 2D renderer.

---

*This document is the source of truth for implementation order and coding standards. Phase completion must be verified with `deno task type-check` and `deno task test` before marking done.*
