/**
 * providers.ts — which models exist, what they can do, and what a run will cost.
 *
 * The canvas has always been able to *compile* a network step and has always
 * refused to *execute* one. The README states the reason plainly: a 240-slice
 * Z-stack run is 240 paid generative calls from a single keystroke, and there
 * was no flow that could ask permission for that. This module is that flow.
 *
 * ## The shape of the problem
 *
 * A consent dialog that says "this will call an API, continue?" is worthless —
 * it is clicked through in a week. The only useful question names the number
 * that will surprise you:
 *
 *     Run 240 slices through Flux Pro on fal.ai
 *     240 calls · about $12.00 · no local alternative for this node
 *     [ Run 240 ]  [ Run 1 and stop ]  [ Cancel ]
 *
 * Which means the estimate has to be computed *before* anything runs, from the
 * compiled graph and the slice count, and the approval has to be **bound to
 * that estimate** — see `ConsentToken`. An approval that outlives the graph it
 * was granted for is how "run one slice" becomes "run all 240" after an edit.
 *
 * ## Local is not merely cheaper
 *
 * ComfyUI on this machine is free, private and unmetered, so it is exempt from
 * consent entirely, and `preferLocal` will route a request to it when a local
 * model can serve the same job. That asymmetry is the point of the whole
 * module: the expensive path should be the one you have to ask for.
 *
 * [AGENT-SECURITY] Nothing here holds a credential. Keys live in the server
 * process (`providers/*.ts` reads them from the environment) and never reach
 * the bundle — `ModelSpec` deliberately carries no auth field, so a catalogue
 * that leaks into the client leaks nothing but prices.
 */

// ---------------------------------------------------------------------------
// What a model makes
// ---------------------------------------------------------------------------

/**
 * The media a node can ask for.
 *
 * Wider than the restoration graph's `SignalKind` because generation is wider
 * than restoration: a graph that only ever moved frames around had no reason
 * to name audio or 3D. These are the *products*; `SignalKind` stays the type
 * system for wires.
 */
export type MediaKind =
  | "image"
  | "video"
  | "audio"
  | "speech"
  | "music"
  | "text"
  | "mesh"
  | "depth"
  | "mask";

export const MEDIA_KINDS: readonly MediaKind[] = Object.freeze([
  "image",
  "video",
  "audio",
  "speech",
  "music",
  "text",
  "mesh",
  "depth",
  "mask",
]);

/** Where the work happens, which is the same question as who pays. */
export type Locality =
  /** This machine. Free, private, unmetered, and as fast as the GPU here. */
  | "local"
  /** Someone else's machine, billed per call. */
  | "remote";

export interface ProviderSpec {
  readonly id: string;
  readonly name: string;
  readonly locality: Locality;
  /** One line: what this provider is for and when to reach for it. */
  readonly hint: string;
  /**
   * The environment variable holding its credential, for the server to read
   * and for the UI to *name* when it is missing. "Set FAL_KEY" is actionable;
   * "authentication failed" is not.
   */
  readonly keyEnv?: string;
  /** Base URL for a local provider the user runs themselves. */
  readonly endpointEnv?: string;
}

