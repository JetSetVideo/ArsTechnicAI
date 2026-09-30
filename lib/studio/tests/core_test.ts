/**
 * core_test.ts — Phase 4 verification.
 *
 * These tests assert the *claims made in the comments*, not just that the code
 * runs. Where a module says "this operator was chosen over that one because
 * the alternative eats the feather", there is a test that fails if the
 * alternative is ever substituted back in.
 */

import { assert, assertAlmostEquals, assertEquals, assertThrows } from "jsr:@std/assert@1";

import { canonicalise, digest, fnv1a64 } from "../core/hash.ts";
import {
  applyAffine,
  boundingRect,
  DEFAULT_DEPTH_STYLE,
  fitToViewport,
  invertAffine,
  projectSlice,
  rectsOverlap,
  resolveCollisions,
  rollFocus,
  snapPoint,
  vec2,
  visibleSlices,
} from "../core/spatial.ts";
import {
  checkConnection,
  clampToRange,
  displayValue,
  kindAccepts,
  type PortSpec,
  storedValue,
} from "../core/ports.ts";
import {
  addNode,
  connect,
  emptyGraph,
  type GraphDocument,
  nodeDigest,
  type NodeInstance,
  removeNode,
  topologicalOrder,
  wouldCreateCycle,
} from "../core/graph.ts";
import { asGraphId, asNodeId, asNodeTypeId, asPortId } from "../core/ids.ts";
import {
  combineMasks,
  coverageFraction,
  describePairing,
  propagate,
  regionFractions,
} from "../core/venn.ts";
import { LineageStore } from "../core/lineage.ts";
import { elevate, filterState, inferTypeRole, parseHex, surface } from "../core/tokens.ts";
import { NodeRegistry } from "../core/registry.ts";
import { buildRegistry } from "../core/catalogue.ts";
import { STAGE_NODES, STAGE_ORDER } from "../gen/stage_nodes.ts";
import { applyStageParamsToGraph, compileGraph } from "../bridge/engine.ts";

// ===========================================================================
// hash
// ===========================================================================

Deno.test("canonicalise: key order does not change the result", () => {
  assertEquals(canonicalise({ a: 1, b: 2 }), canonicalise({ b: 2, a: 1 }));
  assertEquals(digest({ x: [1, 2], y: "z" }), digest({ y: "z", x: [1, 2] }));
});

Deno.test("canonicalise: float dust does not create a second cache entry", () => {
  assertEquals(canonicalise({ v: 0.1 + 0.2 }), canonicalise({ v: 0.3 }));
});

Deno.test("canonicalise: undefined members are dropped, null is kept", () => {
  assertEquals(canonicalise({ a: 1, b: undefined }), canonicalise({ a: 1 }));
  assert(canonicalise({ a: null }) !== canonicalise({}));
});

Deno.test("fnv1a64: distinct inputs, distinct digests; stable across calls", () => {
  assertEquals(fnv1a64("abc"), fnv1a64("abc"));
  assert(fnv1a64("abc") !== fnv1a64("abd"));
  assertEquals(fnv1a64("").length, 16);
});

Deno.test("fnv1a64: high code points do not alias onto their low byte", () => {
  // Both bytes of each UTF-16 unit are folded, so U+0141 must not hash as U+0041.
  assert(fnv1a64("Ł") !== fnv1a64("A"));
});

Deno.test("digest: domains are separated", () => {
  assert(digest({ v: 1 }, "node") !== digest({ v: 1 }, "buffer"));
});

// ===========================================================================
// spatial
// ===========================================================================

Deno.test("snapPoint: quantises to the grid", () => {
  assertEquals(snapPoint(vec2(13, 19)), vec2(16, 16));
  assertEquals(snapPoint(vec2(-3, -5)), vec2(-0, -8));
});

Deno.test("resolveCollisions: separates overlapping cards", () => {
  const fixed = [{ x: 0, y: 0, w: 100, h: 100 }];
  const moved = resolveCollisions({ x: 20, y: 20, w: 100, h: 100 }, fixed, { gap: 8, grid: null });
  assert(!rectsOverlap(moved, fixed[0]!, 8), "cards still overlap after resolution");
});

Deno.test("resolveCollisions: takes the shortest escape, so a card slides", () => {
  // Overlapping mostly on the right edge: the cheapest exit is rightward.
  const fixed = [{ x: 0, y: 0, w: 100, h: 100 }];
  const moved = resolveCollisions({ x: 90, y: 10, w: 100, h: 100 }, fixed, { gap: 0, grid: null });
  assertEquals(moved.x, 100, "should have been pushed right, not wrapped around");
  assertEquals(moved.y, 10, "vertical position should be untouched");
});

Deno.test("resolveCollisions: terminates on a pathological cluster", () => {
  // Twenty cards stacked on the same spot cannot all be resolved; the loop
  // must still return rather than spin.
  const fixed = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i, w: 100, h: 100 }));
  const moved = resolveCollisions({ x: 5, y: 5, w: 100, h: 100 }, fixed, { maxPasses: 4 });
  assert(Number.isFinite(moved.x) && Number.isFinite(moved.y));
});

Deno.test("boundingRect / fitToViewport: frames a selection into the viewport", () => {
  const rects = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 200, w: 100, h: 100 }];
  assertEquals(boundingRect(rects), { x: 0, y: 0, w: 400, h: 300 });
  const { zoom } = fitToViewport(rects, { w: 800, h: 600 }, { padding: 0 });
  assertAlmostEquals(zoom, 2.0, 1e-9);
  assertEquals(fitToViewport([], { w: 800, h: 600 }).zoom, 1);
});

