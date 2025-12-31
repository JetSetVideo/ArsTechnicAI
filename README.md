# IntelArtiGenerator

A professional-grade file manager and AI-powered production suite for cinema, animation, and multimedia content creation. Inspired by industry tools like Cursor, VSCode, Blender, DaVinci Resolve, and Nuke.

---

## 🎬 Vision

IntelArtiGenerator bridges the gap between AI generators and traditional filmmaking workflows, providing a unified environment to manage the entire production pipeline—from initial concept to final delivery.

---

## 📐 Software Architecture

### Top-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION SHELL                               │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────────┤
│   MENUBAR   │  TOOLBAR    │  SIDEBAR    │   PANELS    │    STATUS BAR      │
├─────────────┴─────────────┴─────────────┴─────────────┴────────────────────┤
│                              WORKSPACE MANAGER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Explorer   │  │   Editor    │  │  Timeline   │  │  Inspector  │        │
│  │   Panel     │  │   Panel     │  │   Panel     │  │   Panel     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              SERVICE LAYER                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   AI    │ │  File   │ │  Media  │ │  Render │ │  Audio  │ │  Sync   │   │
│  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │ │ Service │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Project Store  │  │  Asset Store    │  │  Cache Store    │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎥 Cinema Production Pipeline

### Phase 1: Pre-Production

#### 1.1 Concept Development
```
/project-name/
├── 00_concept/
│   ├── references/
│   │   ├── mood_boards/           # Visual inspiration collections
│   │   ├── color_palettes/        # Color theory references
│   │   ├── cinematography/        # Shot references from other films
│   │   └── art_direction/         # Style guides and art references
│   ├── treatments/
│   │   ├── logline.md             # One-sentence story summary
│   │   ├── synopsis.md            # Short story overview
│   │   └── treatment.md           # Detailed narrative description
│   └── pitch/
│       ├── pitch_deck.md
│       └── lookbook.md
```

#### 1.2 Script & Screenplay
```
├── 01_script/
│   ├── drafts/
│   │   ├── v1_first_draft.fountain
│   │   ├── v2_revision.fountain
│   │   └── v3_shooting_script.fountain
│   ├── breakdowns/
│   │   ├── scene_breakdown.json    # Scene-by-scene analysis
│   │   ├── character_breakdown.json
│   │   └── location_breakdown.json
│   ├── dialogues/
│   │   ├── scene_001_dialogue.json
│   │   └── adr_notes/              # Automated Dialogue Replacement
│   └── translations/
│       ├── en/
│       ├── fr/
│       ├── es/
│       └── subtitles/
│           ├── srt/
│           └── vtt/
```

#### 1.3 Storyboarding
```
├── 02_storyboard/
│   ├── sequences/
│   │   ├── seq_001_opening/
│   │   │   ├── shot_001.png
│   │   │   ├── shot_001.json       # Shot metadata
│   │   │   ├── shot_002.png
│   │   │   └── animatic/
│   │   │       └── seq_001.mp4
│   │   └── seq_002_inciting/
│   ├── templates/
│   │   ├── frame_16x9.svg
│   │   ├── frame_2.35x1.svg        # Cinemascope
│   │   └── frame_4x3.svg
│   └── shot_lists/
│       ├── master_shot_list.json
│       └── daily_shot_lists/
```

#### 1.4 Character Design
```
├── 03_characters/
│   ├── protagonists/
│   │   └── character_name/
│   │       ├── concept_art/
│   │       ├── turnaround/         # 360° character views
│   │       ├── expressions/        # Facial expression sheets
│   │       ├── poses/              # Action pose library
│   │       ├── wardrobe/           # Costume designs
│   │       ├── props/              # Character-specific props
│   │       └── character.json      # Character metadata
│   ├── antagonists/
│   ├── supporting/
│   └── extras/
│       └── crowd_types/
```

#### 1.5 Environment & Set Design
```
├── 04_environments/
│   ├── locations/
│   │   └── location_name/
│   │       ├── reference_photos/
│   │       ├── concept_art/
│   │       ├── floor_plans/
│   │       ├── lighting_diagrams/
│   │       ├── set_dressing/
│   │       └── location.json
│   ├── props/
│   │   ├── hero_props/             # Key story props
│   │   ├── set_dressing/
│   │   └── vehicles/
│   └── fx_elements/
│       ├── atmospheric/            # Fog, rain, snow
│       ├── practical/              # On-set effects
│       └── digital/                # CG elements
```

### Phase 2: Production

#### 2.1 Shot Composition
```
├── 05_production/
│   ├── camera/
│   │   ├── shot_types/
│   │   │   ├── extreme_wide_shot/    # EWS - Establishing shots
│   │   │   ├── wide_shot/            # WS - Full scene context
│   │   │   ├── medium_wide_shot/     # MWS - Character + environment
│   │   │   ├── medium_shot/          # MS - Waist up
│   │   │   ├── medium_close_up/      # MCU - Chest up
│   │   │   ├── close_up/             # CU - Face/detail
│   │   │   ├── extreme_close_up/     # ECU - Eyes, small details
│   │   │   ├── over_the_shoulder/    # OTS - Dialogue shots
│   │   │   ├── point_of_view/        # POV - Character perspective
│   │   │   ├── two_shot/             # 2S - Two characters
│   │   │   └── insert_shot/          # Detail/cutaway
│   │   ├── camera_angles/
│   │   │   ├── eye_level/
│   │   │   ├── low_angle/            # Power, dominance
│   │   │   ├── high_angle/           # Vulnerability
│   │   │   ├── dutch_angle/          # Unease, tension
│   │   │   ├── birds_eye/            # God's view
│   │   │   └── worms_eye/            # Extreme low
│   │   └── camera_movements/
│   │       ├── static/
│   │       ├── pan/                  # Horizontal rotation
│   │       ├── tilt/                 # Vertical rotation
│   │       ├── dolly/                # Forward/backward
│   │       ├── truck/                # Lateral movement
│   │       ├── pedestal/             # Vertical movement
│   │       ├── crane/                # Complex vertical
│   │       ├── steadicam/            # Smooth tracking
│   │       ├── handheld/             # Documentary feel
│   │       └── zoom/                 # Lens-based
│   ├── lighting/
│   │   ├── setups/
│   │   │   ├── three_point/          # Key, fill, back
│   │   │   ├── high_key/             # Bright, low contrast
│   │   │   ├── low_key/              # Dark, high contrast
│   │   │   ├── rembrandt/            # Triangle under eye
│   │   │   ├── butterfly/            # Fashion/glamour
│   │   │   ├── split/                # Half face lit
│   │   │   └── silhouette/
│   │   ├── color_temperature/
│   │   │   ├── tungsten_3200k/
│   │   │   ├── daylight_5600k/
│   │   │   └── mixed/
│   │   └── practical_lights/         # In-scene light sources
│   └── composition/
│       ├── rule_of_thirds/
│       ├── golden_ratio/
│       ├── leading_lines/
│       ├── frame_within_frame/
│       ├── symmetry/
│       ├── negative_space/
│       └── depth_layers/             # FG, MG, BG
```

