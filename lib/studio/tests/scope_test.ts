/**
 * scope_test.ts — the Z axis.
 *
 * These cover the two ways stack scoping goes wrong, both of which are silent:
 * a body that reaches too far recomputes work 300 times, and a body that stops
 * too early computes one frame and smears it across the range. Neither throws;
 * both just produce a wrong render slowly.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";

import {
  addNode,
  connect,
  emptyGraph,
  type GraphDocument,
  type NodeInstance,
} from "../core/graph.ts";
import { asGraphId, asNodeId, asNodeTypeId, asPortId } from "../core/ids.ts";
import { buildRegistry } from "../core/catalogue.ts";
import { allStackScopes, resolveStackScope, stackFrames } from "../core/scope.ts";
import { evaluateFrame, evaluateStack } from "../bridge/evaluator.ts";
import { compileGraph, EngineClient } from "../bridge/engine.ts";
import { vec2 } from "../core/spatial.ts";

const REGISTRY = buildRegistry();

function node(id: string, type: string): NodeInstance {
  return {
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
  };
}

function wire(g: GraphDocument, from: string, fp: string, to: string, tp: string): GraphDocument {
  const r = connect(
    g,
    { node: asNodeId(from), port: asPortId(fp) },
    { node: asNodeId(to), port: asPortId(tp) },
    (n, p, d) => {
      const found = g.nodes[n];
      return found ? REGISTRY.port(found.type, p, d) : null;
    },
  );
  assert("edge" in r, `${from}.${fp} should connect to ${to}.${tp}`);
  return r.graph;
}

/**
 * Footage → Z Stack → Stabilise → CLAHE → Collect → Render.
 *
 * The Render is the point: it is downstream of the stack but *outside* its
 * body, and a scope that swallowed it would re-run it once per slice.
 *
 * Note the terminal is a Render and not a Viewer. Collect emits a `Sequence`
 * and a Viewer takes an `Image`; the type system refuses that narrowing on
 * purpose, because it could only be satisfied by silently picking one frame.
 * Render is what a collected sequence is actually for.
 */
function stackGraph(): GraphDocument {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  for (
    const [id, type] of [
      ["src", "source.sequence"],
      ["zs", "flow.stack"],
      ["stab", "stage.stabilize"],
      ["clahe", "stage.clahe"],
      ["col", "flow.collect"],
      ["render", "out.render"],
    ] as const
  ) {
    g = addNode(g, node(id, type));
  }
  g = wire(g, "src", "sequence", "zs", "sequence");
  g = wire(g, "zs", "image", "stab", "image");
  g = wire(g, "stab", "image", "clahe", "image");
  g = wire(g, "clahe", "image", "col", "image");
  g = wire(g, "col", "sequence", "render", "sequence");
  return g;
}

// ===========================================================================
// Scope
// ===========================================================================

Deno.test("resolveStackScope: the body is everything between the stack and its collect", () => {
  const scope = resolveStackScope(stackGraph(), asNodeId("zs"));
  assertEquals(scope.problem, null);
  assertEquals([...scope.body].sort(), ["clahe", "col", "stab"]);
  assertEquals(scope.closes, [asNodeId("col")]);
});

Deno.test("resolveStackScope: a node after the collect is outside the body", () => {
  // This is the expensive mistake: `render` is downstream of the stack, and a
  // body that included it would re-run the encode once per slice.
  const scope = resolveStackScope(stackGraph(), asNodeId("zs"));
  assert(!scope.body.includes(asNodeId("render")), "the render must not be inside the stack");
});

Deno.test("resolveStackScope: the collect itself IS in the body", () => {
  // It runs per slice — gathering that slice's result is its whole job.
  const scope = resolveStackScope(stackGraph(), asNodeId("zs"));
  assert(scope.body.includes(asNodeId("col")));
});

