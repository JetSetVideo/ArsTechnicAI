# Health & Error System — Implementation Plan

This document outlines the plan for enhancing the health and error system to **gather, digest, store, and sync** user/device/usage data at startup, with local-first storage and backend integration.

---

## 0. Client Version Signature (Offline-Unique Fingerprint)

### Is It a Good Idea?

**Yes.** A deterministic, offline-computed code that uniquely identifies the current "version + environment" of the user helps:

- **Bug tracking**: User reports "my code is `v1.0-a3f2-high-4g`" → you can correlate errors, performance, and device tier
- **Individual performance**: Compare metrics across signatures (e.g. slow on `low` tier devices)
- **Release quality**: Identify which app versions/configs have higher error rates

### Is It Doable Offline?

**Yes.** All inputs are available client-side, no network required:

| Input | Source | Notes |
|-------|--------|-------|
| App version | `package.json` or `NEXT_PUBLIC_APP_VERSION` | e.g. `1.0.0` |
| Build ID | Next.js `__NEXT_DATA__.buildId` or `'dev'` | Distinguishes dev vs prod build |
| Device tier | Derived (cores, memory) | `low` / `medium` / `high` / `unknown` |
| Connectivity tier | `navigator.connection.effectiveType` | `slow` / `3g` / `4g` / `unknown` |
| Feature flags | WebGL, Workers, IndexedDB etc. | Short hash of capability string |

**Algorithm**: `hash(version + buildId + deviceTier + connectivityTier + featureHash)` → short alphanumeric (e.g. 8 chars). Use Web Crypto `crypto.subtle.digest('SHA-256', ...)` then truncate, or a fast non-crypto hash (djb2) for speed. **Works fully offline.**

**Example output**: `v1.0.0-a3f2c1` (version + short hash of env)

**Privacy**: No PII. Uses capability-based device tier, not raw UA or screen dimensions. User can reset by clearing telemetry (new session will produce new signature if env changes).

**Integration**: Include `clientSignature` in every telemetry snapshot and error event. Show in Settings > About or in error report copy-paste.

---

## 1. Current State Summary

### 1.1 Complete Audit of Existing Data Sources

