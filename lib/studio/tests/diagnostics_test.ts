/**
 * diagnostics_test.ts — the pre-run structural report and its gate.
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
import {
  confirmRun,
  GATE_TTL_MS,
  gateAllows,
  preRunReport,
  summarise,
} from "../core/diagnostics.ts";

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

/** src → zs → stab → clahe → col → render, with stab also fanning out to a viewer. */
function graph(): GraphDocument {
  let g: GraphDocument = { ...emptyGraph(asGraphId("g")), projectId: "p" };
  for (
    const [id, type] of [
      ["src", "source.sequence"],
      ["zs", "flow.stack"],
      ["stab", "stage.stabilize"],
      ["clahe", "stage.clahe"],
      ["col", "flow.collect"],
      ["render", "out.render"],
      ["view", "out.view"],
    ] as const
  ) g = addNode(g, node(id, type));
  g = wire(g, "src", "sequence", "zs", "sequence");
  g = wire(g, "zs", "image", "stab", "image");
  g = wire(g, "stab", "image", "clahe", "image");
  g = wire(g, "stab", "image", "view", "image");
  g = wire(g, "clahe", "image", "col", "image");
  g = wire(g, "col", "sequence", "render", "sequence");
  return g;
}

Deno.test("diagnostics: loops multiply evaluations; fan-out counts branches and paths", () => {
  const r = preRunReport(graph(), REGISTRY, {
    sequenceLength: 48,
    frameWidth: 1000,
    frameHeight: 1000,
  });
  assertEquals(r.loops.length, 1);
  assertEquals(r.loops[0]!.iterations, 48);
  assertEquals(r.childBranches, 1);
  assertEquals(r.fanOutNodes, ["stab"]);
  assertEquals(r.executionPaths, 2, "render and view are two sinks on one route each");
  const body = r.loops[0]!.body.length;
  assertEquals(r.evaluations, (r.scope - body) + body * 48);
  assertEquals(r.memory.frameBytes, 4_000_000);
  assert(
    r.memory.peakRamMb >= Math.round((48 * 4_000_000) / 1048576),
    "holds the collected sequence",
  );
  const order = r.order.map((s) => s.node);
  assert(
    order.indexOf("src") < order.indexOf("zs") && order.indexOf("clahe") < order.indexOf("col"),
  );
});

Deno.test("diagnostics: an iteration override replaces the computed count; the cap applies", () => {
  const g = graph();
  const over = preRunReport(g, REGISTRY, { sequenceLength: 48, iterationOverrides: { zs: 3 } });
  assertEquals(over.loops[0]!.iterations, 3);
  assert(over.loops[0]!.overridden);
  const capped = preRunReport(g, REGISTRY, { sequenceLength: 10_000 });
  assertEquals(capped.loops[0]!.iterations, 240);
  assert(capped.problems.some((p) => p.includes("capped at 240")));
});

Deno.test("diagnostics: seeds restrict the scope to their upstream closure", () => {
  const r = preRunReport(graph(), REGISTRY, { seeds: [asNodeId("view")], sequenceLength: 1 });
  assertEquals(r.order.map((s) => s.node).sort(), ["src", "stab", "view", "zs"]);
});

Deno.test("diagnostics: network steps are priced, tokened, and local models report VRAM", () => {
  let g: GraphDocument = emptyGraph(asGraphId("gen"));
  g = addNode(
    g,
    node("ask", "llm.ask", {
      model: { kind: "Enum", value: "anthropic:claude-opus-5" },
      instruction: { kind: "Text", value: "x".repeat(400) },
    }),
  );
  g = addNode(
    g,
    node("img", "gen.image", {
      model: { kind: "Enum", value: "google:gemini-2.5-flash-image" },
      prompt: { kind: "Text", value: "1950s wedding portrait" },
    }),
  );
  g = addNode(g, node("local", "gen.image", { model: { kind: "Enum", value: "comfy:flux-dev" } }));
  const r = preRunReport(g, REGISTRY);
  assertEquals(r.cost.billedCalls, 2);
  assertEquals(r.cost.localCalls, 1);
  assertEquals(r.tokens.output, 400);
  assert(r.tokens.input >= 100);
  assertEquals(r.memory.peakVramMb, 16_000);
  assert(summarise(r).includes("GB VRAM"));
});

Deno.test("gate: halts without a token, binds to structure, expires", () => {
  const g = graph();
  const r = preRunReport(g, REGISTRY, { sequenceLength: 12 });
  assertEquals(gateAllows(r, null).ok, false);
  const token = confirmRun(r, 1_000);
  assertEquals(gateAllows(r, token, 2_000).ok, true);
  assertEquals(gateAllows(r, token, 1_000 + GATE_TTL_MS + 1).ok, false);

  const wider = preRunReport(g, REGISTRY, { sequenceLength: 24 });
  const verdict = gateAllows(wider, token, 2_000);
  assert(!verdict.ok && verdict.reason.includes("changed"));

  const same = preRunReport(g, REGISTRY, { sequenceLength: 12 });
  assertEquals(same.digest, r.digest, "identical structure digests identically");
});

Deno.test("gate: an empty run needs no confirmation", () => {
  const r = preRunReport(emptyGraph(asGraphId("e")), REGISTRY);
  assertEquals(r.evaluations, 0);
  assertEquals(gateAllows(r, null).ok, true);
});