#### 2.2 Footage Management
```
│   ├── footage/
│   │   ├── raw/
│   │   │   ├── day_001/
│   │   │   │   ├── A_cam/
│   │   │   │   │   ├── A001_C001_0101.mov
│   │   │   │   │   └── metadata/
│   │   │   │   ├── B_cam/
│   │   │   │   └── C_cam/
│   │   │   └── day_002/
│   │   ├── proxies/                  # Low-res editing copies
│   │   ├── dailies/                  # Daily review reels
│   │   └── selects/                  # Chosen takes
```

### Phase 3: Post-Production

#### 3.1 Editing
```
├── 06_edit/
│   ├── assembly/                     # First rough cut
│   ├── rough_cut/
│   ├── fine_cut/
│   ├── picture_lock/                 # Final edit
│   ├── timelines/
│   │   ├── main_timeline.json
│   │   └── alternate_cuts/
│   └── transitions/
│       ├── cuts/
│       │   ├── hard_cut/
│       │   ├── jump_cut/
│       │   ├── match_cut/
│       │   ├── smash_cut/
│       │   └── invisible_cut/
│       ├── dissolves/
│       │   ├── cross_dissolve/
│       │   ├── fade_to_black/
│       │   ├── fade_from_black/
│       │   └── fade_to_white/
│       ├── wipes/
│       │   ├── horizontal/
│       │   ├── vertical/
│       │   ├── radial/
│       │   └── custom/
│       └── digital/
│           ├── morph/
│           ├── glitch/
│           └── pixelate/
```

#### 3.2 Visual Effects
```
├── 07_vfx/
│   ├── compositing/
│   │   ├── plates/                   # Background plates
│   │   ├── elements/                 # Overlay elements
│   │   ├── mattes/                   # Masks and rotoscopes
│   │   └── renders/
│   ├── cg/
│   │   ├── models/
│   │   │   ├── geometry/
│   │   │   ├── textures/
│   │   │   ├── materials/
│   │   │   └── rigs/
│   │   ├── animations/
│   │   ├── simulations/
│   │   │   ├── particles/
│   │   │   ├── fluids/
│   │   │   ├── cloth/
│   │   │   └── destruction/
│   │   └── lighting/
│   ├── motion_graphics/
│   │   ├── titles/
│   │   │   ├── main_title/
│   │   │   ├── end_credits/
│   │   │   └── lower_thirds/
│   │   └── graphics/
│   └── cleanup/
│       ├── wire_removal/
│       ├── rig_removal/
│       └── beauty_work/
```

#### 3.3 Color Grading
```
├── 08_color/
│   ├── luts/
│   │   ├── technical/               # Camera log to rec709
│   │   ├── creative/                # Stylistic looks
│   │   └── custom/
│   ├── grades/
│   │   ├── primary/                 # Global corrections
│   │   ├── secondary/               # Selective corrections
│   │   └── scene_match/             # Shot matching
│   ├── color_scripts/               # Color story by scene
│   └── deliverables/
│       ├── theatrical/              # DCI-P3
│       ├── broadcast/               # Rec.709
│       └── web/                     # sRGB
```

#### 3.4 Audio Post
```
├── 09_audio/
│   ├── dialogue/
│   │   ├── production_audio/        # On-set recordings
│   │   ├── adr/                     # Re-recorded dialogue
│   │   └── walla/                   # Background voices
│   ├── sound_design/
│   │   ├── sfx/
│   │   │   ├── foley/               # Footsteps, cloth, props
│   │   │   ├── hard_effects/        # Doors, cars, guns
│   │   │   ├── soft_effects/        # Whooshes, impacts
│   │   │   └── ambiences/           # Room tones, environments
│   │   └── designed/                # Custom created sounds
│   ├── music/
│   │   ├── score/
│   │   │   ├── stems/               # Individual instrument groups
│   │   │   ├── cues/                # Music by scene
│   │   │   └── alternate_versions/
│   │   ├── licensed/                # Third-party music
│   │   └── temp_music/              # Placeholder tracks
│   └── mix/
│       ├── stems/
│       │   ├── dialogue_stem/
│       │   ├── music_stem/
│       │   └── effects_stem/
│       └── deliverables/
│           ├── 5.1_surround/
│           ├── 7.1_atmos/
│           └── stereo/
```

### Phase 4: Delivery
```
├── 10_delivery/
│   ├── masters/
│   │   ├── dcp/                     # Digital Cinema Package
│   │   ├── broadcast/
│   │   ├── streaming/
│   │   └── archive/
│   ├── marketing/
│   │   ├── trailers/
│   │   ├── teasers/
│   │   ├── posters/
│   │   ├── stills/
│   │   └── social_media/
│   └── documentation/
│       ├── delivery_specs.json
│       └── qc_reports/
```

---

## 🧬 Data Types & Interfaces

### Core Types

