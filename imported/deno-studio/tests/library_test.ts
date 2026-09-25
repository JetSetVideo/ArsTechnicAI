/**
 * library_test.ts — the reference shelves, and the gate in front of the money.
 *
 * Two subjects that arrived together and are tested together because they meet
 * on the same card: a reference grants a shot specification, a model spends
 * money rendering it, and the interesting failures are at the join.
 */

import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  enrichReferences,
  KIND_COLOUR,
  mergeGrants,
  parseReferences,
  REFERENCE_KINDS,
  ReferenceLibrary,
} from "../core/library.ts";
import type { Grant, Reference, ReferenceFile } from "../core/library.ts";
import {
  CONSENT_TTL_MS,
  consentCovers,
  describeRun,
  estimateRun,
  formatCost,
  isLocal,
  localAlternative,
  model,
  MODELS,
  provider,
  PROVIDERS,
} from "../core/providers.ts";
import { loadLibrary } from "../bridge/library.ts";
import { validate } from "../core/cinema/rules.ts";

// ---------------------------------------------------------------------------
// The shelves as shipped
// ---------------------------------------------------------------------------

Deno.test("library: loads with no problems, and every kind has cards", async () => {
  const { references, problems } = await loadLibrary();
  assertEquals(problems, [], "the shipped library must load cleanly");

  const counts = references.counts();
  for (const kind of REFERENCE_KINDS) {
    assert(
      (counts[kind] ?? 0) > 0,
      `the '${kind}' shelf is empty — a category with no cards is a tab that ` +
        "opens on nothing, which reads as a broken build rather than as an absence",
    );
  }
  assert(references.size >= 150, `expected the full library, got ${references.size} cards`);
});

Deno.test("library: every movie card carries a config the rules can judge", async () => {
  const { references, presets } = await loadLibrary();
  const movies = references.byKind("movie");

  let judged = 0;
  for (const card of movies) {
    assert(
      card.grant.cinema !== undefined,
      `${card.id} grants no cinema config — the whole point of a movie card is that ` +
        "it hands a generate node a specification rather than a phrase",
    );
    // Not asserting the verdict: some presets legitimately describe impossible
    // rigs (a heavy body handheld), and that is a fact about the film data
    // worth surfacing, not a test failure. What must hold is that validation
    // *runs* and returns a graded answer rather than throwing.
    const result = validate(card.grant.cinema, presets);
    assert(["valid", "warning", "invalid"].includes(result.status));
    judged++;
  }
  assert(judged > 100, `only ${judged} movie cards were judged`);
});

Deno.test("library: no card points at a thumbnail that is not there", async () => {
  const { references } = await loadLibrary();
  const root = new URL("../library", import.meta.url).pathname;

  for (const card of references.all()) {
    if (card.thumb === undefined) continue;
    assert(card.thumb.startsWith("/library/"), `${card.id} thumb is not under /library/`);
    const path = `${root}/${card.thumb.slice("/library/".length)}`;
    const stat = await Deno.stat(path).catch(() => null);
    assert(
      stat?.isFile,
      `${card.id} points at ${card.thumb}, which does not exist. A card that renders ` +
        "a broken image reads as a bug; a card with no thumb reads as an absence.",
    );
  }
});

Deno.test("library: search is substring over name, summary and tags", async () => {
  const { references } = await loadLibrary();

  const noir = references.search("noir");
  assert(noir.length > 3, "expected several noir cards");

  const scoped = references.search("noir", "movie");
  assert(scoped.every((r) => r.kind === "movie"), "a kind-scoped search must not leak kinds");
  assert(scoped.length <= noir.length);

  assertEquals(references.search("").length, references.size, "an empty query returns everything");
  assertEquals(references.search("zzzznotathing").length, 0);
});

