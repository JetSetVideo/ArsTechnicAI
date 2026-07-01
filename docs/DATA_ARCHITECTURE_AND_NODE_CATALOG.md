# Data Architecture, Persistence, and Complete Node Catalog

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> This document defines the complete data ontology of ArsTechnicAI: every entity type, every relation, every persistence layer, every node type (current + planned), and the import/export architecture.

---

## 1. Persistence Layer Architecture

### 1.1 Five-Tier Persistence

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: localStorage (Browser)                             │
│ ────────────────────────────────────                         │
│ • Zustand persist middleware                                 │
│ • Stores: canvas, settings, projects, files, user, log      │
│ • Data: metadata, small JSON, base64 images (temporary)     │
│ • Quota: 5-10MB per origin                                  │
│ • Strategy: metadata-only; migrate large blobs to IndexedDB │
├─────────────────────────────────────────────────────────────┤
│ LAYER 2: IndexedDB (Browser) — PLANNED                      │
│ ────────────────────────────────────                         │
│ • Binary asset storage (images, audio, video frames)        │
│ • Unlimited quota (user-granted)                            │
│ • Async API, works in Web Workers                           │
│ • Schema: assetId → Blob + metadata                         │
├─────────────────────────────────────────────────────────────┤
│ LAYER 3: Filesystem (Server)                                │
│ ────────────────────────────────                             │
│ • /storage/projects/{id}/manifest.json                      │
│ • /storage/projects/{id}/canvas.json                        │
│ • /storage/projects/{id}/assets/*.{png,mp4,mp3}             │
│ • /storage/projects/{id}/assets/*.meta.json (sidecar)       │
│ • /storage/projects/{id}/generated/                         │
│ • /storage/projects/{id}/exports/                           │
├─────────────────────────────────────────────────────────────┤
│ LAYER 4: PostgreSQL (Server) — Prisma ORM                   │
│ ────────────────────────────────────                         │
│ • Structured data: users, projects, assets, jobs, versions  │
│ • Asset metadata (not binaries)                             │
│ • pgvector embeddings for semantic search                   │
│ • Relations, indexes, constraints                           │
├─────────────────────────────────────────────────────────────┤
│ LAYER 5: Redis (Server)                                     │
│ ─────────────────────────                                   │
│ • Session cache (NextAuth)                                  │
│ • Job queue (BullMQ — future)                               │
│ • Rate limit counters                                       │
│ • PubSub for real-time updates (future)                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Startup Hydration Order

```
App Mount (_app.tsx)
  │
  ├─► 1. Try localStorage (instant — Zustand persist rehydrates)
  │      • If fresh load → empty stores
  │
  ├─► 2. Try disk (via /api/workspace/load)
  │      • If file exist → merge into stores (disk has higher authority)
  │
  ├─► 3. Try database (via /api/projects/[id]/canvas)
  │      • If authenticated + DB reachable → hydrate from DB
  │
  └─► 4. Reconcile: disk files → virtual file tree → stores
         • Scan /storage for files not in stores → upsert FileNodes
```

---

## 2. Complete Entity Catalog

### 2.1 Canvas Items (`CanvasItem.type`)

#### Current (Implemented)

| Type | Description |
|------|-------------|
| `image` | Imported or referenced raster/vector preview from Explorer |
| `generated` | AI output carrying `generationMeta` (prompt, seed, model, etc.) |
| `placeholder` | Reserved/loading/layout stub |
| `video` | Video clip on canvas |
| `audio` | Audio waveform/clip |
| `text` | Rich text/caption/title card |
| `template` | Prompt template reference |

#### Planned Extensions

| Type | Description | Priority |
|------|-------------|----------|
| `shape` | Vector primitive (rect, ellipse, arrow, line, polygon) | 🟠 High |
| `group` | Container for transforms (groups children) | 🔴 Critical |
| `annotation` | Arrows, masks, regions of interest | 🟡 Medium |
| `web` | Embedded preview (URL/iframe bounds) | 🟢 Low |
| `3d` | GLTF/mesh placeholder with Three.js preview | 🟡 Medium |
| `splat` | Gaussian splat point cloud placeholder | 🟢 Low |
| `reference` | Non-destructive link to library asset | 🟡 Medium |
| `connection-dot` | Interactive node-link anchor point | 🔴 Critical |
| `frame` | Figma-like frame container with title | 🟡 Medium |
| `puppet` | Skeletal animation puppet node | 🟡 Medium |
| `camera` | 3D camera rig with recorded path | 🟡 Medium |

### 2.2 Workflow Graph Nodes (`NodeType`)

#### Current (Implemented)

| Node Type | Purpose |
|-----------|---------|
| `prompt` | Text prompt source |
| `negative` | Negative prompt source |
| `generator` | Image generation from prompts |
| `image-in` | Import image into the graph |
| `transform` | Scale/rotate/flip |
| `blend` | Composite two images |
| `output` | Sink/export artifact |

#### Planned Extensions (Complete Catalog)

```typescript
type NodeType =
  // Inputs
  | 'prompt' | 'negative' | 'image-in' | 'video-in' | 'audio-in'
  | 'text-in' | '3d-in' | 'splat-in' | 'palette-in' | 'script-in'
  | 'storyboard-in' | 'reference-in' | 'parameter' | 'constant'
  
  // Generation
  | 'generator' | 'video-gen' | 'audio-gen' | '3d-gen' | 'llm'
  | 'tts' | 'music-gen' | 'sfx-gen'
  
  // Transform
  | 'transform' | 'blend' | 'resize' | 'crop' | 'pad' | 'flip'
  | 'rotate' | 'stabilize' | 'time-remap' | 'split' | 'merge'
  
  // AI Editing
  | 'upscale' | 'inpaint' | 'outpaint' | 'style-transfer'
  | 'remove-bg' | 'face-swap' | 'depth-estimate' | 'segment'
  | 'color-grade' | 'color-analysis' | 'auto-wb' | 'palette-extract'
  | 'deforum' | 'controlnet' | 'lora' | 'ip-adapter'
  
  // 3D / Spatial
  | '3d-scene' | 'camera-rig' | 'puppet' | 'render-pass'
  
  // Organization
  | 'frame' | 'group' | 'comment' | 'bookmark' | 'reference-board'
  | 'sub-graph'
  
  // Control Flow
  | 'switch' | 'batch' | 'loop' | 'delay'
  
  // Output
  | 'output' | 'export-image' | 'export-video' | 'export-comic'
  | 'publish' | 'format-transcode'
  
  // Intelligence
  | 'auto-tag' | 'storyboard-gen' | 'character-consistency'
  | 'script-to-shot' | 'shot-to-image';
```

### 2.3 Port Types

```typescript
type PortType =
  | 'image'    // Raster image data
  | 'video'    // Video clip/frames
  | 'audio'    // Audio waveform
  | 'text'     // String or structured text (SRT, MD, JSON)
  | 'data'     // Arbitrary structured data (JSON)
  | '3d'       // 3D model reference
  | 'splat'    // Gaussian splat data
  | 'mask'     // Alpha mask / segmentation mask
  | 'palette'  // Color palette (array of hex)
  | 'prompt'   // Prompt template + variables
  | 'parameter' // Numeric or enum parameter
  | 'trigger'  // Execution signal
  | 'any';     // Wildcard (accepts anything)
```

### 2.4 Asset Types (`AssetType`)

```typescript
type AssetType =
  // Media (deliverables)
  | 'image' | 'video' | 'audio' | 'text'
  // 3D / Spatial
  | 'model_3d' | 'splat'
  // Derived / Processing Artifacts
  | 'waveform' | 'filmstrip' | 'subtitle' | 'lut'
  // Prompt Engineering
  | 'prompt' | 'vocabulary' | 'preset' | 'template'
  // Pre-Production (Author's Vision Inputs)
  | 'script'        // Screenplay, treatment, or dialogue text
  | 'storyboard'    // Ordered shot frames or animatic
  | 'shot'          // Individual shot node (camera spec + action + dialogue cue)
  | 'character'     // Character profile: appearance, voice, wardrobe, arc
  | 'scene'         // Location + time-of-day + atmosphere + props
  | 'mood_board'    // Reference image grid + color palette per chapter/scene
  | 'color_script'  // Per-scene mood swatch progression showing atmosphere arc
  | 'reference'     // Inspiration image / style frame (non-deliverable)
  | 'palette'       // Extracted or manually created color palette
  // Organizational
  | 'folder' | 'project' | 'blueprint';
```

### 2.5 Asset Origin (`AssetOrigin`)

Every asset carries an `origin` field used for color-coding across all views (Explorer, Canvas, Layers Panel, Timeline):

```typescript
type AssetOrigin =
  | 'inspiration'  // Imported for reference, not a deliverable (amber: --a-tertiary)
  | 'manual'       // Created directly by the author (blue: --e-original)
  | 'imported'     // From external filesystem or URL (green: --e-imported)
  | 'generated'    // AI output with provenance metadata (lavender: --t-prompt)
  | 'remixed'      // Derived/edited from a generated asset (red: --e-user-added)
  | 'assembled';   // Composed from multiple sources in the timeline (purple: --t-video)
```

**Origin in practice**:
- When a user drags a reference photo from their Desktop → `origin: 'inspiration'`
- When a user sketches in the draw tool → `origin: 'manual'`
- When a user imports a stock photo they licensed → `origin: 'imported'`
- When Imagen generates an image → `origin: 'generated'`
- When a user inpaints a generated image → `origin: 'remixed'`
- When a project is exported as a final video → `origin: 'assembled'`

### 2.5 Media Format Matrix

| Format | Extensions | MIME | Can Generate? | Can Edit? | Timeline Support |
|--------|-----------|------|--------------|-----------|-----------------|
| PNG | .png | image/png | ✅ | ✅ | ✅ (frame) |
| JPEG | .jpg, .jpeg | image/jpeg | ✅ | ✅ | ✅ |
| WebP | .webp | image/webp | ✅ | ✅ | ✅ |
| EXR | .exr | image/x-exr | ✅ | ✅ (color grade) | ❌ |
| HDR | .hdr | image/vnd.radiance | ✅ | ✅ (color grade) | ❌ |
| SVG | .svg | image/svg+xml | ❌ | ✅ | ✅ |
| MP4 | .mp4 | video/mp4 | Planned | Planned | ✅ Primary |
| WebM | .webm | video/webm | Planned | Planned | ✅ |
| MOV | .mov | video/quicktime | ❌ | Planned | ✅ |
| WAV | .wav | audio/wav | Planned | Planned | ✅ |
| MP3 | .mp3 | audio/mpeg | Planned | Planned | ✅ |
| AAC | .aac | audio/aac | Planned | Planned | ✅ |
| SRT | .srt | application/x-subrip | ❌ | ✅ | ✅ (captions) |
| VTT | .vtt | text/vtt | ❌ | ✅ | ✅ (captions) |
| MD | .md | text/markdown | ❌ | ✅ | ❌ |
| JSON | .json | application/json | ❌ | ✅ | ❌ |
| CSV | .csv | text/csv | ❌ | ✅ | ❌ |
| GLTF | .gltf, .glb | model/gltf+json | Planned | ✅ | ❌ |
| OBJ | .obj | model/obj | ❌ | ✅ | ❌ |
| PLY | .ply | model/ply | ❌ | ✅ | ❌ |
| ZIP | .zip | application/zip | ❌ | ❌ (explode) | ❌ |

---

## 3. Relation Graph (Complete)

### 3.1 Entity Relationship Diagram

```
User ───1:N──▶ Project
  │               │
  │               ├──1:N──▶ CanvasItem
  │               │            │
  │               │            ├──references──▶ Asset
  │               │            │
  │               │            └──part of──▶ Group (CanvasItem type='group')
  │               │
  │               ├──1:N──▶ Asset
  │               │            │
  │               │            ├──has parent──▶ Asset (self-referential)
  │               │            ├──has children──▶ Asset[]
  │               │            ├──generated by──▶ GenerationJob
  │               │            └──produced by──▶ AIProvider
  │               │
  │               ├──1:N──▶ TimelineTrack
  │               │            │
  │               │            └──1:N──▶ TimelineClip
  │               │                        │
  │               │                        └──references──▶ Asset
  │               │
  │               ├──1:N──▶ Version (snapshot)
  │               │
  │               ├──1:N──▶ PublishJob
  │               │            │
  │               │            └──targets──▶ PublishPlatform
  │               │
  │               └──1:N──▶ NodeConnection (graph edges)
  │
  ├──1:N──▶ Session
  │            │
  │            └──tracks──▶ Device
  │
  └──1:N──▶ UserSettings
```

### 3.2 Relation Types (exhaustive)

| Relation | From | To | Cardinality | Purpose |
|----------|------|----|-------------|---------|
| **Ownership** | User | Project | 1:N | User owns projects |
| **Containment** | Project | CanvasItem | 1:N | Project contains canvas items |
| **Containment** | Project | Asset | 1:N | Project contains assets |
| **Containment** | Project | TimelineTrack | 1:N | Project has timeline tracks |
| **Containment** | TimelineTrack | TimelineClip | 1:N | Track contains clips |
| **Containment** | Group | CanvasItem | 1:N | Group wraps items |
| **Reference** | CanvasItem | Asset | N:1 | Item references an asset |
| **Reference** | TimelineClip | Asset | N:1 | Clip references an asset |
| **Lineage** | Asset | Asset | N:1 | Parent-child (generation/edit chain) |
| **Variation** | Asset | Asset | 1:N | Source → variant images |
| **Generation** | Asset | GenerationJob | N:1 | Asset produced by a job |
| **Version** | Project | Version | 1:N | Project has version snapshots |
| **Publishing** | Project | PublishJob | 1:N | Project has publishing jobs |
| **Connection** | NodeConnection | Node (graph) | N:2 | Graph edge connects two nodes |
| **Grouping** | Asset | Group | N:M | Assets belong to groups |
| **Tagging** | Asset | Tag | N:M | Assets have tags |
| **Usage** | Asset | Project | N:M | Asset used in projects (junction) |

---

## 4. Project Bundle Format (`.arsproj`)

### 4.1 Directory Structure

```
MyProject.arsproj/
├── manifest.json               # Version, app build, checksums, created/modified dates
├── workspace.json              # Panel layout, mode, viewport state
├── canvas.json                 # All CanvasItems: id, type, x, y, w, h, rotation, zIndex, asset references
├── timeline.json               # Tracks, clips, markers, transitions
├── graph.json                  # Node graph: nodes, edges (rework mode)
├── project.json                # Project metadata: name, type, synopsis, logline, tags, aspect ratio, genre
│
├── pre-production/             # Author's Vision Pipeline inputs
│   ├── script.md              # Screenplay or treatment (formatted Markdown)
│   ├── shot-list.json         # Array of shot nodes: camera, action, duration, dialogue cue
│   ├── storyboard.json        # Ordered storyboard frames referencing generated images
│   ├── animatic.json          # Rough sequence of storyboard frames with timing
│   ├── color-script.json      # Per-scene mood swatch array
│   ├── characters/            # Character profile JSONs
│   │   └── {name}.character.json   # name, appearance, voice, wardrobe, arc, reference images
│   └── locations/             # Location definition JSONs
│       └── {name}.location.json    # description, time-of-day, props, reference images
│
├── inspiration/               # Inspiration Assets (non-deliverables)
│   ├── mood-boards/           # Reference image grids per scene/chapter
│   ├── style-references/      # Images whose style to transfer to generation
│   ├── color-palettes/        # Extracted or manual palette JSONs
│   └── sketches/              # Author-drawn reference images
│
├── assets/
│   ├── index.json             # Asset registry: all assets with id, type, MIME, size, origin, provenance
│   ├── generated/             # AI-generated binaries
│   │   ├── gen_001.png
│   │   ├── gen_001.meta.json  # Sidecar: prompt, seed, model, generatedAt, inspirationIds
│   │   └── ...
│   ├── imports/               # User-imported deliverable files
│   ├── exports/               # Final renders
│   ├── audio/                 # Audio assets (TTS, music, SFX)
│   ├── prompts/               # Saved prompt templates (.prompt.json)
│   └── vocabulary/            # Cinematography vocab presets (.vocab.json)
│
└── versions/                  # Named snapshots
    ├── v1.json                # Canvas + timeline + graph at a point in time
    └── v2.json
```

### 4.2 Manifest Schema

```typescript
interface ProjectManifest {
  formatVersion: string;        // "1.0.0"
  appVersion: string;           // "1.0.0-alpha"
  buildId: string;              // Next.js build ID
  projectId: string;            // UUID
  projectName: string;
  projectType: ProjectType;
  createdAt: number;            // Unix timestamp
  modifiedAt: number;
  checksums: {
    canvas: string;             // SHA-256 of canvas.json
    timeline: string;
    graph: string;
    assetIndex: string;
  };
  assetCount: number;
  totalSizeBytes: number;
  dependencies: string[];       // Provider names used
}
```

---

## 5. Import/Export Architecture

### 5.1 Import Flows

```
DRAG FILE ONTO EXPLORER
  │
  ├─► If .zip or .arsproj/ → validate manifest → merge or replace
  │
  ├─► If image/video/audio → decode metadata → create Asset → add to virtual tree
  │
  └─► If JSON/CSV/MD/SRT → parse → create text Asset → add to tree

DRAG ASSET TO CANVAS
  │
  └─► Create CanvasItem → position at drop coordinates → link assetId

PASTE FROM CLIPBOARD
  │
  └─► If image data → create Asset → create CanvasItem
```

### 5.2 Export Flows

```
EXPORT IMAGE (Canvas PNG)
  │
  └─► Offscreen canvas → render all visible items by z-index → toBlob('image/png') → download

EXPORT PROJECT BUNDLE (.arsproj)
  │
  └─► Generate manifest → serialize canvas/timeline/graph → copy assets → create .zip → download

EXPORT FORMAT (Platform Preset)
  │
  └─► Load FormatProfile → transcode video → apply aspect ratio crop → download
```

---

## 6. Data Lifecycle (CRUD + Status)

### 6.1 Asset Lifecycle States

```
┌─────────┐   import    ┌─────────────┐   process   ┌──────────┐
│  DRAFT  │────────────▶│ IN_PROGRESS  │────────────▶│  READY   │
└─────────┘             └─────────────┘             └──────────┘
                              │                           │
                              │ error                     │ publish
                              ▼                           ▼
                        ┌──────────┐              ┌──────────────┐
                        │  FAILED  │              │  PUBLISHED   │
                        └──────────┘              └──────────────┘
                              │                           │
                              │ (retry)                   │ archive
                              ▼                           ▼
                        ┌──────────┐              ┌──────────────┐
                        │  READY   │              │  ARCHIVED    │
                        └──────────┘              └──────────────┘
```

### 6.2 Soft Delete Pattern

All major models must support soft delete. Hard deletion is prohibited in production:

```sql
-- ❌ NEVER: irrecoverable, breaks audit trails
DELETE FROM "Project" WHERE id = '...';

-- ✅ ALWAYS: soft delete preserves referential integrity + enables recovery
UPDATE "Project" SET "deletedAt" = NOW() WHERE id = '...';

-- Query all active records (add to every Prisma query)
WHERE "deletedAt" IS NULL

-- Recovery (undo delete within 30 days)
UPDATE "Project" SET "deletedAt" = NULL WHERE id = '...';

-- Hard purge (run via nightly cron after 30-day grace period)
DELETE FROM "Project" WHERE "deletedAt" < NOW() - INTERVAL '30 days';
```

**Prisma schema additions** (add to ALL major models):
```prisma
model Project {
  // ... existing fields ...
  deletedAt  DateTime?  // null = active, non-null = soft-deleted
  @@index([deletedAt])
}

model Asset {
  // ... existing fields ...
  deletedAt  DateTime?
  @@index([userId, deletedAt])
}

model GenerationJob {
  // ... existing fields ...
  deletedAt  DateTime?
}
```

### 6.3 Asset Relation Junction Table (Missing — Must Add)

The current `parentAssetId: String?` scalar only models trees (one parent). Complex relationships require a proper junction table with typed relation kinds:

```prisma
model AssetRelation {
  id           String       @id @default(cuid())
  sourceId     String
  targetId     String
  relationType RelationType
  strength     Float?       // 0.0–1.0 confidence or usage weight
  metadata     Json?        // e.g., { "faceMatchScore": 0.92 }
  createdAt    DateTime     @default(now())
  createdBy    String?      // userId who created the relation

  source Asset @relation("SourceRelations", fields: [sourceId], references: [id], onDelete: Cascade)
  target Asset @relation("TargetRelations", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId, relationType])
  @@index([sourceId])
  @@index([targetId])
}

enum RelationType {
  DERIVED_FROM     // This asset was generated/inpainted/upscaled from that one
  VARIANT_OF       // Same prompt + different seed (alternate version)
  USED_IN          // This asset appears in that project/composition
  REFERENCES       // Non-destructive style/inspiration reference
  GROUPED_WITH     // Manually grouped together on canvas
  CHARACTER_OF     // This generated image depicts that character profile
  STYLE_SOURCE_FOR // This inspiration image's style was applied to generate that asset
  AUDIO_FOR        // This audio track was generated/imported for that video
  SUBTITLE_FOR     // This SRT/VTT file contains captions for that video
  THUMBNAIL_FOR    // This image is a thumbnail representation of that asset
}
```

**Usage examples:**
```typescript
// After generating a variant: source prompt image → variant
createRelation({ sourceId: originalId, targetId: variantId, relationType: 'VARIANT_OF' });

// After character injection: generated image → character profile
createRelation({ sourceId: generatedImageId, targetId: characterProfileId, relationType: 'CHARACTER_OF' });

// After inpainting: remixed asset → original
createRelation({ sourceId: inpaintedId, targetId: originalId, relationType: 'DERIVED_FROM' });
```

### 6.4 Project Analytics Layer (Pre-Aggregated Stats)

Dashboard stats should not be computed on-the-fly from raw data. A `ProjectAnalytics` materialized view is updated periodically (after each generation job, on a cron, or via DB trigger):

```prisma
model ProjectAnalytics {
  id                 String   @id @default(cuid())
  projectId          String   @unique
  
  // Generation stats
  generationCount    Int      @default(0)
  failedCount        Int      @default(0)
  cancelledCount     Int      @default(0)
  totalCostEstimate  Float    @default(0)  // USD estimate based on provider pricing
  
  // Asset stats
  assetCount         Int      @default(0)
  assetCountByType   Json?    // { "image": 12, "video": 3, "audio": 5, "script": 1 }
  assetCountByOrigin Json?    // { "generated": 10, "imported": 2, "remixed": 3 }
  
  // Time stats
  activeTimeMinutes  Int      @default(0)
  firstActivityAt    DateTime?
  lastActivityAt     DateTime?
  
  // Publish stats
  publishedCount     Int      @default(0)
  platformReach      Json?    // { "tiktok": 12000, "instagram": 4500 }
  
  calculatedAt       DateTime @default(now())
  project            Project  @relation(fields: [projectId], references: [id])
  
  @@index([projectId, calculatedAt])
}
```

**Recalculation trigger** (call after each generation job completes):
```typescript
async function recalculateProjectAnalytics(projectId: string): Promise<void> {
  const [assetStats, genStats, publishStats] = await Promise.all([
    prisma.asset.groupBy({ by: ['type', 'origin'], where: { projectId, deletedAt: null } }),
    prisma.generationJob.groupBy({ by: ['status'], where: { projectId } }),
    prisma.publishJob.aggregate({ where: { projectId, status: 'POSTED' }, _count: true }),
  ]);

  await prisma.projectAnalytics.upsert({
    where: { projectId },
    create: { projectId, ...computedStats },
    update: { ...computedStats, calculatedAt: new Date() },
  });
}
```

### 6.5 Event Store (Future — Event Sourcing Foundation)

For audit trails and time-travel debugging, domain events should be persisted as an append-only log:

```prisma
model DomainEvent {
  id          String   @id @default(cuid())
  aggregateId String   // projectId, assetId, userId, etc.
  aggregateType String // "Project", "Asset", "GenerationJob"
  eventType   String  // "GenerationCompleted", "AssetDeleted", "ProjectArchived"
  eventData   Json    // Serialized event payload
  userId      String? // Who triggered the event
  occurredAt  DateTime @default(now())

  @@index([aggregateId, occurredAt])
  @@index([eventType, occurredAt])
  @@index([userId, occurredAt])
}
```

**Event types (exhaustive catalog):**
```typescript
type DomainEventType =
  // Project
  | 'ProjectCreated' | 'ProjectRenamed' | 'ProjectArchived' | 'ProjectRestored' | 'ProjectDeleted'
  | 'ProjectSnapshotCreated' | 'ProjectVersionRestored'
  // Asset
  | 'AssetImported' | 'AssetGenerated' | 'AssetEdited' | 'AssetTagged' | 'AssetDeleted'
  | 'AssetRelationCreated' | 'AssetRelationDeleted'
  // Generation
  | 'GenerationQueued' | 'GenerationStarted' | 'GenerationCompleted' | 'GenerationFailed'
  | 'GenerationCancelled' | 'GenerationRetried'
  // Character
  | 'CharacterCreated' | 'CharacterUpdated' | 'CharacterReferenceAdded'
  // Publishing
  | 'PostScheduled' | 'PostSubmitted' | 'PostPosted' | 'PostFailed'
  | 'AnalyticsUpdated'
  // Settings
  | 'ApiKeyAdded' | 'ApiKeyRemoved' | 'SettingsChanged';
```

---

## 7. Key Code References (for Maintainers)

| Concern | Files |
|---------|-------|
| Persistence keys | `constants/workspace.ts` (`STORAGE_KEYS`, `WORKSPACE_DATA_KEYS_TO_CLEAR`) |
| File tree + assets | `stores/fileStore.ts` |
| Canvas state | `stores/canvasStore.ts`, `hooks/useProjectSync.ts` |
| Disk save/load | `hooks/useDiskSave.ts`, `hooks/useDiskReconciliation.ts` |
| DB schema | `prisma/schema.prisma` |
| Type definitions | `types/index.ts`, `types/module.ts`, `types/format.ts` |
| Project bundle | `lib/project/bundle.ts` |
| Module registry | `lib/modules/registry.ts` |
| API routes | `pages/api/projects/**`, `pages/api/workspace/**` |
| Format profiles | `lib/formats/profiles.ts` |
| Generation | `pages/api/generate.ts`, `stores/generationStore.ts` |

---

*Last updated to reflect the complete data ontology. Extend this file as new entity types and relations are implemented.*
