/**
 * nodes.ts — the node types that are not derivable from the stage schema.
 *
 * The ten `stage.*` nodes are generated (see `codegen/from_controls.ts`)
 * because they are one-to-one with the engine's parameter schema. These are
 * not: they are sources, set logic, stack control, segmentation, generative
 * calls and outputs, each of which maps to a *different* engine endpoint or to
 * no endpoint at all. Hand-authoring them is correct; generating them would
 * mean inventing a schema that describes only one file.
 */

import { asNodeTypeId, asPortId } from "./ids.ts";
import type { NodeTypeSpec } from "./registry.ts";
import { PROPAGATION_MODES } from "./venn.ts";

// ===========================================================================
// Sources
// ===========================================================================

/** Reads the extracted PNG sequence of a loaded restorer project. */
export const SOURCE_SEQUENCE: NodeTypeSpec = {
  id: asNodeTypeId("source.sequence"),
  category: "source",
  label: "Video",
  hint:
    "The extracted frame sequence of a loaded project. Non-destructive: this reads the PNGs the engine wrote, never the original video.",
  cost: "filesystem",
  engineStage: null,
  size: { w: 236, h: 150 },
  inputs: [
    {
      id: asPortId("project_id"),
      label: "Project",
      direction: "input",
      kind: "Text",
      help:
        "Which loaded project to read. Empty means the project this blueprint is bound to, which is what the picker in the title bar sets — so this only needs a value to read a *different* project from the one in the header.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("start"),
      label: "First frame",
      direction: "input",
      kind: "Number",
      help: "Index of the first frame in the range this node exposes.",
      range: { min: 0, max: 999999, step: 1, unit: "fr" },
      defaultValue: { kind: "Number", value: 0 },
    },
    {
      id: asPortId("count"),
      label: "Frames",
      direction: "input",
      kind: "Number",
      help: "How many frames to expose. 0 means to the end of the sequence.",
      range: { min: 0, max: 999999, step: 1, unit: "fr" },
      defaultValue: { kind: "Number", value: 0 },
    },
  ],
  outputs: [
    {
      id: asPortId("sequence"),
      label: "Sequence",
      direction: "output",
      kind: "Sequence",
      help: "The frames in range. Feed this to a Z stack to iterate over them.",
    },
    {
      id: asPortId("metrics"),
      label: "Metrics",
      direction: "output",
      kind: "Metrics",
      help:
        "Per-frame measurements from the analysis pass: sharpness, luminance, noise sigma, score, verdict.",
    },
  ],
};

/** Picks one frame out of a sequence. The Sequence → Image narrowing, made explicit. */
export const SOURCE_FRAME: NodeTypeSpec = {
  id: asNodeTypeId("source.frame"),
  category: "source",
  label: "Frame Selection",
  hint:
    "Takes one frame out of a sequence. Set the index on the card, or let a Z stack drive it from the slice.",
  cost: "local",
  engineStage: null,
  size: { w: 212, h: 122 },
  inputs: [
    {
      id: asPortId("sequence"),
      label: "Sequence",
      direction: "input",
      kind: "Sequence",
      help: "The run of frames to pick from.",
    },
    {
      id: asPortId("index"),
      label: "Index",
      direction: "input",
      kind: "Number",
      help:
        "Which frame, relative to the sequence start. Overridden by the slice index when this node sits in a stack.",
      range: { min: 0, max: 999999, step: 1, unit: "fr" },
      defaultValue: { kind: "Number", value: 0 },
    },
  ],
  outputs: [
    {
      id: asPortId("image"),
      label: "Frame",
      direction: "output",
      kind: "Image",
      help: "The chosen frame.",
    },
  ],
};

// ===========================================================================
// Masks and set logic
// ===========================================================================

