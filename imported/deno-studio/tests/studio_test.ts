/**
 * studio_test.ts — blank project shape, and how a workflow names its medium.
 */

import { assertEquals } from "jsr:@std/assert@1";
import {
  createStudioManifest,
  inferFlowMediaType,
  isStudioMediaType,
  slugify,
} from "../core/studio.ts";

Deno.test("studio: create shape keeps Home/engine keys and studio-only fields", () => {
  const man = createStudioManifest({
    name: "Neon Noir",
    media_type: "movie",
    length: 120,
    tags: ["noir", "1970s"],
    models: ["comfy:workflow"],
  }, 1_700_000_000_000);

  assertEquals(man.project_id, "neon-noir-1700000000");
  assertEquals(man.name, "Neon Noir");
  assertEquals(man.source_name, "Neon Noir");
  assertEquals(man.media_type, "movie");
  assertEquals(man.length, "120");
  assertEquals(man.tags, ["noir", "1970s"]);
  assertEquals(man.models, ["comfy:workflow"]);
  assertEquals(man.favorite, false);
  assertEquals(man.frame_count, 0);
  assertEquals(man.origin, "studio");
  assertEquals(man.moodboard, []);
  assertEquals(man.assets, []);
  assertEquals(man.workflow_id, null);
  assertEquals(man.source_path, "");
  assertEquals(man.relations, {
    assets: [],
    references: [],
    workflows: [],
    projects: [],
  });
});

Deno.test("studio: unknown media_type falls back to movie, empty name to Untitled", () => {
  const man = createStudioManifest({ media_type: "hologram" });
  assertEquals(man.media_type, "movie");
  assertEquals(man.name, "Untitled");
  assertEquals(slugify("Grand Parents!"), "grand-parents");
  assertEquals(isStudioMediaType("manga"), true);
  assertEquals(isStudioMediaType("hologram"), false);
});

Deno.test("studio: a restoration graph is a reel when media_type is missing", () => {
  assertEquals(
    inferFlowMediaType({
      graph: {
        nodes: {
          n1: { type: "source.sequence" },
          n2: { type: "stage.stabilize" },
        },
      },
    }),
    "reel",
  );
  assertEquals(inferFlowMediaType({ media_type: "comic", graph: {} }), "comic");
});