| Source | Storage Key | Data | Persisted | Telemetry-Relevant |
|--------|-------------|------|-----------|--------------------|
| **userStore** | `ars-technicai-user` | DeviceInfo (screen, viewport, platform, UA, language, hardwareConcurrency, deviceMemory, connection, timezone), Session (sessionId, startedAt, generationsCount, importsCount, exportsCount), currentProject, recentProjects | Partial (project, session) | ✅ Device, session, usage |
| **logStore** | `ars-technicai-log` | ActionLogEntry[]: type, description, timestamp, data (max 1000). Types: file_import, file_export, canvas_add, canvas_remove, canvas_move, canvas_resize, generation_start, generation_complete, generation_fail, prompt_save, settings_change, search, folder_create, folder_open | Yes | ✅ Action counts, error types |
| **toastStore** | — | Toasts (type, title, message, duration). ERROR_CODES, parseAPIError | In-memory | ✅ Error events |
| **generationStore** | — | Jobs (status, prompt, progress, result/error), prompt, dimensions, isGenerating | In-memory | ✅ Generation counts, failures |
| **settingsStore** | `ars-technicai-settings` | theme, appearance (fontSize, fontScale, compactMode, showFilenames), aiProvider (provider, model, defaultWidth/Height, steps, guidanceScale), outputDirectory, autoSavePrompts, showGrid, snapToGrid, gridSize, recentPaths | Yes | ✅ Config digest (no keys) |
| **fileStore** | `ars-technicai-files` | rootNodes (tree with path), assets Map, selectedPath, expandedPaths, currentProjectPath. Paths: `/`, `/imports`, `/library`, `/projects/<slug>`, `…/generated`, `…/exports` | Yes | ✅ Folder structure stats, path patterns |
| **projectsStore** | `ars-technicai-projects` | projects (id, name, createdAt, modifiedAt, assetCount, tags, isFavorite), currentProjectId, recentProjectIds, sortBy, sortOrder, filterTags | Yes | ✅ Project count, recent usage |
| **canvasStore** | — | items, selectedIds, viewport, clipboard | Via useProjectSync | ✅ Item count per project |
| **canvasStates** | `ars-technicai-canvas-states` | Per-project canvas items + viewport (keyed by projectId) | Yes | ✅ Canvas complexity |
| **modulesStore** | `ars-technicai-modules` | modules (status, installedAt), user favorites | Yes | ✅ Module usage |
| **techniquesStore** | `ars-technicai-techniques` | techniques catalog, favorites | Yes | ✅ Technique preferences |
| **profileStore** | `ars-technicai-profile` | preferences, avatar, choiceHistory, styleTags, consentGiven | Yes | ✅ Preference learning (anonymized) |
| **agentsStore** | `ars-technicai-agents` | agents, tasks, executions | Yes | ✅ Agent usage |
| **socialStore** | `ars-technicai-social` | posts, connections | Yes | ✅ Social activity (anonymized) |
| **constants/workspace** | — | WORKSPACE_ROOT_PATHS, WORKSPACE_ROOT_NAMES, WORKSPACE_DEFAULTS, STORAGE_KEYS | Static | ✅ Path schema |
| **utils/project** | — | projectPathFromName, slugifyProjectName | — | ✅ Path derivation |
| **utils/logger** | — | Winston: error.log, combined.log (server-side) | File | ❌ Server only |
| **hooks/useProjectSync** | — | Bridges userStore ↔ projectsStore, loadCanvasState, saveCanvasState | — | ✅ Sync behavior |
| **/api/health** | — | Backend + PostgreSQL status, services[] | Ephemeral | ✅ Health snapshot |

### 1.2 Data to Integrate into Telemetry Pipeline

| Category | Source | Fields to Use |
|----------|--------|---------------|
| **Paths** | fileStore, constants/workspace | currentProjectPath, root path patterns (e.g. `/projects/untitled-project`), folder count |
| **Logs** | logStore | Counts by type (generation_fail, file_import, etc.), last N types for error context |
| **Settings** | settingsStore | provider, fontSize, compactMode, showGrid (no apiKey, no recentPaths content) |
| **Projects** | projectsStore, userStore | projectCount, recentProjectIds length, current project name (slug only) |
| **Canvas** | canvasStore, canvasStates | itemCount, viewport zoom (for complexity) |
| **Modules/Agents** | modulesStore, agentsStore | active module count, agent run count |
| **Profile** | profileStore | preferenceGatheringProgress (0–100), consentGiven |

### 1.3 Gaps

- **No unified startup data pipeline**: Data is gathered ad hoc across stores
- **No digestion/derivation**: Raw data only; no derived stats (e.g. error rate, session duration)
- **No local telemetry store**: Errors and health events are not persisted locally
- **No sync to backend**: Backend (Prisma) has no tables for device/usage/health telemetry
- **No batching or retry**: Failed syncs are not queued
- **No client signature**: No offline-unique code for bug/performance correlation

---

## 2. Data to Gather at Startup

### 2.1 Browser / Environment (Client-Side)

| Category | Data | Notes |
|----------|------|-------|
| **Screen** | width, height, dpr, colorDepth, orientation | Already in `DeviceInfo` |
| **Viewport** | innerWidth, innerHeight | Already in `DeviceInfo` |
| **Platform** | platform, userAgent, language, languages | Already in `DeviceInfo` |
| **Hardware** | hardwareConcurrency, deviceMemory, maxTouchPoints, touchEnabled | Already in `DeviceInfo` |
| **Network** | connection.type, effectiveType, downlink, rtt (if available) | Extend `DeviceInfo` |
| **Storage** | `navigator.storage.estimate()` — quota, usage | New |
| **Features** | WebGL, Canvas, Workers, ServiceWorker, IndexedDB | New — capability flags |
| **Locale** | timezone, timezoneOffset | Already in `DeviceInfo` |
| **Document** | URL, referrer (if same-origin), visibilityState | New — context |

