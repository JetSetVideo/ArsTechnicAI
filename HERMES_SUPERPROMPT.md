# HERMES_SUPERPROMPT.md

> **Standing directive for the Hermes coding agent.**
> Read this file first on every session. Implement in phase order. Do not skip foundations.

## Quick Reference

- **Mission**: ArsTechnicAI is a browser-first creative production suite (Figma + Blender + Photoshop + ComfyUI + CapCut).
- **Prime Directive**: Prompt → media in any format → assembled short → auto-posted to social networks.
- **Tech Stack**: Deno 2, Next.js 14, React 18, TypeScript 5.5, Zustand, Prisma + PostgreSQL, Redis 7, Three.js, sharp, ffmpeg.

## Phase Checklist

### Phase 0: Foundations — IN PROGRESS

| # | Deliverable | Files | Status |
|---|------------|-------|--------|
| 0.1 | Module registry with `ModuleDef` interface | `lib/modules/registry.ts`, `types/module.ts` | [x] |
| 0.2 | Extend `PortType` to include `video`, `audio`, `3d`, `data`, `mask` | `stores/nodeStore.ts` | [x] |
| 0.3 | Format profiles for all platforms | `lib/formats/profiles.ts`, `types/format.ts` | [x] |
| 0.4 | Project bundle spec (`.arsproj/` manifest) | `lib/project/bundle.ts` | [x] |
| 0.5 | Blueprint types and store | `types/blueprint.ts`, `stores/blueprintStore.ts` | [x] |
| 0.6 | Disk → store reconciliation on startup | `hooks/useDiskReconciliation.ts` (extend) | [x] |

**Definition of Done (Phase 0)**:
- [x] `deno task type-check` passes (pre-existing bcryptjs stub issue only)
- [x] Module registry lists all module IDs from Section 6 (stubs OK)
- [x] Format profiles exportable as JSON
- [x] Project bundle can be written and read from disk

### Phase 1: Read Everything — PENDING

| # | Deliverable | Files | Status |
|---|------------|-------|--------|
| 1.1 | Universal file import module | `lib/modules/ingest/import-file.ts` | [ ] |
| 1.2 | Image decoder + metadata | `lib/modules/ingest/decode-image.ts` | [ ] |
| 1.3 | Video decoder + filmstrip | `lib/modules/ingest/decode-video.ts` | [ ] |
| 1.4 | Audio decoder + waveform | `lib/modules/ingest/decode-audio.ts` | [ ] |
| 1.5 | Text/data parser (SRT, JSON, CSV, MD) | `lib/modules/ingest/decode-text.ts` | [ ] |
| 1.6 | Metadata + thumbnail extraction | `lib/media/processor.ts` (extend) | [ ] |
| 1.7 | Explorer: show all asset types with correct icons/previews | `components/layout/ExplorerPanel.tsx` | [ ] |
| 1.8 | Drag any file type to canvas | `components/layout/Canvas.tsx`, `stores/canvasStore.ts` | [ ] |

### Phase 2: Image Edit Modules — PENDING
### Phase 3: Video Engine + Timeline Playback — PENDING
### Phase 4: Audio Engine — PENDING
### Phase 5: 3D + Gaussian Splat — PENDING
### Phase 6: Intelligence Modules — PENDING
### Phase 7: Blueprints + Agents — PENDING
### Phase 8: Automations + Scheduler + Social Posting — PENDING

---

## Full Specification

See the complete HERMES_SUPERPROMPT document in the conversation history for:
- Sections 1–7: Mission, Guardrails, Domain Vocabulary, Media & Format Matrix, Architecture, Module Catalog, Agents/Blueprints/Automations
- Section 9: Data Model Extensions
- Section 10: Definition of Done & How to Extend

Key rules:
1. Offline-first: localStorage → disk → PostgreSQL
2. Provider abstraction: all AI calls go through `lib/ai/base-provider.ts` → `registry.ts`
3. Module composability: every processing unit is a Module callable from NodeGraph and headless automations
4. Naming: PascalCase components, `useX` hooks, `xStore.ts`, REST API routes under `pages/api/`
5. Commit convention: `feat:`, `fix:`, `refactor:`, `docs:`
