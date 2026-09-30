/**
 * gen_nodes.ts — the cards that turn a reference into media.
 *
 * The restoration graph answers "make this footage good again". These answer
 * "make this thing exist", and they are what the library is for: a `ref.card`
 * carries *Blade Runner*'s camera, stock and lighting; a `gen.image` turns
 * that into a request; a `gen.video` turns it into a clip.
 *
 * ## Why these are hand-authored and the stage nodes are not
 *
 * The ten `stage.*` nodes are generated from the engine's parameter schema
 * because they are one-to-one with it. There is no equivalent schema here:
 * every provider describes its own models differently, and the shared surface
 * is small — a prompt, a seed, a size, and a model id. So the *catalogue* is
 * data (`core/providers.ts`) and the *ports* are hand-authored, which keeps a
 * new model to a one-line catalogue entry rather than a code change.
 *
 * ## The shape of a generate node
 *
 * Every `gen.*` node takes a `Style` and a `Text`, and takes them *separately*.
 * That looks redundant and is the central design decision here: the Style
 * carries what the reference knows (2.39:1, Panavision C-Series, low-key neon)
 * and the Text carries what only the user knows (what is actually happening in
 * the shot). Merging them earlier would mean the user typing a camera into a
 * sentence, which is precisely the guesswork the cinema layer removes.
 *
 * [AGENT-SECURITY] Every node here is `cost: "network"` except where it names
 * a local provider, and the evaluator will not run a `network` node as a side
 * effect of an upstream edit. `core/providers.ts` decides what a run costs and
 * `consentCovers` decides whether it may happen; nothing in this file spends
 * money on its own.
 */

import { asNodeTypeId, asPortId } from "./ids.ts";
import type { NodeTypeSpec } from "./registry.ts";
import { MODELS } from "./providers.ts";
import type { MediaKind } from "./providers.ts";

/**
 * The model ids a node of this kind may name, as a closed enum on the port.
 *
 * Derived from the catalogue rather than listed, so adding a model to
 * `providers.ts` puts it in the picker with no second edit. The list is sorted
 * with local models first: the free option should be the one your eye lands on.
 */
function modelOptions(kind: MediaKind): string[] {
  return MODELS.filter((m) => m.produces === kind)
    .sort((a, b) => Number(b.centsPerCall === 0) - Number(a.centsPerCall === 0))
    .map((m) => m.id);
}

const firstOption = (kind: MediaKind): string => modelOptions(kind)[0] ?? "";

// ===========================================================================
// References
// ===========================================================================

/**
 * One card from the library, on the canvas.
 *
 * The id is a `Text` input rather than an enum because the library is
 * user-extensible: a closed option list would have to be regenerated every
 * time someone adds a film, and a graph saved against a card that has since
 * been renamed must still open. An unknown id resolves to no grant and says
 * so, rather than refusing to load the graph.
 */
export const REF_CARD: NodeTypeSpec = {
  id: asNodeTypeId("ref.card"),
  category: "source",
  label: "Reference",
  hint:
    "A film, archetype, comic idiom or scene form from the library. Grants its camera, lighting and grammar to whatever it feeds.",
  cost: "local",
  engineStage: null,
  size: { w: 250, h: 190 },
  inputs: [
    {
      id: asPortId("reference_id"),
      label: "Card",
      direction: "input",
      kind: "Text",
      help:
        "Which library card, by id — `movie.blade_runner`, `comic.ligne_claire`, `star.femme_fatale`. Drag one in from the Library tab rather than typing it.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("weight"),
      label: "Weight",
      direction: "input",
      kind: "Number",
      help:
        "How strongly this reference is asserted when several are merged. Has no effect on the shot config, which is not a quantity — only on the ordering of the prose it contributes.",
      range: { min: 0, max: 1, step: 0.05 },
      defaultValue: { kind: "Number", value: 1 },
    },
  ],
  outputs: [
    {
      id: asPortId("style"),
      label: "Style",
      direction: "output",
      kind: "Style",
      help:
        "The card's grant: a full shot specification plus its prose. Feed this to a generate node, or to a Blend to combine it with others.",
    },
    {
      id: asPortId("thumb"),
      label: "Frame",
      direction: "output",
      kind: "Image",
      help:
        "The card's reference frame, where it has one. Useful as an img2img seed or a colour target.",
    },
  ],
};