```typescript
// ============================================================
// BASE TYPES
// ============================================================

type UUID = string;
type Timestamp = number;
type FilePath = string;
type URL = string;

// Time representation (frames & timecode)
interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  frameRate: FrameRate;
}

type FrameRate = 23.976 | 24 | 25 | 29.97 | 30 | 48 | 50 | 59.94 | 60;

// Spatial types
interface Dimensions {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

interface Position3D extends Position {
  z: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Transform2D {
  position: Position;
  rotation: number;          // degrees
  scale: { x: number; y: number };
  anchor: Position;
  opacity: number;           // 0-1
}

interface Transform3D extends Transform2D {
  position: Position3D;
  rotation: Position3D;      // Euler angles
  scale: Position3D;
}

// ============================================================
// COLOR SYSTEM
// ============================================================

interface RGB {
  r: number;  // 0-255
  g: number;
  b: number;
}

interface RGBA extends RGB {
  a: number;  // 0-1
}

interface HSL {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

interface LAB {
  l: number;  // 0-100
  a: number;  // -128 to 127
  b: number;  // -128 to 127
}

type ColorSpace = 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec709' | 'Rec2020' | 'ACES';

interface Color {
  value: RGB | RGBA | HSL | HSV | LAB | string;
  space: ColorSpace;
  alpha?: number;
}

interface ColorPalette {
  id: UUID;
  name: string;
  colors: Color[];
  metadata: {
    mood?: string;
    temperature?: 'warm' | 'cool' | 'neutral';
    contrast?: 'high' | 'medium' | 'low';
  };
}

interface Gradient {
  type: 'linear' | 'radial' | 'conic';
  stops: Array<{ color: Color; position: number }>;  // position 0-1
  angle?: number;        // for linear
  center?: Position;     // for radial/conic
}

// ============================================================
// ASSET SYSTEM
// ============================================================

type AssetType = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'text' 
  | 'font' 
  | 'model3d' 
  | 'sequence' 
  | 'project' 
  | 'prompt'
  | 'lut'
  | 'preset';

type MediaFormat = 
  // Image
  | 'png' | 'jpg' | 'jpeg' | 'webp' | 'tiff' | 'exr' | 'psd' | 'svg'
  // Video
  | 'mp4' | 'mov' | 'avi' | 'mkv' | 'webm' | 'prores' | 'dnxhd'
  // Audio
  | 'wav' | 'mp3' | 'aac' | 'flac' | 'ogg' | 'aiff'
  // 3D
  | 'obj' | 'fbx' | 'gltf' | 'glb' | 'usd' | 'blend'
  // Document
  | 'md' | 'txt' | 'json' | 'fountain' | 'fdx';

interface AssetBase {
  id: UUID;
  name: string;
  type: AssetType;
  path: FilePath;
  format: MediaFormat;
  size: number;              // bytes
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  tags: string[];
  metadata: Record<string, unknown>;
  thumbnail?: FilePath;
  proxy?: FilePath;
}

interface ImageAsset extends AssetBase {
  type: 'image';
  dimensions: Dimensions;
  colorSpace: ColorSpace;
  bitDepth: 8 | 16 | 32;
  hasAlpha: boolean;
  dpi?: number;
}

interface VideoAsset extends AssetBase {
  type: 'video';
  dimensions: Dimensions;
  frameRate: FrameRate;
  duration: Timecode;
  codec: string;
  bitrate: number;
  hasAudio: boolean;
  audioTracks: number;
}

interface AudioAsset extends AssetBase {
  type: 'audio';
  duration: Timecode;
  sampleRate: number;        // Hz
  bitDepth: 16 | 24 | 32;
  channels: number;
  codec: string;
}

interface Model3DAsset extends AssetBase {
  type: 'model3d';
  vertices: number;
  faces: number;
  hasUVs: boolean;
  hasMaterials: boolean;
  hasRig: boolean;
  hasAnimations: boolean;
}

type Asset = ImageAsset | VideoAsset | AudioAsset | Model3DAsset | AssetBase;

// ============================================================
// PROJECT STRUCTURE
// ============================================================

interface Project {
  id: UUID;
  name: string;
  description: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  settings: ProjectSettings;
  structure: FolderNode;
  assets: Map<UUID, Asset>;
  timeline?: Timeline;
  version: string;
}

interface ProjectSettings {
  resolution: Dimensions;
  frameRate: FrameRate;
  colorSpace: ColorSpace;
  aspectRatio: AspectRatio;
  sampleRate: number;
  bitDepth: number;
  workingDirectory: FilePath;
  autoSave: boolean;
  autoSaveInterval: number;  // minutes
}

type AspectRatio = 
  | '16:9'      // HD/4K
  | '2.39:1'    // Anamorphic
  | '2.35:1'    // Cinemascope
  | '1.85:1'    // Theatrical
  | '4:3'       // Classic TV
  | '1:1'       // Square
  | '9:16'      // Vertical
  | 'custom';

interface FolderNode {
  id: UUID;
  name: string;
  type: 'folder';
  children: (FolderNode | FileNode)[];
  expanded: boolean;
  color?: Color;
  icon?: string;
}

interface FileNode {
  id: UUID;
  name: string;
  type: 'file';
  assetId: UUID;
  linkedAssets?: UUID[];     // Related assets
}

// ============================================================
// TIMELINE & EDITING
// ============================================================

interface Timeline {
  id: UUID;
  name: string;
  duration: Timecode;
  frameRate: FrameRate;
  tracks: Track[];
  markers: Marker[];
  inPoint?: Timecode;
  outPoint?: Timecode;
}

type TrackType = 'video' | 'audio' | 'subtitle' | 'data';

interface Track {
  id: UUID;
  name: string;
  type: TrackType;
  clips: Clip[];
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
  color: Color;
}

interface Clip {
  id: UUID;
  assetId: UUID;
  trackId: UUID;
  startTime: Timecode;       // Position on timeline
  endTime: Timecode;
  inPoint: Timecode;         // Source in
  outPoint: Timecode;        // Source out
  speed: number;             // 1 = normal, 2 = 2x, -1 = reverse
  transform: Transform2D;
  effects: Effect[];
  transitions: {
    in?: Transition;
    out?: Transition;
  };
  linkedClips?: UUID[];      // Audio/video sync
}

interface Transition {
  type: TransitionType;
  duration: Timecode;
  easing: EasingFunction;
  parameters: Record<string, unknown>;
}

type TransitionType = 
  | 'cut'
  | 'dissolve'
  | 'fade_black'
  | 'fade_white'
  | 'wipe_left'
  | 'wipe_right'
  | 'wipe_up'
  | 'wipe_down'
  | 'iris'
  | 'zoom'
  | 'slide'
  | 'push'
  | 'custom';

interface Marker {
  id: UUID;
  time: Timecode;
  duration?: Timecode;
  name: string;
  color: Color;
  type: 'comment' | 'chapter' | 'todo' | 'sync' | 'cue';
  notes?: string;
}

// ============================================================
// EFFECTS & FILTERS
// ============================================================

interface Effect {
  id: UUID;
  type: EffectType;
  name: string;
  enabled: boolean;
  parameters: EffectParameter[];
  keyframes?: Keyframe[];
}

type EffectType = 
  // Color
  | 'color_correction'
  | 'lut'
  | 'curves'
  | 'levels'
  | 'hue_saturation'
  | 'color_balance'
  | 'exposure'
  | 'white_balance'
  // Blur & Sharpen
  | 'gaussian_blur'
  | 'motion_blur'
  | 'radial_blur'
  | 'sharpen'
  | 'unsharp_mask'
  // Distort
  | 'transform'
  | 'perspective'
  | 'lens_distortion'
  | 'warp'
  | 'stabilize'
  // Stylize
  | 'glow'
  | 'vignette'
  | 'film_grain'
  | 'chromatic_aberration'
  | 'halftone'
  // Composite
  | 'blend_mode'
  | 'mask'
  | 'keying'
  | 'track_matte';

interface EffectParameter {
  id: string;
  name: string;
  type: 'number' | 'color' | 'boolean' | 'enum' | 'point' | 'curve';
  value: unknown;
  min?: number;
  max?: number;
  default: unknown;
  options?: string[];        // for enum type
}

interface Keyframe {
  time: Timecode;
  parameterId: string;
  value: unknown;
  easing: EasingFunction;
  tangentIn?: { x: number; y: number };
  tangentOut?: { x: number; y: number };
}

type EasingFunction = 
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'step'
  | 'hold';

// ============================================================
// CINEMA-SPECIFIC TYPES
// ============================================================

interface Shot {
  id: UUID;
  sceneId: UUID;
  shotNumber: string;        // e.g., "1A", "2B"
  type: ShotType;
  angle: CameraAngle;
  movement: CameraMovement;
  lens: LensInfo;
  composition: CompositionGuide[];
  duration: Timecode;
  description: string;
  storyboardFrame?: UUID;    // Link to storyboard image
  footage?: UUID[];          // Link to actual footage
}

type ShotType = 
  | 'EWS'    // Extreme Wide Shot
  | 'WS'     // Wide Shot
  | 'MWS'    // Medium Wide Shot
  | 'MS'     // Medium Shot
  | 'MCU'    // Medium Close Up
  | 'CU'     // Close Up
  | 'ECU'    // Extreme Close Up
  | 'OTS'    // Over The Shoulder
  | 'POV'    // Point of View
  | '2S'     // Two Shot
  | 'INSERT';

type CameraAngle = 
  | 'eye_level'
  | 'low_angle'
  | 'high_angle'
  | 'dutch_angle'
  | 'birds_eye'
  | 'worms_eye'
  | 'overhead';

type CameraMovement = 
  | 'static'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'dolly_in'
  | 'dolly_out'
  | 'truck_left'
  | 'truck_right'
  | 'pedestal_up'
  | 'pedestal_down'
  | 'crane'
  | 'steadicam'
  | 'handheld'
  | 'zoom_in'
  | 'zoom_out'
  | 'rack_focus';

interface LensInfo {
  focalLength: number;       // mm
  aperture: number;          // f-stop
  type: 'wide' | 'normal' | 'telephoto' | 'macro' | 'anamorphic';
  depthOfField: 'shallow' | 'medium' | 'deep';
}

type CompositionGuide = 
  | 'rule_of_thirds'
  | 'golden_ratio'
  | 'center'
  | 'diagonal'
  | 'symmetry'
  | 'frame_within_frame'
  | 'leading_lines'
  | 'negative_space'
  | 'depth_layers';

interface Scene {
  id: UUID;
  number: number;
  name: string;
  location: string;
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' | 'continuous';
  interior: boolean;
  description: string;
  shots: Shot[];
  characters: UUID[];
  props: UUID[];
  notes: string;
  colorScript?: ColorPalette;
}

// ============================================================
// AI & PROMPTS
// ============================================================

interface Prompt {
  id: UUID;
  name: string;
  category: PromptCategory;
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  tags: string[];
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

type PromptCategory = 
  | 'image_generation'
  | 'image_editing'
  | 'video_generation'
  | 'audio_generation'
  | 'text_generation'
  | 'translation'
  | 'analysis'
  | 'style_transfer';

interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'enum' | 'asset';
  required: boolean;
  default?: unknown;
  options?: string[];
  description: string;
}

interface PromptExample {
  input: Record<string, unknown>;
  output?: Asset;
  rating?: number;
}

interface GenerationJob {
  id: UUID;
  promptId: UUID;
  inputs: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;          // 0-100
  result?: Asset;
  error?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

---

## 🎨 Design System

### Color Tokens

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     SEMANTIC COLORS - Dark Theme (Default)
     ═══════════════════════════════════════════════════════════ */
  
  /* Background Hierarchy */
  --bg-void: #07070a;              /* Deepest background */
  --bg-base: #0c0c10;              /* Main application background */
  --bg-surface: #13131a;           /* Cards, panels */
  --bg-elevated: #1a1a24;          /* Hover states, elevated surfaces */
  --bg-overlay: #22222e;           /* Modals, dropdowns */
  
  /* Foreground Hierarchy */
  --fg-primary: #fafafc;           /* Primary text */
  --fg-secondary: #a8a8b3;         /* Secondary text */
  --fg-tertiary: #6b6b78;          /* Disabled, hints */
  --fg-muted: #3d3d4a;             /* Very subtle text */
  
  /* Border Hierarchy */
  --border-subtle: #1e1e28;        /* Subtle dividers */
  --border-default: #2a2a38;       /* Default borders */
  --border-strong: #3a3a4a;        /* Emphasized borders */
  --border-focus: #5c7cfa;         /* Focus rings */
  
  /* ═══════════════════════════════════════════════════════════
     ACCENT COLORS - Cinema Inspired
     ═══════════════════════════════════════════════════════════ */
  
  /* Primary - Electric Violet (Creative, AI) */
  --accent-primary-50: #f3f0ff;
  --accent-primary-100: #e5deff;
  --accent-primary-200: #cdc0ff;
  --accent-primary-300: #ab94ff;
  --accent-primary-400: #8b5cf6;
  --accent-primary-500: #7c3aed;
  --accent-primary-600: #6d28d9;
  --accent-primary-700: #5b21b6;
  --accent-primary-800: #4c1d95;
  --accent-primary-900: #3b1578;
  
  /* Secondary - Teal Cyan (Media, Preview) */
  --accent-secondary-50: #ecfeff;
  --accent-secondary-100: #cffafe;
  --accent-secondary-200: #a5f3fc;
  --accent-secondary-300: #67e8f9;
  --accent-secondary-400: #22d3ee;
  --accent-secondary-500: #06b6d4;
  --accent-secondary-600: #0891b2;
  --accent-secondary-700: #0e7490;
  --accent-secondary-800: #155e75;
  --accent-secondary-900: #164e63;
  
  /* Tertiary - Amber Gold (Timeline, Playhead) */
  --accent-tertiary-50: #fffbeb;
  --accent-tertiary-100: #fef3c7;
  --accent-tertiary-200: #fde68a;
  --accent-tertiary-300: #fcd34d;
  --accent-tertiary-400: #fbbf24;
  --accent-tertiary-500: #f59e0b;
  --accent-tertiary-600: #d97706;
  --accent-tertiary-700: #b45309;
  --accent-tertiary-800: #92400e;
  --accent-tertiary-900: #78350f;
  
  /* ═══════════════════════════════════════════════════════════
     SEMANTIC STATUS COLORS
     ═══════════════════════════════════════════════════════════ */
  
  /* Success - Green */
  --success-bg: #052e16;
  --success-border: #166534;
  --success-text: #4ade80;
  --success-solid: #22c55e;
  
  /* Warning - Orange */
  --warning-bg: #431407;
  --warning-border: #9a3412;
  --warning-text: #fb923c;
  --warning-solid: #f97316;
  
  /* Error - Red */
  --error-bg: #450a0a;
  --error-border: #991b1b;
  --error-text: #f87171;
  --error-solid: #ef4444;
  
  /* Info - Blue */
  --info-bg: #0c1929;
  --info-border: #1e40af;
  --info-text: #60a5fa;
  --info-solid: #3b82f6;
  
  /* ═══════════════════════════════════════════════════════════
     TRACK COLORS (Timeline)
     ═══════════════════════════════════════════════════════════ */
  
  --track-video-1: #8b5cf6;        /* Violet */
  --track-video-2: #6366f1;        /* Indigo */
  --track-video-3: #3b82f6;        /* Blue */
  --track-audio-1: #22c55e;        /* Green */
  --track-audio-2: #10b981;        /* Emerald */
  --track-audio-3: #14b8a6;        /* Teal */
  --track-subtitle: #f59e0b;       /* Amber */
  --track-data: #6b7280;           /* Gray */
  
  /* ═══════════════════════════════════════════════════════════
     ASSET TYPE COLORS
     ═══════════════════════════════════════════════════════════ */
  
  --asset-image: #ec4899;          /* Pink */
  --asset-video: #8b5cf6;          /* Violet */
  --asset-audio: #22c55e;          /* Green */
  --asset-text: #60a5fa;           /* Blue */
  --asset-3d: #f97316;             /* Orange */
  --asset-folder: #fbbf24;         /* Amber */
  --asset-prompt: #a855f7;         /* Purple */
  
  /* ═══════════════════════════════════════════════════════════
     SELECTION & INTERACTION STATES
     ═══════════════════════════════════════════════════════════ */
  
  --selection-bg: rgba(139, 92, 246, 0.15);
  --selection-border: rgba(139, 92, 246, 0.5);
  --hover-bg: rgba(255, 255, 255, 0.03);
  --active-bg: rgba(255, 255, 255, 0.06);
  --drag-ghost: rgba(139, 92, 246, 0.25);
  --drop-zone: rgba(34, 211, 238, 0.2);
  --drop-zone-border: #22d3ee;
}
```