Deno.test("resolveStackScope: a stack with no collect says so, and names the fix", () => {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("zs", "flow.stack"));
  g = addNode(g, node("clahe", "stage.clahe"));
  g = wire(g, "zs", "image", "clahe", "image");

  const scope = resolveStackScope(g, asNodeId("zs"));
  assert(scope.problem?.includes("Collect"), scope.problem ?? "expected a problem");
  assertEquals(scope.closes.length, 0);
});

Deno.test("resolveStackScope: an empty stack says there is nothing to iterate", () => {
  const g = addNode({ ...emptyGraph(asGraphId("g")), projectId: "p1" }, node("zs", "flow.stack"));
  const scope = resolveStackScope(g, asNodeId("zs"));
  assert(scope.problem?.includes("nothing to iterate"));
});

Deno.test("resolveStackScope: nesting is refused explicitly, not silently merged", () => {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("outer", "flow.stack"));
  g = addNode(g, node("inner", "flow.stack"));
  g = addNode(g, node("col", "flow.collect"));
  g = wire(g, "outer", "image", "inner", "sequence");
  g = wire(g, "inner", "image", "col", "image");

  const scope = resolveStackScope(g, asNodeId("outer"));
  assert(scope.problem?.includes("another stack"), scope.problem ?? "expected a nesting problem");
});

Deno.test("resolveStackScope: refuses a node that does not open a stack", () => {
  const scope = resolveStackScope(stackGraph(), asNodeId("clahe"));
  assert(scope.problem?.includes("does not open a stack"));
});

Deno.test("allStackScopes: finds every stack in the graph", () => {
  assertEquals(allStackScopes(stackGraph()).length, 1);
  assertEquals(allStackScopes(emptyGraph(asGraphId("g"))).length, 0);
});

// ===========================================================================
// Frame planning
// ===========================================================================

Deno.test("stackFrames: stride and count", () => {
  assertEquals(
    stackFrames({ start: 10, count: 4, stride: 3, available: 1000, limit: 100 }).frames,
    [10, 13, 16, 19],
  );
});

Deno.test("stackFrames: count 0 runs to the end of the sequence", () => {
  const { frames } = stackFrames({ start: 0, count: 0, stride: 2, available: 9, limit: 100 });
  assertEquals(frames, [0, 2, 4, 6, 8]);
});

Deno.test("stackFrames: never runs past the end of the sequence", () => {
  const { frames } = stackFrames({ start: 8, count: 10, stride: 1, available: 10, limit: 100 });
  assertEquals(frames, [8, 9]);
});

Deno.test("stackFrames: truncation is reported, not silent", () => {
  const { frames, truncated } = stackFrames({
    start: 0,
    count: 500,
    stride: 1,
    available: 6000,
    limit: 240,
  });
  assertEquals(frames.length, 240);
  assertEquals(truncated, 260);
});

Deno.test("stackFrames: a zero or negative stride cannot produce an infinite run", () => {
  const { frames } = stackFrames({ start: 0, count: 5, stride: 0, available: 100, limit: 50 });
  assertEquals(frames, [0, 1, 2, 3, 4], "stride must be clamped to at least 1");
});

// ===========================================================================
// The evaluator, against a stub engine
// ===========================================================================

/**
 * A stand-in for the engine that records what it was asked for.
 *
 * Stubbing at the client rather than at `fetch` keeps these tests about the
 * evaluator's *scheduling* — order, concurrency, cancellation — instead of
 * about HTTP.
 */
class StubEngine extends EngineClient {
  readonly calls: Array<{ frame: number; params: Record<string, unknown> }> = [];
  inFlight = 0;
  peakInFlight = 0;
  failOnFrame: number | null = null;
  delayMs = 0;

  override async preview(
    _projectId: string,
    frame: number,
    params: Record<string, unknown>,
  ): Promise<never | ReturnType<EngineClient["preview"]> extends never ? never : never> {
    this.calls.push({ frame, params });
    this.inFlight++;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    try {
      if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
      if (this.failOnFrame === frame) throw new Error(`engine refused frame ${frame}`);
      return {
        image: `data:image/jpeg;base64,frame${frame}`,
        frame,
        width: 720,
        height: 576,
        elapsed_ms: 12,
        report: {},
      } as never;
    } finally {
      this.inFlight--;
    }
  }
}

