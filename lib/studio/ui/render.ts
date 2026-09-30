/**
 * render.ts — drawing the blueprint.
 *
 * ## Why cards are DOM and wires are canvas
 *
 * The dual-typography rule requires that project data — file names, values,
 * prompts — be selectable and copyable. Canvas text is neither. So node cards
 * are real DOM inside a CSS-transformed container: text stays crisp at any
 * zoom, hit-testing is the browser's, and `user-select` works.
 *
 * Wires are the opposite case: hundreds of bezier curves that change on every
 * pointer move, with no text and no interaction target. One canvas repaint
 * beats hundreds of SVG path mutations, so they go on a canvas *underneath*
 * the cards.
 *
 * Both are driven by the same pan/zoom, so they cannot disagree.
 */

import {
  type Adjacency,
  buildAdjacency,
  type GraphDocument,
  type NodeInstance,
  nodeRect,
} from "../core/graph.ts";
import { asPortId, type NodeId } from "../core/ids.ts";
import { type PortSpec, signalColour } from "../core/ports.ts";
import { categoryColour, type NodeRegistry } from "../core/registry.ts";
import {
  DEFAULT_DEPTH_STYLE,
  DEFAULT_GRID,
  projectSlice,
  type Rect,
  type Vec2,
  visibleSlices,
} from "../core/spatial.ts";
import { FILTER_TOKENS, filterState } from "../core/tokens.ts";

/** Pan and zoom, in screen pixels and multiplier. */
export interface Viewport {
  pan: Vec2;
  zoom: number;
}

/** Where a port's socket sits, in blueprint units. Used to anchor wires. */
export interface PortAnchor {
  readonly node: NodeId;
  readonly port: string;
  readonly direction: "input" | "output";
  readonly at: Vec2;
  readonly kind: string;
}

/** A wire currently being dragged, before it is committed. */
export interface PendingWire {
  readonly from: PortAnchor;
  /** Cursor position, blueprint units. */
  readonly to: Vec2;
  readonly valid: boolean;
}

const CARD_HEAD_H = 32;
const PORT_ROW_H = 20;
const PORT_ROWS_START = 3;
const CARD_BODY_PAD_BOTTOM = 6;
const CARD_BORDER_Y = 2;
/** Ports shown on a card before it collapses the rest into a "+N more" line. */
const MAX_VISIBLE_PORTS = 7;

/**
 * Which ports a card actually shows.
 *
 * A stabilisation node has fourteen inputs. Drawing all of them makes a card
 * taller than the viewport and turns the canvas into a form. So the card shows
 * its structural ports (image, mask, sequence — the ones you *wire*) plus the
 * parameters that are connected or explicitly set, and the rest live in the
 * inspector. The count of what is hidden is always shown, because a card that
 * silently omits controls is worse than one that admits it.
 */
export function visiblePorts(
  node: NodeInstance,
  ports: readonly PortSpec[],
  adjacency: Adjacency,
  unfolded = false,
): { shown: PortSpec[]; hidden: number } {
  const cardPorts = ports.filter((p) => p.id !== "project_id");
  if (unfolded) return { shown: [...cardPorts], hidden: 0 };

  const wired = new Set(
    (adjacency.incoming.get(node.id) ?? []).map((e) => e.to.port as string),
  );
  const structural = new Set([
    "image",
    "sequence",
    "neighbours",
    "mask",
    "a",
    "b",
    "base",
    "over",
    "index",
  ]);

  /**
   * A port with no `defaultValue` is required: the evaluator refuses to run
   * the node without it. Folding one away produces a card that cannot be
   * wired into a runnable state from the canvas — the compiler reports "no
   * source", and the socket it names is not on screen.
   *
   * The Viewer's `compare` was exactly this: required, unwired, hidden, and
   * therefore permanently blocking the run of a graph that looked complete.
   * A required-and-unsatisfied port is the *most* important thing a card can
   * show, so it outranks the visible-port budget rather than competing for it.
   */
  const blocking = (p: PortSpec) =>
    p.direction === "input" && p.defaultValue === undefined &&
    !wired.has(p.id) && node.values[p.id] === undefined;

  const ranked = cardPorts.filter((p) =>
    structural.has(p.id) || wired.has(p.id) || node.values[p.id] !== undefined
  );
  // Keep declaration order; it mirrors the engine's own control order.
  const shown = ranked.slice(0, MAX_VISIBLE_PORTS);
  for (const port of cardPorts) {
    if (blocking(port) && !shown.includes(port)) shown.push(port);
  }
  return { shown, hidden: cardPorts.length - shown.length };
}

