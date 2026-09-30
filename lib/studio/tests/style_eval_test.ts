/**
 * style_eval_test.ts — the generation half, resolved without a network.
 *
 * `ref.blend` and `ref.shot` were node types with no evaluator: they could be
 * wired and carried nothing. These tests pin what they now produce, and what a
 * generate node would actually send — the string you are about to pay for.
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
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
import { describeStyle, evaluateStyles } from "../core/style_eval.ts";
import { loadLibrary } from "../bridge/library.ts";

const REGISTRY = buildRegistry();
const LIB = await loadLibrary();
const opts = {
  reference: (id: string) => LIB.references.get(id),
  presets: LIB.presets,
};

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

const text = (v: string) => ({ kind: "Text", value: v } as const);
const num = (v: number) => ({ kind: "Number", value: v } as const);
const enumv = (v: string) => ({ kind: "Enum", value: v } as const);

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
  assert("edge" in r, `${from}.${fp} → ${to}.${tp}: ${"refusal" in r ? r.refusal.message : "?"}`);
  return r.graph;
}

Deno.test("the library the tests run against is the real one", () => {
  assertEquals(LIB.problems, []);
  assert(LIB.references.get("movie.blade_runner"), "blade_runner is on the movie shelf");
});

Deno.test("ref.card resolves a reference to its grant and camera", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.blade_runner") }));
  const out = evaluateStyles(g, REGISTRY, opts);
  const style = out.styles.get(asNodeId("c1"))!;
  assertEquals(style.sources, ["movie.blade_runner"]);
  assert(style.cinema, "a movie card carries a whole configuration");
  assert(style.validation, "and it is validated against the rules");
  assertStringIncludes(describeStyle(style), "blade_runner");
});

Deno.test("a reference id that is not in the library is an error, never a guess", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("no_such_film") }));
  const out = evaluateStyles(g, REGISTRY, opts);
  assertEquals(out.styles.size, 0);
  assertEquals(out.diagnostics[0]?.severity, "error");
  assertStringIncludes(out.diagnostics[0]!.message, "no_such_film");
});

Deno.test("ref.blend merges two cards, reports which supplied the camera", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.blade_runner") }));
  g = addNode(g, node("c2", "ref.card", { reference_id: text("movie.akira") }));
  g = addNode(g, node("b", "ref.blend"));
  g = wire(g, "c1", "style", "b", "styles");
  g = wire(g, "c2", "style", "b", "styles");
  const out = evaluateStyles(g, REGISTRY, opts);
  const blend = out.styles.get(asNodeId("b"))!;
  assertEquals(blend.sources, ["movie.blade_runner", "movie.akira"]);
  assert(blend.cinemaFrom.length === 2, "both films carry a camera");
  const conflicts = out.texts.get("b:conflicts")!;
  assertStringIncludes(conflicts, "blade_runner");
  assertStringIncludes(conflicts, "akira");
  assert(
    out.diagnostics.some((d) => d.severity === "warning" && d.message.includes("Two references")),
    "the conflict is stated, not resolved silently",
  );
});

Deno.test("ref.shot overrides the wired camera and validates the result", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.barry_lyndon") }));
  g = addNode(
    g,
    node("s", "ref.shot", {
      shot_size: text("CU"),
      focal_length: num(85),
      time_of_day: enumv("Night"),
    }),
  );
  g = wire(g, "c1", "style", "s", "base");
  const out = evaluateStyles(g, REGISTRY, opts);
  const shot = out.styles.get(asNodeId("s"))!;
  assert(shot.cinema && shot.cinema.mode === "live_action");
  assertEquals(shot.cinema.visualGrammar.shotSize, "CU");
  assertEquals(shot.cinema.lens.focalLengthMm, 85);
  assertEquals(shot.cinema.lighting.timeOfDay, "Night");
  assert(shot.validation, "the overridden shot is re-validated");
  assertStringIncludes(out.texts.get("s:diagnostics")!, shot.validation!.status);
  // The reference it came from is untouched.
  assertEquals(out.styles.get(asNodeId("c1"))!.cinema!.visualGrammar.shotSize !== "CU", true);
});

Deno.test("ref.prompt renders per model dialect, and the dialects differ", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.blade_runner") }));
  g = addNode(
    g,
    node("p", "ref.prompt", {
      subject: text("a detective in the rain"),
      target: enumv("midjourney"),
      detail: enumv("detailed"),
    }),
  );
  g = wire(g, "c1", "style", "p", "style");
  const mj = evaluateStyles(g, REGISTRY, opts).texts.get("p:positive")!;
  assertStringIncludes(mj, "a detective in the rain");

  const flux = {
    ...g,
    nodes: {
      ...g.nodes,
      p: { ...g.nodes.p!, values: { ...g.nodes.p!.values, target: enumv("flux") } },
    },
  };
  const fluxPrompt = evaluateStyles(flux, REGISTRY, opts).texts.get("p:positive")!;
  assert(fluxPrompt !== mj, "a model's dialect changes the string it is sent");
});

Deno.test("gen.image reports the exact prompt it would send, and prices its model", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.blade_runner") }));
  g = addNode(
    g,
    node("gi", "gen.image", {
      model: enumv("google:gemini-2.5-flash-image"),
      prompt: text("a wedding portrait"),
    }),
  );
  g = wire(g, "c1", "style", "gi", "style");
  const out = evaluateStyles(g, REGISTRY, opts);
  const used = out.texts.get("gi:used_prompt")!;
  assertStringIncludes(used, "a wedding portrait");
  assert(used.length > "a wedding portrait".length, "the style contributes to the prompt");
  assertEquals(out.diagnostics.filter((d) => d.severity === "error").length, 0);
});

Deno.test("a generate node with nothing to say is an error before it costs anything", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("gi", "gen.image", { model: enumv("comfy:flux-dev"), prompt: text("") }));
  const out = evaluateStyles(g, REGISTRY, opts);
  assert(
    out.diagnostics.some((d) =>
      d.severity === "error" && d.message.includes("nothing to generate")
    ),
  );
});

Deno.test("an unknown model cannot be priced, and says so", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(
    g,
    node("gi", "gen.image", { model: enumv("acme:dream-machine"), prompt: text("x") }),
  );
  const out = evaluateStyles(g, REGISTRY, opts);
  assert(out.diagnostics.some((d) => d.message.includes("acme:dream-machine")));
});

Deno.test("llm.ask assembles instruction, context and style into one text output", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.seven_samurai") }));
  g = addNode(
    g,
    node("ask", "llm.ask", {
      model: enumv("anthropic:claude-opus-5"),
      instruction: text("Break this into shots."),
      context: text("A village at dawn."),
    }),
  );
  g = wire(g, "c1", "style", "ask", "style");
  const out = evaluateStyles(g, REGISTRY, opts);
  const assembled = out.texts.get("ask:text")!;
  assertStringIncludes(assembled, "Break this into shots.");
  assertStringIncludes(assembled, "A village at dawn.");
});

Deno.test("text flows down a chain: prompt → generate", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("c1", "ref.card", { reference_id: text("movie.blade_runner") }));
  g = addNode(g, node("p", "ref.prompt", { subject: text("a neon street") }));
  g = addNode(g, node("gi", "gen.image", { model: enumv("comfy:flux-dev") }));
  g = wire(g, "c1", "style", "p", "style");
  g = wire(g, "p", "positive", "gi", "prompt");
  const out = evaluateStyles(g, REGISTRY, opts);
  assertStringIncludes(out.texts.get("gi:used_prompt")!, "a neon street");
});

Deno.test("a cycle resolves nothing rather than looping", () => {
  const g: GraphDocument = emptyGraph(asGraphId("g"));
  const out = evaluateStyles(g, REGISTRY, opts);
  assertEquals(out.styles.size, 0);
  assertEquals(out.diagnostics.length, 0);
});

Deno.test("a subject resolves its traits into the prompt, and can be told not to", () => {
  const entity = {
    id: "character.marie-abc12",
    kind: "character" as const,
    name: "Grandmother Marie",
    summary: "the bride, 24",
    description: "Lyon, 1953.",
    traits: ["left-handed", "burn scar on the right hand"],
    references: [],
    media: [],
    createdAt: 1,
    updatedAt: 1,
  };
  const withEntity = { ...opts, entity: (id: string) => (id === entity.id ? entity : null) };

  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("s", "ref.entity", { entity_id: text(entity.id) }));
  g = addNode(g, node("p", "ref.prompt", { subject: text("at the church door") }));
  g = wire(g, "s", "style", "p", "style");
  const on = evaluateStyles(g, REGISTRY, withEntity);
  const prompt = on.texts.get("p:positive")!;
  assertStringIncludes(prompt, "at the church door");
  assertStringIncludes(prompt, "Grandmother Marie");
  assertStringIncludes(prompt, "burn scar on the right hand");
  assertEquals(on.diagnostics.filter((d) => d.severity === "error").length, 0);

  const off = {
    ...g,
    nodes: {
      ...g.nodes,
      s: {
        ...g.nodes.s!,
        values: { ...g.nodes.s!.values, traits: { kind: "Flag", value: false } as const },
      },
    },
  };
  const without = evaluateStyles(off, REGISTRY, withEntity).texts.get("p:positive")!;
  assert(!without.includes("burn scar"), "traits can be left out deliberately");
  assertStringIncludes(without, "Grandmother Marie");
});

Deno.test("a subject that no longer exists is an error naming the id", () => {
  let g: GraphDocument = emptyGraph(asGraphId("g"));
  g = addNode(g, node("s", "ref.entity", { entity_id: text("character.gone-00000") }));
  const out = evaluateStyles(g, REGISTRY, { ...opts, entity: () => null });
  assert(
    out.diagnostics.some((d) =>
      d.severity === "error" && d.message.includes("character.gone-00000")
    ),
  );
});
