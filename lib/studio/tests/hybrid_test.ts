/**
 * hybrid_test.ts — graph + columns lineage.
 *
 * The guarantees: changing a parameter never overwrites the ancestor or its
 * record; parent/child integrity holds both ways; common-ancestor compare
 * finds the right root and the right deltas; and the published blueprint
 * format round-trips and rejects documents that lie about their structure.
 */

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { HybridLineage, LineageError, originOf, validateBlueprint } from "../core/hybrid.ts";

const fixed = () => new Date("2026-09-17T16:45:10Z");
const EXAMPLE = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/hybrid_blueprint.example.json", import.meta.url)),
);

function portraitFamily() {
  const h = new HybridLineage({ now: fixed });
  const base = h.create({
    origin_type: "generated",
    label: "Base",
    params: {
      model_name: "Nano Banana v2.1",
      prompt: "1950s wedding portrait",
      seed: 1,
      guidance_scale: 7,
    },
  });
  const sharp = h.derive({
    parents: [base.asset.id],
    label: "Sharper",
    transformation: "prompt_tweak",
    changes: { prompt: "1950s wedding portrait, sharp focus", guidance_scale: 8.5 },
  });
  const grain = h.derive({
    parents: [base.asset.id],
    label: "Grain",
    transformation: "param_tweak",
    changes: { seed: 2 },
  });
  const restored = h.derive({
    parents: [sharp.asset.id],
    label: "Restored",
    transformation: "restore",
    changes: { model_name: "Flux Pro 1.1" },
  });
  return { h, base, sharp, grain, restored };
}

Deno.test("hybrid: a prompt change mints a child and leaves the parent and its record intact", () => {
  const { h, base, sharp } = portraitFamily();
  assert(base.asset.id !== sharp.asset.id);
  assertEquals(h.paramsOf(base.asset.id)!.prompt, "1950s wedding portrait");
  assertEquals(h.paramsOf(base.asset.id)!.guidance_scale, 7);
  assertEquals(h.paramsOf(sharp.asset.id)!.prompt, "1950s wedding portrait, sharp focus");
  assertEquals(h.paramsOf(sharp.asset.id)!.seed, 1, "unchanged fields are inherited, not dropped");
  assertEquals(h.parentsOf(sharp.asset.id), [base.asset.id]);
  assert(h.childrenOf(base.asset.id).includes(sharp.asset.id));
  assertEquals(sharp.asset.origin_type, "derived");
});

Deno.test("hybrid: parent-child integrity holds in both directions for every edge", () => {
  const { h } = portraitFamily();
  for (const e of h.edges()) {
    assert(h.childrenOf(e.from).includes(e.to));
    assert(h.parentsOf(e.to).includes(e.from));
  }
  for (const n of h.nodes()) {
    assertEquals(h.columns.recordsOf(n.id).length, 1, `${n.id} has exactly one record`);
  }
});

Deno.test("hybrid: compare finds the common parent and the parameter deltas", () => {
  const { h, base, restored, grain } = portraitFamily();
  const c = h.compare(restored.asset.id, grain.asset.id);
  assertEquals(c.common, base.asset.id);
  assertEquals(c.pathA.length, 3);
  assertEquals(c.transformationsA, ["prompt_tweak", "restore"]);
  assertEquals(c.transformationsB, ["param_tweak"]);
  assertEquals(c.changed.map((d) => d.field).sort(), [
    "guidance_scale",
    "model_name",
    "prompt",
    "seed",
  ]);
});

Deno.test("hybrid: an ancestor compared with its descendant is its own common ancestor", () => {
  const { h, base, restored } = portraitFamily();
  assertEquals(h.commonAncestor(base.asset.id, restored.asset.id), base.asset.id);
  assertEquals(h.depth(restored.asset.id), 2);
});

Deno.test("hybrid: merge and split", () => {
  const { h, sharp, grain } = portraitFamily();
  const merged = h.derive({
    parents: [sharp.asset.id, grain.asset.id],
    label: "Merge",
    transformation: "merge",
  });
  assertEquals(h.parentsOf(merged.asset.id), [sharp.asset.id, grain.asset.id]);
  assertEquals(h.paramsOf(merged.asset.id)!.guidance_scale, 8.5, "inherits from the first parent");

  const clip = h.create({ origin_type: "imported", label: "Reel", params: { fps: 24 } });
  const frames = h.split(clip.asset.id, [
    { label: "kf 0", changes: { frame: 0 } },
    { label: "kf 48", changes: { frame: 48 } },
  ], "keyframe_extract");
  assertEquals(frames.length, 2);
  assertEquals(h.childrenOf(clip.asset.id).length, 2);
  assertEquals(h.edgesInto(frames[1]!.asset.id)[0]!.transformation, "keyframe_extract");
});

Deno.test("hybrid: refusals — unknown parent, duplicate id, derived via create", () => {
  const { h, base } = portraitFamily();
  assertThrows(
    () => h.derive({ parents: ["nope"], label: "x", transformation: "img2img" }),
    LineageError,
  );
  assertThrows(
    () => h.create({ id: base.asset.id, origin_type: "authored", label: "dup" }),
    LineageError,
    "never overwritten",
  );
  // deno-lint-ignore no-explicit-any
  assertThrows(() => h.create({ origin_type: "derived" as any, label: "x" }), LineageError);
});