/** Card height implied by how many rows it will draw. */
export function cardHeight(
  inputRows: number,
  outputRows: number,
  extra: boolean,
  previewWidth = 0,
): number {
  const rows = inputRows + outputRows;
  const chrome = CARD_HEAD_H + PORT_ROWS_START + rows * PORT_ROW_H +
    (extra ? 15 : 0) + CARD_BODY_PAD_BOTTOM + CARD_BORDER_Y;
  return previewWidth > 0 ? chrome + cardMediaHeight(previewWidth) : chrome;
}

/** 16:9-ish still on the card, sized to the card width. */
export function cardMediaHeight(width: number): number {
  return Math.round(width * 0.56);
}

/**
 * Whether this type keeps a picture on the card itself.
 *
 * Video and Frame Selection *are* the picture, so they always have a slot.
 * Outputs exist to look at (or write) a result. Stages only grow a slot after
 * something has actually been run — an empty hatch on every Stabilisation
 * would turn the graph into a contact sheet of nothing.
 */
export function cardShowsMedia(
  spec: { id: string; category: string },
  hasPreview = false,
): boolean {
  return spec.id === "source.sequence" || spec.id === "source.frame" ||
    spec.id === "ref.entity" || spec.category === "output" || hasPreview;
}

function previewStamp(
  typeId: string,
  info: {
    preview: NodePreview | undefined;
    mediaUrl: boolean;
    frame: number;
    compareWired: boolean;
  },
): string {
  if (info.preview) {
    return `${info.preview.frame} · ${Math.round(info.preview.elapsedMs)} ms`;
  }
  switch (typeId) {
    case "source.sequence":
    case "source.frame":
      return info.mediaUrl ? `frame ${info.frame}` : "no project";
    case "out.view":
      return info.compareWired ? "Run to compare" : "Run to see this";
    case "ref.entity":
      return info.mediaUrl ? "from Home" : "no drawing yet";
    case "out.render":
      return "Run to encode";
    case "out.save":
      return "Run to write";
    default:
      return "Run to see this";
  }
}

/** Socket position for one port, in blueprint units, relative to the canvas. */
export function anchorFor(
  node: NodeInstance,
  index: number,
  direction: "input" | "output",
  inputCount: number,
): Vec2 {
  const row = direction === "input" ? index : inputCount + index;
  return {
    x: node.position.x + (direction === "input" ? 0 : node.size.w),
    y: node.position.y + CARD_HEAD_H + PORT_ROWS_START + row * PORT_ROW_H + PORT_ROW_H / 2,
  };
}

// ===========================================================================
// Card DOM
// ===========================================================================

export interface RenderContext {
  readonly registry: NodeRegistry;
  readonly cardsHost: HTMLElement;
  readonly stacksHost: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly world: HTMLElement;
}

/** A rendered frame, held against the node that produced it. */
export interface NodePreview {
  /** `data:` URL from the engine. */
  readonly image: string;
  readonly frame: number;
  readonly elapsedMs: number;
}

/** Everything a frame of rendering needs to know about interaction state. */
export interface RenderState {
  readonly selected: ReadonlySet<NodeId>;
  /** Latest result per node. Empty until something has been run. */
  readonly previews: ReadonlyMap<NodeId, NodePreview>;
  readonly filterText: string;
  readonly pending: PendingWire | null;
  /** Ports that would accept the wire currently being dragged. */
  readonly candidates: ReadonlySet<string>;
  readonly viewport: Viewport;
  /** Bound restorer project, used to paint Video cards before Preview runs. */
  readonly projectId: string | null;
  readonly currentFrame: number;
  readonly playing: boolean;
  readonly sequenceLength: number;
  /** Bound reel title for Video cards. Falls back to the project id. */
  readonly projectLabel: string | null;
  /**
   * Resolved Style/Text per node, from `core/style_eval.ts`: what a reference
   * chain actually says and what a generate node would send. Absent while the
   * library is still loading, which is why every read falls back quietly.
   */
  readonly resolved?: {
    readonly texts: ReadonlyMap<string, string>;
    readonly lines: ReadonlyMap<NodeId, string>;
  };
  /**
   * Nodes the user asked to show every port on.
   *
   * Per-node rather than global: the reason to unfold a card is to reach one
   * particular control on one particular node, and unfolding all of them turns
   * the canvas into the form the folding exists to prevent.
   */
  readonly unfolded: ReadonlySet<NodeId>;
  /** How many versions the ledger holds per node, for the card's badge. */
  readonly versionCount: ReadonlyMap<NodeId, number>;
}

