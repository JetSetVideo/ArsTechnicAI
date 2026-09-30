/**
 * style_eval.ts — what the generation half of a graph actually says.
 *
 * `ref.card`, `ref.blend`, `ref.shot`, `ref.prompt`, the `gen.*` nodes and
 * `llm.ask` carry no pixels: they carry a **Style** — a merged grant, and
 * often a complete `CinemaConfig` — and end in a string that some model will
 * be asked to draw. Until now nothing resolved that chain, so the nodes were
 * wiring with no value behind it: `ref.blend` and `ref.shot` were types
 * without evaluators, and a generate node could not tell you what it would
 * send before you paid for it.
 *
 * This evaluates the whole chain locally. No engine, no network, no API key:
 * merging grants, applying a shot's overrides, validating the result against
 * the 63 cinema rules and rendering the prompt are all pure functions over
 * data already in the browser. What comes back is per-node:
 *
 *   - the resolved `Style` (grant + which reference supplied the camera),
 *   - the resolved text outputs (`positive`, `negative`, `used_prompt`, …),
 *   - and diagnostics in the compiler's own vocabulary, so the canvas paints
 *     them exactly like a wiring error.
 *
 * The rule it follows everywhere: **a value typed on a port wins over a wire**
 * only when the wire is absent. The one exception is documented at `shotOf`.
 */

import { buildAdjacency, type GraphDocument, topologicalOrder } from "./graph.ts";
import type { NodeId, PortId } from "./ids.ts";
import type { NodeInstance } from "./graph.ts";
import type { NodeRegistry } from "./registry.ts";
import type { PortSpec, SignalValue } from "./ports.ts";
import { type Grant, mergeGrants, type Reference } from "./library.ts";
import { type Entity, entityGrant, entityThumb } from "./entities.ts";
import {
  type CinemaConfig,
  DEFAULT_LIVE_ACTION,
  isLiveAction,
  type ValidationResult,
} from "./cinema/config.ts";
import { validate } from "./cinema/rules.ts";
import { type PresetIndex } from "./cinema/presets.ts";
import {
  PROMPT_TARGETS,
  type PromptDetail,
  type PromptTarget,
  renderPrompt,
} from "./cinema/prompt.ts";
import { model as modelSpec } from "./providers.ts";

// ===========================================================================
// Values
// ===========================================================================

/** What a `Style` wire carries. */
export interface StyleValue {
  readonly grant: Grant;
  /** Reference ids that contributed, in order. */
  readonly sources: readonly string[];
  /** Ids that supplied a camera configuration — more than one means a conflict. */
  readonly cinemaFrom: readonly string[];
  /** The configuration after any `ref.shot` overrides, when one exists. */
  readonly cinema?: CinemaConfig;
  /** Rule validation of `cinema`, when there is one. */
  readonly validation?: ValidationResult;
}

export interface StyleDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly node: NodeId;
  readonly message: string;
}

export interface StyleEvaluation {
  /** Resolved Style output per node. */
  readonly styles: ReadonlyMap<NodeId, StyleValue>;
  /** Resolved Text outputs, keyed `node:port`. */
  readonly texts: ReadonlyMap<string, string>;
  readonly diagnostics: readonly StyleDiagnostic[];
}

export interface StyleEvalOptions {
  /** Look a reference card up by id. Missing ids are reported, never guessed. */
  readonly reference?: (id: string) => Reference | null;
  /** Look a subject (character, place, object) up by id. */
  readonly entity?: (id: string) => Entity | null;
  /** Film presets, so a prompt can name the film rather than its id. */
  readonly presets?: PresetIndex;
}

const textKey = (node: NodeId, port: string) => `${node}:${port}`;

const rawValue = (v: SignalValue | undefined): unknown =>
  v && typeof v === "object" && "value" in v ? (v as { value: unknown }).value : undefined;

function stored(node: NodeInstance, port: PortId | string): unknown {
  return rawValue(node.values[port as string]);
}