Deno.test("projectSlice: the focused slice is the identity and takes pointer events", () => {
  const s = projectSlice(0, vec2(100, 100));
  assertEquals(s.transform, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  assertEquals(s.opacity, 1);
  assert(s.interactive);
});

Deno.test("projectSlice: a stack shrinks toward its own origin, not the canvas origin", () => {
  // The claim in spatial.ts: without the (1-scale)·origin term a distant stack
  // would drift across the screen as it recedes. Assert the origin is fixed
  // once the depth translation is removed.
  const origin = vec2(4000, 3000);
  const style = { ...DEFAULT_DEPTH_STYLE, stepPx: 0 };
  for (const depth of [1, 3, 7]) {
    const { transform } = projectSlice(depth, origin, style);
    const mapped = applyAffine(transform, origin);
    assertAlmostEquals(mapped.x, origin.x, 1e-9);
    assertAlmostEquals(mapped.y, origin.y, 1e-9);
  }
});

Deno.test("projectSlice: only the focused slice is interactive", () => {
  assert(!projectSlice(1, vec2(0, 0)).interactive);
  assert(!projectSlice(-1, vec2(0, 0)).interactive);
});

Deno.test("invertAffine: round-trips a slice transform, and refuses a singular one", () => {
  const { transform } = projectSlice(3, vec2(120, 80));
  const inverse = invertAffine(transform)!;
  const p = vec2(37, 91);
  const back = applyAffine(inverse, applyAffine(transform, p));
  assertAlmostEquals(back.x, p.x, 1e-9);
  assertAlmostEquals(back.y, p.y, 1e-9);
  assertEquals(invertAffine({ a: 0, b: 0, c: 0, d: 0, e: 1, f: 1 }), null);
});

Deno.test("rollFocus: wrapping backwards past zero stays in range", () => {
  // JavaScript's % keeps the dividend's sign; a naive implementation returns -1.
  const spec = { sliceCount: 10, focusIndex: 0, wrap: true };
  assertEquals(rollFocus(spec, -1).focusIndex, 9);
  assertEquals(rollFocus(spec, -25).focusIndex, 5);
  assertEquals(rollFocus({ ...spec, focusIndex: 9 }, 1).focusIndex, 0);
});

Deno.test("rollFocus: without wrap, focus clamps at the ends", () => {
  const spec = { sliceCount: 10, focusIndex: 0, wrap: false };
  assertEquals(rollFocus(spec, -5).focusIndex, 0);
  assertEquals(rollFocus(spec, 999).focusIndex, 9);
});

Deno.test("visibleSlices: a huge stack costs the same to draw as a small one", () => {
  const huge = visibleSlices({ sliceCount: 4000, focusIndex: 2000, wrap: false }, vec2(0, 0));
  const small = visibleSlices({ sliceCount: 17, focusIndex: 8, wrap: false }, vec2(0, 0));
  assertEquals(huge.length, DEFAULT_DEPTH_STYLE.maxVisibleDepth * 2 + 1);
  assertEquals(small.length, DEFAULT_DEPTH_STYLE.maxVisibleDepth * 2 + 1);
});

Deno.test("visibleSlices: painted back-to-front, focus last", () => {
  const slices = visibleSlices({ sliceCount: 9, focusIndex: 4, wrap: false }, vec2(0, 0));
  assertEquals(slices.at(-1)!.relativeDepth, 0, "focused slice must be painted last");
  for (let i = 1; i < slices.length; i++) {
    assert(
      Math.abs(slices[i]!.relativeDepth) <= Math.abs(slices[i - 1]!.relativeDepth),
      "slices must be ordered furthest-first",
    );
  }
});

// ===========================================================================
// ports
// ===========================================================================

Deno.test("kindAccepts: Image widens to Sequence, but Sequence never narrows", () => {
  assert(kindAccepts("Sequence", "Image"));
  assert(!kindAccepts("Image", "Sequence"));
});

Deno.test("kindAccepts: Mask is not an Image even though both are pixels", () => {
  assert(!kindAccepts("Image", "Mask"));
  assert(!kindAccepts("Mask", "Image"));
});

const port = (over: Partial<PortSpec>): PortSpec => ({
  id: asPortId("p"),
  label: "P",
  direction: "output",
  kind: "Image",
  help: "test",
  ...over,
});

Deno.test("checkConnection: refuses each malformed wire with its own reason", () => {
  const out = port({ direction: "output", kind: "Image" });
  const inp = port({ direction: "input", kind: "Image" });
  const n1 = asNodeId("n1");
  const n2 = asNodeId("n2");

  assertEquals(
    checkConnection({ node: n1, port: out }, { node: n1, port: inp, occupied: false })?.reason,
    "same-node",
  );
  assertEquals(
    checkConnection({ node: n1, port: inp }, { node: n2, port: inp, occupied: false })?.reason,
    "direction-mismatch",
  );
  assertEquals(
    checkConnection(
      { node: n1, port: out },
      { node: n2, port: port({ direction: "input", kind: "Mask" }), occupied: false },
    )?.reason,
    "kind-mismatch",
  );
  assertEquals(
    checkConnection(
      { node: n1, port: port({ direction: "output", kind: "Sequence" }) },
      { node: n2, port: inp, occupied: false },
    )?.message,
    "A reel cannot feed a single-frame input. Wire it through Frame Selection.",
  );
  assertEquals(
    checkConnection({ node: n1, port: out }, { node: n2, port: inp, occupied: true })?.reason,
    "input-occupied",
  );
  assertEquals(
    checkConnection({ node: n1, port: out }, { node: n2, port: inp, occupied: false }),
    null,
  );
});

Deno.test("checkConnection: a variadic input accepts a second wire", () => {
  const out = port({ direction: "output", kind: "Image" });
  const inp = port({ direction: "input", kind: "Image", variadic: true });
  assertEquals(
    checkConnection(
      { node: asNodeId("n1"), port: out },
      { node: asNodeId("n2"), port: inp, occupied: true },
    ),
    null,
  );
});

Deno.test("clampToRange: snaps relative to min, so an offset range cannot overshoot", () => {
  const range = { min: 0.5, max: 0.95, step: 0.01 };
  assertEquals(clampToRange(0.9512, range), 0.95);
  assertEquals(clampToRange(2, range), 0.95);
  assertEquals(clampToRange(-1, range), 0.5);
  assertEquals(clampToRange(NaN, range), 0.5);
  // Every snapped value must be reachable from min in whole steps.
  for (const raw of [0.503, 0.617, 0.888]) {
    const v = clampToRange(raw, range);
    assertAlmostEquals(((v - range.min) / range.step) % 1, 0, 1e-6);
  }
});

Deno.test("clampToRange: a continuous port (step 0) is not quantised", () => {
  assertEquals(clampToRange(0.12345, { min: 0, max: 1, step: 0 }), 0.12345);
});

// ===========================================================================
// graph
// ===========================================================================

const mkNode = (id: string, type = "stage.clahe"): NodeInstance => ({
  id: asNodeId(id),
  type: asNodeTypeId(type),
  name: id,
  position: vec2(0, 0),
  size: { w: 200, h: 100 },
  values: {},
  authoredBy: {},
  state: "idle",
  revision: 0,
  collapsed: false,
});

/** A graph already bound to a project, typed so `projectId` stays nullable. */
function boundGraph(projectId: string): GraphDocument {
  return { ...emptyGraph(asGraphId("g")), projectId };
}

function chainGraph(count: number) {
  let g = emptyGraph(asGraphId("g"));
  for (let i = 0; i < count; i++) g = addNode(g, mkNode(`n${i}`));
  for (let i = 1; i < count; i++) {
    const r = connect(
      g,
      { node: asNodeId(`n${i - 1}`), port: asPortId("image") },
      { node: asNodeId(`n${i}`), port: asPortId("image") },
      (_n, p, d) => port({ id: p, direction: d, kind: "Image" }),
    );
    // The resolver above reports both endpoints as outputs, so use a direction-aware one.
    g = "edge" in r ? r.graph : g;
  }
  return g;
}

Deno.test("topologicalOrder: a chain orders every node after its source", () => {
  let g = emptyGraph(asGraphId("g"));
  for (const id of ["a", "b", "c"]) g = addNode(g, mkNode(id));
  const resolver = (_n: unknown, p: string, d: "input" | "output") =>
    port({ id: asPortId(p), direction: d, kind: "Image" });

  const ab = connect(
    g,
    { node: asNodeId("a"), port: asPortId("out") },
    { node: asNodeId("b"), port: asPortId("in") },
    (n, p, d) => resolver(n, p, d),
  );
  assert("edge" in ab, "a→b should connect");
  g = ab.graph;
  const bc = connect(
    g,
    { node: asNodeId("b"), port: asPortId("out") },
    { node: asNodeId("c"), port: asPortId("in") },
    (n, p, d) => resolver(n, p, d),
  );
  assert("edge" in bc, "b→c should connect");
  g = bc.graph;

  const topo = topologicalOrder(g);
  assert(topo.ok);
  assertEquals(topo.order, [asNodeId("a"), asNodeId("b"), asNodeId("c")]);
  assertEquals(topo.waves.length, 3, "a strict chain has one node per wave");
});

Deno.test("topologicalOrder: independent nodes share one wave", () => {
  let g = emptyGraph(asGraphId("g"));
  for (const id of ["a", "b", "c"]) g = addNode(g, mkNode(id));
  const topo = topologicalOrder(g);
  assert(topo.ok);
  assertEquals(topo.waves.length, 1);
  assertEquals(topo.waves[0]!.length, 3);
});

Deno.test("topologicalOrder: two wires between the same pair are one dependency", () => {
  // Counting edges instead of distinct source nodes would deadlock here.
  let g = emptyGraph(asGraphId("g"));
  g = addNode(g, mkNode("a"));
  g = addNode(g, mkNode("b"));
  const resolver = (_n: unknown, p: string, d: "input" | "output") =>
    port({ id: asPortId(p), direction: d, kind: "Image" });

  for (const [from, to] of [["o1", "i1"], ["o2", "i2"]]) {
    const r = connect(
      g,
      { node: asNodeId("a"), port: asPortId(from!) },
      { node: asNodeId("b"), port: asPortId(to!) },
      (n, p, d) => resolver(n, p, d),
    );
    assert("edge" in r);
    g = r.graph;
  }
  const topo = topologicalOrder(g);
  assert(topo.ok, "two wires between one pair must not deadlock the sort");
  assertEquals(topo.order.length, 2);
});

Deno.test("wouldCreateCycle: detects a would-be loop before the wire exists", () => {
  let g = emptyGraph(asGraphId("g"));
  g = addNode(g, mkNode("a"));
  g = addNode(g, mkNode("b"));
  const r = connect(
    g,
    { node: asNodeId("a"), port: asPortId("o") },
    { node: asNodeId("b"), port: asPortId("i") },
    (_n, p, d) => port({ id: p, direction: d, kind: "Image" }),
  );
  assert("edge" in r);
  g = r.graph;

  assert(wouldCreateCycle(g, asNodeId("b"), asNodeId("a")), "b→a would close the loop");
  assert(!wouldCreateCycle(g, asNodeId("a"), asNodeId("b")));
  assert(wouldCreateCycle(g, asNodeId("a"), asNodeId("a")), "self-connection is a cycle");
});

Deno.test("connect: refuses a cycle and says depth is the alternative", () => {
  let g = emptyGraph(asGraphId("g"));
  g = addNode(g, mkNode("a"));
  g = addNode(g, mkNode("b"));
  const resolver = (_n: unknown, p: string, d: "input" | "output") =>
    port({ id: asPortId(p), direction: d, kind: "Image" });
  const first = connect(
    g,
    { node: asNodeId("a"), port: asPortId("o") },
    { node: asNodeId("b"), port: asPortId("i") },
    (n, p, d) => resolver(n, p, d),
  );
  assert("edge" in first);
  const second = connect(
    first.graph,
    { node: asNodeId("b"), port: asPortId("o") },
    { node: asNodeId("a"), port: asPortId("i") },
    (n, p, d) => resolver(n, p, d),
  );
  assert("refusal" in second);
  assertEquals(second.refusal.reason, "would-cycle");
  assert(second.refusal.message.includes("Z axis"), "the refusal must point at the alternative");
});

Deno.test("removeNode: takes its wires with it, leaving no dangling edge", () => {
  let g = emptyGraph(asGraphId("g"));
  g = addNode(g, mkNode("a"));
  g = addNode(g, mkNode("b"));
  const r = connect(
    g,
    { node: asNodeId("a"), port: asPortId("o") },
    { node: asNodeId("b"), port: asPortId("i") },
    (_n, p, d) => port({ id: p, direction: d, kind: "Image" }),
  );
  assert("edge" in r);
  assertEquals(Object.keys(r.graph.edges).length, 1);
  const pruned = removeNode(r.graph, asNodeId("a"));
  assertEquals(Object.keys(pruned.edges).length, 0);
});

Deno.test("edits never mutate the document they are given", () => {
  const g = addNode(emptyGraph(asGraphId("g")), mkNode("a"));
  const before = JSON.stringify(g);
  addNode(g, mkNode("b"));
  removeNode(g, asNodeId("a"));
  assertEquals(JSON.stringify(g), before, "the original document was modified in place");
});

Deno.test("nodeDigest: position is excluded, parameters are not", () => {
  const base = addNode(emptyGraph(asGraphId("g")), mkNode("a"));
  const moved = addNode(
    emptyGraph(asGraphId("g")),
    { ...mkNode("a"), position: vec2(999, 999) },
  );
  assertEquals(
    nodeDigest(base, asNodeId("a")),
    nodeDigest(moved, asNodeId("a")),
    "dragging a card must not invalidate its render",
  );

  const changed = addNode(
    emptyGraph(asGraphId("g")),
    { ...mkNode("a"), values: { clip_limit: { kind: "Number", value: 3 } } },
  );
  assert(nodeDigest(base, asNodeId("a")) !== nodeDigest(changed, asNodeId("a")));
});

Deno.test("nodeDigest: an upstream change propagates downstream", () => {
  const build = (clip: number) => {
    let g = emptyGraph(asGraphId("g"));
    g = addNode(g, { ...mkNode("a"), values: { clip_limit: { kind: "Number", value: clip } } });
    g = addNode(g, mkNode("b"));
    const r = connect(
      g,
      { node: asNodeId("a"), port: asPortId("o") },
      { node: asNodeId("b"), port: asPortId("i") },
      (_n, p, d) => port({ id: p, direction: d, kind: "Image" }),
    );
    return "edge" in r ? r.graph : g;
  };
  assert(
    nodeDigest(build(2), asNodeId("b")) !== nodeDigest(build(3), asNodeId("b")),
    "changing a source must invalidate everything downstream of it",
  );
});

Deno.test("nodeDigest: terminates on a cyclic document rather than recursing forever", () => {
  // canConnect refuses cycles, but a hand-edited or corrupt file could carry one.
  const g = chainGraph(3);
  const cyclic = {
    ...g,
    edges: {
      ...g.edges,
      forced: {
        id: "forced" as never,
        from: { node: asNodeId("n2"), port: asPortId("image") },
        to: { node: asNodeId("n0"), port: asPortId("image") },
        order: 0,
      },
    },
  };
  const result = nodeDigest(cyclic, asNodeId("n0"));
  assertEquals(typeof result, "string");
});

// ===========================================================================
// venn
// ===========================================================================

Deno.test("propagate: the four regions agree with set theory at the corners", () => {
  const cases: ReadonlyArray<[number, number, number, number, number, number]> = [
    // a, b, union, intersection, A\B, B\A
    [0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0],
    [0, 1, 1, 0, 0, 1],
    [1, 1, 1, 1, 0, 0],
  ];
  for (const [a, b, u, i, da, db] of cases) {
    assertEquals(propagate("union", a, b), u, `union(${a},${b})`);
    assertEquals(propagate("intersection", a, b), i, `intersection(${a},${b})`);
    assertEquals(propagate("differenceA", a, b), da, `A\\B(${a},${b})`);
    assertEquals(propagate("differenceB", a, b), db, `B\\A(${a},${b})`);
  }
});

Deno.test("propagate: intersection is idempotent, which a·b would not be", () => {
  // The documented reason for min over multiply: min(a,a) === a preserves a
  // feathered edge, while a·a = 0.25 at a half-covered edge eats it.
  for (const v of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assertEquals(propagate("intersection", v, v), v);
    assertEquals(propagate("union", v, v), v);
  }
  assertAlmostEquals(propagate("intersection", 0.5, 0.5), 0.5, 1e-12);
});

Deno.test("propagate: A\\B equals A ∩ ¬B numerically, not just in prose", () => {
  for (const a of [0, 0.3, 0.7, 1]) {
    for (const b of [0, 0.3, 0.7, 1]) {
      assertAlmostEquals(
        propagate("differenceA", a, b),
        propagate("intersection", a, 1 - b),
        1e-12,
      );
    }
  }
});

Deno.test("propagate: clamps out-of-domain input rather than propagating it", () => {
  assertEquals(propagate("union", 5, -3), 1);
  assertEquals(propagate("intersection", NaN, 1), 0);
});

Deno.test("combineMasks: matches the scalar reference on every mode", () => {
  const a = new Uint8Array([0, 64, 128, 192, 255]);
  const b = new Uint8Array([255, 192, 128, 64, 0]);
  for (const mode of ["union", "intersection", "differenceA", "differenceB"] as const) {
    const bulk = combineMasks(mode, a, b);
    for (let i = 0; i < a.length; i++) {
      const reference = propagate(mode, a[i]! / 255, b[i]! / 255) * 255;
      assertAlmostEquals(bulk[i]!, reference, 1, `${mode} at sample ${i}`);
    }
  }
});

Deno.test("combineMasks: refuses mismatched resolutions instead of silently truncating", () => {
  assertThrows(
    () => combineMasks("union", new Uint8Array(4), new Uint8Array(8)),
    RangeError,
    "Mask sizes disagree",
  );
  assertThrows(
    () => combineMasks("union", new Uint8Array(4), new Uint8Array(4), new Uint8Array(2)),
    RangeError,
  );
});

Deno.test("coverageFraction: reports the share of frame a region selects", () => {
  const all = new Uint8Array([255, 255, 255, 255]);
  const half = new Uint8Array([255, 255, 0, 0]);
  assertAlmostEquals(coverageFraction("union", all, half), 1, 1e-9);
  assertAlmostEquals(coverageFraction("intersection", all, half), 0.5, 1e-9);
  assertAlmostEquals(coverageFraction("differenceA", all, half), 0.5, 1e-9);
  assertAlmostEquals(coverageFraction("differenceB", all, half), 0, 1e-9);
});

Deno.test("regionFractions: agrees with coverageFraction, in one pass", () => {
  const a = new Uint8Array([255, 128, 0, 64, 200]);
  const b = new Uint8Array([0, 128, 255, 200, 64]);
  const all = regionFractions(a, b);
  for (const mode of ["union", "intersection", "differenceA", "differenceB"] as const) {
    assertAlmostEquals(all[mode], coverageFraction(mode, a, b), 1e-9, mode);
  }
});

Deno.test("regionFractions: the regions partition the union for a crisp matte", () => {
  // |A∪B| = |A∩B| + |A\B| + |B\A| holds exactly when every sample is 0 or 255.
  const a = new Uint8Array([255, 255, 0, 0, 255, 0]);
  const b = new Uint8Array([255, 0, 255, 0, 0, 255]);
  const f = regionFractions(a, b);
  assertAlmostEquals(f.union, f.intersection + f.differenceA + f.differenceB, 1e-9);
});

Deno.test("regionFractions: a feathered matte does NOT partition, and that is correct", () => {
  // Zadeh min/max operators are not additive. At a = b = 0.5 every one of the
  // four regions measures 0.5, so they sum to 1.5 against a union of 0.5.
  // This is a property of fuzzy sets, not a bug: min/max were chosen over
  // multiply/probabilistic-sum precisely because they preserve a feathered
  // edge, and additivity is what that choice gives up.
  //
  // The UI consequence is load-bearing: the four coverage readouts on the
  // Region node must never be presented as a pie, and must not be expected to
  // total the union on any matte with a soft edge.
  const half = new Uint8Array([128, 128, 128, 128]);
  const f = regionFractions(half, half);
  assertAlmostEquals(f.union, 128 / 255, 1e-9);
  assertAlmostEquals(f.intersection, 128 / 255, 1e-9);
  assert(
    f.intersection + f.differenceA + f.differenceB > f.union + 0.1,
    "the fuzzy regions are expected to over-count; if this now partitions, the operators were changed",
  );
});

// ===========================================================================
// lineage
// ===========================================================================

const SHAPE = { width: 100, height: 100, channels: 3 };

Deno.test("LineageStore: identical sources deduplicate", () => {
  const store = new LineageStore();
  const a = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const b = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  assertEquals(a.id, b.id);
  assertEquals(store.stats().records, 1);
});

Deno.test("LineageStore: an unchanged operation costs no memory", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const before = store.stats().bytes;
  const derived = store.derive(
    [src.id],
    { op: "stage.clahe", node: asNodeId("n1"), params: {}, frame: 0 },
    "Image",
    SHAPE,
    false,
  );
  assert(derived.aliased, "a no-op stage must alias its parent");
  assertEquals(store.stats().bytes, before, "an aliased buffer must allocate nothing");
  assertEquals(derived.parents[0], src.id, "the lineage record survives the aliasing");
});

