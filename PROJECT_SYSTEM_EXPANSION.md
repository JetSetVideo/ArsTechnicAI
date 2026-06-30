# Project System Expansion Plan

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> This document outlines a methodical approach to expanding the Ars TechnicAI project system to support every media type, asset lifecycle stage, and distribution channel. It maps the complete user journey from ideation to analytics.

---

## Phase 1: Project Creation & Setup

**Goal:** Allow the user to define the intent, constraints, and target platforms of their project upfront.

### Node 1.1: Project Definition

| Field | Current State | Expansion |
|-------|--------------|-----------|
| **Name** | ✅ Text field | Preserve |
| **Project Type** | ❌ Not explicit | Add selector: `Video (Linear)`, `Short (Vertical)`, `Feature Film`, `Script/Screenplay`, `Comic Book`, `Storyboard`, `Audio Drama`, `Interactive Story`, `Social Campaign` |
| **Target Audience** | ❌ Not present | Add: "Young Adult", "Professional", "General", "Kids", "Niche" |
| **Aspect Ratio** | ❌ Only per-platform | Add project-wide default: 16:9, 9:16, 1:1, 4:5, 2.35:1, 21:9 |
| **Synopsis/Logline** | ❌ None | Add dedicated textarea for 1-2 sentence summary (feeds AI context) |
| **Style** | ⚠️ Text field | Preserve as free text, add preset dropdown |
| **Genre** | ⚠️ Text field | Add genre selector: Action, Comedy, Drama, Horror, Sci-Fi, Fantasy, Documentary, etc. |
| **Tags** | ✅ Array | Preserve, add auto-suggest from existing tags |
| **Characters** | ⚠️ Single text field | Replace with Character Database (see Phase 2) |
| **Length/Duration** | ⚠️ Text field | Add numeric input with unit selector (minutes, seconds) |

### Node 1.2: Templates & Presets

| Preset Category | Options |
|----------------|---------|
| **Video Templates** | Music Video, Documentary, Vlog, Product Demo, Tutorial, Trailer, Social Ad |
| **Script Templates** | Hero's Journey, Three-Act Structure, Save the Cat, A-B-A-B Rhyme, Monologue |
| **Comic Templates** | Manga (R→L), Western (L→R), 4-panel, 6-panel, Splash Page, Infinite Scroll |
| **Style Presets** | Cyberpunk 2077, Studio Ghibli, Film Noir, Wes Anderson, 80s VHS, Minimalist, Baroque, Neon Pop |
| **Platform Presets** | TikTok (9:16, ≤10min), Instagram Reel (9:16, ≤90s), YouTube (16:9, any), Twitter/X (16:9, ≤140s), LinkedIn (16:9, ≤10min) |

---

## Phase 2: Ideation & Pre-Production

**Goal:** Before generating assets, write the story and define the world.

### Node 2.1: World Building (Context)

| Component | Current | Expansion |
|-----------|---------|-----------|
| **Character Database** | Single text field | Dedicated UI: Name, Age, Appearance (text + reference image), Voice profile, Personality traits, Wardrobe, Arc/Motivation |
| **Location Manager** | ❌ None | Define locations: Name, Description, Reference images, Time-of-day presets, Weather |
| **Lore/Wiki** | ❌ None | Simple notes section for world rules, history, terminology |
| **Mood Board** | ❌ None | Grid of reference images + color palette per scene |

### Node 2.2: Scriptwriting

| Component | Current | Expansion |
|-----------|---------|-----------|
| **Script Editor** | ❌ None | Formatted screenplay editor: Sluglines, Action, Character, Dialogue, Parenthetical |
| **AI Co-Writer** | ❌ None | "Autocomplete" for dialogue/scene descriptions, tone adjustment, pacing suggestions |
| **Script-to-Scene** | ❌ None | Highlight scene in script → auto-generate shot list |
| **Version Tracking** | ❌ None | Script version history with diff view |

### Node 2.3: Storyboarding

| Component | Current | Expansion |
|-----------|---------|-----------|
| **Frame Logic** | ❌ None | Special canvas nodes representing "Shots" with camera angles (Wide, Medium, Close-up, Dutch Angle, POV) |
| **Sequencing** | ❌ None | Linear ordering of canvas nodes to create rough animatic |
| **Shot List** | ❌ None | Table view: Shot #, Description, Camera, Duration, Status |

---

## Phase 3: Production (Asset Generation)

**Goal:** Generate actual media files based on pre-production data.

