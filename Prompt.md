# Ars TechnicAI — Product Requirements & Feature Inventory (PRD)

> **Document Version**: 2.0 · **Last Updated**: June 2026 · **Status**: Living Document
>
> This document consolidates the complete idea space into a coherent specification for Ars TechnicAI: an AI production suite to create prompts, images, videos, comics, and 3D scenes, assembling them into final deliverables via a graph-based pipeline and timeline.
>
> For UI and CSS specs, see `Design.md`. For code boundaries, see `Structure.md`. For architecture critique, see `ARCHITECTURE.md`.

---

## 1. Vision

Ars TechnicAI is a **multi-modal creative IDE** that lets users:

- **Author and version prompts** (templates + variables + vocab libraries).
- **Generate, edit, and remix** images, video, audio, and 3D via multiple AI providers.
- Build a reproducible **blueprint pipeline** on an infinite canvas.
- Sequence outputs into a final **video/comic/audio timeline** with effects, transitions, and captions.
- Export variations for multiple social platforms (aspect ratios, durations, formats).
- **Publish directly** to social media via platform APIs.
- Maintain **full provenance** — every pixel traces back to its prompt, seed, and model.

---

## 2. Primary Personas (Expanded)

| Persona | Needs | Primary Workflow | Critical Feature |
|---------|-------|-----------------|------------------|
| **Solo Filmmaker** | Rapid ideation → iterate → publish shorts | Prompt → generate images → assemble video → auto-post | Timeline + Multi-platform export |
| **Comics Artist** | Character consistency + panel layout + dialogue | Character profiles → generate panels → layout → speech bubbles | Character consistency system |
| **Content Producer** | Batch generation + variant management | Batch prompt → 4× variants per prompt → pick best → schedule posts | Batch generation |
| **Motion Designer** | Timeline + effects + transitions + audio sync | Storyboard → motion prompts → timeline assembly → effects | Real timeline playback |
| **Game Developer** | 3D assets + textures + concept art | 3D generation → texture mapping → concept art → export | 3D module |
| **Social Media Manager** | Cross-platform posting, analytics, scheduling | Quick-create → format-aware generation → publish → track | Auto-publish + analytics |
| **AI Researcher** | Prompt engineering, model comparison, reproducibility | Prompt templates → A/B test models → compare → export provenance | Versioned prompts + provenance |
| **Educator** | Visual aids, explainer videos, course materials | Script → generate visuals → assemble → export | Text-to-image + timeline |

---

## 3. Operating Model (What Users "Do")

### The Author's Vision Pipeline

The complete creative arc from raw intent to published deliverable:

```
PRE-PRODUCTION
───────────────────────────────────────────────────────────────────

1. DEFINE THE PROJECT
   Set project type (film/short/comic/storyboard/script), aspect ratio,
   genre, target audience, synopsis/logline.

2. WRITE THE SCRIPT
   Formatted screenplay editor (sluglines, action, dialogue) or free prose
   treatment. Each scene block can be highlighted to auto-generate a shot list.
   AI co-writer assists with dialogue, pacing, and scene descriptions.

3. BUILD THE WORLD
   → Character Database: name, appearance, voice profile, wardrobe, arc
   → Location Manager: description, reference images, time-of-day, weather
   → Lore/Wiki: world rules, terminology, backstory
   → Color Script: per-scene mood swatches showing how atmosphere shifts

4. ASSEMBLE INSPIRATION
   Drag any files into Explorer: reference photos, mood board images, sketches,
   color swatches, existing footage. These become "Inspiration Assets" —
   non-destructive references that inform generation but are not final deliverables.
   Organize into Reference Boards per scene or chapter.

5. STORYBOARD
   Create Shot Nodes on the canvas representing individual shots.
   Each Shot Node carries: camera angle, focal length, subject action, dialogue cue,
   estimated duration. Order nodes linearly to create an Animatic.

PRODUCTION
───────────────────────────────────────────────────────────────────

6. AUTHOR PROMPTS
   From the shot list, craft prompts using:
   → Prompt Templates (reusable structures with named variables)
   → Vocabulary Library (camera, lens, lighting, composition, materials, FX)
   → Character Profiles (inject appearance constraints for consistency)
   → Style References (apply visual style from mood board / reference assets)
   → Negative Prompts (exclude unwanted elements)

7. GENERATE MEDIA
   Run generation jobs: image → video → audio. Each asset carries full provenance:
   prompt text, seed, model, provider, parameters. Branch into variant sets.
   Compare side-by-side. Pick best results. Remix, upscale, inpaint as needed.

8. CONNECT NODES
   On the canvas, draw edges between assets to define the pipeline:
   prompt → generator → transform → output.
   Groups of nodes form reusable Blueprints.

POST-PRODUCTION
───────────────────────────────────────────────────────────────────

9. SEQUENCE ON TIMELINE
   Drop generated media onto timeline tracks.
   Order shots into scenes → scenes into chapters → chapters into the full piece.
   Add transitions, audio, captions, effects, color grades.

10. EXPORT & PUBLISH
    Apply format profiles (platform presets: TikTok 9:16, YouTube 16:9, etc.)
    Embed provenance in file metadata (EXIF/XMP: prompt, seed, model).
    Auto-post via platform APIs. Schedule posts. Track analytics.
```