### 2.2 Application State (Client-Side)

| Category | Data | Source |
|----------|------|--------|
| **Session** | sessionId, startedAt, previousSessionEnd | userStore, new |
| **Usage** | generationsCount, importsCount, exportsCount, projectsOpened | userStore, projectsStore |
| **Errors** | Recent errors (type, code, message, timestamp) | toastStore, logStore, new errorStore |
| **Health** | Last health check result (status, services, timestamp) | ConnectionBanner, health API |
| **Settings** | fontSize, compactMode, provider, showFilenames | settingsStore |

### 2.3 Derived / Deduced Data

| Derived Metric | Formula / Logic |
|----------------|-----------------|
| **Session duration** | `now - session.startedAt` |
| **Error rate** | `errorCount / (generationsCount + importsCount + …)` over window |
| **Device tier** | heuristic: e.g. `high` if deviceMemory ≥ 8 and hardwareConcurrency ≥ 4 |
| **Connectivity tier** | `effectiveType` → slow/3g/4g/unknown |
| **Storage usage %** | `usage / quota * 100` |
| **Anonymous device fingerprint** | hash of (platform + UA + screen + cores) — optional, for deduplication only |

### 2.4 Identity & Client Signature (Privacy-Safe)

- **Anonymous session ID**: UUID (already)
- **Client signature**: Offline-unique code for bug/performance tracking (see Section 0). Computed from: app version, build ID, device tier, connectivity tier, feature hash.
- **Anonymous device ID**: Optional stable hash for “same device” across sessions (local-only, user can reset)
- **No PII**: No email, name, IP stored client-side; backend may log IP for security only

---

## 3. Processing Pipeline (Digest → Update → Store)

### 3.1 Startup Flow

```
App mount (_app.tsx)
    │
    ├─► 1. GATHER (parallel)
    │      - refreshDeviceInfo()
    │      - gatherStorageEstimate()
    │      - gatherFeatureFlags()
    │      - fetch /api/health
    │      - read from: userStore, logStore, settingsStore, fileStore, projectsStore,
    │        canvasStore, canvasStates, modulesStore, agentsStore, profileStore
    │      - compute clientSignature (offline)
    │      - read persisted telemetry (local)
    │
    ├─► 2. DIGEST
    │      - compute derived metrics (session duration, error rate, device tier)
    │      - merge with previous session snapshot
    │      - sanitize (no PII, no raw UA in persisted)
    │
    ├─► 3. UPDATE LOCAL STORE
    │      - telemetryStore.upsertStartupSnapshot(snapshot)
    │      - errorStore.appendErrorsFromToasts() (if any from last run)
    │      - persist to localStorage / IndexedDB
    │
    └─► 4. SYNC TO BACKEND (async, best-effort)
           - POST /api/telemetry or backend /api/v1/telemetry
           - batch recent events
           - retry on failure (exponential backoff)
           - do not block UI
```

### 3.2 Continuous Updates

- **On error**: Append to `errorStore`, update derived error rate
- **On health change**: Update health snapshot, optionally trigger sync
- **On session end** (beforeunload / visibility hidden): Final snapshot, sync if online
- **Periodic**: Every N minutes, incremental sync of new events

---

## 4. Local Storage Schema

### 4.1 New Store: `telemetryStore`

**Storage key**: `ars-technicai-telemetry`

**Shape** (Zustand + persist):