### Typography Scale

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     FONT FAMILIES
     ═══════════════════════════════════════════════════════════ */
  
  /* Display - For hero text, titles */
  --font-display: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
  
  /* Headings - For section headers */
  --font-heading: 'Archivo', 'Inter', -apple-system, sans-serif;
  
  /* Body - For general content */
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  /* Mono - For code, timecode, technical */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  
  /* UI - For interface elements */
  --font-ui: 'Geist', 'Inter', -apple-system, sans-serif;
  
  /* ═══════════════════════════════════════════════════════════
     TYPE SCALE (Major Third - 1.25 ratio)
     ═══════════════════════════════════════════════════════════ */
  
  --text-2xs: 0.625rem;     /* 10px - Micro labels */
  --text-xs: 0.75rem;       /* 12px - Captions, metadata */
  --text-sm: 0.875rem;      /* 14px - Secondary text */
  --text-base: 1rem;        /* 16px - Body text */
  --text-lg: 1.125rem;      /* 18px - Emphasized body */
  --text-xl: 1.25rem;       /* 20px - Small headings */
  --text-2xl: 1.5rem;       /* 24px - Section headings */
  --text-3xl: 1.875rem;     /* 30px - Page titles */
  --text-4xl: 2.25rem;      /* 36px - Display */
  --text-5xl: 3rem;         /* 48px - Hero */
  --text-6xl: 3.75rem;      /* 60px - Splash */
  
  /* ═══════════════════════════════════════════════════════════
     LINE HEIGHTS
     ═══════════════════════════════════════════════════════════ */
  
  --leading-none: 1;
  --leading-tight: 1.15;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* ═══════════════════════════════════════════════════════════
     FONT WEIGHTS
     ═══════════════════════════════════════════════════════════ */
  
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-black: 900;
  
  /* ═══════════════════════════════════════════════════════════
     LETTER SPACING
     ═══════════════════════════════════════════════════════════ */
  
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;
}