Deno.test("LineageStore: a changed operation does allocate", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const before = store.stats().bytes;
  store.derive(
    [src.id],
    { op: "stage.clahe", node: asNodeId("n1"), params: { clip: 2 }, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  assertEquals(store.stats().bytes, before + 100 * 100 * 3);
});

Deno.test("LineageStore: two branches computing the same thing share one buffer", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const op = { op: "stage.clahe", node: asNodeId("n1"), params: { clip: 2 }, frame: 0 };
  const first = store.derive([src.id], op, "Image", SHAPE, true);
  const second = store.derive([src.id], op, "Image", SHAPE, true);
  assertEquals(first.id, second.id, "equal content must resolve to one record");
});

Deno.test("LineageStore: different parameters produce different buffers", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const a = store.derive(
    [src.id],
    { op: "stage.clahe", node: asNodeId("n"), params: { clip: 2 }, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  const b = store.derive(
    [src.id],
    { op: "stage.clahe", node: asNodeId("n"), params: { clip: 3 }, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  assert(a.id !== b.id);
});

Deno.test("LineageStore: history walks back to the source, listing each ancestor once", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  let current = src.id;
  for (let i = 0; i < 3; i++) {
    current = store.derive(
      [current],
      { op: `stage.s${i}`, node: asNodeId(`n${i}`), params: { i }, frame: 0 },
      "Image",
      SHAPE,
      true,
    ).id;
  }
  const history = store.history(current);
  assertEquals(history.length, 4);
  assertEquals(history.at(-1)!.id, src.id);
  assertEquals(history.at(-1)!.operation, null, "the root is a source");
});

Deno.test("LineageStore: a diamond lists each shared ancestor once", () => {
  const store = new LineageStore();
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  const left = store.derive(
    [src.id],
    { op: "l", node: asNodeId("l"), params: {}, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  const right = store.derive(
    [src.id],
    { op: "r", node: asNodeId("r"), params: {}, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  const joined = store.derive(
    [left.id, right.id],
    { op: "join", node: asNodeId("j"), params: {}, frame: 0 },
    "Image",
    SHAPE,
    true,
  );
  const ids = store.history(joined.id).map((r) => r.id);
  assertEquals(new Set(ids).size, ids.length, "an ancestor was listed twice");
  assertEquals(ids.length, 4);
});

Deno.test("LineageStore: compaction never evicts a source or a leaf", () => {
  const store = new LineageStore({ budgetBytes: 1000, compactFraction: 0.9 });
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  let current = src.id;
  const chain = [src.id];
  for (let i = 0; i < 6; i++) {
    current = store.derive(
      [current],
      { op: "stage.denoise", node: asNodeId(`n${i}`), params: { i }, frame: i },
      "Image",
      SHAPE,
      true,
    ).id;
    chain.push(current);
  }
  const summary = store.compact();
  assert(summary !== null, "the store was well over budget and should have compacted");
  assert(summary.bufferCount > 0);
  assertEquals(store.get(src.id)!.digested, false, "a source was evicted");
  assertEquals(store.get(current)!.digested, false, "the leaf was evicted");
  assert(summary.operationCounts["stage.denoise"]! > 0, "the digest must record what it folded");
});

Deno.test("LineageStore: compaction is a no-op within budget", () => {
  const store = new LineageStore({ budgetBytes: 1024 * 1024 * 1024 });
  store.source("Image", SHAPE, { path: "/f", frame: 0 });
  assertEquals(store.compact(), null);
});

Deno.test("LineageStore: a digested buffer keeps its lineage and can be replayed", () => {
  const store = new LineageStore({ budgetBytes: 1000, compactFraction: 0.9 });
  const src = store.source("Image", SHAPE, { path: "/f", frame: 0 });
  let current = src.id;
  for (let i = 0; i < 6; i++) {
    current = store.derive(
      [current],
      { op: "stage.denoise", node: asNodeId(`n${i}`), params: { i }, frame: i },
      "Image",
      SHAPE,
      true,
    ).id;
  }
  store.compact();
  const digestedId = store.history(current).find((r) => r.digested)?.id;
  assert(digestedId !== undefined, "compaction should have digested something");
  const plan = store.replayPlan(digestedId);
  assert(plan.length > 0, "a digested buffer must be rebuildable from its recorded chain");
  assertEquals(store.replayPlan(current), [], "a resident buffer needs no replay");
});

// ===========================================================================
// tokens
// ===========================================================================

Deno.test("elevate: a step on the dark baseline is visible but not a jump to grey", () => {
  const step1 = elevate("#0d0d11", 1);
  const { r } = parseHex(step1);
  const base = parseHex("#0d0d11").r;
  assert(r - base >= 8, `step of ${r - base} levels is too small to see`);
  assert(r - base <= 20, `step of ${r - base} levels is a jump, not an elevation`);
});

Deno.test("elevate: the ramp is monotonic and stays dark through elevation 3", () => {
  let previous = -1;
  for (const level of [0, 1, 2, 3] as const) {
    const { r } = parseHex(surface(level).background);
    assert(r > previous, "the elevation ramp must increase");
    previous = r;
  }
  assert(parseHex(surface(3).background).r < 64, "elevation 3 must still read as dark");
});

Deno.test("elevate: negative steps darken, and nothing leaves 0..255", () => {
  assertEquals(elevate("#000000", -3), "#000000");
  assertEquals(elevate("#ffffff", 5), "#ffffff");
  assert(parseHex(elevate("#808080", -1)).r < 128);
});

Deno.test("surface: elevation 0 casts no shadow, higher levels do", () => {
  assertEquals(surface(0).shadow, "none");
  assert(surface(2).shadow.includes("px"));
});

Deno.test("filterState: 'no filter' and 'filtered out' are distinct states", () => {
  assertEquals(filterState(false, false), "neutral");
  assertEquals(filterState(false, true), "neutral");
  assertEquals(filterState(true, true), "in");
  assertEquals(filterState(true, false), "out");
});

Deno.test("inferTypeRole: values and paths are secondary, labels are primary", () => {
  assertEquals(inferTypeRole("Stabilisation"), "primary");
  assertEquals(inferTypeRole("Denoise"), "primary");
  assertEquals(inferTypeRole("/Users/x/reel.mov"), "secondary");
  assertEquals(inferTypeRole("9"), "secondary");
  assertEquals(inferTypeRole("clip_limit"), "secondary");
});

// ===========================================================================
// registry + generated nodes
// ===========================================================================

const REGISTRY = buildRegistry();

Deno.test("registry: every generated stage is present and typed", () => {
  assertEquals(STAGE_NODES.length, STAGE_ORDER.length);
  for (const key of STAGE_ORDER) {
    const spec = REGISTRY.get(asNodeTypeId(`stage.${key}`));
    assert(spec !== null, `stage.${key} is missing from the registry`);
    assertEquals(spec.engineStage, key);
    assertEquals(spec.category, "stage");
  }
});

Deno.test("registry: duplicate type ids are rejected at construction", () => {
  assertThrows(() => new NodeRegistry([STAGE_NODES[0]!, STAGE_NODES[0]!]), Error, "Duplicate");
});

Deno.test("every port has help text — an unexplained socket is a design defect", () => {
  for (const spec of REGISTRY.all()) {
    for (const p of [...spec.inputs, ...spec.outputs]) {
      assert(p.help.trim().length > 0, `${spec.id}.${p.id} has no help text`);
      assert(p.label.trim().length > 0, `${spec.id}.${p.id} has no label`);
    }
  }
});

Deno.test("every Number port declares a range, every Enum port declares options", () => {
  for (const spec of REGISTRY.all()) {
    for (const p of [...spec.inputs, ...spec.outputs]) {
      if (p.kind === "Number") assert(p.range, `${spec.id}.${p.id} is unbounded`);
      if (p.kind === "Enum") {
        assert(p.options && p.options.length > 0, `${spec.id}.${p.id} has no options`);
      }
    }
  }
});

Deno.test("every Number port's default sits inside its own range", () => {
  for (const spec of REGISTRY.all()) {
    for (const p of spec.inputs) {
      if (p.kind !== "Number" || !p.range || p.defaultValue?.kind !== "Number") continue;
      const v = p.defaultValue.value;
      assert(
        v >= p.range.min && v <= p.range.max,
        `${spec.id}.${p.id} defaults to ${v}, outside ${p.range.min}…${p.range.max}`,
      );
    }
  }
});

Deno.test("every Enum port's default is one of its own options", () => {
  for (const spec of REGISTRY.all()) {
    for (const p of spec.inputs) {
      if (p.kind !== "Enum" || !p.options || p.defaultValue?.kind !== "Enum") continue;
      assert(
        p.options.includes(p.defaultValue.value),
        `${spec.id}.${p.id} defaults to "${p.defaultValue.value}", not in its options`,
      );
    }
  }
});

Deno.test("port ids are unique within each node", () => {
  for (const spec of REGISTRY.all()) {
    for (const group of [spec.inputs, spec.outputs]) {
      const ids = group.map((p) => p.id);
      assertEquals(new Set(ids).size, ids.length, `${spec.id} has duplicate port ids`);
    }
  }
});

Deno.test("generated ranges match the engine's own control schema", async () => {
  // The whole point of codegen: if someone widens a range in the engine and
  // forgets to regenerate, this fails.
  const path = new URL("../../ArchiveRestorer/shared/controls.json", import.meta.url).pathname;
  const controls = JSON.parse(await Deno.readTextFile(path)) as {
    sections: Array<{
      key: string;
      controls: Array<{ key: string; type: string; min?: number; max?: number }>;
    }>;
  };
  for (const section of controls.sections) {
    const spec = REGISTRY.require(asNodeTypeId(`stage.${section.key}`));
    for (const control of section.controls) {
      if (control.type !== "range" && control.type !== "number") continue;
      const p = spec.inputs.find((i) => i.id === control.key);
      assert(p, `${section.key}.${control.key} is missing from the generated node`);
      assertEquals(p.range?.min, control.min ?? 0, `${section.key}.${control.key} min`);
      assertEquals(p.range?.max, control.max ?? 1, `${section.key}.${control.key} max`);
    }
  }
});

Deno.test("registry: producersFor honours the Image→Sequence widening", () => {
  const producers = REGISTRY.producersFor("Sequence");
  assert(producers.some((t) => t.id === "source.sequence"));
  assert(
    producers.some((t) => t.id === "stage.clahe"),
    "a stage emitting Image can feed a Sequence input",
  );
});

Deno.test("network nodes are marked as such, so nothing paid runs on a slider drag", () => {
  assertEquals(REGISTRY.require(asNodeTypeId("ai.enhance")).cost, "network");
  assertEquals(REGISTRY.require(asNodeTypeId("mask.segment")).cost, "network");
  for (const spec of REGISTRY.byCategory("stage")) {
    assertEquals(spec.cost, "local", `${spec.id} must not be a network node`);
  }
});

// ===========================================================================
// compiler
// ===========================================================================

function stageNode(id: string, stage: string, values: Record<string, unknown> = {}): NodeInstance {
  return {
    ...mkNode(id, `stage.${stage}`),
    values: values as NodeInstance["values"],
  };
}

/**
 * Build `Footage → Frame Pick` and return the graph plus the id whose `image`
 * output feeds the pipeline. Stage nodes need a real image source now that an
 * unsatisfied input is an error, and every realistic graph starts here.
 */
function withSource(g: GraphDocument): { graph: GraphDocument; head: string } {
  let out = addNode(g, {
    ...mkNode("src", "source.sequence"),
    values: { project_id: { kind: "Text", value: "p1" } },
  });
  out = addNode(out, mkNode("pick", "source.frame"));
  const wired = connect(
    out,
    { node: asNodeId("src"), port: asPortId("sequence") },
    { node: asNodeId("pick"), port: asPortId("sequence") },
    (n, p, d) => REGISTRY.port(out.nodes[n]!.type, p, d),
  );
  assert("edge" in wired, "src should connect to pick");
  return { graph: wired.graph, head: "pick" };
}

/** Wire one node's `image` output into another's `image` input. */
function wireImage(g: GraphDocument, from: string, to: string): GraphDocument {
  const r = connect(
    g,
    { node: asNodeId(from), port: asPortId("image") },
    { node: asNodeId(to), port: asPortId("image") },
    (n, p, d) => REGISTRY.port(g.nodes[n]!.type, p, d),
  );
  assert("edge" in r, from + " should connect to " + to);
  return r.graph;
}

Deno.test("compileGraph: a chain of stages collapses into one engine call", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = seeded.graph;
  g = addNode(g, stageNode("s1", "stabilize"));
  g = addNode(g, stageNode("s2", "clahe"));
  g = addNode(g, stageNode("s3", "sharpen"));
  g = wireImage(g, seeded.head, "s1");
  g = wireImage(g, "s1", "s2");
  g = wireImage(g, "s2", "s3");

  const result = compileGraph(g, REGISTRY, 42);
  assert(result.runnable, JSON.stringify(result.diagnostics));
  assertEquals(result.steps.length, 1, "three chained stages must be one engine call");
  const step = result.steps[0]!;
  assert(step.kind === "preview");
  assertEquals(Object.keys(step.params).sort(), ["clahe", "sharpen", "stabilize"]);
  assertEquals(step.frame, 42);
  assertEquals(result.networkSteps, 0);
});

Deno.test("compileGraph: a fan-out breaks the run, because the middle result is needed", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = seeded.graph;
  g = addNode(g, stageNode("s1", "clahe"));
  g = addNode(g, stageNode("s2", "sharpen"));
  g = addNode(g, stageNode("s3", "denoise"));
  g = wireImage(g, seeded.head, "s1");
  g = wireImage(g, "s1", "s2");
  g = wireImage(g, "s1", "s3");
  const result = compileGraph(g, REGISTRY, 0);
  assertEquals(result.steps.length, 3, "a shared intermediate must be materialised");
});

Deno.test("compileGraph: an out-of-range value is clamped and reported, not silently passed", () => {
  const seeded = withSource(boundGraph("p1"));
  // clahe.clip_limit is 0.5..10 in the engine schema.
  let g = addNode(
    seeded.graph,
    stageNode("s1", "clahe", { clip_limit: { kind: "Number", value: 999 } }),
  );
  g = wireImage(g, seeded.head, "s1");
  const result = compileGraph(g, REGISTRY, 0);
  const step = result.steps[0]!;
  assert(step.kind === "preview");
  assertEquals(step.params.clahe!.clip_limit, 10, "the value must be clamped to the engine's max");
  assert(
    result.diagnostics.some((d) => d.severity === "warning" && d.message.includes("clamped")),
    "clamping must be reported",
  );
});

Deno.test("compileGraph: a muted node keeps its parameters but is switched off", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, {
    ...stageNode("s1", "clahe", { clip_limit: { kind: "Number", value: 4 } }),
    state: "muted",
  });
  g = wireImage(g, seeded.head, "s1");
  const step = compileGraph(g, REGISTRY, 0).steps[0]!;
  assert(step.kind === "preview");
  assertEquals(step.params.clahe!.enabled, false);
  assertEquals(step.params.clahe!.clip_limit, 4, "muting must not discard the settings");
});

Deno.test("compileGraph: a cycle produces one actionable error and no steps", () => {
  const g = chainGraph(3);
  const cyclic = {
    ...g,
    edges: {
      ...g.edges,
      forced: {
        id: "forced" as never,
        from: { node: asNodeId("n2"), port: asPortId("image") },
        to: { node: asNodeId("n0"), port: asPortId("image") },
        order: 0,
      },
    },
  };
  const result = compileGraph(cyclic, REGISTRY, 0);
  assert(!result.runnable);
  assertEquals(result.steps.length, 0);
  assertEquals(result.diagnostics.length, 1);
});

Deno.test("compileGraph: an unknown node type points at the fix", () => {
  const g = addNode(boundGraph("p"), mkNode("x", "stage.nope"));
  const result = compileGraph(g, REGISTRY, 0);
  assert(!result.runnable);
  assert(result.diagnostics[0]!.message.includes("codegen"));
});

Deno.test("compileGraph: a high AI influence is warned about but still runs", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, stageNode("s1", "clahe"));
  g = addNode(g, {
    ...mkNode("a1", "ai.enhance"),
    values: { influence: { kind: "Number", value: 0.9 } },
  });
  g = wireImage(g, seeded.head, "s1");
  g = wireImage(g, "s1", "a1");
  const result = compileGraph(g, REGISTRY, 0);
  assertEquals(result.networkSteps, 1, "a generative node is a network step");
  assert(
    result.diagnostics.some((d) => d.message.includes("faces")),
    "high influence over faces must be flagged",
  );
  assert(result.runnable, "a warning must not block the render");
});

