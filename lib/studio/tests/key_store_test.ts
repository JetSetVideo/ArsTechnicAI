/**
 * key_store_test.ts — credentials are stored, never handed back.
 *
 * The properties pinned here are the ones a credential store is judged on:
 * the secret does not come back out of a read, the environment still wins,
 * forgetting is complete, and a local provider cannot be given a key it has no
 * use for.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import { providerStatuses, resolveKey, setKey, setPlan } from "../bridge/key_store.ts";

const noEnv = () => undefined;

async function root(): Promise<string> {
  return await Deno.makeTempDir({ prefix: "keys-" });
}

Deno.test("an empty store reports every provider honestly", async () => {
  const statuses = await providerStatuses(await root(), noEnv);
  assert(statuses.length >= 8, "the catalogue's providers are all listed");
  const fal = statuses.find((s) => s.id === "fal")!;
  assertEquals([fal.configured, fal.source, fal.tail], [false, "none", null]);
  const comfy = statuses.find((s) => s.id === "comfy")!;
  assertEquals([comfy.configured, comfy.source], [true, "not-needed"], "local needs no key");
});

Deno.test("a stored key configures a provider and never comes back", async () => {
  const dir = await root();
  const result = await setKey(dir, "fal", "fal-secret-abcd1234");
  assert(result.ok);
  assertEquals(result.status.configured, true);
  assertEquals(result.status.source, "stored");
  assertEquals(result.status.tail, "1234", "only the tail is ever exposed");

  const statuses = await providerStatuses(dir, noEnv);
  const serialised = JSON.stringify(statuses);
  assert(!serialised.includes("fal-secret-abcd1234"), "the key is not in any status payload");

  assertEquals(await resolveKey(dir, "fal", noEnv), "fal-secret-abcd1234");
});

Deno.test("the environment wins over the file", async () => {
  const dir = await root();
  await setKey(dir, "fal", "stored-key-0000");
  const env = (name: string) => name === "FAL_KEY" ? "environment-key-9999" : undefined;
  assertEquals(await resolveKey(dir, "fal", env), "environment-key-9999");
  const status = (await providerStatuses(dir, env)).find((s) => s.id === "fal")!;
  assertEquals(status.source, "environment");
});

Deno.test("forgetting a key removes it and keeps the plan note", async () => {
  const dir = await root();
  await setKey(dir, "openai", "sk-test-abcdefgh");
  await setPlan(dir, "openai", { label: "Team", capUsd: 50, renewsOn: "2026-10-01" });
  const cleared = await setKey(dir, "openai", "");
  assert(cleared.ok);
  assertEquals(cleared.status.configured, false);
  assertEquals(cleared.status.tail, null);
  assertEquals(cleared.status.plan?.label, "Team", "the subscription note is not a secret");
  assertEquals(await resolveKey(dir, "openai", noEnv), null);
  const onDisk = await Deno.readTextFile(`${dir}/.provider-keys.json`);
  assert(!onDisk.includes("sk-test-abcdefgh"), "the file no longer holds the secret");
});

Deno.test("the store file is not world-readable", async () => {
  const dir = await root();
  await setKey(dir, "replicate", "r8_abcdefghijkl");
  const info = await Deno.stat(`${dir}/.provider-keys.json`);
  if (info.mode !== null) assertEquals(info.mode & 0o077, 0, "no group or other permissions");
});

Deno.test("a local provider cannot be given a key, and an unknown one is refused", async () => {
  const dir = await root();
  const local = await setKey(dir, "comfy", "not-needed-here");
  assert(!local.ok && local.status === 400 && local.reason.includes("no key"));
  const unknown = await setKey(dir, "acme", "whatever-key-123");
  assert(!unknown.ok && unknown.status === 404);
});

Deno.test("a plan is validated rather than trusted", async () => {
  const dir = await root();
  const result = await setPlan(dir, "anthropic", {
    label: "x".repeat(200),
    capUsd: -5,
    renewsOn: "not-a-date",
    note: "monthly",
  });
  assert(result.ok);
  assertEquals(result.status.plan?.label?.length, 60);
  assertEquals(result.status.plan?.capUsd, undefined, "a negative cap is dropped");
  assertEquals(result.status.plan?.renewsOn, undefined, "a malformed date is dropped");
  assertEquals(result.status.plan?.note, "monthly");
});

Deno.test("a short string is not mistaken for a key", async () => {
  const dir = await root();
  const result = await setKey(dir, "stability", "abc");
  assert(!result.ok && result.reason.includes("does not look like"));
});
