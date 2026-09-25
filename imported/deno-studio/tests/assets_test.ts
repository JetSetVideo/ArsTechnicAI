/**
 * assets_test.ts — the asset ledger.
 *
 * The behaviours pinned here are the ones the ledger exists to guarantee, and
 * each is a thing the donor's model got wrong (see `docs/MERGE_PLAN.md` §1.3):
 * history that survives, deletion that is recoverable, relations that can be
 * walked in both directions, and aggregation that is computed once.
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  type AssetLedger,
  childrenOf,
  deserialise,
  emptyLedger,
  historyOf,
  latestOf,
  parentsOf,
  record,
  retire,
  serialise,
  star,
  summarise,
  VERSIONS_PER_NODE,
} from "../core/assets.ts";
import { asNodeId } from "../core/ids.ts";

const A = asNodeId("nA");
const B = asNodeId("nB");

function withVersion(
  ledger: AssetLedger,
  node = A,
  params: Record<string, unknown> = {},
  extra: Partial<Parameters<typeof record>[1]> = {},
): AssetLedger {
  return record(ledger, {
    node,
    frame: 0,
    source: "remixed",
    params,
    image: "data:image/png;base64,AAAA",
    ...extra,
  });
}

Deno.test("record: the first result of a node is v1", () => {
  const ledger = withVersion(emptyLedger());
  const latest = latestOf(ledger, A);
  assertExists(latest);
  assertEquals(latest.version, 1);
  assertEquals(latest.node, A);
  assertEquals(latest.state, "ready");
});

Deno.test("record: versions number per node, not globally", () => {
  let ledger = withVersion(emptyLedger(), A, { a: 1 });
  ledger = withVersion(ledger, B, { b: 1 });
  ledger = withVersion(ledger, A, { a: 2 });

  assertEquals(historyOf(ledger, A).map((v) => v.version), [1, 2]);
  assertEquals(historyOf(ledger, B).map((v) => v.version), [1]);
});

Deno.test("record: re-running an unchanged node does not add a version", () => {
  // Otherwise scrubbing a 300-slice stack buries every real decision under
  // three hundred identical entries.
  let ledger = withVersion(emptyLedger(), A, { clip: 2 });
  const before = ledger.versions.length;
  ledger = withVersion(ledger, A, { clip: 2 });
  assertEquals(ledger.versions.length, before);
});

Deno.test("record: changing a parameter does add a version", () => {
  let ledger = withVersion(emptyLedger(), A, { clip: 2 });
  ledger = withVersion(ledger, A, { clip: 3 });
  assertEquals(historyOf(ledger, A).length, 2);
});

Deno.test("record: the digest addresses the parameters, not the pixels", () => {
  // Two runs with the same request must collide even though the engine
  // re-encodes and hands back different bytes each time.
  let ledger = withVersion(emptyLedger(), A, { clip: 2 }, { image: "data:image/png;base64,ONE" });
  ledger = withVersion(ledger, A, { clip: 2 }, { image: "data:image/png;base64,TWO" });
  assertEquals(historyOf(ledger, A).length, 1);
});

Deno.test("record: a failed result is always recorded, even unchanged", () => {
  // A retry after a failure is a real event; collapsing it would hide the
  // fact that the same request was attempted twice.
  let ledger = withVersion(emptyLedger(), A, { clip: 2 }, { state: "failed" });
  ledger = withVersion(ledger, A, { clip: 2 }, { state: "failed" });
  assertEquals(historyOf(ledger, A).length, 2);
});

Deno.test("relations: lineage walks in both directions", () => {
  let ledger = withVersion(emptyLedger(), A, { a: 1 });
  const parent = latestOf(ledger, A)!;
  ledger = withVersion(ledger, B, { b: 1 }, { parents: [parent.id] });
  const child = latestOf(ledger, B)!;

  assertEquals(parentsOf(ledger, child.id).map((v) => v.id), [parent.id]);
  assertEquals(childrenOf(ledger, parent.id).map((v) => v.id), [child.id]);
});

Deno.test("relations: successive versions of a node are variants, not ancestors", () => {
  let ledger = withVersion(emptyLedger(), A, { clip: 2 });
  const first = latestOf(ledger, A)!;
  ledger = withVersion(ledger, A, { clip: 3 });
  const second = latestOf(ledger, A)!;

  // A re-run is a sibling: the two are alternatives to choose between, and
  // drawing them as a chain would misread that choice as a sequence.
  assert(
    ledger.relations.some((r) =>
      r.from === second.id && r.to === first.id && r.type === "variant_of"
    ),
  );
  assertEquals(parentsOf(ledger, second.id).length, 0);
});

Deno.test("retire: a retired version stays in the history", () => {
  let ledger = withVersion(emptyLedger(), A, { clip: 2 });
  const only = latestOf(ledger, A)!;
  ledger = retire(ledger, only.id);

  // Soft delete: gone from what is offered, present in what is recorded.
  assertEquals(historyOf(ledger, A).length, 1);
  assertEquals(historyOf(ledger, A)[0]!.state, "retired");
  assertEquals(latestOf(ledger, A), undefined);
});

Deno.test("compact: old pixels are dropped, old versions are not", () => {
  let ledger = emptyLedger();
  for (let i = 0; i < VERSIONS_PER_NODE + 5; i += 1) {
    ledger = withVersion(ledger, A, { clip: i });
  }
  const history = historyOf(ledger, A);

  assertEquals(history.length, VERSIONS_PER_NODE + 5, "every version survives");
  assertEquals(
    history.filter((v) => v.image).length,
    VERSIONS_PER_NODE,
    "only the newest keep their pixels",
  );
  // The evicted ones stay replayable: the request that made them is intact.
  assert(history.every((v) => v.digest.length > 0));
});

Deno.test("compact: a starred version keeps its pixels regardless of age", () => {
  let ledger = withVersion(emptyLedger(), A, { clip: -1 });
  const keeper = latestOf(ledger, A)!;
  ledger = star(ledger, keeper.id, true);
  for (let i = 0; i < VERSIONS_PER_NODE + 5; i += 1) {
    ledger = withVersion(ledger, A, { clip: i });
  }
  assertExists(historyOf(ledger, A).find((v) => v.id === keeper.id)?.image);
});

Deno.test("summarise: counts by state and source in one pass", () => {
  let ledger = withVersion(emptyLedger(), A, { a: 1 }, { source: "imported", elapsedMs: 10 });
  ledger = withVersion(ledger, B, { b: 1 }, { source: "remixed", elapsedMs: 32 });
  ledger = withVersion(ledger, B, { b: 2 }, { source: "remixed", state: "failed" });

  const stats = summarise(ledger);
  assertEquals(stats.total, 3);
  assertEquals(stats.nodes, 2);
  assertEquals(stats.ready, 2);
  assertEquals(stats.failed, 1);
  assertEquals(stats.bySource.imported, 1);
  assertEquals(stats.bySource.remixed, 2);
  assertEquals(stats.engineMs, 42);
});

Deno.test("summarise: the revision moves on every accepted write", () => {
  const one = withVersion(emptyLedger(), A, { a: 1 });
  const two = withVersion(one, A, { a: 2 });
  assert(two.revision > one.revision, "callers cache the summary on this");
});

Deno.test("persistence: a round trip keeps the history and drops the pixels", () => {
  let ledger = withVersion(emptyLedger(), A, { a: 1 });
  const parent = latestOf(ledger, A)!;
  ledger = withVersion(ledger, B, { b: 1 }, { parents: [parent.id] });

  const back = deserialise(serialise(ledger));

  assertEquals(back.versions.length, ledger.versions.length);
  assertEquals(back.relations.length, ledger.relations.length);
  assert(back.versions.every((v) => v.image === undefined), "pixels are recomputable, so unsaved");
  // The graph of relations is what cannot be recomputed, so it must survive.
  const child = latestOf(back, B)!;
  assertEquals(parentsOf(back, child.id).map((v) => v.id), [parent.id]);
});

Deno.test("persistence: corrupt storage yields an empty ledger, not a throw", () => {
  // localStorage is shared, hand-editable, and survives version changes.
  assertEquals(deserialise("not json").versions.length, 0);
  assertEquals(deserialise('{"versions":"nope"}').versions.length, 0);
});

Deno.test("record: a dedupe still adopts parents it did not know about", () => {
  // A chain run end-first records the tail before its upstream nodes have any
  // version at all. Running the stages afterwards must not leave the tail
  // orphaned just because its own result did not change.
  let ledger = withVersion(emptyLedger(), B, { b: 1 });
  const orphan = latestOf(ledger, B)!;
  assertEquals(parentsOf(ledger, orphan.id).length, 0);

  ledger = withVersion(ledger, A, { a: 1 });
  const parent = latestOf(ledger, A)!;
  ledger = withVersion(ledger, B, { b: 1 }, { parents: [parent.id] });

  assertEquals(historyOf(ledger, B).length, 1, "no second version for an unchanged result");
  assertEquals(parentsOf(ledger, orphan.id).map((v) => v.id), [parent.id], "but the link is there");
});

Deno.test("record: adopting parents does not duplicate a link already held", () => {
  let ledger = withVersion(emptyLedger(), A, { a: 1 });
  const parent = latestOf(ledger, A)!;
  ledger = withVersion(ledger, B, { b: 1 }, { parents: [parent.id] });
  const before = ledger.relations.length;

  ledger = withVersion(ledger, B, { b: 1 }, { parents: [parent.id] });
  assertEquals(ledger.relations.length, before, "a repeated run adds nothing");
});