Deno.test("compileGraph: an unwired Region node warns that every mode is identical", () => {
  const g = addNode(
    boundGraph("p1"),
    mkNode("r1", "flow.propagate"),
  );
  const result = compileGraph(g, REGISTRY, 0);
  assert(result.diagnostics.some((d) => d.message.includes("whole frame")));
});

Deno.test("compileGraph: the same graph compiles to the same request every time", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(
    seeded.graph,
    stageNode("s1", "clahe", { clip_limit: { kind: "Number", value: 2 } }),
  );
  g = wireImage(g, seeded.head, "s1");
  const a = JSON.stringify(compileGraph(g, REGISTRY, 7).steps);
  const b = JSON.stringify(compileGraph(g, REGISTRY, 7).steps);
  assertEquals(a, b, "compilation must be deterministic or the cache is useless");
});

Deno.test("compileGraph: a missing neighbourhood degrades the stage, it does not block it", () => {
  // Deflicker with no neighbours matches a window of one — it still renders a
  // frame, it just does nothing useful. Refusing to render would be wrong;
  // saying nothing would be worse.
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, stageNode("s1", "deflicker"));
  g = wireImage(g, seeded.head, "s1");

  const result = compileGraph(g, REGISTRY, 0);
  assert(result.runnable, "a degraded temporal stage must still render");
  const warning = result.diagnostics.find((d) => d.message.includes("across time"));
  assert(warning, "the degradation must be reported");
  assertEquals(warning.severity, "warning");
});

