/**
 * lineage_store_test.ts — the on-disk non-destruction guarantees.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  extensionProblem,
  loadLatestLineage,
  sanitiseAssetName,
  saveLineage,
  writeVersionedAsset,
} from "../bridge/lineage_store.ts";
import { HybridLineage } from "../core/hybrid.ts";

const now = () => new Date("2026-09-17T00:00:00Z");

function family() {
  const h = new HybridLineage({ now });
  const base = h.create({
    origin_type: "generated",
    label: "Base",
    params: { prompt: "a", seed: 1 },
  });
  h.derive({
    parents: [base.asset.id],
    label: "Tweak",
    transformation: "prompt_tweak",
    changes: { prompt: "b" },
  });
  return h;
}

Deno.test("lineage store: each save is a new version; an identical save writes nothing", async () => {
  const dir = await Deno.makeTempDir();
  const h = family();
  const first = await saveLineage(dir, h.snapshot());
  assert(first.ok);
  assertEquals(first.version, 1);
  const again = await saveLineage(dir, h.snapshot());
  assert(again.ok);
  assertEquals(again.version, 1);

  h.derive({ parents: ["ast_2"], label: "More", transformation: "upscale", changes: { scale: 2 } });
  const second = await saveLineage(dir, JSON.parse(JSON.stringify(h.snapshot())));
  assert(second.ok);
  assertEquals(second.version, 2);
  assert((await Deno.stat(`${dir}/lineage/lineage.v1.json`)).isFile, "v1 is still on disk");
  assertEquals((await loadLatestLineage(dir)).snapshot!.nodes.length, 3);
});

Deno.test("lineage store: a save that drops or edits history is refused with 409", async () => {
  const dir = await Deno.makeTempDir();
  const h = family();
  assert((await saveLineage(dir, h.snapshot())).ok);

  const snap = h.snapshot();
  const dropped = { ...snap, nodes: snap.nodes.slice(0, 1), edges: [] };
  const r1 = await saveLineage(dir, dropped);
  // Dropping a node whose record remains is invalid on its own (400) or a
  // regression (409) — either way nothing is written.
  assert(!r1.ok);

  const edited = structuredClone(h.snapshot());
  (edited.columns.columns.prompt!.values as unknown[])[0] = "rewritten";
  const r2 = await saveLineage(dir, edited);
  assert(
    !r2.ok && r2.status === 409 && r2.reason.includes("changed field prompt"),
    JSON.stringify(r2),
  );
  assertEquals((await loadLatestLineage(dir)).version, 1);
});

Deno.test("extensionProblem: accepts growth, names a relabelled asset", () => {
  const h = family();
  const prev = h.snapshot();
  h.create({ origin_type: "imported", label: "Reel", params: { fps: 24 } });
  assertEquals(extensionProblem(prev, h.snapshot()), null);
  const relabel = structuredClone(prev);
  (relabel.nodes[0] as { label: string }).label = "Renamed";
  assert(extensionProblem(prev, relabel)!.includes("was modified"));
});

Deno.test("assets: every write claims a fresh v{N} and never overwrites", async () => {
  const dir = await Deno.makeTempDir();
  const bytes = new TextEncoder().encode("one");
  const a = await writeVersionedAsset(dir, "portrait.png", bytes);
  const b = await writeVersionedAsset(dir, "portrait.png", new TextEncoder().encode("two"));
  assert(a.ok && b.ok);
  assertEquals([a.path, b.path], ["assets/v1/portrait.png", "assets/v2/portrait.png"]);
  assertEquals(await Deno.readTextFile(`${dir}/assets/v1/portrait.png`), "one");
});

Deno.test("assets: names cannot climb out of the version directory", () => {
  assertEquals(sanitiseAssetName("../../etc/passwd"), "passwd");
  assertEquals(sanitiseAssetName("..hidden"), "hidden");
  assertEquals(sanitiseAssetName("a b/c?.png"), "c_.png");
  assertEquals(sanitiseAssetName("../"), null);
});
