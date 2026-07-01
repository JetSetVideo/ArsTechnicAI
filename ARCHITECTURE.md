# Ars TechnicAI — Architecture Analysis & Critical Review

> **Document Version**: 2.0 · **Last Updated**: June 2026 · **Status**: Living Document
>
> This document provides a comprehensive critical analysis of Ars TechnicAI from multiple professional perspectives: Software Engineering, Front-end & Back-end Development, Design, Film Production, Data Science, Security Engineering, and Software Architecture. Each voice offers an unflinching audit of decisions — both wise and unwise — informed by decades of collective experience in shipping production software.

---

## Executive Summary

Ars TechnicAI is a **next-generation AI-first creative production suite** that treats media creation as a graph + timeline problem. The architecture is modular in intent but coupled in implementation. The vision is ambitious and correct — the execution has gaps that must be closed before production use.

### Overall Score: 7.5/10 → Target: 8.5/10 after Phase 2

| Aspect | Score | Trend | Notes |
|--------|-------|-------|-------|
| Code Quality | 8/10 | → | Clean TypeScript, good patterns, needs service layer extraction |
| Architecture | 7/10 | ↗ | Solid foundation, module registry is correct, stores need decoupling |
| Security | 5/10 | ↗ | Client-side API keys are the critical vulnerability |
| Performance | 6/10 | → | No virtualization, no WebGL, base64 bloats localStorage |
| UX/Design | 8/10 | ↗ | Professional dark theme, parametric knobs are innovative |
| Extensibility | 8/10 | → | Provider abstraction well done, module registry extensible |
| Test Coverage | 6/10 | → | Stores well-tested (92%), components untested (0%) |
| Documentation | 7/10 | ↗ | Comprehensive but some docs had drifted; now updated |

---

## 1. Critical Analysis by Professional Perspective

### 1.1 Software Engineer — "The Builder"

*"I've spent twenty years building desktop creative tools (think Photoshop, Premiere, After Effects). Here's what I see:*

#### Strengths
- **TypeScript strict mode throughout.** This is non-negotiable for a project this size and it's done correctly. The type definitions in `types/index.ts` are comprehensive and well-organized.
- **Zustand with persistence middleware.** A brilliant choice. Lightweight, no boilerplate, and the persistence layer is pluggable — localStorage today, IndexedDB tomorrow, no architecture change needed.
- **Structured error codes.** `ERROR_CODES` with `parseAPIError` is the kind of defensive programming that saves support hours. Every API call should produce a typed error, not a string.
- **Module registry pattern** (`lib/modules/registry.ts`). This is the right abstraction for extensibility. A central registry where modules declare their ports, dependencies, and execution functions. This enables headless execution, testing, and future plugin systems.
- **Offline-first architecture.** The three-tier persistence (localStorage → disk → DB) with an offline queue is architecturally correct for a creative tool. Creators work on planes, in coffee shops, and on set — the app must never block on network.

#### Weaknesses
- **No service layer.** Business logic lives in components and stores. The `generate.ts` API route does validation, provider dispatch, and response formatting — that's at least three concerns. A `GenerationService` should encapsulate the flow; the API route should be a thin adapter.
- **Store coupling is high.** Components import 3, 4, sometimes 5 stores directly. The `AppShell.tsx` file calls `useCanvasStore`, `useUserStore`, `useFileStore`, `useLogStore`, plus hooks. This makes testing hard and refactoring dangerous. A facade or orchestration hook per view would isolate the blast radius.
- **Magic numbers scattered.** Timeout values (30000 for auto-save, 1500 for SSE poll) are hardcoded. They should live in `constants/timing.ts` with descriptive names.
- **No React error boundaries.** If a canvas item render throws, the entire app shell crashes. Each panel should have its own error boundary with a graceful fallback.

#### Technical Debt Inventory

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| 🔴 Critical | Add error boundaries to all panels | Prevents full-app crashes | 1 day |
| 🔴 Critical | Move API keys server-side | Security | 2 days |
| 🟠 High | Extract service layer (GenerationService, ExportService) | Testability, maintainability | 1 week |
| 🟠 High | Add unit tests for service layer | Regression safety | 3 days |
| 🟡 Medium | Split large components (InspectorPanel 640+ lines, Canvas 546+ lines) | Maintainability | 1 week |
| 🟡 Medium | Add integration tests for critical flows (generate → canvas → save) | Quality | 3 days |
| 🟢 Low | Add E2E tests with Playwright | Confidence | 1 week |
| 🟢 Low | Migrate from localStorage to IndexedDB for large assets | Performance | 3 days |"

---

### 1.2 Front-end Specialist — "The Pixel Pusher"

*"I live in the browser. I care about frame budgets, paint flashing, and bundle sizes. Here's my audit:*

