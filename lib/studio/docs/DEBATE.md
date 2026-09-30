# Phase 2 — Agent Review of the Phase 1 Primitives

Five reviews of the same code, each from one position. Where they disagreed, the resolution and its
cost are recorded. Where a review changed the code, the change is named.

---

## The disagreement that had to be settled first

**[AGENT-DESIGNER]** opened by reading the brief's own Axiom 1 back to it.

> Gall's Law is Axiom 1, and Phase 1 says "build minimal, dependency-free primitives from scratch".
> Those instructions are in tension. The complex system that already works is on this disk:
> ArchiveRestorer is 17,188 lines of tested OpenCV with a stabiliser that takes frame-to-frame
> jitter from 7.3px to 0.85px, a flag probe that measures whether a rebuild is worth attempting, and
> an export path with three specific failure modes already found and fixed. Writing a new synthesis
> engine from scratch is not Gall's Law. It is the thing Gall's Law warns about.

**[AGENT-VOCABULARY]** agreed and sharpened it: the restoration parameters already have a single
source of truth in `shared/controls.json`, which the Deno UI generates its sliders from and the
Python engine validates against. A hand-written set of node ports would be a _third_ copy of that
knowledge.

**Resolution.** WIV is the node layer; ArchiveRestorer is the engine. The `stage.*` node types are
**generated** from `controls.json`, and their default values are read out of
`pipeline.DEFAULT_PARAMS` by running the engine. Neither file is transcribed.
`deno task codegen --check` fails the build if the generated output drifts from either source.

**Cost, stated plainly.** WIV cannot run without ArchiveRestorer present. That is a real coupling
and it was chosen deliberately: the alternative was a second implementation of the same colour
science, and two implementations of colour science is how a restoration tool starts producing two
different answers.

---

## [AGENT-DESIGNER] — spatial and visual

**Challenged: the Three.js requirement.** The brief names Three.js. The canvas is a blueprint, and
under a perspective camera every node card gets a different scale and a trapezoidal footprint —
hit-testing needs an inverse projection per card, text needs re-rasterising per depth, and a
straight wire between two nodes stops being a straight line on screen.

**Resolved** to cabinet oblique projection (`core/spatial.ts`). X and Y stay screen-parallel; depth
contributes a fixed 2D offset per unit. Depth reads as _offset, scale-down and dimming_ — the
CD-carousel read — with no foreshortening. `projectSlice` returns a plain 2×3 affine that Canvas2D,
SVG and a Three.js `Object3D.matrix` all accept, so adopting Three.js later replaces the renderer
without touching the layout. Three.js earns its place when footage is drawn as textured quads with
per-slice shaders; it does not earn its place to translate a rectangle.

**Found a bug in its own colour rule.** The brief specifies "+15% luminance shift" per elevation.
The first implementation read that as a 15% lerp toward white, which turns the `#0d0d11` canvas into
`#313135` at elevation 1 — a 3.8× luminance jump for what is meant to be a hover, with the whole
ramp in mid-grey by elevation 2 and the dark baseline gone. Pure scaling fails the other way:
`× 1.15` gives `#0f0f14`, a two-level change nobody can see.

**Resolved** to `max(value × 15%, 10 levels)` compounded per step, giving
`#0d0d11 → #17171b → #212125 → #2b2b2f`. The floor keeps steps visible at the black end; the
relative term keeps them proportionate higher up.

_This was caught because `core/tokens.ts` generates the stylesheet rather than describing it — the
wrong values were visible as hex._ Tests now pin both ends: a step must be at least 8 levels and at
most 20.

**Ruled on filtered-out elements.** `filter-out` dims to 0.34; it never hides. Removing filtered
nodes would change the _layout_, and a graph whose geometry shifts when you type in a search box
destroys the spatial memory that is the entire reason for putting a pipeline on a plane.
`FilterState` is three-valued, not boolean, because "no filter active" and "failed the active
filter" must not look identical — that is precisely when the user needs to be told the difference.

---

## [AGENT-VOCABULARY] — naming and schema

**Rejected `differenceA` / `differenceB` as "left" and "right".** Left and right depend on how the
diagram happens to be drawn. A saved project whose meaning inverts because someone flipped a layout
is a data-loss bug. The names state which operand _survives_.

**Caught a conceptual error in the Venn documentation.** The first draft described the canonical
pairing as `A = the whole frame, B = the subject`, and read the four modes as everything / subject /
background / subject. Three of those are right. The fourth is not: if A covers every pixel then
`B \ A = B ∩ ¬A = 0`, so "subject only" returns empty, always.

**Resolved** by documenting the correct pairing (two _independent_ mattes), stating the degenerate
case explicitly, and adding `describePairing()`, which _measures_ coverage and reports which modes
are meaningful for the mattes actually wired — because a matte that should be a subject can come
back covering the frame when segmentation fails, and that failure is indistinguishable from a
deliberate whole-frame operand until someone looks at the numbers. The mode labels were rewritten
from "Subject only" to "B without A" with the degeneracy named in the description.

