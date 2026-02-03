# Ars TechnicAI — Repository & Module Structure

This document describes how Ars TechnicAI's codebase and product modules are organized. It is the "map" that `README.md` and `Design.md` reference.

> **See also**: `ARCHITECTURE.md` for critical analysis and technical roadmap.

---

## Current Implementation (February 2026)

The repository is a **Next.js 14 Pages Router** app executed via **Deno 2** tasks, with **Zustand** for state management.

### Actual Structure

```
/
├── components/
│   ├── layout/              # App shell components
│   │   ├── AppShell.tsx     # Root layout orchestrator
│   │   ├── TopBar.tsx       # Global navigation
│   │   ├── ExplorerPanel.tsx# Left panel - file tree
│   │   ├── Canvas.tsx       # Main infinite canvas
│   │   ├── InspectorPanel.tsx# Right panel - properties
│   │   ├── Timeline.tsx     # Bottom panel - video timeline
│   │   ├── ActionLog.tsx    # Floating activity log
│   │   └── SettingsModal.tsx# Settings dialog
│   └── ui/                  # Reusable primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── SearchBar.tsx
│       └── Toast.tsx        # Notification system
├── stores/                  # Zustand state management
│   ├── canvasStore.ts       # Canvas items, viewport, selection
│   ├── fileStore.ts         # File tree, assets (with persistence)
│   ├── generationStore.ts   # AI job queue
│   ├── logStore.ts          # Action history
│   ├── settingsStore.ts     # App config (with persistence)
│   ├── toastStore.ts        # Notifications + error codes
│   ├── userStore.ts         # Session + device info
│   └── index.ts             # Barrel exports
├── pages/
│   ├── _app.tsx             # App wrapper
│   ├── _document.tsx        # HTML document
│   ├── index.tsx            # Main entry
│   └── api/
│       ├── generate.ts      # AI generation endpoint
│       └── test-image.ts    # Debug endpoint
├── types/
│   └── index.ts             # All TypeScript definitions
├── styles/
│   ├── globals.css          # Design tokens + reset
│   └── Home.module.css
└── [config files]
```

### Store Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Component Layer                          │
│  TopBar │ Explorer │ Canvas │ Inspector │ Timeline │ Modal  │
└────────────────────────┬────────────────────────────────────┘
                         │ useStore hooks
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Zustand Stores                          │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ canvas   │ file     │ settings │ log      │ toast │ user   │
│ Store    │ Store    │ Store    │ Store    │ Store │ Store  │
├──────────┴──────────┴──────────┴──────────┴────────────────┤
│                   Persistence Layer                          │
│            localStorage with custom serializers              │
└─────────────────────────────────────────────────────────────┘
```

---

## Target Structure (Recommended Refactor)

To improve maintainability and enable testing, evolve toward this structure:

```
/
├── src/
│   ├── core/                    # Framework-agnostic business logic
│   │   ├── generation/          # AI generation service
│   │   │   ├── GenerationService.ts
│   │   │   ├── providers/       # Provider adapters
│   │   │   │   ├── GoogleImagen.ts
│   │   │   │   ├── Midjourney.ts
│   │   │   │   └── index.ts
│   │   │   └── types.ts
│   │   ├── project/             # Project management
│   │   ├── export/              # Render/export pipeline
│   │   └── media/               # Media processing (ffmpeg)
│   │
│   ├── features/                # Feature modules (self-contained)
│   │   ├── explorer/
│   │   │   ├── ExplorerPanel.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── useExplorer.ts   # Feature-specific hook
│   │   │   └── explorer.module.css
│   │   ├── canvas/
│   │   ├── inspector/
│   │   ├── timeline/
│   │   └── settings/
│   │
│   ├── shared/                  # Cross-cutting concerns
│   │   ├── hooks/               # Shared React hooks
│   │   ├── utils/               # Pure utility functions
│   │   └── types/               # Shared type definitions
│   │
│   ├── ui/                      # Design system
│   │   ├── primitives/          # Button, Input, etc.
│   │   ├── patterns/            # Compound components
│   │   └── tokens/              # CSS variable definitions
│   │
│   └── stores/                  # State management
│       ├── canvas/
│       ├── files/
│       └── ...
│
├── pages/                       # Next.js routes (thin wrappers)
├── styles/                      # Global CSS
├── public/                      # Static assets
└── tests/                       # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Product Modules (Boundaries)