Deno.test("hybrid: a refused record leaves no orphan asset", () => {
  const { h, base } = portraitFamily();
  const before = h.size;
  assertThrows(() =>
    h.derive({
      parents: [base.asset.id],
      label: "bad",
      transformation: "param_tweak",
      changes: { seed: "x" },
    })
  );
  assertEquals(h.size, before);
  assertEquals(h.childrenOf(base.asset.id).length, 2);
});

Deno.test("hybrid: query joins columns back to graph nodes", () => {
  const { h } = portraitFamily();
  const hits = h.query([["model_name", "eq", "Nano Banana v2.1"], ["guidance_scale", "gt", 7]]);
  assertEquals(hits.map((x) => x.asset.label), ["Sharper"]);
});

Deno.test("hybrid: snapshot round trip preserves ids, edges, records and counters", () => {
  const { h } = portraitFamily();
  const back = HybridLineage.fromSnapshot(JSON.parse(JSON.stringify(h.snapshot())), { now: fixed });
  assertEquals(back.snapshot(), h.snapshot());
  const next = back.create({ origin_type: "authored", label: "note" });
  assert(!h.node(next.asset.id), "counter resumes past existing ids");
});

Deno.test("blueprint: the reference document is valid and reproduces its own cost estimation", () => {
  assertEquals(validateBlueprint(EXAMPLE), []);
  const h = HybridLineage.fromBlueprint(EXAMPLE, { now: fixed });
  assertEquals(h.parentsOf("ast_img_088_v2"), ["ast_img_087_v1"]);
  const c = h.compare("ast_img_087_v1", "ast_img_088_v2");
  assertEquals(c.changed.map((d) => d.field), ["prompt", "guidance_scale"]);
  const est = h.costEstimation();
  assertEquals(est.total_branches, EXAMPLE.cost_estimation.total_branches);
  assertEquals(est.total_execution_paths, EXAMPLE.cost_estimation.total_execution_paths);
  assert(est.estimated_compute_cost_usd > 0, "Nano Banana is priced from the catalogue");
});

Deno.test("blueprint: export then import is lossless", () => {
  const { h } = portraitFamily();
  const doc = h.toBlueprint({ workflow_id: "wf_x", title: "x", version: "1.0.0" });
  assertEquals(validateBlueprint(doc), []);
  const back = HybridLineage.fromBlueprint(JSON.parse(JSON.stringify(doc)), { now: fixed });
  assertEquals(back.edges(), h.edges());
  assertEquals(back.columns.query(), h.columns.query());
});

Deno.test("blueprint: structural lies are named", () => {
  const broken = structuredClone(EXAMPLE);
  broken.graph_structure.nodes[1].edges_in = [];
  const p1 = validateBlueprint(broken);
  assert(p1.some((p) => p.includes("derived but has no edges_in")));
  assert(p1.some((p) => p.includes("not in ast_img_088_v2.edges_in")));

  const cyc = structuredClone(EXAMPLE);
  cyc.graph_structure.nodes[0].origin_type = "derived";
  cyc.graph_structure.nodes[0].edges_in = ["ast_img_088_v2"];
  cyc.graph_structure.nodes[1].edges_out = ["ast_img_087_v1"];
  assert(validateBlueprint(cyc).includes("The lineage graph contains a cycle."));

  const orphan = structuredClone(EXAMPLE);
  orphan.columnar_parameters[0].asset_id = "ghost";
  assert(validateBlueprint(orphan).some((p) => p.includes("must name an asset")));
  assertThrows(() => HybridLineage.fromBlueprint(orphan), LineageError);
});

Deno.test("originOf maps the ledger vocabulary onto the four origins", () => {
  assertEquals(
    (["imported", "generated", "manual", "remixed", "duplicated"] as const).map(originOf),
    ["imported", "generated", "authored", "derived", "derived"],
  );
});

Deno.test("hybrid: per-parent transformations and inherit:false (the canvas's re-run shape)", () => {
  const h = new HybridLineage({ now: fixed });
  const src = h.create({ origin_type: "imported", label: "Reel", params: { fps: 24 } });
  const v1 = h.derive({
    parents: [src.asset.id],
    label: "CLAHE v1",
    transformation: "stage.clahe",
    inherit: false,
    changes: { clip: 2 },
  });
  const v2 = h.derive({
    parents: [v1.asset.id, src.asset.id],
    transformations: ["param_tweak", "stage.clahe"],
    transformation: "stage.clahe",
    inherit: false,
    label: "CLAHE v2",
    changes: { clip: 3 },
  });
  assertEquals(h.edgesInto(v2.asset.id).map((e) => e.transformation), [
    "param_tweak",
    "stage.clahe",
  ]);
  assertEquals(
    h.paramsOf(v2.asset.id)!.fps,
    undefined,
    "inherit:false takes nothing from the reel",
  );
  assertEquals(h.paramsOf(v1.asset.id)!.clip, 2, "v1 untouched by v2");
  assertThrows(
    () =>
      h.derive({ parents: [v1.asset.id], transformations: [], transformation: "x", label: "bad" }),
    LineageError,
  );
});
