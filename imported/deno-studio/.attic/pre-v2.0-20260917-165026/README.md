# Ars Technic AI

A canvas for making pictures, and for repairing them. **Home** lists reels, **Workshop** is the work
page — blueprint graph above, restorer desk below, one project, one origin
(`http://127.0.0.1:8090`).

The graph does two things that turn out to be the same thing. It **restores** footage, compiling a
chain of stages into one call to a deterministic OpenCV engine. And it **generates** media — images,
video, audio, 3D, text — from a library of 160 worked references, on any model you point it at. A
film reference is not a phrase to append to a prompt; it is _Blade Runner_'s Panavision Panaflex on
Eastman 5293, C-Series anamorphics at 35/50/75/100, lit by neon and practicals, 2.39:1, and
explicitly not cheerful. The rules engine can then have an opinion about what you do with it.

The blueprint plane carries the pipeline in X/Y. The Z axis carries iteration: a temporal loop is
drawn as a receding stack of frames — one slice per frame, the focused slice upright and sharp, the
rest falling away along an oblique depth axis and rolling like a CD carousel. There are no feedback
edges in this graph, by design. **Depth is the loop.**

---

## The merge

Four programs went into this one. Three of them no longer need to exist.

| Donor                       | What it was                                                                                                                                            | What survives, and where                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ArsTechnicAI** (Next.js)  | 67 801 lines: React, Zustand, Prisma, ~200 module stubs                                                                                                | The interaction vocabulary, the asset ontology, and the provider catalogue. Rebuilt against this app's own primitives — see [`docs/MERGE_PLAN.md`](docs/MERGE_PLAN.md).                                                         |
| **DirectorsConsole**        | Cinema Prompt Engineering: 6 700 lines of Python enforcing physical possibility, plus 110 film presets, a ComfyUI orchestrator and a storyboard canvas | **Ported to TypeScript in full** — `core/cinema/`. 63 rules, 11 prompt dialects, 110 presets, 573 vocabulary terms. Verified against the Python original, configuration by configuration.                                       |
| **ArchiveRestorer**         | 17k lines of tested Python/OpenCV: stabiliser, deflicker, dust repair, optical-flow frame synthesis, segmentation, colorimetry, H.264 export           | The parameter schema is **vendored** at `engines/restorer/`, so the node types generate with no Python present. The pixel work still runs in the Python engine; that port is staged, and what is not yet ported is named below. |
| **ArsTechnicAI** (this one) | Deno 2, vanilla TS, zero dependencies                                                                                                                  | The base. The canvas, the typed ports, the depth axis, the lineage store.                                                                                                                                                       |

### What "ported" means here, precisely

The cinema layer is a real port and is held to it. `tests/cinema_parity_test.ts` drives **both**
engines — the TypeScript one and the original Python — over the same generated configurations and
fails on any difference:

- **855 configurations** × 63 rules: identical messages, identical severities, identical order.
- **855 configurations** × 11 prompt targets × 2 detail levels: identical strings.
- **110 presets** applied: identical configurations, identical validation.

