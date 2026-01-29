# Ars TechnicAI — Repository & Module Structure

This document describes how Ars TechnicAI’s codebase and product modules are organized. It is the “map” that `README.md` and `Design.md` reference.

---

## Current repo (today)

This repository is currently a **Next.js Pages Router** app, executed via **Deno 2** tasks.

- `deno.json`: authoritative dev tasks
- `pages/`: routes
- `styles/`: global tokens + CSS Modules

---

## Target structure (recommended as the app grows)

When the UI starts to include the full app shell (panels/canvas/timeline), move to a clearer module layout:

```
/
├── pages/                      # routes (or migrate to /app later)
├── src/
│   ├── app/                    # app shell wiring (Topbar/Left/Main/Right/Timeline)
│   ├── ui/                     # reusable UI primitives (Button, Input, Menu, Tabs…)
│   ├── features/               # feature modules (explorer, canvas, inspector, timeline)
│   │   ├── explorer/
│   │   ├── canvas/
│   │   ├── inspector/
│   │   └── timeline/
│   ├── domain/                 # types and domain logic (assets, projects, prompts, jobs)
│   ├── services/               # providers/adapters, persistence, media processing
│   ├── state/                  # stores (e.g., zustand) + selectors
│   ├── utils/                  # shared utilities
│   └── styles/                 # tokens + shared css (optional)
├── styles/                     # keep for Next global styles (or move into src/styles)
└── public/                     # icons, static assets
```

---

## Product modules (boundaries)

### 1) App Shell

- Layout: top bar + panels + workspace
- Docking/resizing
- Command palette
- Global toasts/dialogs

### 2) Explorer (Left Panel)

- File-tree + virtualized list
- Tagging + search + filters
- Import/export, rename, link, duplicate
- Drag/drop source for canvas and timeline

### 3) Canvas (Main)

- Infinite pan/zoom
- Nodes + ports + edges
- Node palette + contextual actions
- Comments/frames (grouping)
- Undo/redo + graph serialization

### 4) Inspector (Right Panel)

- Properties for selection (asset/node/clip)
- Provider/model parameters
- Effect stacks + transforms (non-destructive)
- Provenance/history

### 5) Timeline (Bottom)

- Tracks/clips/markers/playhead
- Scrubbing and zooming
- Clip trimming + snapping
- Export surface (render settings)

### 6) Providers & Jobs (Service Layer)

- Provider adapters (capabilities, schemas)
- Job orchestration (queue, cancel, retry, status)
- Provenance recording

---

## Naming conventions

- **React components**: `PascalCase.tsx` (e.g., `TopBar.tsx`)
- **Hooks**: `useThing.ts`
- **CSS Modules**: `Component.module.css`
- **Domain types**: `src/domain/*.ts` with explicit exports
- **Events/actions**: prefer verbs (`renameAsset`, `runNode`, `cancelJob`)

---

## Documentation conventions

- `README.md`: what it is + how to run it
- `Design.md`: UI/UX + CSS + interaction specs
- `Prompt.md`: PRD + feature inventory
- `Structure.md`: boundaries and file layout (this doc)

