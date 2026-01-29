# Ars TechnicAI

A **desktop-grade, browser-delivered creative production suite** for authoring **prompts, images, videos, comics, and AI-assisted pipelines**—with a **file-manager-class asset explorer**, an **infinite node canvas**, and a **multi‑track timeline**.

This repository is the foundation UI: **Next.js 14** running on **Deno 2** (Deno executes `npm:next`), written in **TypeScript** with **CSS Variables + CSS Modules**.

> **Provider note**: Ars TechnicAI is designed to integrate multiple third‑party AI providers (e.g. Midjourney, Higgsfield, “Nano banana”, etc.). Provider names are typically trademarks of their owners and are used here descriptively. Ars TechnicAI is **not affiliated** with them. You must comply with each provider’s Terms of Service and content policies.

---

## What Ars TechnicAI is

Ars TechnicAI is an **AI production IDE** that treats media creation as a **graph + timeline problem**:

- **Explorer (left)**: your local and project assets (files, prompts, presets, characters, scenes), with pro‑grade UX (search, tags, filters, rename, batch ops, drag‑drop).
- **Infinite Canvas (center)**: a **node/blueprint canvas** where assets are arranged as a **pipeline** (prompt → references → generation jobs → edits → versions → exports).
- **Inspector (right)**: contextual properties, parameters, metadata, and generation settings for the current selection.
- **Timeline (bottom, inside main workspace)**: multi‑track sequencing (video/audio/text/fx), scrubbing with a **red playhead**, markers, and clip-level parameters.
- **Top Bar (global)**: mode switcher (Image Create / Image Rework / Video / Comic / 3D Scene), command palette, project controls, user/account, settings.

---

## Core concepts

- **Project**: the top-level container for assets, graph state, timeline edits, and exports.
- **Asset**: any managed entity (file, prompt template, generated image/video, LUT, preset, character profile, sound, etc.).
- **Node**: a canvas block representing an operation or asset (Prompt, Reference Set, Provider Call, Edit, Upscale, Color Grade, Merge, Export…).
- **Edge**: typed connections between nodes (e.g., prompt text → provider call; image → inpaint; video → stabilize).
- **Job / Run**: an execution instance of a node or subgraph; supports queuing, cancellation, retries, and provenance.
- **Version / Variant**: branches of assets and edits; supports “variations” and comparison.
- **Provider**: a pluggable integration (REST/WebSocket/SDK) with unified job tracking and cost/latency reporting.

---

## UI architecture (target)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Mode switch • Command palette • Project • User • Settings             │
├───────────────┬───────────────────────────────────────────────┬───────────────┤
│ LEFT PANEL    │ MAIN WORKSPACE (infinite canvas + overlay UI) │ RIGHT PANEL   │
│ Explorer      │  - Canvas graph / blueprint                    │ Inspector     │
│ Search/Filter │  - Selection + snapping + minimap              │ Parameters    │
│ Tree/Tags     │  - Drag assets in • connect • comment          │ Metadata      │
├───────────────┴───────────────────────────────────────────────┴───────────────┤
│ TIMELINE (inside workspace): tracks • clips • markers • red playhead • zoom    │
└───────────────────────────────────────────────────────────────────────────────┘
```

For detailed component specs and CSS terms, see `Design.md`.

---

## Tech stack (current repo)

- **Runtime**: Deno 2 (`deno task dev` runs `npm:next@14.2.15`)
- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript (strict)
- **UI**: React 18
- **Styling**: CSS Variables + CSS Modules

> Planned (not necessarily implemented yet): Zustand for state, Framer Motion for micro-interactions, Three.js/WebGL for canvas shaders/transitions, WebAudio for waveforms, ffmpeg-based processing (server-side or native wrapper), provider SDK adapters.

---

## Getting started

### Prerequisites

- Deno 2 installed (`deno -V`)

### Install & run

```bash
deno task install
deno task dev
```

### Production build

```bash
deno task build
deno task start
```

---

## Environment variables (planned integrations)

Create `.env.local` (Next.js convention) for provider credentials. Example names (subject to change as adapters land):

```bash
# Example provider keys (do not commit secrets)
ARSTECHNICAI_MIDJOURNEY_API_KEY=
ARSTECHNICAI_HIGGSFIELD_API_KEY=
ARSTECHNICAI_NANOBANANA_API_KEY=

# Optional: telemetry / error reporting
ARSTECHNICAI_SENTRY_DSN=
```

---

## Repository map

Current structure (early-stage):

- `pages/`: Next.js routes
- `styles/`: global CSS + CSS Modules
- `deno.json`: Deno tasks (authoritative dev workflow)

Target structure and module boundaries are documented in `Structure.md`.

---

## Product roadmap (high level)

- **Phase 0 (foundation UI)**: app shell, docking panels, resizers, command palette, theming, accessibility baseline.
- **Phase 1 (assets + canvas)**: explorer CRUD, tagging, drag/drop, canvas nodes/edges, graph serialization, undo/redo.
- **Phase 2 (timeline)**: tracks/clips, scrubbing, markers, basic transforms/effects, preview player.
- **Phase 3 (providers)**: adapter interfaces, job orchestration, history, cost tracking, provider-specific capabilities.
- **Phase 4 (workflow)**: characters/scenes/dialogues/voices, template libraries, batch generation, render/export pipeline.

---

## Accessibility & input model

Ars TechnicAI is designed to be **keyboard-first** with **mouse precision**:

- Full focus management, roving tab index for lists/trees, ARIA roles for tree/grid/menus
- Predictable shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+P, Cmd/Ctrl+Z, Shift modifiers)
- Hit target sizing, high contrast mode, reduced motion support

See `Design.md` for the full interaction spec.

---

## License

MIT — see `LICENSE`.