**Forced a direction onto port lookup.** `NodeRegistry.port(type, id)` returned the first match
across inputs and outputs. Nearly every image node names both `image`, so the source end of a wire
resolved to an _input_ port and every legal connection was refused with "a wire runs from an output
to an input". `port()` now requires a `PortDirection`. The whole-project test suite failed loudly on
this; it would have presented in the UI as "connections do not work".

**Standing rules, enforced by tests:** every port has non-empty help text; every `Number` port
declares a range; every `Enum` port declares options; every default sits inside its own domain; port
ids are unique within a node.

---

## [AGENT-SECURITY] — bounds and blast radius

**Split node cost into `local` / `filesystem` / `network`.** Without that split, auto-evaluating the
graph on edit fires a paid generative call on every pointer-move of a slider. `local` nodes may
re-run freely on canvas edit; `network` nodes require an explicit request. A test asserts no
`stage.*` node is ever marked `network`.

**Required that every numeric value crossing into the engine be clamped against the range the engine
itself declares** — which is guaranteed, because both sides read that range from `controls.json`. A
CLAHE `tile_grid` of 0 is a division by zero inside native code, not a Python exception.

**Argued clamping should be a hard rejection.** **[AGENT-TESTER]** objected: a slider that silently
refuses to render is worse than one that renders at its limit and says so. **Resolved** — clamp, and
emit a warning diagnostic naming the value and the bound.

**Bounded every loop that touches user geometry.** `resolveCollisions` takes a `maxPasses` and
returns the last position rather than spinning on a pathological cluster. `visibleSlices` drops
slices beyond `maxVisibleDepth` in the _geometry_, not the renderer, so a 4000-slice stack costs
exactly what a 12-slice one costs — asserted by test. `nodeDigest` marks in-progress nodes so a
corrupt cyclic document terminates instead of recursing forever.

**Wrote down what the hash is not.** FNV-1a in `core/hash.ts` is not cryptographic. It dedupes
locally-produced buffers and nothing grants trust on a hash match. The comment says so, and says
what would have to change (SHA-256) if that ever stopped being true.

**On the new engine routes:** base64 mattes are length-checked before decode, `cv2.imdecode`
returning `None` is a 422 rather than a crash, and a matte whose resolution disagrees with the frame
is refused outright — silently processing the overlap would produce a matte subtly wrong everywhere.

---

## [AGENT-TESTER] — usability across profiles

**Rejected the first cycle-refusal message.** "Cycle detected" tells a user what the algorithm
noticed, not what to do. The message now names the alternative: _"Iteration belongs on the Z axis —
put these nodes in a stack instead."_ There are no loop edges in this graph by design, because a
loop edge is a cycle; depth **is** the loop.

**Rejected refusing to render a stage with no temporal neighbourhood.** Every stage that reads
neighbours degrades to single-frame behaviour when it has none — deflicker matches a window of one,
temporal fusion averages nothing. It still produces a frame. What it does not do is the thing the
user asked for. **Resolved:** a missing `Sequence` input is a _warning_ that names the consequence
("its temporal settings will have no effect"), not an error. Two tests pin this.

**Found the check that could be evaded.** Required-input validation ran inside the step-emission
loop, which `continue`s past nodes absorbed into an earlier node's stage run — and an absorbed node
is exactly where an unsatisfied input hides: the head of a collapsed chain has no image source, the
chain still compiles to one call, and the engine is asked to process a frame nobody named.
**Resolved:** validation is now a separate pass over every node.

**On "every option is one click away":** `NodeRegistry.producersFor(kind)` is the mechanism. Drop a
wire on empty canvas and the palette that opens is already filtered to nodes that could legally
receive it. Mobile gets this as a drawer, desktop as an inline palette; both read the same filtered
list, so the two cannot offer different options.

**Deferred, and named as deferred:** touch targets, drawer behaviour and the responsive breakpoints
are not implemented. The primitives are display-agnostic by construction — `fitToViewport` takes a
viewport and returns pan and zoom, so it serves a phone and a 32" display without branching — but no
view layer exists yet to test.

---

## [AGENT-MEMORY] — lineage and digesting

**Established copy-on-write as the default, not an optimisation.** A restoration graph is mostly
nodes that change nothing on most frames: a muted stage, a grade whose section does not cover this
frame, a defect repair that found no defects. Eagerly copying a 4K frame through twelve such stages
is 400MB of allocation to produce twelve identical images. `derive()` returns the parent's payload
when an operation reports no change; the _history entry is still written_, so provenance stays
complete and only the pixels are shared.

**Set the eviction policy and defended each exemption.** Sources are never evicted — nothing can
regenerate a frame read from disk, and the extraction may have been decimated. Leaves are never
evicted — a buffer with no descendants is on screen or awaiting export. Recently-read buffers are
never evicted — `hits > 0` means it is in the working set and eviction guarantees an immediate
recompute. What remains is interior, cold, and rebuildable.