Deno.test("compileGraph: a satisfied neighbourhood produces no such warning", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, stageNode("s1", "deflicker"));
  g = wireImage(g, seeded.head, "s1");
  const wired = connect(
    g,
    { node: asNodeId("src"), port: asPortId("sequence") },
    { node: asNodeId("s1"), port: asPortId("neighbours") },
    (n, p, d) => REGISTRY.port(g.nodes[n]!.type, p, d),
  );
  assert("edge" in wired, "the sequence should reach the neighbours port");

  const result = compileGraph(wired.graph, REGISTRY, 0);
  assert(
    !result.diagnostics.some((d) => d.message.includes("across time")),
    "a connected neighbourhood must not warn",
  );
});

Deno.test("describePairing: whole-frame A makes 'subject only' empty, and says why", () => {
  // The trap the docs call out: with A covering everything, B\A is always 0.
  const frame = new Uint8Array([255, 255, 255, 255]);
  const subject = new Uint8Array([255, 255, 0, 0]);
  const report = describePairing(frame, subject);

  assert(report.aIsFullFrame);
  assert(!report.meaningful.includes("differenceB"), "B\\A cannot select anything here");
  assert(report.meaningful.includes("intersection"), "Overlap is what isolates B");
  assert(report.meaningful.includes("differenceA"), "A\\B is the background");

  const reason = report.degenerate.find((d) => d.mode === "differenceB");
  assert(reason, "the empty mode must be explained");
  assert(reason.why.includes("Overlap"), "the explanation must name the mode that works");
});

