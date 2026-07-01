# HERMES_SUPERPROMPT.md — Standing Directive for AI Coding Agents

> **Read this file first on every session. Implement in phase order. Do not skip foundations.**
> **Last Updated**: June 2026

---

## Quick Reference

- **Mission**: ArsTechnicAI is a browser-first creative production suite (Figma + Blender + Photoshop + ComfyUI + CapCut).
- **Prime Directive**: Script + Inspiration Assets → Prompt Authoring → Generated Media → Storyboard → Timeline Assembly → Auto-posted to social networks.
- **Author's Vision Pipeline**: The full creative arc from idea to publication:
  `Script → Character DB → World Building → Mood Board → Storyboard → Shot List → Prompt Engineering → Image/Video Generation → Audio → Assembly → Export → Publish`
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

## Author's Vision Pipeline (Core Concept)

The software is built around one central idea: **help the author go from raw vision to final deliverable**, bridging the gap between creative intent and AI generation.

### Pre-Production (The "From" side)
The author starts with **raw creative inputs**:
- **Script / Logline** — prose description of the story, formatted as screenplay or treatment
- **Manually Built Assets** — sketches, drawings, reference images created by the author directly
- **Externally Imported Assets** — photos, footage, music, sound effects, reference stills imported from the filesystem or URLs
- **Character Profiles** — name, appearance, wardrobe, voice, personality, lore (feeds into character-consistent generation)
- **World Building Notes** — locations, time-of-day, props, atmosphere, historical period
- **Mood Board** — grid of reference images + color palette per scene / chapter
- **Vocabulary Presets** — structured prompt vocab for cameras, lenses, lighting, composition, materials, FX

### Prompt Engineering (The "Bridge")
From the pre-production inputs, the author crafts **prompts**:
- **Prompt Templates** — reusable structures with named variables (`{subject}`, `{lighting}`, `{camera}`)
- **Vocab Library Injection** — append cinematography vocabulary to any prompt
- **Negative Prompts** — exclusion list to steer generation away from unwanted elements
- **Style Lock** — derived from the mood board and reference images (style transfer)
- **Shot Type Hints** — wide/medium/close-up/POV/Dutch angle, informed by the shot list

### Generation (The "To" side)
Prompts feed AI providers to produce:
- **Images** — hero shots, character renders, location establishes, prop sheets
- **Video Clips** — animated scenes, transitions, motion sequences
- **Audio** — dialogue (TTS with character voice profiles), music (MusicGen/Suno), SFX
- **Storyboard Panels** — ordered sequence of representative frames for each scene beat

### Assembly & Delivery
Generated assets are assembled into the final piece:
- **Canvas** — non-linear layout and pipeline blueprint
- **Timeline** — linear sequence: shots → scenes → chapters → full piece
- **Export** — format presets for each target platform
- **Publish** — direct API posting to social platforms

---

## Inspiration & Asset Collection Vocabulary

| Term | Definition |
|------|-----------|
| **Inspiration Asset** | Any reference material the author imports to guide generation (not a deliverable) |
| **Reference Board** | Ordered collection of inspiration assets with annotations |
| **Mood Board** | Color-keyed reference grid defining the visual atmosphere of a scene |
| **Style Reference** | A specific image whose visual style should be transferred to generated outputs |
| **Character Sheet** | A reference image showing a character from multiple angles / expressions |
| **Plate** | A static background render intended to receive composited foreground elements |
| **Animatic** | A rough sequence of storyboard panels with timing, used to pre-visualize a scene |
| **Shot Beat** | A single story moment described as: camera angle + character action + dialogue cue |
| **Logline** | A 1-2 sentence summary of the story (subject + conflict + goal) |
| **Treatment** | A prose description of the story structure, typically 1-3 pages |
| **Look Development** | The process of establishing a consistent visual style across all generated assets |
| **Color Script** | A sequence of color swatches per scene showing how mood shifts throughout the piece |

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

### Information Hierarchy (Most Important First)
1. **Header** — Brand logo + Global search + Account avatar (always visible, 44px)
2. **Projects Grid** — The user's primary content; must be above the fold by default
3. **Filter Bar** — Faceted multi-dimensional filter immediately above the grid
4. **Quick Create Hero** — Compact by default; expands on demand for full prompt controls

**Critical rule**: Do not bury projects under a full-height hero. The hero is a tool, not a landing page. Users returning to the dashboard want to see their projects first.