```ts
interface TelemetrySnapshot {
  id: string;
  timestamp: number;
  
  // Client signature (offline-unique for bug/performance tracking)
  clientSignature: string;  // e.g. "v1.0.0-a3f2c1"
  
  // Startup context
  device: SanitizedDeviceInfo;      // No raw UA, summarized
  storage: { quota: number; usage: number; usagePercent: number } | null;
  features: Record<string, boolean>;
  
  // Session
  sessionId: string;
  sessionStartedAt: number;
  sessionDurationMs: number;
  
  // Usage (cumulative for session) — from userStore, generationStore, logStore
  usage: {
    generations: number;
    imports: number;
    exports: number;
    projectsOpened: number;
    canvasItems: number;
    logEntriesByType: Partial<Record<ActionType, number>>;
  };
  
  // Paths & structure — from fileStore, constants/workspace
  paths: {
    currentProjectPath: string;     // e.g. /projects/untitled-project
    rootFolderCount: number;
    assetCount: number;
  };
  
  // Settings digest (no apiKey, no recentPaths content) — from settingsStore
  settingsDigest: {
    provider: string;
    fontSize: string;
    compactMode: boolean;
    showGrid: boolean;
  };
  
  // Projects — from projectsStore
  projects: { count: number; recentCount: number };
  
  // Derived
  deviceTier: 'low' | 'medium' | 'high' | 'unknown';
  connectivityTier: 'slow' | '3g' | '4g' | 'unknown';
  
  // Health
  health: { status: HealthStatus; services: ServiceStatus[]; checkedAt: number } | null;
}

interface TelemetryState {
  snapshots: TelemetrySnapshot[];   // Last N (e.g. 10)
  lastSyncedAt: number | null;
  pendingEvents: TelemetryEvent[];  // Events not yet synced
  // actions...
}
```

### 4.2 New Store: `errorStore`

**Storage key**: `ars-technicai-errors`

**Shape**:

```ts
interface ErrorEvent {
  id: string;
  timestamp: number;
  code: ErrorCode;
  message: string;
  clientSignature: string;  // For bug correlation
  context?: Record<string, unknown>;  // e.g. { endpoint: '/api/generate' }
  synced: boolean;
}

interface ErrorState {
  events: ErrorEvent[];
  maxEvents: number;  // e.g. 100
  // append, markSynced, getUnsynced, clear
}
```

### 4.3 Integration with Existing Stores

- **userStore**: Continue as source of device/session; `telemetryStore` consumes via `getSecuritySafeInfo()` and extended gatherers
- **logStore**: Keep; `telemetryStore` can sample action types for usage stats
- **toastStore**: On error toast, also call `errorStore.append()`
- **ConnectionBanner / health**: On health result, call `telemetryStore.setHealth()` or similar

---

## 5. Backend Schema Updates

### 5.1 New Prisma Models

```prisma
// Anonymous device/usage telemetry (no PII)
model TelemetrySnapshot {
  id              String   @id @default(cuid())
  
  // Anonymous identifiers
  sessionId       String
  clientSignature String   // Offline-unique: version + env hash (e.g. v1.0.0-a3f2c1)
  deviceId        String?  // Optional stable hash, user-resettable
  
  // Device (sanitized)
  platform        String?
  screenWidth     Int?
  screenHeight    Int?
  deviceTier      String?  // low, medium, high
  connectivityTier String?
  
  // Session
  sessionStartedAt DateTime
  sessionDurationMs Int
  
  // Usage
  generationsCount  Int @default(0)
  importsCount      Int @default(0)
  exportsCount      Int @default(0)
  projectsOpened    Int @default(0)
  
  // Health
  healthStatus    String?   // ok, degraded, error
  healthServices  Json?     // [{ name, status, message }]
  healthCheckedAt DateTime?
  
  // Metadata
  appVersion      String?
  createdAt       DateTime @default(now())
}

model ErrorEvent {
  id              String   @id @default(cuid())
  
  sessionId       String
  clientSignature String   // For bug/performance correlation
  code            String   // ErrorCode enum or string
  message         String   @db.Text
  context         Json?    // { endpoint, statusCode, ... }
  
  createdAt DateTime @default(now())
  synced    Boolean  @default(false)
}

// Optional: link to User if authenticated
// TelemetrySnapshot could have optional userId
model TelemetrySnapshot {
  // ... as above ...
  userId    String?  // If user is logged in
  user      User?    @relation(fields: [userId], references: [id])
}
```