### The Classic Short Workflow (Most Common Path)
```
1. COLLECT ASSETS
   Files, references, prompts, vocab presets → Explorer

2. DRAG TO CANVAS
   Assets become nodes on the infinite canvas → Blueprint

3. CONNECT NODES
   Define data flow: prompt → generator → transform → export

4. RUN JOBS
   Queued → processing → completed → inspect → branch variations

5. SEQUENCE ON TIMELINE
   Drop results onto timeline tracks → order → trim → transition

6. EXPORT & PUBLISH
   Format profiles → render → auto-post to social platforms
```

### Always-Visible Pillars

- **Explorer**: Asset source of truth (inspiration assets, imports, generated outputs)
- **Canvas**: How it's made (pipeline blueprint, storyboard, node graph)
- **Inspector**: Prompt authoring, generation parameters, provenance, version history
- **Timeline**: Final linear assembly (shots → scenes → full piece)

### Inspiration Asset Categories

| Category | Examples | Canvas Role |
|----------|---------|-------------|
| **Mood Board** | Color-keyed reference photos | Style reference for generation |
| **Reference Still** | Location photos, product photos, actor headshots | Visual anchor for character/environment |
| **Sketch / Drawing** | Hand-drawn composition, rough storyboard | Layout guide for image generation |
| **Color Palette** | Extracted swatches from reference | Color-lock for consistent output |
| **Style Frame** | A single image whose style to replicate | Style transfer source |
| **Animatic Frame** | Low-fidelity shot for timing validation | Timing reference before full generation |
| **Dialogue Script** | SRT/VTT/text file with dialogue lines | Source for TTS voice generation |
| **Music Stem** | Backing track for mood calibration | Pacing guide for video assembly |

---

## 4. Modes (Top Bar)

Modes change the default toolset without changing the app shell.

### 4.1 Image Creation
- Prompt authoring + vocab picker (camera, lenses, lighting, composition, materials)
- Reference board assembly (images, frames, palettes)
- Generation node palette (provider adapters + model presets)
- Variation browser + side-by-side compare
- Batch generation (N variants per prompt)

### 4.2 Image Rework (Editing)
- Non-destructive editing stack (masking, inpaint/outpaint, upscaling, color grade)
- Layer-like workflow: "edits as nodes" (reproducible)
- Before/after compare, side-by-side, onion-skin for comics
- Background removal (one-click)
- Color analysis with precision cursor

### 4.3 Video (Shot → Sequence)
- Shot list + storyboard frames
- Timeline editing: clips, audio, subtitles, transitions
- Render/export presets: resolution, fps, codec targets
- AI interpolation: start frame → end frame → sequence

### 4.4 Comic
- Panel layout templates (grid, manga, cinematic widescreen)
- Speech bubbles, captions, SFX typography
- Character consistency (profiles + style locks)

### 4.5 3D Scene
- Scene graph: objects, lights, cameras
- Puppet system with skeletal animation
- Camera rigs (dolly, crane, handheld simulation)
- Renders that feed back into 2D pipeline (plate generation, matte passes)

---

## 5. Asset Taxonomy (Complete)

Assets are first-class; everything should be searchable, taggable, and linkable.

### Asset Categories