/**
 * Several references, combined.
 *
 * Variadic because the interesting combinations are three or four deep — a
 * film for the camera, an archetype for the casting, a comic for the drawing,
 * a scene form for the coverage. `mergeGrants` in `core/library.ts` decides
 * what combining means, and reports which reference's camera survived rather
 * than picking one quietly.
 */
export const REF_BLEND: NodeTypeSpec = {
  id: asNodeTypeId("ref.blend"),
  category: "flow",
  label: "Blend References",
  hint:
    "Merge several references into one style. Prose accumulates; only one shot specification can survive, and the card says whose.",
  cost: "local",
  engineStage: null,
  size: { w: 236, h: 160 },
  inputs: [
    {
      id: asPortId("styles"),
      label: "Styles",
      direction: "input",
      kind: "Style",
      help:
        "The references to merge, in order. Later cards override earlier ones where they conflict.",
      variadic: true,
    },
  ],
  outputs: [
    {
      id: asPortId("style"),
      label: "Style",
      direction: "output",
      kind: "Style",
      help: "The merged grant.",
    },
    {
      id: asPortId("conflicts"),
      label: "Conflicts",
      direction: "output",
      kind: "Text",
      help:
        "Which references supplied a shot specification, when more than one did. Empty when the merge was unambiguous.",
    },
  ],
};

/**
 * The shot itself, edited by hand.
 *
 * The escape hatch from the library: everything a reference grants can be
 * overridden here, and the rules engine validates the result. Its output is
 * still a `Style`, so it drops into the same socket a reference would.
 */
export const REF_SHOT: NodeTypeSpec = {
  id: asNodeTypeId("ref.shot"),
  category: "source",
  label: "Shot",
  hint:
    "Author a shot directly — body, glass, stock, light, framing. Validated against what could physically have been photographed.",
  cost: "local",
  engineStage: null,
  size: { w: 260, h: 300 },
  inputs: [
    {
      id: asPortId("base"),
      label: "Start from",
      direction: "input",
      kind: "Style",
      help:
        "A reference to start from. Anything set below overrides it; anything left empty is inherited.",
      optional: true,
    },
    {
      id: asPortId("shot_size"),
      label: "Shot size",
      direction: "input",
      kind: "Text",
      help: "EWS, WS, MWS, MS, MCU, CU, BCU, ECU, OTS, POV. Empty inherits.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("focal_length"),
      label: "Focal length",
      direction: "input",
      kind: "Number",
      help:
        "Millimetres. Under 35 on a close-up distorts a face, which the validator will mention; over 85 on a wide compresses hard.",
      range: { min: 8, max: 1200, step: 1, unit: "mm" },
      defaultValue: { kind: "Number", value: 50 },
    },
    {
      id: asPortId("time_of_day"),
      label: "Time of day",
      direction: "input",
      kind: "Enum",
      help:
        "Sets what light is physically available. Blue hour with a sun key is refused, not warned about.",
      options: [
        "Dawn",
        "Morning",
        "Midday",
        "Afternoon",
        "Golden_Hour",
        "Blue_Hour",
        "Night",
        "Interior_Day",
        "Interior_Night",
      ],
      defaultValue: { kind: "Enum", value: "Afternoon" },
    },
    {
      id: asPortId("mood"),
      label: "Mood",
      direction: "input",
      kind: "Text",
      help: "One term from the mood vocabulary. Empty inherits from the base reference.",
      defaultValue: { kind: "Text", value: "" },
    },
  ],
  outputs: [
    {
      id: asPortId("style"),
      label: "Style",
      direction: "output",
      kind: "Style",
      help: "The edited shot specification.",
    },
    {
      id: asPortId("diagnostics"),
      label: "Notes",
      direction: "output",
      kind: "Text",
      help:
        "What the rules make of this shot: impossible pairings as errors, self-contradicting ones as warnings.",
    },
  ],
};

/**
 * The rendered prompt, so it can be read before it is spent.
 *
 * A separate node rather than a field on the generate card, because the whole
 * argument of the cinema layer is that the prompt is *derived*. Being able to
 * put the derivation on the canvas and look at it is what makes that claim
 * checkable rather than a promise.
 */
