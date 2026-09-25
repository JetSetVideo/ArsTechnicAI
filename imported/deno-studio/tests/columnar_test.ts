/**
 * columnar_test.ts — the parameter log.
 *
 * Pinned: append-only (no overwrite, no partial rows), schema evolution, typed
 * predicates, the textual filter, and a snapshot round trip.
 */

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { ColumnarError, ColumnarStore, parseFilter } from "../core/columnar.ts";

function seeded(): ColumnarStore {
  const s = new ColumnarStore();
  s.append({
    record_id: "r1",
    asset_id: "a1",
    model_name: "Nano Banana v2.1",
    guidance_scale: 7.0,
    seed: 40291823,
  });
  s.append({
    record_id: "r2",
    asset_id: "a2",
    model_name: "Nano Banana v2.1",
    guidance_scale: 8.5,
    seed: 40291823,
  });
  s.append({
    record_id: "r3",
    asset_id: "a3",
    model_name: "Flux Pro 1.1",
    guidance_scale: 9,
    seed: 7,
  });
  s.append({ record_id: "r4", asset_id: "a4", model_name: "Nano Banana v2.0", guidance_scale: 12 });
  return s;
}

Deno.test("columnar: the headline query — model and guidance scale", () => {
  const hits = seeded().query({
    where: [["model_name", "eq", "Nano Banana v2.1"], ["guidance_scale", "gt", 7.0]],
  });
  assertEquals(hits.map((r) => r.record_id), ["r2"]);
});

Deno.test("columnar: a record id is never overwritten", () => {
  const s = seeded();
  const err = assertThrows(
    () => s.append({ record_id: "r1", asset_id: "a1", guidance_scale: 1 }),
    ColumnarError,
  );
  assert(err.message.includes("append-only"));
  assertEquals(s.record("r1")!.guidance_scale, 7.0);
  assertEquals(s.size, 4);
});

Deno.test("columnar: a kind conflict is refused whole, leaving no partial row", () => {
  const s = seeded();
  assertThrows(
    () => s.append({ record_id: "r9", asset_id: "a9", new_field: 1, guidance_scale: "high" }),
    ColumnarError,
    "guidance_scale",
  );
  assertEquals(s.size, 4);
  assert(
    !s.schema().some((c) => c.field === "new_field"),
    "no column created by a rejected record",
  );
});

Deno.test("columnar: late fields read as null on earlier rows, and null never matches", () => {
  const s = seeded();
  s.append({ record_id: "r5", asset_id: "a5", vram_mb: 3840 });
  assertEquals(s.column("vram_mb"), [null, null, null, null, 3840]);
  assertEquals(s.select([["seed", "ne", 7]]).length, 2, "r4 and r5 have no seed and are excluded");
});

Deno.test("columnar: in, contains, ordering and limit", () => {
  const s = seeded();
  assertEquals(
    s.query({
      where: [["model_name", "contains", "banana"]],
      orderBy: { field: "guidance_scale", direction: "desc" },
      limit: 2,
    })
      .map((r) => r.record_id),
    ["r4", "r2"],
  );
  assertEquals(s.select([["model_name", "in", ["Flux Pro 1.1", "nope"]]]), [2]);
});

Deno.test("columnar: stats and distinct", () => {
  const s = seeded();
  const st = s.stats("guidance_scale");
  assertEquals([st.count, st.min, st.max], [4, 7, 12]);
  assertEquals(s.distinct("model_name")[0], { value: "Nano Banana v2.1", count: 2 });
});

Deno.test("columnar: growth past initial capacity keeps every value", () => {
  const s = new ColumnarStore();
  for (let i = 0; i < 1000; i++) {
    s.append({ record_id: `r${i}`, asset_id: `a${i}`, i, flag: i % 2 === 0 });
  }
  assertEquals(s.select([["i", "gte", 990], ["flag", "eq", true]]).length, 5);
  assertEquals(s.row(999).i, 999);
});

Deno.test("columnar: snapshot round trip", () => {
  const s = seeded();
  const back = ColumnarStore.fromSnapshot(JSON.parse(JSON.stringify(s.snapshot())));
  assertEquals(back.query(), s.query());
  assertEquals(back.schema(), s.schema());
});

Deno.test("parseFilter: reads the console's query syntax and refuses what it cannot", () => {
  assertEquals(parseFilter(`model_name = "Nano Banana v2.1" and guidance_scale > 7.0`), [
    ["model_name", "eq", "Nano Banana v2.1"],
    ["guidance_scale", "gt", 7],
  ]);
  assertEquals(parseFilter("prompt ~ wedding"), [["prompt", "contains", "wedding"]]);
  assertEquals(parseFilter("  "), []);
  assertThrows(() => parseFilter("guidance_scale >> 7"), ColumnarError, "guidance_scale >> 7");
});