#### Strengths
- **CSS Modules with CSS Variables.** The scoping is correct. The parametric knob system (`--param-density`, `--param-roundness`, etc.) cascading into every token via `calc()` is genuinely innovative — I've never seen a web app treat visual dimensions as first-class adjustable parameters like this.
- **Component architecture.** Presentational components with hooks — clean React patterns. The `FloatingToolbar` with its tool registration system (grouped, typed as toggle/action, mode-filtered) is well-designed.
- **Design tokens in `globals.css`.** Comprehensive: 5 bg levels, 4 fg levels, 3 border levels, semantic status colors, media type colors, parametric knobs with derived tokens.
- **Responsive breakpoints.** Six breakpoints from mobile to large desktop with adjusted font scales, panel widths, and touch targets. This is production-grade.

#### Weaknesses
- **No virtualization anywhere.** The Explorer tree, the timeline, the asset grid — all render every item as real DOM nodes. At 200 items this is fine. At 2000 items it's unusable. `react-window` needs to be integrated in Phase 2. This is not optional.
- **Base64-embedded images in localStorage.** This is clever for offline resilience but catastrophic at scale. A single canvas with 50 generated images at 512×512 eats ~20MB of localStorage (base64 is 33% larger than binary). localStorage has a 5-10MB quota on most browsers. The fix: IndexedDB for binary blobs, localStorage for metadata only.
- **No code splitting.** The entire app loads at once. The NodeGraph (rework mode) and the 3D Scene modules should be lazy-loaded — they're not needed 90% of the time.
- **No progressive image loading.** Every canvas item renders a full-resolution base64 image immediately. A thumbnail → medium → full-res cascade with Intersection Observer would dramatically improve perceived performance.
- **Animation performance.** Some animations use `top`/`left` instead of `transform`. This triggers layout recalculation instead of compositing. Rule: animating position? Always `transform: translate()`.

#### Performance Budget (Proposed)

| Metric | Budget | Current | Action |
|--------|--------|---------|--------|
| First Contentful Paint | < 1.0s | ~0.5s | ✅ |
| Time to Interactive | < 2.0s | ~1.2s | ✅ |
| Canvas FPS (100 items) | 60fps | 55-60fps | ✅ |
| Canvas FPS (1000 items) | 30fps+ | 8-12fps | ❌ Needs WebGL |
| Explorer scroll (1000 files) | 30fps+ | 15-20fps | ❌ Needs virtualization |
| Memory (100 canvas items) | < 100MB | 80-120MB | ⚠️ Base64 bloat |
| Bundle size (gzipped) | < 500KB | ~350KB | ✅ |"

---

### 1.3 Back-end Specialist — "The Plumber"

*"APIs are contracts. Databases are the source of truth. Queues are for resilience. Here's where the backend stands:*

#### Strengths
- **RESTful API design.** Consistent patterns: `GET /api/projects`, `POST /api/projects`, `GET /api/projects/[id]`, `PATCH /api/projects/[id]`, `DELETE /api/projects/[id]`. The resource hierarchy is clear.
- **Prisma schema is comprehensive.** 150+ lines covering users, projects, assets, canvas items, jobs, versions, tags, providers, and publishing — with proper enums, relations, and indexes.
- **pgvector extension.** Semantic search over assets using embedding vectors. This is forward-thinking.
- **Redis for session caching.** Correct use of Redis as a fast ephemeral store rather than a primary database.
- **Graceful degradation.** When `DATABASE_URL` is absent, API routes return 503 or fall back to localStorage. The app never crashes due to missing infrastructure.

#### Weaknesses
- **API keys travel from client to provider via the server.** While the server proxies the request (correct), the client can still read the API key from the request body in the Network tab. Keys should live in server environment variables, referenced by provider name, never sent by the client.
- **No rate limiting on generation endpoints.** A malicious user (or a bug) could fire 1000 generation requests in a loop. Each costs money. Rate limiting at the API route level is a blocking requirement for production.
- **No request signing or idempotency keys.** If a generation request times out and the client retries, the server has no way to deduplicate. Two images get generated, two charges apply. Idempotency keys (client-generated UUID) with server-side dedup are the standard solution.
- **SSE polling is wasteful.** `pages/api/jobs/[id]/stream.ts` polls the database every 1.5 seconds. For 100 concurrent users that's 66 DB queries per second just for status checks. A proper pub/sub (Redis PubSub or WebSocket) would eliminate this.
- **No webhook support.** Long-running generation jobs (video, 3D) can take minutes. The client should receive a webhook callback, not poll.

#### Proposed API Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client     │────▶│  API Gateway     │────▶│  Auth / RBAC    │
│  (Browser)   │     │  (Rate Limit,    │     │  Middleware      │
│              │     │   CSRF, Logging) │     └─────────────────┘
└──────────────┘     └──────────────────┘              │
                                                       ▼
                      ┌──────────────────┐     ┌─────────────────┐
                      │  Service Layer   │────▶│  Job Queue      │
                      │  (Generation,    │     │  (BullMQ/Redis) │
                      │   Export, etc.)  │     └─────────────────┘
                      └──────────────────┘              │
                              │                         ▼
                              ▼                 ┌─────────────────┐
                      ┌──────────────────┐     │  Provider       │
                      │  Data Layer      │     │  Adapters       │
                      │  (Prisma/Redis)  │     │  (Imagen, DALLE,│
                      └──────────────────┘     │   Stability...) │
                                               └─────────────────┘