/**
 * Rebuild the card layer.
 *
 * Rebuilt wholesale rather than diffed: at the scale a blueprint reaches
 * (dozens of cards, not thousands) a full rebuild is under a millisecond, and
 * a diffing layer would be a second source of truth about what is on screen.
 * `contain: layout paint` on `.card` keeps the browser from re-laying-out the
 * whole world for it.
 *
 * @returns the anchor of every drawn port, so the wire pass can find sockets
 *          without re-deriving the layout.
 */
export function renderCards(
  ctx: RenderContext,
  graph: GraphDocument,
  state: RenderState,
): Map<string, PortAnchor> {
  const adjacency = buildAdjacency(graph);
  const anchors = new Map<string, PortAnchor>();
  const filterActive = state.filterText.trim().length > 0;
  const needle = state.filterText.trim().toLowerCase();

  const frag = document.createDocumentFragment();

  for (const node of Object.values(graph.nodes)) {
    const spec = ctx.registry.get(node.type);
    if (!spec) continue;

    const inputs = visiblePorts(node, spec.inputs, adjacency, state.unfolded.has(node.id));
    const outputs = { shown: [...spec.outputs], hidden: 0 };
    const hidden = inputs.hidden;

    const el = document.createElement("div");
    el.className = "card";
    el.dataset.node = node.id;
    el.dataset.card = spec.id;
    el.dataset.category = spec.category;
    el.style.setProperty("--accent", categoryColour(spec.category));
    el.style.left = `${node.position.x}px`;
    el.style.top = `${node.position.y}px`;
    el.style.width = `${node.size.w}px`;

    if (state.selected.has(node.id)) el.classList.add("selected");
    // Lifecycle is a class, not a colour set here, so the whole vocabulary
    // lives in one place in the stylesheet. `state-*` covers every member of
    // NodeState; `muted`/`failed` stay as their own classes because they carry
    // behaviour (opacity, the "muted" pseudo-label) older rules already match.
    el.classList.add(`state-${node.state}`);
    if (node.state === "muted") el.classList.add("muted");
    if (node.state === "failed") el.classList.add("failed");
    if (node.collapsed) el.classList.add("collapsed");

    // The three-state filter: dim, never hide. Removing a card would change
    // the layout, and a graph whose geometry moves when you type destroys the
    // spatial memory the plane exists to provide.
    const matches = `${node.name} ${spec.label} ${node.type}`.toLowerCase().includes(needle);
    const fstate = filterState(filterActive, matches);
    el.classList.add(FILTER_TOKENS[fstate].cssClass);

    // --- header ---
    const head = document.createElement("div");
    head.className = "card-head";
    head.innerHTML = `<span class="card-swatch"></span>` +
      `<span class="card-title t-primary"></span>` +
      `<span class="card-name t-secondary"></span>` +
      `<span class="card-badges"></span>` +
      `<button type="button" class="card-opts t-primary" title="Options for this node">\u22ef</button>`;
    head.querySelector(".card-title")!.textContent = spec.label;
    const nameEl = head.querySelector(".card-name")!;
    if (spec.id === "source.sequence") {
      const label = state.projectLabel || state.projectId;
      if (label) {
        nameEl.textContent = label;
        nameEl.setAttribute("title", label);
      }
    } else if (
      node.name &&
      node.name !== spec.label &&
      node.name !== "Frame Pick" &&
      node.name !== "Footage"
    ) {
      nameEl.textContent = node.name;
    }

    // A version count on the header is the cheapest possible answer to "has
    // this node produced anything, and how many times". Absent until there is
    // something to count, so an untouched graph carries no chrome.
    const versions = state.versionCount.get(node.id) ?? 0;
    if (versions > 0) {
      const badge = document.createElement("span");
      badge.className = "card-vbadge t-secondary";
      badge.textContent = `v${versions}`;
      badge.title = `${versions} recorded version${versions === 1 ? "" : "s"}`;
      head.querySelector(".card-badges")!.append(badge);
    }
    el.append(head);

    if (node.collapsed) {
      const midY = node.position.y + CARD_HEAD_H / 2;
      for (const port of spec.inputs) {
        anchors.set(`${node.id}:${port.id}:input`, {
          node: node.id,
          port: port.id,
          direction: "input",
          at: { x: node.position.x, y: midY },
          kind: port.kind,
        });
      }
      for (const port of spec.outputs) {
        anchors.set(`${node.id}:${port.id}:output`, {
          node: node.id,
          port: port.id,
          direction: "output",
          at: { x: node.position.x + node.size.w, y: midY },
          kind: port.kind,
        });
      }
      el.style.height = "auto";
      frag.append(el);
      continue;
    }

    // --- ports ---
    const body = document.createElement("div");
    body.className = "card-body";

    inputs.shown.forEach((port, i) => {
      const wired = (adjacency.incoming.get(node.id) ?? []).some((e) => e.to.port === port.id);
      body.append(portRow(node, port, "input", wired, state));
      const at = anchorFor(node, i, "input", inputs.shown.length);
      const key = `${node.id}:${port.id}:input`;
      anchors.set(key, { node: node.id, port: port.id, direction: "input", at, kind: port.kind });
    });

    outputs.shown.forEach((port, i) => {
      const wired = (adjacency.outgoing.get(node.id) ?? []).some((e) => e.from.port === port.id);
      body.append(portRow(node, port, "output", wired, state));
      const at = anchorFor(node, i, "output", inputs.shown.length);
      const key = `${node.id}:${port.id}:output`;
      anchors.set(key, { node: node.id, port: port.id, direction: "output", at, kind: port.kind });
    });

    if (hidden > 0) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "card-more t-primary";
      more.dataset.unfold = node.id;
      more.textContent = `+${hidden} more \u2014 show on card`;
      more.title = "Draw every port on this card, so the folded ones can be wired here";
      body.append(more);
    } else if (state.unfolded.has(node.id)) {
      const folded = visiblePorts(node, spec.inputs, adjacency, false);
      if (folded.hidden > 0) {
        const less = document.createElement("button");
        less.type = "button";
        less.className = "card-more t-primary";
        less.dataset.fold = node.id;
        less.textContent = "fold ports away";
        body.append(less);
      }
    }

    // Cards you can write in.
    //
    // A Prompt node whose whole purpose is a sentence should not send you to
    // the inspector to type it. The fields are bound to the same ports the
    // inspector edits, so the two never disagree, and a wired port shows what
    // arrives on the wire instead of an editor nobody's typing would survive.
    for (const field of EDITABLE_FIELDS[spec.id] ?? []) {
      const port = spec.inputs.find((p) => p.id === field.port);
      if (!port) continue;
      const wiredHere = (adjacency.incoming.get(node.id) ?? []).some((e) => e.to.port === port.id);
      const box = document.createElement("label");
      box.className = "card-write";
      const caption = document.createElement("span");
      caption.className = "card-write-label t-secondary";
      caption.textContent = field.label ?? port.label;
      box.append(caption);
      if (wiredHere) {
        const note = document.createElement("span");
        note.className = "card-write-wired t-secondary";
        note.textContent = "from a wire";
        box.append(note);
      } else {
        const area = document.createElement("textarea");
        area.className = "card-write-input t-secondary";
        area.rows = field.rows ?? 2;
        area.placeholder = field.placeholder ?? port.help;
        area.spellcheck = false;
        area.dataset.node = node.id;
        area.dataset.writePort = port.id;
        area.value = String(
          (node.values[port.id] as { value?: string } | undefined)?.value ??
            (port.defaultValue as { value?: string } | undefined)?.value ?? "",
        );
        area.title = port.help;
        box.append(area);
      }
      body.append(box);
    }

    // What this node resolves to, for the nodes whose output is language.
    const resolvedLine = state.resolved?.lines.get(node.id);
    if (resolvedLine) {
      const note = document.createElement("div");
      note.className = "card-resolved t-secondary";
      note.textContent = resolvedLine;
      note.title = resolvedLine;
      body.append(note);
    }

    el.append(body);

    const preview = state.previews.get(node.id);
    const wantsMedia = cardShowsMedia(spec, Boolean(preview));
    const pickIndex = spec.id === "source.frame"
      ? Math.max(
        0,
        Math.floor((node.values.index as { value?: number } | undefined)?.value ?? 0),
      )
      : state.currentFrame;
    let mediaUrl = preview?.image ?? null;
    // A Subject card shows the drawing or photograph attached to it on Home.
    if (!mediaUrl && spec.id === "ref.entity") {
      mediaUrl = state.resolved?.texts.get(`${node.id}:reference`) || null;
    }
    if (
      !mediaUrl && state.projectId && (spec.id === "source.sequence" || spec.id === "source.frame")
    ) {
      mediaUrl = `/api/project/${
        encodeURIComponent(state.projectId)
      }/frame/${pickIndex}?max_edge=420`;
    }
    if (wantsMedia) {
      const shot = document.createElement("div");
      shot.className = mediaUrl ? "card-preview" : "card-preview is-empty";
      if (mediaUrl) shot.style.backgroundImage = `url("${mediaUrl}")`;
      shot.style.height = `${cardMediaHeight(node.size.w)}px`;

      if (spec.id === "source.sequence") {
        const play = document.createElement("button");
        play.type = "button";
        play.className = "card-play";
        play.textContent = state.playing ? "⏸" : "▶";
        play.title = state.playing ? "Pause in Grade" : "Play this reel in Grade";
        shot.append(play);
      }

      const compareEdge = spec.id === "out.view"
        ? (adjacency.incoming.get(node.id) ?? []).find((e) => e.to.port === asPortId("compare"))
        : undefined;
      const compareWired = Boolean(compareEdge);
      if (compareWired) shot.classList.add("is-compare");

      // The wipe itself: the compare source drawn over the left half of the
      // card, with a divider. Before this the card only said "Run to compare".
      if (compareEdge) {
        const sourceNode = graph.nodes[compareEdge.from.node];
        const sourceSpec = sourceNode ? ctx.registry.get(sourceNode.type) : null;
        let compareUrl = state.previews.get(compareEdge.from.node)?.image ?? null;
        if (!compareUrl && state.projectId && sourceSpec) {
          const sourceIndex = sourceSpec.id === "source.frame"
            ? Math.max(
              0,
              Math.floor((sourceNode!.values.index as { value?: number } | undefined)?.value ?? 0),
            )
            : state.currentFrame;
          if (sourceSpec.id === "source.sequence" || sourceSpec.id === "source.frame") {
            compareUrl = `/api/project/${
              encodeURIComponent(state.projectId)
            }/frame/${sourceIndex}?max_edge=420`;
          }
        }
        if (compareUrl && mediaUrl) {
          const wipe = document.createElement("div");
          wipe.className = "card-wipe";
          wipe.style.backgroundImage = `url("${compareUrl}")`;
          shot.append(wipe); // `.card-preview.is-compare::after` already draws the divider
        }
      }

      const stamp = document.createElement("span");
      stamp.className = "preview-stamp t-secondary";
      stamp.textContent = previewStamp(spec.id, {
        preview,
        mediaUrl: Boolean(mediaUrl),
        frame: spec.id === "source.frame" ? pickIndex : state.currentFrame,
        compareWired,
      });
      shot.append(stamp);

      const last = Math.max(0, state.sequenceLength - 1);
      if (spec.id === "source.sequence" || spec.id === "source.frame") {
        const scrub = document.createElement("input");
        scrub.type = "range";
        scrub.className = spec.id === "source.sequence" ? "card-scrub" : "card-scrub card-index";
        scrub.min = "0";
        scrub.max = String(last);
        scrub.step = "1";
        scrub.value = String(Math.min(pickIndex, last));
        scrub.disabled = state.sequenceLength <= 0;
        scrub.dataset.node = node.id;
        if (spec.id === "source.frame") scrub.dataset.port = "index";
        scrub.title = spec.id === "source.sequence"
          ? "Playhead — the frame Grade looks at"
          : "Which frame this node emits";
        shot.append(scrub);
      }

      el.append(shot);
    }

    frag.append(el);
  }

  ctx.cardsHost.replaceChildren(frag);
  return anchors;
}

