/**
 * entities_test.ts — the subjects a project keeps, and their material.
 *
 * An entity is the thing a hundred prompts must stay faithful to, so the
 * properties that matter are: edits never destroy what was there, media is
 * additive, a trait survives into the prompt verbatim, and an id cannot be
 * used to write outside the workspace.
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  applyEdit,
  createEntity,
  describeEntity,
  entityGrant,
  entityId,
  validateDraft,
} from "../core/entities.ts";
import {
  addMedia,
  getEntity,
  listEntities,
  mediaPath,
  saveEntity,
} from "../bridge/entity_store.ts";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3, 4]);

async function workspace(): Promise<string> {
  return await Deno.makeTempDir({ prefix: "entities-" });
}

Deno.test("an id is derived from the name and stays a single path segment", () => {
  const id = entityId("character", "Marie-Thérèse (grand-mère)", 1700000000000);
  assertStringIncludes(id, "character.marie-therese-grand-mere-");
  assert(!id.includes("/") && !id.includes(".."), id);
  assert(entityId("place", "").startsWith("place.untitled-"));
});

Deno.test("a draft is validated rather than trusted", () => {
  assertEquals(validateDraft({ kind: "character", name: "Marie" }), []);
  assert(validateDraft({ kind: "dragon", name: "x" })[0]!.includes("kind"));
  assert(validateDraft({ kind: "place", name: "   " })[0]!.includes("name is required"));
  assert(validateDraft({ kind: "place", name: "x", traits: "not a list" })[0]!.includes("list"));
  assert(
    validateDraft({ kind: "place", name: "x", traits: Array(40).fill("t") })[0]!.includes("24"),
  );
});

Deno.test("the grant leads with the subject and repeats every trait verbatim", () => {
  const entity = createEntity({
    kind: "character",
    name: "Grandmother Marie",
    summary: "the bride, 24, in a borrowed dress",
    description: "Married in Lyon in 1953.\n\nShe kept the dress.",
    traits: ["left-handed", "small burn scar on the right hand"],
  });
  const grant = entityGrant(entity);
  assertEquals(grant.prompt?.[0], "Grandmother Marie — the bride, 24, in a borrowed dress");
  assertEquals(grant.prompt?.[1], "left-handed");
  assertEquals(grant.prompt?.[2], "small burn scar on the right hand");
  assertStringIncludes(grant.prompt?.[3] ?? "", "Married in Lyon");
  assert(!(grant.prompt ?? []).some((l) => l.includes("She kept the dress")), "one paragraph only");
  assertEquals(grant.params?.entity_kind, "character");
  assertStringIncludes(describeEntity(entity), "Character");
});

Deno.test("an edit keeps the id and the media, and moves the timestamp", () => {
  const entity = createEntity({ kind: "place", name: "The kitchen" }, 1000);
  const edited = applyEdit(entity, { kind: "place", name: "The kitchen, 1953" }, 2000);
  assertEquals(edited.id, entity.id);
  assertEquals(edited.createdAt, 1000);
  assertEquals(edited.updatedAt, 2000);
  assertEquals(edited.media, entity.media);
});

Deno.test("every save writes a new version; the old text is still on disk", async () => {
  const dir = await workspace();
  const first = await saveEntity(dir, { kind: "character", name: "Marie", description: "First." });
  assert(first.ok);
  assertEquals(first.value.version, 1);
  const id = first.value.entity.id;

  const second = await saveEntity(dir, {
    kind: "character",
    name: "Marie",
    description: "Rewritten at midnight.",
  }, id);
  assert(second.ok);
  assertEquals(second.value.version, 2);

  const v1 = JSON.parse(await Deno.readTextFile(`${dir}/entities/${id}/entity.v1.json`));
  assertEquals(v1.description, "First.", "the earlier draft survives the rewrite");
  assertEquals((await getEntity(dir, id))!.description, "Rewritten at midnight.");
});

Deno.test("media is additive, each upload in its own version directory", async () => {
  const dir = await workspace();
  const created = await saveEntity(dir, { kind: "character", name: "Marie" });
  assert(created.ok);
  const id = created.value.entity.id;

  const drawing = await addMedia(dir, id, {
    bytes: png,
    contentType: "image/png",
    drawn: true,
    caption: "how she held the bouquet",
  });
  assert(drawing.ok);
  assertEquals(drawing.value.media.kind, "drawing");
  assertStringIncludes(drawing.value.media.path, `entities/${id}/media/v1/`);

  const photo = await addMedia(dir, id, {
    bytes: png,
    contentType: "image/png",
    filename: "scan.png",
  });
  assert(photo.ok);
  assertStringIncludes(photo.value.media.path, "/media/v2/");
  assertEquals(photo.value.entity.media.length, 2);
  assertEquals((await getEntity(dir, id))!.media.length, 2);
});

Deno.test("material it cannot hold is refused with a reason", async () => {
  const dir = await workspace();
  const created = await saveEntity(dir, { kind: "prop", name: "The dress" });
  assert(created.ok);
  const bad = await addMedia(dir, created.value.entity.id, {
    bytes: png,
    contentType: "application/x-msdownload",
  });
  assert(!bad.ok && bad.status === 415 && bad.reason.includes("not a kind of material"));

  const empty = await addMedia(dir, created.value.entity.id, {
    bytes: new Uint8Array(),
    contentType: "image/png",
  });
  assert(!empty.ok && empty.status === 400);
});

Deno.test("an id cannot be used to write outside the entities tree", async () => {
  const dir = await workspace();
  for (const id of ["../escape", "character./../x", "not-an-id", "character.ok/../../x"]) {
    const result = await saveEntity(dir, { kind: "character", name: "x" }, id);
    assert(!result.ok, `${id} was accepted`);
  }
  assertEquals(mediaPath(dir, "../../etc/passwd"), null);
  assertEquals(mediaPath(dir, "workflows/x.json"), null);
  assert(mediaPath(dir, "entities/character.a-1/media/v1/x.png")?.startsWith(dir));
});

Deno.test("listing is newest first and survives a stray directory", async () => {
  const dir = await workspace();
  const a = await saveEntity(dir, { kind: "character", name: "A" });
  await new Promise((r) => setTimeout(r, 5));
  const b = await saveEntity(dir, { kind: "place", name: "B" });
  assert(a.ok && b.ok);
  await Deno.mkdir(`${dir}/entities/not-an-entity`, { recursive: true });
  const list = await listEntities(dir);
  assertEquals(list.map((e) => e.name), ["B", "A"]);
});