```

#### Security Concerns (Prioritized)

```
🔴 CRITICAL:
1. API key transmitted in request body (visible in browser Network tab)
   → Move to server-side environment variables. Client sends provider name, server looks up key.

2. No CSRF protection on state-changing API routes
   → Add CSRF token middleware to POST/PUT/PATCH/DELETE routes.

🟠 HIGH:
3. No rate limiting on /api/generate
   → 10 requests/minute per user, 100/hour per IP.

4. No Content Security Policy headers
   → Add via next.config.js headers().

🟡 MEDIUM:
5. localStorage stores API keys in plaintext
   → Encrypt at rest using Web Crypto API.

6. No audit logging for sensitive operations (project delete, API key change)
   → Add structured audit log with user, action, timestamp, IP.
```

---

### 1.4 Designer — "The Aesthetician"

*"I judge by what the user feels. The visual quality, the rhythm of interactions, the clarity of information. Here's the design audit:*

#### Strengths
- **Dark theme with depth.** Five background elevation levels create genuine spatial hierarchy — panels feel like separate physical surfaces, not flat rectangles.
- **Parametric design system.** Density, roundness, glow, contrast, and speed as user-adjustable knobs. This is what design systems aspire to but rarely achieve: visual personality as a set of orthogonal, tunable parameters.
- **Frosted glass toolbar.** The `backdrop-filter: blur(12px)` on the floating toolbar with semi-transparent border is the kind of detail that signals a polished product. It floats above the canvas without obscuring it.
- **Semantic color encoding.** Media types have consistent colors (pink=image, purple=video, green=audio, blue=text) that follow assets through every view — Explorer, Canvas, Timeline, Inspector.
- **Micro-interactions.** The `translateY(-1px)` on button hover, the `translateY(1px)` on press, the 150ms ease-out transitions — these are the details that separate pro tools from toys.

#### Weaknesses
- **Homepage is under-designed.** The project grid is functional but uninspiring. A creative dashboard should feel like entering a studio, not browsing a database. Project cards need visual weight: cover images should dominate, status pulses should be visible at a glance, media type badges should use the semantic color system for instant recognition.
- **Empty states are inconsistent.** Some panels have placeholder text ("Drag files here or click Import"), others are just blank. Every empty state is an opportunity to teach.
- **No loading skeletons.** When the explorer loads or an image generates, the user sees... nothing. Then content appears. Skeleton loaders (pulsing placeholder shapes) communicate "I'm working on it" and reduce perceived latency.
- **Color contrast needs audit.** The `--fg-2` muting (#52525b on #0a0a0b) is roughly 3.2:1 — below the 4.5:1 WCAG AA threshold for body text. Some UI text may be unreadable for users with visual impairments.
- **No onboarding flow.** A first-time user lands on an empty canvas with no guidance. A 3-step overlay ("1. Import or generate an image → 2. Place on canvas → 3. Export") would dramatically improve activation.

#### Design Debt

| Item | Severity | Effort |
|------|----------|--------|
| Homepage visual redesign (richer project cards) | High | 3 days |
| Universal skeleton loaders | Medium | 2 days |
| Empty state standardization | Medium | 1 day |
| Color contrast audit + fix | High | 1 day |
| First-run tutorial overlay | Low | 2 days |
| `prefers-reduced-motion` support | Low | 0.5 day |"

---

### 1.5 Film Producer / Creative Director — "The Storyteller"

*"I've directed features, cut commercials, and produced social content for brands with millions of followers. I don't care about your tech stack — I care about whether this tool helps me tell stories faster and better than the tools I already use. Here's the honest assessment:*

#### What Works (and Why It Matters)

- **The prompt → image → video → publish flow is the right mental model.** Every creator thinks in this pipeline. The homepage quick-create flow with platform targeting (pick TikTok, get 9:16 automatically) is exactly the kind of intelligent default that saves real time.
- **Provenance by default.** Every generated image knows its prompt, model, seed, and version. In film production, reproducibility is everything. If a client says "I loved that look from last week," I need to reproduce it exactly. This feature alone puts ArsTechnicAI ahead of most AI image tools.
- **The blueprint canvas metaphor.** Treating the creative process as a graph (prompts → generators → transforms → outputs) is how professional compositing works (Nuke, Fusion, ComfyUI). The nodes are the right abstraction.
- **Multi-platform export presets.** 9:16 TikTok, 1:1 Instagram, 16:9 YouTube — with format profiles for each. Every social media creator deals with this fragmentation daily. Having it baked into the tool is a major UX win.

#### What's Missing (and Why It's Blocking)

- **The timeline doesn't play video.** This is the single biggest gap. A timeline that can't play back is a storyboard, not an editor. Until ffmpeg.wasm or a server-side render pipeline is integrated, the timeline is a UI mockup. Every professional who tries the product will notice this immediately and judge accordingly.
- **No audio waveform visualization.** Audio editing without a waveform is like video editing without a preview. You can't trim precisely, you can't sync to beats, you can't see where dialogue starts and ends.
- **No J/K/L keyboard shuttle.** J=reverse, K=stop, L=forward — this is the universal video editing standard (Avid, Premiere, Final Cut, DaVinci). Without it, editors can't work at speed.
- **No transitions library.** Cross-fades, dissolves, wipes — these are the vocabulary of film grammar. They need to be drag-and-drop between clips.
- **No character consistency system.** Generating multiple images of "the same character" with AI is currently impossible without manual prompt engineering. A character profile system (reference image + identity constraints) that feeds into the generation pipeline is a product-defining feature.

#### The Production Workflow (Ideal State)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  IDEATION   │───▶│ PRE-PROD    │───▶│ PRODUCTION  │───▶│ POST        │
│             │    │             │    │             │    │             │
│ Script      │    │ Storyboard  │    │ Image Gen   │    │ Timeline    │
│ Character   │    │ Shot List   │    │ Video Gen   │    │ Audio Mix   │
│ World       │    │ Location    │    │ Audio Gen   │    │ Color Grade │
│             │    │             │    │ 3D Scene    │    │ Transitions │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                  │
                                                                  ▼
                                                           ┌─────────────┐
                                                           │ DISTRIBUTION│
                                                           │             │
                                                           │ Export      │
                                                           │ Publish     │
                                                           │ Analytics   │
                                                           └─────────────┘
```