function portRow(
  node: NodeInstance,
  port: PortSpec,
  direction: "input" | "output",
  wired: boolean,
  state: RenderState,
): HTMLElement {
  const row = document.createElement("div");
  row.className = direction === "output" ? "port-row out" : "port-row";
  row.style.setProperty("--sig", signalColour(port.kind));

  const dot = document.createElement("span");
  dot.className = "port-dot";
  dot.dataset.node = node.id;
  dot.dataset.port = port.id;
  dot.dataset.dir = direction;
  if (wired) dot.classList.add("filled");
  if (state.pending) {
    const key = `${node.id}:${port.id}:${direction}`;
    dot.classList.add(state.candidates.has(key) ? "candidate" : "rejected");
  }
  dot.title = `${port.label} · ${port.kind}\n${port.help}`;

  const label = document.createElement("span");
  label.className = "port-label t-primary";
  label.textContent = port.label;

  row.append(dot, label);

  // The value chip. Primary typography names the port; secondary shows the
  // value, in the signal's own colour, so a chip always matches its wire.
  const value = node.values[port.id] ?? port.defaultValue;
  if (direction === "input" && value) {
    const chip = document.createElement("span");
    chip.className = "port-value t-secondary";
    chip.textContent = describeValue(value);
    if (wired) chip.classList.add("wired");
    if (node.authoredBy[port.id] === "ai") chip.classList.add("unreviewed");
    chip.title = wired ? "Overridden by a connection" : String(chip.textContent);
    row.append(chip);
  }
  return row;
}