### 5.2 Backend API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/telemetry/snapshot` | Receive startup/session snapshot |
| POST | `/api/v1/telemetry/events` | Batch error events |
| GET | `/api/health` | Existing; extend to optionally accept `?include=db` for PostgreSQL check |

### 5.3 Request/Response Contract

**POST /api/v1/telemetry/snapshot**

```json
// Request
{
  "sessionId": "uuid",
  "clientSignature": "v1.0.0-a3f2c1",
  "deviceId": "optional-hash",
  "device": { "platform": "...", "screenWidth": 1920, "deviceTier": "high", ... },
  "session": { "startedAt": 1234567890, "durationMs": 60000 },
  "usage": { "generations": 5, "imports": 2, "exports": 0, "projectsOpened": 3, "canvasItems": 12, "logEntriesByType": { "generation_fail": 1 } },
  "paths": { "currentProjectPath": "/projects/untitled", "rootFolderCount": 5, "assetCount": 8 },
  "settingsDigest": { "provider": "nanobanana", "fontSize": "medium", "compactMode": false, "showGrid": true },
  "projects": { "count": 3, "recentCount": 5 },
  "health": { "status": "ok", "services": [...], "checkedAt": 1234567890 },
  "appVersion": "1.0.0"
}

// Response
{ "ok": true, "id": "cuid" }
```

**POST /api/v1/telemetry/events**

```json
// Request
{
  "sessionId": "uuid",
  "clientSignature": "v1.0.0-a3f2c1",
  "events": [
    { "code": "RATE_LIMITED", "message": "...", "clientSignature": "v1.0.0-a3f2c1", "context": { "endpoint": "/api/generate" }, "timestamp": 1234567890 }
  ]
}

// Response
{ "ok": true, "received": 1 }
```

---

## 6. Error System Integration

### 6.1 Error Flow

```
Any error (API, validation, network)
    │
    ├─► toastStore.error()           → User sees toast
    ├─► logStore.log('generation_fail', ...)  → Action log
    └─► errorStore.append({ code, message, context })  → Persisted, queued for sync
```

### 6.2 Error Codes

Reuse `ERROR_CODES` from `toastStore`; extend with:

- `HEALTH_CHECK_FAILED`
- `SYNC_FAILED`
- `STORAGE_QUOTA_EXCEEDED`

### 6.3 Health ↔ Error Correlation

- When health status is `error`, optionally create an `ErrorEvent` with `HEALTH_CHECK_FAILED`
- When sync fails, create `SYNC_FAILED` and retry later

---

## 7. Implementation Phases

### Phase 0: Client Signature (Offline-Unique Code)

1. Create `utils/clientSignature.ts`: `computeClientSignature()` using app version, build ID, device tier, connectivity tier, feature hash
2. Expose in Settings > About or error report copy-paste
3. Integrate into telemetry snapshot and error events

### Phase 1: Local Gather & Store (No Backend)

1. Extend `DeviceInfo` with storage estimate, feature flags, network detail
2. Create `telemetryStore` with startup snapshot logic (include paths, logs, settings, projects, canvas)
3. Create `errorStore` with append/markSynced (include `clientSignature`)
4. Hook toast errors into `errorStore`
5. Hook health result into `telemetryStore`
6. Add gatherers for: fileStore (paths, asset count), logStore (counts by type), settingsStore (digest), projectsStore (counts), canvasStore (item count)
7. Add `STORAGE_KEYS.telemetry` and `STORAGE_KEYS.errors`

### Phase 2: Digestion & Derivation