export const REF_PROMPT: NodeTypeSpec = {
  id: asNodeTypeId("ref.prompt"),
  category: "flow",
  label: "Prompt",
  hint:
    "Render a style into the string a particular model reads best. Look at it before you spend a run on it.",
  cost: "local",
  engineStage: null,
  size: { w: 250, h: 200 },
  inputs: [
    {
      id: asPortId("style"),
      label: "Style",
      direction: "input",
      kind: "Style",
      help: "The shot specification to render.",
      optional: true,
    },
    {
      id: asPortId("subject"),
      label: "Subject",
      direction: "input",
      kind: "Text",
      help:
        "What is actually happening in the shot. The style says how it is photographed; this says what it is.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("target"),
      label: "Dialect",
      direction: "input",
      kind: "Enum",
      help:
        "Which model's dialect to write for. Midjourney takes flags, FLUX takes sentences and no negative, CogVideoX truncates hard.",
      options: [
        "generic",
        "midjourney",
        "flux",
        "wan2.2",
        "runway",
        "pika",
        "cogvideo",
        "hunyuan",
        "mochi",
        "ltx",
        "sdxl",
      ],
      defaultValue: { kind: "Enum", value: "generic" },
    },
    {
      id: asPortId("detail"),
      label: "Detail",
      direction: "input",
      kind: "Enum",
      help:
        "`brief` is the working prompt; `detailed` spells out the camera system and stands alone in a log.",
      options: ["brief", "detailed"],
      defaultValue: { kind: "Enum", value: "brief" },
    },
  ],
  outputs: [
    {
      id: asPortId("positive"),
      label: "Prompt",
      direction: "output",
      kind: "Text",
      help: "The rendered positive prompt.",
    },
    {
      id: asPortId("negative"),
      label: "Avoid",
      direction: "output",
      kind: "Text",
      help: "The negative prompt, where the target model has one. Empty for FLUX and Wan.",
    },
  ],
};

// ===========================================================================
// Generation
// ===========================================================================

/** Ports every generate node shares, so a model swap never moves a socket. */
function generateInputs(kind: MediaKind) {
  return [
    {
      id: asPortId("model"),
      label: "Model",
      direction: "input" as const,
      kind: "Enum" as const,
      help:
        "Which model runs this. Local models are listed first and cost nothing; anything else is billed per call and needs confirming before a run.",
      options: modelOptions(kind),
      defaultValue: { kind: "Enum" as const, value: firstOption(kind) },
    },
    {
      id: asPortId("style"),
      label: "Style",
      direction: "input" as const,
      kind: "Style" as const,
      help:
        "A reference or an authored shot. Rendered into this model's own prompt dialect automatically.",
      // Unwired means text-to-X from the prompt alone, which is a normal way
      // to run every one of these nodes.
      optional: true,
    },
    {
      id: asPortId("prompt"),
      label: "Prompt",
      direction: "input" as const,
      kind: "Text" as const,
      help:
        "What is in the shot. Combined with the style rather than replacing it — wire a Prompt node here to control the join by hand.",
      defaultValue: { kind: "Text" as const, value: "" },
    },
    {
      id: asPortId("negative"),
      label: "Avoid",
      direction: "input" as const,
      kind: "Text" as const,
      help: "What must not appear. Ignored by models that take no negative prompt.",
      defaultValue: { kind: "Text" as const, value: "" },
    },
    {
      id: asPortId("seed"),
      label: "Seed",
      direction: "input" as const,
      kind: "Number" as const,
      help:
        "Fixes the result. −1 draws a new one per call. Inside a Z stack the slice index is added, so a stack varies without you wiring anything.",
      range: { min: -1, max: 2147483647, step: 1 },
      defaultValue: { kind: "Number" as const, value: -1 },
    },
  ];
}

export const GEN_IMAGE: NodeTypeSpec = {
  id: asNodeTypeId("gen.image"),
  category: "ai",
  label: "Generate Image",
  hint: "One still, from a style and a prompt, on whichever model you pick.",
  cost: "network",
  engineStage: null,
  size: { w: 264, h: 290 },
  inputs: [
    ...generateInputs("image"),
    {
      id: asPortId("reference"),
      label: "From frame",
      direction: "input",
      kind: "Image",
      help:
        "An image to work from, turning this into img2img. Leave unwired for text-to-image. Not every model accepts one.",
      optional: true,
    },
    {
      id: asPortId("strength"),
      label: "Strength",
      direction: "input",
      kind: "Number",
      help:
        "How far from the source frame to travel, when one is wired. 0 returns the source; 1 ignores it.",
      range: { min: 0, max: 1, step: 0.01 },
      defaultValue: { kind: "Number", value: 0.65 },
    },
    {
      id: asPortId("width"),
      label: "Width",
      direction: "input",
      kind: "Number",
      help: "Pixels. Rounded to what the chosen model actually supports.",
      range: { min: 256, max: 4096, step: 64, unit: "px" },
      defaultValue: { kind: "Number", value: 1024 },
    },
    {
      id: asPortId("height"),
      label: "Height",
      direction: "input",
      kind: "Number",
      help: "Pixels. A style carrying an aspect ratio sets this for you unless you override it.",
      range: { min: 256, max: 4096, step: 64, unit: "px" },
      defaultValue: { kind: "Number", value: 1024 },
    },
  ],
  outputs: [
    {
      id: asPortId("image"),
      label: "Image",
      direction: "output",
      kind: "Image",
      help: "The generated still.",
    },
    {
      id: asPortId("used_prompt"),
      label: "Sent",
      direction: "output",
      kind: "Text",
      help:
        "The prompt that was actually sent, after the style was merged and rendered for this model. This is the record of what produced the pixels.",
    },
  ],
};