/* ═══════════════════════════════════════════════════════════
   TYPOGRAPHY COMPONENT STYLES
   ═══════════════════════════════════════════════════════════ */

/* Display Titles */
.text-display {
  font-family: var(--font-display);
  font-size: var(--text-5xl);
  font-weight: var(--weight-regular);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  font-feature-settings: 'liga' 1, 'kern' 1;
}

/* Page Headings */
.text-h1 {
  font-family: var(--font-heading);
  font-size: var(--text-3xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

.text-h2 {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-snug);
}

.text-h3 {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  line-height: var(--leading-snug);
}

/* Body Text */
.text-body {
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: var(--weight-regular);
  line-height: var(--leading-normal);
}

.text-body-sm {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

/* UI Labels */
.text-label {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: var(--leading-none);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
}

/* Monospace / Technical */
.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
  line-height: var(--leading-relaxed);
  font-feature-settings: 'liga' 0;
}

/* Timecode Display */
.text-timecode {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-wider);
  font-variant-numeric: tabular-nums;
}
```

### Shadows & Elevation

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     ELEVATION SYSTEM
     ═══════════════════════════════════════════════════════════ */
  
  /* Level 0 - Flat (No elevation) */
  --shadow-none: none;
  
  /* Level 1 - Subtle lift (buttons, inputs) */
  --shadow-xs: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 1px rgba(0, 0, 0, 0.1);
  
  /* Level 2 - Cards, panels */
  --shadow-sm: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 0 1px rgba(0, 0, 0, 0.1);
  
  /* Level 3 - Dropdowns, popovers */
  --shadow-md: 
    0 4px 8px rgba(0, 0, 0, 0.35),
    0 2px 4px rgba(0, 0, 0, 0.25),
    0 1px 2px rgba(0, 0, 0, 0.15);
  
  /* Level 4 - Modals, dialogs */
  --shadow-lg: 
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2);
  
  /* Level 5 - Toast notifications, floating panels */
  --shadow-xl: 
    0 16px 32px rgba(0, 0, 0, 0.45),
    0 8px 16px rgba(0, 0, 0, 0.35),
    0 4px 8px rgba(0, 0, 0, 0.25);
  
  /* Level 6 - Dragged elements */
  --shadow-2xl: 
    0 24px 48px rgba(0, 0, 0, 0.5),
    0 12px 24px rgba(0, 0, 0, 0.4),
    0 6px 12px rgba(0, 0, 0, 0.3);
  
  /* ═══════════════════════════════════════════════════════════
     GLOW EFFECTS (Selection, Focus, Active)
     ═══════════════════════════════════════════════════════════ */
  
  --glow-primary: 
    0 0 0 1px var(--accent-primary-500),
    0 0 8px rgba(139, 92, 246, 0.3),
    0 0 16px rgba(139, 92, 246, 0.15);
  
  --glow-secondary:
    0 0 0 1px var(--accent-secondary-500),
    0 0 8px rgba(6, 182, 212, 0.3),
    0 0 16px rgba(6, 182, 212, 0.15);
  
  --glow-success:
    0 0 0 1px var(--success-solid),
    0 0 8px rgba(34, 197, 94, 0.3);
  
  --glow-error:
    0 0 0 1px var(--error-solid),
    0 0 8px rgba(239, 68, 68, 0.3);
  
  /* ═══════════════════════════════════════════════════════════
     INSET SHADOWS (Inputs, wells)
     ═══════════════════════════════════════════════════════════ */
  
  --shadow-inset-sm: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-inset-md: inset 0 2px 4px rgba(0, 0, 0, 0.35);
  --shadow-inset-lg: inset 0 4px 8px rgba(0, 0, 0, 0.4);
}
```