/**
 * Which cards carry a writing surface, and for which ports.
 *
 * Deliberately a short list: a textarea on every Text port would turn the
 * canvas into a form. These are the nodes whose *subject matter* is language.
 */
const EDITABLE_FIELDS: Record<
  string,
  ReadonlyArray<{ port: string; label?: string; rows?: number; placeholder?: string }>
> = {
  "ref.prompt": [
    { port: "subject", label: "Subject", rows: 3, placeholder: "What is happening in the shot" },
    { port: "avoid", label: "Avoid", rows: 2, placeholder: "What must not appear" },
  ],
  "gen.image": [
    { port: "prompt", label: "Prompt", rows: 3, placeholder: "What to generate" },
    { port: "negative", label: "Avoid", rows: 2, placeholder: "What must not appear" },
  ],
  "gen.video": [
    { port: "prompt", label: "Prompt", rows: 3, placeholder: "What to generate" },
    { port: "negative", label: "Avoid", rows: 2, placeholder: "What must not appear" },
  ],
  "gen.audio": [
    { port: "prompt", label: "Prompt", rows: 2, placeholder: "What to generate" },
  ],
  "gen.mesh": [
    { port: "prompt", label: "Prompt", rows: 2, placeholder: "What to generate" },
  ],
  "llm.ask": [
    { port: "instruction", label: "Ask", rows: 2, placeholder: "One task" },
    { port: "context", label: "Context", rows: 2, placeholder: "What it should know" },
  ],
  "mask.segment": [
    { port: "prompt", label: "Find", rows: 2, placeholder: "What to isolate" },
  ],
};