export const GEN_VIDEO: NodeTypeSpec = {
  id: asNodeTypeId("gen.video"),
  category: "ai",
  label: "Generate Video",
  hint:
    "A clip, from a style and a prompt. One call is worth many image calls — check the estimate before running a stack of these.",
  cost: "network",
  engineStage: null,
  size: { w: 264, h: 280 },
  inputs: [
    ...generateInputs("video"),
    {
      id: asPortId("first_frame"),
      label: "First frame",
      direction: "input",
      kind: "Image",
      help:
        "A still to animate. Wiring one turns this into image-to-video, which is far more controllable than text-to-video.",
      optional: true,
    },
    {
      id: asPortId("duration"),
      label: "Duration",
      direction: "input",
      kind: "Number",
      help: "Seconds. Most models cap well below what they will accept.",
      range: { min: 1, max: 60, step: 1, unit: "s" },
      defaultValue: { kind: "Number", value: 5 },
    },
    {
      id: asPortId("fps"),
      label: "Frame rate",
      direction: "input",
      kind: "Number",
      help: "Frames per second of the generated clip.",
      range: { min: 8, max: 60, step: 1, unit: "fps" },
      defaultValue: { kind: "Number", value: 24 },
    },
  ],
  outputs: [
    {
      id: asPortId("video"),
      label: "Clip",
      direction: "output",
      kind: "Video",
      help: "The generated clip.",
    },
    {
      id: asPortId("frames"),
      label: "Frames",
      direction: "output",
      kind: "Sequence",
      help:
        "The clip decoded to frames, so the restoration stages can grade it like any other footage.",
    },
    {
      id: asPortId("used_prompt"),
      label: "Sent",
      direction: "output",
      kind: "Text",
      help: "The prompt that was actually sent.",
    },
  ],
};

export const GEN_AUDIO: NodeTypeSpec = {
  id: asNodeTypeId("gen.audio"),
  category: "ai",
  label: "Generate Audio",
  hint: "Music, effects or speech. The only signal on this canvas you cannot look at.",
  cost: "network",
  engineStage: null,
  size: { w: 250, h: 230 },
  inputs: [
    ...generateInputs("music"),
    {
      id: asPortId("duration"),
      label: "Duration",
      direction: "input",
      kind: "Number",
      help: "Seconds of audio to generate.",
      range: { min: 1, max: 300, step: 1, unit: "s" },
      defaultValue: { kind: "Number", value: 10 },
    },
  ],
  outputs: [
    {
      id: asPortId("audio"),
      label: "Audio",
      direction: "output",
      kind: "Audio",
      help: "The generated audio.",
    },
    {
      id: asPortId("used_prompt"),
      label: "Sent",
      direction: "output",
      kind: "Text",
      help: "The prompt that was actually sent.",
    },
  ],
};

export const GEN_MESH: NodeTypeSpec = {
  id: asNodeTypeId("gen.mesh"),
  category: "ai",
  label: "Generate 3D",
  hint: "A mesh from a still. Useful for a set piece you need to see from a second angle.",
  cost: "network",
  engineStage: null,
  size: { w: 250, h: 220 },
  inputs: [
    ...generateInputs("mesh"),
    {
      id: asPortId("image"),
      label: "From image",
      direction: "input",
      kind: "Image",
      help:
        "The still to reconstruct. Required — no model here does text-to-mesh well enough to offer.",
      optional: true,
    },
  ],
  outputs: [
    {
      id: asPortId("mesh"),
      label: "Mesh",
      direction: "output",
      kind: "Mesh",
      help: "The reconstructed geometry.",
    },
    {
      id: asPortId("preview"),
      label: "Preview",
      direction: "output",
      kind: "Image",
      help: "A rendered view of the mesh, so the card has something to show.",
    },
  ],
};

