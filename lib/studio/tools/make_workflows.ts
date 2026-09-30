/**
 * make_workflows.ts — author the shipped workflow library.
 *
 * A workflow is a *shape*, not a project: it names no reel, and the canvas
 * binds it to whatever is loaded. Writing them by hand as JSON is how ports
 * drift out of the registry, so they are built here with the real modules —
 * every wire goes through `connect()` and the same port resolver the canvas
 * uses, so an illegal wire fails at build time rather than on someone's
 * screen. Each one is then compiled and style-resolved before it is written.
 *
 *   deno task workflows          write any that are missing
 *   deno task workflows --force  rewrite them all
 *   deno task workflows --check  build and validate, write nothing (CI)
 *
 * The files land in `workflows/` with stable ids, so re-running replaces a
 * definition rather than accumulating copies. Anything already in that folder
 * with an id not listed here is left alone — the user's own saved flows live
 * there too.
 */

import {
  addNode,
  connect,
  emptyGraph,
  type GraphDocument,
  type NodeInstance,
} from "../core/graph.ts";
import { asGraphId, asNodeId, asNodeTypeId, asPortId } from "../core/ids.ts";
import type { NodeId } from "../core/ids.ts";
import { buildRegistry } from "../core/catalogue.ts";
import { cardHeight } from "../ui/render.ts";
import { snapPoint, vec2 } from "../core/spatial.ts";
import type { SignalValue } from "../core/ports.ts";
import { compileGraph } from "../bridge/engine.ts";
import { evaluateStyles } from "../core/style_eval.ts";
import { loadLibrary } from "../bridge/library.ts";
import { preRunReport, summarise } from "../core/diagnostics.ts";

const REGISTRY = buildRegistry();
const ROOT = new URL("../workflows/", import.meta.url).pathname;

const text = (value: string): SignalValue => ({ kind: "Text", value });
const num = (value: number): SignalValue => ({ kind: "Number", value });
const flag = (value: boolean): SignalValue => ({ kind: "Flag", value });
const pick = (value: string): SignalValue => ({ kind: "Enum", value });

/** A builder that keeps ids readable and lays cards out on a grid. */
class Flow {
  #graph: GraphDocument;
  #count = 0;

  constructor(id: string) {
    this.#graph = emptyGraph(asGraphId(id));
  }

  /** Place a node. `col`/`row` are grid cells, not pixels. */
  add(
    id: string,
    type: string,
    col: number,
    row: number,
    values: Record<string, SignalValue> = {},
  ): NodeId {
    const spec = REGISTRY.require(asNodeTypeId(type));
    const nodeId = asNodeId(id);
    // Seven rows is the card budget; the rest fold behind "+N more".
    const inputs = Math.min(7, spec.inputs.filter((p) => p.id !== "project_id").length);
    const node: NodeInstance = {
      id: nodeId,
      type: spec.id,
      name: spec.label,
      position: snapPoint(vec2(col * 300, row * 240)),
      size: {
        w: spec.size.w,
        h: cardHeight(inputs, spec.outputs.length, true, 0),
      },
      values,
      authoredBy: Object.fromEntries(Object.keys(values).map((k) => [k, "user" as const])),
      state: "idle",
      revision: 0,
      collapsed: false,
    };
    this.#graph = addNode(this.#graph, node);
    this.#count++;
    return nodeId;
  }

  /** Wire, through the canvas's own connection rules. */
  wire(from: string, fromPort: string, to: string, toPort: string): this {
    const result = connect(
      this.#graph,
      { node: asNodeId(from), port: asPortId(fromPort) },
      { node: asNodeId(to), port: asPortId(toPort) },
      (node, port, direction) => {
        const found = this.#graph.nodes[node];
        return found ? REGISTRY.port(found.type, port, direction) : null;
      },
    );
    if (!("edge" in result)) {
      throw new Error(
        `${from}.${fromPort} → ${to}.${toPort} is not a legal wire: ${result.refusal.message}`,
      );
    }
    this.#graph = result.graph;
    return this;
  }

  get graph(): GraphDocument {
    return this.#graph;
  }
  get size(): number {
    return this.#count;
  }
}

interface WorkflowSpec {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly mediaType: string;
  readonly build: () => Flow;
}

// ===========================================================================
// The library
// ===========================================================================

