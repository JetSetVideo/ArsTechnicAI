# ArsTechnicAI — Director's Analysis of the Creation System

> **Version**: 1.0 · **Date**: 2026-07-17
> A complete analysis of the project section and the Workshop, written from the
> director's chair: how a film actually gets made here, what every asset class
> is for, how generation/correction/masks/layers/versions interact, what is
> missing, and how the pieces must talk to each other.
> Legend: ✅ works today · ⚠️ works but limited · ❌ missing · 🆕 shipped this iteration.

---

## 1. The Director's Process — and where the software meets it

A film is not made left to right once; it is made in **passes**. The director
loops: *idea → words → images → moving images → sound → cut*, and at every loop
returns to an earlier stage with new knowledge. The software must therefore
allow any step to be **detailed** (opened and refined in place) or **inserted
between** existing steps without breaking what's downstream.

```
DIRECTOR'S PASSES                    WORKSHOP EQUIVALENT
1. Intention   "what is this film?"  Moodboard lane: references 🆕 3D props,
                                     palettes, Style DNA (locked identity)
2. Words       script, dialogue      Script lane: logline → screenplay →
                                     dialogue polish → breakdown → Prompt Lab 🆕
3. Faces       who is in it          World lane: character bible + emotion
                                     versions 🆕, locations, props, 3D models 🆕
4. Frames      what we see           Storyboard + Visuals lanes: shot list,
                                     sketches 🆕, key visuals, retouch, layers
5. Motion      how it moves          Motion lane: animate, interpolate, stabilize
6. Sound       what we hear          Audio lane: VO/emotions, music, SFX, mix
7. The cut     order & rhythm        🆕 Film strip: ordered scenes w/ duration
                                     + transitions; Montage lane; Delivery
```

**Insertion principle** (✅ implemented): every node is addable at any time from
the Add-node menu into its stage lane; lanes re-stack automatically; edges are
typed so a node inserted mid-chain (e.g. a Color Grade between Key Visual and
Animate) connects with two drags. **Detailing principle** (✅): every node opens
into four surfaces — Params / Retouch / Layers / Info — without leaving the flow.

---

## 2. Project Section (dashboard) — analysis

```
PROJECT SECTION                                 status
├── Projects grid (cards, favorite, archive)    ✅ (pre-existing)
├── Assets grid + filters + sources             ✅ (pre-existing)
├── Quick-create → editor with prefill          ✅ (pre-existing)
├── Explorer file tree in editor (imports,      ✅ (pre-existing)
│   generated, exports, prompts folders)
├── FOLDERS AS IDEAS                            ⚠️ analysis
│   The folder tree is file-centric; a director thinks in
│   *ideas*: "the lighthouse look", "Mara's costumes". Ideas
│   span files. The workshop's Style DNA node + prompt
│   templates 🆕 are the first idea-objects. Missing: an idea
│   board that groups ANY assets across folders with a note.  ❌
├── SHARING BETWEEN PROJECTS                    ❌ missing
│   Characters, Style DNA, templates and palettes should be
│   promotable to a user-level "Studio Library" reusable in
│   any project. Today paramTemplates 🆕 persist per browser
│   (all projects see them) — a de-facto start; assets do not.
└── Workshop entry (branch icon)                ✅
```

## 3. Asset Classes — how to interact with each

| Class | Create | Refine | Version | Feeds |
|---|---|---|---|---|
| **Inspiration image** | import/drop 🆕`moodboard-import` | tag, note "what to borrow" | n/a | Moodboard-gen, Style DNA, Prompt Lab |
| **Palette** | extract or author swatches | manual swatches | ✅ variants | Style DNA, Key Visual, Color grade |
| **Style DNA** | author (film stock, grain, keywords, avoid-list) | params | ✅ | *every* image node (style port) |
| **Script/text** | generate or paste | 🆕 edit in place (Info tab) | ✅ versions | breakdown, Prompt Lab, shots, TTS, subtitles |
| **Prompt** | 🆕 Prompt Lab node; 🆕 saved templates | edit text version; save as template | ✅ | sketch, Key Visual |
| **Character** | profile node (want/need/arc/voice) | params; 🆕 emotion+intensity+pose versions on sheet | ✅ sheet versions per emotion | storyboard, Key Visual, TTS |
| **Location** | profile + plates | params, plate versions | ✅ | storyboard, Key Visual |
| **3D model** | 🆕 `model3d-import` (.glb/.obj) | description/materials/size notes | ✅ | Key Visual `3D props` port → prompt |
| **Sketch** | 🆕 `sketch-gen` | retouch, layers | ✅ | Key Visual (sketch port) |
| **Picture** | Key Visual / edits / imports | Retouch (14 ops incl. 🆕 Focus), Layers, Format&size | ✅ + lineage | Motion, Thumbnail, 🆕 Film strip |
| **Video clip** | animate / import | trim, interpolate, stabilize | ✅ | Sequence, Delivery |
| **Audio** | TTS (emotions) / music / SFX briefs / import | levels, ducking | ✅ | Mix → Sequence |
| **Scene** 🆕 | "Add to film" from any picture | duration, transition, reorder, note | references a specific version | Sequence / Delivery |

## 4. Generation · Correction · Addition · Subtraction · Masks · Layers