### Border Radius & Corners

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     BORDER RADIUS SCALE
     ═══════════════════════════════════════════════════════════ */
  
  --radius-none: 0;
  --radius-xs: 2px;          /* Micro elements */
  --radius-sm: 4px;          /* Small buttons, badges */
  --radius-md: 6px;          /* Inputs, small cards */
  --radius-lg: 8px;          /* Cards, panels */
  --radius-xl: 12px;         /* Large cards, modals */
  --radius-2xl: 16px;        /* Feature cards */
  --radius-3xl: 24px;        /* Hero elements */
  --radius-full: 9999px;     /* Pills, circles */
  
  /* ═══════════════════════════════════════════════════════════
     COMPONENT-SPECIFIC RADII
     ═══════════════════════════════════════════════════════════ */
  
  --radius-button: var(--radius-md);
  --radius-input: var(--radius-md);
  --radius-card: var(--radius-lg);
  --radius-panel: var(--radius-lg);
  --radius-modal: var(--radius-xl);
  --radius-tooltip: var(--radius-sm);
  --radius-badge: var(--radius-full);
  --radius-avatar: var(--radius-full);
  --radius-thumbnail: var(--radius-md);
  --radius-timeline-clip: var(--radius-sm);
}
```

### Gradients

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     BACKGROUND GRADIENTS
     ═══════════════════════════════════════════════════════════ */
  
  /* Subtle mesh gradients for backgrounds */
  --gradient-mesh-dark: 
    radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(6, 182, 212, 0.06) 0%, transparent 50%),
    radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
    radial-gradient(at 0% 100%, rgba(236, 72, 153, 0.04) 0%, transparent 50%);
  
  /* Panel header gradients */
  --gradient-panel-header: 
    linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-surface) 100%);
  
  /* ═══════════════════════════════════════════════════════════
     ACCENT GRADIENTS
     ═══════════════════════════════════════════════════════════ */
  
  --gradient-primary: 
    linear-gradient(135deg, var(--accent-primary-500) 0%, var(--accent-primary-700) 100%);
  
  --gradient-secondary:
    linear-gradient(135deg, var(--accent-secondary-400) 0%, var(--accent-secondary-600) 100%);
  
  --gradient-tertiary:
    linear-gradient(135deg, var(--accent-tertiary-400) 0%, var(--accent-tertiary-600) 100%);
  
  /* Rainbow gradient for AI/Creative features */
  --gradient-creative:
    linear-gradient(
      135deg,
      #ec4899 0%,
      #8b5cf6 25%,
      #3b82f6 50%,
      #06b6d4 75%,
      #22c55e 100%
    );
  
  /* ═══════════════════════════════════════════════════════════
     FUNCTIONAL GRADIENTS
     ═══════════════════════════════════════════════════════════ */
  
  /* Progress bars */
  --gradient-progress:
    linear-gradient(90deg, var(--accent-primary-500) 0%, var(--accent-secondary-500) 100%);
  
  /* Audio waveform */
  --gradient-waveform:
    linear-gradient(180deg, var(--success-solid) 0%, rgba(34, 197, 94, 0.3) 100%);
  
  /* Video thumbnail overlay */
  --gradient-thumbnail-overlay:
    linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.7) 100%);
  
  /* Scrollable content fade */
  --gradient-scroll-fade-top:
    linear-gradient(180deg, var(--bg-surface) 0%, transparent 100%);
  
  --gradient-scroll-fade-bottom:
    linear-gradient(0deg, var(--bg-surface) 0%, transparent 100%);
}
```

