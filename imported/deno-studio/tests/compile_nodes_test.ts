/**
 * compile_nodes_test.ts — what each node compiles to, and what it refuses.
 *
 * Three behaviours pinned here were wrong or missing before 2.2:
 *   - every `ai` node compiled to the engine's generative-repair step, so a
 *     Generate Image was described to the restorer with an empty prompt;
 *   - optionality was inferred (Mask kinds, the `neighbours` port), so a
 *     text-to-image node reported errors for the reference image it does not need;
 *   - `out.render` compiled to nothing at all.
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
import { vec2 } from "../core/spatial.ts";
import { compileGraph } from "../bridge/engine.ts";

const REGISTRY = buildRegistry();

function node(id: string, type: string, values: NodeInstance["values"] = {}): NodeInstance {
  return {
    id: asNodeId(id),
    type: asNodeTypeId(type),
    name: id,
    position: vec2(0, 0),
    size: { w: 200, h: 100 },
    values,
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
  assert("edge" in r, `${from}.${fp} → ${to}.${tp}`);
  return r.graph;
}

const enumv = (value: string) => ({ kind: "Enum", value } as const);
const text = (value: string) => ({ kind: "Text", value } as const);
const num = (value: number) => ({ kind: "Number", value } as const);

Deno.test("a generate node compiles to a provider step, not an engine enhance", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(
    g,
    node("gi", "gen.image", { model: enumv("fal:flux/dev"), prompt: text("a street") }),
  );
  const c = compileGraph(g, REGISTRY, 0);
  assertEquals(c.steps.length, 1);
  const step = c.steps[0]!;
  assert(step.kind === "generate");
  assertEquals(step.modelId, "fal:flux/dev");
  assertEquals(step.produces, "image");
  assertEquals(step.prompt, "a street");
  assertEquals(c.networkSteps, 1, "it still counts as a network step for the gate");
});

Deno.test("ai.enhance keeps its engine step, with the influence warning", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(g, node("f", "source.frame", { index: num(0) }));
  g = addNode(g, node("ai", "ai.enhance", { influence: num(0.9) }));
  g = wire(g, "src", "sequence", "f", "sequence");
  g = wire(g, "f", "image", "ai", "image");
  const c = compileGraph(g, REGISTRY, 0);
  assert(c.steps.some((s) => s.kind === "enhance"));
  assert(c.diagnostics.some((d) => d.severity === "warning" && d.message.includes("Influence")));
});

Deno.test("an optional input is not a missing one", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("gi", "gen.image", { model: enumv("comfy:flux-dev"), prompt: text("x") }));
  const c = compileGraph(g, REGISTRY, 0);
  assertEquals(c.diagnostics.filter((d) => d.severity === "error"), []);
  assert(c.runnable);
});

Deno.test("a missing model is still an error", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("gi", "gen.image", { model: enumv(""), prompt: text("x") }));
  const c = compileGraph(g, REGISTRY, 0);
  assert(c.diagnostics.some((d) => d.severity === "error" && d.message.includes("no model")));
});

Deno.test("Save with nothing wired says so; Save with one input is fine", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("sv", "out.save", { name: text("out") }));
  assert(
    compileGraph(g, REGISTRY, 0).diagnostics.some((d) => d.message.includes("nothing wired")),
  );

  g = addNode(g, node("gi", "gen.image", { model: enumv("comfy:sdxl"), prompt: text("x") }));
  g = wire(g, "gi", "image", "sv", "image");
  assertEquals(compileGraph(g, REGISTRY, 0).diagnostics.filter((d) => d.severity === "error"), []);
});

Deno.test("out.render compiles to an encode carrying the chain's stages", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(g, node("stack", "flow.stack", { stride: num(2) }));
  g = addNode(g, node("clahe", "stage.clahe", { enabled: { kind: "Flag", value: true } }));
  g = addNode(g, node("sharp", "stage.sharpen", { enabled: { kind: "Flag", value: true } }));
  g = addNode(g, node("col", "flow.collect"));
  g = addNode(g, node("out", "out.render", { fps: num(24), crf: num(20) }));
  g = wire(g, "src", "sequence", "stack", "sequence");
  g = wire(g, "stack", "image", "clahe", "image");
  g = wire(g, "clahe", "image", "sharp", "image");
  g = wire(g, "sharp", "image", "col", "image");
  g = wire(g, "col", "sequence", "out", "sequence");

  const c = compileGraph(g, REGISTRY, 0);
  const render = c.steps.find((s) => s.kind === "render");
  assert(render && render.kind === "render");
  assertEquals(Object.keys(render.params).sort(), ["clahe", "sharpen"]);
  assertEquals(render.fps, 24);
  assertEquals(render.crf, 20);
  assertEquals(render.frameSource, "stack");
  assertEquals(render.stack, asNodeId("stack"));
  assertEquals(render.timing, "preserve", "unrendered frames are held by default");
});

Deno.test("Render can drop the frames it does not process instead of holding them", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(
    g,
    node("out", "out.render", {
      fps: num(25),
      crf: num(18),
      timing: enumv("compress"),
    }),
  );
  g = wire(g, "src", "sequence", "out", "sequence");
  const render = compileGraph(g, REGISTRY, 0).steps.find((s) => s.kind === "render");
  assert(render && render.kind === "render");
  assertEquals(render.timing, "compress");
});

Deno.test("a render with no stages upstream warns rather than silently encoding the source", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("src", "source.sequence"));
  g = addNode(g, node("out", "out.render", { fps: num(25), crf: num(18) }));
  g = wire(g, "src", "sequence", "out", "sequence");
  const c = compileGraph(g, REGISTRY, 0);
  assert(c.steps.some((s) => s.kind === "render"));
  assert(
    c.diagnostics.some((d) =>
      d.severity === "warning" && d.message.includes("no restoration stages")
    ),
  );
});

Deno.test("an unwired Render compiles to nothing at all", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("out", "out.render", { fps: num(25), crf: num(18) }));
  const c = compileGraph(g, REGISTRY, 0);
  assertEquals(c.steps.filter((s) => s.kind === "render").length, 0);
  assert(c.diagnostics.some((d) => d.severity === "error" && d.message.includes("Sequence")));
});
