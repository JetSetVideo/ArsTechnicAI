# Health & Error System — Implementation Plan

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> This document outlines the health monitoring, error tracking, telemetry pipeline, and performance observability architecture for ArsTechnicAI.

---

## 1. Client Version Signature

### What It Is
A deterministic, offline-computed fingerprint uniquely identifying the client's version + environment. Used for bug correlation, performance analysis, and release quality tracking.

### Algorithm

```typescript
function computeClientSignature(): string {
  const version = APP_VERSION;                          // e.g. "1.0.0"
  const buildId = getBuildId();                        // Next.js build or 'dev'
  const deviceTier = deriveDeviceTier();               // low | medium | high
  const connectivityTier = deriveConnectivityTier();   // slow | 3g | 4g | unknown
  const featureHash = hashFeatureFlags();              // Short hash of capabilities string
  
  const input = `${version}|${buildId}|${deviceTier}|${connectivityTier}|${featureHash}`;
  return `${version}-${fastHash(input).slice(0, 6)}`;
}

// Example output: "v1.0.0-a3f2c1"
```

### Inputs (All Available Client-Side, No Network Required)

| Input | Source | Example |
|-------|--------|---------|
| App version | `NEXT_PUBLIC_APP_VERSION` | `1.0.0` |
| Build ID | `__NEXT_DATA__.buildId` | `dev` or `abc123` |
| Device tier | Derived from hardwareConcurrency + deviceMemory | `high` (≥8 cores, ≥8GB) |
| Connectivity tier | `navigator.connection.effectiveType` | `4g` |
| Feature hash | WebGL, Workers, IndexedDB, ServiceWorker | `a3f` |

### Privacy
- No PII. Uses capability-based tiers, not raw UA.
- User can reset by clearing telemetry → new session produces new signature if env changes.
- Never stored server-side with identifying information.

---

## 2. Telemetry Pipeline

### 2.1 Startup Flow

```
App mount (_app.tsx or TelemetryProvider)
    │
    ├─► 1. GATHER (parallel)
    │      • refreshDeviceInfo()
    │      • gatherStorageEstimate()
    │      • gatherFeatureFlags()
    │      • computeClientSignature()
    │      • fetch /api/health
    │      • read from all stores: user, log, settings, file, projects, canvas, modules, agents, profile
    │      • read persisted telemetry from localStorage
    │
    ├─► 2. DIGEST
    │      • derive: device tier, connectivity tier, error rate, session duration
    │      • merge with previous session snapshot
    │      • sanitize (no PII, no raw identifiers)
    │
    ├─► 3. STORE (local)
    │      • telemetryStore.upsertStartupSnapshot(snapshot)
    │      • errorStore.appendErrorsFromToasts()
    │      • persist to localStorage
    │
    └─► 4. SYNC (backend, async, best-effort)
           • POST /api/telemetry/snapshot
           • batch error events
           • retry on failure (exponential backoff)
           • do not block UI
```

### 2.2 Continuous Monitoring

| Event | Trigger | Action |
|-------|---------|--------|
| Error occurred | Any API error, validation failure | Append to `errorStore`, update derived error rate |
| Health changed | `/api/health` response differs | Update `telemetryStore.health`, optionally sync |
| Session ending | `beforeunload` / visibility hidden | Final snapshot, sync if online |
| Periodic | Every 5 minutes | Incremental sync of new events |

---

## 3. Data Sources (Complete Audit)

| Store | Persistence Key | Key Telemetry Fields |
|-------|----------------|---------------------|
| `userStore` | `ars-technicai-user` | Device info (screen, cores, memory, connection), session stats (generations, imports, exports) |
| `logStore` | `ars-technicai-log` | Action counts by type (generation_fail, file_import, etc.), last N entries |
| `settingsStore` | `ars-technicai-settings` | Provider, fontSize, compactMode, showGrid (NO apiKey) |
| `projectsStore` | `ars-technicai-projects` | Project count, recent project count |
| `fileStore` | `ars-technicai-files` | Current project path, folder count, asset count |
| `canvasStore` | (via canvasStates) | Item count per project, viewport zoom |
| `modulesStore` | `ars-technicai-modules` | Active module count |
| `agentsStore` | `ars-technicai-agents` | Agent run count |
| `profileStore` | `ars-technicai-profile` | Consent given, preference progress |
| `telemetryStore` | `ars-technicai-telemetry` | Startup snapshots, health history |
| `errorStore` | `ars-technicai-errors` | Error events with client signature |

---

## 4. Telemetry Data Schema

### 4.1 Startup Snapshot

```typescript
interface TelemetrySnapshot {
  id: string;
  timestamp: number;
  clientSignature: string;        // "v1.0.0-a3f2c1"
  
  device: {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    hardwareConcurrency: number;
    deviceMemory?: number;
    connectionType?: string;
    connectionEffectiveType?: string;
    language: string;
    timezone: string;
  };
  
  storage: {
    quota?: number;
    usage?: number;
    usagePercent?: number;
  };
  
  features: {
    webgl: boolean;
    webgl2: boolean;
    workers: boolean;
    serviceWorker: boolean;
    indexedDB: boolean;
    sharedArrayBuffer: boolean;
  };
  
  session: {
    sessionId: string;
    startedAt: number;
    durationMs: number;
  };
  
  usage: {
    generations: number;
    imports: number;
    exports: number;
    projectsOpened: number;
    canvasItems: number;
    logEntriesByType: Record<string, number>;
  };
  
  paths: {
    currentProjectPath: string;
    rootFolderCount: number;
    assetCount: number;
  };
  
  settingsDigest: {
    provider: string;
    fontSize: string;
    compactMode: boolean;
    showGrid: boolean;
  };
  
  projects: {
    count: number;
    recentCount: number;
  };
  
  derived: {
    deviceTier: 'low' | 'medium' | 'high' | 'unknown';
    connectivityTier: 'slow' | '3g' | '4g' | 'unknown';
  };
  
  health: {
    status: 'ok' | 'degraded' | 'error';
    services: Array<{ name: string; status: string; message?: string }>;
    checkedAt: number;
  } | null;
}
```

