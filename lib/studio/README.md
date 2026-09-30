# Ars Technic AI

**Version 2.3.0** · 18 September 2026 · macOS and Linux

A node-graph studio for **restoring** archive footage and **generating** new media, with every
result kept in a lineage you can walk, compare and query.

You describe what a project is about — characters, places, objects, drawn or written or filmed — and
build a pipeline as a graph of cards on an infinite canvas. The graph compiles restoration chains
into calls to a deterministic OpenCV engine (ArchiveRestorer), runs loops as a depth axis of frames,
prices every paid model call before it happens, and records what each run produced and exactly which
parameters produced it. Changing a prompt or a slider never overwrites anything: it makes a child
version, linked to its parent.

---

## Contents

1. [What is in the box](#1-what-is-in-the-box)
2. [Install and run — macOS and Linux](#2-install-and-run--macos-and-linux)
3. [The Workshop, zone by zone](#3-the-workshop-zone-by-zone)
4. [The nodes](#4-the-nodes)
5. [The workflow library](#5-the-workflow-library)
6. [Concepts](#6-concepts)
7. [HTTP routes](#7-http-routes)
8. [Project layout](#8-project-layout)
9. [Development and verification](#9-development-and-verification)
10. [Design notes](#10-design-notes)
11. [Changelog](#11-changelog)
12. [Known limitations and future changes](#12-known-limitations-and-future-changes)

---

## 1. What is in the box

Two programs, one origin:

| Part                                       | Language                                  | What it does                                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ars Technic AI** (this directory)        | Deno 2, TypeScript, zero npm dependencies | The host at `:8090`: Home, the Workshop canvas, the reference library, cinema rules, model catalogue and cost gate, lineage store, and a proxy to the engine.                                                               |
| **ArchiveRestorer** (`../ArchiveRestorer`) | Python 3.12, FastAPI, OpenCV              | The restoration engine at `:8000`: frame extraction, stabilisation, deflicker, dust repair, colour, segmentation, frame synthesis, export. Its desk UI is embedded in the Workshop as **Grade** and the **Restorer** cards. |

The engine is optional. Without it you still get the library, the cinema rules, prompt rendering,
the generate nodes and their cost gate; grading, the depth strip and export need it.

```
Browser ──► :8090  Ars Technic AI (Deno)
              ├── /                 Home — projects, assets, workflows, references
              ├── /blueprint/       Workshop — Library · Canvas · Grade · Console · Inspector
              ├── /desk/?embed=…    the engine's desk, embedded as Grade and Restorer
              ├── /library, /models, /estimate, /diagnostics, /lineage, /assets   (this server)
              ├── /providers, /entities, /workspace-media/…   keys, subjects, their material
              └── /api/*, /ws  ───► :8000  ArchiveRestorer engine (Python)
```

---

## 2. Install and run — macOS and Linux

### 2.1 Requirements

| Tool                                | Needed for                                  | macOS                              | Debian / Ubuntu                                    | Fedora                                 |
| ----------------------------------- | ------------------------------------------- | ---------------------------------- | -------------------------------------------------- | -------------------------------------- |
| **Deno 2**                          | everything                                  | `brew install deno`                | `curl -fsSL https://deno.land/install.sh \| sh`    | same as Debian                         |
| **curl**                            | start script health checks                  | preinstalled                       | `sudo apt-get install -y curl`                     | `sudo dnf install -y curl`             |
| **Python 3.10+** (3.12 recommended) | the restoration engine                      | `brew install python@3.12` or `uv` | `sudo apt-get install -y python3 python3-venv`     | `sudo dnf install -y python3`          |
| **OpenCV system libs**              | the engine, Linux only                      | —                                  | `sudo apt-get install -y libgl1 libglib2.0-0`      | `sudo dnf install -y mesa-libGL glib2` |
| uv _(optional)_                     | faster, architecture-safe environment       | `brew install uv`                  | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | same                                   |
| ffmpeg _(optional)_                 | export (a bundled build is used without it) | `brew install ffmpeg`              | `sudo apt-get install -y ffmpeg`                   | `sudo dnf install -y ffmpeg-free`      |
| Chrome / Chromium _(optional)_      | `deno task runtime`, `deno task capture`    | Google Chrome                      | `sudo apt-get install -y chromium`                 | `sudo dnf install -y chromium`         |

The two checkouts must sit side by side (or set `RESTORER_ROOT`):

```
~/Desktop/ArsTechnicAI
~/Desktop/ArchiveRestorer
```

### 2.2 First run

```bash
cd ~/Desktop/ArsTechnicAI
./setup.sh      # checks tools, creates ../ArchiveRestorer/.venv, verifies OpenCV imports
./start.sh      # engine + codegen + bundle + host
```

Then open <http://127.0.0.1:8090/> (Home) or <http://127.0.0.1:8090/blueprint/> (Workshop). `Ctrl-C`
stops everything the script started; an engine that was already running is left alone.

`setup.sh` is safe to repeat. It never deletes: an existing environment is kept unless you pass
`--upgrade`. It refuses a Python interpreter whose architecture differs from the machine's — on
Apple silicon an Intel Homebrew `python3` would otherwise build an x86_64 environment that installs
the wrong OpenCV wheels — and asks uv for a native 3.12 instead.

**macOS.** Works on Apple silicon and Intel. If Gatekeeper blocks `deno` after a manual download,
install it with Homebrew instead.

**Linux.** The scripts are POSIX bash with `curl` and coreutils; `lsof` is used only to name the
process holding a busy port. If the engine dies at import with
`libGL.so.1: cannot open shared
object file`, install the OpenCV libraries from the table;
`setup.sh` checks this and prints the command for apt, dnf or pacman. Headless servers work: the UI
binds `127.0.0.1`, so use an SSH tunnel (`ssh -L 8090:127.0.0.1:8090 host`) rather than exposing the
port.

> The Linux path is written to be portable and was reviewed line by line, but in this release it was
> **exercised end to end on macOS only** (a clean checkout: `setup.sh` created the environment and
> `start.sh` brought up engine, codegen, bundle and host). Please report anything a distribution
> needs that the table above does not list.

### 2.3 Ports and environment

| Variable                                                                                     | Default                            | Meaning                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `ARS_UI_PORT` (`WIV_UI_PORT`)                                                                | `8090`                             | the host                                                                                  |
| `RESTORER_PORT`                                                                              | `8000`                             | the engine; also passed to the host as its backend                                        |
| `RESTORER_ROOT`                                                                              | `../ArchiveRestorer`               | engine checkout                                                                           |
| `WIV_BACKEND` / `RESTORER_BACKEND`                                                           | `127.0.0.1:8000`                   | where the host proxies `/api` and `/ws` (set by `start.sh`)                               |
| `RESTORER_WORKSPACE`                                                                         | `ArchiveRestorer/workspace`        | engine projects. **Also** read by the host for studio projects, ahead of `ARS_WORKSPACE`  |
| `ARS_WORKSPACE`                                                                              | `ArsTechnicAI/workspace`           | studio projects and lineage files, when `RESTORER_WORKSPACE` is unset                     |
| `ARS_FILES_ROOT`                                                                             | `$HOME`                            | the jail for the library's file browser                                                   |
| `ARS_LIBRARY_ROOT`                                                                           | `./library`                        | reference shelves and frames                                                              |
| `RESTORER_UI_DIR`, `RESTORER_SHARED`                                                         | engine `frontend/public`, `shared` | the embedded desk and its control schema                                                  |
| `GEMINI_API_KEY`                                                                             | —                                  | the engine's AI vision / repair cards; Google models in the catalogue                     |
| `FAL_KEY`, `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`, `STABILITY_API_KEY`, `ANTHROPIC_API_KEY` | —                                  | remote providers in the catalogue (reported as configured or not; never sent to the page) |
| `COMFY_URL`, `OLLAMA_URL`                                                                    | local defaults                     | local providers                                                                           |
| `WIV_UI`, `WIV_CHECK_PROJECT`, `CHROME_PATH`                                                 | —                                  | verification tools (§7)                                                                   |

**Port 8000 is contested.** ComfyUI defaults to it too. `start.sh` detects something that is not the
engine on the port, names the process, and stops. Run side by side with
`RESTORER_PORT=8001 ./start.sh`; `curl -s localhost:8090/status` says which engine the host talks
to.

### 2.4 The two halves by hand

```bash
# Terminal 1 — the engine
cd ~/Desktop/ArchiveRestorer/backend
../.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000

# Terminal 2 — the host
cd ~/Desktop/ArsTechnicAI
deno task codegen && deno task build
deno run --allow-net --allow-read --allow-env --allow-write=workflows,workspace server.ts
```

### 2.5 Troubleshooting

| Symptom                                                         | Cause and fix                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `The engine's Python environment is missing`                    | run `./setup.sh`                                                                        |
| `Something is already listening on :8000`                       | ComfyUI or another app; `RESTORER_PORT=8001 ./start.sh`                                 |
| engine exits with `libGL.so.1` (Linux)                          | `sudo apt-get install -y libgl1 libglib2.0-0`                                           |
| `environment … is x86_64 on a arm64 machine`                    | move `../ArchiveRestorer/.venv` aside, run `./setup.sh` again                           |
| Grade shows _Load a video to begin_ for a project with a reel   | fixed in 2.1.0 (arriving from Home left Grade unbound) — rebuild with `deno task build` |
| Workshop is blank after editing `ui/*.ts`                       | the page loads the bundle: `deno task build`                                            |
| `deno task runtime` stops at _The canvas has no cards to drive_ | set `WIV_CHECK_PROJECT` to a project with a graph (use a copy)                          |

---

## 3. The Workshop, zone by zone

```
┌ top bar: Library · Canvas · Grade · Inspect toggles │ project │ Run (cost) │ Fit │ Settings ┐
├──────────┬───────────────────────────────────────────────────────────┬──────────────────────┤
│ Library  │ Canvas — infinite, pan/zoom, cards and wires, find (/)    │ Inspector            │
│ Nodes    │                                                           │ Node · Restorer ·    │
│ Files    ├───────────────────────────────────────────────────────────┤ Depth · Workflow     │
│ Refs     │ Grade — the picture of the selected step, its knobs       │                      │
│ Flows    ├───────────────────────────────────────────────────────────┤                      │
│          │ Console — Execution table · Lineage query · fps           │                      │
└──────────┴───────────────────────────────────────────────────────────┴──────────────────────┘
```

Every panel can be shown or hidden (`⌘1` Library, `⌘2` Inspect, `⌘4` Canvas, `⌘5` Grade, `G` cycles
Canvas/Grade) and resized by dragging its border. The layout persists per browser.

### 3.1 Library

| Tab       | Holds                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nodes** | every node type by category — sources, restoration stages, segmentation, flow and regions, generative, outputs. `N` focuses search. Click to place, or drag onto the canvas.                                                                                  |
| **Files** | folders on this machine, names and sizes only, jailed to `ARS_FILES_ROOT`. Reels the engine can decode are marked; clicking one ingests it.                                                                                                                   |
| **Refs**  | 160 reference cards on four shelves — Movies (110), Stars (16), Comics (18), Scripts (16). Dropping one creates a `ref.card` carrying structured material.                                                                                                    |
| **Flows** | saved workflows in `workflows/`. _Save current_ writes the graph. Click one to **load** it in place of the graph; **drag** one onto the canvas to **insert** it beside what is already there — ids remapped, dropped where you let go, `⌘Z` removes it again. |

### 3.2 Canvas

| Action                   | Gesture                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Add a node               | Library click/drag, or right-click the canvas for the node wheel                    |
| Wire                     | drag from an output socket; legal targets light, an illegal drop says why           |
| Re-route                 | drag from a connected input                                                         |
| Move                     | drag a card header; snaps and pushes neighbours aside; moves the whole selection    |
| Select many              | drag on empty canvas (rectangle)                                                    |
| Card options             | `⋯` on a card — run, mute, collapse, unfold ports, versions, lineage, stage history |
| **Find on canvas**       | `/` — matching cards stay lit, the rest dim; the layout never moves                 |
| Mute / collapse / delete | `M` / `C` / `⌫`                                                                     |
| Loop the selection       | `L` — wraps it in a Z Stack and a Collect                                           |
| Run                      | `R` — selection plus everything upstream; `⇧R` stage by stage                       |
| Frame all · undo         | `F` · `⌘Z`                                                                          |

Cards show lifecycle as colour: idle, **evaluating** (pulses), **fresh**, **stale** (dashed),
**failed** (red), and a `v3` badge for recorded versions.

### 3.3 Grade

Grade shows the step selected on the canvas — its picture, the reel around it, and that step's knobs
— and nothing else.

```
┌ step chips (one per canvas node) ······························ Bypass │ Wrap · Evaluate loop ┐
├──────────────────────────────────────────────────────────┬──────────────────────────────────┤
│                                                          │ THIS STEP                        │
│                    the picture                           │ Live preview · Auto-calibrate    │
│          (zoom with wheel/pinch, double-click to fit)    │ the selected stage's sliders     │
│                                                  stats ▸ │                                  │
├ Rst Src Split ● ▶ ◧◨ Timeline Stats  fit ⤢ ───── ◀ frame / total ▶  ☑ KEEP 62.6 ┤          │
├ timeline drawer (T): quality · luminance · camera roll ─────────────────────────────────────┤
└ filmstrip ──────────────────────────────────────────────────────────────────────────────────┘
```

- **The picture owns the pane.** It takes every row the pane has; the view and frame toolbars share
  one transport row beneath it; the quality graph is a drawer.
- **Knobs sit beside the picture** when the pane is at least 720 px wide and under it when narrower.
  With no step selected, the column folds away and the picture widens.
- **Chips** select a canvas node from Grade. **Bypass** mutes a stage; **Wrap** and **Evaluate
  loop** appear only for a Z Stack.
- **Timeline** (`T`) opens quality, luminance and roll over the whole reel — drag the grey line to
  declare true level. **Stats** (`H`) toggles the frame statistics over the picture. Both persist.
- The freshness dot says whether the picture reflects the current settings: live, computing, stale.

| Key           | In Grade                                  |
| ------------- | ----------------------------------------- |
| `←` `→`       | previous / next frame                     |
| `K`           | play / pause                              |
| `Space`       | keep / drop this frame                    |
| `1` `2` `3`   | restored / source / split wipe            |
| `B` (hold)    | momentary A/B against the source          |
| `N`           | neighbour frames and their combinations   |
| `A`           | annotation rail (brush, eraser, region)   |
| `R`           | edit the reframe rectangle on the picture |
| `F`           | focus: picture and transport only         |
| `T` · `H`     | timeline drawer · frame statistics        |
| `0` · `Enter` | fit · re-render now                       |

### 3.4 Inspector

Four tabs; each scrolls on its own. `⌥1`–`⌥4` jump to them, arrow keys move along the strip.

**Node** — the selected card.

- Header: rename, type · cost · state, and the actions _Mute, Collapse, Delete, Loop, Run, Run
  stages, Focus_ (plus _Accept AI_ when a model set any value).
- **Values**: every input port. Wired ports say so and offer _Disconnect_. A value that differs from
  its default shows `↺` to reset it. Values set by AI are marked violet until accepted. Nodes with
  more than eight ports get a filter box. For a restoration stage while Grade is open, the look
  sliders live in Grade; _Reveal_ opens and scrolls to them.
- **Loop** (Z Stack): body size, _Evaluate depth_, link to the Depth tab.
- **Wiring**: every incoming and outgoing wire as a link to the other node.
- **Write** (Prompt, the generate nodes, Ask a Model, Segment Subject): the node's prose fields as
  full-height text areas — subject and **avoid** on a Prompt, prompt and **negative** on a generate
  node, instruction and context on Ask. What you type here is the same value the card shows, so a
  card edit and an inspector edit are one change, recorded once. `Esc` restores what was there.
- **Subject** (`ref.entity`): who or what this card is — the picture you drew or attached, the
  summary, and each trait as a chip; _Open on Home_ edits it where it lives.
- **Resolved** (reference and generate nodes): every text output the node produces — the rendered
  prompt, the **negative prompt**, a blend's conflicts, a shot's validation — with _Copy_, and one
  line describing the style beneath it (camera, focal length, light, shot size, rule status).
- **Save** (`out.save`): the exact path about to be written — `assets/v{N}/<name>.<ext>` — the
  folder and format ports, what is upstream of it, whether it is ready, and **Write now**. Every
  write claims a new version directory, so nothing already saved can be replaced.
- **Encode** (`out.render`): what will be encoded — stages, frame rate, quality, whether the range
  comes from a loop, and whether the frames outside it are held or dropped — and a **Render film**
  button that runs it through the pre-run gate.
- **History**: recorded versions, and a **compare picker** — choose any two and see exactly which
  parameters differ, drawn from the lineage store. _All versions and relations_ opens the card menu.
- With nothing selected: the project's frames, rate, picture size, duration, source, node count,
  version and lineage totals.
- Several selected: the shared actions and a link to each.

Editing here never rebuilds the pane under you: a slider keeps its drag, the scroll position stays,
and focus returns to the same control after an external change.

**Restorer** — the engine's cards for the whole reel: Sections (per-range overrides and layer
stacks, keyframes), Damage and missing pixels, Reframe and outpaint, Colour and gradation, Subject
isolation, Missing frames, AI vision inspector, Prompt editor, Generative restoration. It loads the
first time you open the tab.

**Depth** — the Z-stack carousel around the current frame: one slice per frame, focused slice
upright, the rest receding; each slice carries its measured score and verdict, so a bad frame shows
as a dark card before you roll to it. `◂ ▸` roll, _Wrap_ makes the loop cyclic. It loads only while
visible, and a finished stack run opens it.

**Workflow** — _Auto-preview_ (re-run local steps on every edit; enabling it is the standing
confirmation for those runs), auto-save on project switch, named **variables** harvested from and
applied to `Node.port` fields, and **Compilation**: engine calls, network steps, the asset ledger
totals and every diagnostic (click one to jump to its node). The tab badge counts errors (red) or
warnings.

### 3.5 Console and the pre-run gate

The bottom **Console** is the graph as the evaluator will run it:

- **Execution**: order, node, type, cost class, runs per node once loops multiply (editable per Z
  Stack), model, token estimate, VRAM, last latency, version, state; a footer with paths, branches,
  loops, evaluations, call cost and peak RAM; live fps and JS heap in the bar.
- **Lineage**: a filter over every recorded parameter set —
  `model_name = "Nano Banana v2.1" and guidance_scale > 7` — and a _Blueprint JSON_ export.

It opens expanded on windows at least 1000 px tall and on lab displays; elsewhere it is one bar with
its summary line.

Before **Run**, **Run stages**, a stack run or **This frame**, a dialog lists execution paths, loops
and their iterations, child branches, node evaluations, peak RAM and VRAM, tokens and paid/local
calls. Nothing runs until _Run_ is pressed. A confirmation covers exactly that structure for 15
minutes: widen a loop and it asks again.

### 3.6 Home

Projects, assets, workflows and media references as shelves; tool groups (Open video, Grade,
Stabilise, Export, Segment, Enhance, Repair, Analyse, generate Image/Video/Audio/3D, Ask, Workshop,
Z-stack) that open the Workshop with the right node or card ready; _New_ creates a studio project
(movie, TV, reel, comic, manga, music, book) with tags and models.

**Characters & places** is the shelf for the things a project is _about_ — a person, a room, an
object — described however you like to describe them:

- **Draw it.** A canvas with a pen, colours, sizes, an eraser and undo. What you draw is saved as a
  PNG under the subject and becomes its cover.
- **Write it.** A name, a one-line summary, and a description as long as you want.
- **Traits.** Short facts that must not drift — "left-handed", "burn scar on the right hand",
  "always in the blue coat". They are repeated verbatim into every prompt; nothing paraphrases them.
- **Film it, photograph it, record it.** Drop in images, video, audio, PDFs or text. Every upload
  claims its own `media/v{N}/` directory.

_Use in Workshop_ opens the canvas with a **Subject** card (`ref.entity`) already placed and filled.
It grants prose to a Style exactly as a reference card does, so a subject and a film idiom meet on
one **Blend**: the library says how it is shot, the subject says who is in it. Selecting the card
shows the drawing and the prose in Grade.

Every save is a new `entity.v{N}.json`. A description you rewrite at midnight is still there in the
morning.

### 3.7 Display profiles

| Profile         | Width        | Base type | Layout                                                |
| --------------- | ------------ | --------- | ----------------------------------------------------- |
| mobile (p/l)    | 320–767 px   | 10–14 px  | library and inspector are drawers, shut on first load |
| tablet          | 768–1024 px  | 12–16 px  | library docked, inspector slides over the canvas      |
| desktop         | 1025–1920 px | 14–18 px  | all panels docked                                     |
| lab workstation | > 1920 px    | 16–24 px  | wider docks, console held open                        |

Every piece of chrome text is clamped to 8–32 px; node cards scale with canvas zoom instead.

### 3.8 Models & keys

**Settings → Models** lists every provider in the catalogue: what it is for, how many models it
offers, whether it can be called at all, and where that credential comes from. Paste a key to make a
provider reachable without restarting anything; record the subscription you are actually paying for
(plan, monthly cap, renewal date, a note) so the pre-run gate's estimate has a number to be read
against.

What the store is careful about, because a credential store is a liability:

- **The key never travels back.** Reads answer with the last four characters and a source; the
  secret is never sent to the page, so nothing in the interface can display, log or leak one.
- **The file is yours alone** — `.provider-keys.json` beside the workspace, written `0600`, never in
  the repository and never in a saved project.
- **The environment still wins.** `FAL_KEY` in the environment overrides a stored key, so a machine
  configured by its operator is not silently replaced by a file someone pasted into.
- **Forgetting is complete.** _Forget_ rewrites the file without the key; no history of secrets is
  kept.
- Local providers are shown as what they are: free, private, and needing no key at all.

---

## 4. The nodes

Thirty-one node types. A node is a _contract_, not a script: typed ports, a stated cost class
(local, disk, network), and — where it maps onto the engine — a generated parameter set that cannot
drift from the schema it came from. Wiring is checked as you drag, and an illegal drop says why.

<!-- generated by `deno task nodes` — 31 node types. `?` marks an optional input, `*` a variadic one. -->

#### Sources (5)

| Type              | Name            | Runs  | Inputs                                                  | Outputs               | What it is for                                                                                                                     |
| ----------------- | --------------- | ----- | ------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source.sequence` | Video           | disk  | `project_id` `start` `count`                            | `sequence` `metrics`  | The extracted frame sequence of a loaded project. Non-destructive: this reads the PNGs the engine wrote, never the original video. |
| `source.frame`    | Frame Selection | local | `sequence` `index`                                      | `image`               | Takes one frame out of a sequence. Set the index on the card, or let a Z stack drive it from the slice.                            |
| `ref.card`        | Reference       | local | `reference_id` `weight`                                 | `style` `thumb`       | A film, archetype, comic idiom or scene form from the library. Grants its camera, lighting and grammar to whatever it feeds.       |
| `ref.entity`      | Subject         | local | `entity_id` `traits`                                    | `style` `reference`   | A character, place or object from Home — its description, its traits, and the material you attached to it.                         |
| `ref.shot`        | Shot            | local | `base?` `shot_size` `focal_length` `time_of_day` `mood` | `style` `diagnostics` | Author a shot directly — body, glass, stock, light, framing. Validated against what could physically have been photographed.       |

#### Restoration stages (10)

| Type                    | Name                     | Runs  | Inputs                                                                                                                                                                                  | Outputs        | What it is for                                                                                                                                                         |
| ----------------------- | ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage.stabilize`       | Stabilisation            | local | `image` `neighbours` `enabled` `mode` `motion_model` `max_features` `match_ratio` `ransac_reproj` `smoothing_radius` `anchor_frame` `ecc_refine` `ecc_iterations` `crop_ratio` `border` | `image` `warp` | ORB feature tracking with RANSAC, then trajectory smoothing. Cancels gate weave and hand shake.                                                                        |
| `stage.level`           | Roll / True Level        | local | `image` `enabled` `auto` `reference` `angle` `strength` `max_correction` `scale`                                                                                                        | `image` `warp` | Absolute tilt, not shake. Stabilisation smooths changes in roll; this removes roll itself, against a horizon you declare on the band under the picture.                |
| `stage.reframe`         | Reframe & Outpaint       | local | `image` `neighbours` `enabled` `zoom` `offset_x` `offset_y` `fill` `mosaic_radius`                                                                                                      | `image` `warp` | Pull back to recover the composition the cameraman cut off. The margin beyond the film is filled from neighbouring frames wherever the camera already photographed it. |
| `stage.temporal_fusion` | Temporal Detail Recovery | local | `image` `neighbours` `enabled` `radius` `sigma_color` `detail_boost`                                                                                                                    | `image`        | Averages motion-compensated neighbours to lift real detail out of grain. The single strongest quality win on noisy film.                                               |
| `stage.deflicker`       | Luminance Deflicker      | local | `image` `neighbours` `enabled` `mode` `window` `strength`                                                                                                                               | `image`        | Moving-average histogram matching across a sliding window of N frames.                                                                                                 |
| `stage.defect`          | Dust & Scratch Repair    | local | `image` `neighbours` `enabled` `sensitivity` `min_area` `max_area` `dilate` `inpaint_radius` `method` `use_temporal`                                                                    | `image`        | Flags specks that exist in one frame only, then inpaints them.                                                                                                         |
| `stage.denoise`         | Denoise                  | local | `image` `enabled` `h_luma` `h_chroma` `template_window` `search_window`                                                                                                                 | `image`        | Non-local means, luma and chroma weighted separately.                                                                                                                  |
| `stage.clahe`           | CLAHE / Contrast Balance | local | `image` `enabled` `clip_limit` `tile_grid`                                                                                                                                              | `image`        | Adaptive histogram equalisation on the LAB L channel only, so colour is untouched.                                                                                     |
| `stage.levels`          | Levels & Colour          | local | `image` `enabled` `black` `white` `gamma` `saturation`                                                                                                                                  | `image`        | Global black/white points, gamma and saturation.                                                                                                                       |
| `stage.sharpen`         | Sharpen                  | local | `image` `enabled` `amount` `radius` `threshold`                                                                                                                                         | `image`        | Unsharp mask with a contrast threshold so grain is not amplified.                                                                                                      |

#### Segmentation (1)

| Type           | Name            | Runs    | Inputs                     | Outputs         | What it is for                                                                                                                                                 |
| -------------- | --------------- | ------- | -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mask.segment` | Segment Subject | network | `image` `prompt` `feather` | `mask` `labels` | Names and boxes what is in the frame, then refines each box into a pixel-accurate matte locally with GrabCut. The box comes from the model; the edge does not. |

#### Flow and regions (6)

| Type             | Name             | Runs  | Inputs                                       | Outputs               | What it is for                                                                                                                |
| ---------------- | ---------------- | ----- | -------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `flow.propagate` | Region           | local | `a` `b` `mode`                               | `mask` `coverage`     | Combines two mattes into the region an effect applies to: everything, the overlap, or either side alone.                      |
| `flow.composite` | Composite        | local | `base` `over` `mask` `opacity`               | `image`               | Lays one frame over another through a matte. This is where a branched pipeline rejoins.                                       |
| `flow.stack`     | Z Stack          | local | `sequence` `stride` `wrap`                   | `image` `slice_index` | Iterates the graph below it once per frame, along the depth axis. Roll the carousel to bring any slice into focus.            |
| `flow.collect`   | Collect          | local | `image`                                      | `sequence`            | Gathers every slice's result back into one sequence. Closes a Z stack.                                                        |
| `ref.blend`      | Blend References | local | `styles*`                                    | `style` `conflicts`   | Merge several references into one style. Prose accumulates; only one shot specification can survive, and the card says whose. |
| `ref.prompt`     | Prompt           | local | `style?` `subject` `avoid` `target` `detail` | `positive` `negative` | Render a style into the string a particular model reads best. Look at it before you spend a run on it.                        |

#### Generative (6)

| Type         | Name              | Runs    | Inputs                                                                               | Outputs                        | What it is for                                                                                                                                 |
| ------------ | ----------------- | ------- | ------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai.enhance` | Generative Repair | network | `image` `mask` `positive_prompt` `negative_prompt` `mode` `influence`                | `image` `raw`                  | Reconstructs missing or destroyed material. Enters the frame only through a pyramid blend you control, so the result keeps the original grain. |
| `gen.image`  | Generate Image    | network | `model` `style?` `prompt` `negative` `seed` `reference?` `strength` `width` `height` | `image` `used_prompt`          | One still, from a style and a prompt, on whichever model you pick.                                                                             |
| `gen.video`  | Generate Video    | network | `model` `style?` `prompt` `negative` `seed` `first_frame?` `duration` `fps`          | `video` `frames` `used_prompt` | A clip, from a style and a prompt. One call is worth many image calls — check the estimate before running a stack of these.                    |
| `gen.audio`  | Generate Audio    | network | `model` `style?` `prompt` `negative` `seed` `duration`                               | `audio` `used_prompt`          | Music, effects or speech. The only signal on this canvas you cannot look at.                                                                   |
| `gen.mesh`   | Generate 3D       | network | `model` `style?` `prompt` `negative` `seed` `image?`                                 | `mesh` `preview`               | A mesh from a still. Useful for a set piece you need to see from a second angle.                                                               |
| `llm.ask`    | Ask a Model       | network | `model` `instruction` `context` `style?` `image?`                                    | `text` `lines*`                | Put a language model in the graph — break a scene into shots, rewrite a prompt, describe a frame. Its text can drive any other node.           |

#### Outputs (3)

| Type         | Name   | Runs  | Inputs                                              | Outputs | What it is for                                                                                       |
| ------------ | ------ | ----- | --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `out.view`   | Viewer | local | `image` `compare?`                                  | —       | Terminates a branch and shows it. A graph may have several; the focused one drives the main picture. |
| `out.render` | Render | local | `sequence` `fps` `crf` `timing`                     | —       | Runs the whole sequence through this graph and encodes it. The only node that writes to disk.        |
| `out.save`   | Save   | disk  | `image?` `video?` `audio?` `name` `folder` `format` | —       | Write generated media to the workspace, in whatever format it arrived in. No re-encode.              |

**Reading the table.** `?` marks an input the node runs without — unwired `style` on a generate node
means text-to-image, and that is a mode, not a fault. `*` marks a variadic input: Blend takes as
many references as you wire into it. Every port carries a one-sentence explanation, shown on hover
and in the inspector; `deno task nodes --ports` prints them all with their ranges and defaults.

### What the nodes do that they did not before

- **The reference chain resolves.** `ref.card`, `ref.blend`, `ref.shot`, `ref.prompt`, the four
  `gen.*` nodes and `llm.ask` now evaluate locally (`core/style_eval.ts`): cards resolve to their
  granted camera and prose, Blend merges them and names which reference supplied the camera, Shot
  overrides framing and re-validates against the 63 cinema rules, and Prompt renders the result in
  the dialect of the chosen model. `ref.blend` and `ref.shot` were previously types with no
  evaluator — they could be wired and carried nothing.
- **A generate node shows the exact string it would send**, on the card and in the inspector's
  _Resolved_ section, before anything is paid for.
- **Generate nodes compile as provider calls**, not as the engine's generative-repair step. They
  were all category `ai`, so a Generate Image was described to the restorer with an empty prompt and
  an influence warning that means nothing for a text-to-image model.
- **`out.render` encodes.** It compiles to a real render+encode job carrying the stages of the chain
  that feeds it, the frame range of the Z stack behind it, and its own fps and CRF. The inspector's
  _Encode_ section runs it through the same pre-run gate as everything else.
- **The Viewer draws its split wipe.** With `compare` wired, the card paints the comparison source
  over the left half of the restored frame.
- **Optional inputs are declared**, so a node no longer reports an error for an input it does not
  need, and `out.save` now says the honest thing: it needs one of image, clip or audio.
- **A Prompt card is written in, not configured.** `subject` and the new `avoid` are text areas on
  the card itself; every generate node's `prompt` and `negative`, `llm.ask`'s instruction and
  context, and Segment's prompt behave the same way. Typing commits on blur, `Esc` restores, and the
  resolved prompt below updates as you leave the field — the avoid text is merged into the negative
  ahead of everything the references contribute, because what you asked to exclude should outrank
  what a card suggests.
- **Save writes, and says where.** `out.save` gained `folder` and `format`, shows the filename it is
  about to claim and the count it has written, and has a _Write now_ button in the inspector. It
  writes to `assets/v{N}/` — a new directory per write, so no earlier asset can be overwritten.
- **Subjects are nodes.** `ref.entity` puts a character, place or object from Home on the canvas: it
  grants its name, its traits verbatim and the first paragraph of its description, and shows the
  drawing you made of it. `traits` can be turned off for a shot where only the place matters.

## 5. The workflow library

Eight workflows ship in `workflows/`, built from the registry by `deno task workflows` — every wire
goes through the canvas's own connection rules, and each is compiled, style-resolved and priced
before it is written. Open one from **Library → Flows**. A workflow is a shape, not a project: it
names no reel, so it applies to whatever is loaded.

| Workflow                          | Nodes | What it is                                                                                                                                               |
| --------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restore a reel and export it**  | 9     | The full pass — stabilise, deflicker, dust repair, contrast — looped over the frame range and encoded by Render.                                         |
| **Grade one frame**               | 5     | The shortest useful graph: one frame, levels and sharpening, compared against the source in the Viewer.                                                  |
| **Treat the subject only**        | 7     | Segment the subject, turn the matte into a region, composite a differently graded version through it.                                                    |
| **Two references into one image** | 7     | A film supplies the camera, an archetype the presence; Blend states which won, Shot overrides the framing, Prompt renders it, Generate shows the string. |
| **Reimagine a restored frame**    | 8     | Restoration first: the graded frame becomes the reference for an image-to-image pass.                                                                    |
| **Shot list from a script card**  | 6     | A script card and a film card go to a language model whose text drives a generate node.                                                                  |
| **Look at a range in depth**      | 6     | A Z Stack with a stride, read as a carousel in Inspect → Depth.                                                                                          |
| **A subject into a place**        | 7     | Two subjects from Home — a character and a place — blended with a film's camera, rendered as a prompt, generated as one image.                           |

`tests/workflows_test.ts` loads every file in `workflows/` — the ones you save too — and holds each
to the same bar the canvas does: known node types, wires that still name real ports, nothing
dangling, no compile or style errors, and a run that can be priced.

## 6. Concepts

**Typed ports.** Signals are
`Image, Sequence, Mask, Flow, Params, Number, Flag, Text, Enum, Metrics,
Style, Video, Audio, Mesh`.
A wire is legal only between compatible kinds, and a cycle is refused while you drag, with the
alternative named: loops are Z stacks.

**Generated stage nodes.** The ten `stage.*` node types are generated from the engine's control
schema (`engines/restorer/controls.json`, vendored) and defaults. `deno task codegen --check` fails
if any generated file drifts from its source.

**Compilation.** Every maximal chain of stages on one image becomes one engine call; branches become
several calls joined by a local composite. A straight chain compiles to exactly the request the desk
itself would send.

**The depth axis.** `flow.stack` opens it, `flow.collect` closes it; the body runs once per frame
(capped at 240 slices, overflow reported, four in flight). Measured: 240 slices in 7.6 s.

**Asset ledger** (`core/assets.ts`). Each run records a version per node: parameters
content-addressed, relations `derived_from` and `variant_of`, states
`draft · ready · failed ·
retired` (soft delete only), stage history preserved through
linearisation.

**Hybrid lineage** (`core/hybrid.ts` + `core/columnar.ts`). Assets are graph nodes of four origins —
authored, generated, imported, derived — with transformations as edges; parameters live in an
append-only column store joined on `asset_id`. A re-run with changed values becomes a child of the
previous version and of its inputs. Saved as `workspace/<project>/lineage/lineage.v{N}.json`, one
new file per save; a save that drops or edits history is refused. The interchange format is
`schemas/hybrid_blueprint.example.json`.

**Models and consent** (`core/providers.ts`). One catalogue over ComfyUI and Ollama (local, free,
never gated) and fal.ai, Replicate, OpenAI, Google (Imagen, Gemini, Nano Banana), Stability and
Anthropic (Claude Sonnet 5, Claude Opus 5). Counts are exact, prices are labelled estimates, an
unpriceable model cannot be approved, and approval is bound to the graph digest.

**Reference library and cinema rules** (`core/library.ts`, `core/cinema/`). A movie card carries a
full camera configuration; 63 rules grade it as _hard_, _warning_ or _info_ against what a crew
could physically have shot; prompts are rendered per model dialect (11 targets). Ported from
Director's Console and verified against the Python original over 855 configurations.

---

## 7. HTTP routes

This server (never shadowed by the engine):

| Method   | Route                          | Purpose                                                          |
| -------- | ------------------------------ | ---------------------------------------------------------------- |
| GET      | `/status`                      | host and engine health                                           |
| GET      | `/library` · `/library/*`      | reference shelves (`?reload=1` re-reads disk) · frames           |
| GET      | `/models`                      | catalogue with providers marked configured (never the keys)      |
| POST     | `/estimate`                    | price a run and check a consent token                            |
| POST     | `/diagnostics`                 | structural pre-run report and gate verdict                       |
| GET/POST | `/lineage/<project>`           | latest lineage snapshot · append a new version (409 on rewrite)  |
| POST     | `/lineage/<project>/query`     | filter the parameter log                                         |
| GET      | `/lineage/<project>/blueprint` | export as a hybrid blueprint                                     |
| POST     | `/assets/<project>?name=`      | store bytes at `assets/v{N}/<name>`, always a new `v{N}`         |
| GET      | `/providers`                   | every provider, its source and the last 4 of a stored key        |
| POST     | `/providers/<id>/key`          | store or forget a key (an empty string forgets); never read back |
| POST     | `/providers/<id>/plan`         | record the subscription: label, monthly cap, renewal, note       |
| GET/POST | `/entities` · `/entities/<id>` | characters, places and objects · save a new `entity.v{N}.json`   |
| POST     | `/entities/<id>/media`         | attach a drawing, photograph, clip, recording or document        |
| GET      | `/workspace-media/entities/…`  | serve attached material (jailed to `entities/`)                  |
| GET/POST | `/flows` · GET `/flows/<id>`   | saved workflows                                                  |
| GET      | `/fs/list`                     | jailed directory listing                                         |
| GET/POST | `/studio/projects`             | studio projects                                                  |

Proxied to the engine: `/api/*` (REST, see <http://127.0.0.1:8000/docs>) and `/ws` (progress).

---

## 8. Project layout

```
ArsTechnicAI/
├── setup.sh · start.sh      install checks + engine environment · launch everything
├── server.ts                host: static, proxy, library, models, estimate, diagnostics, lineage, assets
├── core/                    pure, dependency-free
│   ├── graph.ts ports.ts ids.ts hash.ts spatial.ts scope.ts venn.ts registry.ts nodes.ts
│   ├── lineage.ts           copy-on-write buffers for one evaluation
│   ├── assets.ts            the per-node version ledger
│   ├── columnar.ts          append-only typed-array parameter log
│   ├── hybrid.ts            asset DAG + columns; derive, split, merge, compare, blueprint I/O
│   ├── diagnostics.ts       pre-run structural report and gate
│   ├── profiles.ts          display profiles, type bounds, capture sidecar schema
│   ├── providers.ts         model catalogue, estimates, consent
│   ├── entities.ts          characters, places and objects; what one grants to a prompt
│   ├── library.ts gen_nodes.ts catalogue.ts studio.ts tokens.ts
│   └── cinema/              config, presets, rules, prompt (ported)
├── bridge/                  engine client, stack evaluator, library loader, lineage_store.ts
│   ├── key_store.ts         provider keys (0600, never returned) and subscription notes
│   └── entity_store.ts      characters, places and objects; versioned saves, versioned media
├── ui/
│   ├── app.ts render.ts     the Workshop
│   ├── console.ts           execution console, run gate, lineage mirror
│   ├── inspect.ts           inspector tabs and render keying
│   ├── public/              index.html, canvas.css, profiles.css, inspect.css, panels.js, wiv.js (built)
│   └── home/                Home
├── codegen/ · gen/          generators · generated files (do not edit)
├── engines/restorer/        vendored control schema and defaults
├── library/                 cinema data, reference shelves, frames
├── schemas/                 hybrid blueprint example
├── tools/capture.ts         per-profile screenshots + JSON sidecars + layout checks
├── check_runtime.ts         drives the live page in Chrome (32 checks)
├── tests/                   unit, contract and parity suites
├── workflows/ · workspace/  saved flows · studio projects and lineage
├── .claude/agents/ · CLAUDE.md   agent roles and working rules
└── docs/DEBATE.md · docs/MERGE_PLAN.md
```

In `../ArchiveRestorer/frontend/public/`, `grade.css` holds the Workshop Grade layout; `app.js`,
`workspace.js` and `index.html` are the desk shared by Grade, the Restorer tab and the standalone
desk.

---

## 9. Development and verification

```bash
deno task verify     # codegen freshness + strict type-check + all unit tests (no server needed)
deno task build      # bundle ui/app.ts → ui/public/wiv.js (after any ui/*.ts change)
deno task runtime    # drive the live page in Chrome — needs a server
deno task capture    # screenshot every display profile, check layout, write sidecars
deno task workflows  # rebuild the shipped workflow library (--check validates, writes nothing)
deno task nodes      # print the node catalogue as Markdown (--ports for every port)
deno task lint · deno task fmt
```

In the engine (`../ArchiveRestorer`), two harnesses hold the parallel import to the serial code it
replaced — they are the evidence that speed cost nothing:

```bash
uv run python backend/extract_test.py   # serial vs pooled extraction, SHA-256 over every PNG
uv run python backend/analyze_test.py   # serial vs windowed analysis, field by field
uv run python backend/smoke_test.py     # the engine's own suite
```

- **Runtime.** Canvas checks move cards, so the tool never picks a project itself:
  `WIV_CHECK_PROJECT=<id> WIV_UI=http://127.0.0.1:8090/blueprint deno task runtime`. Point it at a
  copy or a sandbox engine (`RESTORER_WORKSPACE=/tmp/sandbox RESTORER_PORT=8012 …`).
- **Capture.** `WIV_UI="http://127.0.0.1:8090/blueprint/?project=<id>" deno task capture` writes
  `captures/<timestamp>/<profile>.png` + `.json` and checks base type, 8–32 px bounds, overflow,
  panel strategy, inspector tabs and redraw stability, the Grade picture share, and the run gate.
  Verification uses `__wiv.select()`, never canvas clicks, so it does not write your graph.
- **Chrome** is found at the usual macOS and Linux paths, or `CHROME_PATH`.
- **Guardrails** for contributors and agents are in `CLAUDE.md`: no destructive deletes, versioned
  writes, every execution path gated, parameter changes as new children.

**Status of 2.3.0:** `deno task verify` green (codegen check across six generated files, strict
type-check, **285 tests**); `deno task runtime` **32/32**; `deno task capture` all profile checks
passing; `deno task workflows --check` 8/8; `deno lint` clean over 67 files. Engine: `smoke_test.py`
**50/50**, `extract_test.py` byte-identical on four shapes (plain, clipped, strided, downscaled),
`analyze_test.py` identical on every field.

---

## 10. Design notes

**Oblique, not perspective.** The canvas uses cabinet oblique projection for depth:
`screen = (x + z·k·cos θ, y + z·k·sin θ)`. Hit-testing stays a rectangle test, wires stay straight,
text stays crisp; a 4000-slice stack costs what a 12-slice one does because visibility is clamped in
the geometry.

**Four regions, fuzzy.** `core/venn.ts` combines mattes with `max`, `min`, `min(a, 1-b)` — not
multiply, which eats feathered edges. The regions do not partition a soft matte, and `B \ A` is
empty whenever A covers the frame; `describePairing()` measures coverage and says which modes are
meaningful. `tests/contract_test.ts` holds the TypeScript and Python operators to each other.

**Copy-on-write buffers.** An operation that changes nothing returns its parent's payload; past a
byte budget, interior buffers fold into summaries that `replayPlan()` can rebuild. Node digests
exclude position, so dragging never invalidates a render.

**Graded diagnostics.** Out-of-range values are clamped with a warning; a temporal stage without
neighbours warns and degrades; AI influence above 0.6 warns; an unsatisfied required input or a
cycle is an error that names the fix.

**Engine additions.** `backend/zstack.py` tiles visible slices into one contact sheet (one decode
per carousel roll instead of seventeen) and annotates each with score and verdict; endpoints
`/api/zstack/{pid}`, `/sheet`, `/plate`, `/regions`. Layout constants are mirrored between
`core/spatial.ts` and `zstack.py` and asserted equal.

**The parity port.** The cinema engine was ported from Python and diffed configuration by
configuration. It caught a wrong default colour tone, preset terms cast instead of resolved (30
movement aliases now), manufacturers inherited from the wrong place, and Python's `2.0` vs
JavaScript's `2`. One deliberate deviation — deriving anamorphic from the lens family — is a
separate, named, tested step, so the parity test still verifies the port.

**Keyed inspector.** The inspector decides whether to rebuild by comparing a signature of what it
shows (selection, node revisions, wiring, Grade visibility, history length); a change made by one of
its own controls is absorbed rather than rebuilt. That is what lets a slider survive its own commit.

**Picture-first Grade.** The Grade grid places the desk's existing elements with `display: contents`
and `grid-template-areas`, so the markup and every script that queries it are unchanged; the
standalone desk is unaffected.

More reasoning, and the costs each decision accepted, are in [`docs/DEBATE.md`](docs/DEBATE.md) and
[`docs/MERGE_PLAN.md`](docs/MERGE_PLAN.md).

---

## 11. Changelog

Versions follow `major.minor.patch`. Dates are 2026.

### 2.3.0 — 18 September · Import at speed, and the things a project is about

**Import is six times faster, and byte-for-byte the same**

- **Frame extraction runs on a thread pool.** The bottleneck was never decoding — it was PNG
  encoding, one frame at a time, on the thread that had just decoded it. Decode stays sequential (a
  video file is a sequence); encoding and writing go to a `ThreadPoolExecutor`, with a semaphore
  bounding frames in flight so a long reel cannot grow the heap. `cv2.imencode` releases the GIL, so
  this is real parallelism, not concurrency theatre. Measured on 200 frames: **3.17 s → 0.51 s
  (×6.2)**, and `backend/extract_test.py` proves it by SHA-256 over every PNG written, in four
  shapes — plain, clipped, strided, downscaled. Identical bytes, not "close enough".
- **Analysis runs in windows.** With extraction fast, measuring each frame became the slow half.
  Per-frame decode, metrics and histograms now run in parallel windows, as does the pairwise motion
  estimate; only the scene-boundary walk stays sequential, because it is a walk. **16.24 s → 3.23 s
  (×5.0)** over 600 frames, with `backend/analyze_test.py` comparing every field against the serial
  implementation. A full import of a large reel went from ~18 s to ~6 s.
- **No ffmpeg extractor — deliberately.** The obvious speed-up was tried first and rejected with
  measurements, and the reason is now a comment block in `backend/project.py` so it is not tried
  again: under every flag combination (`range`, `colorspace matrix`, `accurate_rnd`, `rgb24`)
  ffmpeg's frames differed from OpenCV's by up to 3 levels, mean 1.2 — meaning every stored frame,
  every analysis metric and every existing project's history would shift. And with exact frame
  selection it was _slower_ (193 vs 399 fps). Speed that changes the pixels is not speed.

**Added**

- **Workflows drag onto the canvas.** Library → Flows rows are draggable: click still _loads_ a
  workflow in place of the graph, but dragging one _inserts_ it beside what is already there — ids
  remapped so nothing collides, positioned where you let go, and undone by `⌘Z` like any other edit.
- **You write into a Prompt card.** `subject` and the new **`avoid`** port are text areas on the
  card itself, as are every generate node's `prompt` and `negative`, `llm.ask`'s instruction and
  context, and Segment's prompt. Typing commits on blur, `Esc` restores the previous value, keys do
  not leak to the canvas shortcuts, and the resolved prompt updates underneath. Avoid text is merged
  into the negative **before** what the references contribute, because an explicit exclusion should
  outrank a suggestion.
- **The Save card does the job its name claims.** New `folder` and `format` ports, the exact
  filename it will claim shown on the card, a running count of what it has written, the upstream
  preview as its picture, and a **Write now** button in the inspector with the full path and a
  readiness line. Writes land in `assets/v{N}/` — a fresh version directory each time, so no saved
  asset can be overwritten.
- **Settings → Models: providers, keys and subscriptions.** Every provider in the catalogue with its
  model count, whether it is reachable, and where the credential comes from; paste a key without
  restarting; record the plan you are paying for (label, monthly cap, renewal date, note) so the
  gate's estimate has something to be read against. The key is stored `0600` in
  `.provider-keys.json` beside the workspace and **never sent back to the page** — reads answer with
  four characters and a source. An environment variable always wins over a stored key, and _Forget_
  rewrites the file without it. Local providers are marked as needing none.
- **Characters & places on Home.** A shelf for the things a project is _about_. Draw a subject on a
  canvas (pen, colours, sizes, eraser, undo), write its description at any length, add **traits**
  that must not drift, and attach photographs, film, audio, PDFs or notes. Every save is a new
  `entity.v{N}.json`; every upload claims its own `media/v{N}/` directory; nothing is ever replaced.
- **The `ref.entity` node** ("Subject") puts one on the canvas — its name, its traits verbatim, the
  first paragraph of its description, and the picture you drew. It is the same shape as a reference
  card on purpose, so a subject and a film idiom meet on one **Blend**: the library says how it is
  shot, the subject says who is in it. _Use in Workshop_ on Home opens the canvas with the card
  already placed and filled.
- **Inspector: _Write_, _Subject_ and _Save_ sections**, and a **negative prompt** row in _Resolved_
  (it is a real output that had no row).
- **Grade reads a Subject** the way it reads a reference card: the drawing as the picture, the
  summary, traits and description as the text.
- **An eighth workflow** — _A subject into a place_: a character and a place from Home, blended with
  a film's camera, rendered as a prompt, generated as one image.
- New routes: `/providers`, `/providers/<id>/key`, `/providers/<id>/plan`, `/entities`,
  `/entities/<id>`, `/entities/<id>/media`, `/workspace-media/…` (jailed to `entities/`).

**Fixed**

- Analysis's windowed rewrite dropped the delta for frame 0, shifting the whole camera path by one
  frame. Caught by the field-by-field parity harness, not by eye.
- The inspector did not know that a finished preview makes a Save node ready, so its _Save_ section
  could sit stale behind a fresh frame; readiness and filename are part of the signature now.
- A verification probe wrote into the real workspace because only the engine had been pointed at a
  sandbox. The host now runs with `RESTORER_WORKSPACE` set for verification too. The artifact it
  wrote (`workspace/grandparentsmariage-1788191920/assets/v1/Sharpen-f0.jpg`) was **not deleted** —
  the guardrails forbid it — and is recorded here instead.
- `__wiv.connect`, `__wiv.models` and `__wiv.inspectorTabs` debug hooks, so runtime checks can wire
  and inspect without clicking cards (clicks autosave the graph).

**Tests**

285 unit and contract tests (264 → 285): 8 for the key store (including one asserting no response
ever contains a key), 9 for entities, plus workflow and style-resolution coverage for `ref.entity`
and `avoid`. Engine: `extract_test.py` and `analyze_test.py` added; `smoke_test.py` 50/50.

### 2.2.0 — 18 September · The nodes do what their ports promise

**Added**

- **Style resolution** (`core/style_eval.ts`): the whole reference chain evaluates locally — cards
  to grants and cameras, Blend to a merged style that names the camera's source, Shot to an
  overridden and re-validated configuration, Prompt to the model's own dialect, and every generate
  node to the exact string it would send. No engine, no network, no key.
- **`ref.blend` and `ref.shot` evaluators** — they were types with no behaviour.
- **`out.render` encodes**: compiles to a real render+encode job with the chain's stages, the Z
  stack's range, its own fps/CRF and a new **`timing`** port — hold the frames outside the range so
  the cut keeps its duration, or drop them. Run it from the inspector's _Encode_ section through the
  pre-run gate. `EngineClient` gained `render()` and `exportInfo()`.
- **The Viewer's split wipe** is drawn on the card when `compare` is wired.
- **Optional ports** (`PortSpec.optional`), declared on the 13 inputs whose absence is a mode rather
  than a fault; `out.save` gained the check that actually matters (one of image, clip, audio).
- **Grade shows style steps**: selecting a Reference, Shot, Prompt, Generate or Ask node fills the
  pane with that step's reference frame and resolved text instead of an unrelated reel frame.
- **Inspector**: _Resolved_ section with per-output copy; _Encode_ section; a **version compare
  picker** that diffs any two recorded versions, not just the last two.
- **Seven shipped workflows** in `workflows/`, built and validated by `deno task workflows`, listed
  in [§5](#5-the-workflow-library).
- **`deno task nodes`** prints the node catalogue (and `--ports`, every port with ranges and
  defaults); the README's table is generated by it.
- Reference shelves load with the app, so a graph of reference cards resolves immediately.

**Fixed**

- **Generate nodes compiled to the engine's generative-repair step.** Every `ai`-category node did:
  `gen.image`, `gen.video`, `gen.audio`, `gen.mesh` and `llm.ask` were described to
  `/api/ai/enhance-frame` with an empty prompt and an influence warning meant for a repair pass, and
  counted as engine network steps. They now compile to their own `generate` step.
- **A generate node reported errors for inputs it does not need** — unwired `style` and `reference`
  were "missing", so a text-to-image node could not be made runnable.
- `out.render` compiled to nothing, so the README told you to export from Grade instead.
- The engine's render request was sent with `timing: "as_shot"`, which its schema rejects.
- Style and reference problems (a retired reference id, a prompt with nothing in it, an unpriceable
  model) were invisible; they now appear in Compilation with the wiring errors, and a graph with one
  says "nothing will run".
- **A port socket's own centre could resolve to the port below it.** The hit halo was a symmetrical
  40px circle over rows 20px apart, so a drag begun on one socket could start from its neighbour.
  The halo is now wide and short (`inset: -3px -14px`), keeping the horizontal reach that makes a
  wire easy to grab; all 43 sockets on the reference graph now resolve to themselves.
- `check_runtime.ts` fits the view and tests an on-screen socket, and reports how many were drawn —
  it previously failed whenever the first socket in the document happened to be panned out of view.
- `window.*` usages replaced with `globalThis` — the project is lint-clean apart from `ui/home/`.

**Verified**

264 unit tests (42 new: style resolution, compile semantics, workflow validity), 32 runtime checks,
all capture profile checks, 7/7 workflows. Live checks on the sandbox reel: the reference chain
resolves Blade Runner's Panavision Panaflex on Eastman 5293 through Blend → Shot → Prompt →
Generate; the Viewer paints its wipe after a run; two runs with a changed `clip_limit` produce a
version diff reading `clip_limit 2 → 10`; and **Render film** encoded a real 11.6 MB `restored.mp4`
from the canvas in 25 s.

### 2.1.0 — 17 September · Grade and Inspect rework

**Added**

- Inspector in four tabs — Node, Restorer, Depth, Workflow — with badges (selection count, slice
  count, error/warning count), `⌥1`–`⌥4` and arrow-key navigation.
- Node pane: project summary with nothing selected; per-port reset to default; AI-authored marker;
  value filter for nodes with more than eight ports; Wiring section with links; History with a
  parameter diff between the last two versions (from lineage); _Reveal_ jumps to a stage's knobs in
  Grade.
- Grade: picture-first grid layout; knobs in a side column (or below on narrow panes); single
  transport row; Timeline drawer (`T`) and Stats toggle (`H`), both persisted; _Keep_ compacted to
  its checkbox with a tooltip.
- _Find on canvas_ (`/`), restoring the filter the runtime check expected.
- `setup.sh` for macOS and Linux: tool checks with per-distribution install hints,
  native-architecture Python selection, engine environment creation, Linux OpenCV library check.
- Linux Chrome/Chromium paths and `CHROME_PATH` for the verification tools; `WIV_CHECK_PROJECT` for
  the runtime check.
- Capture checks for inspector tabs, redraw stability and the Grade picture share; `__wiv.select()`
  and `__wiv.inspectorTabs` debug hooks.

**Fixed**

- **Grade stayed empty when the Workshop was opened from Home** (`?project=`): the restored graph
  already carried the project id, so binding short-circuited — no frame count, no Grade project, no
  ledger. Binding now tracks what was actually loaded.
- **The inspector rebuilt on every canvas paint**: scroll jumped to the top while panning, and a
  slider was destroyed mid-drag by its own commit.
- **The last slider move of a drag could go unrendered in Grade**: a preview requested while one was
  in flight was dropped; it is now queued.
- **Wrap / Evaluate loop showed for every step**: a CSS `display` rule overrode the `hidden`
  attribute.
- **First-run bootstrap loop**: `start.sh` told you to run `ArchiveRestorer/start.sh`, which
  delegated straight back without creating the environment. `start.sh` now points at `setup.sh`, and
  `ArchiveRestorer/start.sh` runs it before delegating.
- **`codegen --check` failed after every start against a live engine** although nothing had changed:
  defaults were written in the engine's key order. They are now written in canonical order, and the
  vendored and live sources produce identical bytes.
- `deno task runtime` crashed on an empty canvas; it now explains what to set.
- The Footage chip in Grade showed the raw project id instead of the reel's name.
- Console warning line rendered in the fallback serif font.

**Performance** (cold Workshop load, 1440×900, reference reel, headless Chrome)

| Measure                            | 2.0.0                | 2.1.0                         |
| ---------------------------------- | -------------------- | ----------------------------- |
| Desk application boots             | 4                    | 1 (2 once Restorer is opened) |
| 4.8 MB analysis downloads          | 2                    | 1                             |
| Preview renders on load            | 2–4                  | 2                             |
| DOM nodes                          | 15,459               | ~7,100                        |
| Event listeners                    | 1,735                | ~825                          |
| Z-stack fetches while Depth hidden | one per frame change | none                          |

The 2.0.0 column was measured with the Grade binding fix applied, so that both columns load the same
project; without it 2.0.0 loaded no project into Grade at all.

The desk frames now mount only once the project list has loaded; the Restorer frame mounts on first
open and skips the viewer's work (filmstrip, roll, preview) it never shows; Grade ignores handshake
echoes of a frame or parameter set it already shows.

**Changed**

- Console starts collapsed on windows shorter than 1000 px (still expanded on lab displays).
- Desktop capture check requires the console docked, not expanded.

### 2.0.0 — 17 September · v2.0 architecture

**Added** — hybrid lineage (asset DAG + append-only column store, blueprint import/export and
validation); pre-run structural gate on every execution path with digest-bound confirmation; bottom
Console (execution table, loop overrides, fps/heap, lineage query); display profiles with 8–32 px
type bounds; versioned asset and lineage writes (`/assets`, `/lineage`); `/diagnostics`;
`tools/capture.ts` with validated sidecars; Nano Banana and Claude Opus 5 in the catalogue; seven
agent roles in `.claude/agents/` and `CLAUDE.md`.

**Fixed** — panels opened over the whole canvas on phones and tablets; labels wrapped on lab
displays.

### 0.1.x — 3–17 September · the merge

Four programs became one: the Next.js ArsTechnicAI (interaction vocabulary, asset ontology, provider
catalogue), Director's Console (cinema rules, presets, prompt dialects — ported), and
ArchiveRestorer (schema vendored; engine unchanged in role) onto this Deno base.

**Fixed along the way**

- Wiring by drag connected nothing (pointer capture retargeted events; now hit-tested by point).
- A required port could be folded off its own card, making a graph unrunnable from the canvas.
- A background tab froze its own run's display (`requestAnimationFrame` never fires hidden).
- Engine: `/api/frames/compare` discarded a comparison it meant only to refuse, and logged mattes it
  never saved (`smoke_test.py` 49/50 → 50/50).
- Parity port: wrong default colour tone, cast-not-resolved preset terms, manufacturers from the
  wrong source, `2.0` vs `2`.

---

## 12. Known limitations and future changes

**Not built yet**

- **Generate nodes still execute nothing.** They resolve their prompt, price it, gate it and record
  it as a planned call — the provider clients that make the HTTP request are the next piece of work.
- **Restoration pixels are still Python.** TypeScript has no OpenCV or muxer; porting means an
  OpenCV WASM build or driving ffmpeg stage by stage.
- `gen.video`, `gen.audio` and `gen.mesh` resolve and compile, but nothing downstream consumes a
  `Video`, `Audio` or `Mesh` signal except `out.save`.
- Home keeps its own left panel; the Refs shelf is Workshop-only.
- **A subject's attached film and audio are stored, not looked at.** A clip you attach is kept,
  served and counted, but nothing extracts a frame from it, and no model reads it — an entity grants
  text today, not image conditioning.
- Subjects are not yet a Library shelf in the Workshop: you reach one through _Use in Workshop_ on
  Home, or by typing its id into a Subject card.

**Known limitations**

- **Grade and Restorer are still two instances of the desk** once both are open, kept consistent by
  messages. Planned: one desk state shared by both surfaces (a single iframe with two views, or the
  desk's state moved into the host), removing the second boot entirely.
- The gate is enforced in the UI for local runs; the server enforces the money consent only, because
  local runs go browser → engine directly. Planned: route engine run requests through a host
  endpoint that checks the gate token.
- Desk text (Grade, Restorer) uses the desk's own fixed sizes rather than the profile scale.
- Versions recorded before 2.0.0 have no parameter records, so History cannot diff them.
- Saving a flow with an existing id overwrites that flow file (assets, lineage, entities and their
  media never do).
- A stored provider key is protected by file permissions, not encryption: anyone who can read your
  home directory as you can read it, exactly as with `~/.aws/credentials`.
- Extraction parallelism is capped at 8 workers; on a very large machine the encode pool, not the
  machine, is the ceiling. Decode remains sequential by nature.
- `RESTORER_WORKSPACE` also moves the host's studio-project directory.
- A browser page cannot read GPU memory; capture sidecars report VRAM as `null`.
- Linux was not run end to end for this release (see §2.2).

**Next**

1. Provider clients behind the existing consent gate, starting with ComfyUI (local) and one remote —
   every other piece of that path (prompt, price, gate, lineage record) now exists.
2. Single shared desk state for Grade and Restorer, removing the second instance.
3. Host-side gate enforcement for engine runs.
4. A media viewer for `Video`, `Audio` and `Mesh` signals on the canvas — and with it, a subject's
   attached clip as a real reference frame rather than stored material.
5. A Subjects shelf in the Workshop library, dragging onto the canvas like a reference card.
6. Profile-scaled typography inside the desk.
7. A Linux CI job running `setup.sh`, `deno task verify`, `deno task workflows --check` and
   `deno task capture` in a container.