function storedOr(node: NodeInstance, spec: PortSpec): unknown {
  const own = stored(node, spec.id);
  return own !== undefined ? own : rawValue(spec.defaultValue);
}

function portOf(registry: NodeRegistry, node: NodeInstance, port: string): PortSpec | null {
  return registry.port(node.type, port, "input");
}

/** Text on an input port: the wire's value if there is one, else the typed value. */
function textIn(
  registry: NodeRegistry,
  node: NodeInstance,
  port: string,
  wired: ReadonlyMap<string, string>,
): string {
  const fromWire = wired.get(port);
  if (fromWire !== undefined && fromWire !== "") return fromWire;
  const spec = portOf(registry, node, port);
  const value = spec ? storedOr(node, spec) : stored(node, port);
  return typeof value === "string" ? value : "";
}

function numberIn(registry: NodeRegistry, node: NodeInstance, port: string): number | undefined {
  const spec = portOf(registry, node, port);
  const value = spec ? storedOr(node, spec) : stored(node, port);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function enumIn(registry: NodeRegistry, node: NodeInstance, port: string): string | undefined {
  const spec = portOf(registry, node, port);
  const value = spec ? storedOr(node, spec) : stored(node, port);
  return typeof value === "string" && value !== "" ? value : undefined;
}

// ===========================================================================
// Evaluation
// ===========================================================================

/**
 * Resolve every Style and Text in the graph, in dependency order.
 *
 * A graph with a cycle resolves nothing — the same answer `compileGraph` gives,
 * for the same reason: there is no order in which to do the work.
 */
export function evaluateStyles(
  graph: GraphDocument,
  registry: NodeRegistry,
  options: StyleEvalOptions = {},
): StyleEvaluation {
  const styles = new Map<NodeId, StyleValue>();
  const texts = new Map<string, string>();
  const diagnostics: StyleDiagnostic[] = [];

  const topo = topologicalOrder(graph);
  if (!topo.ok) return { styles, texts, diagnostics };
  const adjacency = buildAdjacency(graph);

  /** Styles arriving on one input port, in wire order. */
  const stylesInto = (id: NodeId, port: string): StyleValue[] => {
    const out: StyleValue[] = [];
    for (const edge of adjacency.incoming.get(id) ?? []) {
      if (edge.to.port !== port) continue;
      const value = styles.get(edge.from.node);
      if (value) out.push(value);
    }
    return out;
  };

  /** Text arriving on each input port of a node. */
  const textsInto = (id: NodeId): Map<string, string> => {
    const out = new Map<string, string>();
    for (const edge of adjacency.incoming.get(id) ?? []) {
      const value = texts.get(textKey(edge.from.node, edge.from.port));
      if (value !== undefined && !out.has(edge.to.port)) out.set(edge.to.port, value);
    }
    return out;
  };

  for (const id of topo.order) {
    const node = graph.nodes[id];
    if (!node) continue;
    const spec = registry.get(node.type);
    if (!spec) continue;
    const wiredText = textsInto(id);

    switch (node.type) {
      case "ref.card": {
        const refId = textIn(registry, node, "reference_id", wiredText).trim();
        if (refId === "") {
          diagnostics.push({
            severity: "warning",
            node: id,
            message: "Reference has no card chosen. Drop one from the Refs shelf, or type its id.",
          });
          break;
        }
        const reference = options.reference?.(refId) ?? null;
        if (!reference) {
          diagnostics.push({
            severity: "error",
            node: id,
            message: `No reference "${refId}" in the library. Ids come from the Refs shelf; ` +
              "a renamed shelf entry leaves the graph pointing at nothing.",
          });
          break;
        }
        // The weight rides along as a parameter, so a merge can order by it and
        // a model that reads weights gets the number the user set.
        const weight = numberIn(registry, node, "weight") ?? 1;
        const grant: Grant = weight === 1 ? reference.grant : {
          ...reference.grant,
          params: { ...(reference.grant.params ?? {}), [`${refId}_weight`]: weight },
        };
        styles.set(
          id,
          withValidation({
            grant,
            sources: [refId],
            cinemaFrom: reference.grant.cinema ? [refId] : [],
            ...(reference.grant.cinema ? { cinema: reference.grant.cinema } : {}),
          }),
        );
        texts.set(textKey(id, "thumb"), reference.thumb ?? "");
        break;
      }

      case "ref.entity": {
        const entityRef = textIn(registry, node, "entity_id", wiredText).trim();
        if (entityRef === "") {
          diagnostics.push({
            severity: "warning",
            node: id,
            message: "Subject has none chosen. Drop one from Home's Characters & places shelf.",
          });
          break;
        }
        const entity = options.entity?.(entityRef) ?? null;
        if (!entity) {
          diagnostics.push({
            severity: "error",
            node: id,
            message:
              `No subject "${entityRef}" in this workspace. It may have been renamed on Home.`,
          });
          break;
        }
        const withTraits = enumIn(registry, node, "traits") !== "false" &&
          stored(node, "traits") !== false;
        const grant = withTraits ? entityGrant(entity) : entityGrant({ ...entity, traits: [] });
        styles.set(id, { grant, sources: [entity.id], cinemaFrom: [] });
        texts.set(textKey(id, "reference"), entityThumb(entity) ?? "");
        break;
      }

      case "ref.blend": {
        const incoming = stylesInto(id, "styles");
        if (incoming.length === 0) {
          diagnostics.push({
            severity: "error",
            node: id,
            message: "Blend References has no styles wired. Connect two or more reference cards.",
          });
          break;
        }
        if (incoming.length === 1) {
          diagnostics.push({
            severity: "info",
            node: id,
            message: "Only one style is wired, so this blend passes it through unchanged.",
          });
        }
        const merged = mergeGrants(
          incoming.flatMap((s) => s.sources.map((source) => ({ id: source, grant: s.grant }))),
        );
        const cinema = incoming.map((s) => s.cinema).filter((c): c is CinemaConfig => Boolean(c));
        const value: StyleValue = {
          grant: merged.grant,
          sources: incoming.flatMap((s) => s.sources),
          cinemaFrom: merged.cinemaFrom,
          ...(cinema.length > 0 ? { cinema: cinema[cinema.length - 1]! } : {}),
        };
        styles.set(id, withValidation(value));
        // Conflicts are reported, never resolved silently: two cameras cannot
        // be averaged, and knowing which one won is the whole point.
        const conflict = merged.cinemaFrom.length > 1
          ? `${merged.cinemaFrom.join(" → ")} — the last one supplies the camera`
          : "";
        texts.set(textKey(id, "conflicts"), conflict);
        if (conflict) {
          diagnostics.push({
            severity: "warning",
            node: id,
            message: `Two references carry a camera: ${conflict}. Re-order the wires to choose.`,
          });
        }
        break;
      }

      case "ref.shot": {
        const base = stylesInto(id, "base")[0];
        const value = shotOf(node, base, diagnostics);
        styles.set(id, value);
        const report = value.validation
          ? `${value.validation.status} · ${value.validation.messages.length} note(s)` +
            (value.validation.messages[0] ? ` · ${value.validation.messages[0].message}` : "")
          : "no camera configuration to check";
        texts.set(textKey(id, "diagnostics"), report);
        for (const message of value.validation?.messages ?? []) {
          diagnostics.push({
            severity: message.severity === "hard"
              ? "error"
              : message.severity === "warning"
              ? "warning"
              : "info",
            node: id,
            message: message.message,
          });
        }
        break;
      }

      case "ref.prompt": {
        const style = stylesInto(id, "style")[0];
        const subject = textIn(registry, node, "subject", wiredText).trim();
        const avoid = textIn(registry, node, "avoid", wiredText).trim();
        const target = (enumIn(registry, node, "target") ?? "generic") as PromptTarget;
        const detail = (enumIn(registry, node, "detail") ?? "brief") as PromptDetail;
        const rendered = promptFor(style, subject, target, detail, options.presets);
        // What the author types to avoid comes first: it is the most specific
        // instruction in the chain, and several models weight by position.
        const negative = [avoid, rendered.negative].filter(Boolean).join(", ");
        texts.set(textKey(id, "positive"), rendered.positive);
        texts.set(textKey(id, "negative"), negative);
        if (!style && subject === "") {
          diagnostics.push({
            severity: "warning",
            node: id,
            message: "Prompt has neither a style nor a subject, so it renders an empty string.",
          });
        }
        break;
      }

      case "gen.image":
      case "gen.video":
      case "gen.audio":
      case "gen.mesh": {
        const style = stylesInto(id, "style")[0];
        const modelId = enumIn(registry, node, "model") ?? "";
        const spec = modelId ? modelSpec(modelId) : null;
        if (!modelId) {
          diagnostics.push({
            severity: "error",
            node: id,
            message:
              "No model chosen. Pick one in the inspector — the run cannot be priced without it.",
          });
        } else if (!spec) {
          diagnostics.push({
            severity: "error",
            node: id,
            message:
              `The catalogue does not know "${modelId}", so this run cannot be priced or gated.`,
          });
        }
        const target = (spec?.promptTarget ?? "generic") as PromptTarget;
        const subject = textIn(registry, node, "prompt", wiredText).trim();
        const rendered = promptFor(
          style,
          subject,
          PROMPT_TARGETS.includes(target) ? target : "generic",
          "brief",
          options.presets,
        );
        const negativeTyped = textIn(registry, node, "negative", wiredText).trim();
        const negative = [rendered.negative, negativeTyped].filter(Boolean).join(", ");
        texts.set(textKey(id, "used_prompt"), rendered.positive);
        texts.set(textKey(id, "negative_prompt"), negative);
        if (rendered.positive === "") {
          diagnostics.push({
            severity: "error",
            node: id,
            message:
              `${registry.get(node.type)?.label ?? node.type} has nothing to generate from: ` +
              "wire a style or type a prompt.",
          });
        }
        if (negative && spec && spec.supportsNegative === false) {
          diagnostics.push({
            severity: "info",
            node: id,
            message: `${spec.name} ignores negative prompts; this one will not be sent.`,
          });
        }
        if (style?.validation && style.validation.status === "invalid") {
          diagnostics.push({
            severity: "warning",
            node: id,
            message:
              "The wired shot is not physically possible; the model will draw something with no referent.",
          });
        }
        break;
      }

      case "llm.ask": {
        const style = stylesInto(id, "style")[0];
        const instruction = textIn(registry, node, "instruction", wiredText).trim();
        const context = textIn(registry, node, "context", wiredText).trim();
        const modelId = enumIn(registry, node, "model") ?? "";
        if (!modelId) {
          diagnostics.push({
            severity: "error",
            node: id,
            message: "No model chosen for Ask a Model.",
          });
        }
        if (instruction === "") {
          diagnostics.push({
            severity: "error",
            node: id,
            message: "Ask a Model has no instruction, so there is nothing to ask.",
          });
        }
        const styleLine = style
          ? promptFor(style, "", "generic", "brief", options.presets).positive
          : "";
        const assembled = [instruction, context, styleLine].filter(Boolean).join("\n\n");
        texts.set(textKey(id, "text"), assembled);
        texts.set(textKey(id, "lines"), assembled);
        break;
      }

      default: {
        // Pass-through for any node that forwards text on a same-named port.
        for (const port of spec.outputs) {
          if (port.kind !== "Text") continue;
          const incoming = wiredText.get(port.id);
          if (incoming !== undefined) texts.set(textKey(id, port.id), incoming);
        }
        break;
      }
    }
  }

  return { styles, texts, diagnostics };
}

/**
 * Apply a shot's overrides to the style beneath it.
 *
 * `ref.shot` is the node where a *typed* value deliberately beats the wire: its
 * whole purpose is to override what the reference said. A field left at its
 * default is not an override, so only values the user set are applied.
 */
function shotOf(
  node: NodeInstance,
  base: StyleValue | undefined,
  diagnostics: StyleDiagnostic[],
): StyleValue {
  const cinema = base?.cinema ?? DEFAULT_LIVE_ACTION;
  const shotSize = stored(node, "shot_size");
  const focal = stored(node, "focal_length");
  const timeOfDay = stored(node, "time_of_day");
  const mood = stored(node, "mood");

  let next: CinemaConfig = {
    ...cinema,
    visualGrammar: {
      ...cinema.visualGrammar,
      ...(typeof shotSize === "string" && shotSize !== ""
        ? { shotSize: shotSize as CinemaConfig["visualGrammar"]["shotSize"] }
        : {}),
      ...(typeof mood === "string" && mood !== ""
        ? { mood: mood as CinemaConfig["visualGrammar"]["mood"] }
        : {}),
    },
  } as CinemaConfig;

  if (isLiveAction(next)) {
    next = {
      ...next,
      ...(typeof focal === "number" && focal > 0
        ? { lens: { ...next.lens, focalLengthMm: focal } }
        : {}),
      ...(typeof timeOfDay === "string" && timeOfDay !== ""
        ? { lighting: { ...next.lighting, timeOfDay: timeOfDay as typeof next.lighting.timeOfDay } }
        : {}),
    };
  } else if (typeof focal === "number" || typeof timeOfDay === "string") {
    diagnostics.push({
      severity: "info",
      node: node.id,
      message: "The wired reference is animation, which has no lens or time of day; " +
        "those two fields are ignored here.",
    });
  }

  if (!base) {
    diagnostics.push({
      severity: "info",
      node: node.id,
      message: "No reference wired, so this shot starts from the default camera.",
    });
  }

  return withValidation({
    grant: base?.grant ?? {},
    sources: base?.sources ?? [],
    cinemaFrom: base?.cinemaFrom ?? [],
    cinema: next,
  });
}

/** Attach rule validation to a style that carries a configuration. */
function withValidation(value: StyleValue): StyleValue {
  if (!value.cinema) return value;
  return { ...value, validation: validate(value.cinema) };
}

/** The prompt a style and a subject produce for one model dialect. */
export function promptFor(
  style: StyleValue | undefined,
  subject: string,
  target: PromptTarget,
  detail: PromptDetail,
  presets?: PresetIndex,
): { positive: string; negative: string } {
  const parts: string[] = [];
  if (subject) parts.push(subject);

  if (style?.cinema) {
    const rendered = renderPrompt(style.cinema, target, {
      detail,
      ...(presets ? { presets } : {}),
    });
    if (rendered.positive) parts.push(rendered.positive);
    for (const line of style.grant.prompt ?? []) {
      if (!parts.includes(line)) parts.push(line);
    }
    return {
      positive: parts.join(", "),
      negative: [rendered.negative, ...(style.grant.negative ?? [])].filter(Boolean).join(", "),
    };
  }

  for (const line of style?.grant.prompt ?? []) {
    if (!parts.includes(line)) parts.push(line);
  }
  return {
    positive: parts.join(", "),
    negative: (style?.grant.negative ?? []).join(", "),
  };
}

/** One line describing a style, for a card or an inspector row. */
export function describeStyle(style: StyleValue | undefined): string {
  if (!style) return "no style";
  const bits: string[] = [];
  if (style.sources.length > 0) bits.push(style.sources.join(" + "));
  if (style.cinema) {
    const c = style.cinema;
    bits.push(
      isLiveAction(c)
        ? `${c.camera.body} · ${c.lens.focalLengthMm}mm · ${c.lighting.timeOfDay}`
        : `${c.medium} · ${c.rendering.lineTreatment}`,
    );
    bits.push(c.visualGrammar.shotSize);
  }
  if (style.validation && style.validation.status !== "valid") {
    bits.push(`${style.validation.status} (${style.validation.messages.length})`);
  }
  return bits.join(" · ") || "empty style";
}