/**
 * A language model, on the canvas.
 *
 * Kept separate from the image and video nodes because its output is `Text`,
 * which means it can feed *any* other node's prompt — including its own
 * upstream reference selection. This is the node that turns a script card into
 * a shot list, and a shot list into six generate calls.
 */
export const LLM_ASK: NodeTypeSpec = {
  id: asNodeTypeId("llm.ask"),
  category: "ai",
  label: "Ask a Model",
  hint:
    "Put a language model in the graph — break a scene into shots, rewrite a prompt, describe a frame. Its text can drive any other node.",
  cost: "network",
  engineStage: null,
  size: { w: 258, h: 250 },
  inputs: [
    {
      id: asPortId("model"),
      label: "Model",
      direction: "input",
      kind: "Enum",
      help: "Which language model. Ollama runs locally and costs nothing.",
      options: modelOptions("text"),
      defaultValue: { kind: "Enum", value: firstOption("text") },
    },
    {
      id: asPortId("instruction"),
      label: "Ask",
      direction: "input",
      kind: "Text",
      help: "What you want it to do. Keep it a single task.",
      defaultValue: {
        kind: "Text",
        value: "Break this scene into a numbered shot list. One line per shot.",
      },
    },
    {
      id: asPortId("context"),
      label: "Context",
      direction: "input",
      kind: "Text",
      help: "The material to work on — a scene, a prompt to rewrite, a set of notes.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("style"),
      label: "Style",
      direction: "input",
      kind: "Style",
      help:
        "A reference, so the model knows the grammar it is writing for. A shot list for a ligne claire comic is not a shot list for Bergman.",
      optional: true,
    },
    {
      id: asPortId("image"),
      label: "Look at",
      direction: "input",
      kind: "Image",
      help: "A frame for the model to read. Ignored by text-only models.",
      optional: true,
    },
  ],
  outputs: [
    {
      id: asPortId("text"),
      label: "Answer",
      direction: "output",
      kind: "Text",
      help: "What it said.",
    },
    {
      id: asPortId("lines"),
      label: "Lines",
      direction: "output",
      kind: "Text",
      help:
        "The answer split on newlines, as an ordered list — so a shot list can drive a Z stack with one wire.",
      variadic: true,
    },
  ],
};

// ===========================================================================
// Output
// ===========================================================================

/**
 * Write generated media to disk.
 *
 * Separate from `out.render`, which encodes a restored sequence through the
 * engine's verified H.264 path. This one saves what a model returned, in the
 * format it returned it, and does not re-encode — a generated clip that has
 * been through a second lossy pass for no reason is a quality loss nobody
 * asked for.
 */
export const OUT_SAVE: NodeTypeSpec = {
  id: asNodeTypeId("out.save"),
  category: "output",
  label: "Save",
  hint: "Write generated media to the workspace, in whatever format it arrived in. No re-encode.",
  cost: "filesystem",
  engineStage: null,
  size: { w: 236, h: 170 },
  inputs: [
    {
      id: asPortId("image"),
      label: "Image",
      direction: "input",
      kind: "Image",
      help: "A still to save.",
      optional: true,
    },
    {
      id: asPortId("video"),
      label: "Clip",
      direction: "input",
      kind: "Video",
      help: "A clip to save.",
      optional: true,
    },
    {
      id: asPortId("audio"),
      label: "Audio",
      direction: "input",
      kind: "Audio",
      help: "Audio to save.",
      optional: true,
    },
    {
      id: asPortId("name"),
      label: "Name",
      direction: "input",
      kind: "Text",
      help:
        "Base filename. The extension follows the media. Empty names it after the node and the run.",
      defaultValue: { kind: "Text", value: "" },
    },
  ],
  outputs: [],
};

/** Every generation-side type. Combined with `CORE_NODES` and `STAGE_NODES`. */
export const GENERATION_NODES: readonly NodeTypeSpec[] = [
  REF_CARD,
  REF_BLEND,
  REF_SHOT,
  REF_PROMPT,
  GEN_IMAGE,
  GEN_VIDEO,
  GEN_AUDIO,
  GEN_MESH,
  LLM_ASK,
  OUT_SAVE,
];