### 4.2 Error Event

```typescript
interface ErrorEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  clientSignature: string;       // For bug correlation
  code: string;                  // ErrorCode enum
  message: string;
  context?: {
    endpoint?: string;
    statusCode?: number;
    providerName?: string;
    jobId?: string;
  };
  synced: boolean;
}
```

---

## 5. Backend API

### 5.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/telemetry/snapshot` | Receive startup/session snapshot |
| POST | `/api/telemetry/events` | Batch error events (up to 50 per request) |
| GET | `/api/health` | Server health: DB status, Redis status, app uptime |

### 5.2 Prisma Models

```prisma
model TelemetrySnapshot {
  id              String   @id @default(cuid())
  sessionId       String
  clientSignature String
  deviceId        String?
  
  platform        String?
  screenWidth     Int?
  screenHeight    Int?
  deviceTier      String?
  connectivityTier String?
  
  sessionStartedAt  DateTime
  sessionDurationMs Int
  
  generationsCount  Int @default(0)
  importsCount      Int @default(0)
  exportsCount      Int @default(0)
  projectsOpened    Int @default(0)
  canvasItems       Int @default(0)
  
  healthStatus    String?
  healthCheckedAt DateTime?
  
  appVersion      String?
  createdAt       DateTime @default(now())
}

model ErrorEvent {
  id              String   @id @default(cuid())
  sessionId       String
  clientSignature String
  code            String
  message         String   @db.Text
  context         Json?
  createdAt       DateTime @default(now())
  synced          Boolean  @default(false)
}
```

---

## 6. Performance Monitoring

### 6.1 Key Metrics Tracked

| Metric | Source | Target | Alert Threshold |
|--------|--------|--------|-----------------|
| Canvas FPS | `requestAnimationFrame` loop | 60fps | < 30fps for > 5s |
| API response time | `fetch` interceptor | < 2s | > 10s (timeout) |
| localStorage usage | `navigator.storage.estimate()` | < 8MB | > 9MB (90% quota) |
| Memory usage | `performance.memory` (Chrome) | < 100MB | > 200MB |
| Generation success rate | `logStore` counts | > 95% | < 80% |
| Sync success rate | `telemetryStore` | > 99% | < 90% |

### 6.2 Error Rate Calculation

```typescript
function calculateErrorRate(logStore: LogState): number {
  const totalOps = logStore.entries.filter(e => 
    ['generation_start', 'file_import', 'file_export'].includes(e.type)
  ).length;
  const errors = logStore.entries.filter(e => 
    ['generation_fail'].includes(e.type)
  ).length;
  return totalOps > 0 ? errors / totalOps : 0;
}
```

---

## 7. Error System Integration

### 7.1 Error Flow

```
Any error (API, validation, network, runtime)
    │
    ├─► toastStore.error()         → User sees toast notification
    ├─► logStore.log(type, desc)   → Action log entry
    └─► errorStore.append(event)   → Persisted, queued for backend sync
```

### 7.2 Error Codes

```
GENERATION_FAILED    — Generic generation failure
INVALID_API_KEY      — API key rejected by provider
RATE_LIMITED         — Provider rate limit exceeded
CONTENT_FILTERED     — Content policy violation
SERVER_ERROR         — Provider server error
TIMEOUT              — Request timed out
NETWORK_ERROR        — Client network failure
VALIDATION_ERROR     — Invalid request parameters
HEALTH_CHECK_FAILED  — Server health check failed
SYNC_FAILED          — Data sync to backend failed
STORAGE_QUOTA_EXCEEDED — localStorage/IndexedDB full
UNKNOWN_ERROR        — Uncategorized error
```

---

## 8. Privacy & Security

- **No PII in telemetry**: No email, name, IP (IP may be logged server-side for security only)
- **User control**: Settings → Usage → Telemetry toggle (off = no sync, local collection still allowed for debugging)
- **Data retention**: Backend retains 90 days by default
- **Reset**: User can clear telemetry and error stores from Settings → Usage
- **Encryption**: Sensitive context fields encrypted before sync

---

## 9. Implementation Status

| Component | Status |
|-----------|--------|
| Client signature computation | ✅ Complete |
| Device info gathering | ✅ Complete |
| Telemetry store | ✅ Complete |
| Error store | ✅ Complete |
| Startup pipeline (gather → digest → store → sync) | ✅ Complete |
| API endpoints (`/api/telemetry/*`) | ✅ Complete |
| Prisma models (TelemetrySnapshot, ErrorEvent) | ⬜ Planned |
| Backend sync retry with backoff | ⬜ Planned |
| Periodic incremental sync | ⬜ Planned |
| Performance metrics (FPS, memory) | ⬜ Planned |
| Health ↔ error correlation | ⬜ Planned |

---

*This document should be updated as new data sources, error types, and performance metrics are added.*
