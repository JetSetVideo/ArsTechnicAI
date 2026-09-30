/**
 * workflows_test.ts — every saved workflow still loads, compiles and resolves.
 *
 * The shipped flows are built by `tools/make_workflows.ts` from the registry,
 * but they are *files*: a port renamed in a node type, a reference id retired
 * from a shelf, or a signal kind tightened would leave them wired to nothing.
 * This reads what is actually on disk — the user's own saved flows included —
 * and holds each to the same bar the canvas does.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { GraphDocument } from "../core/graph.ts";
import { buildAdjacency } from "../core/graph.ts";
import { asNodeId } from "../core/ids.ts";
import { buildRegistry } from "../core/catalogue.ts";
import { compileGraph } from "../bridge/engine.ts";
import { evaluateStyles } from "../core/style_eval.ts";
import { loadLibrary } from "../bridge/library.ts";
import { preRunReport } from "../core/diagnostics.ts";

const REGISTRY = buildRegistry();
const LIB = await loadLibrary();
const STYLE_OPTIONS = {
  reference: (id: string) => LIB.references.get(id),
  presets: LIB.presets,
};

const DIR = new URL("../workflows/", import.meta.url).pathname;

interface Saved {
  id: string;
  name: string;
  note?: string;
  media_type?: string;
  graph: GraphDocument;
}

const files: Saved[] = [];
for await (const entry of Deno.readDir(DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".json")) continue;
  files.push(JSON.parse(await Deno.readTextFile(`${DIR}${entry.name}`)) as Saved);
}
files.sort((a, b) => a.id.localeCompare(b.id));

/** The seven the app ships. A user's own saved flows are checked too, but only these are required. */
const SHIPPED = [
  "depth-pass-over-a-range",
  "grade-one-frame",
  "isolate-subject-and-treat",
  "reference-to-image",
  "restore-and-export",
  "restored-frame-to-generative",
  "shot-list-from-a-script",
  "subject-into-a-place",
];

Deno.test("the shipped workflow library is present", () => {
  const ids = files.map((f) => f.id);
  for (const id of SHIPPED) assert(ids.includes(id), `${id} is missing from workflows/`);
});

Deno.test("every workflow names a reel-agnostic shape", () => {
  for (const file of files) {
    assert(file.name.trim() !== "", `${file.id} has no name`);
    assert(
      !file.graph.projectId,
      `${file.id} carries a projectId — a workflow is a shape to apply to footage, not a reference to one reel`,
    );
  }
});

for (const file of files) {
  Deno.test(`workflow "${file.id}" is structurally sound`, () => {
    const graph = file.graph;
    assert(Object.keys(graph.nodes).length > 0, "has nodes");

    // Every node type is still registered, and every wire still names real ports.
    for (const node of Object.values(graph.nodes)) {
      assert(REGISTRY.get(node.type), `unknown node type ${node.type}`);
    }
    for (const edge of Object.values(graph.edges)) {
      const from = graph.nodes[edge.from.node];
      const to = graph.nodes[edge.to.node];
      assert(from && to, `edge ${edge.id} names a missing node`);
      const out = REGISTRY.port(from.type, edge.from.port, "output");
      const into = REGISTRY.port(to.type, edge.to.port, "input");
      assert(out, `${from.type}.${edge.from.port} is not an output any more`);
      assert(into, `${to.type}.${edge.to.port} is not an input any more`);
    }

    // Nothing dangles: every node is wired to something (a one-node flow aside).
    const adjacency = buildAdjacency(graph);
    if (Object.keys(graph.nodes).length > 1) {
      for (const id of Object.keys(graph.nodes)) {
        const node = asNodeId(id);
        const wired = (adjacency.incoming.get(node)?.length ?? 0) +
          (adjacency.outgoing.get(node)?.length ?? 0);
        assert(wired > 0, `${id} (${graph.nodes[id]!.type}) is wired to nothing`);
      }
    }
  });

  Deno.test(`workflow "${file.id}" compiles and resolves with no errors`, () => {
    const compiled = compileGraph(file.graph, REGISTRY, 0);
    const errors = compiled.diagnostics.filter((d) => d.severity === "error");
    assertEquals(errors.map((e) => e.message), [], `${file.id} compile errors`);

    const styles = evaluateStyles(file.graph, REGISTRY, STYLE_OPTIONS);
    const styleErrors = styles.diagnostics.filter((d) => d.severity === "error");
    assertEquals(styleErrors.map((e) => e.message), [], `${file.id} style errors`);

    // And it can be priced and gated, which is what Run does before anything runs.
    const report = preRunReport(file.graph, REGISTRY, { sequenceLength: 120 });
    assert(report.evaluations > 0, "has something to evaluate");
    assertEquals(report.cost.unknownModels, [], "every model named is in the catalogue");
  });
}

Deno.test("the restoration flow compiles to a render the engine can encode", () => {
  const flow = files.find((f) => f.id === "restore-and-export")!;
  const compiled = compileGraph(flow.graph, REGISTRY, 0);
  const render = compiled.steps.find((s) => s.kind === "render");
  assert(render && render.kind === "render", "out.render compiles to a render step");
  assertEquals(render.frameSource, "stack", "the Z stack decides the range");
  assert(render.stack !== null);
  assert(
    Object.keys(render.params).length >= 4,
    `the chain's stages reach the encode: ${Object.keys(render.params).join(", ")}`,
  );
  assertEquals(render.fps, 25);
});

Deno.test("the generative flows compile to provider steps, never to engine calls", () => {
  for (const id of ["reference-to-image", "shot-list-from-a-script"]) {
    const flow = files.find((f) => f.id === id)!;
    const compiled = compileGraph(flow.graph, REGISTRY, 0);
    assert(
      compiled.steps.every((s) => s.kind !== "enhance"),
      `${id} must not compile into the engine's generative-repair endpoint`,
    );
    const generate = compiled.steps.filter((s) => s.kind === "generate");
    assert(generate.length > 0, `${id} has generate steps`);
    for (const step of generate) {
      assert(step.kind === "generate" && step.modelId !== "", "every generate step names a model");
    }
  }
});

Deno.test("the reference flow resolves a prompt that carries both references", () => {
  const flow = files.find((f) => f.id === "reference-to-image")!;
  const styles = evaluateStyles(flow.graph, REGISTRY, STYLE_OPTIONS);
  const prompt = styles.texts.get("gen:used_prompt") ?? "";
  assert(prompt.includes("detective"), `the subject survives: ${prompt.slice(0, 80)}`);
  const blend = styles.styles.get(asNodeId("blend"))!;
  assertEquals(blend.sources.length, 2, "both cards contribute");
});