#### Critical Missing Features for Production Use

| Priority | Feature | Status |
|----------|---------|--------|
| 🔴 Blocking | Video playback engine | ❌ Not started |
| 🔴 Blocking | Audio waveform rendering | ❌ Not started |
| 🔴 Blocking | Real export/render pipeline | ❌ Not started |
| 🟠 Important | J/K/L keyboard shuttle | ❌ Not started |
| 🟠 Important | Multi-track audio mixing | ❌ Not started |
| 🟠 Important | Color grading panel | ❌ Not started |
| 🟠 Important | Transitions library | ❌ Not started |
| 🟡 Enhancement | Character consistency system | ❌ Not started |
| 🟡 Enhancement | Collaboration (multi-user) | ❌ Planned |
| 🟡 Enhancement | Cloud rendering option | ❌ Planned |"

---

### 1.6 Data Scientist / Information Architect — "The Ontologist"

*"Data is not what you store — it's what you can query, relate, and derive. I audited the data model for completeness, relational integrity, and analytical potential.*

#### Data Model Audit

The Prisma schema and TypeScript types together define the ontology of ArsTechnicAI's universe. Here's the assessment:

##### What's Right
- **Identity is stable.** Every entity has a UUID primary key. No auto-increment IDs that collide across instances.
- **Provenance is tracked.** `AssetMetadata` carries `parentId`, `lineageId`, `promptId`, `generatedAt`, `model`, `seed`. This is the minimum required for reproducibility.
- **Status enums are well-defined.** `MediaStatus` (uploading/processing/ready/failed/archived) and `JobStatus` (queued/processing/completed/failed/cancelled) cover the lifecycle.
- **pgvector for semantic search.** Embedding-based similarity search over assets is the right long-term approach for "find images like this one."

##### What's Missing
- **No asset-to-asset relation table.** The model has `parentAssetId` and `childAssetIds` but no dedicated relation table. Complex relationships (this audio track was used in these 3 video projects, derived from this TTS generation) are hard to query without a proper junction table.
- **No analytics aggregation layer.** Per-project statistics (generation count, error rate, cost estimate, time spent) are computed ad-hoc in the client. A materialized view or pre-aggregated table would make the homepage dashboard fast.
- **No soft delete.** Models have no `deletedAt` field. Deletion is hard-delete, making recovery impossible and audit trails incomplete.
- **No change history on assets.** Assets are mutable — the `PATCH` endpoint overwrites fields. A versioned asset table (or an `AssetVersion` model) would enable "restore to previous edit."

#### Proposed Data Model Extensions

```prisma
// Asset relations (junction table for many-to-many)
model AssetRelation {
  id          String   @id @default(cuid())
  sourceId    String
  targetId    String
  relationType RelationType  // DERIVED_FROM, USED_IN, REFERENCES, VARIANT_OF
  metadata    Json?
  createdAt   DateTime @default(now())
  
  source      Asset    @relation("SourceRelations", fields: [sourceId], references: [id])
  target      Asset    @relation("TargetRelations", fields: [targetId], references: [id])
}

enum RelationType {
  DERIVED_FROM    // This asset was generated/edited from that one
  USED_IN         // This asset appears in that project/composition
  REFERENCES      // This asset is referenced by that one (non-destructive)
  VARIANT_OF      // This is a variation (different seed, same prompt)
  GROUPED_WITH    // These assets are grouped together on canvas
}

// Analytics snapshot (pre-aggregated, updated periodically)
model ProjectAnalytics {
  id              String   @id @default(cuid())
  projectId       String
  generationCount Int      @default(0)
  errorCount      Int      @default(0)
  totalCostEstimate Float  @default(0)
  activeTimeMinutes Int    @default(0)
  assetCountByType Json?   // { image: 12, video: 3, audio: 5 }
  calculatedAt    DateTime @default(now())
}

// Soft delete support (add to all major models)
// deletedAt DateTime?  ← add to Project, Asset, CanvasItem
```