| Category | Sub-types | AI-Generatable? | Manual? | Remixable? | Pipeline Phase |
|----------|-----------|-----------------|---------|------------|----------------|
| **Prompt** | Template, Variable Set, Vocab Library, Example, History | ✅ LLM | ✅ | ✅ | Production |
| **Script** | Screenplay, Treatment, Dialogue, Shot List | ✅ LLM | ✅ | ✅ | Pre-Production |
| **Storyboard** | Shot Frames, Animatic, Panel Layout | ✅ (from script) | ✅ | ✅ | Pre-Production |
| **Image** | Raster (PNG/JPEG/WebP/EXR/HDR), Vector (SVG), Generated, Placeholder | ✅ | ✅ | Production |
| **Video** | MP4, WebM, MOV, Image Sequence, Filmstrip | ✅ | ✅ | ✅ | Production |
| **Audio** | WAV, MP3, AAC, Generated TTS, Music, SFX, Ambience | ✅ | ✅ | ✅ | Production |
| **Text** | Script (SRT/VTT), Markdown, JSON, CSV, Subtitle | ✅ LLM | ✅ | ✅ | Pre/Post |
| **3D** | GLTF, GLB, OBJ, Gaussian Splat (PLY) | ✅ | ✅ | ✅ | Production |
| **Reference** | Inspiration Image, Mood Board Frame, Sketch, Color Palette, Style Frame | N/A | ✅ | ✅ | Pre-Production |
| **Character** | Identity + Look + Voice Profile + Wardrobe + Arc + Lore | ✅ LLM | ✅ | ✅ | Pre-Production |
| **Scene** | Location + Time-of-Day + Props + Atmosphere + Notes | ✅ LLM | ✅ | ✅ | Pre-Production |
| **Vocabulary** | Cameras, Lenses, Lighting, Composition, Materials, FX (structured JSON) | ✅ LLM | ✅ | ✅ | Production |
| **Color Script** | Per-scene mood swatches, atmosphere progression | N/A | ✅ | ✅ | Pre-Production |
| **Preset** | Provider Presets, Color Grades, LUTs, Export Presets | ✅ | ✅ | ✅ | Post-Production |
| **Blueprint** | Reusable Pipeline (nodes + edges) | ✅ Agent | ✅ | ✅ | Production |
| **Generated Output** | Any AI output with full provenance | ✅ | N/A | ✅ | Production/Post |

### Asset Origin Classification

Every asset carries an `origin` field that determines its color coding across all views:

| Origin | Color | Meaning | Example |
|--------|-------|---------|---------|
| `inspiration` | Amber `--a-tertiary` | Imported for reference, not a deliverable | Mood board image, reference photo |
| `manual` | Blue `--e-original` | Created by the author directly | Sketch, hand-drawn composition |
| `imported` | Green `--e-imported` | Brought in from external filesystem/URL | Stock photo, licensed footage |
| `generated` | Lavender `--t-prompt` | AI output with full generation provenance | Imagen render, Runway clip |
| `remixed` | Red `--e-user-added` | Derived/edited from a generated asset | Inpainted image, upscaled render |
| `assembled` | Purple `--t-video` | Composed from multiple sources in the timeline | Final video export |

### Asset Provenance (Tracked per Asset)

```
{
  "identity": { "id": "uuid", "name": "...", "type": "image" },
  "classification": { "mime": "image/png", "size": 245760, "dimensions": [512, 512] },
  "spatial": { "canvasX": 100, "canvasY": 200, "zIndex": 5, "rotation": 0, "scale": 1 },
  "temporal": { "timelineStart": 0, "timelineDuration": 5000 },
  "provenance": {
    "source": "generated",
    "parentId": "uuid-of-parent",
    "lineageId": "uuid-of-lineage",
    "generationMeta": {
      "prompt": "...",
      "negativePrompt": "...",
      "model": "google/imagen-3",
      "seed": 1234567890,
      "width": 512,
      "height": 512,
      "steps": 30,
      "guidanceScale": 7.5,
      "generatedAt": 1719000000000,
      "providerCallId": "uuid-of-call"
    }
  },
  "relations": {
    "parentAssetId": "uuid",
    "childAssetIds": ["uuid1", "uuid2"],
    "groupIds": ["group-uuid"],
    "timelineClipIds": ["clip-uuid"],
    "projectIds": ["project-uuid"]
  },
  "administrative": {
    "createdAt": 1719000000000,
    "modifiedAt": 1719000000000,
    "deletedAt": null,
    "versionId": "version-uuid",
    "status": "ready"
  }
}
```

---

## 6. Canvas (Blueprint Graph) Requirements

### Node Categories (Complete)