/** SAM3 / Gemini detection followed by local GrabCut refinement. */
export const MASK_SEGMENT: NodeTypeSpec = {
  id: asNodeTypeId("mask.segment"),
  category: "mask",
  label: "Segment Subject",
  hint:
    "Names and boxes what is in the frame, then refines each box into a pixel-accurate matte locally with GrabCut. The box comes from the model; the edge does not.",
  cost: "network",
  engineStage: null,
  size: { w: 248, h: 186 },
  inputs: [
    {
      id: asPortId("image"),
      label: "Frame",
      direction: "input",
      kind: "Image",
      help:
        "The frame to segment. Stabilise and grade first — segmentation is much better on a clean frame.",
    },
    {
      id: asPortId("prompt"),
      label: "Looking for",
      direction: "input",
      kind: "Text",
      help:
        'What to isolate, in words, e.g. "the bride" or "the sky". Empty asks the model to name everything it finds.',
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("feather"),
      label: "Feather",
      direction: "input",
      kind: "Number",
      help:
        "Softens the matte edge. Some feather is almost always right on film: a hard edge reads as a cut-out.",
      range: { min: 0, max: 24, step: 1, unit: "px" },
      defaultValue: { kind: "Number", value: 3 },
    },
  ],
  outputs: [
    {
      id: asPortId("mask"),
      label: "Matte",
      direction: "output",
      kind: "Mask",
      help: "Coverage of the subject, 0..255, feathered.",
    },
    {
      id: asPortId("labels"),
      label: "Labels",
      direction: "output",
      kind: "Text",
      help: "What the model said it found, one per line. Read this before trusting the matte.",
    },
  ],
};

/** The dual-circle Venn node — the propagation model made a first-class node. */
export const FLOW_PROPAGATE: NodeTypeSpec = {
  id: asNodeTypeId("flow.propagate"),
  category: "flow",
  label: "Region",
  hint:
    "Combines two mattes into the region an effect applies to: everything, the overlap, or either side alone.",
  cost: "local",
  engineStage: null,
  size: { w: 236, h: 214 },
  inputs: [
    {
      id: asPortId("a"),
      label: "A",
      direction: "input",
      kind: "Mask",
      help: "The first region. Leave unconnected for the whole frame.",
    },
    {
      id: asPortId("b"),
      label: "B",
      direction: "input",
      kind: "Mask",
      help: "The second region. Usually a subject matte.",
    },
    {
      id: asPortId("mode"),
      label: "Region",
      direction: "input",
      kind: "Enum",
      help: "Which of the four regions of the diagram this node outputs.",
      options: PROPAGATION_MODES,
      defaultValue: { kind: "Enum", value: "union" },
    },
  ],
  outputs: [
    {
      id: asPortId("mask"),
      label: "Region",
      direction: "output",
      kind: "Mask",
      help:
        "The selected region as coverage. Feed it to a Composite to limit where an effect lands.",
    },
    {
      id: asPortId("coverage"),
      label: "Coverage",
      direction: "output",
      kind: "Number",
      help:
        "The share of the frame this region selects, 0..1. The fastest way to catch an inverted matte before rendering.",
      range: { min: 0, max: 1, step: 0 },
    },
  ],
};

/** Masked composite of two images — where the graph rejoins after a branch. */
export const FLOW_COMPOSITE: NodeTypeSpec = {
  id: asNodeTypeId("flow.composite"),
  category: "flow",
  label: "Composite",
  hint: "Lays one frame over another through a matte. This is where a branched pipeline rejoins.",
  cost: "local",
  engineStage: null,
  size: { w: 236, h: 176 },
  inputs: [
    {
      id: asPortId("base"),
      label: "Base",
      direction: "input",
      kind: "Image",
      help: "What shows where the matte is black.",
    },
    {
      id: asPortId("over"),
      label: "Over",
      direction: "input",
      kind: "Image",
      help: "What shows where the matte is white.",
    },
    {
      id: asPortId("mask"),
      label: "Matte",
      direction: "input",
      kind: "Mask",
      help: "Coverage. Unconnected means fully over.",
    },
    {
      id: asPortId("opacity"),
      label: "Opacity",
      direction: "input",
      kind: "Number",
      help: "Scales the matte uniformly.",
      range: { min: 0, max: 1, step: 0.01 },
      defaultValue: { kind: "Number", value: 1 },
    },
  ],
  outputs: [
    {
      id: asPortId("image"),
      label: "Result",
      direction: "output",
      kind: "Image",
      help: "The composited frame.",
    },
  ],
};