### Node 3.1: Visuals (Image/Video)

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **Image Generation** | ✅ Google Imagen | Add: DALL·E 3, Stable Diffusion 3, Midjourney (API pending), Flux |
| **Consistency Control** | ❌ None | Face Swap, Character LoRA integration, Reference Image conditioning |
| **Video Generation** | ❌ None | Runway Gen-3, Pika, Kling, Sora integration |
| **Shot Consistency** | ❌ None | Camera Control tools: re-shoot same scene from different angles |
| **Batch Generation** | ❌ None | Generate N variants per prompt, per model, compare side-by-side |
| **Style Transfer** | ❌ None | Apply reference style to generated image |

### Node 3.2: Audio

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **TTS (Text-to-Speech)** | ❌ None | Generate dialogue via ElevenLabs with character voice profiles |
| **SFX Generation** | ✅ Basic | AI generation of sound effects (footsteps, explosions, ambiance) |
| **Music Generation** | ❌ None | AI background score based on mood/genre (Suno, MusicGen) |
| **Voice Cloning** | ❌ None | Clone user's voice for consistent narration |

### Node 3.3: 3D Assets

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **3D Generation** | ❌ None | Rodin, Luma, Meshy integration |
| **Puppet Animation** | ❌ None | Skeletal rigs with pose library |
| **Camera Rigs** | ❌ None | Dolly, crane, handheld simulation → recorded camera paths |

---

## Phase 4: Post-Production (Assembly)

**Goal:** Combine assets into the final piece.

### Node 4.1: The Timeline

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **Multi-Track Editing** | ⚠️ UI only | Real playback engine (ffmpeg.wasm) |
| **Transitions** | ❌ None | Cross-fade, dissolve, wipe, push, L-cut, J-cut |
| **Auto-Edit** | ❌ None | "Magic Cut" — sync cuts to music beat |
| **Color Grading** | ❌ None | LUT application, curves, levels, white balance |
| **Text/Captions** | ❌ None | Auto-generated captions (whisper.cpp), styling |
| **Audio Mixing** | ❌ None | Per-track volume, pan, EQ, compression |

### Node 4.2: The Canvas (Non-Linear)

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **Node Graph** | ✅ 7 types | Expand to 30+ node types (see `Structure.md` module catalog) |
| **Interactive Logic** | ❌ None | Branching logic nodes for interactive stories/games |
| **Group Nesting** | ❌ None | Nested groups with independent canvases |
| **Connection Dots** | ❌ None | Visual linking between assets via drag-from-dot |

---

## Phase 5: Distribution

**Goal:** Export and share.

### Node 5.1: Export

| Capability | Current | Expansion |
|-----------|---------|-----------|
| **Format Presets** | ✅ 10 profiles | Add more: TikTok (specific bitrates), Instagram Story, YouTube Shorts, LinkedIn |
| **Metadata Embedding** | ❌ None | Embed prompt, seed, model, and provenance in EXIF/XMP of exported files |
| **Batch Export** | ❌ None | Export all variants of a project at once |

### Node 5.2: Publishing

| Platform | Current | Expansion |
|----------|---------|-----------|
| **TikTok** | ⬜ Stub | Direct API posting with caption, hashtags, schedule |
| **Instagram** | ⬜ Stub | Reels + Feed + Stories, carousel posts |
| **YouTube** | ⬜ Stub | Upload + title/description/tags/thumbnail/schedule |
| **Twitter/X** | ⬜ Stub | Post with media attachment |
| **LinkedIn** | ⬜ Stub | Video post + article |
| **Analytics** | ❌ None | Views, likes, shares, comments aggregated per platform |

---

## Phase 6: Filter System (Homepage + Explorer)

### Multi-Dimensional Filters

| Dimension | Options |
|-----------|---------|
| **Media Type** | Video, Short, Feature Film, Comic, Storyboard, Script, Audio Drama |
| **Status** | Active (editing), Ready (published), Generating, Archived, Failed |
| **Platform** | TikTok, Instagram, YouTube, Twitter/X, LinkedIn, Custom |
| **Source** | AI Generated, Manual/Imported, Remixed, External URL |
| **Date** | Custom range picker (from → to) |
| **Sort** | Most Recent, Alphabetical, Largest (asset count), Most Published |
| **Search** | Free-text search across name, tags, synopsis |

### Filter UI
- Chip-based active filter display (each filter is a removable chip)
- Dropdown for adding filter dimensions
- Results update in real-time via `useDeferredValue`
- Clear All button to reset

---

## Immediate Action Plan

1. **Add Project Type field** to project schema (enum: video, short, film, comic, storyboard, script, audio_drama)
2. **Add Character Database** — structured character profiles beyond single string
3. **Implement faceted filter UI** on homepage
4. **Expand project card** with media badges, status, expandable detail panel
5. **Add aspect ratio** as first-class project property