### Spacing & Layout

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     SPACING SCALE (4px base)
     ═══════════════════════════════════════════════════════════ */
  
  --space-0: 0;
  --space-px: 1px;
  --space-0-5: 2px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-3-5: 14px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;
  --space-9: 36px;
  --space-10: 40px;
  --space-12: 48px;
  --space-14: 56px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
  
  /* ═══════════════════════════════════════════════════════════
     LAYOUT DIMENSIONS
     ═══════════════════════════════════════════════════════════ */
  
  /* Sidebar */
  --sidebar-width-collapsed: 48px;
  --sidebar-width-normal: 240px;
  --sidebar-width-wide: 320px;
  
  /* Panels */
  --panel-min-width: 200px;
  --panel-max-width: 600px;
  --panel-header-height: 40px;
  
  /* Timeline */
  --timeline-height-collapsed: 120px;
  --timeline-height-normal: 240px;
  --timeline-height-expanded: 400px;
  --timeline-track-height: 48px;
  --timeline-ruler-height: 24px;
  
  /* Toolbar */
  --toolbar-height: 48px;
  --menubar-height: 32px;
  --statusbar-height: 24px;
  
  /* Thumbnails */
  --thumbnail-xs: 32px;
  --thumbnail-sm: 48px;
  --thumbnail-md: 64px;
  --thumbnail-lg: 96px;
  --thumbnail-xl: 128px;
}
```

---

## 🖼️ Component Architecture

### Explorer Panel

```
┌──────────────────────────────────────┐
│ ▼ EXPLORER                      ─ □ │  ← Panel header with gradient
├──────────────────────────────────────┤
│ 🔍 Search files...              ⌘K  │  ← Search input with shortcut hint
├──────────────────────────────────────┤
│ ▼ 📁 00_concept                      │  ← Folder with icon, expandable
│   ├── 📁 references                  │  ← Nested folder
│   │   ├── 🎨 mood_board_01.png      │  ← Image file with type icon
│   │   ├── 🎨 color_palette.json     │
│   │   └── 🎬 shot_ref_001.mp4       │  ← Video file
│   └── 📄 treatment.md                │  ← Text file
│ ▼ 📁 01_script                       │
│   ├── 📄 screenplay_v3.fountain     │  ← Selected item (glow border)
│   └── 📁 translations                │
│ ▶ 📁 02_storyboard                   │  ← Collapsed folder
│ ▶ 📁 03_characters                   │
├──────────────────────────────────────┤
│ + New File  📁 New Folder            │  ← Action buttons
└──────────────────────────────────────┘
```

### Timeline Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIMELINE                              00:00:15:12 / 00:02:30:00    ─ □ ▢    │
├─────────────┬───────────────────────────────────────────────────────────────┤
│  ◀◀  ◀  ▶  ▶▶  │  |◄────────────────────────▼────────────────────────────►|  │
│              │   0:00        0:30        1:00        1:30        2:00       │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ 🎥 V1       │  ┌─────────┐    ┌──────────────────┐    ┌─────┐              │
│ ━━━━━━━━━━━ │  │ Shot 1  │    │     Shot 2       │    │  3  │              │
│             │  └─────────┘    └──────────────────┘    └─────┘              │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ 🎥 V2       │       ┌──────┐                    ┌────────────┐              │
│ ━━━━━━━━━━━ │       │ OVL  │                    │  VFX Comp  │              │
│             │       └──────┘                    └────────────┘              │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ 🔊 A1       │  ┌────────────────────────────────────────────────────────┐   │
│ ━━━━━━━━━━━ │  │ ▁▂▃▅▆▇█▇▆▅▃▂▁  Dialogue Track  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁         │   │
│             │  └────────────────────────────────────────────────────────┘   │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ 🎵 M1       │            ┌──────────────────────────────────────────┐       │
│ ━━━━━━━━━━━ │            │      🎵 Background Score                 │       │
│             │            └──────────────────────────────────────────┘       │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ 💬 S1       │     ┌────┐          ┌────────┐         ┌──────┐              │
│ ━━━━━━━━━━━ │     │ EN │          │   FR   │         │  ES  │              │
│             │     └────┘          └────────┘         └──────┘              │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

### Inspector Panel

```
┌──────────────────────────────────────┐
│ INSPECTOR                       ─ □  │
├──────────────────────────────────────┤
│ ┌────────────────────────────────┐   │
│ │                                │   │
│ │     📷 THUMBNAIL PREVIEW       │   │  ← Asset preview
│ │                                │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ shot_042_take_03.mov                 │  ← File name
│ 📹 Video • 1920×1080 • 23.976fps     │  ← File info badges
├──────────────────────────────────────┤
│ ▼ TRANSFORM ─────────────────────    │  ← Collapsible section
│                                      │
│   Position   X ├────●────┤ 960      │  ← Scrubber inputs
│              Y ├────●────┤ 540      │
│                                      │
│   Scale      X ├────●────┤ 100%     │
│              Y ├────●────┤ 100%     │
│              🔗 Constrain            │  ← Lock aspect ratio
│                                      │
│   Rotation     ├────●────┤ 0°       │
│   Opacity      ├──────●──┤ 85%      │
├──────────────────────────────────────┤
│ ▼ COLOR CORRECTION ──────────────    │
│                                      │
│   ┌──────────────────────────────┐   │
│   │    ╱‾‾‾‾‾‾╲                  │   │  ← Curves editor
│   │   ╱        ╲                 │   │
│   │  ╱          ╲                │   │
│   └──────────────────────────────┘   │
│                                      │
│   Temperature  ├──●──────┤ Warm     │
│   Tint         ├────●────┤ 0        │
│   Exposure     ├────●────┤ +0.3     │
├──────────────────────────────────────┤
│ ▶ EFFECTS (3) ───────────────────    │  ← Collapsed with count
├──────────────────────────────────────┤
│ ▶ METADATA ──────────────────────    │
└──────────────────────────────────────┘
```

---

## 🔧 Component States & Interactions

### Selection States

| State | Visual Treatment |
|-------|-----------------|
| **Default** | `bg: transparent`, `border: var(--border-subtle)` |
| **Hover** | `bg: var(--hover-bg)`, subtle lift animation |
| **Selected** | `bg: var(--selection-bg)`, `border: var(--selection-border)`, `glow: var(--glow-primary)` |
| **Active/Pressed** | `bg: var(--active-bg)`, scale(0.98) |
| **Focused** | `outline: 2px solid var(--border-focus)`, `outline-offset: 2px` |
| **Disabled** | `opacity: 0.5`, `cursor: not-allowed` |
| **Dragging** | `shadow: var(--shadow-2xl)`, `opacity: 0.9`, rotation hint |
| **Drop Target** | `border: 2px dashed var(--drop-zone-border)`, `bg: var(--drop-zone)` |

### Asset Type Indicators

```css
/* Visual coding for asset types */
.asset-indicator {
  /* Colored left border strip */
  border-left: 3px solid var(--asset-color);
  
  /* Icon background tint */
  .icon-bg {
    background: color-mix(in srgb, var(--asset-color) 15%, transparent);
  }
}

