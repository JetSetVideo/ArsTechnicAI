/**
 * contract_test.ts — the seams between WIV and the engine.
 *
 * Three things are duplicated across the TypeScript and Python halves, each
 * for a stated reason, and each is a place where the two can silently drift
 * apart. These tests are what make "documented mirror" different from
 * "copy-paste that will rot":
 *
 *   1. Depth-layout constants — `core/spatial.ts` decides how a stack is drawn,
 *      `backend/zstack.py` decides how big to build its thumbnails. Disagree,
 *      and every slice is resampled in the browser.
 *   2. The set operators — `core/venn.ts` and `zstack.separate_layers` must
 *      compute the same four regions, or a preview and a render disagree.
 *   3. Generated artefacts — `gen/` must match what codegen produces now.
 *
 * These read Python source as text rather than executing it. Requiring a live
 * interpreter would make the check skippable exactly when it matters most: on
 * a machine where the engine is not set up, which is where a drifting constant
 * survives longest.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_DEPTH_STYLE } from "../core/spatial.ts";
import { PROPAGATION_MODES } from "../core/venn.ts";

const RESTORER_ROOT = Deno.env.get("RESTORER_ROOT") ??
  new URL("../../ArchiveRestorer", import.meta.url).pathname;

async function readEngineFile(relative: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(`${RESTORER_ROOT}/${relative}`);
  } catch {
    return null;
  }
}

/** Pull a module-level `NAME = <number>` out of Python source. */
function pythonConstant(source: string, name: string): number | null {
  const match = source.match(new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, "m"));
  return match?.[1] !== undefined ? Number(match[1]) : null;
}

Deno.test("contract: depth constants agree across the two runtimes", async () => {
  const source = await readEngineFile("backend/zstack.py");
  if (!source) {
    console.warn("zstack.py not found — skipping. Set RESTORER_ROOT to check the contract.");
    return;
  }

  assertEquals(
    pythonConstant(source, "MAX_VISIBLE_DEPTH"),
    DEFAULT_DEPTH_STYLE.maxVisibleDepth,
    "zstack.MAX_VISIBLE_DEPTH must equal DEFAULT_DEPTH_STYLE.maxVisibleDepth, " +
      "or the engine builds slices the canvas never draws (or omits ones it does).",
  );
  assertEquals(
    pythonConstant(source, "SCALE_PER_STEP"),
    DEFAULT_DEPTH_STYLE.scalePerStep,
    "zstack.SCALE_PER_STEP must equal DEFAULT_DEPTH_STYLE.scalePerStep, " +
      "or every slice is resampled in the browser to a size it was not built at.",
  );
});

Deno.test("contract: the engine builds no more slices than the canvas can draw", async () => {
  const source = await readEngineFile("backend/zstack.py");
  if (!source) return;
  const maxSlices = source.match(/^MAX_SLICES\s*=\s*2\s*\*\s*MAX_VISIBLE_DEPTH\s*\+\s*1/m);
  assert(
    maxSlices,
    "MAX_SLICES must be derived from MAX_VISIBLE_DEPTH, not written as a literal.",
  );
});

Deno.test("contract: both runtimes implement the same four regions, by the same names", async () => {
  const source = await readEngineFile("backend/zstack.py");
  if (!source) return;

  // TypeScript uses camelCase, Python snake_case; the mapping is 1:1 and total.
  const expected = PROPAGATION_MODES.map((m) =>
    m.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`)
  );
  for (const key of expected) {
    assert(
      source.includes(`"${key}"`),
      `zstack.separate_layers does not produce a "${key}" region; ` +
        "the four Venn modes must exist on both sides or a preview and a render disagree.",
    );
  }
});

Deno.test("contract: the Python operators are min/max, not multiply", async () => {
  const source = await readEngineFile("backend/zstack.py");
  if (!source) return;
  // core/venn.ts documents *why* min/max: multiplication eats a feathered
  // edge. If the Python side is ever "optimised" to a multiply, the two halves
  // stop agreeing on any soft matte.
  assert(source.includes("np.maximum(a, b)"), "union must be max, matching core/venn.ts");
  assert(source.includes("np.minimum(a, b)"), "intersection must be min, matching core/venn.ts");
  assert(
    source.includes("np.minimum(a, 255 - b)"),
    "A\\B must be min(a, 255-b) — intersection with the complement",
  );
  assert(source.includes("np.minimum(b, 255 - a)"), "B\\A must be min(b, 255-a)");
});

Deno.test("contract: generated artefacts are current", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-env",
      "--allow-run",
      new URL("../codegen/from_controls.ts", import.meta.url).pathname,
      "--check",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await command.output();
  assertEquals(
    code,
    0,
    `gen/ is out of date with the engine's schema. Run \`deno task codegen\`.\n${
      new TextDecoder().decode(stderr)
    }`,
  );
});