### 1) App Shell

| Component | Status | Lines | Notes |
|-----------|--------|-------|-------|
| AppShell.tsx | ✅ | ~80 | Well-sized |
| TopBar.tsx | ⚠️ | ~370 | Consider splitting |

**Responsibilities**:
- Layout: top bar + panels + workspace
- Docking/resizing
- Command palette (planned)
- Global toasts/dialogs

### 2) Explorer (Left Panel)

| Feature | Status |
|---------|--------|
| File tree | ✅ Complete |
| Search/filter | ✅ Complete |
| Drag-drop source | ✅ Complete |
| Virtualized list | ❌ Needed |

**Responsibilities**:
- File-tree + virtualized list
- Tagging + search + filters
- Import/export, rename, link, duplicate
- Drag/drop source for canvas and timeline

### 3) Canvas (Main)

| Feature | Status |
|---------|--------|
| Infinite pan/zoom | ✅ Complete |
| Item management | ✅ Complete |
| Selection | ✅ Complete |
| Nodes + edges | ❌ Future |
| Undo/redo | ⚠️ Logged only |

**Responsibilities**:
- Infinite pan/zoom
- Nodes + ports + edges (future)
- Node palette + contextual actions
- Comments/frames (grouping)
- Undo/redo + graph serialization

### 4) Inspector (Right Panel)

| Feature | Status |
|---------|--------|
| Generation form | ✅ Complete |
| Property editing | ✅ Complete |
| Provenance/history | ⚠️ Partial |

**Responsibilities**:
- Properties for selection (asset/node/clip)
- Provider/model parameters
- Effect stacks + transforms (non-destructive)
- Provenance/history

### 5) Timeline (Bottom)

| Feature | Status |
|---------|--------|
| Tracks UI | ✅ Complete |
| Playhead | ✅ Complete |
| Actual playback | ❌ Needed |
| Audio waveforms | ❌ Needed |

**Responsibilities**:
- Tracks/clips/markers/playhead
- Scrubbing and zooming
- Clip trimming + snapping
- Export surface (render settings)

### 6) Providers & Jobs (Service Layer)

| Feature | Status |
|---------|--------|
| Google Imagen | ✅ Complete |
| Job queue | ✅ Basic |
| Retry/cancel | ⚠️ Partial |
| Multi-provider | ❌ Foundation only |

**Responsibilities**:
- Provider adapters (capabilities, schemas)
- Job orchestration (queue, cancel, retry, status)
- Provenance recording

---

## Naming Conventions

| Entity | Convention | Example |
|--------|------------|---------|
| React components | PascalCase.tsx | `TopBar.tsx` |
| Hooks | useThing.ts | `useCanvas.ts` |
| CSS Modules | Component.module.css | `Button.module.css` |
| Stores | thingStore.ts | `canvasStore.ts` |
| Types | PascalCase | `CanvasItem` |
| Actions | camelCase verbs | `addItem`, `removeSelected` |

---

## Data Flow Patterns

### Generation Flow
```
InspectorPanel.handleGenerate()
  → Validates inputs
  → generationStore.startGeneration()
  → fetch('/api/generate')
  → API validates & calls Google Imagen
  → Returns dataUrl
  → canvasStore.addItem()
  → fileStore.addAssetToFolder()
  → logStore.log()
  → toastStore.success()
```

### Import Flow
```
ExplorerPanel.handleFileChange()
  → fileStore.importFiles()
  → Creates ImageAsset[]
  → Updates tree structure
  → logStore.log()
```

---

## Documentation Conventions

| Document | Purpose |
|----------|---------|
| `README.md` | What it is + how to run |
| `Design.md` | UI/UX + CSS + interaction specs |
| `Prompt.md` | PRD + feature inventory |
| `Structure.md` | Boundaries and file layout (this doc) |
| `ARCHITECTURE.md` | **Critical analysis + technical roadmap** |