It caught four real defects on the way through, listed under
[Four things the parity test caught](#four-things-the-parity-test-caught). The test skips when the
donor checkout is absent, because the port is meant to outlive it.

The **restoration** engine is a different case and is not oversold. TypeScript has no OpenCV and no
muxer, so the pixel and codec work still runs in Python. What the port did achieve is that nothing
_else_ needs it: the schema is vendored, the node types generate from the tree, and the whole
generation half — library, rules, prompts, providers, generate nodes — runs with the engine absent.
`./start.sh` says so and starts anyway.

**WIV does not reimplement any of that.** It compiles a graph into requests the engine already
answers. The reasoning is in
[`docs/DEBATE.md`](docs/DEBATE.md#the-disagreement-that-had-to-be-settled-first): Gall's Law says
evolve the system that works, and the system that works is the engine.

The coupling is real and deliberate: **WIV cannot run without ArchiveRestorer present.** The
alternative was a second implementation of the same colour science, which is how a restoration tool
starts giving two different answers.

### The seam

Restoration parameters have one source of truth — `ArchiveRestorer/shared/controls.json` for
domains, `backend/pipeline.py::DEFAULT_PARAMS` for values. WIV's ten `stage.*` node types are
**generated** from both. Nothing is transcribed.

```
controls.json ──┐
                ├──► deno task codegen ──► gen/stage_nodes.ts   (10 nodes, 48 ports)
DEFAULT_PARAMS ─┘                     └──► gen/engine_defaults.json
core/tokens.ts ───────────────────────└──► ui/public/tokens.css
```

`deno task codegen --check` fails the build if any generated file drifts from its source. Widen a
range in the engine and forget to regenerate, and the test suite says so — rather than a node
quietly offering a range the backend rejects.

---

## Layout

```
ArsTechnicAI/
├── core/                    Phase 1 primitives — pure, zero-dependency
│   ├── ids.ts               branded ids; a NodeId cannot be passed as a PortId
│   ├── hash.ts              canonical JSON + content addressing
│   ├── spatial.ts           the 2D plane, collision avoidance, the Z carousel
│   ├── ports.ts             typed signals, connection rules, range clamping
│   ├── graph.ts             the document, topological order, cache keys
│   ├── venn.ts              the four-region propagation model
│   ├── lineage.ts           copy-on-write buffers, history, memory digesting
│   ├── assets.ts            the asset ledger — versions, relations, soft delete
│   ├── tokens.ts            dual typography, elevation, the 3-state filter
│   ├── registry.ts          node type contracts
│   └── nodes.ts             the hand-authored node types
│
│   ├── providers.ts         the model catalogue, the cost estimate, the consent gate
│   ├── library.ts           references — what a card grants when you drop it
│   ├── gen_nodes.ts         ref.* / gen.* / llm.* node types
│   └── catalogue.ts         every node type there is, in one place
│
├── core/cinema/             PORTED from Director's Console
│   ├── config.ts            what a shot is: body, glass, stock, light, framing
│   ├── presets.ts           110 films and styles; applying one to a config
│   ├── rules.ts             63 rules — what could actually have been photographed
│   └── prompt.ts            a config, rendered for one particular model
│
├── library/                 DATA — served, not bundled, so it can grow
│   ├── cinema/              presets, vocabulary, compatibility, alias tables
│   ├── references/          the hand-authored shelves: stars, comics, scripts
│   ├── thumbs/movies/       109 reference frames at 480px
│   └── frames/movies/       the same frames at source resolution
│
├── engines/restorer/        VENDORED — controls.json + defaults.json
│
├── codegen/main.ts          runs every generator, and passes --check to all of them
│   ├── from_controls.ts     controls.json + DEFAULT_PARAMS → stage node types
│   └── from_cinema.ts       vocabulary + compatibility + mappings → typed unions
├── gen/                     GENERATED — do not edit
├── bridge/engine.ts         graph → engine requests; the HTTP client
├── bridge/library.ts        read library/ off disk and hand core/ something to index
├── core/scope.ts            what lies inside a Z stack
├── bridge/evaluator.ts      the depth loop: run the body once per slice
├── ui/                      the canvas: app.ts, render.ts, public/
├── server.ts                static host + /api proxy + /ws + /library + /estimate
├── check_runtime.ts         loads the real page in Chrome and drives it — 32 checks
├── start.sh                 launch both halves; the engine is optional
├── workflows/               saved graphs, written by the library's Flows tab
├── tests/                   168 tests, incl. the cross-runtime cinema parity suite
├── tests/parity/            the Python reference harness the port is diffed against
├── docs/DEBATE.md           Phase 2 — the five reviews and what they changed
├── docs/MERGE_PLAN.md       what came from the Next.js donor, and what did not
└── ui/public/tokens.css     GENERATED from core/tokens.ts
```

On the engine side this adds `backend/zstack.py` and four routes under `/api/zstack/`.

---

## Running it

```bash
cd ~/Desktop/ArsTechnicAI && ./start.sh
```

That starts the engine if it is not already up, regenerates the node types from its live schema,
bundles the canvas, and opens <http://localhost:8090>. Stop everything with `Ctrl-C`. If
ArchiveRestorer is already running on :8000 the script leaves it alone, so this and
`ArchiveRestorer/./start.sh` can coexist.

> **Port 8000 is contested.** ComfyUI defaults to :8000 too. If it is already listening there,
> `start.sh` finds `/api/health` 404ing, concludes the engine is not up, tries to start it, and
> uvicorn cannot bind — so the script stops with _"The engine failed to start"_, which is true and
> does not name the cause. It now says which process holds the port instead.
>
> Run the two side by side:
>
> ```bash
> RESTORER_PORT=8001 ./start.sh
> ```
>
> `start.sh` passes that through to `WIV_BACKEND`, so the canvas proxies to :8001 and ComfyUI keeps
> :8000. `curl -s localhost:8090/status` says which engine the canvas is actually talking to.

### The two halves by hand

```bash
# Terminal 1 — the engine
cd ~/Desktop/ArchiveRestorer/backend
../.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000

# Terminal 2 — the canvas
cd ~/Desktop/ArsTechnicAI
deno task codegen && deno task build
deno run --allow-net --allow-read --allow-env server.ts
```

### Checks

```bash
deno task verify    # codegen freshness + strict type-check + 168 tests
deno task runtime   # loads the real page in Chrome and drives it (needs the server up)
deno task build     # bundle ui/app.ts -> ui/public/wiv.js
```

`verify` needs nothing running. `runtime` needs the server, and catches the class of bug
type-checking cannot see — a null dereference in an event handler, a selector that stopped matching,
a route that 404s only once a panel opens. It asserts the page against its own claims: that every id
the scripts reach for exists, that the seeded graph compiles, that an illegal wire is refused with a
reason, that filtering dims without moving the layout, that a right-drag rectangle-selects without
also opening the node wheel, that every card carries its options control, that the file browser
refuses to climb out of its root — and that **a socket is findable by point rather than by event
target**, which is the check that would have caught the wiring bug described below.

### Using it

The canvas opens on a seeded chain — Video → Frame Pick → Stabilisation → Deflicker → CLAHE → Viewer
— because an empty canvas makes you guess both what the nodes are and how they connect. That chain
is also the order the engine's own notes recommend: stabilise first, since every temporal stage
compares neighbouring frames and gets sharply better once they are aligned.

|                  |                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add a node       | Click or drag one from the palette                                                                                                                                 |
| Wire             | Drag from an output socket to an input. Legal targets light up, everything else dims, and an illegal drop says why                                                 |
| Re-route         | Drag _from_ a connected input to pick its wire up                                                                                                                  |
| Move             | Drag a card's header — it snaps to the grid and pushes clear of its neighbours. Dragging one card of a selection moves the whole selection                         |
| **Select many**  | **Right-drag the empty canvas.** Cards the rectangle touches light up as you drag; a right-_click_ still opens the node wheel                                      |
| Inspect          | Click a card. The inspector shows **every** port, including the ones the card folds away                                                                           |
| **Card options** | **The `⋯` on any card header** — run it, mute, collapse, unfold its ports, and read its versions, lineage and stage history                                        |
| **Unfold ports** | The `+N more — show on card` line at the foot of a card. A port that is _required_ and unwired is never folded away                                                |
| Mute / delete    | `M` / `Backspace`                                                                                                                                                  |
| Frame all        | `F`, or the **Fit** button                                                                                                                                         |
| **Run**          | **`R`, or the button** — runs the selection plus everything upstream it needs. Nothing selected runs the whole graph. Press again to stop; finished steps are kept |
| Preview          | `P`, or the button — compiles the _whole_ graph and runs its local steps                                                                                           |
| **Loop**         | **`L`, or Loop in the inspector** — wraps the selection in a Z Stack and a Collect, and re-routes its source so the body iterates                                  |
| Undo             | `Cmd-Z`                                                                                                                                                            |
| Depth            | The strip along the bottom. Click a slice to jump to that frame; `◂ ▸` roll the carousel                                                                           |

The **Compilation** panel is live: it says how many engine calls the current graph collapses to, and
lists every diagnostic. Click one to jump to the node. Beneath it, the ledger line says how many
versions this project holds and how much engine time made them.

### The library

The left column has four tabs, because all four answer "what can I put on the canvas".

| Tab       | What it holds                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------- |
| **Nodes** | The node types, by category. `N` focuses the search                                                     |
| **Files** | The folders on this machine. Reels the engine can decode are picked out; clicking one opens it in Grade |
| **Refs**  | The reference library — 160 cards across four shelves. Click or drag one onto the canvas                |
| **Flows** | Saved workflows. **Save current** writes the graph to `workflows/`; clicking one loads it               |

The file browser lists **names and sizes only** — no route here reads a file's bytes. It is jailed
to one root (`ARS_FILES_ROOT`, default `$HOME`), and a path that climbs out of it is refused; a
runtime check asserts that refusal. Opening a reel hands the _path_ to the engine, which is the half
of the system that has ffmpeg. A saved flow deliberately does not record the project it was built
against: a workflow is a shape to apply to footage, not a reference to one reel.

### The reference library

Four shelves, 160 cards. Unlike the other three library tabs, Refs is a **grid of frames** rather
than a list, because it is browsed rather than searched: you open Nodes knowing what you want and
open Refs looking for something to react to.

| Shelf       | Cards | What it answers                                                                     |
| ----------- | ----- | ----------------------------------------------------------------------------------- |
| **Movies**  | 110   | How is it _photographed_ — body, glass, stock, aspect, the instruments on the floor |
| **Stars**   | 16    | Who is in front of the lens, and how they play it                                   |
| **Comics**  | 18    | How is it _drawn_ — line, colour, panel grammar                                     |
| **Scripts** | 16    | What _happens_, and in what shape                                                   |

They are orthogonal on purpose: one of each composes into a complete shot, and the canvas can wire
all four into a single generate node.

A card **grants** structured material rather than a phrase. A movie card carries a whole
`CinemaConfig` — the thing `core/cinema/rules.ts` can validate — plus the cinematographer's own
prose. Two references combine by merging: text accumulates and deduplicates, parameters union, and
because two camera configurations cannot be averaged, `mergeGrants` reports _which_ references
supplied one instead of picking quietly. A card that says "Blade Runner's camera, overridden by
Akira's" is telling you something; one that silently picks is not.

The movie shelf is **derived** from the cinema presets rather than duplicated into a second file, so
widening a film's lens list in one place cannot leave a stale card behind. The other three shelves
are hand-authored JSON under `library/references/`, discovered by scanning the directory — dropping
in a new `*.json` adds a category's worth of cards with no rebuild. `?reload=1` on `/library`
re-reads from disk, so editing a shelf is a save and a click.

> **On the Stars shelf.** These are casting archetypes — presence, performance register, wardrobe,
> the light a persona is conventionally shot in. They deliberately do not describe the face of any
> real person. A library whose purpose was reproducing identifiable people would be a
> likeness-rights problem wearing a cinematography hat, and it would also be the less useful tool:
> what a shot needs is a _presence_, and presence is a lighting and blocking decision. Real people
> appear here as attribution — the cinematographers credited in the film data — never as a target.

### What could actually have been shot

`core/cinema/rules.ts` holds 63 rules whose single question is whether a configuration is something
a crew could have photographed. A Panavision body takes Panavision glass and nothing else. An HMI
did not exist before 1972. A 4 kg body does not go on a gimbal. Midday does not produce moonlight.

The value is not that the rules protect the renderer — a model will happily draw "handheld IMAX at
blue hour lit by the sun", and the result will look like nothing, because the description describes
nothing. The value is that they stop you _asking_ for an image with no referent. So the severities
are graded, exactly like the graph compiler's diagnostics:

|           |                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hard`    | Physically impossible. The prompt would be incoherent.                                                                                                                        |
| `warning` | Possible, but fighting itself. _Midsommar_ is a cheerful mood under high-key daylight and it is deliberately unsettling — the rule fires, and you say yes, that is the point. |
| `info`    | A note a cinematographer would make in passing.                                                                                                                               |

A hard rule that only warned would not be a rule; a warning that blocked would be routed around
within a day.

Applying a preset is where this gets its teeth. `bicycle_thieves` comes back **invalid** — the
preset pairs a heavy body with handheld operation. That is a fact about the film data, and now a
visible one rather than a silently wrong camera.

The prompt is _derived_ from the configuration, not typed alongside it, and it is derived
differently per model: Midjourney takes comma-separated fragments and its own flags, FLUX takes
sentences and no negative prompt at all, CogVideoX truncates at fifteen parts to stay under 224
tokens, Wan's mixture-of-experts is measurably better when you over-specify. `ref.prompt` puts that
derivation on the canvas so you can read the string before you spend a run on it.

### Any model, and the gate in front of the paid ones

`core/providers.ts` is one catalogue over eight providers — ComfyUI and Ollama locally, fal.ai,
Replicate, OpenAI, Google, Stability and Anthropic remotely — covering image, video, audio, music,
text and 3D.

The README used to say network steps compile but do not execute, because _"a 240-slice stack run
would otherwise be 240 paid generative calls from one click"_, and the consent flow that would gate
them did not exist. It does now, and the shape of it is the point:

```
240 paid calls · about $12.00
Flux Pro 1.1 · 240 calls · $12.00 · local alternative: comfy:flux-dev
[ Run 240 ]   [ Run 1 and stop ]   [ Cancel ]
```

A dialog that says "this will call an API, continue?" is worthless — it is clicked through in a
week. The only useful question names the number that will surprise you. So:

- **The count is exact; the money is an estimate and says so.** Someone who reads "240 calls"
  understands the risk even if the price is stale by a factor of two. A lone dollar figure carries a
  precision it has not got.
- **Approval is bound to the graph it was granted for.** `ConsentToken` carries the graph's digest
  and the call count it was shown. Approve one test slice, widen the stack to 240, press Run again —
  and it asks again. A boolean "user consented" flag spends the 240.
- **Local is exempt entirely.** ComfyUI on this machine is free, private and unmetered, so it never
  asks, and every consent prompt names a free model that does the same job when one exists. The
  expensive path should be the one you have to ask for.
- **An unpriceable model cannot be approved at all**, because consent cannot be asked for honestly
  when the cost is unknown.
- **A missing key is reported as configuration, not denial.** `/estimate` names the environment
  variable to set. "Set `FAL_KEY`" is actionable; "authentication failed" is not.

Estimation and enforcement are the same function on the server, so a client that skipped the dialog
gets the same refusal.

### Assets, versions and state

Every result the engine returns is recorded in the project's **asset ledger** (`core/assets.ts`).

- **Versions** are numbered per node, and the _parameters_ that produced them are content-addressed
  — not the pixels, because the engine re-encodes and two identical requests would otherwise not
  compare equal. Re-running an unchanged node adds nothing; changing a value adds `v2`. A card wears
  the count as a `v3` badge.
- **Relations** are an edge list: `derived_from` links a result to the upstream results it was
  computed from, `variant_of` links it to the previous version of the same node. Both directions are
  queryable — which a `childIds` array on the parent cannot manage once a child is written by
  another path.
- **State** is `draft · ready · failed · retired`. Deleting is soft: a retired version stays in the
  history and stays replayable.
- **Stage history** survives linearisation. A chain of five stages compiles to _one_ engine call and
  so produces one asset, not five — but the engine reports the ordered stages it applied and the
  parameters each resolved to, and the card menu reads the per-stage record back out of that one
  result rather than buying it with four extra round-trips.

Past twelve versions a node's oldest **pixels** are dropped; the versions, digests, reports and
relations are not, and `starred` exempts one. What persists to `localStorage` is the ledger minus
its images, on the same reasoning: the pixels are the one part that can be recomputed.

On the canvas, lifecycle is a colour: idle is quiet, **evaluating** pulses, **fresh** takes the
node's accent, **stale** goes dashed, **failed** goes red. A run numbers the cards still queued
behind it.

---

## The pieces that carry the design

### 2D → 2.5D: why oblique, not a perspective camera

The canvas is a _blueprint_. Under a perspective camera every node card gets a different scale and a
trapezoidal footprint: hit-testing needs an inverse projection per card, text needs re-rasterising
per depth, and a straight wire between two nodes stops being straight on screen.

Under **cabinet oblique projection**, X and Y stay screen-parallel and unscaled and depth
contributes a fixed 2D offset:

```
screen = (x + z·k·cos θ,  y + z·k·sin θ)
```

Hit-testing stays a rectangle test, wires stay straight, text stays crisp. Depth reads as offset,
scale-down and dimming — the carousel — not as foreshortening. `projectSlice()` returns a plain 2×3
affine that Canvas2D, SVG and a Three.js `Object3D.matrix` all consume, so adopting Three.js later
replaces the _renderer_ without touching the _layout_.

A stack shrinks toward its own origin, not the canvas origin — without that term a stack placed far
from (0,0) slides across the screen as it recedes. `visibleSlices()` clamps to `maxVisibleDepth` in
the geometry rather than in the renderer, so **a 4000-slice stack costs exactly what a 12-slice one
costs**.

### The four regions, and the trap in them

`core/venn.ts` implements the dual-circle model over two coverage mattes, using the Zadeh operators
— `max`, `min`, and `min(a, 1-b)` — not multiply. A matte from GrabCut is feathered, and
multiplication darkens the overlap of two half-covered edges to 0.25, eating the feather and leaving
a seam. `min` is idempotent, so intersecting a matte with itself is a no-op, as it must be.

Two consequences are load-bearing and easy to get wrong:

1. **The regions do not partition.** At `a = b = 0.5` every region measures 0.5 against a union of
   0.5. Fuzzy sets are not additive. The four coverage readouts must never be drawn as a pie, and
   must not be expected to total the union on any soft matte. A test pins this.

2. **`B \ A` is empty whenever A covers the frame.** The tempting pairing — A = whole frame, B =
   subject — gives the right answer for three modes and silently returns nothing for the fourth.
   `describePairing()` _measures_ coverage and reports which modes are meaningful, because a matte
   that should be a subject can come back covering the frame when segmentation fails, and that looks
   identical to a deliberate whole-frame operand until you check.

Both halves implement the same algebra; `tests/contract_test.ts` reads the Python source and fails
if the operators diverge.

### Copy-on-write lineage

Most nodes change nothing on most frames. `LineageStore.derive()` returns the parent's payload when
an operation reports no change, so an untouched frame is one allocation no matter how deep the graph
— while still writing the history entry, so provenance stays complete.

Past a byte budget, `compact()` folds the oldest _interior_ buffers into semantic summaries: lineage
and operations survive, pixels do not, and `replayPlan()` rebuilds them. Sources, leaves and
recently-read buffers are never evicted, each for a stated reason.

`nodeDigest()` is the cache key. It folds in type, values, mute state, slice index and every
upstream digest — and excludes **position**, so dragging a card never invalidates a render.

### Compilation

The engine takes a flat parameter dict applied in a fixed order. A WIV graph branches and masks.
`compileGraph()` **linearises**: every maximal run of `stage.*` nodes touching one image with no
branch in between collapses into a single params dict and becomes one engine call. Branches become
several calls joined by a local composite.

A graph that happens to be a straight chain compiles to precisely the request the existing grading
desk would have sent — same bytes, same cache entry, same result. The engine never learns that a
graph exists.

Diagnostics are graded rather than binary:

| Situation                         | Severity         | Why                                                                    |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Value outside its engine range    | warning, clamped | A slider that won't render is worse than one at its limit that says so |
| Temporal stage with no neighbours | warning          | It degrades to single-frame; it still renders                          |
| AI influence above 0.6            | warning          | Models drift on faces                                                  |
| Region node with no mattes        | warning          | Every mode gives the same result                                       |
| Required input unsatisfied        | **error**        | Nothing to process                                                     |
| Cycle                             | **error**        | Names the alternative: use a Z stack                                   |

---

## Engine additions

`backend/zstack.py` builds the depth strip. Full-resolution PNGs are not viable in the browser — a
300-frame stack is gigabytes of decode for a widget the size of a playing card — so the visible
slices are tiled into **one contact sheet**, sized by the same depth-scale constant the canvas draws
with. One image decode per carousel roll instead of seventeen.

Each slice carries its measured luminance, sharpness and the analysis pass's quality score and
verdict, so **a bad frame is visible as a dark card in the stack before you roll to it**. On the
reference reel, focusing frame 2255 — the unmarked shot change the restorer's own README calls out —
shows:

```
frame  2252 d-3  lum 154.96  score 47.70  review
frame  2254 d-1  lum 154.83  score 52.51  review
frame  2255 d+0  lum 157.46  score 31.31  drop      ← visibly darker in the stack
frame  2256 d+1  lum 153.81  score 44.13  review
```

| Method | Endpoint                    | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/zstack/{pid}`         | slice profile + contact sheet metadata   |
| GET    | `/api/zstack/{pid}/sheet`   | the contact sheet itself (immutable URL) |
| POST   | `/api/zstack/{pid}/plate`   | temporal-median background plate         |
| POST   | `/api/zstack/{pid}/regions` | the four Venn regions + a pairing report |

Layout constants are mirrored between `core/spatial.ts` and `zstack.py` — the two runtimes share no
module system, and a network round-trip for four numbers would be worse. `tests/contract_test.ts`
asserts they agree, so it is a checked mirror rather than a copy that rots.

---

## Three canvas bugs the merge surfaced

Found while restoring the GitHub version's interactions, each by trying to do the thing the donor
did and watching this canvas fail to do it.

**Wiring by drag connected nothing.** `startWire` captures the pointer to `#stage` so a drag
survives leaving the element — and pointer capture _retargets every subsequent event to the capture
element_. So `event.target` during a wire drag was always `#stage`, `.closest(".port-dot")` was
always `null`, and every drop landed on nothing. The hover highlight had the same fault, so legal
targets never lit either. The fix is the one the donor's `useCanvasPointerInteractions` already
used: hit-test with `document.elementFromPoint`, which asks what is under the cursor rather than
what the event was retargeted to. `deno task runtime` now asserts it.

**A required port could be folded off its own card.** `visiblePorts` budgets seven rows and sends
the rest to the inspector — reasonable, until the port it folds is one with no default. The Viewer's
`compare` was exactly that: required, unwired, hidden. The compiler reported "Compare with has no
source", and the socket it named was not on screen, so the graph could not be made runnable from the
canvas at all. A required-and-unsatisfied port now outranks the row budget, and `+N more` became a
button that unfolds the rest in place rather than a label naming somewhere else.

**A background tab froze its own run.** Repaints were scheduled only through
`requestAnimationFrame`, which a hidden tab never fires. A Run keeps working in the background, so
its lifecycle colours, queue numbers and inspector would sit frozen on whatever the graph looked
like when the tab was last visible, then jump on return. `invalidate()` now falls back to a coarse
timer while `document.hidden`.

The seeded graph in `workspace/grandparentsmariage-1788191920/graph.json` had also lost its Frame
Pick and gained an orphan duplicate Footage node, which is why it compiled to "2 errors — nothing
will run". It was repaired through the UI; the original is beside it as `graph.backup-*.json`.

---

## Two engine bugs fixed along the way

Found while verifying the new routes against `smoke_test.py`, which was at 49/50 before this work
and is at **50/50** now.

**`/api/frames/compare` discarded a comparison it meant only to refuse.** The code's own comment
reads _"It can be looked at; it must not be committed or repaired from"_ — but the implementation
raised, throwing away the comparison along with the commit. Seeing that two frames do not register
is exactly how a user learns there is a cut between them. The response now succeeds, carries the
comparison, omits `mask_id`, and explains in `mask_refused` why nothing was saved. (It also 500'd
rather than 4xx'd, because the guard raised a bare `ValueError` into the catch-all handler.)

**The same endpoint logged mattes it never saved.** The memory event fired on the _request_ flag
rather than the outcome, so a refused commit was recorded in project history as if it had happened —
and that history is what later decisions, and the AI context digest, are read from.

---

## The depth axis

`flow.stack` opens a depth axis; `flow.collect` closes it. Everything between them is the stack's
**body**, and `bridge/evaluator.ts` runs that body once per frame of the range.

Getting the body wrong is expensive in both directions and silent in both: too wide and a grade
outside the loop is recomputed 300 times, too narrow and a stage inside it is computed once and
smeared across every frame. So `resolveStackScope` states the rule precisely — reachable forward
from the stack, without crossing a collect — and the Collect node is _in_ the body, because
gathering that slice's result is its job.

Measured on the reference reel: **240 slices in 7.6 s**, four in flight at a time. The concurrency
limit is four rather than "one per core" because the engine's own thread pool is already using the
cores; the limit here keeps the request queue short so a cancel takes effect promptly and a long run
does not starve the interactive preview.

Three refusals, each with its own message:

- a stack with no Collect — its per-slice results have nowhere to go;
- a stack containing another stack — the canvas draws one depth axis;
- a stack with nothing wired — nothing to iterate.

Runs are capped at 240 slices and the overflow is reported, never dropped quietly. A run in progress
can be cancelled, and the slices already finished are kept.

---

## Four things the parity test caught

Each of these was invisible to type-checking, invisible to review, and would have been invisible in
use — the output would simply have been slightly the wrong film.

**The default colour tone was wrong.** `Neutral_Desaturated` where the original had
`Neutral_Saturated`. Every preset that does not state a colour tone inherits it, so a whole class of
cards was quietly grading itself down. The rules parity test never saw it, because generated
configurations always state every field; only applying the presets exposed it.

**Preset terms were being cast rather than resolved.** Presets are hand-written and say `Wide_Shot`,
`Slow_Dolly`, `Muted`; the vocabulary says `WS`, `Dolly`, `Neutral_Desaturated`. The first
implementation cast them straight through, so those fields silently held values no rule could ever
match. The fix is 30 movement aliases pointing at three different config fields, plus
`PRESET_FALLBACK_*` warnings for anything still unresolved — extracted from the original engine by
AST rather than transcribed, because a mapping table loses an entry the moment it is retyped.

**Camera manufacturers came from the wrong place.** With no manufacturer field on a preset, the
default was inherited — so every _Blade Runner_ prompt read "shot on ARRI Panavision_Panaflex". A
body-to-manufacturer table fixes it, and the prompt now reads what was actually on set.

**Python prints `2.0` where JavaScript prints `2`.** One character, in the anamorphic squeeze of the
detailed prompt. Caught in the first prompt comparison, and preserved rather than corrected — "2.0x
anamorphic" is also simply the more legible of the two.

### One deviation, made explicit

The original never derives `is_anamorphic` from the lens family, so eight presets specifying
`Vintage_Anamorphic` come back marked spherical: the prompt omits the word, and `LA_ANAMORPHIC_INFO`
never reminds anyone to de-squeeze. Correcting that inside `applyFilmPreset` would make the parity
test fail, and **a parity test relaxed to accommodate an improvement no longer verifies anything**.
So `applyFilmPreset` stays faithful and `withAnamorphicFlag` corrects it as a separate, named,
separately tested step that the library applies to the cards it builds.

---

## Status

Runnable and driven end to end.

- **`deno task verify`** — 168 tests, strict type-check, codegen freshness across five generated
  artefacts.
- **`deno task runtime`** — 32 checks against the live page in Chrome.
- **`tests/cinema_parity_test.ts`** — 855 configurations and 110 presets agree with the Python
  original on rules, on validation and on 11 prompt dialects.
- **ArchiveRestorer's `smoke_test.py`** — 50/50.

Working in the browser: the four reference shelves load and a card drops onto the canvas as a
`ref.card` with its id already set; node cards carry every parameter with the engine's own ranges,
units and defaults; wire validation refuses a cycle _during_ the drag with the message that names
the alternative; Preview compiles a chain to one engine call and paints the result onto the card
that produced it; a Z Stack runs its body across a frame range and fills the depth strip; a paid run
is refused with its count and cost until it is confirmed, and a local run is not gated at all.

The generation half runs **with no Python present at all**. `./start.sh` with no engine starts the
canvas, serves all 160 references, and says which half is missing.

What is still **not** built:

- **The generate nodes are declared and gated, not executed.** `core/providers.ts` prices a run,
  `consentCovers` decides whether it may happen, and `/estimate` enforces both — but the provider
  clients that would make the HTTP call are not written. This is the next piece of work, and it is
  now the _only_ thing between a wired graph and a generated image. The gate was built first
  deliberately: an execution path that arrives before its consent flow is an execution path that
  ships without one.
- **The restoration pixel work is still Python.** TypeScript has no OpenCV and no muxer. The schema
  is vendored and the node types generate without it, but stabilisation, deflicker, dust repair,
  optical-flow synthesis, segmentation and H.264 export all still run in `ArchiveRestorer/backend`.
  Porting them means either an OpenCV WASM build or driving `ffmpeg` as a subprocess, stage by
  stage; nothing here pretends otherwise, and no stage returns wrong pixels in the meantime because
  none of them returns pixels at all without the engine.
- **`ref.blend` and `ref.shot` are node types without evaluators.** Their ports and contracts are
  defined and registered; `mergeGrants` implements the semantics and is tested. Wiring them into
  `bridge/evaluator.ts` is outstanding.
- **`flow.collect` does not yet feed a render.** The collected sequence is held in the strip, not
  handed to `out.render` for encoding. Export the finished film from Desk.
- **No split-wipe in the Blueprint Viewer.** Desk already has Rst/Src/Split; the graph `compare`
  input is wired but the wipe itself is not drawn on the node card.
- **The Home page still has its own left panel.** The Refs shelf was added to the Workshop only.

Graphs, tags and Desk params persist on disk: Blueprint writes `workspace/<id>/graph.json`; Home
tags and favourites live in `project.json`; Desk sliders debounce to `POST /api/project/params`.
localStorage remains a fallback if the engine is down.

Open questions and the cost each decision accepted are recorded in
[`docs/DEBATE.md`](docs/DEBATE.md#consensus-and-what-it-costs); what came from the Next.js donor and
what was deliberately left behind is in [`docs/MERGE_PLAN.md`](docs/MERGE_PLAN.md).