| Category | Node Types | Ports |
|----------|-----------|-------|
| **Inputs** | Prompt, Text, Image, Video, Audio, Palette, Script, Storyboard, Reference | Out: typed media |
| **Generation** | Provider Call (image/video/audio), LLM Call, 3D Gen | In: prompts + params, Out: generated |
| **Transform** | Resize, Crop, Pad, Flip, Rotate, Mask, Merge, Split, Stabilize, Time Remap | In: media, Out: transformed |
| **AI Edit** | Upscale, Inpaint, Outpaint, Style Transfer, Background Remove, Face Swap, Depth Estimate, Segment | In: image + params, Out: edited |
| **Color** | Color Grade (LUT), Color Analysis, Auto White Balance, Palette Extract | In: image, Out: image + data |
| **3D** | 3D Scene, Camera Rig, Puppet Animation, Render Pass | In: models + params, Out: 2D render |
| **Organization** | Frame/Group, Comment, Bookmark, Reference Board, Sub-graph | No exec |
| **Outputs** | Export Image, Export Video, Export Comic Pages, Publish Package, Format Transcode | In: final media, Out: file |

### Graph Behaviors
- Typed ports (image/video/audio/text/data/mask/3D)
- Edge validation with helpful error messages
- Per-node runs with cached results (skip re-run if inputs unchanged)
- Undo/redo for graph edits
- Graph serialization in project files (`.arsproj/graph.json`)
- Export graph as JSON for sharing

---

## 7. Timeline Requirements (Complete)

### Track Types