### Quick Create Hero (Compact Mode — Default)
A single-row "Quick Create" strip that stays compact:
```
[Platform chips] [Prompt textarea — flex: 1] [Generate button]
```
Advanced options (composition, lighting, camera, character creator, templates, modules) slide open below via a single "Advanced" chevron toggle. Default state = collapsed.

### Project Cards (Expanded)
- Cover thumbnail (dominant visual, full bleed)
- Project name (editable inline)
- Type badges: 🎬 Video, 📱 Short, 🎥 Film, 📖 Comic, 🎭 Storyboard, 📝 Script
- Platform badges with aspect ratios
- Media count breakdown: 🖼 images, 🎵 audio, 🎬 videos, 📝 text/scripts
- Source breakdown: AI-gen / imported / remixed / manual / sketched
- Pipeline phase indicator: pre-production / generation / assembly / published
- Status indicator: green (active), orange (generating), grey (idle), red (error)
- Last modified timestamp (relative)
- Expand arrow → shows: asset preview strip, published links, pipeline phase, quick actions

### Pipeline Visualizer (Hero Section)
Show the author where they are in the creative workflow:
```
Script → Mood Board → Prompts → Generate → Storyboard → Timeline → Publish
  ●───────────○───────────●──────────●──────────○───────────○──────────○
  (done)    (skipped)  (active)    (done)    (next)
```
Active phase is highlighted; completed phases are filled; pending are empty circles.

### Filter System
- Multi-dimensional: type, status, platform, source, date range
- Sort: recent, alphabetical, size, most published, pipeline phase
- Faceted chip UI: active filters shown as removable chips with × to clear
- Text search: case-insensitive substring match across name + tags + synopsis
- Filters must update results in real-time via `useDeferredValue`

---

## 20 Improvement Elements (Priority Roadmap)

The following 20 areas are identified as the highest-leverage improvements. Each element is described with its domain, why it matters, and the correct implementation approach.

### Category A — Creative Pipeline (Pre-Production)

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 1 | **Character Consistency System** | Pre-Production + Generation | Without face-locking, generating "the same character" requires manual prompt engineering every time. Character profiles must feed directly into image generation via IP-Adapter, LoRA embeddings, or face-swap post-processing. | Character DB → `character.character.json` per profile → injected as Layer 2 of Prompt Construction → `intelligence-character` module handles consistency enforcement |
| 2 | **Script Editor with AI Co-writer** | Pre-Production | The foundation of the Author's Vision Pipeline. A screenplay editor with slugline parsing (INT./EXT.), scene block extraction, and LLM-assisted dialogue/pacing. Each scene block should be highlightable to trigger shot list generation. | `script-editor` module, formatted Markdown with Fountain syntax support, LLM co-writer via `generate-prompt-assist` |
| 3 | **Storyboard Editor + Beat-to-Prompt Pipeline** | Pre-Production | Animatics allow directors to validate timing and shot coverage before spending generation budget. Each shot node must carry: camera angle, focal length, action description, dialogue cue, estimated duration. | `storyboard-editor` module on canvas; Shot nodes are typed CanvasItems; `script-to-shots` extracts from script; `storyboard-gen` AI module generates panel images |
| 4 | **Color Script Module** | Pre-Production | Color is the emotional throughline of any film. A per-scene mood swatch system shows how the palette arc shifts from opening to resolution, guiding consistent generation across the whole piece. | `color-script` module: array of `{sceneId, swatches: Hex[], emotion, lightingNotes}` per scene |

### Category B — UI + Discovery

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 5 | **Faceted Filter Bar** | Homepage | Basic text search is insufficient for a creative library. Professionals filter by type, status, platform, origin, and date simultaneously. | `HomepageFilters` TypeScript interface; filter chips in content bar; `filterProjects()` logic; `useDeferredValue` for responsiveness |
| 6 | **First-Run Onboarding + Empty States** | UX | Every empty panel is a missed opportunity to teach. A 3-step overlay on first use and consistent empty states throughout build user confidence. | `OnboardingOverlay` component: 3 steps ("Import or generate → Place on canvas → Export"); per-panel `EmptyState` component with icon + message + primary CTA |
| 19 | **Skeleton Loaders** | Performance / UX | Perceived performance is as important as actual performance. When the Explorer loads, when images generate, when the cloud grid fetches — show skeleton shapes, not blank space. | `SkeletonCard`, `SkeletonList`, `SkeletonGrid` components using CSS animation |