1. Implement derived metrics (device tier, connectivity tier, error rate)
2. Implement `digestStartupData()` pipeline
3. Wire `_app.tsx` or a `TelemetryProvider` to run pipeline on mount

### Phase 3: Backend Schema & API

1. Add Prisma models `TelemetrySnapshot`, `ErrorEvent`
2. Create backend routes: `POST /api/v1/telemetry/snapshot`, `POST /api/v1/telemetry/events`
3. Add optional `userId` if auth is used

### Phase 4: Sync Layer

1. Create `syncTelemetry()` service: batch pending events, POST to backend
2. Retry with exponential backoff
3. Call sync after startup (debounced), on session end, and periodically
4. Respect offline: queue only, sync when online

### Phase 5: Health Enhancement

1. Extend `/api/health` to accept client context (optional) and return server-side checks
2. Optionally have backend `/health` verify PostgreSQL and return service status
3. ConnectionBanner can show “Syncing…” when sync in progress

---

## 8. Privacy & Security

- **No PII in telemetry**: No email, name, IP (IP may be logged server-side for security)
- **User control**: Setting to disable telemetry sync (local collection still allowed for debugging)
- **Data retention**: Backend should define retention (e.g. 90 days)
- **Reset**: User can clear `telemetryStore` and `errorStore` from Settings
- **Encryption**: Consider encrypting sensitive fields before sync (e.g. if any context contains tokens — avoid that)

---

## 9. Files to Create / Modify

| File | Action |
|------|--------|
| `utils/clientSignature.ts` | Create — computeClientSignature() (offline) |
| `stores/telemetryStore.ts` | Create |
| `stores/errorStore.ts` | Create |
| `services/telemetry/gather.ts` | Create — gather from userStore, logStore, fileStore, settingsStore, projectsStore, canvasStore, modulesStore, profileStore |
| `services/telemetry/digest.ts` | Create — derivation logic (device tier, connectivity tier, log counts by type) |
| `services/telemetry/sync.ts` | Create — backend sync |
| `constants/workspace.ts` | Add STORAGE_KEYS.telemetry, .errors |
| `stores/userStore.ts` | Extend DeviceInfo (storage, features, network detail) |
| `stores/toastStore.ts` | Hook into errorStore on error/warning |
| `components/ui/ConnectionBanner.tsx` | Call telemetryStore.setHealth() |
| `components/layout/SettingsModal.tsx` | Add "About" / client signature display |
| `pages/_app.tsx` | Add TelemetryProvider or startup pipeline |
| `prisma/schema.prisma` | Add TelemetrySnapshot, ErrorEvent (with clientSignature) |
| `pages/api/telemetry/` or backend routes | Create endpoints |
| `types/telemetry.ts` | Create shared types (ActionType for logEntriesByType) |
| `next.config.js` | Expose NEXT_PUBLIC_APP_VERSION if needed |

---

## 10. Success Criteria

- [ ] Client signature is computed offline and unique per version+env
- [ ] At startup, all gatherable data (including paths, logs, settings, projects, canvas) is collected without blocking UI
- [ ] Derived metrics (device tier, error rate, etc.) are computed and stored locally
- [ ] Errors are persisted locally with client signature and queued for sync
- [ ] Backend accepts telemetry snapshots and error events (with clientSignature)
- [ ] Sync works offline-first: queue locally, send when online
- [ ] User can disable sync and clear local telemetry
- [ ] No PII is stored or transmitted
- [ ] User can copy client signature from Settings > About for bug reports

---

## 11. References

- **Prompt.md**: PRD, feature inventory
- **README.md**: Tech stack, env vars
- **Structure.md**: Module boundaries, file layout
- **Design.md**: UI/UX, component specs
- **ARCHITECTURE.md**: Critical analysis, data flow, security recommendations
- **TEST_RESULTS.md**: Test coverage, future backend integration notes

---

*Document created: February 2026. Updated with client signature, full data audit, and integration of existing stores (paths, logs, settings, projects, canvas, modules, profile).*