/** One-line rendering of a signal value for a card chip. */
export function describeValue(value: { kind: string; [k: string]: unknown }): string {
  switch (value.kind) {
    case "Number":
      return formatNumber(value.value as number);
    case "Flag":
      return (value.value as boolean) ? "on" : "off";
    case "Enum":
    case "Text":
      return String(value.value || "—");
    case "Image":
    case "Mask":
    case "Flow":
      return "buffer";
    case "Sequence":
      return `${(value.buffers as unknown[])?.length ?? 0} fr`;
    default:
      return value.kind;
  }
}

/** Trim float dust without losing meaningful precision on a 0.001-step slider. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(4)));
}

// ===========================================================================
// Wires and grid
// ===========================================================================

/**
 * Repaint the grid and every wire.
 *
 * The canvas is sized in *device* pixels and scaled by DPR so lines stay
 * one physical pixel on a Retina display; without that the whole grid reads as
 * a grey haze.
 */
export function renderWires(
  ctx: RenderContext,
  graph: GraphDocument,
  anchors: Map<string, PortAnchor>,
  state: RenderState,
): void {
  const canvas = ctx.canvas;
  const dpr = globalThis.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }
  const g = canvas.getContext("2d");
  if (!g) return;

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const { pan, zoom } = state.viewport;
  drawGrid(g, w, h, pan, zoom);

  g.save();
  g.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * pan.x, dpr * pan.y);
  g.lineWidth = 1.6 / zoom;

  for (const edge of Object.values(graph.edges)) {
    const from = anchors.get(`${edge.from.node}:${edge.from.port}:output`);
    const to = anchors.get(`${edge.to.node}:${edge.to.port}:input`);
    if (!from || !to) continue; // a port hidden behind "+N more"
    g.strokeStyle = signalColour(from.kind as never);
    drawWire(g, from.at, to.at);
  }

  if (state.pending) {
    g.strokeStyle = state.pending.valid ? "#8fbf5a" : "#d9705b";
    g.setLineDash([6 / zoom, 4 / zoom]);
    drawWire(g, state.pending.from.at, state.pending.to);
    g.setLineDash([]);
  }
  g.restore();
}

/**
 * A horizontal cubic bezier.
 *
 * The control-point offset grows with the horizontal gap but is clamped, so a
 * short hop between adjacent cards does not balloon into a loop, and a wire
 * spanning the canvas does not flatten into a straight line indistinguishable
 * from a card border.
 */