#### Data Flow Diagram (Complete)

```
┌────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Browser  │  │ External │  │ User     │  │ System   │ │
│  │ (device, │  │ (AI API, │  │ (prompts,│  │ (logs,   │ │
│  │  storage)│  │  import) │  │  edits)  │  │  errors) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
└───────┼──────────────┼──────────────┼──────────────┼──────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────┐
│                   INGESTION LAYER                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  GATHER → VALIDATE → ENRICH → CLASSIFY → STORE      │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                            │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐            │
│  │ PostgreSQL │  │  Redis   │  │ Filesystem │            │
│  │ (primary)  │  │ (cache,  │  │ (/storage) │            │
│  │            │  │  queue)  │  │            │            │
│  └────────────┘  └──────────┘  └────────────┘            │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Browser localStorage / IndexedDB         │   │
│  │              (offline-first cache)                 │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                   QUERY / ACCESS LAYER                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ REST API │  │ GraphQL  │  │ WebSocket│  │ CLI Tool │ │
│  │ (crud)   │  │ (future) │  │ (realtime)│  │ (automate│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────────────────────┘
```

#### Relation Graph (What Connects to What)

```
User ───owns──▶ Project ───contains──▶ CanvasItem
  │                 │                      │
  │                 │                      ├──references──▶ Asset
  │                 │                      │
  │                 ├──has──▶ Asset        │
  │                 │           │           │
  │                 │           ├──lineage──▶ Asset (parent/child)
  │                 │           │
  │                 │           └──generated_by──▶ GenerationJob
  │                 │                                │
  │                 │                                └──uses──▶ AIProvider
  │                 │
  │                 ├──has──▶ TimelineTrack ──contains──▶ TimelineClip
  │                 │                                         │
  │                 │                                         └──references──▶ Asset
  │                 │
  │                 ├──has──▶ Version (snapshot)
  │                 │
  │                 └──has──▶ PublishJob ──targets──▶ PublishPlatform
  │
  └──has──▶ Session ──tracks──▶ Device
```

---

### 1.7 Software Architect — "The Systems Thinker"

*"Architecture is about the decisions that are hard to change later. I evaluate the structure, the boundaries, the seams, and the extension points.*

#### Current Architecture Assessment

```
PRESENTATION     ┌──────────────────────────────────────┐
  LAYER          │        React Components              │
                 │  AppShell, Canvas, Explorer, etc.    │
                 └──────────────┬───────────────────────┘
                                │ Direct store access
                 ┌──────────────┴───────────────────────┐
  STATE          │         Zustand Stores               │
  LAYER          │  canvas, file, settings, etc.        │
                 └──────────────┬───────────────────────┘
                                │ Ad-hoc API calls
                 ┌──────────────┴───────────────────────┐
  DATA           │    Next.js API Routes + Prisma       │
  LAYER          │    PostgreSQL + Redis + Disk         │
                 └──────────────────────────────────────┘
```

**Problem**: The middle layer — business logic — doesn't exist as a distinct architectural element. It's split between stores (some logic) and components (the rest). This means:

1. You can't test generation logic without mounting React
2. You can't reuse the same logic in a CLI or cron job
3. Changing a store affects every component that touches it

#### Recommended Architecture (Target State)

```
PRESENTATION     ┌──────────────────────────────────────┐
  LAYER          │        React Components              │
                 │     (UI logic only — render, events) │
                 └──────────────┬───────────────────────┘
                                │ Via custom hooks
                 ┌──────────────┴───────────────────────┐
  SERVICE        │         Service Layer                │
  LAYER          │  GenerationService                   │
                 │  ExportService                       │
                 │  ProjectService                      │
                 │  FileService                         │
                 │  SyncService                         │
                 └──────────────┬───────────────────────┘
                                │
                 ┌──────────────┴───────────────────────┐
  STATE          │    Zustand Stores (state only)       │
  LAYER          │    No business logic, just data      │
                 └──────────────┬───────────────────────┘
                                │
                 ┌──────────────┴───────────────────────┐
  DATA           │    Repository Layer (Prisma)         │
  LAYER          │    PostgreSQL + Redis + Disk         │
                 └──────────────────────────────────────┘
```

#### Event Bus (Proposed)

Currently, components communicate only through shared stores. For cross-cutting concerns (health status change, sync complete, error occurred), a lightweight pub/sub event bus decouples producers from consumers:

```typescript
// Simple typed event bus
type EventMap = {
  'health:changed': { status: HealthStatus };
  'sync:completed': { projectId: string };
  'generation:completed': { jobId: string; assetId: string };
  'generation:failed': { jobId: string; error: string };
  'error:occurred': { code: ErrorCode; message: string };
};

const bus = createEventBus<EventMap>();

// Producer
bus.emit('health:changed', { status: 'ok' });

// Consumer
bus.on('health:changed', ({ status }) => {
  telemetryStore.setHealth(status);
});
```

#### Dependency Injection (Future)

For testability, services should receive their dependencies rather than importing them:

