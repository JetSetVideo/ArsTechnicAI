// ─────────────────────────────────────────────────────────────────────────────
// Workshop Pipeline — type system
//
// The workshop is a horizontal × vertical creation engine:
//   • Horizontality — pipeline stages flow left→right (moodboard → … → export)
//   • Verticality   — every node stacks alternatives/variants above one another
// Every stage supports: generate / import / tune manually / regenerate part /
// branch alternatives, so the whole pipeline stays tunable end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

/** Pipeline stages, ordered left → right on the workshop flow. */
export type PipelineStageId =
  | 'concept'      // Moodboard, references, palettes, style DNA
  | 'script'       // Logline, treatment, screenplay, dialogue
  | 'world'        // Characters, locations, props, wardrobe
  | 'storyboard'   // Shot list, storyboard frames, animatic
  | 'visual'       // Key images: generation + AI editing
  | 'motion'       // Image→video, camera moves, interpolation
  | 'audio'        // Dialogue TTS, music, SFX, mix
  | 'assembly'     // Montage, cuts, transitions, subtitles, overlays
  | 'delivery';    // Format profiles, transcode, thumbnail, publish

/** Data types flowing between node ports. */
export type PipelinePortType =
  | 'image' | 'image-set' | 'video' | 'audio' | 'text' | 'script'
  | 'shotlist' | 'storyboard' | 'character' | 'location' | 'palette'
  | 'style' | 'mask' | 'subtitle' | 'timeline' | 'format' | 'data' | 'any';

export interface PipelinePort {
  id: string;
  label: string;
  type: PipelinePortType;
  /** Inputs may accept several upstream edges (e.g. montage takes N clips). */
  multi?: boolean;
  optional?: boolean;
}

/** Widget used by the inspector to edit one parameter. */
export type ParamWidget =
  | 'text' | 'textarea' | 'number' | 'slider' | 'select' | 'multiselect'
  | 'toggle' | 'color' | 'seed' | 'aspect' | 'duration' | 'file' | 'tags';

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamDef {
  id: string;
  label: string;
  widget: ParamWidget;
  /** Group heading inside the inspector (e.g. "Camera", "Lighting"). */
  section?: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  placeholder?: string;
  help?: string;
  /** Included in the generation prompt sent to the model. */
  promptable?: boolean;
}

/** How a node produces its output. */
export type NodeExecution =
  | 'banana-image'      // Google banana2 (Gemini image) generation
  | 'banana-image-edit' // banana2 edit: input image(s) + instruction → image
  | 'banana-text'       // Gemini text generation (script, shot list, dialogue…)
  | 'local'             // Client-side processing (transform, palette extract…)
  | 'import'            // User supplies the data (file / paste / pick)
  | 'compose'           // Aggregates upstream results (montage, mix, export)
  | 'manual';           // Pure authored data (profiles, notes, settings)

export interface PipelineNodeDef {
  type: string;
  stage: PipelineStageId;
  title: string;
  subtitle: string;
  icon: string;               // lucide icon name key (mapped in UI)
  execution: NodeExecution;
  inputs: PipelinePort[];
  outputs: PipelinePort[];
  params: ParamDef[];
  /** Builds the model prompt from params + upstream context. */
  promptTemplate?: string;
  tags?: string[];
}

export interface PipelineStageDef {
  id: PipelineStageId;
  title: string;
  tagline: string;
  color: string;              // accent for lane, nodes, edges
  icon: string;
  order: number;
}

// ── Instances ────────────────────────────────────────────────────────────────

export type NodeStatus = 'idle' | 'queued' | 'running' | 'done' | 'error';

// ── Layers (Photoshop-inspired, non-destructive) ─────────────────────────────

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type LayerKind =
  | 'image'       // collage: imported/pasted picture layer
  | 'shape'       // vector form: rectangle, ellipse, line, arrow
  | 'text'        // typographic layer
  | 'mask'        // AI region directive: include (edit here) / exclude (protect)
  | 'adjustment'; // non-destructive filter (blur, saturation, contrast…)