| Track | Icon | Color | Height | Content |
|-------|------|-------|--------|---------|
| Video Primary | 🎬 | `--t-video` (#8b5cf6) | 52px | Main video clips |
| Video Overlay | 🎬 | `--t-video` 60% | 40px | Picture-in-picture, overlay |
| Audio Music | 🎵 | `--t-audio` (#22c55e) | 36px | Background music |
| Audio Voice | 🎤 | `--t-audio` 70% | 36px | Dialogue, voiceover |
| SFX | 🔊 | `--t-audio` 50% | 30px | Sound effects |
| Captions | 📝 | `--t-text` (#60a5fa) | 28px | Subtitle text |
| Effects | 🎨 | `--a-tertiary` (#f59e0b) | 30px | Color grade, filters |
| Prompts | 💬 | `--t-prompt` (#c084fc) | 30px | AI generation triggers at timestamps |
| Groups | 📦 | `--a-secondary` (#7c3aed) | 40px | Grouped multi-track regions |

### Timeline Features
- **Multi-track editing**: vertical or collapsible tracks
- **Transitions**: cross-fade, dissolve, wipe, push — drag between clips
- **Scene timing**: labeled duration regions, draggable boundaries
- **Visual preview**: low-res preview plays in canvas area before final render
- **Asset drop**: drag from Explorer/Canvas onto track at playhead position
- **Keyboard shuttle**: J (reverse), K (stop), L (forward), Space (play/pause), ←→ (frame step)
- **Markers**: todo, chapter, cue, comment — colored markers on ruler
- **Snapping**: clip edges snap to playhead, markers, and other clip edges
- **Trim handles**: drag clip edges to adjust in/out points
- **Ripple edit** (future): trimming shifts subsequent clips

---

## 8. Prompt Engineering System

### Core Philosophy
Prompts are **versioned, structured assets** — not throwaway strings. Every prompt is saved with its full context so any result can be exactly reproduced.

### Prompt Templates
- Variables with types: `string`, `number`, `enum`, `asset_reference`
- Optional constraints: min/max, regex, allowed values list
- Provider capability mapping (some params unsupported by some providers)
- Version history with model context (provider, model, seed, size, steps, guidance, errors, outputs)
- Template categories: Character, Environment, Object, Scene, Abstract, Style Transfer

### Prompt Construction Layers (Applied in Order)

```
1. BASE CONTENT DESCRIPTION  (what is in the image)
   "A lone astronaut walking across a red desert at sunset"

2. CHARACTER INJECTION  (from Character DB, if present)
   "Character: tall woman, short silver hair, white EVA suit with orange accents"

3. SCENE CONTEXT  (from Location/World Building)
   "Setting: Martian surface, vast empty plain, distant rock formations"

4. STYLE + MOOD  (from Mood Board / Style Reference)
   "Cinematic style, Ridley Scott aesthetic, desaturated color grade with warm highlights"

5. VOCABULARY LIBRARY APPEND  (from Vocab Presets)
   "85mm anamorphic lens, f/2.8, shallow depth of field, golden hour backlighting,
    Rule of Thirds composition, film grain, slight chromatic aberration"

6. PLATFORM / FORMAT QUALIFIER  (from Target Platform)
   "9:16 vertical composition, safe zones respected, centered subject"

7. QUALITY SUFFIX  (always appended)
   "8K resolution, ultra detailed, professional photography, photorealistic"

8. NEGATIVE PROMPT  (sent separately to provider)
   "blurry, pixelated, watermark, text, logo, extra limbs, bad anatomy"
```

### Prompt Run Provenance (Implemented)
For each generation run, the system tracks:
- Prompt draft text and version labels (`v1`, `v2`, ...)
- Provider + model + parameters (seed, width, height, steps, guidance scale, sampler)
- Negative prompt
- Style reference asset ID (if style transfer applied)
- Character profile IDs (if character injection used)
- Run status (`queued`, `running`, `completed`, `failed`, `cancelled`)
- Output asset IDs and generation job IDs
- Error message when runs fail
- Cost estimate (token count × provider pricing)
- Timing: queued_at, started_at, completed_at, duration_ms

### Vocab Libraries (Structured JSON)

| Library | Fields | Example Values |
|---------|--------|---------------|
| **Shot Type** | angle, framing, movement | ECU, CU, MCU, MS, WS, EWS; Eye level, Low angle, High angle, Dutch; Static, Pan, Tilt, Dolly, Crane |
| **Camera** | focal_length, aperture, sensor, film_stock, ISO | 24mm, 35mm, 50mm, 85mm, 200mm; f/1.4–f/16; ARRI Alexa, RED Dragon; Kodak Vision3 500T |
| **Lighting** | key, fill, rim, color_temperature, modifiers, motivated_by | Rembrandt, 3-point, Neon Noir, Golden Hour; 2700K–8000K; Softbox, Grid, Fresnel |
| **Composition** | rule, negative_space, depth, symmetry | Rule of thirds, Golden ratio, Leading lines, Frame-within-frame, Centered |
| **Materials** | PBR_roughness, metalness, SSS, anisotropy, displacement | Matte, Glossy, Metallic, Translucent, Velvet |
| **FX** | film_grain, chromatic_aberration, halation, bloom, lens_distortion | Heavy grain, Subtle CA, Bloom at highlights, Barrel distortion |
| **Mood** | tone, atmosphere, era, emotion | Melancholic, Tense, Joyful; Foggy, Harsh, Dreamy; 1970s, Futuristic, Medieval |
| **Color** | palette_name, primaries, accents, contrast | Teal & Orange, Moody Blues, High Contrast B&W, Pastel Summer |

### Storyboard Generation from Script

```
Script Scene Block
    │
    ├── Extract: Setting, Characters, Action, Dialogue, Tone
    ├── Derive: Camera recommendation (based on action intensity + shot importance)
    ├── Map to: Shot Type + Lighting preset + Composition guide
    ├── Inject: Character profiles from Character DB
    └── Output: Storyboard Shot Node with:
                - Frame description (auto-generated)
                - Camera spec
                - Suggested prompt (editable before generation)
                - Estimated duration
                - Dialogue cue
```

---

## 9. Character Consistency System

### The Problem
Generating multiple images of "the same character" with current diffusion models is non-deterministic — identical prompts with different seeds produce different faces, body proportions, and style details. Character consistency is the most-requested feature for AI filmmaking and comics.

### Vocabulary

| Term | Definition |
|------|-----------|
| **Identity Anchor** | A reference image (or set of images) that defines the character's face and body for a generation session |
| **Character Embedding** | A learned vector representation of the character's visual identity, used to condition the diffusion model |
| **IP-Adapter** | Image Prompt Adapter — a model conditioning mechanism that injects reference image features into the generation process without fine-tuning |
| **LoRA (Low-Rank Adaptation)** | A fine-tuning technique that trains a small adapter on reference images of a character, producing a model that consistently generates that specific character |
| **Face Lock** | Informal term for any technique that pins the character's face to a reference, regardless of the underlying mechanism |
| **Character Arc** | The psychological and visual evolution of a character over the story — which must be reflected in their appearance (wounds, wardrobe changes, aging) |
| **Visual Throughline** | The consistent set of visual cues (colors, silhouette, distinctive props) that identify a character across scenes, even when the face is not visible |
| **Wardrobe Preset** | A named outfit configuration for a character that can be applied to any shot via prompt injection |
| **Pose Library** | A set of reference images or metadata describing character poses (standing, sitting, running, reaching) that inform generation composition |
| **Expression Sheet** | A set of reference images showing the character at key emotional expressions (neutral, happy, angry, surprised, afraid) — used to generate consistent emotion-specific shots |

### Implementation Architecture

```
CHARACTER PROFILE
  { id, name, appearance, voice, wardrobe, arc, referenceImages[] }
          │
          ├─► Layer 2 (Character Injection) in Prompt Construction
          │     → "Character: tall woman, silver hair, white EVA suit with orange accents"
          │
          ├─► IP-Adapter conditioning (image reference passed to model API)
          │     → Reference image URL or base64 sent to provider that supports IP-Adapter
          │
          └─► Post-processing (if provider lacks IP-Adapter)
                → Face-swap module: generate → extract face from reference → swap into generated image

CHARACTER CONSISTENCY PIPELINE:
  Reference Image(s) → [intelligence-character module] → Character Embedding
       │                                                       │
       └─────────────────────────────────────────────────────▶│
                                                               ▼
                                               All generation jobs referencing this character
                                               receive the embedding as a conditioning input
```

### Character Profile Schema

```typescript
interface CharacterProfile {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
  
  appearance: {
    age: string;              // "mid-30s", "teenage", "elderly"
    build: string;            // "athletic, 5'10", lean"
    skinTone: string;         // "warm medium brown"
    eyes: string;             // "almond-shaped, dark brown"
    hair: string;             // "short silver undercut"
    distinctiveFeatures: string;  // "small scar above left eyebrow"
  };
  
  wardrobe: Record<string, WardrobePreset>;  // { "casual": {...}, "battle": {...} }
  
  voice: {
    provider: string;         // "elevenlabs"
    voiceId: string;          // ElevenLabs voice ID
    toneDescription: string;  // "low, measured, slight eastern European accent"
  };
  
  arc: {
    opening: string;          // Physical/emotional state at story start
    midpoint: string;         // Key change event
    resolution: string;       // Final state
    appearanceChanges: string[];  // "Gets a facial scar in Act 2", "Shaves head at midpoint"
  };
  
  referenceImages: string[];    // Asset IDs of identity anchor images
  expressionSheet: Record<string, string>;  // { emotion: assetId }
  poseLibrary: string[];        // Asset IDs of pose reference images
  
  promptInjection: {
    shortForm: string;          // "tall silver-haired woman in white EVA suit"
    longForm: string;           // Full appearance description for detailed shots
  };
}
```

---

## 10. Script Editor Specification

### Screenplay Vocabulary

| Term | Definition |
|------|-----------|
| **Slugline (Scene Heading)** | The header of each scene: `INT./EXT. LOCATION - TIME OF DAY`. The building block of script parsing. |
| **Action Line** | Prose description of what the camera sees and what characters do, written in present tense |
| **Parenthetical** | A brief acting direction in parentheses inside a dialogue block: `(quietly)`, `(to herself)` |
| **Transition** | A page direction indicating a cut: `CUT TO:`, `DISSOLVE TO:`, `SMASH CUT:` |
| **Scene Beat** | The smallest unit of dramatic action — a moment where something changes (attitude, power, information) |
| **Act Break** | The structural division of a story into acts (2-act, 3-act, 5-act). Each act has a clear turning point. |
| **Inciting Incident** | The event that kicks off the main conflict and sets the protagonist's goal |
| **Midpoint** | The structural center of the story where the protagonist commits fully to the goal |
| **Dark Night of the Soul** | The lowest point before the final confrontation — maximum crisis before resolution |
| **Denouement** | The settling-out period after the climax — loose ends resolved, new equilibrium established |
| **Coverage** | In filmmaking: the set of different camera angles and takes recorded for a scene, to give editors options |
| **Lore Bible / World Bible** | A living reference document for all in-world facts: history, rules, language, geography, factions |
| **Production Bible** | A comprehensive document for a series/project: character sheets, episode synopses, style guide, tone guide |
| **One-liner** | A brief (one sentence) description of each scene, used for scheduling and budgeting |

### Fountain Syntax Support (Planned)

The script editor will support [Fountain](https://fountain.io) — the plain-text screenplay format:

```
INT. ABANDONED WAREHOUSE - NIGHT

A single bare bulb swings overhead. MARA (30s, military posture, haunted eyes) stands
over a pile of classified documents.

MARA
(to herself)
They knew. They've always known.

She sweeps the documents off the table.

CUT TO:

EXT. CITY SKYLINE - NIGHT

The city glitters, indifferent.
```

Fountain scenes are parsed into `SceneBlock` objects, each extracting:
- Slugline → Location + time-of-day → feeds `location-manager`
- Characters mentioned → cross-references `character-db`
- Action lines → generates shot suggestions via `script-to-shots` module
- Dialogue → feeds `generate-tts` with character voice IDs

---

## 11. Publishing Pipeline Specification

### Post Lifecycle Vocabulary

| Term | Definition |
|------|-----------|
| **Draft** | A publishing job that exists locally, has not been submitted to the platform |
| **Scheduled** | A post queued for automatic submission at a future time |
| **Submitted** | Sent to the platform API; awaiting platform processing |
| **Posted** | Live on the platform with a URL |
| **Shadowbanned** | Distributed to 0% of followers — platform detection without user notification. Detected by analytics gap. |
| **Reach** | Total unique accounts that saw the post |
| **Impression** | Each individual view (one account can generate multiple impressions) |
| **Engagement Rate** | (Likes + Comments + Shares + Saves) / Reach × 100% |
| **Hook Rate** | % of viewers who watched past the first 3 seconds (key TikTok/Reels metric) |
| **Completion Rate** | % of viewers who watched the full video to the end |
| **CTR (Click-Through Rate)** | % of viewers who clicked a link in bio or story swipe-up |
| **Caption Line Break Pattern** | Technique of using strategic empty lines in captions to increase tap-to-read engagement |
| **Call to Action (CTA)** | The specific action you want the viewer to take: "Follow for more", "Link in bio", "Comment your thoughts" |
| **Hashtag Strategy** | Deliberate mix of high-volume, niche, and branded hashtags to maximize discoverability |
| **Peak Time Posting** | Scheduling posts during windows of highest audience activity for the account |

### Platform Format Requirements

| Platform | Video Format | Max Duration | Aspect Ratios | Caption Limit | API Support |
|----------|-------------|--------------|---------------|---------------|-------------|
| TikTok | MP4 H.264 | 10 min | 9:16 (primary), 1:1 | 2,200 chars | TikTok Content Posting API v2 |
| Instagram Reels | MP4 H.264 | 15 min | 9:16, 1:1 | 2,200 chars | Meta Graph API |
| Instagram Feed | JPEG/MP4 | 60 sec (video) | 1:1, 4:5, 16:9 | 2,200 chars | Meta Graph API |
| YouTube Shorts | MP4 | 3 min | 9:16 | 5,000 chars | YouTube Data API v3 |
| YouTube (standard) | MP4 H.264/H.265 | 12 hours | 16:9 | 5,000 chars | YouTube Data API v3 |
| X (Twitter) | MP4 | 2:20 min | 1:1, 16:9 | 280 chars | Twitter API v2 |
| LinkedIn | MP4 | 10 min | 1:1, 16:9 | 3,000 chars | LinkedIn Marketing API |

### Publish Job State Machine

```
DRAFT ──► REVIEW ──► SCHEDULED ──► SUBMITTING ──► POSTED
  │          │            │               │           │
  │          │            │               ▼           │
  │          │            │          FAILED ──► RETRY │
  │          │            │                           │
  ▼          ▼            ▼                           ▼
CANCELLED REJECTED   UNSCHEDULED               ANALYTICS POLLING
                                                    │
                                                    ▼
                                              PERFORMANCE REPORT
                                              (reach, engagement, hook rate)
```

---

## 12. Provider Integration (Architecture Requirements)

### Unified Adapter Interface

```typescript
interface ProviderAdapter {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  models: ModelDef[];
  
  validateApiKey(key: string): Promise<boolean>;
  getCapabilities(): ProviderCapability[];
  
  generateImage(params: ImageGenParams): Promise<GenResult>;
  generateVideo?(params: VideoGenParams): Promise<GenResult>;
  generateAudio?(params: AudioGenParams): Promise<GenResult>;
  
  cancelJob(jobId: string): Promise<void>;
  getJobStatus(jobId: string): Promise<JobStatus>;
}
```

### Integrated Providers

| Provider | Image | Video | Audio | 3D | Status |
|----------|-------|-------|-------|----|--------|
| Google Imagen | ✅ | ⬜ | ⬜ | ⬜ | Live |
| OpenAI DALL·E | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Stability AI | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Fal.ai | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Replicate | ⬜ | ⬜ | ⬜ | ⬜ | Planned |
| Midjourney | ⬜ | ⬜ | ⬜ | ⬜ | Planned (API pending) |
| Runway | ⬜ | Planned | ⬜ | ⬜ | Planned |
| Pika | ⬜ | Planned | ⬜ | ⬜ | Planned |
| ElevenLabs | ⬜ | ⬜ | Planned | ⬜ | Planned |
| Suno/MusicGen | ⬜ | ⬜ | Planned | ⬜ | Planned |
| Rodin/Luma | ⬜ | ⬜ | ⬜ | Planned | Planned |

---

## 10. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | Canvas FPS (100 items) | 60fps |
| **Performance** | Explorer scroll (1000 files) | 30fps+ |
| **Performance** | Generation placeholder | < 50ms |
| **Performance** | Image load (thumbnail) | < 200ms |
| **Reliability** | Offline queue retries | 5 attempts, exponential backoff |
| **Reliability** | Autosave interval | 30 seconds |
| **Security** | API key storage | Server-side only (env vars) |
| **Security** | Password hashing | bcrypt, cost factor 12 |
| **Security** | JWT tokens | HTTP-only, Secure, SameSite=Strict |
| **Accessibility** | Keyboard navigation | WCAG AA |
| **Accessibility** | Color contrast | ≥ 4.5:1 body, ≥ 3:1 UI |
| **Accessibility** | Touch targets | ≥ 44×44px (touch mode) |
| **Cross-platform** | Browsers | Chrome, Firefox, Safari, Edge (last 2 versions) |
| **Cross-platform** | OS | Windows, macOS, Linux |
| **Cross-platform** | Runtime | Deno 2 (primary), Node.js (secondary) |

---

## 11. Current Implementation Status (June 2026)

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| App Shell with docking panels + resizers | ✅ | CSS Grid, 3 panels |
| Explorer Panel | ✅ | File tree, import, drag-drop, thumbnails |
| Infinite Canvas | ✅ | Pan/zoom, item management, selection, resize, rotate |
| Inspector Panel | ✅ | Generation form, property editing, history |
| Node Graph (Rework mode) | ✅ | 7 node types, typed ports, execution |
| Timeline (UI only) | ⚠️ | Visual only, no playback engine |
| AI Generation (Google Imagen) | ✅ | With placeholder fallback |
| Settings | ✅ | 8 tabs including account, API keys, appearance knobs |
| Action Log | ✅ | Activity tracking with timestamps |
| Toast System | ✅ | Error codes, categorized notifications |
| User Profiling | ✅ | Anonymous session/device info |
| Homepage | ✅ | Quick-create flow, project grid |
| Connection Banner | ✅ | Health status overlay |
| Telemetry Pipeline | ✅ | Gather, digest, store, sync |
| Client Signature | ✅ | Offline-unique version fingerprint |
| Offline Queue | ✅ | Buffers changes, flushes on reconnect |
| Module Registry | ✅ | 81 stubs, typed ports, format profiles |
| Universal File Import | ✅ | Image, video, audio, text, 3D metadata extraction |

### In Progress

| Feature | Status | Blockers |
|---------|--------|----------|
| API key server-side migration | In progress | Need server env config |
| Service layer extraction | Planned | Refactoring in progress |
| Virtualization | Planned | Phase 2 |

### Upcoming Phases

| Phase | Features | Timeline |
|-------|----------|----------|
| Phase 2 | Image Edit Modules (inpaint, upscale, remove BG, color analysis, draw/write) | Q3 2026 |
| Phase 3 | Video Engine (ffmpeg.wasm, real timeline playback) | Q4 2026 |
| Phase 4 | Audio Engine (TTS, music, SFX, waveform, mixing) | Q4 2026 |
| Phase 5 | 3D + Gaussian Splat (Three.js, puppet system, camera rigs) | Q1 2027 |
| Phase 6 | Intelligence Modules (auto-tag, storyboard, character consistency) | Q2 2027 |
| Phase 7 | Blueprints + Agents (reusable pipelines, autonomous workflows) | Q3 2027 |
| Phase 8 | Automations + Social Posting (scheduled creation, analytics, CDN) | Q4 2027 |

---

## 12. AI-First Architecture Principles

### Data-Driven Optimization
1. **User Profiling**: Anonymous session data to optimize UX
2. **Space Optimization**: Action log pruning, asset dedup, intelligent caching
3. **ML-Ready Data Collection**: Prompt history, success/failure rates, workflow patterns

### Security by Design
1. **No PII Storage**: Only anonymous UUIDs locally
2. **API Key Isolation**: Server-side, user-specific, never in exports
3. **Local-First**: Data stays on device by default
4. **Explicit Export**: User controls what leaves the system

### Modularity for AI Integration
1. **Provider Abstraction**: Unified adapter interface
2. **Pipeline Architecture**: Composable generation workflows
3. **Extensible Type System**: New asset types without refactoring
4. **Module Registry**: Headless execution, testable, auditable

---

*This PRD should be reviewed and updated at the start of each development phase. Feature completion status must reflect the live product, not aspirations.*