Deno.test("library: every kind has an accent colour", () => {
  for (const kind of REFERENCE_KINDS) {
    assert(/^#[0-9a-f]{6}$/i.test(KIND_COLOUR[kind]), `${kind} has no usable accent`);
  }
});

// ---------------------------------------------------------------------------
// Parsing and combining
// ---------------------------------------------------------------------------

Deno.test("library: ids are namespaced by kind, so two shelves cannot collide", () => {
  const file: ReferenceFile = {
    kind: "comic",
    entries: [{ id: "noir", name: "Noir", summary: "x" }],
  };
  const other: ReferenceFile = {
    kind: "star",
    entries: [{ id: "noir", name: "Noir", summary: "x" }],
  };
  const parsed = [...parseReferences(file), ...parseReferences(other)];
  assertEquals(parsed.map((r) => r.id), ["comic.noir", "star.noir"]);
  // Constructing must not throw: the namespacing is what prevents the clash.
  new ReferenceLibrary(parsed);
});

Deno.test("library: overlay fields are copied, and missing ones derive from year/summary/prompt", () => {
  const file: ReferenceFile = {
    kind: "comic",
    entries: [{
      id: "newsprint",
      name: "Newsprint",
      summary: "Four-colour on cheap paper.",
      year: 1940,
      tags: ["american", "print"],
      where: "newsstands",
      related: ["comic.other"],
      grant: { prompt: ["benday dots visible"] },
    }],
  };
  const [card] = parseReferences(file);
  assertEquals(card?.where, "newsstands");
  assertEquals(card?.when, "1940");
  assertEquals(card?.why, "Four-colour on cheap paper.");
  assertEquals(card?.how, "benday dots visible");
  assertEquals(card?.related?.map((r) => r.id), ["comic.other"]);
});

Deno.test("library: movie overlay is derived, and authored Blade Runner fields survive", async () => {
  const { references } = await loadLibrary();
  const blade = references.get("movie.blade_runner");
  assert(blade, "Blade Runner must be on the movie shelf");
  assertEquals(blade.where, "Los Angeles, 2019");
  assertEquals(blade.studio, "The Ladd Company / Warner Bros.");
  assertEquals(blade.length, "117 min");
  assertEquals(blade.score, 8.1);
  assert(blade.when?.includes("1982"), `when should carry the year, got ${blade.when}`);
  assert(blade.how && blade.how.length > 0, "how should be derived from cinematography");
  assert((blade.characters ?? []).includes("Deckard"));
  assert((blade.related ?? []).some((r) => r.id === "movie.alien"));
});

Deno.test("library: enrichReferences resolves related ids to name and kind", () => {
  const a: Reference = {
    id: "comic.a",
    kind: "comic",
    name: "A",
    summary: "aa",
    tags: ["print"],
    grant: {},
    related: [{ id: "comic.b" }],
  };
  const b: Reference = {
    id: "comic.b",
    kind: "comic",
    name: "B",
    summary: "bb",
    tags: ["print"],
    grant: {},
  };
  const [enriched] = enrichReferences([a, b]);
  assertEquals(enriched?.related, [{ id: "comic.b", name: "B", kind: "comic" }]);
});

Deno.test("library: a duplicate id is refused rather than silently shadowing", () => {
  const one: Reference = {
    id: "star.x",
    kind: "star",
    name: "X",
    summary: "",
    tags: [],
    grant: {},
  };
  assertThrows(
    () => new ReferenceLibrary([one, { ...one, name: "Y" }]),
    Error,
    "Duplicate reference id",
  );
});

Deno.test("mergeGrants: text unions in order and never repeats a line", () => {
  const a: Grant = { prompt: ["anamorphic flare", "hard key"], negative: ["blurry"] };
  const b: Grant = { prompt: ["hard key", "smoke"], negative: ["blurry", "watermark"] };

  const { grant } = mergeGrants([{ id: "a", grant: a }, { id: "b", grant: b }]);
  assertEquals(
    grant.prompt,
    ["anamorphic flare", "hard key", "smoke"],
    "a repeated line is a weighting signal to several models, so a duplicate " +
      "would change the image without anyone asking for it",
  );
  assertEquals(grant.negative, ["blurry", "watermark"]);
});

Deno.test("mergeGrants: two configs cannot merge, so the loser is named", async () => {
  const { references } = await loadLibrary();
  const first = references.byKind("movie").find((r) => r.grant.cinema)!;
  const second = references.byKind("movie").filter((r) => r.grant.cinema)[1]!;

  const { grant, cinemaFrom } = mergeGrants([
    { id: first.id, grant: first.grant },
    { id: second.id, grant: second.grant },
  ]);

  assertEquals(grant.cinema, second.grant.cinema, "the last config wins");
  assertEquals(
    cinemaFrom,
    [first.id, second.id],
    "both contributors are reported so a card can say which camera was overridden, " +
      "rather than leaving the user to find it in the output",
  );
});

Deno.test("mergeGrants: parameters union, later keys winning", () => {
  const { grant } = mergeGrants([
    { id: "a", grant: { params: { steps: 20, seed: 1 } } },
    { id: "b", grant: { params: { steps: 40 } } },
  ]);
  assertEquals(grant.params, { steps: 40, seed: 1 });
});

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

Deno.test("providers: every model names a provider that exists", () => {
  for (const spec of MODELS) {
    assert(provider(spec.provider) !== null, `${spec.id} names unknown provider ${spec.provider}`);
  }
});

Deno.test("providers: local models are free, remote models are not", () => {
  for (const spec of MODELS) {
    if (isLocal(spec)) {
      assertEquals(
        spec.centsPerCall,
        0,
        `${spec.id} runs locally but claims a price. The consent gate exempts local ` +
          "models entirely, so a priced local model would be gated for nothing.",
      );
    } else {
      assert(
        spec.centsPerCall > 0,
        `${spec.id} is remote and free, which would let it past the consent gate`,
      );
    }
  }
});

Deno.test("providers: every remote provider names the env var holding its key", () => {
  for (const p of PROVIDERS) {
    if (p.locality !== "remote") continue;
    assert(
      p.keyEnv !== undefined && p.keyEnv.length > 0,
      `${p.id} has no keyEnv, so a missing credential cannot be reported as ` +
        `"set X" — only as "authentication failed", which is not actionable`,
    );
  }
});

Deno.test("providers: a paid image model offers a free one that does the same job", () => {
  const paid = model("fal:flux/dev")!;
  const alternative = localAlternative(paid);
  assert(alternative !== null, "there is a local image model; it should be offered");
  assert(isLocal(alternative), "the alternative must actually be free");
  assertEquals(alternative.produces, paid.produces);
});

Deno.test("providers: a local model has no alternative to offer", () => {
  assertEquals(localAlternative(model("comfy:sdxl")!), null);
});

// ---------------------------------------------------------------------------
// Estimating
// ---------------------------------------------------------------------------

Deno.test("estimateRun: the 240-slice stack the README warns about", () => {
  const estimate = estimateRun([
    { modelId: "fal:flux-pro/v1.1", nodeId: "n1", count: 240 },
  ]);

  assertEquals(estimate.billedCalls, 240);
  assertEquals(estimate.localCalls, 0);
  assertEquals(estimate.cents, 1200);
  assertEquals(formatCost(estimate.cents), "about $12.00");
  assertEquals(
    describeRun(estimate),
    "240 paid calls · about $12.00",
    "the sentence must lead with the count, because the count is the part that " +
      "is exact and the part that surprises people",
  );
  assertEquals(estimate.byModel[0]?.localAlternative, "comfy:flux-dev");
});

Deno.test("estimateRun: local calls are counted but never billed", () => {
  const estimate = estimateRun([
    { modelId: "comfy:flux-dev", nodeId: "n1", count: 240 },
    { modelId: "fal:flux/schnell", nodeId: "n2", count: 4 },
  ]);
  assertEquals(estimate.localCalls, 240);
  assertEquals(estimate.billedCalls, 4);
  assertEquals(describeRun(estimate), "4 paid calls · about 1¢ · plus 240 local");
});

Deno.test("estimateRun: the dearest model is listed first", () => {
  const estimate = estimateRun([
    { modelId: "fal:flux/schnell", nodeId: "n1", count: 100 },
    { modelId: "replicate:tencent/hunyuan-video", nodeId: "n2", count: 2 },
  ]);
  assertEquals(
    estimate.byModel[0]?.modelId,
    "replicate:tencent/hunyuan-video",
    "two video calls cost more than a hundred Schnell calls, and the dialog should " +
      "say which line is responsible for the total",
  );
});

Deno.test("estimateRun: an unknown model is reported, not silently free", () => {
  const estimate = estimateRun([{ modelId: "fal:not-a-model", nodeId: "n1", count: 10 }]);
  assertEquals(estimate.cents, 0);
  assertEquals(estimate.unknownModels, ["fal:not-a-model"]);
});

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

const paid = () => estimateRun([{ modelId: "fal:flux/dev", nodeId: "n1", count: 10 }]);

Deno.test("consent: a free run never asks", () => {
  const estimate = estimateRun([{ modelId: "comfy:flux-dev", nodeId: "n1", count: 240 }]);
  assertEquals(consentCovers(estimate, "digest", null), { ok: true });
});

Deno.test("consent: a paid run with no token is refused, and says what it would cost", () => {
  const verdict = consentCovers(paid(), "digest", null);
  assert(!verdict.ok);
  assert(verdict.reason.includes("10 paid calls"));
  assert(verdict.reason.includes("25¢"));
});

Deno.test("consent: a token covers the run it was granted for", () => {
  const now = Date.now();
  const verdict = consentCovers(paid(), "digest", {
    graphDigest: "digest",
    maxCalls: 10,
    maxCents: 25,
    grantedAt: now,
  }, now);
  assertEquals(verdict, { ok: true });
});

Deno.test("consent: editing the graph invalidates the approval", () => {
  const now = Date.now();
  const verdict = consentCovers(paid(), "digest-after-edit", {
    graphDigest: "digest-before-edit",
    maxCalls: 999,
    maxCents: 99999,
    grantedAt: now,
  }, now);
  assert(!verdict.ok);
  assert(verdict.reason.includes("graph changed"));
});

Deno.test("consent: 'run one and stop' does not authorise the whole stack", () => {
  const now = Date.now();
  // The exact scenario the token type exists to prevent: approve a single test
  // slice, widen the stack, press Run again.
  const oneSlice = estimateRun([{ modelId: "fal:flux-pro/v1.1", nodeId: "n1", count: 1 }]);
  const token = {
    graphDigest: "same-graph",
    maxCalls: oneSlice.billedCalls,
    maxCents: oneSlice.cents,
    grantedAt: now,
  };
  assertEquals(consentCovers(oneSlice, "same-graph", token, now), { ok: true });

  const wholeStack = estimateRun([{ modelId: "fal:flux-pro/v1.1", nodeId: "n1", count: 240 }]);
  const verdict = consentCovers(wholeStack, "same-graph", token, now);
  assert(!verdict.ok, "a one-slice approval must not cover 240 slices");
  assert(verdict.reason.includes("Approved for 1 calls"));
});

Deno.test("consent: an approval goes stale", () => {
  const now = Date.now();
  const token = {
    graphDigest: "digest",
    maxCalls: 999,
    maxCents: 99999,
    grantedAt: now - CONSENT_TTL_MS - 1,
  };
  const verdict = consentCovers(paid(), "digest", token, now);
  assert(!verdict.ok);
  assert(verdict.reason.includes("expired"));
});

Deno.test("consent: a run naming an unpriceable model cannot be approved at all", () => {
  const estimate = estimateRun([
    { modelId: "fal:flux/dev", nodeId: "n1", count: 1 },
    { modelId: "mystery:model", nodeId: "n2", count: 1 },
  ]);
  const verdict = consentCovers(estimate, "digest", {
    graphDigest: "digest",
    maxCalls: 9999,
    maxCents: 99999,
    grantedAt: Date.now(),
  });
  assert(!verdict.ok, "consent cannot be asked for honestly when the cost is unknown");
  assert(verdict.reason.includes("mystery:model"));
});