Deno.test("evaluateStack: runs the body once per slice, and nothing outside it", async () => {
  const graph = stackGraph();
  const engine = new StubEngine();
  const result = await evaluateStack(
    graph,
    REGISTRY,
    engine,
    asNodeId("zs"),
    [0, 1, 2, 3],
    { concurrency: 1 },
  );

  assertEquals(result.slices.length, 4);
  assertEquals(result.cancelled, false);
  assertEquals(engine.calls.map((c) => c.frame), [0, 1, 2, 3]);
  // stab → clahe collapse into one engine call, so one call per slice.
  assertEquals(engine.calls.length, 4);
  for (const call of engine.calls) {
    assertEquals(Object.keys(call.params).sort(), ["clahe", "stabilize"]);
  }
});

Deno.test("evaluateStack: results come back in slice order regardless of completion order", async () => {
  const engine = new StubEngine();
  engine.delayMs = 1;
  const result = await evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    [5, 6, 7, 8, 9, 10],
    { concurrency: 4 },
  );
  assertEquals(result.slices.map((s) => s.frame), [5, 6, 7, 8, 9, 10]);
  assertEquals(result.slices.map((s) => s.sliceIndex), [0, 1, 2, 3, 4, 5]);
});

Deno.test("evaluateStack: honours the concurrency limit", async () => {
  const engine = new StubEngine();
  engine.delayMs = 4;
  await evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    Array.from({ length: 20 }, (_, i) => i),
    { concurrency: 3 },
  );
  assert(
    engine.peakInFlight <= 3,
    `peak concurrency was ${engine.peakInFlight}, limit was 3 — the pool is leaking`,
  );
  assert(engine.peakInFlight > 1, "the pool should actually run slices in parallel");
});

Deno.test("evaluateStack: one failing slice does not abort the rest", async () => {
  const engine = new StubEngine();
  engine.failOnFrame = 2;
  const result = await evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    [0, 1, 2, 3, 4],
    { concurrency: 1 },
  );
  assertEquals(result.slices.length, 5);
  const failed = result.slices.filter((s) => s.error !== null);
  assertEquals(failed.length, 1);
  assertEquals(failed[0]!.frame, 2);
  assert(failed[0]!.error!.includes("refused frame 2"));
  // Every other slice still produced a result.
  assertEquals(result.slices.filter((s) => s.outputs.size > 0).length, 4);
});

Deno.test("evaluateStack: reports progress per slice", async () => {
  const engine = new StubEngine();
  const seen: number[] = [];
  await evaluateStack(stackGraph(), REGISTRY, engine, asNodeId("zs"), [0, 1, 2], {
    concurrency: 1,
    onProgress: (p) => seen.push(p.done),
  });
  assertEquals(seen, [1, 2, 3]);
});

Deno.test("evaluateStack: an abort stops the run and keeps what finished", async () => {
  const engine = new StubEngine();
  engine.delayMs = 5;
  const controller = new AbortController();
  const run = evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    Array.from({ length: 40 }, (_, i) => i),
    { concurrency: 2, signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 20);
  const result = await run;

  assert(result.cancelled, "the run should report that it was cancelled");
  assert(result.slices.length > 0, "work already done must be kept");
  assert(result.slices.length < 40, "the run should have stopped early");
});

Deno.test("evaluateStack: refuses to start on a broken scope, with the reason", async () => {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("zs", "flow.stack"));
  const engine = new StubEngine();
  const result = await evaluateStack(g, REGISTRY, engine, asNodeId("zs"), [0, 1], {});

  assertEquals(result.slices.length, 0);
  assertEquals(engine.calls.length, 0, "a broken scope must not reach the engine");
  assertEquals(result.diagnostics[0]?.severity, "error");
});