// ===========================================================================
// Z-axis stack control
// ===========================================================================

/**
 * Turns a sequence into a stack of depth slices — the 2D → 2.5D hinge.
 *
 * Everything downstream of this node, until a `flow.collect`, is evaluated
 * once per slice. That is the whole iteration model: there are no loop edges
 * in this graph, because a loop edge is a cycle and cycles are refused. Depth
 * is the loop.
 */
export const FLOW_STACK: NodeTypeSpec = {
  id: asNodeTypeId("flow.stack"),
  category: "flow",
  label: "Z Stack",
  hint:
    "Iterates the graph below it once per frame, along the depth axis. Roll the carousel to bring any slice into focus.",
  cost: "local",
  engineStage: null,
  size: { w: 248, h: 200 },
  inputs: [
    {
      id: asPortId("sequence"),
      label: "Sequence",
      direction: "input",
      kind: "Sequence",
      help: "The frames to iterate. One slice per frame.",
    },
    {
      id: asPortId("stride"),
      label: "Stride",
      direction: "input",
      kind: "Number",
      help:
        "Take every Nth frame. Raise it to rough out a long range cheaply, then drop it back to 1.",
      range: { min: 1, max: 60, step: 1, unit: "fr" },
      defaultValue: { kind: "Number", value: 1 },
    },
    {
      id: asPortId("wrap"),
      label: "Wrap",
      direction: "input",
      kind: "Flag",
      help: "Rolling past the last slice returns to the first.",
      defaultValue: { kind: "Flag", value: false },
    },
  ],
  outputs: [
    {
      id: asPortId("image"),
      label: "Slice",
      direction: "output",
      kind: "Image",
      help: "This slice's frame. Downstream nodes see one frame at a time.",
    },
    {
      id: asPortId("slice_index"),
      label: "Slice #",
      direction: "output",
      kind: "Number",
      help:
        "Which slice is being evaluated. Drive a parameter with it to ramp a value across the range.",
      range: { min: 0, max: 999999, step: 1 },
    },
  ],
};

/** Collapses a stack's per-slice results back into one sequence. */
export const FLOW_COLLECT: NodeTypeSpec = {
  id: asNodeTypeId("flow.collect"),
  category: "flow",
  label: "Collect",
  hint: "Gathers every slice's result back into one sequence. Closes a Z stack.",
  cost: "local",
  engineStage: null,
  size: { w: 212, h: 116 },
  inputs: [
    {
      id: asPortId("image"),
      label: "Slice result",
      direction: "input",
      kind: "Image",
      help: "The per-slice output to gather.",
    },
  ],
  outputs: [
    {
      id: asPortId("sequence"),
      label: "Sequence",
      direction: "output",
      kind: "Sequence",
      help: "Every slice's result, in slice order.",
    },
  ],
};

// ===========================================================================
// Generative
// ===========================================================================

/**
 * The generative node. Its `influence` port is the only route by which
 * generated pixels enter a frame, and the blend is a Laplacian pyramid so
 * coarse levels take the generation while fine levels keep photographic grain.
 */