Deno.test("describePairing: two independent mattes make all four modes meaningful", () => {
  const sky = new Uint8Array([255, 255, 0, 0]);
  const bride = new Uint8Array([0, 255, 255, 0]);
  const report = describePairing(sky, bride);
  assertEquals(report.meaningful.length, 4);
  assert(!report.aIsFullFrame && !report.bIsFullFrame);
});

Deno.test("describePairing: non-overlapping mattes report the intersection as empty", () => {
  const left = new Uint8Array([255, 255, 0, 0]);
  const right = new Uint8Array([0, 0, 255, 255]);
  const report = describePairing(left, right);
  const reason = report.degenerate.find((d) => d.mode === "intersection");
  assert(reason, "a non-overlapping pair must flag the intersection");
  assert(reason.why.includes("do not overlap"));
});

Deno.test("displayScale: the shown value is scaled, the stored value is not", () => {
  // stabilize.crop_ratio is held as a fraction and shown as a percentage. The
  // engine's own UI shows 4%; WIV must agree, while still sending 0.04.
  const spec = REGISTRY.require(asNodeTypeId("stage.stabilize"));
  const port = spec.inputs.find((p) => p.id === "crop_ratio");
  assert(port?.range, "crop_ratio should carry a range");
  assertEquals(port.range.displayScale, 100);
  assertEquals(displayValue(0.04, port.range), 4);
  assertAlmostEquals(storedValue(4, port.range), 0.04, 1e-12);
  // Round-trip: what is shown converts back to what is stored.
  for (const raw of [0, 0.005, 0.04, 0.2]) {
    assertAlmostEquals(storedValue(displayValue(raw, port.range), port.range), raw, 1e-12);
  }
});

