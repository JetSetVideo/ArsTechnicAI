/**
 * inspect_test.ts — the inspector's render keying.
 *
 * The bug this pins: the inspector rebuilt on every paint, so a slider was
 * destroyed by the commit its own input caused and the pane scrolled to the
 * top whenever the canvas moved. `RenderKey` is the rule that stops both.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import { ago, RenderKey } from "../ui/inspect.ts";

Deno.test("RenderKey: an unchanged key never rebuilds, however often it is asked", () => {
  const k = new RenderKey();
  assert(k.claim("a"), "first look builds");
  for (let i = 0; i < 100; i++) assertEquals(k.claim("a"), false);
});

Deno.test("RenderKey: a change from elsewhere rebuilds", () => {
  const k = new RenderKey();
  k.claim("rev1");
  assert(k.claim("rev2"));
});

Deno.test("RenderKey: the inspector's own edit is absorbed — the slider survives its drag", () => {
  const k = new RenderKey();
  k.claim("rev1");
  k.absorb(); // input event on a slider
  assertEquals(k.claim("rev2"), false, "own edit does not rebuild");
  assertEquals(k.claim("rev2"), false);
  assert(k.claim("rev3"), "the next external change still does");
});

Deno.test("RenderKey: absorb is consumed by a change, not by a no-op look", () => {
  const k = new RenderKey();
  k.claim("rev1");
  k.absorb();
  assertEquals(k.claim("rev1"), false); // a paint before the commit landed
  assertEquals(k.claim("rev2"), false, "the commit is still absorbed");
});

Deno.test("RenderKey: reset forces the next look to build (pane re-shown)", () => {
  const k = new RenderKey();
  k.claim("x");
  k.reset();
  assert(k.claim("x"));
});

Deno.test("ago: readable ages", () => {
  const now = 10_000_000_000;
  assertEquals(ago(now - 5_000, now), "5s ago");
  assertEquals(ago(now - 3 * 60_000, now), "3 min ago");
  assertEquals(ago(now - 2 * 3_600_000, now), "2 h ago");
  assertEquals(ago(now - 26 * 3_600_000, now), "yesterday");
  assertEquals(ago(now + 5_000, now), "0s ago", "clock skew is not a negative age");
});