const WORKFLOWS: readonly WorkflowSpec[] = [
  {
    id: "restore-and-export",
    name: "Restore a reel and export it",
    note:
      "The full restoration pass: stabilise first (every temporal stage improves once frames are " +
      "aligned), then deflicker, repair dust, and balance contrast. The loop runs it over the frame " +
      "range and Render encodes the result.",
    mediaType: "reel",
    build: () => {
      const f = new Flow("restore-and-export");
      f.add("src", "source.sequence", 0, 0);
      f.add("stack", "flow.stack", 1, 0, { stride: num(1), wrap: flag(false) });
      f.add("stab", "stage.stabilize", 2, 0, { enabled: flag(true) });
      f.add("flick", "stage.deflicker", 3, 0, { enabled: flag(true) });
      f.add("dust", "stage.defect", 4, 0, { enabled: flag(true) });
      f.add("clahe", "stage.clahe", 5, 0, { enabled: flag(true) });
      f.add("collect", "flow.collect", 6, 0);
      f.add("render", "out.render", 7, 0, { fps: num(25), crf: num(18) });
      f.add("view", "out.view", 5, 1);
      return f
        .wire("src", "sequence", "stack", "sequence")
        .wire("src", "sequence", "stab", "neighbours")
        .wire("src", "sequence", "flick", "neighbours")
        .wire("src", "sequence", "dust", "neighbours")
        .wire("stack", "image", "stab", "image")
        .wire("stab", "image", "flick", "image")
        .wire("flick", "image", "dust", "image")
        .wire("dust", "image", "clahe", "image")
        .wire("clahe", "image", "collect", "image")
        .wire("clahe", "image", "view", "image")
        .wire("collect", "sequence", "render", "sequence");
    },
  },
  {
    id: "grade-one-frame",
    name: "Grade one frame",
    note:
      "The shortest useful graph: pick a frame, set levels and sharpening, and compare the result " +
      "against the source in the Viewer. Everything is local, so it costs nothing to iterate.",
    mediaType: "reel",
    build: () => {
      const f = new Flow("grade-one-frame");
      f.add("src", "source.sequence", 0, 0);
      f.add("frame", "source.frame", 1, 0, { index: num(0) });
      f.add("levels", "stage.levels", 2, 0, { enabled: flag(true) });
      f.add("sharp", "stage.sharpen", 3, 0, { enabled: flag(true) });
      f.add("view", "out.view", 4, 0);
      return f
        .wire("src", "sequence", "frame", "sequence")
        .wire("frame", "image", "levels", "image")
        .wire("levels", "image", "sharp", "image")
        .wire("sharp", "image", "view", "image")
        .wire("frame", "image", "view", "compare");
    },
  },
  {
    id: "isolate-subject-and-treat",
    name: "Treat the subject only",
    note: "Segment the subject, turn the matte into a region, and composite a differently graded " +
      "version through it. The background keeps its grain; the face gets the contrast.",
    mediaType: "reel",
    build: () => {
      const f = new Flow("isolate-subject-and-treat");
      f.add("src", "source.sequence", 0, 0);
      f.add("frame", "source.frame", 1, 0, { index: num(0) });
      f.add("seg", "mask.segment", 2, 1, { prompt: text("the people in the foreground") });
      f.add("region", "flow.propagate", 3, 1, { mode: pick("union") });
      f.add("clahe", "stage.clahe", 2, 0, { enabled: flag(true) });
      f.add("comp", "flow.composite", 4, 0, { opacity: num(1) });
      f.add("view", "out.view", 5, 0);
      return f
        .wire("src", "sequence", "frame", "sequence")
        .wire("frame", "image", "seg", "image")
        .wire("frame", "image", "clahe", "image")
        .wire("seg", "mask", "region", "a")
        .wire("frame", "image", "comp", "base")
        .wire("clahe", "image", "comp", "over")
        .wire("region", "mask", "comp", "mask")
        .wire("comp", "image", "view", "image")
        .wire("frame", "image", "view", "compare");
    },
  },
  {
    id: "reference-to-image",
    name: "Two references into one image",
    note:
      "A film supplies the camera, an archetype supplies the presence; Blend states which one won " +
      "the camera. Shot overrides the framing, Prompt renders it for the chosen model, and " +
      "Generate Image shows the exact string before you spend anything.",
    mediaType: "movie",
    build: () => {
      const f = new Flow("reference-to-image");
      f.add("film", "ref.card", 0, 0, {
        reference_id: text("movie.blade_runner"),
        weight: num(1),
      });
      f.add("who", "ref.card", 0, 1, {
        reference_id: text("star.hardboiled_detective"),
        weight: num(0.6),
      });
      f.add("blend", "ref.blend", 1, 0);
      f.add("shot", "ref.shot", 2, 0, {
        shot_size: text("MCU"),
        focal_length: num(50),
        time_of_day: pick("Night"),
        mood: text("Contemplative"),
      });
      f.add("prompt", "ref.prompt", 3, 0, {
        subject: text("a detective under a neon sign, rain on the collar"),
        target: pick("flux"),
        detail: pick("detailed"),
      });
      f.add("gen", "gen.image", 4, 0, {
        model: pick("comfy:flux-dev"),
        width: num(1024),
        height: num(1024),
        seed: num(-1),
      });
      f.add("save", "out.save", 5, 0, { name: text("neon-detective") });
      return f
        .wire("film", "style", "blend", "styles")
        .wire("who", "style", "blend", "styles")
        .wire("blend", "style", "shot", "base")
        .wire("shot", "style", "prompt", "style")
        .wire("shot", "style", "gen", "style")
        .wire("prompt", "positive", "gen", "prompt")
        .wire("prompt", "negative", "gen", "negative")
        .wire("gen", "image", "save", "image");
    },
  },
  {
    id: "restored-frame-to-generative",
    name: "Reimagine a restored frame",
    note: "Restoration first, generation second: the graded frame becomes the reference for an " +
      "image-to-image pass, so the model works from real photography rather than from nothing. " +
      "Strength decides how far it may travel.",
    mediaType: "reel",
    build: () => {
      const f = new Flow("restored-frame-to-generative");
      f.add("src", "source.sequence", 0, 0);
      f.add("frame", "source.frame", 1, 0, { index: num(0) });
      f.add("stab", "stage.stabilize", 2, 0, { enabled: flag(true) });
      f.add("clahe", "stage.clahe", 3, 0, { enabled: flag(true) });
      f.add("film", "ref.card", 2, 1, { reference_id: text("movie.the_godfather") });
      f.add("gen", "gen.image", 4, 0, {
        model: pick("comfy:flux-dev"),
        prompt: text("the same wedding, restored and colour-graded"),
        strength: num(0.35),
        seed: num(7),
      });
      f.add("view", "out.view", 5, 0);
      f.add("save", "out.save", 5, 1, { name: text("reimagined") });
      return f
        .wire("src", "sequence", "frame", "sequence")
        .wire("src", "sequence", "stab", "neighbours")
        .wire("frame", "image", "stab", "image")
        .wire("stab", "image", "clahe", "image")
        .wire("clahe", "image", "gen", "reference")
        .wire("film", "style", "gen", "style")
        .wire("gen", "image", "view", "image")
        .wire("clahe", "image", "view", "compare")
        .wire("gen", "image", "save", "image");
    },
  },
  {
    id: "shot-list-from-a-script",
    name: "Shot list from a script card",
    note:
      "A script shelf card and a film card go to a language model, which writes the shot list; its " +
      "text drives a generate node directly. Nothing here touches the restoration engine.",
    mediaType: "movie",
    build: () => {
      const f = new Flow("shot-list-from-a-script");
      f.add("script", "ref.card", 0, 0, { reference_id: text("script.two_hander") });
      f.add("film", "ref.card", 0, 1, { reference_id: text("movie.seven_samurai") });
      f.add("blend", "ref.blend", 1, 0);
      f.add("ask", "llm.ask", 2, 0, {
        model: pick("anthropic:claude-opus-5"),
        instruction: text("Break this scene into a numbered shot list. One line per shot."),
        context: text("A village at dawn, before the raid."),
      });
      f.add("gen", "gen.image", 3, 0, { model: pick("comfy:flux-dev"), seed: num(-1) });
      f.add("save", "out.save", 4, 0, { name: text("shot-01") });
      return f
        .wire("script", "style", "blend", "styles")
        .wire("film", "style", "blend", "styles")
        .wire("blend", "style", "ask", "style")
        .wire("blend", "style", "gen", "style")
        .wire("ask", "text", "gen", "prompt")
        .wire("gen", "image", "save", "image");
    },
  },
  {
    id: "subject-into-a-place",
    name: "Put a subject in a place",
    note:
      "Two things you wrote yourself — a character and a place from Home — blended with a film's " +
      "camera, so the shot is photographed like the reference and populated like your notes. The " +
      "Subject cards need ids from your own workspace; edit them on the canvas after loading.",
    mediaType: "movie",
    build: () => {
      const f = new Flow("subject-into-a-place");
      f.add("who", "ref.entity", 0, 0, { entity_id: text(""), traits: flag(true) });
      f.add("where", "ref.entity", 0, 1, { entity_id: text(""), traits: flag(true) });
      f.add("film", "ref.card", 0, 2, { reference_id: text("movie.in_the_mood_for_love") });
      f.add("blend", "ref.blend", 1, 0);
      f.add("shot", "ref.shot", 2, 0, {
        shot_size: text("MS"),
        focal_length: num(35),
        time_of_day: pick("Evening"),
      });
      f.add("prompt", "ref.prompt", 3, 0, {
        subject: text("standing at the window, half turned away"),
        avoid: text("modern clothing, text, watermark"),
        target: pick("flux"),
        detail: pick("brief"),
      });
      f.add("gen", "gen.image", 4, 0, { model: pick("comfy:flux-dev"), seed: num(-1) });
      f.add("save", "out.save", 5, 0, { name: text("subject-in-place"), format: pick("source") });
      return f
        .wire("who", "style", "blend", "styles")
        .wire("where", "style", "blend", "styles")
        .wire("film", "style", "blend", "styles")
        .wire("blend", "style", "shot", "base")
        .wire("shot", "style", "prompt", "style")
        .wire("shot", "style", "gen", "style")
        .wire("prompt", "positive", "gen", "prompt")
        .wire("prompt", "negative", "gen", "negative")
        .wire("gen", "image", "save", "image");
    },
  },
  {
    id: "depth-pass-over-a-range",
    name: "Look at a range in depth",
    note:
      "A Z Stack with a stride: run a light pass over every Nth frame and read the result as a " +
      "carousel in Inspect → Depth. Raise the stride to rough out a long reel cheaply, then drop " +
      "it back to 1.",
    mediaType: "reel",
    build: () => {
      const f = new Flow("depth-pass-over-a-range");
      f.add("src", "source.sequence", 0, 0);
      f.add("stack", "flow.stack", 1, 0, { stride: num(12), wrap: flag(true) });
      f.add("stab", "stage.stabilize", 2, 0, { enabled: flag(true) });
      f.add("levels", "stage.levels", 3, 0, { enabled: flag(true) });
      f.add("collect", "flow.collect", 4, 0);
      f.add("view", "out.view", 3, 1);
      return f
        .wire("src", "sequence", "stack", "sequence")
        .wire("src", "sequence", "stab", "neighbours")
        .wire("stack", "image", "stab", "image")
        .wire("stab", "image", "levels", "image")
        .wire("levels", "image", "collect", "image")
        .wire("levels", "image", "view", "image");
    },
  },
];