export const AI_ENHANCE: NodeTypeSpec = {
  id: asNodeTypeId("ai.enhance"),
  category: "ai",
  label: "Generative Repair",
  hint:
    "Reconstructs missing or destroyed material. Enters the frame only through a pyramid blend you control, so the result keeps the original grain.",
  cost: "network",
  engineStage: null,
  size: { w: 260, h: 258 },
  inputs: [
    {
      id: asPortId("image"),
      label: "Frame",
      direction: "input",
      kind: "Image",
      help:
        "The frame to repair. Stabilise, deflicker and clean it first — generating over noise bakes the noise in.",
    },
    {
      id: asPortId("mask"),
      label: "Region",
      direction: "input",
      kind: "Mask",
      help: "Where generation is allowed. Mask around faces, not through them.",
    },
    {
      id: asPortId("positive_prompt"),
      label: "Prompt",
      direction: "input",
      kind: "Text",
      help: "What should be there.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("negative_prompt"),
      label: "Avoid",
      direction: "input",
      kind: "Text",
      help: "What must not appear.",
      defaultValue: { kind: "Text", value: "" },
    },
    {
      id: asPortId("mode"),
      label: "Mode",
      direction: "input",
      kind: "Enum",
      help: "Which generative task to run.",
      options: ["restore", "colorize", "inpaint", "upscale-detail"],
      defaultValue: { kind: "Enum", value: "restore" },
    },
    {
      id: asPortId("influence"),
      label: "Influence",
      direction: "input",
      kind: "Number",
      help:
        "How much of the generation reaches the frame. Keep it at 0.3–0.5 on any frame where a face is recognisable.",
      range: { min: 0, max: 1, step: 0.01 },
      defaultValue: { kind: "Number", value: 0.45 },
    },
  ],
  outputs: [
    {
      id: asPortId("image"),
      label: "Blended",
      direction: "output",
      kind: "Image",
      help: "The frame with the generation blended in at the given influence.",
    },
    {
      id: asPortId("raw"),
      label: "Raw generation",
      direction: "output",
      kind: "Image",
      help:
        "The model's output before blending. Inspect this to judge whether the blend is hiding a bad result.",
    },
  ],
};

// ===========================================================================
// Output
// ===========================================================================

export const OUTPUT_VIEW: NodeTypeSpec = {
  id: asNodeTypeId("out.view"),
  category: "output",
  label: "Viewer",
  hint:
    "Terminates a branch and shows it. A graph may have several; the focused one drives the main picture.",
  cost: "local",
  engineStage: null,
  size: { w: 236, h: 168 },
  inputs: [
    {
      id: asPortId("image"),
      label: "Frame",
      direction: "input",
      kind: "Image",
      help: "What to display.",
    },
    {
      id: asPortId("compare"),
      label: "Compare with",
      direction: "input",
      kind: "Image",
      help: "Optional second input for the split-wipe. Usually the untouched source.",
    },
  ],
  outputs: [],
};

export const OUTPUT_RENDER: NodeTypeSpec = {
  id: asNodeTypeId("out.render"),
  category: "output",
  label: "Render",
  hint:
    "Runs the whole sequence through this graph and encodes it. The only node that writes to disk.",
  cost: "local",
  engineStage: null,
  size: { w: 248, h: 196 },
  inputs: [
    {
      id: asPortId("sequence"),
      label: "Sequence",
      direction: "input",
      kind: "Sequence",
      help: "The finished frames to encode.",
    },
    {
      id: asPortId("fps"),
      label: "Frame rate",
      direction: "input",
      kind: "Number",
      help:
        "Comes from the extraction, not the source file — an every-2nd-frame extraction played at source rate runs at double speed.",
      range: { min: 1, max: 120, step: 0.001, unit: "fps" },
      defaultValue: { kind: "Number", value: 25 },
    },
    {
      id: asPortId("crf"),
      label: "Quality",
      direction: "input",
      kind: "Number",
      help: "H.264 CRF. Lower is better and larger; 18 is visually lossless on film.",
      range: { min: 0, max: 51, step: 1 },
      defaultValue: { kind: "Number", value: 18 },
    },
  ],
  outputs: [],
};

/** Every hand-authored type. Combined with `STAGE_NODES` to build the registry. */
export const CORE_NODES: readonly NodeTypeSpec[] = [
  SOURCE_SEQUENCE,
  SOURCE_FRAME,
  MASK_SEGMENT,
  FLOW_PROPAGATE,
  FLOW_COMPOSITE,
  FLOW_STACK,
  FLOW_COLLECT,
  AI_ENHANCE,
  OUTPUT_VIEW,
  OUTPUT_RENDER,
];