Deno.test("displayScale: a port without one is unscaled", () => {
  const spec = REGISTRY.require(asNodeTypeId("stage.clahe"));
  const port = spec.inputs.find((p) => p.id === "clip_limit")!;
  assertEquals(port.range!.displayScale, undefined);
  assertEquals(displayValue(2.5, port.range!), 2.5);
});

Deno.test("compileGraph: a scaled port still sends the engine's raw units", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(
    seeded.graph,
    stageNode("s1", "stabilize", { crop_ratio: { kind: "Number", value: 0.04 } }),
  );
  g = wireImage(g, seeded.head, "s1");
  const step = compileGraph(g, REGISTRY, 0).steps.find((s) => s.kind === "preview");
  assert(step && step.kind === "preview");
  assertEquals(
    step.params.stabilize!.crop_ratio,
    0.04,
    "the wire carries the engine's units, never the display units",
  );
});

Deno.test("applyStageParamsToGraph: Desk params write onto the matching stage ports", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(
    seeded.graph,
    stageNode("s1", "clahe", { clip_limit: { kind: "Number", value: 2 } }),
  );
  g = wireImage(g, seeded.head, "s1");
  g = applyStageParamsToGraph(g, REGISTRY, { clahe: { clip_limit: 4.5 } }, {
    actor: "system",
    skipUser: true,
  });
  const step = compileGraph(g, REGISTRY, 0).steps.find((s) => s.kind === "preview");
  assert(step && step.kind === "preview");
  assertEquals(step.params.clahe?.clip_limit, 4.5);
});

Deno.test("applyStageParamsToGraph: disabling a stage mutes the matching node", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, stageNode("s1", "clahe", {}));
  g = wireImage(g, seeded.head, "s1");
  g = applyStageParamsToGraph(g, REGISTRY, { clahe: { enabled: false } }, {
    actor: "user",
    skipUser: false,
  });
  assertEquals(g.nodes["s1"]?.state, "muted");
});

Deno.test("applyStageParamsToGraph: user-authored ports survive disk params", () => {
  const seeded = withSource(boundGraph("p1"));
  let g = addNode(seeded.graph, {
    ...stageNode("s1", "clahe", { clip_limit: { kind: "Number", value: 2 } }),
    authoredBy: { clip_limit: "user" },
  });
  g = wireImage(g, seeded.head, "s1");
  g = applyStageParamsToGraph(g, REGISTRY, { clahe: { clip_limit: 9 } }, {
    actor: "system",
    skipUser: true,
  });
  const step = compileGraph(g, REGISTRY, 0).steps.find((s) => s.kind === "preview");
  assert(step && step.kind === "preview");
  assertEquals(step.params.clahe?.clip_limit, 2);
});