### Category C — Architecture & Code Quality

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 7 | **React Error Boundaries** | Reliability | If a canvas item render throws, the entire app crashes. Each panel (Canvas, Inspector, Explorer, Timeline, NodeGraph) needs its own error boundary with a graceful fallback. | `PanelErrorBoundary` class component wrapping each major panel; shows panel name + error message + "Reload panel" button |
| 8 | **Service Layer Extraction** | Architecture | Business logic in components and stores is untestable and unreusable. A `GenerationService`, `ExportService`, `ProjectService` class isolates business logic from React. | `lib/services/GenerationService.ts`, `lib/services/ProjectService.ts`, etc. — pure TS classes with no React imports |
| 9 | **Typed Event Bus** | Architecture | Components communicate only through shared stores. Cross-cutting events (sync complete, generation finished, error occurred) need a lightweight pub/sub layer. | `lib/events/bus.ts`: `createEventBus<EventMap>()` with typed emit/on/off; consumers register in `useEffect` cleanup |
| 10 | **Rate Limiting + CSRF** | Security | Without rate limiting on `/api/generate`, a bug or malicious actor can fire infinite generation requests. Each request costs real money. | `lib/middleware/rateLimit.ts` using Redis counters; CSRF token in `X-CSRF-Token` header for state-changing routes |
| 11 | **API Key Security Hardening** | Security | API keys currently travel in request bodies (visible in Network tab). Client should send provider name only; server resolves key from environment variables. | `pages/api/generate.ts` reads `process.env.GOOGLE_API_KEY` etc.; client sends `{provider: 'google-imagen'}` only |

### Category D — Performance & Storage

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 12 | **IndexedDB Asset Storage** | Performance | localStorage quota (5-10MB) fills after ~50 generated images at 512×512. Base64 is 33% larger than binary. Binary blobs must move to IndexedDB. | `lib/storage/indexedDB.ts`: `openDB('ars-assets', 1)` → object store `assetId → Blob`; localStorage retains metadata JSON only |
| 13 | **Virtualization Layer** | Performance | Explorer tree, Asset Grid, and Timeline all render every item as DOM nodes. At 2000 items, scrolling is unusable. | `react-window` `FixedSizeList` for Explorer (32px rows); `VariableSizeGrid` for Asset Grid; Canvas 2D renderer for Timeline clips |

### Category E — Data Model

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 14 | **Asset Relation Junction Table** | Data | Complex asset relationships (derived-from, used-in, variant-of) cannot be queried without a proper join table. The `parentAssetId` scalar only supports trees, not graphs. | `AssetRelation` Prisma model with `sourceId`, `targetId`, `relationType: RelationType` enum |
| 15 | **Soft Delete** | Data | Hard-delete makes recovery impossible and audit trails incomplete. Adding `deletedAt: DateTime?` to all major models enables trash/restore and preserves referential integrity. | Add `deletedAt DateTime?` to `Project`, `Asset`, `CanvasItem`, `GenerationJob`; all queries add `WHERE deletedAt IS NULL` |
| 16 | **Project Analytics Layer** | Data | Generation count, error rate, cost estimate, and time-spent are computed ad-hoc on the client. A pre-aggregated `ProjectAnalytics` table enables instant dashboard stats. | `ProjectAnalytics` Prisma model; updated via DB trigger or periodic cron |

### Category F — Media Engine

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 17 | **Timeline Playback Engine** | Video | A timeline that cannot play back is a storyboard, not an editor. This is the single biggest blocker for production use. | `ffmpeg.wasm` in a `Worker`; low-res preview via `createObjectURL(blob)`; J/K/L keyboard shuttle |

### Category G — Prompt & Generation

| # | Element | Domain | Why It Matters | Implementation Approach |
|---|---------|--------|---------------|------------------------|
| 18 | **Prompt Template Engine (Full)** | Generation | Templates with `{variable}` placeholders and typed constraints (string/number/enum/asset_reference) enable reusable, parameterized generation recipes. | `PromptTemplate` type: `{variables: Record<string, VarDef>, body: string, layers: PromptLayer[]}`; live preview renders resolved prompt |
| 20 | **Publishing Pipeline + Analytics** | Publish | The full lifecycle — draft → review → schedule → post → track performance — is not implemented beyond stub modules. Analytics (views, likes, shares) feed back into the dashboard. | `PublishJob` Prisma model with `status: draft|scheduled|posted|failed`; platform adapters (TikTok, IG, YouTube, X, LinkedIn); analytics polling cron |

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