Deno.test("evaluateStack: caps a huge run and reports how much it dropped", async () => {
  const engine = new StubEngine();
  const result = await evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    Array.from({ length: 500 }, (_, i) => i),
    { concurrency: 8, maxSlices: 50 },
  );
  assertEquals(result.slices.length, 50);
  assertEquals(result.truncated, 450);
});

Deno.test("evaluateStack: diagnostics are gathered once, not once per slice", async () => {
  const engine = new StubEngine();
  const result = await evaluateStack(
    stackGraph(),
    REGISTRY,
    engine,
    asNodeId("zs"),
    [0, 1, 2, 3, 4, 5],
    { concurrency: 1 },
  );
  // The graph does not change between slices, so a warning must appear once.
  const messages = result.diagnostics.map((d) => d.message);
  assertEquals(new Set(messages).size, messages.length, "diagnostics were duplicated per slice");
});

Deno.test("evaluateFrame: runs every step, not only a stack body", async () => {
  const engine = new StubEngine();
  const result = await evaluateFrame(stackGraph(), REGISTRY, engine, 42);
  assert(result.runnable);
  assertEquals(engine.calls.length, 1);
  assertEquals(engine.calls[0]!.frame, 42);
  assertEquals(result.outputs.size, 1);
});

Deno.test("evaluateFrame: an unbound project returns no outputs rather than throwing", async () => {
  const graph = { ...stackGraph(), projectId: null };
  const engine = new StubEngine();
  const result = await evaluateFrame(graph, REGISTRY, engine, 0);
  assertEquals(result.outputs.size, 0);
  assertEquals(engine.calls.length, 0);
});

Deno.test("evaluateFrame: a dangling unwired node does not block a finished chain", async () => {
  // This is why the old Preview button looked dead: compileGraph treats the
  // whole document as unrunnable if any required input is missing, so a spare
  // CLAHE on the canvas stopped every other stage from painting.
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(g, node("pick", "source.frame"));
  g = addNode(g, node("clahe", "stage.clahe"));
  g = addNode(g, node("spare", "stage.clahe"));
  g = wire(g, "src", "sequence", "pick", "sequence");
  g = wire(g, "pick", "image", "clahe", "image");
  const whole = compileGraph(g, REGISTRY, 0);
  assert(!whole.runnable, "the spare node must still fail the whole-graph compile");
  const engine = new StubEngine();
  const result = await evaluateFrame(g, REGISTRY, engine, 7);
  assert(result.runnable);
  assertEquals(engine.calls.length, 1);
  assertEquals(engine.calls[0]!.frame, 7);
  assertEquals(result.outputs.size, 1);
});

Deno.test("an unconnected Z Stack sequence is an error, not a 'no effect' warning", () => {
  // The degradation message belongs to `neighbours` alone. A stack with no
  // sequence has nothing to iterate — telling the user its temporal settings
  // are inert would point them at the wrong thing entirely.
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("zs", "flow.stack"));
  g = addNode(g, node("clahe", "stage.clahe"));
  g = addNode(g, node("col", "flow.collect"));
  g = wire(g, "zs", "image", "clahe", "image");
  g = wire(g, "clahe", "image", "col", "image");

  const result = compileGraph(g, REGISTRY, 0);
  const about = result.diagnostics.filter((d) => d.node === asNodeId("zs"));
  assertEquals(about.length, 1);
  assertEquals(about[0]!.severity, "error");
  assert(
    !about[0]!.message.includes("no effect"),
    "a structural Sequence input must not be reported as a degradation",
  );
});

Deno.test("a stage's `neighbours` port keeps the degradation warning", () => {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p1" };
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(g, node("pick", "source.frame"));
  g = addNode(g, node("df", "stage.deflicker"));
  g = wire(g, "src", "sequence", "pick", "sequence");
  g = wire(g, "pick", "image", "df", "image");

  const result = compileGraph(g, REGISTRY, 0);
  const warning = result.diagnostics.find((d) => d.message.includes("across time"));
  assert(warning, "deflicker with no neighbours must still warn");
  assertEquals(warning.severity, "warning");
  assert(result.runnable, "and it must still be runnable");
});
