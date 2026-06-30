# ArsTechnicAI Test Results & Benchmark Specs

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> **Test Framework**: Vitest v1.6.1 · **Environment**: JSDOM · **Runtime**: Deno 2.6.x + Next.js 14.2.15

---

## Summary

| Metric | Value |
|--------|-------|
| **Test Files** | 9 passed |
| **Total Tests** | 217 passed |
| **Duration** | 1.35s |
| **Exit Code** | 0 (Success) |

---

## Coverage Report

### Overall Coverage

| Metric | Coverage | Target |
|--------|----------|--------|
| Statements | 28.42% | 60% → 80% |
| Branches | 82.98% | 85% |
| Functions | 82.17% | 85% |
| Lines | 28.42% | 60% → 80% |

### Store Coverage (Target: 95%)

| Store | Statements | Branches | Functions | Lines |
|-------|------------|----------|-----------|-------|
| `canvasStore.ts` | **100%** | 97.87% | **100%** | **100%** |
| `settingsStore.ts` | **100%** | **100%** | **100%** | **100%** |
| `toastStore.ts` | 99.05% | 95.45% | **100%** | 99.05% |
| `generationStore.ts` | 99.01% | 83.87% | **100%** | 99.01% |
| `userStore.ts` | 92.59% | 66.66% | 91.66% | 92.59% |
| `logStore.ts` | 85.91% | 88.88% | 83.33% | 85.91% |
| `fileStore.ts` | 80.50% | 82.00% | 84.61% | 80.50% |

**Combined Store Coverage: 91.89%** ✅

### Component Coverage

Components are NOT unit tested (0% coverage). This is a known gap. Component testing requires React Testing Library integration.

### Service Layer Coverage

Service layer does not yet exist as a distinct architectural element (0% coverage). See `ARCHITECTURE.md` for the planned extraction.

---

## Test Files Detail

### 1. `tests/stores/fileStore.test.ts` (23 tests) ✅
- Asset Operations (4): Add, Get, Update, Remove
- Folder Operations (4): Create root, Create with slash, Return created, Initialize empty
- Navigation (5): Select, Clear, Toggle, Expand, Collapse
- Project Management (3): Set current, Spaces in name, Get generated path
- File Structure (4): Initialize defaults, Custom name, Create subfolders, Expand defaults
- Add Asset to Folder (3): Add to map, Expand path, Call addFileToFolder

### 2. `tests/stores/generationStore.test.ts` (17 tests) ✅
- Prompt Management (3): Set prompt, Set negative, Set dimensions
- Job Lifecycle (5): Start, Update progress, Complete, Fail, Cancel
- Job Retrieval (3): Get by ID, Non-existent, Recent jobs
- Job Management (3): Clear all, Maintain order, Reset isGenerating
- Default Values (3): Default dims, Empty prompts, Not generating

### 3. `tests/services/generation.test.ts` (43 tests) ✅
- Configuration (3), Request Validation (8), API Key Validation (4)
- Request Normalization (3), Sanitization (3), Hash Utilities (5)
- Placeholder Generation (4), Error Mapping (9), Filename Generation (3)

### 4. `tests/stores/canvasStore.test.ts` (28 tests) ✅
- Item Operations (7), Selection Management (6), Viewport Operations (5)
- Clipboard Operations (5), Z-Index Management (3), Visibility and Lock (2)

### 5. `tests/stores/settingsStore.test.ts` (14 tests) ✅
- Default Settings (1), General Settings (3), AI Provider Settings (3)
- Appearance Settings (5), Reset Settings (2)

### 6. `tests/stores/toastStore.test.ts` (24 tests) ✅
- Toast Operations (3), Type Helpers (4), With Actions (1), Duration (2)
- ERROR_CODES Validation (2), parseAPIError (12)

### 7. `tests/stores/logStore.test.ts` (27 tests) ✅
- Log Entry Creation (4), Log Types (14), Ordering (1)
- Limit Enforcement (2), Clearing (1), Undoable Flag (2), Generation Count (1), Helpers (2)