export interface ModelSpec {
  readonly id: string;
  readonly provider: string;
  readonly name: string;
  readonly hint: string;
  readonly produces: MediaKind;
  /** What it consumes. Empty means text-to-X. */
  readonly consumes: readonly MediaKind[];
  readonly supportsNegative: boolean;
  readonly supportsSteps: boolean;
  readonly supportsGuidance: boolean;
  readonly supportsSeed: boolean;
  /**
   * Approximate cost of one call, in US cents.
   *
   * Approximate on purpose, and named so: real pricing is per-megapixel, per
   * second of video, per token, and varies by resolution. The estimate exists
   * to make an order of magnitude visible before the run — the difference
   * between "about 40 cents" and "about $40" is the decision, and no amount of
   * precision changes it. `0` means free, which is what `local` always is.
   */
  readonly centsPerCall: number;
  /**
   * The prompt dialect this model reads best, tying the catalogue to
   * `core/cinema/prompt.ts`. A model with no entry gets `generic`.
   */
  readonly promptTarget?: string;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const PROVIDERS: readonly ProviderSpec[] = Object.freeze([
  {
    id: "comfy",
    name: "ComfyUI",
    locality: "local",
    hint:
      "The ComfyUI instance on this machine. Free and unmetered; runs whatever you have installed.",
    endpointEnv: "COMFY_URL",
  },
  {
    id: "fal",
    name: "fal.ai",
    locality: "remote",
    hint: "Fast hosted inference. Widest Flux coverage.",
    keyEnv: "FAL_KEY",
  },
  {
    id: "replicate",
    name: "Replicate",
    locality: "remote",
    hint: "Broadest model catalogue, including video and 3D.",
    keyEnv: "REPLICATE_API_TOKEN",
  },
  {
    id: "openai",
    name: "OpenAI",
    locality: "remote",
    hint: "DALL·E for images, GPT for text.",
    keyEnv: "OPENAI_API_KEY",
  },
  {
    id: "google",
    name: "Google",
    locality: "remote",
    hint: "Imagen for images, Gemini for text and frame analysis.",
    keyEnv: "GEMINI_API_KEY",
  },
  {
    id: "stability",
    name: "Stability AI",
    locality: "remote",
    hint: "Stable Diffusion 3.5 and SDXL, with negative-prompt support.",
    keyEnv: "STABILITY_API_KEY",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    locality: "remote",
    hint: "Claude, for script work and prompt authoring.",
    keyEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "ollama",
    name: "Ollama",
    locality: "local",
    hint: "Local language models. Free, and never leaves the machine.",
    endpointEnv: "OLLAMA_URL",
  },
]);

/**
 * The models, merged from both donors.
 *
 * Director's Console contributed the local ComfyUI path and the video models;
 * the Next.js app contributed the hosted image providers and their capability
 * flags. Prices are order-of-magnitude estimates at the time of writing and
 * are the field most likely to be stale — which is why the consent dialog says
 * "about", and why the call *count* is stated separately and exactly.
 */
export const MODELS: readonly ModelSpec[] = Object.freeze([
  // --- local: ComfyUI ------------------------------------------------------
  {
    id: "comfy:workflow",
    provider: "comfy",
    name: "ComfyUI workflow",
    hint: "Run a saved ComfyUI graph. Whatever it produces is what you get.",
    produces: "image",
    consumes: [],
    supportsNegative: true,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 0,
  },
  {
    id: "comfy:flux-dev",
    provider: "comfy",
    name: "Flux Dev (local)",
    hint: "Flux running on this machine's GPU.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 0,
    promptTarget: "flux",
  },
  {
    id: "comfy:sdxl",
    provider: "comfy",
    name: "SDXL (local)",
    hint: "SDXL on this machine, with negative prompts.",
    produces: "image",
    consumes: [],
    supportsNegative: true,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 0,
    promptTarget: "sdxl",
  },
  {
    id: "comfy:wan-2.2",
    provider: "comfy",
    name: "Wan 2.2 (local)",
    hint: "Local video generation. Slow, free, and the only unmetered video path.",
    produces: "video",
    consumes: [],
    supportsNegative: true,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 0,
    promptTarget: "wan2.2",
  },

  // --- fal.ai --------------------------------------------------------------
  {
    id: "fal:flux/schnell",
    provider: "fal",
    name: "Flux Schnell",
    hint: "Four steps. The cheapest useful image call.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 0.3,
    promptTarget: "flux",
  },
  {
    id: "fal:flux/dev",
    provider: "fal",
    name: "Flux Dev",
    hint: "Balanced quality and speed.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 2.5,
    promptTarget: "flux",
  },
  {
    id: "fal:flux-pro/v1.1",
    provider: "fal",
    name: "Flux Pro 1.1",
    hint: "Highest Flux quality. Watch the slice count with this one.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 5,
    promptTarget: "flux",
  },
  {
    id: "fal:flux/dev/image-to-image",
    provider: "fal",
    name: "Flux img2img",
    hint: "Restyle an existing frame. The one to reach for inside a Z stack.",
    produces: "image",
    consumes: ["image"],
    supportsNegative: false,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 2.5,
    promptTarget: "flux",
  },

  // --- Replicate -----------------------------------------------------------
  {
    id: "replicate:black-forest-labs/flux-schnell",
    provider: "replicate",
    name: "Flux Schnell",
    hint: "Ultra-fast, four steps.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 0.3,
    promptTarget: "flux",
  },
  {
    id: "replicate:stability-ai/sdxl",
    provider: "replicate",
    name: "SDXL",
    hint: "SDXL 1.0, with negative prompts.",
    produces: "image",
    consumes: [],
    supportsNegative: true,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 1.5,
    promptTarget: "sdxl",
  },
  {
    id: "replicate:tencent/hunyuan-video",
    provider: "replicate",
    name: "HunyuanVideo",
    hint: "Text to video. Expensive per call — one of these is many images.",
    produces: "video",
    consumes: [],
    supportsNegative: false,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 45,
    promptTarget: "hunyuan",
  },
  {
    id: "replicate:stability-ai/stable-video-diffusion",
    provider: "replicate",
    name: "Stable Video Diffusion",
    hint: "Animate a still. Consumes an image, produces a short clip.",
    produces: "video",
    consumes: ["image"],
    supportsNegative: false,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 25,
  },
  {
    id: "replicate:meta/musicgen",
    provider: "replicate",
    name: "MusicGen",
    hint: "Text to music.",
    produces: "music",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 8,
  },
  {
    id: "replicate:camenduru/tripo-sr",
    provider: "replicate",
    name: "TripoSR",
    hint: "One image to a 3D mesh.",
    produces: "mesh",
    consumes: ["image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    centsPerCall: 5,
  },

  // --- OpenAI --------------------------------------------------------------
  {
    id: "openai:dall-e-3",
    provider: "openai",
    name: "DALL·E 3",
    hint: "Strong prompt following. No negative prompt, no seed.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    centsPerCall: 4,
  },
  {
    id: "openai:gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o mini",
    hint: "Cheap text work — shot lists, prompt rewriting.",
    produces: "text",
    consumes: ["text", "image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    centsPerCall: 0.05,
  },

  // --- Google --------------------------------------------------------------
  {
    id: "google:imagen-4.0-generate-001",
    provider: "google",
    name: "Imagen 4",
    hint: "Balanced quality and speed.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 4,
  },
  {
    id: "google:imagen-4.0-ultra-generate-001",
    provider: "google",
    name: "Imagen 4 Ultra",
    hint: "Best quality, slowest, dearest.",
    produces: "image",
    consumes: [],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 6,
  },
  {
    id: "google:gemini-2.5-flash-image",
    provider: "google",
    name: "Nano Banana",
    hint: "Gemini image model. Edits from reference images as well as generating; keeps a face across edits.",
    produces: "image",
    consumes: ["image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 3.9,
  },
  {
    id: "google:gemini-2.0-flash",
    provider: "google",
    name: "Gemini 2.0 Flash",
    hint: "Reads frames. The restorer already uses it for analysis.",
    produces: "text",
    consumes: ["text", "image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    centsPerCall: 0.05,
  },

  // --- Stability -----------------------------------------------------------
  {
    id: "stability:sd3.5-large",
    provider: "stability",
    name: "SD 3.5 Large",
    hint: "Latest Stable Diffusion, with negative prompts and seeds.",
    produces: "image",
    consumes: [],
    supportsNegative: true,
    supportsSteps: true,
    supportsGuidance: true,
    supportsSeed: true,
    centsPerCall: 6.5,
    promptTarget: "sdxl",
  },

  // --- Anthropic -----------------------------------------------------------
  {
    id: "anthropic:claude-sonnet-5",
    provider: "anthropic",
    name: "Claude Sonnet 5",
    hint: "Script work, scene breakdowns, prompt authoring.",
    produces: "text",
    consumes: ["text", "image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    centsPerCall: 0.3,
  },
  {
    id: "anthropic:claude-opus-5",
    provider: "anthropic",
    name: "Claude Opus 5",
    hint: "Hardest script and prompt reasoning. About 4× Sonnet per call ($5 / $25 per M tokens).",
    produces: "text",
    consumes: ["text", "image"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: false,
    // ~1.5k input + 300 output tokens at $5 / $25 per million.
    centsPerCall: 1.5,
  },

  // --- Ollama --------------------------------------------------------------
  {
    id: "ollama:llama3.2",
    provider: "ollama",
    name: "Llama 3.2 (local)",
    hint: "Local text model. Free, and nothing leaves the machine.",
    produces: "text",
    consumes: ["text"],
    supportsNegative: false,
    supportsSteps: false,
    supportsGuidance: false,
    supportsSeed: true,
    centsPerCall: 0,
  },
]);

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));
const MODEL_BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export const provider = (id: string): ProviderSpec | null => PROVIDER_BY_ID.get(id) ?? null;
export const model = (id: string): ModelSpec | null => MODEL_BY_ID.get(id) ?? null;

export function modelsProducing(kind: MediaKind): readonly ModelSpec[] {
  return MODELS.filter((m) => m.produces === kind);
}

export function isLocal(spec: ModelSpec): boolean {
  return provider(spec.provider)?.locality === "local";
}

/**
 * A free model that makes the same kind of thing, if one exists.
 *
 * Offered beside every consent prompt, because the most useful answer to "this
 * costs $12" is frequently "there is a local model that does this".
 *
 * Candidates are ranked rather than taken in declaration order, and the ranking
 * matters more than it looks. `comfy:workflow` technically produces an image
 * and would win a naive `find`, but it is not a substitute for anything — it
 * runs whatever graph you hand it, and suggesting it in place of Flux Pro
 * offers work rather than an alternative. So:
 *
 *   1. a local model reading the same prompt dialect — a true drop-in;
 *   2. any local model that is a named generator;
 *   3. nothing. Saying nothing beats suggesting a detour.
 */
export function localAlternative(spec: ModelSpec): ModelSpec | null {
  if (isLocal(spec)) return null;
  const candidates = MODELS.filter((m) =>
    isLocal(m) && m.produces === spec.produces &&
    spec.consumes.every((c) => m.consumes.includes(c))
  );
  return candidates.find((m) =>
    m.promptTarget !== undefined && m.promptTarget === spec.promptTarget
  ) ??
    candidates.find((m) => m.promptTarget !== undefined) ??
    null;
}

// ---------------------------------------------------------------------------
// Estimating a run
// ---------------------------------------------------------------------------

/** One model, called this many times, as part of a planned run. */
export interface PlannedCall {
  readonly modelId: string;
  readonly nodeId: string;
  /** How many times this node will run — 1 normally, once per slice in a stack. */
  readonly count: number;
}

export interface RunEstimate {
  /** Calls that cost nothing: local models. Never gated. */
  readonly localCalls: number;
  /** Calls that will be billed. The number the dialog leads with. */
  readonly billedCalls: number;
  readonly cents: number;
  /** Per model, so the dialog can say which one is responsible for the total. */
  readonly byModel: ReadonlyArray<{
    readonly modelId: string;
    readonly name: string;
    readonly calls: number;
    readonly cents: number;
    readonly localAlternative: string | null;
  }>;
  /** Models named in the plan that the catalogue does not know. */
  readonly unknownModels: readonly string[];
}

/**
 * What this run will cost before any of it happens.
 *
 * Counts are exact; money is an estimate and is labelled as one everywhere it
 * is shown. The split matters: someone who sees "240 calls" understands the
 * risk even if the price is out of date by a factor of two, whereas a lone
 * dollar figure carries a precision it has not got.
 */
export function estimateRun(calls: readonly PlannedCall[]): RunEstimate {
  const byModel = new Map<string, { calls: number; cents: number }>();
  const unknown = new Set<string>();
  let localCalls = 0;
  let billedCalls = 0;
  let cents = 0;

  for (const call of calls) {
    const spec = model(call.modelId);
    if (!spec) {
      unknown.add(call.modelId);
      continue;
    }
    if (isLocal(spec)) {
      localCalls += call.count;
      continue;
    }
    billedCalls += call.count;
    const callCents = spec.centsPerCall * call.count;
    cents += callCents;
    const entry = byModel.get(call.modelId) ?? { calls: 0, cents: 0 };
    entry.calls += call.count;
    entry.cents += callCents;
    byModel.set(call.modelId, entry);
  }

  return {
    localCalls,
    billedCalls,
    cents,
    byModel: [...byModel.entries()]
      .map(([modelId, entry]) => {
        const spec = model(modelId);
        const alternative = spec ? localAlternative(spec) : null;
        return {
          modelId,
          name: spec?.name ?? modelId,
          calls: entry.calls,
          cents: entry.cents,
          localAlternative: alternative?.id ?? null,
        };
      })
      .sort((a, b) => b.cents - a.cents),
    unknownModels: [...unknown],
  };
}

/** "$12.40", "about 30¢", "free" — the string the dialog leads with. */
export function formatCost(cents: number): string {
  if (cents <= 0) return "free";
  if (cents < 100) return `about ${Math.round(cents)}¢`;
  return `about $${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Permission to spend, bound to the exact run it was granted for.
 *
 * `graphDigest` is why this is a type rather than a boolean. The failure it
 * prevents is specific and would otherwise be very easy to hit: approve a
 * one-slice test, edit the stack range to 240, press Run again, and a naive
 * "user already consented" flag spends 240 calls without asking. The token
 * carries the digest of the graph and the call count it was shown, and
 * `consentCovers` refuses it the moment either changes.
 *
 * `maxCalls` also lets one approval mean *less* than was asked for — the
 * "Run 1 and stop" answer, which is the one most people want the first time.
 */
export interface ConsentToken {
  readonly graphDigest: string;
  readonly maxCalls: number;
  readonly maxCents: number;
  /** When this was granted, epoch ms. Consent goes stale; see `CONSENT_TTL_MS`. */
  readonly grantedAt: number;
}

/**
 * How long an approval lasts.
 *
 * Fifteen minutes. Long enough that iterating on a graph does not mean
 * re-approving every run; short enough that consent given before lunch does
 * not authorise a run started after it. An unchanged graph re-approves in one
 * click, so the cost of expiry is low and the cost of no expiry is a stack
 * that runs because of a decision nobody remembers making.
 */
export const CONSENT_TTL_MS = 15 * 60 * 1000;

export type ConsentVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * May this run proceed on the strength of this token?
 *
 * A run needing no billed calls never asks — `estimate.billedCalls === 0` is
 * approved with no token at all, which is what makes the local path frictionless.
 */
export function consentCovers(
  estimate: RunEstimate,
  graphDigest: string,
  token: ConsentToken | null,
  now: number = Date.now(),
): ConsentVerdict {
  if (estimate.billedCalls === 0) return { ok: true };

  if (estimate.unknownModels.length > 0) {
    return {
      ok: false,
      reason: `This run names models the catalogue does not know: ` +
        `${estimate.unknownModels.join(", ")}. Their cost cannot be estimated, so ` +
        `consent cannot be asked for honestly.`,
    };
  }

  if (!token) {
    return {
      ok: false,
      reason: `${estimate.billedCalls} paid calls (${formatCost(estimate.cents)}) ` +
        `need confirming before this runs.`,
    };
  }

  if (token.graphDigest !== graphDigest) {
    return {
      ok: false,
      reason: "The graph changed after this run was approved. Confirm the new run.",
    };
  }

  if (now - token.grantedAt > CONSENT_TTL_MS) {
    return { ok: false, reason: "That approval has expired. Confirm the run again." };
  }

  if (estimate.billedCalls > token.maxCalls) {
    return {
      ok: false,
      reason: `Approved for ${token.maxCalls} calls; this run needs ` +
        `${estimate.billedCalls}. Confirm the larger run.`,
    };
  }

  if (estimate.cents > token.maxCents) {
    return {
      ok: false,
      reason: `Approved for ${formatCost(token.maxCents)}; this run estimates ` +
        `${formatCost(estimate.cents)}. Confirm the larger run.`,
    };
  }

  return { ok: true };
}

/**
 * The sentence the dialog leads with.
 *
 * Built here rather than in the UI so the wording is testable and so the
 * server can put the same sentence in a refusal — a run rejected by the API
 * should explain itself in the words the user was going to be shown anyway.
 */
export function describeRun(estimate: RunEstimate): string {
  if (estimate.billedCalls === 0) {
    return estimate.localCalls === 0
      ? "Nothing to run."
      : `${estimate.localCalls} local calls · free`;
  }
  const lead = `${estimate.billedCalls} paid ${estimate.billedCalls === 1 ? "call" : "calls"} · ` +
    formatCost(estimate.cents);
  return estimate.localCalls > 0 ? `${lead} · plus ${estimate.localCalls} local` : lead;
}