```
THE FIVE VERBS ON A PICTURE
├── GENERATE     Params tab → Generate; N alternatives stack     ✅
├── CORRECT      Retouch tab: cleanup, faces, focus 🆕, color,   ✅
│                lighting, time, weather, camera angle
├── ADD          Retouch "Add object" (AI) · Layers: image/      ✅
│                shape/text collage (manual)
├── SUBTRACT     Retouch "Remove" (AI) · layer delete (manual)   ✅
└── PROTECT/AIM  Masks: include (edit here + instruction),       ✅
                 exclude (keep pixel-identical) → injected into
                 every downstream banana2 edit
LAYERS (non-destructive, normalized 0–1 geometry)
├── kinds: shape, text, image, mask, adjustment(filter)          ✅
├── blend modes ×16, opacity, lock, reorder, duplicate           ✅
├── full-screen editor: draw, drag, resize, dbl-click text       ✅
├── flatten → new version keeping lineage                        ✅
└── missing: freehand lasso, feathering, layer groups            ❌
```

## 5. Versions & Retouch — the memory of the film

Every result is a **version** (v1, v2…) with: created/updated dates, seed,
model, exact prompt, layer count, parent lineage (generated → retouched →
cropped → flattened chains are all recorded). Interactions: pin, label, select
as active (drives downstream), duplicate-as-draft, download, re-encode
(PNG/JPEG/WebP), re-crop to any aspect, resize 512–2048. The **active** version
is what edges transport and what the 🆕 Film strip references — swap the active
version of a node and the scene updates on next look; the strip pins the
*specific* variantId so a locked cut survives further experiments. ✅

## 6. Scenes — and how they interact with one another 🆕

The Film strip is the director's cut order:

```
SCENE INTERACTIONS
├── Order       ← / → reorder; numbering updates                 🆕
├── Rhythm      per-scene seconds; total runtime displayed       🆕
├── Joins       per-scene outgoing transition (14 kinds:         🆕
│               cut, dissolve, match cut, J/L-cut, whip…)
├── Provenance  each scene pins node+version; click thumb        🆕
│               selects the source node for immediate rework
├── To montage  Sequence node reads shot list order; strip is    ⚠️
│               the manual override — wiring strip → Sequence
│               execution is the next step
└── Missing     scene-to-scene continuity checks (eyeline,       ❌
                180° rule, palette drift), beat annotations
```

## 7. Consistency machinery ("similar results")

- 🆕 **Prompt templates**: save any node's full parameter set under a name;
  apply to any node of the same type. Persisted across sessions.
- **Style DNA** node: signature keywords + avoid-list injected via style port.
- **Seeds**: fixable per node; each variant records its seed for re-rolls.
- ❌ Missing: template *packs* (export/import), project-level default template,
  character-identity reference images passed automatically to every generation.

## 8. Space & margins audit (applied 🆕)

Toolbar 8→6px vertical; inspector header 12→9px; body 14→12px horizontal;
fields 10→7px stacking; sections 14→10px; accordion collapses long forms
(only the first section open — a 20-field form now scans in one screen);
node header/footer/preview each −1–2px; lane headers 12/16→10/13px; deck
padding 8→7px. Net: ~18% more content per viewport at identical legibility.
Remaining: the right panel could become resizable (drag handle) ❌.

## 9. Missing components — consolidated priority list

| # | Component | Director's need it serves |
|---|-----------|---------------------------|
| 1 | Strip → Sequence execution (render the cut from scenes) | see the actual film |
| 2 | Undo/redo command log | fearless experimentation |
| 3 | Studio Library (cross-project characters/styles/templates) | a body of work, not silos |
| 4 | Character identity refs auto-attached to generations | same face every shot |
| 5 | IndexedDB blob storage | real image volumes |
| 6 | Stale-downstream badges after upstream change | trust the pipeline |
| 7 | Scene continuity checks + beat notes | craft of the cut |
| 8 | Idea boards (cross-folder asset groupings with notes) | thinking in themes |
| 9 | 3D viewport preview (three.js) for imported models | judge the prop |
| 10 | A/B version compare slider | choose the best take |

## 10. Director's walkthrough (as-built, end to end)

1. **Intent** — drop references into *Import References*, extract a *Palette*,
   lock a *Style DNA* (Kodak 2383, grain 0.2, keywords: "wet brass, storm glass").
2. **Words** — *Logline* ×3 alternatives → pick → *Write Script* (2 min, three
   acts) → edit lines directly in the Info tab → *Polish Dialogue* (subtext 0.8).
3. **Faces** — *Character* Mara (want/need/arc, voice) → *Character Sheet* runs
   per emotion: neutral, determination-strong, fear-subtle → three stacked
   versions; import the astrolabe *.glb* with its description.
4. **Frames** — *Prompt Lab* crafts 3 prompts from script+moodboard → save the
   best recipe as template "Noir look" → *Rough Sketch* explores composition →
   *Key Visual* (sketch + style + 3D prop ports) generates; Retouch: camera to
   low-angle CU, focus on her eyes, add rain; mask-protect her face; regenerate
   background only; crop 2.39:1.
5. **The cut** — on each keeper: *Add to film* → reorder in the strip, 5s
   dissolve on the opening, hard cuts inside the montage; total runtime reads
   live; every thumb click jumps back to its node for one more pass.
6. **Sound & delivery** — TTS per character voice/emotion, music brief, mix
   with ducking; Format profiles (9:16 + 16:9), transcode, thumbnail, publish.
```