function drawWire(g: CanvasRenderingContext2D, a: Vec2, b: Vec2): void {
  const dx = Math.abs(b.x - a.x);
  const bend = Math.max(26, Math.min(150, dx * 0.5));
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.bezierCurveTo(a.x + bend, a.y, b.x - bend, b.y, b.x, b.y);
  g.stroke();
}

/**
 * The blueprint grid.
 *
 * Drawn in *screen* space from the visible bounds rather than in world space,
 * so the cost is bounded by the size of the window and not by how far the user
 * has panned. Minor lines fade out below the zoom at which they would alias
 * into a solid tone.
 */
function drawGrid(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  pan: Vec2,
  zoom: number,
): void {
  const minor = DEFAULT_GRID.minor * zoom;
  const major = minor * DEFAULT_GRID.majorEvery;

  const line = (step: number, colour: string) => {
    if (step < 5) return; // below this the lines merge into a wash
    g.strokeStyle = colour;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = ((pan.x % step) + step) % step; x < w; x += step) {
      g.moveTo(Math.round(x) + 0.5, 0);
      g.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = ((pan.y % step) + step) % step; y < h; y += step) {
      g.moveTo(0, Math.round(y) + 0.5);
      g.lineTo(w, Math.round(y) + 0.5);
    }
    g.stroke();
  };

  line(minor, "rgba(255,255,255,0.028)");
  line(major, "rgba(255,255,255,0.055)");
}

// ===========================================================================
// Z stacks
// ===========================================================================

/** A slice as the engine reported it. Mirrors `zstack.SliceProfile`. */
export interface SliceProfile {
  frame: number;
  relative_depth: number;
  sheet_x: number;
  sheet_y: number;
  sheet_w: number;
  sheet_h: number;
  luminance: number;
  sharpness: number;
  score: number;
  verdict: string;
}

export interface StackBuild {
  project_id: string;
  focus_frame: number;
  sheet_path: string;
  sheet_width: number;
  sheet_height: number;
  slices: SliceProfile[];
}

/**
 * Tint a slice by the analysis pass's verdict.
 *
 * This is the payoff of stacking frames spatially rather than listing them: a
 * frame the pass rejected reads as a *dark card in the stack* before you roll
 * to it. `drop` is heavily darkened, `review` lightly; a frame nobody measured
 * gets no tint at all, because "unmeasured" must not look like "fine".
 */
export function verdictTint(slice: SliceProfile): string {
  if (slice.score < 0) return "transparent";
  if (slice.verdict === "drop") return "rgba(217,112,91,0.55)";
  if (slice.verdict === "review") return "rgba(232,163,61,0.22)";
  return "transparent";
}

function stripFit(host: HTMLElement, sliceW: number, sliceH: number): number {
  const maxW = Math.max(64, host.clientWidth - 16);
  const maxH = Math.max(48, host.clientHeight - 12);
  if (sliceW <= 0 || sliceH <= 0) return 1;
  return Math.min(1, maxW / sliceW, maxH / sliceH);
}

/**
 * Draw the depth carousel from one contact sheet.
 *
 * Every slice is one element positioned by `projectSlice()` — the same
 * function the layout engine uses — so the strip and the geometry cannot
 * disagree about where depth goes. The sheet is a single image, so a roll is
 * one decode rather than one per slice.
 */