### 8. `tests/stores/userStore.test.ts` (21 tests) ✅
- Device Info (5), Project Management (6), Session Statistics (4), Security (4), Refresh (2)

### 9. `tests/api/generate.test.ts` (20 tests) ✅
- Input Validation (6), Request Structure (2), Response Structure (2)
- Error Codes (1), Visual Placeholder (3), External Services (2), API Security (2), Sanitization (2)

---

## Benchmarks & Performance Tests (Planned)

### Canvas Performance Benchmarks

| Test | Goal | Target |
|------|------|--------|
| Render 100 items | Measure FPS over 10s | ≥ 55fps |
| Render 500 items | Measure FPS over 10s | ≥ 30fps |
| Render 1000 items | Measure FPS over 10s | ≥ 20fps (DOM) / ≥ 55fps (WebGL) |
| Pan viewport (100 items) | Measure frame time | < 8ms per frame |
| Zoom viewport (100 items) | Measure frame time | < 8ms per frame |
| Resize item | Measure re-render latency | < 16ms |
| Group 50 items | Measure group creation time | < 100ms |
| Ungroup 50 items | Measure ungroup time | < 100ms |

### Explorer Benchmarks

| Test | Goal | Target |
|------|------|--------|
| Render 1000 file nodes | Measure first paint | < 200ms (virtualized) |
| Search 1000 files | Measure filter latency | < 50ms (deferred) |
| Expand deep tree (10 levels) | Measure expand time | < 100ms |
| Drag-drop asset to canvas | Measure event handling | < 50ms |

### Generation Benchmarks

| Test | Goal | Target |
|------|------|--------|
| Placeholder generation | SVG render time | < 10ms |
| API validation | Zod parse time | < 5ms |
| Image load (base64, 512×512) | Decode + render time | < 100ms |

---

## E2E Test Plan (Playwright — Future)

### Critical User Journeys

| Journey | Steps |
|---------|-------|
| **Quick Create** | Homepage → Type prompt → Select platform → Generate → Open project |
| **Canvas Edit** | Open project → Drag image to canvas → Resize → Rotate → Save |
| **Generation** | Inspector → Enter prompt → Select model → Generate → View result |
| **Export** | Canvas → Export PNG → Verify download |
| **Settings** | Open Settings → Change appearance knobs → Verify CSS variables update |
| **Offline** | Disconnect network → Edit canvas → Reconnect → Verify sync |

---

## Test Environment

### Mocked Browser APIs (in `tests/setup.ts`)

- **localStorage**: Full implementation with getItem/setItem/removeItem/clear
- **window**: Screen dimensions, viewport, devicePixelRatio, navigator
- **navigator**: Platform, userAgent, language, hardwareConcurrency, deviceMemory, connection
- **Intl.DateTimeFormat**: Timezone resolution

### Test Utilities

```typescript
createMockAsset(overrides?)       // Create mock Asset
createMockCanvasItem(overrides?)  // Create mock CanvasItem
createMockFileNode(overrides?)    // Create mock FileNode
```

---

## Running Tests

```bash
# All tests
deno task test

# Watch mode
deno task test:watch

# Coverage
deno task test:coverage

# Single file
deno task test -- tests/stores/canvasStore.test.ts
```

---

## Recommendations

### High Priority (Before Production)
1. **Add component tests** with React Testing Library (target: 60% component coverage)
2. **Add service layer tests** after service extraction (target: 80%)
3. **Add canvas performance benchmarks** (target: all passing)
4. **Add E2E tests** for critical journeys (5 journeys)
5. **Add error boundary tests** (verify graceful degradation)

### Medium Priority
6. **Add snapshot tests** for UI components
7. **Add accessibility tests** (jest-axe or pa11y)
8. **Add visual regression tests** (Percy or Chromatic)
9. **Add generation module tests** as modules go live

### Low Priority
10. **Add stress tests** (1000+ items, 100+ concurrent generations)
11. **Add cross-browser E2E** (Firefox, Safari)
12. **Add mobile viewport tests**

---

*Test results should be generated with `deno task test:coverage` and this document updated after each release.*