```typescript
// Today (hard to test)
class GenerationService {
  async generate(req: GenerationRequest) {
    const settings = useSettingsStore.getState(); // Global import
    const provider = getProvider(settings.aiProvider.activeProvider);
    // ...
  }
}

// Future (testable)
class GenerationService {
  constructor(
    private providerRegistry: ProviderRegistry,
    private config: GenerationConfig,
  ) {}
  
  async generate(req: GenerationRequest) {
    const provider = this.providerRegistry.get(req.provider);
    // ...
  }
}
```

#### Module Boundary Enforcement

The module registry (`lib/modules/registry.ts`) should enforce boundaries:

```
Rule 1: Modules may NOT import from stores/ or components/
Rule 2: Modules may import from lib/media/, lib/ai/, lib/formats/
Rule 3: Modules declare dependencies explicitly in ModuleDef.dependencies
Rule 4: Module execution is audited: input hash → module id → output hash
```

---

## 1.8 Cross-Cutting Patterns & Vocabulary

### Resilience Patterns

| Pattern | Definition | Where Applied in ArsTechnicAI |
|---------|-----------|-------------------------------|
| **Circuit Breaker** | Fails fast when a downstream service is known-bad; reopens after a cooldown. Prevents request pile-up against a degraded AI provider. | `lib/ai/providers/` — each adapter should track consecutive failures; after N failures, reject new requests for T seconds |
| **Bulkhead** | Isolates failure domains so a failure in one area cannot drain resources from another. | Panel-level React Error Boundaries ensure a Canvas crash doesn't kill Inspector or Timeline |
| **Retry with Exponential Backoff** | Retry failed operations with increasing wait times (1s, 2s, 4s, 8s...) + jitter. | Offline queue in `ars:offline-queue`; SSE reconnect logic in `useConnectionStatus` |
| **Idempotency Key** | A client-generated UUID sent with write requests. The server deduplicates by key, so retries are safe. | POST `/api/generate` should require `X-Idempotency-Key` header; stored with the `GenerationJob` |
| **Dead Letter Queue (DLQ)** | Failed items that exceed max retries are moved to a DLQ for inspection rather than dropped silently. | `ars:offline-dlq` localStorage key; items > 5 retries move here and surface in Settings → Debug |
| **Optimistic Locking** | A record includes a `version` counter; updates must supply the current version or they fail. Prevents lost updates in concurrent multi-device edits. | `ProjectVersion.version` counter; `PATCH /api/projects/[id]` checks version before write |

### Architectural Patterns

| Pattern | Definition | Status |
|---------|-----------|--------|
| **CQRS** | Command Query Responsibility Segregation: reads and writes use separate code paths (and optionally separate data stores). Reads are cheap; writes are validated and version-stamped. | ❌ Not implemented — all routes mix read + write in one handler |
| **Event Sourcing** | Store a log of immutable domain events (what happened) instead of just current state (what is). State is derived by replaying the event log. Enables time-travel debugging and audit trails. | ❌ Not implemented — action log exists but is not replayable |
| **Saga Pattern** | Manage distributed transactions (sequences of steps across services) with compensating transactions for rollback. | ❌ Planned for multi-step publish jobs (format → upload → schedule → post) |
| **Repository Pattern** | Abstracts data access behind an interface. Components call a repository method, not a raw Prisma query. Enables switching storage backends without touching components. | ◐ Partial — Prisma is the implicit repository, accessed directly |
| **Domain Event** | A named fact about something that happened in the domain (e.g., `GenerationCompleted`, `ProjectArchived`). Domain events are the currency of the event bus. | ❌ Not yet typed or dispatched |

### Event Bus Specification (Proposed)

The event bus provides typed, loosely-coupled communication between modules, stores, and services:

```typescript
// lib/events/bus.ts
type DomainEventMap = {
  // Generation lifecycle
  'generation:queued':    { jobId: string; prompt: string; provider: string };
  'generation:started':   { jobId: string; estimatedMs: number };
  'generation:completed': { jobId: string; assetId: string; thumbnailUrl: string };
  'generation:failed':    { jobId: string; error: string; retryable: boolean };
  'generation:cancelled': { jobId: string };

  // Project lifecycle
  'project:created':    { projectId: string; name: string };
  'project:saved':      { projectId: string; versionId: string };
  'project:archived':   { projectId: string };
  'project:deleted':    { projectId: string };

  // Sync lifecycle
  'sync:started':    { scope: 'project' | 'settings' | 'assets' };
  'sync:completed':  { scope: string; itemCount: number };
  'sync:failed':     { scope: string; error: string };
  'sync:conflict':   { scope: string; conflictType: string };

  // Health
  'health:degraded': { service: 'db' | 'redis' | 'ai-provider'; message: string };
  'health:restored': { service: string };
  'health:offline':  {};
  'health:online':   {};

  // Error
  'error:unhandled':  { code: string; message: string; context: Record<string, unknown> };
  'error:boundary':   { panel: string; error: string };
};

// Usage (consumer)
import { bus } from '@/lib/events/bus';
useEffect(() => {
  const unsub = bus.on('generation:completed', ({ jobId, assetId }) => {
    addToCanvas(assetId);
  });
  return unsub;
}, []);

// Usage (producer)
bus.emit('generation:completed', { jobId, assetId, thumbnailUrl });
```

