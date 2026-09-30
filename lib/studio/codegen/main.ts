/**
 * main.ts — run every generator, and pass the flags to all of them.
 *
 * There are two generators now — the restorer's stage nodes and the cinema
 * vocabulary — and there will be more. Chaining them in `deno.json` with `&&`
 * looks equivalent and is not: `deno task codegen --check` appends the flag to
 * the **last** command only, so the first generator ran in write mode and
 * happily rewrote the files the check existed to protect. A green `--check`
 * that had just overwritten its own evidence is worse than no check.
 *
 * So the task points here, and here forwards `Deno.args` to each generator
 * intact.
 *
 * Usage:
 *   deno task codegen            regenerate everything
 *   deno task codegen --check    fail if any generated file has drifted
 */

const GENERATORS: ReadonlyArray<{ name: string; module: string }> = [
  { name: "restorer stage nodes", module: "./from_controls.ts" },
  { name: "cinema vocabulary", module: "./from_cinema.ts" },
];

async function main(): Promise<void> {
  for (const generator of GENERATORS) {
    const module = await import(generator.module);
    if (typeof module.main !== "function") {
      console.error(`${generator.module} exports no main(); cannot run it.`);
      Deno.exit(2);
    }
    await module.main();
  }
}

if (import.meta.main) await main();
