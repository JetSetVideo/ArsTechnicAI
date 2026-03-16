# Project System Expansion Plan

This document outlines a methodical approach to expanding the Ars TechnicAI project system to support the creation of various media types (scripts, scenarios, videos, shorts, etc.). It maps the user journey and identifies options for expansion at every node.

## Phase 1: Project Creation & Setup

**Goal:** Allow the user to define the *intent* and *constraints* of their project upfront.

### Node 1.1: Project Definition
*   **Current State:** Name, Tags, Length, Style, Genre, Characters.
*   **Expansion Options:**
    *   **Project Type:** Explicitly select the format.
        *   *Options:* `Video` (Linear), `Short` (Vertical Video), `Feature Film`, `Script/Screenplay`, `Comic Book`, `Storyboard`, `Audio Drama`.
    *   **Target Audience:** Define who this is for (e.g., "Young Adult", "Professional", "General").
    *   **Aspect Ratio:** Set a default aspect ratio for the project canvas/player (e.g., 16:9, 9:16, 1:1, 2.35:1).
    *   **Synopsis/Logline:** A dedicated text field for a 1-2 sentence summary (crucial for AI context).

### Node 1.2: Templates & Presets
*   **Current State:** Empty project.
*   **Expansion Options:**
    *   **Starter Templates:**
        *   *Video:* "Music Video", "Documentary", "Vlog".
        *   *Script:* "Hero's Journey", "Three-Act Structure", "Save the Cat".
    *   **Style Presets:** Pre-fill the "Style" field with complex prompt engineering presets (e.g., "Cyberpunk 2077", "Studio Ghibli", "Film Noir").

## Phase 2: Ideation & Pre-Production (The "Script & Scenario" Layer)

**Goal:** Before generating assets, the user needs to write the story and define the world.

### Node 2.1: World Building (Context)
*   **Current State:** "Characters" text field.
*   **Expansion Options:**
    *   **Character Database:** A dedicated UI to create detailed character profiles (Name, Age, Appearance, Voice, Personality) that feed into the AI image generator.
    *   **Location Manager:** Define key locations (e.g., "The Abandoned Station", "Hero's Bedroom") with reference images.
    *   **Lore/Wiki:** A simple wiki or notes section for world rules.

### Node 2.2: Scriptwriting
*   **Current State:** None.
*   **Expansion Options:**
    *   **Script Editor:** A text editor formatted for screenplays (Sluglines, Action, Dialogue).
    *   **AI Co-Writer:** "Autocomplete" for dialogue or scene descriptions.
    *   **Script-to-Scene:** A feature to highlight a scene in the script and generate a "Shot List" automatically.

### Node 2.3: Storyboarding
*   **Current State:** Infinite Canvas (generic).
*   **Expansion Options:**
    *   **Frame Logic:** Special canvas nodes that represent "Shots" with specific camera angles (Wide, Close-up, Dutch Angle).
    *   **Sequencing:** Ability to order canvas nodes linearly to create a rough animatic.

## Phase 3: Production (Asset Generation)

**Goal:** Generate the actual media files based on the pre-production data.

### Node 3.1: Visuals (Image/Video)
*   **Current State:** Image Generation.
*   **Expansion Options:**
    *   **Consistency Control:** "Face Swap" or "Character LoRA" integration to keep characters looking the same across shots.
    *   **Video Generation:** Integration with video models (Runway, Pika, Stable Video Diffusion) to turn static storyboard frames into clips.
    *   **Shot Consistency:** "Camera Control" tools to re-shoot the same scene from different angles.

### Node 3.2: Audio
*   **Current State:** Basic file support.
*   **Expansion Options:**
    *   **TTS (Text-to-Speech):** Generate dialogue for characters using ElevenLabs or similar.
    *   **SFX Generation:** AI generation of sound effects (footsteps, explosions).
    *   **Music Generation:** AI background score generation based on "Mood" or "Genre".

## Phase 4: Post-Production (Assembly)

**Goal:** Combine assets into the final piece.

### Node 4.1: The Timeline
*   **Current State:** Basic visual timeline.
*   **Expansion Options:**
    *   **Multi-Track Editing:** Dedicated tracks for Video, Dialogue, SFX, Music.
    *   **Transitions:** AI-generated transitions between clips.
    *   **Auto-Edit:** "Magic Cut" feature that syncs cuts to the beat of the music.

### Node 4.2: The Canvas (Non-Linear)
*   **Current State:** Node graph.
*   **Expansion Options:**
    *   **Interactive Logic:** For "Game" or "Interactive Story" project types, allow branching logic nodes.

## Phase 5: Distribution

**Goal:** Export and share.

### Node 5.1: Export
*   **Current State:** Basic.
*   **Expansion Options:**
    *   **Format Presets:** "Export for Instagram Reels", "Export for YouTube 4K".
    *   **Metadata Embedding:** Embed the prompt/generation data into the final video file for provenance.

---

## Immediate Action Plan (Next Steps)

1.  **Upgrade Data Model:** Add `type` (Project Type) and `aspectRatio` to the Project schema.
2.  **Enhance UI:** Add a "Project Type" selector to the Create/Edit modal.
3.  **Implement Character Profiles:** Create a structured way to store character details beyond a simple string.