### Service Layer Specification (Proposed)

Services encapsulate business logic that is currently split between components and stores:

```typescript
// lib/services/GenerationService.ts
export class GenerationService {
  constructor(
    private providerRegistry: ProviderRegistry,
    private jobQueue: JobQueue,
    private eventBus: EventBus<DomainEventMap>,
  ) {}

  async generate(request: GenerationRequest): Promise<GenerationJob> {
    const job = await this.jobQueue.enqueue(request);
    this.eventBus.emit('generation:queued', { jobId: job.id, ... });
    const result = await this.providerRegistry
      .get(request.provider)
      .generateImage(request);
    this.eventBus.emit('generation:completed', { jobId: job.id, assetId: result.assetId, ... });
    return result;
  }

  async cancel(jobId: string): Promise<void> { ... }
  async getStatus(jobId: string): Promise<JobStatus> { ... }
}

// lib/services/ProjectService.ts
export class ProjectService {
  async create(draft: ProjectDraft): Promise<Project> { ... }
  async archive(projectId: string): Promise<void> { ... }
  async restore(projectId: string): Promise<void> { ... }  // un-soft-delete
  async snapshot(projectId: string, label: string): Promise<Version> { ... }
  async duplicate(projectId: string): Promise<Project> { ... }
}

// lib/services/ExportService.ts
export class ExportService {
  async exportPNG(canvasItems: CanvasItem[]): Promise<Blob> { ... }
  async exportVideo(timeline: Timeline, profile: FormatProfile): Promise<Blob> { ... }
  async exportBundle(projectId: string): Promise<Blob> { ... }
}
```

---

## 2. Data Architecture Deep Dive

### 2.1 Persistence Strategy

```
┌─────────────────────────────────────────────────────────┐
│              PERSISTENCE HIERARCHY                       │
│                                                          │
│  Layer 1: localStorage (Zustand persist)                 │
│  ───────────────────────────────────────                 │
│  • Instant hydration on page load                        │
│  • Stores: canvas, settings, projects, files, user       │
│  • Limitation: 5-10MB quota, no binary files             │
│  • Strategy: metadata only, base64 images (temporary)    │
│                                                          │
│  Layer 2: IndexedDB (planned)                            │
│  ────────────────────────────────                        │
│  • Binary asset storage (images, audio, video frames)    │
│  • Unlimited quota (user-granted)                        │
│  • Async API, works in Web Workers                       │
│                                                          │
│  Layer 3: Filesystem (optional, server mode)             │
│  ───────────────────────────────────────                 │
│  • /storage/projects/{id}/assets/                        │
│  • /storage/projects/{id}/generated/                     │
│  • Sidecar .meta.json per binary file                    │
│                                                          │
│  Layer 4: PostgreSQL (server mode)                       │
│  ───────────────────────────────────                     │
│  • Structured data: projects, users, jobs, versions      │
│  • Asset metadata (not binaries)                         │
│  • pgvector embeddings for semantic search               │
│                                                          │
│  Layer 5: Redis (server mode)                            │
│  ─────────────────────────────                           │
│  • Session cache                                         │
│  • Job queue (future)                                    │
│  • Rate limit counters                                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Sync Strategy

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ OFFLINE  │────▶│RECONNECT │────▶│  ONLINE  │
│ (queue)  │     │ (flush)  │     │ (direct) │
└──────────┘     └──────────┘     └──────────┘

Offline queue: ars:offline-queue key in localStorage
• Each entry: { action, payload, timestamp, idempotencyKey }
• Flushed on reconnect (useSyncOnReconnect hook)
• Server deduplicates by idempotencyKey
• Failed entries are retried with exponential backoff (max 5)
```

### 2.3 Conflict Resolution

| Conflict Type | Strategy |
|--------------|----------|
| Same project, different canvas items | Last-write-wins by `updatedAt` |
| Same asset, different metadata | Deep merge (shallow fields overwrite, arrays merge by id) |
| Same settings, different device | Per-setting last-write-wins |
| Version conflicts | Versions are immutable; new versions are additive |

---

## 3. Security Architecture

### 3.1 Defense in Depth

```
┌────────────────────────────────────────────────────────┐
│ LAYER 1: Network                                       │
│ • TLS 1.3 (Nginx)                                      │
│ • CSP headers                                          │
│ • CORS whitelist                                       │
├────────────────────────────────────────────────────────┤
│ LAYER 2: Application                                   │
│ • NextAuth JWT (HTTP-only, Secure, SameSite=Strict)    │
│ • CSRF tokens on state-changing requests               │
│ • Rate limiting (10 req/min/user on generate)          │
│ • Input validation (Zod schemas)                       │
│ • Output sanitization (no raw HTML in responses)       │
├────────────────────────────────────────────────────────┤
│ LAYER 3: Data                                          │
│ • API keys: server-side env vars, never to client      │
│ • Passwords: bcrypt (cost factor 12)                   │
│ • Sensitive localStorage: Web Crypto AES-GCM           │
│ • DB encryption: pgcrypto for sensitive columns        │
├────────────────────────────────────────────────────────┤
│ LAYER 4: Monitoring                                    │
│ • Audit log: all sensitive ops logged                  │
│ • Error tracking: client signature + error code        │
│ • Anomaly detection: unusual generation patterns       │
└────────────────────────────────────────────────────────┘
```