**Required that digesting keep the lineage.** When a buffer's pixels are dropped, its parents and
its `Operation` survive, so `replayPlan()` can rebuild it. `replayPlan` throws if the chain reaches
a digested buffer whose own parents are gone — a state the current policy cannot produce, checked so
that a future policy change fails loudly rather than silently losing a frame.

**Aligned the vocabulary with the engine.** `Actor` is `user | ai | system`, spelled exactly as
`backend/memory.py` spells it, and provenance colours reuse the restorer's existing hues — cyan for
the user, violet for the model. A person moving between the grading desk and the blueprint canvas
should not have to learn a second colour language for the same idea.

**Ruled on what invalidates a cache entry.** `nodeDigest` folds in node type, values, mute state,
slice index and every upstream digest. It excludes **position** — dragging a card across the canvas
must not invalidate a two-minute render. Both halves are asserted by test.

---

## Consensus, and what it costs

| Decision                                                      | Carried              | Cost accepted                                            |
| ------------------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| WIV is a node layer over the existing engine                  | Designer, Vocabulary | WIV cannot run standalone                                |
| Cabinet oblique, not a perspective camera                     | Designer             | No true 3D until the renderer is replaced                |
| Stage nodes generated from `controls.json` + `DEFAULT_PARAMS` | Vocabulary           | Codegen needs the engine's venv, or a committed snapshot |
| Clamp-and-warn, not reject                                    | Tester over Security | An out-of-range value still renders, at its bound        |
| Missing neighbours warns, does not block                      | Tester               | A degraded stage renders; the warning must be read       |
| `min`/`max` set operators, not multiply                       | Designer             | The four regions do not partition on a soft matte        |
| Depth is the only iteration primitive                         | Tester, Security     | No feedback loops, at all, ever                          |

### Open, and honestly open

- **Network steps compile but do not execute.** Counted and surfaced so a consent flow can gate
  them; that flow does not exist. Deliberate: a 240-slice stack run would otherwise fire 240 paid
  generative calls from one click.
- **No persistence.** The graph lives in memory; reloading reseeds it.
- **`flow.collect` does not yet feed `out.render`.** The collected sequence fills the depth strip
  but is not handed to the encoder.
- **The four-region coverage readout must never be drawn as a pie.** The Zadeh operators are not
  additive — at `a = b = 0.5` all four regions measure 0.5 against a union of 0.5. A test pins the
  property; no UI reads it yet.

---

## Round 2 — after the canvas was built and driven

The view layer went in, and five of these reviews were settled by running the thing rather than by
arguing about it.

**[AGENT-DESIGNER] was wrong about port size, and a drag proved it.** A 9px socket is the right
visual weight and an unhittable target: the first attempt to drag a wire missed and panned the
canvas instead. Sockets now carry a 30px invisible catchment with the drawn dot unchanged. Nothing
in the type system could have caught this; only a pointer could.

**Three defects only rendering could reveal.** `#empty-hint` — an id selector — outranked
`[hidden]`, so the empty-state message sat over a populated canvas. _Fit_ centred the graph behind
the depth strip, because the strip is an overlay and `clientHeight` still counts the band it covers.
The carousel transform compensated for an origin `projectSlice` had already applied, cancelling the
depth offset and bunching every slice on top of the focus.

**[AGENT-VOCABULARY] caught a message aimed at the wrong node.** The "runs on this frame alone, so
its temporal settings will have no effect" warning was keyed on the _kind_ `Sequence`, so a Z Stack
with nothing wired was told its temporal settings were inert — when the real problem is that it has
nothing to iterate at all. The warning is now keyed on the `neighbours` _port_, which is the one
port meaning "optional temporal context". Every other Sequence input is structural, and unsatisfied
is an error.

**[AGENT-VOCABULARY] also found the two front-ends disagreeing about a number.**
`stabilize.crop_ratio` carries `scale: 100` in `controls.json`: the engine holds a fraction and its
own UI shows a percentage. WIV was showing `0.04%` where the grading desk shows `4%`. `displayScale`
now flows through codegen, with a test asserting the wire still carries the raw `0.04` — only the
display is scaled.

**[AGENT-TESTER] rejected the first stack-result attribution.** The picture was pinned to the last
node of the body, which is a `flow.collect` — a node that issues no engine call. The stage that
actually produced the frame stayed blank while a node that computed nothing displayed its output.
Results are now recorded against their real producer and propagated only to _display_ nodes.

**[AGENT-SECURITY] set the depth-loop budget.** Concurrency four, not one per core: the engine's own
thread pool already has the cores, and the limit here exists to keep the request queue short so a
cancel lands promptly and a long run cannot starve the interactive preview. Runs cap at 240 slices
with the overflow reported rather than dropped.

**A discipline that paid for itself.** `core/tokens.ts` _generates_ the stylesheet instead of
describing it, so a wrong elevation ramp was visible as hex before anything was drawn.
`check_runtime.ts` now does the equivalent for the page: it drives the real UI in Chrome and asserts
it against its own claims — that every id exists, that the seeded graph compiles, that an illegal
wire is refused with a reason, and that filtering dims without moving the layout.