export type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';
export type MaskMode = 'include' | 'exclude';

/**
 * A non-destructive layer attached to a generated image variant.
 * Geometry is normalized 0..1 relative to the image so layers survive
 * any resolution change or re-generation.
 */
export interface AssetLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  opacity: number;            // 0..1
  blendMode: BlendMode;
  x: number;                  // 0..1 (left)
  y: number;                  // 0..1 (top)
  w: number;                  // 0..1 (width)
  h: number;                  // 0..1 (height)
  rotation?: number;          // degrees
  // shape
  shape?: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;       // px at 1024 reference size
  // text
  text?: string;
  fontSize?: number;          // fraction of image height (0..1)
  fontFamily?: string;
  color?: string;
  // image / collage
  image?: string;             // dataURL
  // mask
  maskMode?: MaskMode;
  /** Region instruction sent to banana2 (e.g. "replace the sky with aurora"). */
  prompt?: string;
  // adjustment
  filter?: string;            // CSS/canvas filter, e.g. 'blur(4px) saturate(1.4)'
  createdAt: number;
  updatedAt: number;
}

/** One alternative result of a node — variants stack vertically as a 3D deck. */
export interface NodeVariant {
  id: string;
  label: string;
  createdAt: number;
  updatedAt?: number;
  /** Monotonic version number within the node (v1, v2…). */
  version?: number;
  /** Variant this one was flattened/derived from. */
  parentVariantId?: string;
  /** Prompt/params snapshot that produced this variant. */
  paramsSnapshot?: Record<string, unknown>;
  seed?: number;
  /** Result payload: dataUrl for images/video poster, text for scripts… */
  image?: string;
  text?: string;
  meta?: Record<string, unknown>;
  pinned?: boolean;
  /** Non-destructive layer stack over the image (topmost last). */
  layers?: AssetLayer[];
}

export interface PipelineNode {
  id: string;
  type: string;               // key into the catalog
  stage: PipelineStageId;
  title: string;              // user-renamable
  /** Manual position override; when absent, auto-layout owns the position. */
  x?: number;
  y?: number;
  /** Order inside its stage lane (vertical slot). */
  slot: number;
  params: Record<string, unknown>;
  status: NodeStatus;
  error?: string;
  progress?: number;
  variants: NodeVariant[];
  activeVariantId?: string;
  /** Collapsed nodes render as compact chips inside their group. */
  collapsed?: boolean;
  /** Deck fanned open showing all variants. */
  deckOpen?: boolean;
}

export interface PipelineEdge {
  id: string;
  from: string;               // node id
  fromPort: string;
  to: string;                 // node id
  toPort: string;
  type: PipelinePortType;
}

/** Auto-formed group: one per stage that has nodes; splits/merges automatically. */
export interface PipelineGroup {
  id: string;
  stage: PipelineStageId;
  nodeIds: string[];
  collapsed?: boolean;
}

export interface PipelineViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * One ordered entry of the film strip: a picture version placed in the video
 * timeline order, with its screen duration and outgoing transition.
 */
export interface SceneRef {
  id: string;
  nodeId: string;
  variantId: string;
  label: string;
  duration: number;           // seconds on screen
  transition: string;         // transition to the NEXT scene (cut, dissolve…)
  note?: string;              // director's note for this beat
}

/** A saved parameter preset for a node type — reproducible prompt recipes. */
export interface ParamTemplate {
  name: string;
  nodeType: string;
  params: Record<string, unknown>;
  createdAt: number;
}

export interface BananaRequest {
  kind: 'text' | 'image' | 'image-edit';
  prompt: string;
  system?: string;
  images?: string[];          // dataURLs for edit / reference
  aspectRatio?: string;
  model?: string;
  temperature?: number;
  apiKey: string;
}

export interface BananaResponse {
  text?: string;
  dataUrl?: string;
  model?: string;
  error?: string;
}