// ===========================================================================
// Build, validate, write
// ===========================================================================

async function main(): Promise<void> {
  const force = Deno.args.includes("--force");
  const checkOnly = Deno.args.includes("--check");
  const library = await loadLibrary();
  const styleOptions = {
    reference: (id: string) => library.references.get(id),
    presets: library.presets,
  };

  let failures = 0;
  let written = 0;

  for (const spec of WORKFLOWS) {
    const flow = spec.build();
    const graph = flow.graph;

    const compiled = compileGraph(graph, REGISTRY, 0);
    const errors = compiled.diagnostics.filter((d) => d.severity === "error");
    const styles = evaluateStyles(graph, REGISTRY, styleOptions);
    const styleErrors = styles.diagnostics.filter((d) => d.severity === "error");
    const report = preRunReport(graph, REGISTRY, { sequenceLength: 240 });

    const problems = [
      ...errors.map((d) => `compile: ${d.message}`),
      ...styleErrors.map((d) => `style: ${d.message}`),
    ];
    if (problems.length > 0) {
      failures++;
      console.log(`  FAIL  ${spec.id}\n        ${problems.join("\n        ")}`);
      continue;
    }

    console.log(
      `   ok   ${spec.id} — ${flow.size} nodes · ${compiled.steps.length} step(s) · ${
        summarise(report)
      }`,
    );

    if (checkOnly) continue;
    const path = `${ROOT}${spec.id}.json`;
    const exists = await Deno.stat(path).then(() => true).catch(() => false);
    if (exists && !force) continue;
    const payload = {
      id: spec.id,
      name: spec.name,
      note: spec.note,
      savedAt: Date.now(),
      media_type: spec.mediaType,
      graph,
    };
    await Deno.writeTextFile(path, JSON.stringify(payload, null, 2) + "\n");
    written++;
  }

  console.log(
    `\n${WORKFLOWS.length - failures}/${WORKFLOWS.length} workflows valid` +
      (checkOnly ? " (checked, nothing written)" : `, ${written} written to workflows/`),
  );
  Deno.exit(failures === 0 ? 0 : 1);
}

if (import.meta.main) await main();