/* Asset-specific colors */
.asset-image    { --asset-color: var(--asset-image); }    /* Pink */
.asset-video    { --asset-color: var(--asset-video); }    /* Violet */
.asset-audio    { --asset-color: var(--asset-audio); }    /* Green */
.asset-text     { --asset-color: var(--asset-text); }     /* Blue */
.asset-3d       { --asset-color: var(--asset-3d); }       /* Orange */
.asset-prompt   { --asset-color: var(--asset-prompt); }   /* Purple */
```

---

## 📱 Page Structure

```
/                           # Home / Dashboard
├── /projects               # Project management
│   ├── /new                # Create new project
│   └── /[id]               # Project workspace
│       ├── /edit           # Main editing workspace
│       ├── /timeline       # Timeline view
│       ├── /storyboard     # Storyboard view
│       └── /export         # Export settings
├── /assets                 # Global asset library
│   ├── /images             # Image browser
│   ├── /videos             # Video browser
│   ├── /audio              # Audio browser
│   ├── /3d                 # 3D model browser
│   └── /prompts            # AI prompt library
├── /generate               # AI Generation hub
│   ├── /image              # Image generation
│   ├── /video              # Video generation
│   ├── /audio              # Audio generation
│   ├── /text               # Text generation
│   └── /speech             # Speech synthesis/recognition
├── /settings               # Application settings
│   ├── /api-keys           # API configuration
│   ├── /appearance         # Theme & display
│   ├── /shortcuts          # Keyboard shortcuts
│   └── /export             # Export presets
├── /help                   # Documentation
│   ├── /getting-started    # Quick start guide
│   ├── /tutorials          # Video tutorials
│   └── /shortcuts          # Shortcut reference
├── /about                  # About page
├── /contact                # Contact form
├── /privacy                # Privacy policy
├── /terms                  # Terms of service
├── /cookies                # Cookie policy
├── /sitemap.xml            # Sitemap
└── /robots.txt             # Robots file
```

---

## 🚀 Getting Started

### Prerequisites

- [Deno 2](https://deno.com/) installed on your system

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/intelartigenerator.git
cd intelartigenerator

# Install dependencies
deno install --allow-scripts

# Start development server
deno task dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `deno task dev` | Start development server |
| `deno task build` | Build for production |
| `deno task start` | Start production server |
| `deno task lint` | Run linting |

---

## 📚 Tech Stack

- **Runtime**: Deno 2
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: CSS Modules + CSS Variables
- **State**: Zustand
- **Animation**: Framer Motion
- **Icons**: Lucide Icons
- **3D**: Three.js / React Three Fiber

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">
  <br />
  <p>
    <strong>IntelArtiGenerator</strong> — Where AI meets Cinema
  </p>
  <p>
    Built with ♥ using Next.js & Deno 2
  </p>
</div>