---

## 4. Performance Architecture

### 4.1 Rendering Strategy

| Component | < 200 items | 200-1000 items | 1000+ items |
|-----------|-------------|----------------|-------------|
| Explorer Tree | DOM (fine) | DOM (slow) | react-window |
| Canvas | DOM (fine) | DOM (struggling) | WebGL (PixiJS/Three.js) |
| Timeline | DOM (fine) | Canvas 2D | Canvas 2D |
| Asset Grid | CSS Grid (fine) | CSS Grid (ok) | react-window |
| Inspector | DOM (always fine) | DOM | DOM |

### 4.2 Asset Loading Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  THUMBNAIL  │────▶│   MEDIUM    │────▶│    FULL     │
│  (32×32)    │     │  (256×256)  │     │  (native)   │
│   < 1KB     │     │   < 20KB    │     │   original  │
│  Instant    │     │  On hover   │     │  On select  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 5. Testing Strategy

### 5.1 Current Coverage

| Layer | Coverage | Target |
|-------|----------|--------|
| Stores (unit) | 92% | 95% ✅ |
| Services (unit) | 0% | 80% |
| Components (unit) | 0% | 60% |
| API Routes (integration) | 0% | 70% |
| E2E (Playwright) | 0% | 30% (critical paths) |

### 5.2 Test Pyramid (Target)

```
        ┌──────┐
        │ E2E  │  5% — Critical user journeys
        ├──────┤
        │ INT  │  20% — API routes, store integration
        ├──────┤
        │ UNIT │  75% — Stores, services, utilities
        └──────┘
```

---

## 6. Innovation History & Patterns

### 6.1 Architectural Innovations (ArsTechnicAI-Specific)

| Innovation | Description | Impact | Novelty |
|------------|-------------|--------|---------|
| **AI-First Design** | UI built around AI generation workflows from the ground up | High | Unique |
| **Graph + Timeline Hybrid** | Node-based pipeline with temporal editing in one tool | High | Very rare |
| **Parametric Design Knobs** | Density, roundness, glow, contrast, speed as CSS variable knobs | Medium | Novel (for web) |
| **Offline-First Creative Tool** | Three-tier persistence, embedded base64, offline queue | High | Unique for AI tools |
| **Media Type Color System** | Consistent color encoding following assets through every view | Medium | Inspired by pro tools |
| **Module Registry** | Typed ports, dependency declaration, headless execution | Medium | Good pattern |
| **Provenance by Default** | Every generated pixel traces to prompt + seed + model + version | High | Unique |

### 6.2 Technical Patterns

```
✅ Implemented Well:
- Presentational/Container pattern (Zustand hooks)
- CSS Modules for style isolation
- TypeScript strict mode
- Optimistic UI updates
- Strategy pattern (provider adapters)
- Module registry pattern

◐ Partially Implemented:
- Command pattern (action logging exists, replay doesn't)
- Observer pattern (store subscriptions, no event bus)
- Repository pattern (Prisma is the repo, but accessed raw)

❌ Not Yet Implemented:
- CQRS (reads and writes share the same path)
- Event sourcing (actions logged but not replayable)
- Dependency injection (global store imports)
- Pub/sub event bus (cross-cutting communication)
- Dedicated service layer (business logic in components)
```

---

## 7. Conclusion & Critical Path

### What's Right (Keep Doing)
1. **TypeScript strict mode** — never compromise on this
2. **Zustand for state** — lightweight, testable, sufficient
3. **Parametric design system** — extend to all future components
4. **Offline-first architecture** — reinforces trust
5. **Module registry** — the extensibility backbone

### What's Wrong (Must Fix)
1. **API keys on client** — critical security vulnerability
2. **No service layer** — business logic isn't reusable or testable
3. **No virtualization** — won't scale past 200 items
4. **Base64 in localStorage** — will hit quota fast
5. **Timeline is UI-only** — the core value proposition isn't delivered

### Critical Path to Production

```
Phase 1 (NOW):     Security       — API keys server-side, CSRF, rate limiting
Phase 2 (1 month): Performance   — Virtualization, IndexedDB, WebGL canvas
Phase 3 (2 months): Media Engine  — ffmpeg.wasm, waveform, real timeline playback
Phase 4 (3 months): Services      — Extract service layer, test coverage, event bus
Phase 5 (6 months): Polish        — Onboarding, collaboration, CDN, plugin API
```

### Innovation Potential

The combination of **graph-based pipelines** with **timeline editing**, unified under an **offline-first, AI-native architecture**, is genuinely novel in the creative tool space. No existing product offers this combination. With proper execution of the media engines (video, audio, 3D), ArsTechnicAI has the potential to become the defining creative tool for the AI generation era — the "DaVinci Resolve for AI-assisted content creation."

---

*This document should be updated quarterly. Every architectural decision that changes the data model, the API surface, or the component hierarchy must be reflected here.*