export function renderCarousel(
  host: HTMLElement,
  build: StackBuild,
  sheetUrl: string,
  focusIndex: number,
  wrap = false,
): void {
  const frag = document.createDocumentFragment();
  const centre = { x: host.clientWidth / 2, y: host.clientHeight / 2 };

  // Projected about the origin, not about `centre`: each slice element is
  // already centred in the strip by its own `left`/`top`, and its
  // `transform-origin` is its own middle. So the affine's translation is the
  // pure depth offset and its scale is the pure depth scale — compensating for
  // an origin here as well would cancel the offset out.
  const order = visibleSlices(
    { sliceCount: build.slices.length, focusIndex, wrap },
    { x: 0, y: 0 },
    DEFAULT_DEPTH_STYLE,
  );

  for (const t of order) {
    const slice = build.slices[focusIndex + t.relativeDepth];
    if (!slice) continue;

    const el = document.createElement("div");
    el.className = t.relativeDepth === 0 ? "slice focus" : "slice";
    el.style.width = `${slice.sheet_w}px`;
    el.style.height = `${slice.sheet_h}px`;
    el.style.backgroundImage = `url(${sheetUrl})`;
    el.style.backgroundPosition = `-${slice.sheet_x}px -${slice.sheet_y}px`;
    el.style.setProperty("--verdict-tint", verdictTint(slice));
    el.style.opacity = String(t.opacity);
    el.dataset.frame = String(slice.frame);

    const fit = stripFit(host, slice.sheet_w, slice.sheet_h);
    const m = t.transform;
    el.style.left = `${centre.x - slice.sheet_w / 2}px`;
    el.style.top = `${centre.y - slice.sheet_h / 2}px`;
    el.style.transform = `translate(${m.e * fit}px, ${m.f * fit}px) scale(${m.a * fit})`;
    el.style.zIndex = String(100 - Math.abs(t.relativeDepth));

    const badge = document.createElement("span");
    badge.className = "slice-badge t-secondary";
    badge.textContent = slice.score >= 0
      ? `${slice.frame} · ${slice.score.toFixed(0)}`
      : String(slice.frame);
    if (slice.verdict) badge.title = `${slice.verdict} · luminance ${slice.luminance.toFixed(1)}`;
    el.append(badge);

    frag.append(el);
  }
  host.replaceChildren(frag);
}

/** The rectangle enclosing a set of nodes, padded — used to draw stack frames. */
export function groupRect(nodes: readonly NodeInstance[], pad = 18): Rect | null {
  if (nodes.length === 0) return null;
  const rects = nodes.map(nodeRect);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

/** Draw the dashed frame around each Z stack's member nodes. */
export function renderStacks(ctx: RenderContext, graph: GraphDocument): void {
  const frag = document.createDocumentFragment();
  for (const stack of Object.values(graph.stacks)) {
    const members = Object.values(graph.nodes).filter((n) => n.stack?.id === stack.id);
    const rect = groupRect(members);
    if (!rect) continue;

    const el = document.createElement("div");
    el.className = "stack";
    el.style.setProperty("--accent", categoryColour("flow"));
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;

    const label = document.createElement("span");
    label.className = "stack-label t-primary";
    label.textContent = `${stack.label} · ${stack.sliceCount} slices`;
    label.dataset.stack = stack.id;
    el.append(label);
    frag.append(el);
  }
  ctx.stacksHost.replaceChildren(frag);
}

/** Apply pan/zoom to the DOM layer. The canvas applies it in its own transform. */
export function applyViewport(world: HTMLElement, viewport: Viewport): void {
  world.style.transform =
    `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`;
}

export { projectSlice };

/**
 * Draw the depth carousel from individually rendered frames.
 *
 * The contact-sheet path exists because reading 17 source frames from disk in
 * the browser is not viable. A completed stack run has already produced its
 * frames as `data:` URLs, so there is no sheet to slice and no second request
 * to make — the two paths differ only in where the pixels come from, and share
 * `projectSlice` so they cannot disagree about where depth goes.
 */
export function renderCarouselFromImages(
  host: HTMLElement,
  slices: ReadonlyArray<{ frame: number; image: string }>,
  focusIndex: number,
  wrap = false,
): void {
  const frag = document.createDocumentFragment();
  const centre = { x: host.clientWidth / 2, y: host.clientHeight / 2 };
  const w = 176;
  const h = 132;

  const order = visibleSlices(
    { sliceCount: slices.length, focusIndex, wrap },
    { x: 0, y: 0 },
    DEFAULT_DEPTH_STYLE,
  );

  for (const t of order) {
    const slice = slices[focusIndex + t.relativeDepth];
    if (!slice) continue;

    const el = document.createElement("div");
    el.className = t.relativeDepth === 0 ? "slice focus" : "slice";
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.backgroundImage = `url(${slice.image})`;
    el.style.backgroundSize = "contain";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundColor = "#000";
    el.style.opacity = String(t.opacity);
    const fit = stripFit(host, w, h);
    el.style.left = `${centre.x - w / 2}px`;
    el.style.top = `${centre.y - h / 2}px`;
    const m = t.transform;
    el.style.transform = `translate(${m.e * fit}px, ${m.f * fit}px) scale(${m.a * fit})`;
    el.style.zIndex = String(100 - Math.abs(t.relativeDepth));
    el.dataset.frame = String(slice.frame);

    const badge = document.createElement("span");
    badge.className = "slice-badge t-secondary";
    badge.textContent = String(slice.frame);
    el.append(badge);
    frag.append(el);
  }
  host.replaceChildren(frag);
}
