/**
 * app.ts — the Blueprint canvas application.
 *
 * Holds one `GraphDocument` and rebuilds the view from it. Every edit goes
 * through `core/graph.ts`, which returns a new document rather than mutating
 * the old one, so undo is a stack of pointers and "did anything change" is a
 * `!==` rather than a deep comparison.
 *
 * The engine is reached through a same-origin `/api` proxy (see `server.ts`),
 * so the browser never makes a cross-origin request and CORS never enters it.
 */

import {
  addNode,
  connect,
  disconnect,
  emptyGraph,
  type GraphDocument,
  type NodeInstance,
  nodeRect,
  removeNode,
  type StackInstance,
  updateNode,
} from "../core/graph.ts";
import {
  asGraphId,
  asNodeId,
  asPortId,
  asStackId,
  createIdSource,
  type NodeId,
  type StackId,
} from "../core/ids.ts";
import { clampToRange, displayValue, type PortSpec, type SignalValue } from "../core/ports.ts";
import { estimateRun, formatCost, type PlannedCall } from "../core/providers.ts";
import { categoryColour, type NodeCategory } from "../core/registry.ts";
import { buildRegistry } from "../core/catalogue.ts";
import {
  fitToViewport,
  resolveCollisions,
  rollFocus,
  snapPoint,
  type Vec2,
  vec2,
} from "../core/spatial.ts";
import { PROPAGATION_DESCRIPTORS } from "../core/venn.ts";
import {
  applyStageParamsToGraph,
  compileGraph,
  type CompileResult,
  EngineClient,
} from "../bridge/engine.ts";
import { evaluateFrame, evaluateStack, type StackRunProgress } from "../bridge/evaluator.ts";
import { resolveStackScope, stackFrames } from "../core/scope.ts";
import {
  type AssetLedger,
  type AssetVersion,
  childrenOf,
  deserialise as deserialiseLedger,
  emptyLedger,
  historyOf,
  latestOf,
  parentsOf,
  record as recordAsset,
  retire as retireAsset,
  serialise as serialiseLedger,
  star as starAsset,
  summarise as summariseLedger,
} from "../core/assets.ts";
import {
  applyViewport,
  cardHeight,
  cardShowsMedia,
  describeValue,
  formatNumber,
  type NodePreview,
  type PendingWire,
  type PortAnchor,
  renderCards,
  renderCarousel,
  renderCarouselFromImages,
  type RenderContext,
  renderStacks,
  renderWires,
  type StackBuild,
  type Viewport,
} from "./render.ts";
import { buildAdjacency } from "../core/graph.ts";
import { mountConsole } from "./console.ts";

// ===========================================================================
// Registry and DOM handles
// ===========================================================================

const REGISTRY = buildRegistry();
const engine = new EngineClient({ baseUrl: "/api" });
const nextNodeId = createIdSource("n");

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id} — index.html and app.ts disagree.`);
  return el as T;
};

const ctx: RenderContext = {
  registry: REGISTRY,
  cardsHost: $("cards"),
  stacksHost: $("stacks"),
  canvas: $<HTMLCanvasElement>("wires"),
  world: $("world"),
};

// ===========================================================================
// Application state
// ===========================================================================

let graph: GraphDocument = emptyGraph(asGraphId("g1"));
let viewport: Viewport = { pan: vec2(60, 40), zoom: 1 };
let selected = new Set<NodeId>();
let filterText = "";
let pending: PendingWire | null = null;
let candidates = new Set<string>();
let anchors = new Map<string, PortAnchor>();
let compiled: CompileResult | null = null;
let currentFrame = 0;
/** The bottom terminal. Mounted once the chrome is wired; null until then. */
let consoleUi: ReturnType<typeof mountConsole> | null = null;
/** Latest engine result per node. Cleared when the graph changes shape. */
const previews = new Map<NodeId, NodePreview>();
/** In-flight stack evaluation, so a second click cancels rather than stacks. */
let stackRun: AbortController | null = null;
/** Frames produced by the last stack run, for the depth strip. */
let stackSlices: Array<{ frame: number; image: string }> = [];
/** Frames in the bound project. Read once when the project is bound. */
let sequenceLength = 0;
type ProjectInfo = {
  id: string;
  label: string;
  folder: string;
  frames: number;
  fps: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  durationS: number | null;
};
let projectInfo: ProjectInfo | null = null;
const undoStack: GraphDocument[] = [];
let autoPreview = false;
let autoPreviewTimer = 0;

function graphStorageKey(projectId: string | null): string {
  return `ars:graph:${projectId || "_"}`;
}

let graphDiskTimer = 0;
let loadedGraphJson = "";
let pendingSwitchId: string | null = null;
type ProjectRow = {
  id: string;
  title: string;
  folder: string;
  frames: number;
  origin: string;
  mediaType: string;
};
let projectRows: ProjectRow[] = [];

function persistGraph(): void {
  try {
    localStorage.setItem(graphStorageKey(graph.projectId), JSON.stringify(graph));
  } catch {
    /* private mode */
  }
  const pid = graph.projectId;
  if (!pid) return;
  clearTimeout(graphDiskTimer);
  graphDiskTimer = setTimeout(() => {
    void putGraphToDisk(pid, graph);
  }, 700);
}

async function putGraphToDisk(pid: string, doc: GraphDocument): Promise<void> {
  try {
    await fetch(`/api/project/${encodeURIComponent(pid)}/graph`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    });
  } catch {
    /* engine down */
  }
}

async function flushGraph(): Promise<void> {
  persistGraph();
  const pid = graph.projectId;
  if (!pid) return;
  clearTimeout(graphDiskTimer);
  graphDiskTimer = 0;
  await putGraphToDisk(pid, graph);
}

function markGraphClean(): void {
  loadedGraphJson = JSON.stringify(graph);
}

function isGraphDirty(): boolean {
  try {
    return JSON.stringify(graph) !== loadedGraphJson;
  } catch {
    return true;
  }
}

function autosaveOnSwitch(): boolean {
  return localStorage.getItem("ars:autosave-switch") !== "0";
}

function setAutosaveOnSwitch(on: boolean): void {
  localStorage.setItem("ars:autosave-switch", on ? "1" : "0");
  for (const id of ["var-autosave-switch", "set-autosave-switch"]) {
    const box = document.getElementById(id) as HTMLInputElement | null;
    if (box) box.checked = on;
  }
}

function folderFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2] ?? "";
}

function displayTitle(p: {
  id?: string;
  project_id?: string;
  title?: string;
  source_name?: string;
  source_path?: string;
  name?: string;
  frame_count?: number;
  frames?: number;
  origin?: string;
  media_type?: string;
}): ProjectRow {
  const id = p.project_id ?? p.id ?? "";
  const stem = (p.source_name ?? p.name ?? "").replace(/\.[^.]+$/, "");
  let stored = "";
  try {
    stored = id ? (localStorage.getItem(`ars:project-title:${id}`) ?? "").trim() : "";
  } catch {
    stored = "";
  }
  const title = (p.title ?? "").trim() || stored || stem || id;
  return {
    id,
    title,
    folder: folderFromPath(p.source_path ?? ""),
    frames: Number(p.frame_count ?? p.frames ?? 0) || 0,
    origin: String(p.origin ?? ""),
    mediaType: String(p.media_type ?? ""),
  };
}

async function readStoredGraph(projectId: string | null): Promise<GraphDocument | null> {
  if (projectId) {
    try {
      const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/graph`);
      if (response.ok) {
        const doc = await response.json() as GraphDocument;
        if (doc?.nodes && doc.edges) return doc;
      }
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    const raw = localStorage.getItem(graphStorageKey(projectId));
    if (!raw) return null;
    const doc = JSON.parse(raw) as GraphDocument;
    if (!doc?.nodes || !doc.edges) return null;
    return doc;
  } catch {
    return null;
  }
}

function scheduleAutoPreview(): void {
  clearTimeout(autoPreviewTimer);
  autoPreviewTimer = setTimeout(() => void runPreview(false), 480);
}

function syncExportLink(projectId: string): void {
  panelsApi()?.refreshGrade();
  postToGrade({ type: "set-project", projectId, frames: sequenceLength });
}

function postToDesk(
  payload: Record<string, unknown>,
  targets: string[] = ["grade-frame", "desk-tools"],
): void {
  for (const id of targets) {
    const frame = document.getElementById(id);
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) continue;
    try {
      frame.contentWindow.postMessage({ source: "ars-workshop", ...payload }, location.origin);
    } catch {
      /* iframe not ready */
    }
  }
}

function postToGrade(payload: Record<string, unknown>): void {
  const gradeOnly = payload.type === "open-export" || payload.type === "open-file" ||
    payload.type === "play" || payload.type === "pause" || payload.type === "toggle-play" ||
    payload.type === "set-step";
  postToDesk(payload, gradeOnly ? ["grade-frame"] : ["grade-frame", "desk-tools"]);
}

function compiledStageParams(): Record<string, Record<string, unknown>> | null {
  if (!compiled) return null;
  const preview = [...compiled.steps].reverse().find((step) => step.kind === "preview");
  if (!preview || preview.kind !== "preview") return null;
  return preview.params;
}

function applyDeskParams(
  params: Record<string, Record<string, unknown>>,
  actor: "user" | "system" = "user",
): void {
  const next = applyStageParamsToGraph(graph, REGISTRY, params, {
    actor,
    skipUser: actor !== "user",
  });
  if (next !== graph) commit(next, actor === "user");
}

type ArsPanelsApi = {
  setMode: (m: string) => void;
  showPane?: (name: "graph" | "grade" | "inspector" | "palette", on?: boolean) => void;
  cycleFocus?: () => void;
  refreshGrade: () => void;
};

/** Query the user arrived with — Home utilities, Open, Export. */
let launchTool: string | null = null;
let launchConsumed = false;

function panelsApi(): ArsPanelsApi | undefined {
  return (globalThis as { ArsPanels?: ArsPanelsApi }).ArsPanels;
}

function requestExport(): void {
  persistCompiledParams();
  panelsApi()?.setMode("grade");
  const send = () => postToGrade({ type: "open-export" });
  send();
  setTimeout(send, 350);
}

function requestOpen(): void {
  panelsApi()?.setMode("grade");
  const send = () => postToGrade({ type: "open-file" });
  send();
  setTimeout(send, 350);
}

function togglePlay(): void {
  const next = !playing;
  playing = next;
  panelsApi()?.showPane?.("grade", true);
  postToGrade({ type: next ? "play" : "pause" });
  syncPlayButtons();
}

function syncPlayButtons(): void {
  for (const btn of ctx.cardsHost.querySelectorAll<HTMLButtonElement>(".card-play")) {
    btn.textContent = playing ? "⏸" : "▶";
    btn.title = playing ? "Pause in Grade" : "Play this reel in Grade";
  }
}

function paintSourceThumbs(frame: number): void {
  if (!graph.projectId) return;
  const url = `/api/project/${encodeURIComponent(graph.projectId)}/frame/${frame}?max_edge=420`;
  for (const node of Object.values(graph.nodes)) {
    if (node.type !== "source.sequence") continue;
    const card = ctx.cardsHost.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
    const shot = card?.querySelector<HTMLElement>(".card-preview");
    if (shot) shot.style.backgroundImage = `url("${url}")`;
    const stamp = card?.querySelector(".preview-stamp");
    if (stamp && !card?.querySelector(".card-index")) stamp.textContent = `frame ${frame}`;
    const scrub = card?.querySelector<HTMLInputElement>(".card-scrub:not(.card-index)");
    if (scrub && !scrub.matches(":active")) scrub.value = String(frame);
  }
}

function seekFrame(frame: number, live: boolean): void {
  const last = Math.max(0, sequenceLength - 1);
  currentFrame = Math.max(0, Math.min(last, Math.floor(frame)));
  const input = document.getElementById("frame-input") as HTMLInputElement | null;
  if (input) input.value = String(currentFrame);
  postToGrade({ type: "set-frame", frame: currentFrame });
  paintSourceThumbs(currentFrame);
  if (!live) {
    recompile();
    void loadCarousel();
    invalidate();
  }
}

/** Focus index of the depth carousel, and the build it is showing. */
let carouselBuild: StackBuild | null = null;
let carouselFocus = 0;

// ===========================================================================
// Rendering
// ===========================================================================

let frameRequested = false;

/** Coalesce redraws to one per animation frame. */
/**
 * Ask for a repaint, coalescing everything asked for before the next frame.
 *
 * `requestAnimationFrame` is the right scheduler while the tab is visible and
 * the wrong one when it is not: a hidden tab never gets a frame, so every
 * repaint queued behind one is deferred indefinitely. That matters here
 * because a Run keeps working while the tab is in the background — the
 * lifecycle colours, the queue badges and the inspector would all sit frozen
 * on the state the graph had when it was last on screen, and would then jump
 * when it came back.
 *
 * So: rAF when visible, a timer when hidden. The timer's interval is coarse
 * on purpose — nobody is watching, and the only requirement is that the DOM
 * tells the truth by the time somebody looks.
 */
function invalidate(): void {
  if (frameRequested) return;
  frameRequested = true;
  const paint = () => {
    frameRequested = false;
    draw();
  };
  if (document.hidden) setTimeout(paint, 100);
  else requestAnimationFrame(paint);
}

let playing = false;

function draw(): void {
  const state = {
    selected,
    filterText,
    pending,
    candidates,
    viewport,
    previews,
    projectId: graph.projectId,
    currentFrame,
    playing,
    sequenceLength,
    projectLabel: projectInfo?.id ?? graph.projectId,
    unfolded,
    versionCount: versionCounts(),
  };
  applyViewport(ctx.world, viewport);
  renderStacks(ctx, graph);
  anchors = renderCards(ctx, graph, state);
  renderWires(ctx, graph, anchors, state);
  $("empty-hint").hidden = Object.keys(graph.nodes).length > 0;
  renderInspector();
  paintPaletteSelection();
  if (consoleUi) {
    void consoleUi.bindProject(graph.projectId);
    consoleUi.refresh();
  }
  syncGradeToCanvas();
  syncRunCost();
  fitProjectFolder();
}

function commit(next: GraphDocument, recordUndo = true): void {
  next = attachStacks(next);
  if (next === graph) return;
  if (recordUndo) {
    undoStack.push(graph);
    if (undoStack.length > 100) undoStack.shift();
  }
  const before = graph;
  graph = next;
  if (Object.keys(before.nodes).length !== Object.keys(next.nodes).length) {
    for (const id of previews.keys()) {
      if (!next.nodes[id]) previews.delete(id);
    }
  }
  persistGraph();
  recompile();
  invalidate();
  if (autoPreview) scheduleAutoPreview();
}

/**
 * Keep `graph.stacks` and `node.stack` in sync with every `flow.stack` card.
 * Without this the dashed depth frame never draws.
 */
function attachStacks(doc: GraphDocument): GraphDocument {
  const wrap = depthWrap();
  const nextStacks: Record<string, StackInstance> = {};
  const membership = new Map<NodeId, StackId>();

  for (const node of Object.values(doc.nodes)) {
    if (node.type !== "flow.stack") continue;
    const sid = asStackId(`s_${node.id}`);
    const scope = resolveStackScope(doc, node.id);
    const stride = Math.max(
      1,
      Math.floor((node.values.stride as { value?: number } | undefined)?.value ?? 1),
    );
    const sliceCount = sequenceLength > 0
      ? Math.max(1, Math.min(240, Math.ceil(sequenceLength / stride)))
      : 1;
    nextStacks[sid] = {
      id: sid,
      label: node.name || "Z Stack",
      source: "frames",
      range: { start: 0, end: Math.max(0, sequenceLength - 1), step: stride },
      sliceCount,
      focusIndex: 0,
      wrap,
      origin: node.position,
    };
    membership.set(node.id, sid);
    for (const mid of scope.body) membership.set(mid, sid);
  }

  let nodesChanged = false;
  const nodes: Record<string, NodeInstance> = { ...doc.nodes };
  for (const node of Object.values(doc.nodes)) {
    const want = membership.get(node.id);
    const have = node.stack?.id;
    if (want && have !== want) {
      nodes[node.id] = { ...node, stack: { id: want, slice: 0 } };
      nodesChanged = true;
    } else if (!want && node.stack) {
      const rest = { ...node };
      delete (rest as { stack?: unknown }).stack;
      nodes[node.id] = rest;
      nodesChanged = true;
    }
  }

  const stackKeys = Object.keys(nextStacks);
  const prevKeys = Object.keys(doc.stacks);
  let stacksChanged = stackKeys.length !== prevKeys.length;
  if (!stacksChanged) {
    for (const key of stackKeys) {
      const a = nextStacks[key]!;
      const b = doc.stacks[key];
      if (
        !b || a.sliceCount !== b.sliceCount || a.label !== b.label ||
        a.wrap !== b.wrap || a.origin.x !== b.origin.x || a.origin.y !== b.origin.y
      ) {
        stacksChanged = true;
        break;
      }
    }
  }

  if (!nodesChanged && !stacksChanged) return doc;
  return { ...doc, nodes, stacks: nextStacks };
}

// ===========================================================================
// Compilation and diagnostics
// ===========================================================================

function recompile(): void {
  compiled = compileGraph(graph, REGISTRY, currentFrame);
  renderDiagnostics();
}

function renderDiagnostics(): void {
  const summary = $("compile-summary");
  const list = $("diagnostics");
  if (!compiled) {
    summary.textContent = "";
    list.replaceChildren();
    return;
  }

  const errors = compiled.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = compiled.diagnostics.length - errors;
  summary.textContent = compiled.runnable
    ? `${compiled.steps.length} engine call${compiled.steps.length === 1 ? "" : "s"}` +
      (compiled.networkSteps > 0 ? `, ${compiled.networkSteps} over the network` : "") +
      (warnings > 0 ? ` · ${warnings} warning${warnings === 1 ? "" : "s"}` : "")
    : `${errors} error${errors === 1 ? "" : "s"} — nothing will run`;

  // The project's asset totals, alongside the compile. Both answer "what is
  // the state of this graph"; separating them across two panels would make you
  // look in two places for one answer.
  // Rebuilt rather than updated in place: this runs on every recompile, and
  // an append without a matching remove is how a status line becomes twelve.
  document.querySelector(".ledger-line")?.remove();
  const stats = summariseLedger(ledger);
  if (stats.total > 0) {
    const line = document.createElement("div");
    line.className = "ledger-line t-secondary";
    const parts = [
      `${stats.total} version${stats.total === 1 ? "" : "s"} across ${stats.nodes} node${
        stats.nodes === 1 ? "" : "s"
      }`,
      `${ms(stats.engineMs)} engine time`,
    ];
    if (stats.starred > 0) parts.push(`${stats.starred} starred`);
    if (stats.failed > 0) parts.push(`${stats.failed} failed`);
    if (stats.retired > 0) parts.push(`${stats.retired} retired`);
    line.textContent = parts.join(" · ");
    line.title = "Recorded assets for this project. Open a card's ⋯ menu for its versions.";
    summary.after(line);
  }

  const frag = document.createDocumentFragment();
  for (const d of compiled.diagnostics) {
    const el = document.createElement("div");
    el.className = `diag ${d.severity} t-primary`;
    if (d.node) {
      const who = document.createElement("span");
      who.className = "diag-node t-secondary";
      who.textContent = graph.nodes[d.node]?.name ?? d.node;
      el.append(who);
      el.onclick = () => {
        selected = new Set([d.node!]);
        focusNode(d.node!);
      };
    }
    el.append(document.createTextNode(d.message));
    frag.append(el);
  }
  list.replaceChildren(frag);
}

// ===========================================================================
// Inspector
// ===========================================================================

/**
 * The inspector shows wiring and Restorer specialty tools. Look knobs for
 * `stage.*` live in Grade when that pane is open, so the two surfaces do not
 * edit the same sliders.
 */
const STRUCTURAL_INSPECTOR_PORTS = new Set([
  "image",
  "sequence",
  "neighbours",
  "mask",
  "a",
  "b",
  "base",
  "over",
]);

function inspectorActions(ids: NodeId[]): HTMLElement {
  const row = document.createElement("div");
  row.className = "insp-actions";
  const btn = (label: string, title: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "action t-primary";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", fn);
    return b;
  };
  const first = graph.nodes[ids[0]!];
  row.append(
    btn(
      first?.state === "muted" ? "Unmute" : "Mute",
      "Bypass selected nodes (M)",
      () => toggleMute(ids),
    ),
    btn(
      first?.collapsed ? "Expand" : "Collapse",
      "Fold the card to its title (C)",
      () => toggleCollapse(ids),
    ),
    btn("Delete", "Remove selected nodes (⌫)", () => deleteSelected()),
    btn(
      "Loop",
      "Wrap the selection in a Z Stack — it then runs once per frame (L)",
      () => wrapSelectionInLoop(),
    ),
    btn("Run", "Run the selection and everything upstream it needs (R)", () => void runWorkflow()),
    btn(
      "Run stages",
      "Run one stage at a time so each keeps its own version, linked to the one before it. Costs one engine call per stage.",
      () => void runStages(),
    ),
  );
  if (ids.length === 1) {
    row.append(btn("Focus", "Center this card in the canvas", () => focusNode(ids[0]!)));
    const node = graph.nodes[ids[0]!];
    if (node && Object.values(node.authoredBy).includes("ai")) {
      row.append(
        btn("Accept AI", "Mark machine-authored values as reviewed", () => acceptAiValues(ids[0]!)),
      );
    }
  }
  return row;
}

function renderInspector(): void {
  const body = $("inspect-body");
  if (selected.size === 0) {
    body.replaceChildren();
    body.hidden = true;
    return;
  }
  body.hidden = false;
  if (selected.size !== 1) {
    const frag = document.createDocumentFragment();
    const note = document.createElement("p");
    note.className = "muted t-primary";
    note.textContent = `${selected.size} nodes selected.`;
    frag.append(note, inspectorActions([...selected]));
    body.replaceChildren(frag);
    $("inspector").scrollTop = 0;
    return;
  }

  const id = [...selected][0]!;
  const node = graph.nodes[id];
  const spec = node ? REGISTRY.get(node.type) : null;
  if (!node || !spec) {
    body.replaceChildren();
    body.hidden = true;
    return;
  }

  const adjacency = buildAdjacency(graph);
  const wired = new Set((adjacency.incoming.get(id) ?? []).map((e) => e.to.port as string));

  const frag = document.createDocumentFragment();

  const titleRow = document.createElement("div");
  titleRow.className = "insp-title-row";
  const title = document.createElement("input");
  title.className = "insp-title t-primary";
  title.type = "text";
  title.value = node.name || spec.label;
  title.title = "Rename this card";
  title.addEventListener("change", () => {
    const name = title.value.trim() || spec.label;
    commit(updateNode(graph, id, { name }), false);
  });
  titleRow.append(title);
  frag.append(titleRow, inspectorActions([id]));

  const hint = document.createElement("p");
  hint.className = "insp-hint t-primary";
  hint.textContent = spec.hint;
  frag.append(hint);

  // The Region node explains what the chosen mode does to footage, in the
  // operator's language, and warns when the wiring makes it a no-op.
  if (node.type === "flow.propagate") {
    const mode = (node.values.mode as { value?: string } | undefined)?.value ?? "union";
    const descriptor = PROPAGATION_DESCRIPTORS[mode as keyof typeof PROPAGATION_DESCRIPTORS];
    if (descriptor) {
      const note = document.createElement("p");
      note.className = "insp-hint t-primary";
      note.innerHTML = `<b>${descriptor.notation}</b> — ${descriptor.effect}`;
      frag.append(note);
    }
  }

  const gradeOpen = document.body.classList.contains("mode-grade");
  const looksLiveInGrade = gradeOpen && Boolean(spec.engineStage);
  for (const port of spec.inputs) {
    if (looksLiveInGrade && !STRUCTURAL_INSPECTOR_PORTS.has(port.id)) continue;
    frag.append(inspectorRow(node, port, wired.has(port.id)));
  }
  if (looksLiveInGrade) {
    frag.append(
      inspectorLaunch(
        "Look knobs for this stage live in Grade — picture, play, and sliders below the canvas.",
        "Show Grade",
        () => panelsApi()?.showPane?.("grade", true),
      ),
    );
  }

  const state = document.createElement("div");
  state.className = "insp-row t-primary";
  state.innerHTML = `<span>State</span><span class="t-secondary">${node.state}</span>`;
  frag.append(state);

  // A stack is the one node with an action of its own: running the depth axis.
  if (node.type === "flow.stack") {
    const scope = resolveStackScope(graph, node.id);
    const row = document.createElement("div");
    row.className = "insp-row t-primary";

    const summary = document.createElement("span");
    summary.textContent = scope.problem
      ? "Not runnable"
      : `${scope.body.length} node${scope.body.length === 1 ? "" : "s"} per slice`;
    row.append(summary);

    const run = document.createElement("button");
    run.className = "action t-primary";
    run.textContent = stackRun ? "Cancel" : "Evaluate depth";
    run.disabled = Boolean(scope.problem);
    run.title = scope.problem ??
      "Run the stack body once per frame of the range and fill the depth strip.";
    run.onclick = () => void runStack(node.id);
    row.append(run);
    frag.append(row);

    if (scope.problem) {
      const why = document.createElement("p");
      why.className = "insp-hint t-primary";
      why.textContent = scope.problem;
      frag.append(why);
    }
  }

  if (node.type === "out.render") {
    frag.append(
      inspectorLaunch(
        "Encodes via the Grade export dialog — the graph node does not write disk itself.",
        "Export film",
        () => requestExport(),
      ),
    );
  }
  if (node.type === "mask.segment") {
    frag.append(
      inspectorLaunch(
        "Preview skips paid vision calls. Subject isolation runs in Restorer.",
        "Open isolation",
        () => {
          panelsApi()?.showPane?.("inspector", true);
          postToDesk({ type: "focus-card", card: "isolation" }, ["desk-tools"]);
        },
      ),
    );
  }
  if (node.type === "ai.enhance") {
    frag.append(
      inspectorLaunch(
        "Preview skips paid generative calls. Repair runs in Restorer.",
        "Open generative",
        () => {
          panelsApi()?.showPane?.("inspector", true);
          postToDesk({ type: "focus-card", card: "generative" }, ["desk-tools"]);
        },
      ),
    );
  }

  body.replaceChildren(frag);
  $("inspector").scrollTop = 0;
}

function inspectorLaunch(note: string, label: string, onClick: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "insp-row t-primary";
  const text = document.createElement("span");
  text.textContent = note;
  const go = document.createElement("button");
  go.type = "button";
  go.className = "action t-primary";
  go.textContent = label;
  go.addEventListener("click", onClick);
  row.append(text, go);
  return row;
}

function inspectorRow(node: NodeInstance, port: PortSpec, wired: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "insp-row t-primary";

  const label = document.createElement("span");
  label.textContent = port.label;
  label.title = port.help;
  row.append(label);

  if (wired) {
    const note = document.createElement("span");
    note.className = "t-secondary insp-unit";
    note.textContent = "from a wire";
    const cut = document.createElement("button");
    cut.type = "button";
    cut.className = "action t-primary";
    cut.textContent = "Disconnect";
    cut.title = "Remove the incoming wire";
    cut.addEventListener("click", () => disconnectInput(node.id, port.id));
    row.append(note, cut);
    return row;
  }

  const current = node.values[port.id] ?? port.defaultValue;
  const right = document.createElement("span");

  if (port.kind === "Number" && port.range) {
    const input = document.createElement("input");
    const isCoarse = port.range.step > 0 &&
      (port.range.max - port.range.min) / port.range.step < 400;
    input.type = isCoarse ? "range" : "number";
    input.min = String(port.range.min);
    input.max = String(port.range.max);
    input.step = String(port.range.step || "any");
    input.value = String((current as { value?: number } | undefined)?.value ?? port.range.min);
    input.className = "t-secondary";

    // The readout is in display units; the value stored and sent stays raw.
    const show = (raw: number) =>
      formatNumber(displayValue(raw, port.range!)) + (port.range!.unit ?? "");

    const readout = document.createElement("span");
    readout.className = "t-secondary";
    readout.style.marginLeft = "6px";
    readout.textContent = show(Number(input.value));

    input.oninput = () => {
      const clamped = clampToRange(Number(input.value), port.range!);
      readout.textContent = show(clamped);
      setValue(node.id, port.id, { kind: "Number", value: clamped });
    };
    right.append(input);
    if (isCoarse) right.append(readout);
  } else if (port.kind === "Enum" && port.options) {
    const select = document.createElement("select");
    select.className = "t-secondary";
    for (const option of port.options) {
      const o = document.createElement("option");
      o.value = option;
      o.textContent = option;
      select.append(o);
    }
    select.value = String((current as { value?: string } | undefined)?.value ?? port.options[0]);
    select.onchange = () => setValue(node.id, port.id, { kind: "Enum", value: select.value });
    right.append(select);
  } else if (port.kind === "Number") {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "t-secondary";
    input.step = "any";
    input.value = String((current as { value?: number } | undefined)?.value ?? 0);
    input.onchange = () =>
      setValue(node.id, port.id, { kind: "Number", value: Number(input.value) });
    right.append(input);
  } else if (port.kind === "Flag") {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = Boolean((current as { value?: boolean } | undefined)?.value);
    box.onchange = () => setValue(node.id, port.id, { kind: "Flag", value: box.checked });
    right.append(box);
  } else if (port.kind === "Text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "t-secondary";
    input.value = String((current as { value?: string } | undefined)?.value ?? "");
    input.onchange = () => setValue(node.id, port.id, { kind: "Text", value: input.value });
    right.append(input);
  } else {
    const note = document.createElement("span");
    note.className = "t-secondary insp-unit";
    note.textContent = current ? describeValue(current) : "unconnected";
    right.append(note);
  }

  row.append(right);
  return row;
}

/** Set one port value. Authorship is the user's, by definition — they typed it. */
function setValue(node: NodeId, port: string, value: SignalValue): void {
  const existing = graph.nodes[node];
  if (!existing) return;
  commit(
    updateNode(graph, node, {
      values: { ...existing.values, [port]: value },
      authoredBy: { ...existing.authoredBy, [port]: "user" },
    }),
    false, // slider drags would otherwise flood the undo stack
  );
}

// ===========================================================================
// Node creation
// ===========================================================================

/** Never reuse an id already in the document — a loaded graph's n1…nN must stay. */
function unusedNodeId(): NodeId {
  let id = asNodeId(nextNodeId());
  while (graph.nodes[id]) id = asNodeId(nextNodeId());
  return id;
}

function createNode(typeId: string, at: Vec2): NodeId {
  const spec = REGISTRY.get(typeId as never);
  if (!spec) throw new Error(`Unknown node type ${typeId}`);

  const id = unusedNodeId();
  const inputs = spec.inputs.slice(0, 7).length;
  const media = cardShowsMedia(spec) ? spec.size.w : 0;
  const node: NodeInstance = {
    id,
    type: spec.id,
    name: spec.label,
    position: snapPoint(at),
    size: { w: spec.size.w, h: cardHeight(inputs, spec.outputs.length, false, media) },
    values: {},
    authoredBy: {},
    state: "idle",
    revision: 0,
    collapsed: false,
  };

  // Mutual awareness: place the card clear of everything already there.
  const others = Object.values(graph.nodes).map(nodeRect);
  const placed = resolveCollisions(nodeRect(node), others, { gap: 16 });
  commit(addNode(graph, { ...node, position: vec2(placed.x, placed.y) }));
  return id;
}

// ===========================================================================
// Wiring
// ===========================================================================

/** Which sockets would accept the wire currently in flight. */
function computeCandidates(from: PortAnchor): Set<string> {
  const out = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    const spec = REGISTRY.get(node.type);
    if (!spec) continue;
    for (const port of spec.inputs) {
      const refusal = canConnectPorts(from, node.id, port.id);
      if (!refusal) out.add(`${node.id}:${port.id}:input`);
    }
  }
  return out;
}

function canConnectPorts(from: PortAnchor, toNode: NodeId, toPort: string) {
  const result = connect(
    graph,
    { node: from.node, port: asPortId(from.port) },
    { node: toNode, port: asPortId(toPort) },
    (n, p, d) => {
      const node = graph.nodes[n];
      return node ? REGISTRY.port(node.type, p, d) : null;
    },
  );
  return "refusal" in result ? result.refusal : null;
}

function tryConnect(from: PortAnchor, toNode: NodeId, toPort: string): void {
  const result = connect(
    graph,
    { node: from.node, port: asPortId(from.port) },
    { node: toNode, port: asPortId(toPort) },
    (n, p, d) => {
      const node = graph.nodes[n];
      return node ? REGISTRY.port(node.type, p, d) : null;
    },
  );
  if ("refusal" in result) {
    toast(result.refusal.message, true);
    return;
  }
  commit(result.graph);
}

/** Remove the wire feeding a given input, if any. */
function disconnectInput(node: NodeId, port: string): void {
  const edge = Object.values(graph.edges).find((e) => e.to.node === node && e.to.port === port);
  if (edge) commit(disconnect(graph, edge.id));
}

// ===========================================================================
// Pointer interaction
// ===========================================================================

const stage = $("stage");

/** Screen position → blueprint units. */
function toWorld(clientX: number, clientY: number): Vec2 {
  const box = stage.getBoundingClientRect();
  return vec2(
    (clientX - box.left - viewport.pan.x) / viewport.zoom,
    (clientY - box.top - viewport.pan.y) / viewport.zoom,
  );
}

/**
 * Pointer capture, without letting a refusal abort the gesture.
 *
 * `setPointerCapture` throws when the id has no live pointer — which real mice
 * never produce, but synthetic events (the runtime check, the browser-driven
 * tests) do. The capture is an optimisation, not a precondition: the window
 * listeners still deliver the move and up. Losing it must not lose the drag.
 */
function capture(event: PointerEvent): void {
  try {
    stage.setPointerCapture(event.pointerId);
  } catch {
    // No live pointer for this id; the gesture proceeds uncaptured.
  }
}

type DragMode =
  | { kind: "none" }
  | { kind: "pan"; startPan: Vec2; startClient: Vec2 }
  | { kind: "card"; node: NodeId; grab: Vec2; others: Map<NodeId, Vec2> }
  | { kind: "marquee"; startClient: Vec2; additive: boolean; base: Set<NodeId> }
  | { kind: "wire"; from: PortAnchor };

let drag: DragMode = { kind: "none" };

// ---------------------------------------------------------------------------
// Marquee — left-drag rectangle select on empty canvas
// ---------------------------------------------------------------------------
//
// Two-finger trackpad pans, pinch zooms, so left-drag on empty canvas is free
// for the rectangle. Right-click (no drag) is still the node wheel.
//
// A press that never moves is a click: it clears the selection. `marqueeMoved`
// is what tells a click from a drag at pointerup.

/** Below this many screen pixels a drag is a click. */
const MARQUEE_DEAD_ZONE = 4;

let marqueeMoved = false;

function marqueeRect(startClient: Vec2, clientX: number, clientY: number) {
  const box = stage.getBoundingClientRect();
  const x0 = Math.min(startClient.x, clientX) - box.left;
  const y0 = Math.min(startClient.y, clientY) - box.top;
  const x1 = Math.max(startClient.x, clientX) - box.left;
  const y1 = Math.max(startClient.y, clientY) - box.top;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Every node whose card overlaps the rectangle.
 *
 * Intersection, not containment. A marquee that only caught fully-enclosed
 * cards would refuse to select a chain wider than the viewport — which is
 * exactly the graph you most want to select as a unit.
 */
function nodesWithin(startClient: Vec2, clientX: number, clientY: number): Set<NodeId> {
  const a = toWorld(
    Math.min(startClient.x, clientX),
    Math.min(startClient.y, clientY),
  );
  const b = toWorld(
    Math.max(startClient.x, clientX),
    Math.max(startClient.y, clientY),
  );
  const hit = new Set<NodeId>();
  for (const node of Object.values(graph.nodes)) {
    const r = nodeRect(node);
    // A collapsed card draws only its header; hit-test what is on screen.
    const h = node.collapsed ? 31 : r.h;
    if (r.x + r.w > a.x && r.x < b.x && r.y + h > a.y && r.y < b.y) hit.add(node.id);
  }
  return hit;
}

/** Paint the rectangle and pre-light the cards under it. */
function paintMarquee(startClient: Vec2, clientX: number, clientY: number): void {
  const el = $("marquee");
  const box = marqueeRect(startClient, clientX, clientY);
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.hidden = false;

  const hit = nodesWithin(startClient, clientX, clientY);
  for (const card of document.querySelectorAll<HTMLElement>(".card")) {
    card.classList.toggle("marquee-hit", hit.has(asNodeId(card.dataset.node!)));
  }
}

function clearMarquee(): void {
  $("marquee").hidden = true;
  for (const card of document.querySelectorAll<HTMLElement>(".card")) {
    card.classList.remove("marquee-hit");
  }
}

stage.addEventListener("pointerdown", (event) => {
  // Right button on empty canvas is reserved for the node wheel (contextmenu).
  if (event.button === 2) {
    const over = event.target as HTMLElement;
    if (over.closest(".card") || over.closest(".port-dot")) return;
    closeNodeWheel();
    marqueeMoved = false;
    return;
  }

  // Middle button pans — the mouse equivalent of a two-finger trackpad swipe.
  if (event.button === 1) {
    event.preventDefault();
    closeNodeWheel();
    drag = { kind: "pan", startPan: viewport.pan, startClient: vec2(event.clientX, event.clientY) };
    capture(event);
    return;
  }

  if (event.button !== 0) return;
  closeNodeWheel();
  const target = event.target as HTMLElement;

  // A port socket starts a wire.
  const dot = target.closest<HTMLElement>(".port-dot");
  if (dot) {
    const node = asNodeId(dot.dataset.node!);
    const port = dot.dataset.port!;
    const direction = dot.dataset.dir as "input" | "output";

    // Grabbing a connected input picks the existing wire up rather than
    // refusing it — the socket is occupied, and re-routing is the common act.
    if (direction === "input") {
      const edge = Object.values(graph.edges).find((e) => e.to.node === node && e.to.port === port);
      if (edge) {
        const source = anchors.get(`${edge.from.node}:${edge.from.port}:output`);
        disconnectInput(node, port);
        if (source) startWire(source, event);
        return;
      }
      // Dragging *from* an empty input is not supported; wires run out → in.
      return;
    }
    const anchor = anchors.get(`${node}:${port}:output`);
    if (anchor) startWire(anchor, event);
    return;
  }

  // The options button and the fold controls are buttons on the card. They
  // must be handled before the header drag, or pressing one would start a
  // drag and the click would never land.
  const opts = target.closest<HTMLElement>(".card-opts");
  if (opts) {
    const card = opts.closest<HTMLElement>(".card")!;
    const node = asNodeId(card.dataset.node!);
    event.preventDefault();
    if (menuNode === node) closeCardMenu();
    else {
      selected = new Set([node]);
      openCardMenuFor(node);
      invalidate();
    }
    return;
  }

  const fold = target.closest<HTMLElement>(".card-more");
  if (fold) {
    event.preventDefault();
    if (fold.dataset.unfold) unfolded.add(asNodeId(fold.dataset.unfold));
    else if (fold.dataset.fold) unfolded.delete(asNodeId(fold.dataset.fold));
    invalidate();
    return;
  }

  if (target.closest(".card-scrub") || target.closest(".card-play")) {
    const card = target.closest<HTMLElement>(".card");
    if (card) selected = new Set([asNodeId(card.dataset.node!)]);
    invalidate();
    return;
  }

  // A card header drags the card.
  const head = target.closest<HTMLElement>(".card-head");
  if (head) {
    const card = head.closest<HTMLElement>(".card")!;
    const node = asNodeId(card.dataset.node!);
    if (!event.shiftKey && !selected.has(node)) selected = new Set([node]);
    else if (event.shiftKey) selected.add(node);
    const instance = graph.nodes[node]!;
    const world = toWorld(event.clientX, event.clientY);

    // Dragging one card of a multi-selection drags the whole selection, and
    // the others keep their offsets from the card in hand. Recording the
    // offsets once at pointer-down rather than deriving them per move is what
    // keeps the group rigid: collision resolution nudges the lead card, and a
    // per-move derivation would let that nudge accumulate across the group.
    const others = new Map<NodeId, Vec2>();
    if (selected.size > 1 && selected.has(node)) {
      for (const id of selected) {
        if (id === node) continue;
        const other = graph.nodes[id];
        if (!other) continue;
        others.set(
          id,
          vec2(other.position.x - instance.position.x, other.position.y - instance.position.y),
        );
      }
    }

    drag = {
      kind: "card",
      node,
      grab: vec2(world.x - instance.position.x, world.y - instance.position.y),
      others,
    };
    capture(event);
    invalidate();
    return;
  }

  // A card body selects without dragging, so a slider inside stays usable.
  const card = target.closest<HTMLElement>(".card");
  if (card) {
    selected = new Set([asNodeId(card.dataset.node!)]);
    invalidate();
    return;
  }

  // Empty canvas: left-drag draws a selection rectangle. A click (no drag)
  // clears the selection. Two-finger swipe pans; this button is the marquee.
  selected = event.shiftKey ? selected : new Set();
  marqueeMoved = false;
  drag = {
    kind: "marquee",
    startClient: vec2(event.clientX, event.clientY),
    additive: event.shiftKey,
    base: new Set(selected),
  };
  capture(event);
  invalidate();
});

/**
 * The socket under the cursor, by hit-testing the document rather than by
 * reading `event.target`.
 *
 * This is not a stylistic preference. `startWire` captures the pointer to
 * `#stage` so the drag survives leaving the element, and pointer capture
 * *retargets every subsequent event to the capture element*. So during a wire
 * drag `event.target` is always `#stage`, `.closest(".port-dot")` is always
 * null, and the drop silently connects nothing — which is what was happening.
 *
 * `elementFromPoint` asks the question the drag is actually asking: what is
 * under the cursor right now. Wires are on a canvas below the cards and the
 * marquee is `pointer-events: none`, so nothing intercepts the hit.
 */
function socketAt(clientX: number, clientY: number): HTMLElement | null {
  const el = document.elementFromPoint(clientX, clientY);
  return el instanceof HTMLElement ? el.closest<HTMLElement>(".port-dot") : null;
}

function startWire(from: PortAnchor, event: PointerEvent): void {
  drag = { kind: "wire", from };
  candidates = computeCandidates(from);
  pending = { from, to: toWorld(event.clientX, event.clientY), valid: false };
  capture(event);
  invalidate();
}

stage.addEventListener("pointermove", (event) => {
  if (drag.kind === "pan") {
    viewport = {
      ...viewport,
      pan: vec2(
        drag.startPan.x + (event.clientX - drag.startClient.x),
        drag.startPan.y + (event.clientY - drag.startClient.y),
      ),
    };
    invalidate();
    return;
  }

  if (drag.kind === "marquee") {
    const moved = Math.hypot(
      event.clientX - drag.startClient.x,
      event.clientY - drag.startClient.y,
    );
    if (moved > MARQUEE_DEAD_ZONE) marqueeMoved = true;
    if (marqueeMoved) paintMarquee(drag.startClient, event.clientX, event.clientY);
    return;
  }

  if (drag.kind === "card") {
    const dragged = drag.node;
    const world = toWorld(event.clientX, event.clientY);
    const node = graph.nodes[dragged];
    if (!node) return;
    const wanted = vec2(world.x - drag.grab.x, world.y - drag.grab.y);

    // Mutual awareness: push clear of every card except the one in hand.
    // Excluding the dragged card matters — leaving it in makes it collide with
    // itself, and `resolveCollisions` would push it away from its own position
    // on every pointer move. The rest of a multi-selection is excluded for the
    // same reason: they are moving with it, so they are not obstacles.
    const moving = new Set<NodeId>([dragged, ...drag.others.keys()]);
    const obstacles = Object.values(graph.nodes)
      .filter((other) => !moving.has(other.id))
      .map(nodeRect);
    const placed = resolveCollisions(
      { x: wanted.x, y: wanted.y, w: node.size.w, h: nodeRect(node).h },
      obstacles,
      { gap: 14 },
    );

    let next = updateNode(graph, dragged, { position: vec2(placed.x, placed.y) });
    for (const [id, offset] of drag.others) {
      next = updateNode(next, id, {
        position: vec2(placed.x + offset.x, placed.y + offset.y),
      });
    }
    commit(next, false);
    return;
  }

  if (drag.kind === "wire") {
    const world = toWorld(event.clientX, event.clientY);
    const over = socketAt(event.clientX, event.clientY);
    const valid = Boolean(
      over && over.dataset.dir === "input" &&
        candidates.has(`${over.dataset.node}:${over.dataset.port}:input`),
    );
    pending = { from: drag.from, to: world, valid };

    const hint = $("wire-hint");
    if (over && over.dataset.dir === "input" && !valid) {
      const refusal = canConnectPorts(
        drag.from,
        asNodeId(over.dataset.node!),
        over.dataset.port!,
      );
      hint.textContent = refusal?.message ?? "";
      hint.classList.add("bad");
      hint.hidden = !refusal;
    } else {
      hint.hidden = true;
      hint.classList.remove("bad");
    }
    invalidate();
  }
});

stage.addEventListener("pointerup", (event) => {
  if (drag.kind === "marquee") {
    if (marqueeMoved) {
      const hit = nodesWithin(drag.startClient, event.clientX, event.clientY);
      selected = drag.additive ? new Set([...drag.base, ...hit]) : hit;
      if (selected.size > 0) {
        toast(`${selected.size} node${selected.size === 1 ? "" : "s"} selected`);
      }
    }
    clearMarquee();
    drag = { kind: "none" };
    marqueeMoved = false;
    renderInspector();
    invalidate();
    return;
  }

  if (drag.kind === "wire") {
    const over = socketAt(event.clientX, event.clientY);
    if (
      over && over.dataset.dir === "input" &&
      candidates.has(`${over.dataset.node}:${over.dataset.port}:input`)
    ) {
      tryConnect(drag.from, asNodeId(over.dataset.node!), over.dataset.port!);
    } else if (over && over.dataset.dir === "input") {
      const refusal = canConnectPorts(
        drag.from,
        asNodeId(over.dataset.node!),
        over.dataset.port!,
      );
      if (refusal) toast(refusal.message, true);
    }
    pending = null;
    candidates = new Set();
    $("wire-hint").hidden = true;
  }
  if (drag.kind === "card") {
    // Record one undo entry for the whole drag rather than one per pixel.
    undoStack.push(graph);
  }
  drag = { kind: "none" };
  invalidate();
});

/**
 * Two-finger swipe pans. Pinch (ctrlKey on Chrome/Safari/Firefox macOS) zooms
 * about the cursor, which is the same map-like feel as before.
 */
stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const pinch = event.ctrlKey || event.metaKey;
  if (!pinch) {
    viewport = {
      ...viewport,
      pan: vec2(viewport.pan.x - event.deltaX, viewport.pan.y - event.deltaY),
    };
    invalidate();
    return;
  }

  const box = stage.getBoundingClientRect();
  const cursor = vec2(event.clientX - box.left, event.clientY - box.top);
  const before = toWorld(event.clientX, event.clientY);

  const factor = Math.exp(-event.deltaY * 0.0016);
  const zoom = Math.min(2.5, Math.max(0.15, viewport.zoom * factor));
  viewport = {
    zoom,
    pan: vec2(cursor.x - before.x * zoom, cursor.y - before.y * zoom),
  };
  invalidate();
}, { passive: false });

// ===========================================================================
// Keyboard
// ===========================================================================

function deleteSelected(): void {
  if (selected.size === 0) return;
  let next = graph;
  for (const id of selected) next = removeNode(next, id);
  selected = new Set();
  commit(next);
}

function toggleMute(ids: Iterable<NodeId> = selected): void {
  let next = graph;
  for (const id of ids) {
    const node = next.nodes[id];
    if (!node) continue;
    const mute = node.state !== "muted";
    const spec = REGISTRY.get(node.type);
    const patch: { state: NodeInstance["state"]; values?: NodeInstance["values"] } = {
      state: mute ? "muted" : "idle",
    };
    if (spec?.inputs.some((port) => port.id === "enabled")) {
      patch.values = { ...node.values, enabled: { kind: "Flag", value: !mute } };
    }
    next = updateNode(next, id, patch);
  }
  if (next !== graph) commit(next);
}

function toggleCollapse(ids: Iterable<NodeId> = selected): void {
  let next = graph;
  for (const id of ids) {
    const node = next.nodes[id];
    if (!node) continue;
    next = updateNode(next, id, { collapsed: !node.collapsed });
  }
  if (next !== graph) commit(next);
}

function acceptAiValues(id: NodeId): void {
  const node = graph.nodes[id];
  if (!node) return;
  const authoredBy = { ...node.authoredBy };
  let changed = false;
  for (const [port, actor] of Object.entries(authoredBy)) {
    if (actor === "ai") {
      authoredBy[port] = "user";
      changed = true;
    }
  }
  if (changed) commit(updateNode(graph, id, { authoredBy }));
}

function selectType(typeId: string): NodeId | null {
  const found = Object.values(graph.nodes).find((n) => n.type === typeId);
  if (!found) return null;
  selected = new Set([found.id]);
  focusNode(found.id);
  invalidate();
  return found.id;
}

function applyLaunchIntent(): void {
  const q = new URLSearchParams(location.search);
  const tool = launchTool ?? q.get("tool");
  if (!launchConsumed) {
    launchConsumed = true;
    if (q.get("open") === "1" || tool === "open") requestOpen();
    if (q.get("export") === "1" || tool === "export") requestExport();
    const flowId = q.get("flow");
    if (flowId) void loadFlow(flowId);
    const refId = q.get("ref");
    if (refId) {
      panelsApi()?.showPane?.("palette", true);
      document.querySelector<HTMLButtonElement>('[data-lib="refs"]')?.click();
      toast("Open Refs in the library and drop this card onto the canvas.");
    }
  }
  if (!tool) return;
  const panels = panelsApi();
  const place = (typeId: string, missing: string) => {
    panels?.showPane?.("graph", true);
    if (selectType(typeId)) return;
    createNode(typeId, vec2(160, 120));
    if (!selectType(typeId)) toast(missing);
  };
  if (tool === "stabilize") {
    panels?.showPane?.("graph", true);
    selectType("stage.stabilize");
    postToGrade({ type: "focus-section", section: "stabilize" });
  } else if (tool === "stack") {
    panels?.showPane?.("graph", true);
    panels?.showPane?.("inspector", true);
    if (!selectType("flow.stack")) {
      toast("Drop a Z Stack from Nodes, then Evaluate depth in Inspect.");
    }
  } else if (tool === "mask") {
    panels?.showPane?.("inspector", true);
    postToDesk({ type: "focus-card", card: "isolation" }, ["desk-tools"]);
  } else if (tool === "enhance" || tool === "repair") {
    panels?.showPane?.("inspector", true);
    postToDesk({ type: "focus-card", card: "generative" }, ["desk-tools"]);
  } else if (tool === "analyse") {
    panels?.showPane?.("inspector", true);
    postToDesk({ type: "focus-card", card: "vision" }, ["desk-tools"]);
  } else if (tool === "gen-image") {
    place("gen.image", "Could not place Generate Image.");
  } else if (tool === "gen-video") {
    place("gen.video", "Could not place Generate Video.");
  } else if (tool === "gen-audio") {
    place("gen.audio", "Could not place Generate Audio.");
  } else if (tool === "gen-mesh") {
    place("gen.mesh", "Could not place Generate 3D.");
  } else if (tool === "ask") {
    place("llm.ask", "Could not place Ask a Model.");
  }
}

globalThis.addEventListener("keydown", (event) => {
  const inField = (event.target as HTMLElement)?.matches?.("input, select, textarea");
  if (inField) return;

  if ((event.key === "Backspace" || event.key === "Delete") && selected.size > 0) {
    event.preventDefault();
    deleteSelected();
    return;
  }
  if (event.key.toLowerCase() === "m" && selected.size > 0) {
    toggleMute();
    return;
  }
  if (event.key.toLowerCase() === "c" && selected.size > 0 && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    toggleCollapse();
    return;
  }
  if (event.key.toLowerCase() === "f") {
    fitAll();
    return;
  }
  if (event.key.toLowerCase() === "p") {
    void runPreview();
    return;
  }
  if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    // Shift-R records every stage separately. Same gesture, stated cost.
    if (event.shiftKey) void runStages();
    else void runWorkflow();
    return;
  }
  if (event.key.toLowerCase() === "l" && selected.size > 0 && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    wrapSelectionInLoop();
    return;
  }
  if (event.key.toLowerCase() === "e") {
    event.preventDefault();
    requestExport();
    return;
  }
  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    requestOpen();
    return;
  }
  if (event.key.toLowerCase() === "g") {
    event.preventDefault();
    const panels = panelsApi();
    if (panels?.cycleFocus) panels.cycleFocus();
    else panels?.setMode(document.body.classList.contains("hide-grade") ? "grade" : "graph");
    return;
  }
  if (event.key.toLowerCase() === "n") {
    // The search box lives in one of four tabs now, and focusing a control
    // inside a hidden pane focuses nothing.
    if (libTab !== "nodes") showLibTab("nodes");
    panelsApi()?.showPane?.("palette", true);
    $<HTMLInputElement>("palette-search").focus();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    const previous = undoStack.pop();
    if (previous) {
      graph = previous;
      recompile();
      invalidate();
    }
    return;
  }
  if (event.key === "Escape") {
    selected = new Set();
    pending = null;
    $("wire-hint").hidden = true;
    const sheet = document.getElementById("shortcuts");
    if (sheet) sheet.hidden = true;
    closeNodeWheel();
    closeCardMenu();
    setProjectMenuOpen(false);
    setSettingsOpen(false);
    const sw = document.getElementById("project-switch");
    if (sw && !sw.hidden) {
      sw.hidden = true;
      pendingSwitchId = null;
      syncProjectChrome();
    }
    invalidate();
  }
  if (event.key === "?" || (event.shiftKey && event.key === "/")) {
    event.preventDefault();
    toggleShortcuts();
  }
});

// ===========================================================================
// Viewport helpers
// ===========================================================================

/**
 * Visible stage height for Fit.
 *
 * Depth lives in the inspector, so the stage rectangle is already the fittable
 * area.
 */
function visibleStageHeight(): number {
  return Math.max(120, stage.getBoundingClientRect().height);
}

function fitAll(): void {
  const rects = Object.values(graph.nodes).map(nodeRect);
  if (rects.length === 0) return;
  const box = stage.getBoundingClientRect();
  const fitted = fitToViewport(
    rects,
    { w: box.width, h: visibleStageHeight() },
    { padding: 70 },
  );
  viewport = { pan: fitted.pan, zoom: fitted.zoom };
  invalidate();
}

function focusNode(id: NodeId): void {
  const node = graph.nodes[id];
  if (!node) return;
  const box = stage.getBoundingClientRect();
  const r = nodeRect(node);
  viewport = {
    zoom: viewport.zoom,
    pan: vec2(
      box.width / 2 - (r.x + r.w / 2) * viewport.zoom,
      box.height / 2 - (r.y + r.h / 2) * viewport.zoom,
    ),
  };
  invalidate();
}

// ===========================================================================
// Palette
// ===========================================================================

const CATEGORY_ORDER: NodeCategory[] = ["source", "stage", "mask", "flow", "ai", "output"];
const CATEGORY_LABEL: Record<NodeCategory, string> = {
  source: "Sources",
  stage: "Restoration stages",
  mask: "Segmentation",
  flow: "Flow & regions",
  ai: "Generative",
  output: "Outputs",
};
const PALETTE_CLOSED_KEY = "ars:palette-closed";

function readClosedCategories(): Set<NodeCategory> {
  try {
    const raw = localStorage.getItem(PALETTE_CLOSED_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((c): c is NodeCategory => CATEGORY_ORDER.includes(c)));
  } catch {
    return new Set();
  }
}

function writeClosedCategories(closed: Set<NodeCategory>): void {
  try {
    localStorage.setItem(PALETTE_CLOSED_KEY, JSON.stringify([...closed]));
  } catch { /* quota / private mode */ }
}

function renderPalette(): void {
  const needle = $<HTMLInputElement>("palette-search").value.trim().toLowerCase();
  const host = $("palette-list");
  const frag = document.createDocumentFragment();
  const closed = readClosedCategories();
  const searching = needle.length > 0;

  for (const category of CATEGORY_ORDER) {
    const specs = REGISTRY.byCategory(category).filter((s) =>
      !needle || `${s.label} ${s.id} ${s.hint}`.toLowerCase().includes(needle)
    );
    if (specs.length === 0) continue;

    const folded = !searching && closed.has(category);
    const group = document.createElement("div");
    group.className = folded ? "pal-group is-closed" : "pal-group";
    group.style.setProperty("--accent", categoryColour(category));

    const label = document.createElement("button");
    label.type = "button";
    label.className = "pal-group-label t-primary";
    label.setAttribute("aria-expanded", String(!folded));
    label.title = folded ? "Show this group" : "Hide this group";
    label.innerHTML = `<span class="pal-bar"></span>` +
      `<span class="pal-group-name"></span>` +
      `<span class="pal-group-count t-secondary"></span>`;
    label.querySelector(".pal-group-name")!.textContent = CATEGORY_LABEL[category];
    label.querySelector(".pal-group-count")!.textContent = String(specs.length);
    label.addEventListener("click", () => {
      if (closed.has(category)) closed.delete(category);
      else closed.add(category);
      writeClosedCategories(closed);
      renderPalette();
    });
    group.append(label);

    const list = document.createElement("div");
    list.className = "pal-group-list";

    for (const spec of specs) {
      const item = document.createElement("div");
      item.className = "pal-item";
      item.style.setProperty("--accent", categoryColour(category));
      item.dataset.type = spec.id;
      item.title = spec.hint +
        " — click to grade it if it is already on the canvas; drag to place a new one.";
      item.draggable = true;
      item.setAttribute("role", "button");

      item.innerHTML = `<span class="pal-dot"></span>` +
        `<span class="pal-name t-primary"></span>` +
        (spec.cost === "network"
          ? `<span class="pal-cost network t-secondary">net</span>`
          : `<span class="pal-cost t-secondary">${spec.cost === "local" ? "cpu" : "disk"}</span>`);
      item.querySelector(".pal-name")!.textContent = spec.label;

      item.addEventListener("dragstart", (e) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", spec.id);
        e.dataTransfer.setData("text/wiv-type", spec.id);
      });
      item.addEventListener("click", () => {
        selectOrPlaceFromPalette(spec.id);
      });
      list.append(item);
    }
    group.append(list);
    frag.append(group);
  }
  if (!frag.childNodes.length) {
    const empty = document.createElement("p");
    empty.className = "muted t-primary";
    empty.textContent = needle ? "No nodes match." : "No node types registered.";
    frag.append(empty);
  }
  host.replaceChildren(frag);
}

function paintPaletteSelection(): void {
  const types = new Set<string>();
  for (const id of selected) {
    const type = graph.nodes[id]?.type;
    if (type) types.add(type);
  }
  for (const item of document.querySelectorAll<HTMLElement>(".pal-item")) {
    item.classList.toggle("is-on", Boolean(item.dataset.type && types.has(item.dataset.type)));
  }
}

/**
 * The library is a navigator as well as a well. Clicking a type that is
 * already on the canvas selects it so Grade can follow; otherwise a card is
 * placed. Drag still always creates.
 */
function selectOrPlaceFromPalette(typeId: string): void {
  const matches = Object.values(graph.nodes).filter((node) => node.type === typeId);
  if (matches.length > 0) {
    const ids = matches.map((node) => node.id);
    const current = [...selected][0];
    const idx = current ? ids.indexOf(current) : -1;
    const next = ids[(idx + 1) % ids.length]!;
    selected = new Set([next]);
    focusNode(next);
    panelsApi()?.showPane?.("grade", true);
    invalidate();
    return;
  }
  const box = stage.getBoundingClientRect();
  const centre = toWorld(box.left + box.width / 2, box.top + box.height / 3);
  selected = new Set([createNode(typeId, centre)]);
  panelsApi()?.showPane?.("grade", true);
}

stage.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
});
stage.addEventListener("drop", (event) => {
  event.preventDefault();

  // A reel dragged from the Files tab. Checked before the node-type drop
  // because both carry `text/plain`, and a path is not a node type — falling
  // through would silently do nothing and look like a broken drag.
  const reel = event.dataTransfer?.getData("application/x-ars-reel");
  if (reel) {
    void openReel(reel);
    return;
  }

  const reference = event.dataTransfer?.getData("application/x-ars-ref");
  if (reference) {
    placeReference(reference, toWorld(event.clientX, event.clientY));
    return;
  }

  const type = event.dataTransfer?.getData("text/wiv-type") ||
    event.dataTransfer?.getData("text/plain");
  if (!type || !REGISTRY.get(type as never)) return;
  selected = new Set([createNode(type, toWorld(event.clientX, event.clientY))]);
});

// ===========================================================================
// Right-click node wheel
// ===========================================================================

const SVG_NS = "http://www.w3.org/2000/svg";
let wheelOrigin: Vec2 | null = null;
let wheelCategory: NodeCategory = "stage";

function closeNodeWheel(): void {
  const el = document.getElementById("node-wheel");
  if (el) el.hidden = true;
  wheelOrigin = null;
}

function donutSlice(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const pt = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${pt(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${pt(r1, a1)} ` +
    `L ${pt(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
}

function wheelLabel(label: string): string {
  if (label.length <= 13) return label;
  return label.replace(" / ", "/").split(/[&/]/)[0]!.trim().slice(0, 13);
}

function paintWheel(): void {
  const host = document.getElementById("wheel-slices");
  if (!host) return;
  host.replaceChildren();
  const cx = 180;
  const cy = 180;
  const cats = CATEGORY_ORDER;
  const catSweep = (Math.PI * 2) / cats.length;
  const catStart = -Math.PI / 2;

  cats.forEach((category, i) => {
    const a0 = catStart + i * catSweep;
    const a1 = a0 + catSweep;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", donutSlice(cx, cy, 34, 88, a0, a1));
    path.setAttribute("fill", categoryColour(category));
    path.setAttribute("fill-opacity", category === wheelCategory ? "0.95" : "0.55");
    if (category === wheelCategory) path.classList.add("is-hot");
    path.dataset.category = category;
    path.addEventListener("pointerenter", () => {
      wheelCategory = category;
      paintWheel();
    });
    path.addEventListener("click", (e) => {
      e.stopPropagation();
      wheelCategory = category;
      paintWheel();
    });
    host.append(path);

    const mid = (a0 + a1) / 2;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(cx + Math.cos(mid) * 61));
    text.setAttribute("y", String(cy + Math.sin(mid) * 61));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = ({
      source: "Source",
      stage: "Stage",
      mask: "Mask",
      flow: "Flow",
      ai: "AI",
      output: "Out",
    } as Record<NodeCategory, string>)[category];
    host.append(text);
  });

  const specs = REGISTRY.byCategory(wheelCategory);
  if (specs.length === 0) return;
  const nodeSweep = (Math.PI * 2) / specs.length;
  specs.forEach((spec, i) => {
    const a0 = catStart + i * nodeSweep;
    const a1 = a0 + nodeSweep;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", donutSlice(cx, cy, 94, 168, a0, a1));
    path.setAttribute("fill", categoryColour(wheelCategory));
    path.setAttribute("fill-opacity", "0.82");
    path.setAttribute("data-type", spec.id);
    path.setAttribute("aria-label", spec.label);
    path.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!wheelOrigin) return;
      selected = new Set([createNode(spec.id, wheelOrigin)]);
      closeNodeWheel();
    });
    host.append(path);

    const mid = (a0 + a1) / 2;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(cx + Math.cos(mid) * 131));
    text.setAttribute("y", String(cy + Math.sin(mid) * 131));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = wheelLabel(spec.label);
    host.append(text);
  });
}

function openNodeWheel(clientX: number, clientY: number): void {
  const el = document.getElementById("node-wheel");
  if (!el) return;
  wheelOrigin = toWorld(clientX, clientY);
  const pad = 188;
  const x = Math.min(window.innerWidth - pad, Math.max(pad, clientX));
  const y = Math.min(window.innerHeight - pad, Math.max(pad, clientY));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.hidden = false;
  paintWheel();
}

stage.addEventListener("dblclick", (event) => {
  const head = (event.target as HTMLElement).closest<HTMLElement>(".card-head");
  if (!head) return;
  const card = head.closest<HTMLElement>(".card");
  if (!card?.dataset.node) return;
  event.preventDefault();
  toggleCollapse([asNodeId(card.dataset.node)]);
});

stage.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const target = event.target as HTMLElement;
  if (target.closest(".card") || target.closest(".port-dot")) return;
  openNodeWheel(event.clientX, event.clientY);
});

document.getElementById("node-wheel")?.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("[data-close-wheel]")) closeNodeWheel();
});
document.addEventListener("pointerdown", (event) => {
  const wheel = document.getElementById("node-wheel");
  if (wheel && !wheel.hidden && event.button !== 2 && !wheel.contains(event.target as Node)) {
    closeNodeWheel();
  }

  // The card menu closes on any press outside itself, except the options
  // button that owns it — that one toggles, and closing here first would make
  // the toggle reopen it on every click.
  if (menuNode) {
    const menu = document.getElementById("card-menu");
    const target = event.target as HTMLElement;
    if (!menu?.contains(target) && !target.closest?.(".card-opts")) closeCardMenu();
  }
  const ctl = document.getElementById("project-ctl");
  if (ctl && !ctl.contains(event.target as Node)) setProjectMenuOpen(false);
  const settings = document.getElementById("settings-ctl");
  if (settings && !settings.contains(event.target as Node)) setSettingsOpen(false);
}, true);

// ===========================================================================
// Engine
// ===========================================================================

async function checkEngine(): Promise<void> {
  const el = $("engine-status");
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error(String(response.status));
    const health = await response.json() as { opencv?: string };
    el.textContent = `engine ok · opencv ${health.opencv ?? "?"}`;
    el.className = "status t-secondary ok";
    await loadProjects();
  } catch {
    el.textContent = "engine offline";
    el.className = "status t-secondary down";
  }
}

async function loadProjects(): Promise<void> {
  const picker = $<HTMLSelectElement>("project-picker");
  try {
    let list: Array<{
      id?: string;
      project_id?: string;
      title?: string;
      source_name?: string;
      source_path?: string;
      frames?: number;
      frame_count?: number;
      name?: string;
      origin?: string;
      media_type?: string;
    }> = [];
    try {
      const response = await fetch("/api/projects");
      const data = await response.json() as
        | { projects?: typeof list }
        | typeof list;
      list = Array.isArray(data) ? data : (data.projects ?? []);
    } catch {
      /* engine down — studio projects still list */
    }
    let studio: Array<{
      id?: string;
      project_id?: string;
      title?: string;
      source_name?: string;
      name?: string;
      origin?: string;
      media_type?: string;
      frame_count?: number;
      frames?: number;
    }> = [];
    try {
      const studioRes = await fetch("/studio/projects");
      if (studioRes.ok) {
        const studioData = await studioRes.json() as { projects?: typeof studio };
        studio = studioData.projects ?? [];
      }
    } catch {
      /* studio shelf is optional */
    }
    const byId = new Map<string, (typeof list)[number]>();
    for (const p of studio) {
      const id = String(p.project_id ?? p.id ?? "");
      if (id) byId.set(id, p);
    }
    for (const p of list) {
      const id = String(p.project_id ?? p.id ?? "");
      if (!id) continue;
      const prev = byId.get(id);
      byId.set(id, prev ? { ...prev, ...p } : p);
    }
    const merged = [...byId.values()];

    projectRows = [];
    picker.replaceChildren(new Option("— none —", ""));
    for (const p of merged) {
      const row = displayTitle(p);
      if (!row.id) continue;
      projectRows.push(row);
      const opt = new Option(row.title, row.id);
      opt.dataset.frames = String(row.frames);
      opt.dataset.origin = row.origin;
      picker.append(opt);
    }
    fillProjectMenu();
    syncProjectChrome();
    // Prefer ?project= from the desk hand-off; otherwise bind the first project
    // so Preview is not dead on an empty canvas.
    const fromUrl = new URLSearchParams(location.search).get("project");
    const ids = projectRows.map((p) => p.id);
    if (fromUrl && ids.includes(fromUrl)) {
      await requestBindProject(fromUrl, { silent: true });
    } else if (!graph.projectId && ids.length > 0) {
      await requestBindProject(ids[0]!, { silent: true });
    }
  } catch {
    /* the status badge already says the engine is down */
  }
}

function setProjectMenuOpen(open: boolean): void {
  const ctl = document.getElementById("project-ctl");
  const caret = document.getElementById("project-caret");
  const menu = document.getElementById("project-menu");
  if (!ctl || !caret || !menu) return;
  ctl.classList.toggle("is-open", open);
  caret.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
}

function setSettingsOpen(open: boolean): void {
  const ctl = document.getElementById("settings-ctl");
  const btn = document.getElementById("btn-settings");
  const menu = document.getElementById("settings-menu");
  if (!ctl || !btn || !menu) return;
  ctl.classList.toggle("is-open", open);
  btn.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
}

function fillProjectMenu(): void {
  const menu = document.getElementById("project-menu");
  if (!menu) return;
  menu.replaceChildren();
  const add = (id: string, label: string) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "option");
    btn.dataset.id = id;
    btn.textContent = label;
    btn.setAttribute("aria-selected", String(id === (graph.projectId || "")));
    btn.addEventListener("click", () => {
      setProjectMenuOpen(false);
      void requestBindProject(id);
    });
    li.append(btn);
    menu.append(li);
  };
  add("", "— none —");
  for (const row of projectRows) add(row.id, row.title);
}

function syncProjectChrome(): void {
  const picker = document.getElementById("project-picker") as HTMLSelectElement | null;
  const name = document.getElementById("project-name") as HTMLInputElement | null;
  const folder = document.getElementById("project-folder");
  const id = graph.projectId || "";
  if (picker && picker.value !== id) picker.value = id;
  if (name && document.activeElement !== name) {
    const row = projectRows.find((r) => r.id === id);
    name.value = row?.title || id;
    name.disabled = !id;
  }
  const label = id
    ? (projectRows.find((r) => r.id === id)?.folder || projectInfo?.folder || "")
    : "";
  if (folder) {
    folder.dataset.folder = label;
  }
  fitProjectFolder();
}

function fitProjectFolder(): void {
  const folder = document.getElementById("project-folder");
  const name = document.getElementById("project-name") as HTMLInputElement | null;
  const shell = folder?.parentElement;
  if (!folder || !name) return;
  const label = folder.dataset.folder || "";
  if (!label || !graph.projectId) {
    folder.hidden = true;
    folder.textContent = "";
    return;
  }
  folder.hidden = false;
  folder.textContent = `${label} /`;
  const shellW = shell?.clientWidth ?? 0;
  if (shellW < folder.scrollWidth + 72) {
    folder.hidden = true;
    folder.textContent = "";
  }
}

async function requestBindProject(
  nextId: string,
  opts: { silent?: boolean } = {},
): Promise<void> {
  const current = graph.projectId || "";
  if (nextId === current) {
    syncProjectChrome();
    return;
  }
  if (!opts.silent && isGraphDirty() && !autosaveOnSwitch()) {
    pendingSwitchId = nextId;
    const dlg = document.getElementById("project-switch");
    const title = document.getElementById("project-switch-title");
    if (title) {
      const from = projectRows.find((r) => r.id === current)?.title || current || "this project";
      const to = nextId
        ? (projectRows.find((r) => r.id === nextId)?.title || nextId)
        : "none";
      title.textContent = `Save changes to ${from} before opening ${to}?`;
    }
    if (dlg) dlg.hidden = false;
    syncProjectChrome();
    return;
  }
  if (isGraphDirty()) await flushGraph();
  await bindProject(nextId);
}

async function revertLoadedGraph(): Promise<void> {
  const pid = graph.projectId;
  if (!loadedGraphJson) return;
  try {
    localStorage.setItem(graphStorageKey(pid), loadedGraphJson);
  } catch {
    /* private mode */
  }
  if (!pid) return;
  clearTimeout(graphDiskTimer);
  graphDiskTimer = 0;
  try {
    const doc = JSON.parse(loadedGraphJson) as GraphDocument;
    await putGraphToDisk(pid, doc);
  } catch {
    /* leave disk as-is if the snapshot is unreadable */
  }
}

async function bindProject(projectId: string): Promise<void> {
  const picker = document.getElementById("project-picker") as HTMLSelectElement | null;
  if (picker) picker.value = projectId;
  const saved = await readStoredGraph(projectId);
  const row = projectRows.find((r) => r.id === projectId);
  const studioBlank = Boolean(projectId) &&
    (row?.origin === "studio" || (row != null && row.frames === 0));
  if (saved && Object.keys(saved.nodes).length > 0) {
    graph = { ...saved, projectId: projectId || null };
  } else if (studioBlank) {
    // Cause: the previous restoration chain was copied onto a blank studio
    // project, so Grade still asked the engine for frames that do not exist.
    graph = { ...emptyGraph(asGraphId("g1")), projectId };
  } else {
    graph = { ...graph, projectId: projectId || null };
  }
  let next = graph;
  for (const node of Object.values(graph.nodes)) {
    if (node.type !== "source.sequence") continue;
    next = updateNode(next, node.id, {
      values: { ...node.values, project_id: { kind: "Text", value: projectId } },
      authoredBy: { ...node.authoredBy, project_id: "system" },
    });
  }
  commit(next, false);
  markGraphClean();
  // The ledger is per-project and keyed off the bound id, so it must load
  // after the graph takes the new projectId and before anything reads history.
  loadLedger();
  await loadSequenceLength();
  void loadCarousel();
  const brand = document.getElementById("brand-home") as HTMLAnchorElement | null;
  if (brand) brand.href = "/";
  syncExportLink(projectId);
  renderWorkflowVars();
  syncProjectChrome();
  fillProjectMenu();
}

async function renameCurrentProject(title: string): Promise<void> {
  const pid = graph.projectId;
  const name = document.getElementById("project-name") as HTMLInputElement | null;
  if (!pid) {
    if (name) name.value = "";
    return;
  }
  const clean = title.trim().slice(0, 80);
  const row = projectRows.find((r) => r.id === pid);
  if (!clean) {
    if (name) name.value = row?.title || pid;
    return;
  }
  if (row && row.title === clean) return;
  try {
    localStorage.setItem(`ars:project-title:${pid}`, clean);
  } catch {
    /* private mode */
  }
  if (row) row.title = clean;
  else projectRows.push({
    id: pid,
    title: clean,
    folder: projectInfo?.folder || "",
    frames: projectInfo?.frames ?? 0,
    origin: "",
    mediaType: "",
  });
  if (projectInfo) projectInfo = { ...projectInfo, label: clean };
  const picker = document.getElementById("project-picker") as HTMLSelectElement | null;
  const opt = picker ? Array.from(picker.options).find((o) => o.value === pid) : undefined;
  if (opt) opt.text = clean;
  fillProjectMenu();
  syncProjectChrome();
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(pid)}/meta`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: clean }),
    });
    if (!response.ok) throw new Error(String(response.status));
    toast(`Project renamed to ${clean}.`);
  } catch {
    toast(`Project renamed to ${clean} on this machine.`);
  }
}

/**
 * How many frames the bound project holds.
 *
 * Needed before a stack can plan its range: without it `stackFrames` has no
 * upper bound and would queue engine calls for frames that do not exist.
 */
async function loadSequenceLength(): Promise<void> {
  if (!graph.projectId) {
    sequenceLength = 0;
    projectInfo = null;
    return;
  }
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(graph.projectId)}`);
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json() as {
      extraction?: { frame_count?: number };
      frames?: number;
      frame_count?: number;
      manifest?: {
        params?: Record<string, Record<string, unknown>>;
        source_name?: string;
        source_path?: string;
        title?: string;
        fps?: number;
        frame_count?: number;
        source?: {
          fps?: number;
          width?: number;
          height?: number;
          frame_count?: number;
          duration_s?: number;
        };
      };
    };
    sequenceLength = data.extraction?.frame_count ?? data.frame_count ?? data.frames ??
      data.manifest?.frame_count ?? 0;
    const source = data.manifest?.source;
    const sourceName = data.manifest?.source_name ?? "";
    const stem = (data.manifest?.title ?? "").trim() ||
      sourceName.replace(/\.[^.]+$/, "") || graph.projectId;
    const fps = data.manifest?.fps ?? source?.fps ?? null;
    projectInfo = {
      id: graph.projectId,
      label: stem,
      folder: folderFromPath(data.manifest?.source_path ?? ""),
      frames: sequenceLength,
      fps: typeof fps === "number" && Number.isFinite(fps) ? fps : null,
      width: source?.width ?? null,
      height: source?.height ?? null,
      format: sourceName.includes(".") ? sourceName.split(".").pop()!.toUpperCase() : null,
      durationS: source?.duration_s ??
        (fps && sequenceLength ? sequenceLength / fps : null),
    };
    const row = projectRows.find((r) => r.id === graph.projectId);
    if (row && projectInfo.folder) row.folder = projectInfo.folder;
    syncProjectChrome();
    const input = document.getElementById("frame-input") as HTMLInputElement | null;
    if (sequenceLength > 0 && input) input.max = String(sequenceLength - 1);
    if (data.manifest?.params) applyDeskParams(data.manifest.params, "system");
    if (sequenceLength > 0) persistCompiledParams();
    invalidate();
  } catch {
    sequenceLength = 0;
    projectInfo = graph.projectId
      ? {
        id: graph.projectId,
        label: graph.projectId,
        folder: "",
        frames: 0,
        fps: null,
        width: null,
        height: null,
        format: null,
        durationS: null,
      }
      : null;
  }
}

/**
 * Record a node's result, and pass it on to any display node it feeds.
 *
 * A Viewer runs no engine step of its own — it exists to show what reaches it —
 * so without this it stays blank while the stage wired into it has a picture.
 * Propagation stops at display nodes: anything that *processes* the frame will
 * produce its own result and must not borrow its input's.
 */
function recordPreview(
  target: NodeId,
  frame: { image: string; frame: number; elapsedMs: number },
): void {
  previews.set(target, {
    image: frame.image,
    frame: frame.frame,
    elapsedMs: frame.elapsedMs,
  });
  for (const edge of Object.values(graph.edges)) {
    if (edge.from.node !== target) continue;
    const consumer = graph.nodes[edge.to.node];
    if (!consumer) continue;
    if (REGISTRY.get(consumer.type)?.category !== "output") continue;
    previews.set(consumer.id, {
      image: frame.image,
      frame: frame.frame,
      elapsedMs: frame.elapsedMs,
    });
  }
}

function persistCompiledParams(): void {
  if (!graph.projectId || !compiled || sequenceLength <= 0) return;
  const preview = [...compiled.steps].reverse().find((step) => step.kind === "preview");
  if (!preview || preview.kind !== "preview") return;
  void fetch("/api/project/params", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: graph.projectId, params: preview.params }),
  }).catch(() => {/* engine down */});
  postToGrade({ type: "set-params", params: preview.params });
}

type GradeStepKind = "source" | "stage" | "stack" | "output" | "other";

type GradeStep = {
  id: string;
  type: string;
  label: string;
  kind: GradeStepKind;
  engineStage: string | null;
  muted: boolean;
  colour: string;
  bodyCount?: number;
};

function gradeStepKind(
  spec: { category: NodeCategory; engineStage: string | null },
  type: string,
): GradeStepKind {
  if (spec.engineStage) return "stage";
  if (spec.category === "source") return "source";
  if (type === "flow.stack") return "stack";
  if (spec.category === "output") return "output";
  return "other";
}

function describeGradeStep(node: NodeInstance): GradeStep | null {
  const spec = REGISTRY.get(node.type);
  if (!spec) return null;
  const kind = gradeStepKind(spec, node.type);
  const renamed = node.name === "Frame Pick" || node.name === "Footage";
  const step: GradeStep = {
    id: node.id,
    type: node.type,
    label: spec.id === "source.sequence"
      ? (projectInfo?.id || spec.label)
      : (renamed ? spec.label : (node.name || spec.label)),
    kind,
    engineStage: spec.engineStage,
    muted: node.state === "muted",
    colour: categoryColour(spec.category),
  };
  if (kind === "stack") {
    step.bodyCount = resolveStackScope(graph, node.id).body.length;
  }
  return step;
}

function graphGradeSteps(): GradeStep[] {
  const ranked = Object.values(graph.nodes)
    .slice()
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  const steps: GradeStep[] = [];
  for (const node of ranked) {
    if (node.type === "flow.collect") continue;
    const step = describeGradeStep(node);
    if (!step) continue;
    steps.push(step);
  }
  return steps;
}

let lastGradeStepSig = "";

function syncGradeToCanvas(): void {
  const steps = graphGradeSteps();
  const picked = selected.size === 1 ? graph.nodes[[...selected][0]!] : undefined;
  const current = picked ? describeGradeStep(picked) : null;
  const wrap = depthWrap();
  const sig = JSON.stringify({
    id: current?.id ?? "",
    muted: current?.muted ?? false,
    wrap,
    body: current?.bodyCount ?? 0,
    steps: steps.map((s) => `${s.id}:${s.muted}`),
  });
  if (sig === lastGradeStepSig) return;
  lastGradeStepSig = sig;
  postToGrade({ type: "set-step", step: current, steps, wrap });
}

async function runPreview(gated = true): Promise<void> {
  if (!graph.projectId) {
    toast("Pick a project first — This frame needs footage bound to this canvas.", true);
    return;
  }
  // Auto-preview is exempt: switching it on is the standing confirmation.
  if (gated && consoleUi && !(await consoleUi.confirmBeforeRun(Object.keys(graph.nodes).map(asNodeId)))) {
    return;
  }
  recompile();
  const hasStage = Object.values(graph.nodes).some((n) => REGISTRY.get(n.type)?.category === "stage");
  const button = document.getElementById("btn-preview") as HTMLButtonElement | null;
  const label = "This frame";
  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
    button.textContent = "This frame…";
  }
  try {
    if (!hasStage) {
      paintSourceThumbs(currentFrame);
      toast(
        `Frame ${currentFrame} of the reel. Drop a restoration node and wire it to process this frame.`,
      );
      return;
    }

    const started = performance.now();
    const result = await evaluateFrame(graph, REGISTRY, engine, currentFrame);
    const elapsed = Math.round(performance.now() - started);

    let next = graph;
    for (const [id, frame] of result.outputs) {
      recordPreview(id, frame);
      next = updateNode(next, id, { state: "fresh" });
    }
    if (next !== graph) commit(next, false);
    persistCompiledParams();

    if (result.outputs.size === 0) {
      paintSourceThumbs(currentFrame);
      const first = result.diagnostics.find((d) => d.severity === "error");
      if (result.networkSteps > 0 && !result.runnable) {
        toast(
          "This frame only runs local restoration. The next steps are AI/network — press Run (R).",
          true,
        );
      } else if (first) {
        panelsApi()?.showPane?.("inspector", true);
        toast(first.message, true);
      } else {
        toast("This frame: no local restoration ran. Wire a stage to the source.", true);
      }
      return;
    }
    const skipped = result.networkSteps;
    toast(
      `This frame: ${result.outputs.size} local result${
        result.outputs.size === 1 ? "" : "s"
      } in ${elapsed} ms` +
        (skipped > 0 ? ` · ${skipped} AI/network step(s) skipped — use Run` : ""),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let failed = graph;
    for (const step of compiled?.steps ?? []) {
      if (step.kind !== "preview") continue;
      failed = updateNode(failed, step.node, { state: "failed", error: message });
    }
    if (failed !== graph) commit(failed, false);
    toast(`Engine refused: ${message}`, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-busy");
      button.textContent = label;
    }
    invalidate();
  }
}

// ===========================================================================
// The library — Nodes · Files · Refs · Flows
// ===========================================================================
//
// The GitHub version's Explorer read the machine's folders and its saved
// workflows. Both are restored here, and the merge added a fourth shelf — the
// reference library — sharing the palette's column, because all four tabs
// answer "what can I put on the canvas".
//
// The Files tab lists names and sizes only. It never reads a file's bytes —
// opening a reel hands the *path* to the engine, which is the half of the
// system that already knows how to decode video.

type LibTab = "nodes" | "files" | "refs" | "flows";

let libTab: LibTab = "nodes";
let filesPath = "";
let filesFilter = "";

interface FsEntry {
  name: string;
  path: string;
  kind: "dir" | "file";
  ext?: string;
  size?: number;
  media?: boolean;
}

let filesEntries: FsEntry[] = [];
let filesRoot = "";

function showLibTab(tab: LibTab): void {
  libTab = tab;
  for (const button of document.querySelectorAll<HTMLElement>(".lib-tab")) {
    const on = button.dataset.lib === tab;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-selected", String(on));
  }
  for (const pane of document.querySelectorAll<HTMLElement>("[data-lib-pane]")) {
    pane.hidden = pane.dataset.libPane !== tab;
  }
  if (tab === "files" && filesEntries.length === 0) void loadFolder(filesPath);
  if (tab === "refs" && references.length === 0) void loadReferences();
  if (tab === "flows") void loadFlows();
}

/** Bytes, at the precision a person reads rather than the one a disk reports. */
function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function loadFolder(path: string): Promise<void> {
  const list = $("files-list");
  try {
    const response = await fetch(`/fs/list?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json() as { root: string; path: string; entries: FsEntry[] };
    filesPath = data.path;
    filesRoot = data.root;
    filesEntries = data.entries;
    renderFiles();
  } catch {
    filesEntries = [];
    list.replaceChildren();
    const note = document.createElement("p");
    note.className = "lib-empty";
    note.textContent = "Cannot read that folder.";
    list.append(note);
  }
}

function renderFiles(): void {
  $("files-path").textContent = filesPath ? `${filesRoot}/${filesPath}` : filesRoot;
  const list = $("files-list");
  const needle = filesFilter.trim().toLowerCase();
  const shown = needle
    ? filesEntries.filter((e) => e.name.toLowerCase().includes(needle))
    : filesEntries;

  const frag = document.createDocumentFragment();
  for (const entry of shown) {
    const button = document.createElement("button");
    button.type = "button";
    const isDir = entry.kind === "dir";
    const media = Boolean(entry.media);
    button.className = `fs-row ${isDir ? "is-dir" : media ? "is-media" : "is-other"}`;
    button.dataset.path = entry.path;
    button.dataset.kind = entry.kind;
    if (media) button.dataset.media = "1";
    button.disabled = !isDir && !media;
    button.title = isDir
      ? "Open this folder"
      : media
      ? "Open this reel in the restorer"
      : "The restorer has no decoder for this file";

    // A media row is draggable onto the canvas. Dropping it there opens the
    // reel *and* points the graph at it, which is the two-step act the Files
    // tab exists to collapse into one.
    if (media) {
      button.draggable = true;
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("application/x-ars-reel", entry.path);
        event.dataTransfer?.setData("text/plain", `${filesRoot}/${entry.path}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
      });
    }

    const icon = document.createElement("span");
    icon.className = "fs-icon";
    icon.textContent = isDir ? "▸" : media ? "◆" : "·";
    const name = document.createElement("span");
    name.className = "fs-name";
    name.textContent = entry.name;
    button.append(icon, name);

    if (!isDir && entry.size !== undefined) {
      const size = document.createElement("span");
      size.className = "fs-size t-secondary";
      size.textContent = bytes(entry.size);
      button.append(size);
    }
    frag.append(button);
  }

  list.replaceChildren(frag);
  if (shown.length === 0) {
    const note = document.createElement("p");
    note.className = "lib-empty";
    note.textContent = filesEntries.length === 0
      ? "This folder is empty."
      : "Nothing here matches that filter.";
    list.append(note);
  }
}

/**
 * Hand a reel to the engine.
 *
 * The path goes to `/api/video/load` rather than being read here: the engine
 * is the half that has ffmpeg, and a browser that could read the bytes would
 * be a browser that could send them somewhere. Extraction is the engine's own
 * background job, so this returns as soon as the job is accepted and the
 * project list is re-read to pick up the new reel.
 *
 * `analyze: true` matches what the Desk's own open dialog sends — a reel that
 * arrives without its analysis pass has no per-frame scores, and the depth
 * strip is then a row of identical grey cards.
 */
async function openReel(path: string): Promise<void> {
  const full = `${filesRoot}/${path}`;
  const name = path.split("/").pop() ?? path;
  try {
    const response = await fetch("/api/video/load", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: full, start: 0, end: null, step: 1, analyze: true }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { detail?: string };
      throw new Error(detail.detail ?? `HTTP ${response.status}`);
    }
    const result = await response.json() as {
      project_id?: string;
      estimated_frames?: number;
    };
    toast(
      `Extracting ${result.estimated_frames ?? "…"} frames from ${name}. ` +
        `It appears in the project picker when the engine has finished.`,
    );
    // The reel is not ready yet, but the project row exists — refreshing the
    // picker now is what lets the user watch for it rather than guess.
    await loadProjects();
    if (result.project_id) {
      const picker = $<HTMLSelectElement>("project-picker");
      const known = Array.from(picker.options).some((o) => o.value === result.project_id);
      if (known) {
        await requestBindProject(result.project_id, { silent: true });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`Could not open ${name}: ${message}`, true);
  }
}

// --- references ------------------------------------------------------------
//
// The four shelves — Movies, Stars, Comics, Scripts. Unlike the other three
// library tabs this one is a *grid of frames*, because it is browsed rather
// than searched: you open Nodes knowing what you want and open Refs looking
// for something to react to.
//
// A card drags onto the canvas as a `ref.card` node with its id already filled
// in, which is the whole interaction. Typing `movie.blade_runner` into a Text
// port would work too and nobody would ever do it.

interface ReferenceCard {
  id: string;
  kind: "movie" | "star" | "comic" | "script";
  name: string;
  summary: string;
  tags: string[];
  year?: number;
  thumb?: string;
  detail?: string;
  source?: string;
  grant: {
    cinema?: unknown;
    prompt?: string[];
    negative?: string[];
    params?: Record<string, string | number | boolean>;
  };
}

/** Accent per shelf. Mirrors `KIND_COLOUR` in `core/library.ts`. */
const REF_ACCENT: Record<string, string> = {
  movie: "#4da3d8",
  star: "#e8a33d",
  comic: "#c76a9f",
  script: "#5cbfa8",
};

let references: ReferenceCard[] = [];
let refKind: ReferenceCard["kind"] = "movie";
let refSearch = "";

async function loadReferences(reload = false): Promise<void> {
  const note = $("refs-note");
  try {
    const response = await fetch(reload ? "/library?reload=1" : "/library");
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json() as {
      references: ReferenceCard[];
      problems: string[];
      presetWarnings: { message: string }[];
    };
    references = data.references;
    // Problems are shown, not thrown: one malformed shelf must not take the
    // other 140 cards off screen.
    note.textContent = data.problems.length > 0 ? data.problems.join(" · ") : "";
    renderReferences();
  } catch {
    references = [];
    $("refs-list").replaceChildren();
    note.textContent = "The library could not be read. Is the canvas server running?";
  }
}

function renderReferences(): void {
  const list = $("refs-list");
  const needle = refSearch.trim().toLowerCase();
  const shown = references.filter((r) => {
    if (r.kind !== refKind) return false;
    if (needle === "") return true;
    return r.name.toLowerCase().includes(needle) ||
      r.summary.toLowerCase().includes(needle) ||
      r.tags.some((t) => t.toLowerCase().includes(needle));
  });

  // Films read best in release order. The animation styles share this shelf and
  // carry no year — sorting them as year 0 buried all 67 films below 43 styles,
  // so the dated entries come first in date order and the rest follow by name.
  if (refKind === "movie") {
    shown.sort((a, b) => {
      if (a.year !== undefined && b.year !== undefined) return a.year - b.year;
      if (a.year !== undefined) return -1;
      if (b.year !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const frag = document.createDocumentFragment();
  for (const card of shown) {
    const el = document.createElement("div");
    el.className = "ref-card";
    el.draggable = true;
    el.dataset.ref = card.id;
    el.style.setProperty("--ref-accent", REF_ACCENT[card.kind] ?? "#888");
    el.title = card.detail ? `${card.summary}\n\n${card.detail}` : card.summary;

    if (card.thumb) {
      const img = document.createElement("img");
      img.className = "ref-thumb";
      img.src = card.thumb;
      img.alt = "";
      img.loading = "lazy";
      el.append(img);
    } else {
      const blank = document.createElement("div");
      blank.className = "ref-thumb is-blank";
      blank.textContent = card.kind === "star" ? "●" : card.kind === "comic" ? "▦" : "¶";
      el.append(blank);
    }

    const name = document.createElement("div");
    name.className = "ref-name";
    name.textContent = card.name;

    const meta = document.createElement("div");
    meta.className = "ref-meta";
    meta.textContent = card.summary;

    el.append(name, meta);
    frag.append(el);
  }
  list.replaceChildren(frag);

  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "lib-empty";
    empty.textContent = references.length === 0
      ? "Loading the library…"
      : `Nothing on the ${refKind} shelf matches “${refSearch}”.`;
    list.append(empty);
  }
}

/**
 * Put a reference on the canvas.
 *
 * Creates a `ref.card` and writes the id into its `reference_id` port, so the
 * node arrives already meaning something. Dropping a card that leaves the user
 * to type an identifier would be a worse version of the palette.
 */
function placeReference(refId: string, at: Vec2): void {
  const id = createNode("ref.card", at);
  setValue(id, "reference_id", { kind: "Text", value: refId });
  selected = new Set([id]);
  const card = references.find((r) => r.id === refId);
  if (card) toast(`${card.name} — wire its Style into a generate node.`);
}

// --- flows -----------------------------------------------------------------

interface FlowSummary {
  id: string;
  name: string;
  note: string;
  savedAt: number;
  nodes: number;
}

async function loadFlows(): Promise<void> {
  const list = $("flows-list");
  try {
    const response = await fetch("/flows");
    const data = await response.json() as { flows: FlowSummary[] };
    const frag = document.createDocumentFragment();
    for (const flow of data.flows) {
      const wrap = document.createElement("div");
      wrap.className = "flow-row";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "flow-open";
      open.dataset.flow = flow.id;
      open.title = flow.note || "Load this workflow onto the canvas";
      const title = document.createElement("b");
      title.textContent = flow.name;
      const meta = document.createElement("span");
      meta.className = "flow-meta t-secondary";
      const when = flow.savedAt ? new Date(flow.savedAt).toLocaleString() : "—";
      meta.textContent = `${flow.nodes} node${flow.nodes === 1 ? "" : "s"} · ${when}`;
      open.append(title, meta);
      wrap.append(open);
      frag.append(wrap);
    }
    list.replaceChildren(frag);
    if (data.flows.length === 0) {
      const note = document.createElement("p");
      note.className = "lib-empty";
      note.textContent =
        "No saved workflows yet. Build a graph, then Save current — it lands in workflows/ next to the app.";
      list.append(note);
    }
  } catch {
    list.replaceChildren();
    const note = document.createElement("p");
    note.className = "lib-empty";
    note.textContent = "Cannot reach the workflow store.";
    list.append(note);
  }
}

async function saveCurrentFlow(): Promise<void> {
  if (Object.keys(graph.nodes).length === 0) {
    toast("Nothing to save — the canvas is empty.", true);
    return;
  }
  const name = globalThis.prompt("Name this workflow", "Restoration chain");
  if (!name) return;
  try {
    const response = await fetch("/flows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // The project id is deliberately not saved: a workflow is a shape to
      // apply to footage, not a reference to one reel. Saving the binding
      // would make every loaded flow silently re-point at someone else's reel.
      body: JSON.stringify({
        name,
        graph: { ...graph, projectId: null },
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
    toast(`Saved “${name}”.`);
    void loadFlows();
  } catch {
    toast("Could not save that workflow.", true);
  }
}

async function loadFlow(id: string): Promise<void> {
  try {
    const response = await fetch(`/flows/${encodeURIComponent(id)}`);
    const data = await response.json() as { name: string; graph: GraphDocument };
    const incoming = data.graph;
    if (!incoming?.nodes || Object.keys(incoming.nodes).length === 0) {
      toast("That workflow has no nodes.", true);
      return;
    }
    // Keep the bound project: the flow is a shape, and the footage under it
    // is whatever this canvas is already pointed at.
    commit({ ...incoming, projectId: graph.projectId, id: graph.id });
    selected = new Set();
    fitAll();
    toast(`Loaded “${data.name}” — ${Object.keys(incoming.nodes).length} nodes.`);
  } catch {
    toast("Could not load that workflow.", true);
  }
}

// ===========================================================================
// Loops — wrapping a selection in a depth axis
// ===========================================================================
//
// A loop here is not a feedback edge. `flow.stack` opens a depth axis,
// `flow.collect` closes it, and everything reachable between them is the body
// that runs once per frame. The README's "Depth is the loop."
//
// Building one by hand means placing two nodes, finding the head and tail of
// the chain you meant, re-routing four wires, and getting the scope right —
// and `resolveStackScope` refuses three different ways when you do not. That
// is a lot of ceremony for the single most common structural edit, so the
// marquee selection becomes the loop body directly.

/**
 * The nodes of `body` with no incoming edge from inside it, and no outgoing
 * edge to inside it: the places the loop has to be spliced in.
 *
 * A selection with two heads is not refused — a stack can feed several chains.
 * A selection with two *tails* is, because `flow.collect` gathers one image
 * and picking which tail to gather would be a guess about intent.
 */
function selectionSeam(body: ReadonlySet<NodeId>): {
  heads: NodeId[];
  tails: NodeId[];
} {
  const adjacency = buildAdjacency(graph);
  const heads: NodeId[] = [];
  const tails: NodeId[] = [];
  for (const id of body) {
    const incoming = adjacency.incoming.get(id) ?? [];
    const outgoing = adjacency.outgoing.get(id) ?? [];
    if (!incoming.some((e) => body.has(e.from.node))) heads.push(id);
    if (!outgoing.some((e) => body.has(e.to.node))) tails.push(id);
  }
  return { heads, tails };
}

/**
 * Wrap the current selection in a Z stack.
 *
 * The stack is placed left of the body and the collect right of it, so the
 * loop reads in the direction the graph already flows. Existing wires into
 * the head are left alone: the source that fed the chain now also feeds the
 * stack's `sequence`, which is what makes the body iterate over that footage
 * rather than over nothing.
 */
function wrapSelectionInLoop(): void {
  if (selected.size === 0) {
    toast("Select the nodes to loop over first — right-drag the canvas to rectangle-select.", true);
    return;
  }
  for (const id of selected) {
    if (graph.nodes[id]?.stack) {
      toast("Those nodes are already inside a Z stack. The canvas draws one depth axis.", true);
      return;
    }
  }

  const body = new Set(selected);
  const { heads, tails } = selectionSeam(body);
  if (tails.length !== 1) {
    toast(
      tails.length === 0
        ? "That selection has no end — a loop needs one result to collect."
        : `That selection ends in ${tails.length} places. Collect gathers one image, so select one chain.`,
      true,
    );
    return;
  }
  const head = heads[0];
  const tail = tails[0]!;
  if (!head) {
    toast("That selection has no entry point to iterate.", true);
    return;
  }

  // Place the two new nodes clear of the body's bounding box.
  let minX = Infinity, maxX = -Infinity, midY = 0;
  for (const id of body) {
    const node = graph.nodes[id]!;
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x + node.size.w);
    midY += node.position.y;
  }
  midY /= body.size;

  const before = graph;
  const stackId = createNode("flow.stack", snapPoint(vec2(minX - 300, midY)));
  const collectId = createNode("flow.collect", snapPoint(vec2(maxX + 80, midY)));

  const link = (from: NodeId, fromPort: string, to: NodeId, toPort: string): boolean => {
    const result = connect(
      graph,
      { node: from, port: asPortId(fromPort) },
      { node: to, port: asPortId(toPort) },
      (n, p, d) => {
        const node = graph.nodes[n];
        return node ? REGISTRY.port(node.type, p, d) : null;
      },
    );
    if ("edge" in result) {
      graph = result.graph;
      return true;
    }
    return false;
  };

  // Whatever fed the head's image now feeds the stack's sequence, and the
  // stack's slice feeds the head instead. Without the re-route the body would
  // iterate while still reading the same single frame every time — the loop
  // would run and change nothing, which is the worst failure mode available.
  const adjacency = buildAdjacency(before);
  const feed = (adjacency.incoming.get(head) ?? []).find((e) =>
    e.to.port === "image" || e.to.port === "sequence"
  );
  if (feed) {
    graph = disconnect(graph, feed.id);
    link(feed.from.node, feed.from.port as string, stackId, "sequence");
  }
  const wiredHead = link(stackId, "image", head, "image") ||
    link(stackId, "image", head, "sequence");
  const wiredTail = link(tail, "image", collectId, "image");

  if (!wiredHead || !wiredTail) {
    graph = before;
    commit(before, false);
    toast(
      "Could not splice a loop around that selection — the head or tail has no image port.",
      true,
    );
    return;
  }

  selected = new Set([stackId]);
  commit(graph);
  focusNode(stackId);
  toast(
    `Loop over ${body.size} node${body.size === 1 ? "" : "s"} — Z Stack in, Collect out. ` +
      `Evaluate depth in the inspector.`,
  );
}

// ===========================================================================
// Card options — the per-node menu
// ===========================================================================
//
// The GitHub version's `NodeEtiquette` put identity, prompt, lineage, versions
// and actions on the card itself. What that got right is that the card is
// where you are looking; what it got wrong for this canvas is drawing the
// panel *inside* the card, on a plane that zooms. Here the panel is screen
// space and fixed size, anchored to the card that opened it.

/** Nodes currently drawing every port, keyed by the `+N more` control. */
const unfolded = new Set<NodeId>();

/** Which node's menu is open, if any. */
let menuNode: NodeId | null = null;

function closeCardMenu(): void {
  menuNode = null;
  $("card-menu").hidden = true;
}

function row(parent: HTMLElement, tag: string, cls: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  parent.append(el);
  return el;
}

function section(parent: HTMLElement, title: string, count?: number): HTMLElement {
  const box = row(parent, "div", "cm-section");
  const head = row(box, "h4", "");
  head.textContent = title;
  if (count !== undefined) {
    const n = document.createElement("span");
    n.className = "cm-count";
    n.textContent = String(count);
    head.append(n);
  }
  return box;
}

/** Human duration. Milliseconds below a second, seconds above. */
function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

function paintCardMenu(): void {
  const el = $("card-menu");
  if (!menuNode) {
    el.hidden = true;
    return;
  }
  const node = graph.nodes[menuNode];
  if (!node) {
    closeCardMenu();
    return;
  }
  const spec = REGISTRY.get(node.type);
  const id = node.id;
  el.replaceChildren();
  el.style.setProperty("--accent", categoryColour(spec?.category ?? "stage"));

  // --- header: rename in place, and say what type it is ---
  const head = row(el, "div", "cm-head");
  row(head, "span", "cm-swatch");
  const name = document.createElement("input");
  name.className = "cm-name t-secondary";
  name.value = node.name;
  name.title = "Rename this node";
  name.addEventListener("change", () => {
    commit(updateNode(graph, id, { name: name.value.trim() || spec?.label || node.type }));
  });
  head.append(name);
  row(head, "span", "cm-type t-secondary", node.type);

  // --- actions ---
  const actions = row(el, "div", "cm-actions");
  const act = (label: string, title: string, cls: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    if (cls) b.className = cls;
    b.addEventListener("click", run);
    actions.append(b);
  };

  act("Run", "Run this node and everything upstream it needs", "primary", () => {
    selected = new Set([id]);
    closeCardMenu();
    void runWorkflow();
  });
  act(
    "Run stages",
    "Run each stage above this one separately, so every stage keeps its own version",
    "",
    () => {
      selected = new Set([id]);
      closeCardMenu();
      void runStages();
    },
  );
  act(node.state === "muted" ? "Unmute" : "Mute", "Bypass this node (M)", "", () => {
    toggleMute([id]);
    paintCardMenu();
  });
  act(node.collapsed ? "Expand" : "Collapse", "Fold the card to its header (C)", "", () => {
    toggleCollapse([id]);
    paintCardMenu();
  });
  act(unfolded.has(id) ? "Fold ports" : "All ports", "Draw every port on the card", "", () => {
    if (unfolded.has(id)) unfolded.delete(id);
    else unfolded.add(id);
    invalidate();
    paintCardMenu();
  });
  act("Focus", "Centre the view on this node (double-click its header)", "", () => {
    focusNode(id);
    closeCardMenu();
  });
  act("Delete", "Remove this node and its wires (⌫)", "danger", () => {
    selected = new Set([id]);
    closeCardMenu();
    deleteSelected();
  });

  // --- versions ---
  const history = historyOf(ledger, id);
  const vbox = section(el, "Versions", history.length);
  if (history.length === 0) {
    row(vbox, "p", "cm-empty", "Nothing recorded yet — Run this node to make a version.");
  } else {
    // Newest first: the one you want is almost always the last one made.
    for (const version of [...history].reverse()) {
      const line = row(vbox, "div", "cm-version");
      if (version.id === latestOf(ledger, id)?.id) line.classList.add("is-latest");
      if (version.state === "retired") line.classList.add("is-retired");

      const thumb = row(line, "span", "cm-thumb");
      if (version.image) thumb.style.backgroundImage = `url("${version.image}")`;

      const label = row(line, "span", "cm-vlabel");
      row(label, "b", "", `v${version.version} · frame ${version.frame}`);
      row(
        label,
        "span",
        "cm-vmeta t-secondary",
        `${version.source} · ${ms(version.elapsedMs)} · ${version.widthPx}×${version.heightPx} · ${
          version.digest.slice(0, 8)
        }`,
      );

      const starBtn = document.createElement("button");
      starBtn.type = "button";
      starBtn.className = version.starred ? "cm-vbtn on" : "cm-vbtn";
      starBtn.textContent = "★";
      // Starring is not decoration: it is what exempts a version from the
      // compaction that otherwise drops old pixels.
      starBtn.title = version.starred
        ? "Starred — kept from compaction"
        : "Star: keep this version";
      starBtn.addEventListener("click", () => {
        ledger = starAsset(ledger, version.id, !version.starred);
        persistLedger();
        paintCardMenu();
      });
      line.append(starBtn);

      if (version.image) {
        const showBtn = document.createElement("button");
        showBtn.type = "button";
        showBtn.className = "cm-vbtn";
        showBtn.textContent = "⤢";
        showBtn.title = "Paint this version back onto the card";
        showBtn.addEventListener("click", () => {
          recordPreview(id, {
            image: version.image!,
            frame: version.frame,
            elapsedMs: version.elapsedMs,
          });
          invalidate();
          toast(`Showing v${version.version} of ${node.name}`);
        });
        line.append(showBtn);
      }

      const dropBtn = document.createElement("button");
      dropBtn.type = "button";
      dropBtn.className = "cm-vbtn";
      dropBtn.textContent = "⊘";
      dropBtn.title = "Retire this version — it stays in the history, out of the way";
      dropBtn.addEventListener("click", () => {
        ledger = retireAsset(ledger, version.id);
        persistLedger();
        paintCardMenu();
      });
      line.append(dropBtn);
    }
  }

  // --- lineage ---
  const current = latestOf(ledger, id);
  const parents = current ? parentsOf(ledger, current.id) : [];
  const children = current ? childrenOf(ledger, current.id) : [];
  const lbox = section(el, "Lineage", parents.length + children.length);
  if (parents.length === 0 && children.length === 0) {
    row(lbox, "p", "cm-empty", "No recorded relations. Run a chain and the links appear here.");
  } else {
    const strip = (label: string, list: readonly AssetVersion[]) => {
      if (list.length === 0) return;
      row(lbox, "p", "cm-empty", label);
      const wrap = row(lbox, "div", "cm-lineage");
      for (const v of list) {
        const other = graph.nodes[v.node];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cm-parent";
        b.textContent = `${other?.name ?? v.node} v${v.version}`;
        b.title = "Jump to the node that produced this";
        b.addEventListener("click", () => {
          selected = new Set([v.node]);
          focusNode(v.node);
          openCardMenuFor(v.node);
        });
        wrap.append(b);
      }
    };
    strip("Derived from", parents);
    strip("Feeds", children);
  }

  // --- stages ---
  //
  // `compileGraph` linearises a run of stages into one engine call, so a chain
  // of five stages produces one asset, not five. That is the right trade for
  // cost — five calls would be five decodes of the same frame — but it would
  // lose the record of what actually happened to the pixels.
  //
  // It does not, because the engine reports it: every call comes back with the
  // ordered list of stages it applied and the parameters each one resolved to.
  // So the per-stage history is read out of the one asset rather than bought
  // with four extra round-trips.
  const stages = (current?.report as { stages?: Array<Record<string, unknown>> } | undefined)
    ?.stages;
  if (Array.isArray(stages) && stages.length > 0) {
    const sbox = section(el, "Stages applied", stages.length);
    const dl = row(sbox, "dl", "cm-info t-secondary");
    for (const stage of stages) {
      const { stage: label, ...rest } = stage as { stage?: string };
      row(dl, "dt", "", String(label ?? "stage"));
      const detail = Object.entries(rest)
        .map(([k, v]) => `${k} ${typeof v === "number" ? Number(v.toFixed(3)) : v}`)
        .join(" · ");
      row(dl, "dd", "", detail || "applied");
    }
  }

  // --- info ---
  const ibox = section(el, "Info");
  const dl = row(ibox, "dl", "cm-info t-secondary");
  const pair = (k: string, v: string) => {
    row(dl, "dt", "", k);
    row(dl, "dd", "", v);
  };
  pair("State", node.state);
  pair("Category", spec?.category ?? "—");
  pair("Position", `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`);
  pair("Ports", `${spec?.inputs.length ?? 0} in · ${spec?.outputs.length ?? 0} out`);
  pair("Revision", String(node.revision));
  if (node.type === "source.sequence" && (projectInfo || graph.projectId)) {
    pair("Reel", projectInfo?.label || graph.projectId || "—");
    pair("Project", projectInfo?.id || graph.projectId || "—");
    if (projectInfo?.frames) pair("Frames", String(projectInfo.frames));
    if (projectInfo?.width && projectInfo.height) {
      pair("Size", `${projectInfo.width}×${projectInfo.height}`);
    }
    if (projectInfo?.format) pair("Format", projectInfo.format);
    if (projectInfo?.fps) pair("Frame rate", `${projectInfo.fps.toFixed(3)} fps`);
    if (projectInfo?.durationS) pair("Duration", `${projectInfo.durationS.toFixed(1)} s`);
  }
  if (current) {
    pair("Latest", `v${current.version} · ${current.digest.slice(0, 12)}`);
    const sharp = (current.report as { metrics?: { sharpness?: number } }).metrics?.sharpness;
    if (typeof sharp === "number") pair("Sharpness", sharp.toFixed(1));
  }
  if (node.error) pair("Error", node.error);

  el.hidden = false;
}

/** Open the menu against the card that owns `id`. */
function openCardMenuFor(id: NodeId): void {
  menuNode = id;
  paintCardMenu();
  const el = $("card-menu");
  const card = document.querySelector<HTMLElement>(`.card[data-node="${id}"]`);
  const box = card?.getBoundingClientRect();
  // Clamp into the viewport. A menu that opens off-screen because its card is
  // near the edge is the same as no menu, and cards near the edge are common.
  const w = el.offsetWidth || 288;
  const h = el.offsetHeight || 320;
  const x = Math.min(globalThis.innerWidth - w - 8, Math.max(8, (box?.right ?? 200) + 8));
  const y = Math.min(globalThis.innerHeight - h - 8, Math.max(8, box?.top ?? 80));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

// ===========================================================================
// The asset ledger
// ===========================================================================
//
// Every result the engine returns is recorded against the node that asked for
// it, with its parameters hashed, its parents linked and its version numbered.
// `core/assets.ts` explains why that is a separate store from `core/lineage.ts`.

let ledger: AssetLedger = emptyLedger();

function ledgerStorageKey(): string {
  return `ars:assets:${graph.projectId ?? "_"}`;
}

function persistLedger(): void {
  try {
    localStorage.setItem(ledgerStorageKey(), serialiseLedger(ledger));
  } catch {
    // Quota, or a private window. The ledger stays live in memory either way;
    // losing the on-disk copy must not lose the session.
  }
}

function loadLedger(): void {
  try {
    const raw = localStorage.getItem(ledgerStorageKey());
    ledger = raw ? deserialiseLedger(raw) : emptyLedger();
  } catch {
    ledger = emptyLedger();
  }
}

/**
 * Versions held per node, for the card badge.
 *
 * Cached on the ledger's revision. The donor's own architecture review flagged
 * exactly this class of number — per-project counts recomputed ad-hoc in the
 * client on every render — as the thing to stop doing, and a card badge is
 * read once per card per frame.
 */
let versionCountCache: { revision: number; counts: Map<NodeId, number> } | null = null;

function versionCounts(): ReadonlyMap<NodeId, number> {
  if (versionCountCache?.revision === ledger.revision) return versionCountCache.counts;
  const counts = new Map<NodeId, number>();
  for (const v of ledger.versions) {
    if (v.state === "retired") continue;
    counts.set(v.node, (counts.get(v.node) ?? 0) + 1);
  }
  versionCountCache = { revision: ledger.revision, counts };
  return counts;
}

/**
 * The version ids feeding a node — the current latest of each upstream node.
 *
 * Resolved at record time rather than stored on the edge, because an edge is a
 * wiring decision and a parent is a fact about one particular result.
 */
function upstreamVersionIds(node: NodeId): string[] {
  const adjacency = buildAdjacency(graph);
  const parents: string[] = [];
  for (const edge of adjacency.incoming.get(node) ?? []) {
    const v = latestOf(ledger, edge.from.node);
    if (v) parents.push(v.id);
  }
  return parents;
}

/** Record one engine result. Called once per completed step of a run. */
function recordAssetVersion(
  node: NodeId,
  response: {
    image?: string;
    width?: number;
    height?: number;
    elapsed_ms?: number;
    report?: Record<string, unknown>;
  },
  frame: number,
): void {
  const instance = graph.nodes[node];
  if (!instance) return;
  const spec = REGISTRY.get(instance.type);
  const previous = latestOf(ledger, node);
  const upstream = upstreamVersionIds(node);
  ledger = recordAsset(ledger, {
    node,
    frame,
    // A stage derives from its input; a source is read off disk. Nothing here
    // reaches the network, so "generated" is never recorded by this path —
    // network steps are held back before they run.
    source: spec?.category === "source" ? "imported" : "remixed",
    params: instance.values,
    ...(response.elapsed_ms !== undefined ? { elapsedMs: response.elapsed_ms } : {}),
    ...(response.width !== undefined ? { widthPx: response.width } : {}),
    ...(response.height !== undefined ? { heightPx: response.height } : {}),
    ...(response.image ? { image: response.image } : {}),
    report: response.report ?? {},
    parents: upstream,
  });
  persistLedger();
  const latest = latestOf(ledger, node);
  if (latest && latest.id !== previous?.id && consoleUi) {
    consoleUi.record({
      versionId: latest.id,
      node,
      nodeType: instance.type,
      nodeName: instance.name,
      source: latest.source,
      frame,
      params: instance.values,
      upstream,
      previous: previous?.id ?? null,
      ...(response.elapsed_ms !== undefined ? { elapsedMs: response.elapsed_ms } : {}),
      ...(response.width !== undefined ? { widthPx: response.width } : {}),
      ...(response.height !== undefined ? { heightPx: response.height } : {}),
    });
  }
}

// ===========================================================================
// Run — execute the selected workflow
// ===========================================================================
//
// `This frame` compiles finished local chains and paints what they produce.
// `Run` takes the *selection* as the set of results you asked for, and runs
// exactly what is needed to produce them.
//
// The difference matters on a big graph. This frame used to be all-or-nothing:
// one node with an unsatisfied input made the whole compile unrunnable, so a
// graph with a half-built branch could not be previewed at all. It now compiles
// each finished stage chain on its own. Run still scopes to the selection.

/** Is a run in flight? Guards the button and the keyboard path alike. */
let running: AbortController | null = null;

/**
 * The selection, plus everything upstream it needs.
 *
 * Selecting a Deflicker and pressing Run must run the Video and Stabilisation
 * feeding it; nobody selects a chain from its source every time. Ancestors are
 * pulled in silently. Descendants are not: they are what you chose *not* to
 * ask for, and running them would make Run mean the same as Preview.
 */
function upstreamClosure(seeds: Iterable<NodeId>): Set<NodeId> {
  const adjacency = buildAdjacency(graph);
  const wanted = new Set<NodeId>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (wanted.has(id)) continue;
    wanted.add(id);
    for (const edge of adjacency.incoming.get(id) ?? []) queue.push(edge.from.node);
  }
  return wanted;
}

/**
 * A graph holding only `keep`, and only the edges with both ends inside it.
 *
 * Dropping half-edges rather than keeping them is what lets the compiler treat
 * the result as a whole document: an edge whose source is missing would read
 * as a wire from nowhere, and the diagnostics for that are worse than the
 * honest "this input has no source" the missing wire produces.
 */
function subGraph(keep: ReadonlySet<NodeId>): GraphDocument {
  const nodes: Record<string, NodeInstance> = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (keep.has(asNodeId(id))) nodes[id] = node;
  }
  const edges: Record<string, typeof graph.edges[string]> = {};
  for (const [id, edge] of Object.entries(graph.edges)) {
    if (keep.has(edge.from.node) && keep.has(edge.to.node)) edges[id] = edge;
  }
  // A stack survives when any of its member nodes did. Membership lives on the
  // node (`node.stack.id`), not on the stack, so this reads the kept nodes
  // rather than the stack list — a stack whose whole body fell outside the
  // selection has nothing left to iterate and would only widen the compile.
  const live = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.stack) live.add(node.stack.id);
  }
  const stacks: Record<string, StackInstance> = {};
  for (const [id, stack] of Object.entries(graph.stacks)) {
    if (live.has(id)) stacks[id] = stack;
  }
  return { ...graph, nodes, edges, stacks };
}

/** Paint one lifecycle state across a set of nodes, without touching undo. */
function markState(ids: Iterable<NodeId>, state: NodeInstance["state"]): void {
  let next = graph;
  for (const id of ids) {
    if (!next.nodes[id]) continue;
    next = updateNode(next, id, { state });
  }
  if (next !== graph) commit(next, false);
}

/**
 * Run the selected workflow.
 *
 * With nothing selected this is the whole graph, which is the reading that
 * makes an empty selection mean "everything" rather than an error — pressing
 * Run on a fresh canvas should do the obvious thing.
 */
/**
 * One pass: compile a scope, run its engine steps, record what came back.
 *
 * Split out of `runWorkflow` because the stage-by-stage run is the same pass
 * repeated with a narrower scope each time, and a second copy of the recording
 * and failure handling would be a second place for them to drift.
 *
 * Returns what happened rather than reporting it, so the caller can summarise
 * one pass or twelve in a single sentence.
 */
async function runPass(
  seeds: Iterable<NodeId>,
  signal: AbortSignal,
): Promise<{
  done: number;
  failed: number;
  scope: number;
  network: number;
  /** Present when the scope could not compile; the message names why. */
  refusal?: string;
  /** The node the refusal is about, so the caller can point at it. */
  at?: NodeId;
}> {
  const scope = upstreamClosure(seeds);
  const plan = compileGraph(subGraph(scope), REGISTRY, currentFrame);

  if (!plan.runnable) {
    const first = plan.diagnostics.find((d) => d.severity === "error");
    return {
      done: 0,
      failed: 0,
      scope: scope.size,
      network: 0,
      refusal: first?.message ?? "the chain has an unsatisfied input",
      ...(first?.node ? { at: first.node } : {}),
    };
  }

  const steps = plan.steps.filter((s) => s.kind === "preview");
  if (steps.length === 0) {
    return { done: 0, failed: 0, scope: scope.size, network: plan.networkSteps };
  }

  markState(steps.map((s) => s.node), "evaluating");
  paintQueue(steps.map((s) => s.node));

  let done = 0;
  let failed = 0;

  // Sequential rather than parallel, deliberately. The engine's own thread
  // pool is already using the cores; firing every step at once only makes the
  // queue long, which is what makes a Stop take a visible moment to land. One
  // in flight keeps Stop instant.
  for (const [index, step] of steps.entries()) {
    if (signal.aborted) break;
    try {
      const response = await engine.preview(graph.projectId!, step.frame, step.params);
      recordPreview(step.node, {
        frame: step.frame,
        image: response.image,
        elapsedMs: response.elapsed_ms ?? 0,
      });
      markState([step.node], "fresh");
      recordAssetVersion(step.node, response, step.frame);
      done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      commit(updateNode(graph, step.node, { state: "failed", error: message }), false);
      failed += 1;
    }
    clearQueue();
    paintQueue(steps.slice(index + 1).map((s) => s.node));
    invalidate();
  }

  // Whatever finished is kept. A cancelled run that threw away its completed
  // work would make Stop cost more than waiting.
  if (signal.aborted) markState(steps.slice(done + failed).map((s) => s.node), "idle");

  return { done, failed, scope: scope.size, network: plan.networkSteps };
}

/** Put the Run button into, or out of, its running state. */
function runButton(active: boolean): void {
  const button = $<HTMLButtonElement>("btn-run");
  const label = button.querySelector(".run-label");
  if (label) label.textContent = active ? "Stop" : "Run";
  else button.textContent = active ? "Stop" : "Run";
  button.classList.toggle("is-running", active);
  if (active) {
    const cost = document.getElementById("run-cost");
    if (cost) cost.hidden = true;
  } else {
    syncRunCost();
  }
}

function showRunCost(): boolean {
  return localStorage.getItem("ars:show-run-cost") !== "0";
}

function setShowRunCost(on: boolean): void {
  localStorage.setItem("ars:show-run-cost", on ? "1" : "0");
  const box = document.getElementById("set-show-run-cost") as HTMLInputElement | null;
  if (box) box.checked = on;
  syncRunCost();
}

function runSeeds(): NodeId[] {
  if (selected.size > 0) return [...selected];
  return Object.keys(graph.nodes).map((id) => asNodeId(id));
}

function plannedCallsForRun(): PlannedCall[] {
  const scope = upstreamClosure(runSeeds());
  const calls: PlannedCall[] = [];
  for (const id of scope) {
    const node = graph.nodes[id];
    if (!node) continue;
    const spec = REGISTRY.get(node.type);
    if (!spec || spec.cost !== "network") continue;
    const modelVal = node.values[asPortId("model")];
    const modelId = modelVal && modelVal.kind === "Enum" ? String(modelVal.value) : "";
    if (!modelId) continue;
    calls.push({ modelId, nodeId: id, count: 1 });
  }
  return calls;
}

function syncRunCost(): void {
  const el = document.getElementById("run-cost");
  if (!el) return;
  if (running || !showRunCost() || !graph.projectId) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const seeds = runSeeds();
  if (seeds.length === 0) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const scope = upstreamClosure(seeds);
  let local = 0;
  for (const id of scope) {
    const node = graph.nodes[id];
    const spec = node ? REGISTRY.get(node.type) : null;
    if (spec?.engineStage) local += 1;
  }
  const estimate = estimateRun(plannedCallsForRun());
  let text = "";
  if (estimate.billedCalls > 0) text = formatCost(estimate.cents);
  else if (local > 0) text = `${local} local`;
  else if (estimate.localCalls > 0) text = "free";
  el.textContent = text;
  el.hidden = !text;
}

/**
 * Run the selected workflow.
 *
 * With nothing selected this is the whole canvas. A selection runs that group
 * plus everything upstream it needs.
 */
async function runWorkflow(): Promise<void> {
  if (running) {
    running.abort();
    return;
  }
  if (!graph.projectId) {
    toast("Pick a project first — there is no footage bound to this blueprint.", true);
    return;
  }

  const seeds = runSeeds();
  if (seeds.length === 0) {
    toast("Nothing to run — the canvas is empty.");
    return;
  }
  if (consoleUi && !(await consoleUi.confirmBeforeRun(seeds))) return;
  if (running) return; // a second Run started while the dialog was open

  running = new AbortController();
  const signal = running.signal;
  runButton(true);
  const started = performance.now();

  try {
    const result = await runPass(seeds, signal);
    const elapsed = Math.round(performance.now() - started);

    if (result.refusal) {
      toast(`Cannot run: ${result.refusal}`, true);
      // Show the reason where the reason is, rather than only in a toast.
      if (result.at) focusNode(result.at);
    } else if (result.done + result.failed === 0) {
      toast("Nothing to run: no restoration stages are wired to a source in the selection.");
    } else if (signal.aborted) {
      toast(`Stopped after ${result.done} step(s) · ${elapsed} ms`);
    } else if (result.failed > 0) {
      toast(
        `${result.done} step(s) ran, ${result.failed} failed in ${elapsed} ms — see the red cards.`,
        true,
      );
    } else {
      persistCompiledParams();
      toast(
        `Ran ${result.done} step(s) over ${result.scope} node(s) in ${elapsed} ms` +
          (result.network > 0
            ? ` · ${result.network} network step(s) held back — those cost money`
            : ""),
      );
    }
  } finally {
    running = null;
    runButton(false);
    clearQueue();
    invalidate();
  }
}

/**
 * Run the selection one stage at a time, so every stage keeps its own asset.
 *
 * `compileGraph` linearises: five stages in a row become one engine call and
 * therefore one recorded result. That is the right default — five calls would
 * be five decodes of the same frame — but it means the ledger holds the end of
 * a chain and not its middle, and "compare the frame before and after
 * deflicker" has nothing to compare.
 *
 * This buys that back at its real price: one call per stage, run in dependency
 * order so each stage's version records the one before it as its parent. The
 * cost is stated in the toast and in the confirm, because on a long chain it
 * is the difference between one round-trip and a dozen.
 */
async function runStages(): Promise<void> {
  if (running) {
    running.abort();
    return;
  }
  if (!graph.projectId) {
    toast("Pick a project first — there is no footage bound to this blueprint.", true);
    return;
  }

  const seeds = runSeeds();
  const scope = upstreamClosure(seeds);

  // Only nodes the engine actually computes are worth a pass of their own. A
  // source has nothing to run, and a Viewer shows what the stage above made.
  const ordered = topologicalOrder(scope).filter((id) => {
    const node = graph.nodes[id];
    return node ? REGISTRY.get(node.type)?.engineStage != null : false;
  });

  if (ordered.length === 0) {
    toast("No restoration stages in the selection — nothing to record per stage.");
    return;
  }
  if (ordered.length === 1) {
    // One stage costs the same either way, so do not make them confirm.
    await runWorkflow();
    return;
  }
  toast(
    `Stage by stage: ${ordered.length} engine calls instead of 1, one recorded version each.`,
  );
  if (consoleUi && !(await consoleUi.confirmBeforeRun(seeds))) return;
  if (running) return;

  running = new AbortController();
  const signal = running.signal;
  runButton(true);
  const started = performance.now();
  let done = 0;
  let failed = 0;

  try {
    for (const id of ordered) {
      if (signal.aborted) break;
      const result = await runPass([id], signal);
      done += result.done;
      failed += result.failed;
    }
    const elapsed = Math.round(performance.now() - started);
    if (signal.aborted) {
      toast(`Stopped after ${done} of ${ordered.length} stage(s) · ${elapsed} ms`);
    } else if (failed > 0) {
      toast(`${done} stage(s) recorded, ${failed} failed in ${elapsed} ms.`, true);
    } else {
      persistCompiledParams();
      toast(
        `Recorded ${done} stage(s) in ${elapsed} ms — each version links to the one before it.`,
      );
    }
  } finally {
    running = null;
    runButton(false);
    clearQueue();
    invalidate();
  }
}

/**
 * The nodes of `scope` in dependency order.
 *
 * Kahn's algorithm over the induced subgraph. A cycle cannot reach here — the
 * compiler refuses one with an error naming the Z stack as the alternative —
 * but anything left unvisited is appended rather than dropped, because
 * silently omitting a node from a run is worse than running it out of order.
 */
function topologicalOrder(scope: ReadonlySet<NodeId>): NodeId[] {
  const adjacency = buildAdjacency(graph);
  const indegree = new Map<NodeId, number>();
  for (const id of scope) {
    const incoming = (adjacency.incoming.get(id) ?? []).filter((e) => scope.has(e.from.node));
    indegree.set(id, incoming.length);
  }

  const queue = [...scope].filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: NodeId[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const edge of adjacency.outgoing.get(id) ?? []) {
      if (!scope.has(edge.to.node)) continue;
      const left = (indegree.get(edge.to.node) ?? 1) - 1;
      indegree.set(edge.to.node, left);
      if (left === 0) queue.push(edge.to.node);
    }
  }
  for (const id of scope) if (!order.includes(id)) order.push(id);
  return order;
}

/** Number the pending cards so a queue reads as an order, not a crowd. */
function paintQueue(ids: readonly NodeId[]): void {
  ids.forEach((id, i) => {
    const card = document.querySelector<HTMLElement>(`.card[data-node="${id}"]`);
    if (!card || card.querySelector(".card-queue")) return;
    const badge = document.createElement("span");
    badge.className = "card-queue";
    badge.textContent = String(i + 1);
    card.append(badge);
  });
}

function clearQueue(): void {
  for (const badge of document.querySelectorAll(".card-queue")) badge.remove();
}

// ===========================================================================
// The Z axis
// ===========================================================================

/**
 * Evaluate every slice of the selected stack.
 *
 * This is the loop the whole 2.5D model exists for: the body of the stack is
 * run once per frame of its range, and the results fill the depth strip — so
 * the carousel shows the *restoration* across the range rather than the source
 * frames. A second click cancels rather than queueing a second run.
 */
async function runStack(stackNode: NodeId): Promise<void> {
  if (stackRun) {
    stackRun.abort();
    stackRun = null;
    toast("Stack evaluation cancelled.");
    return;
  }
  if (!graph.projectId) {
    toast("Pick a project first.", true);
    return;
  }

  const scope = resolveStackScope(graph, stackNode);
  if (scope.problem) {
    toast(scope.problem, true);
    return;
  }

  const node = graph.nodes[stackNode]!;
  const stride = (node.values.stride as { value?: number } | undefined)?.value ?? 1;
  const { frames, truncated } = stackFrames({
    start: currentFrame,
    count: consoleUi?.overrideFor(stackNode) ?? 0,
    stride,
    available: sequenceLength,
    limit: 240,
  });
  if (frames.length === 0) {
    toast("That range contains no frames.", true);
    return;
  }

  if (consoleUi && !(await consoleUi.confirmBeforeRun([stackNode, ...scope.body, ...scope.closes]))) {
    return;
  }
  if (stackRun) return;

  stackRun = new AbortController();
  const progress = showStackProgress(frames.length);

  try {
    const result = await evaluateStack(
      graph,
      REGISTRY,
      engine,
      stackNode,
      frames,
      {
        signal: stackRun.signal,
        onProgress: (p: StackRunProgress) => progress.update(p),
      },
    );

    // The strip shows the last picture each slice produced.
    stackSlices = result.slices
      .map((slice) => {
        const output = [...slice.outputs.values()].at(-1);
        return output ? { frame: slice.frame, image: output.image } : null;
      })
      .filter((s): s is { frame: number; image: string } => s !== null);

    // Card previews go on the nodes that actually produced them.
    //
    // Keying this off the body's last *node* would be wrong: a Collect emits
    // no engine call, so the picture would be pinned to a card that did not
    // make it, and the stage that did would stay blank.
    const firstSlice = result.slices.find((s) => s.outputs.size > 0);
    if (firstSlice) {
      for (const [producer, output] of firstSlice.outputs) {
        recordPreview(producer, { ...output, frame: firstSlice.frame });
      }
    }

    // A new run starts at its own first slice. Carrying the previous focus
    // over lands the carousel in the middle of a range it has never shown.
    carouselFocus = 0;

    const failed = result.slices.filter((s) => s.error).length;
    toast(
      `${result.slices.length} slice${result.slices.length === 1 ? "" : "s"} in ${
        (result.elapsedMs / 1000).toFixed(1)
      }s` +
        (failed > 0 ? ` · ${failed} failed` : "") +
        (truncated > 0 ? ` · ${truncated} beyond the ${240}-slice cap were not run` : "") +
        (result.cancelled ? " · cancelled" : ""),
      failed > 0,
    );
    drawStackStrip();
  } catch (error) {
    toast(`Stack run failed: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    stackRun = null;
    progress.remove();
    invalidate();
  }
}

/** A progress row in the inspector, removed when the run ends. */
function showStackProgress(
  total: number,
): { update: (p: StackRunProgress) => void; remove: () => void } {
  const row = document.createElement("div");
  row.className = "stack-run t-primary";
  row.innerHTML = `<span class="t-secondary">0/${total}</span>` +
    `<span class="stack-bar"><i style="width:0%"></i></span>`;
  const label = row.querySelector("span")!;
  const bar = row.querySelector<HTMLElement>(".stack-bar > i")!;
  $("inspect-body").append(row);
  return {
    update: (p) => {
      label.textContent = `${p.done}/${p.total}` + (p.failures ? ` · ${p.failures} failed` : "");
      bar.style.width = `${Math.round((p.done / Math.max(1, p.total)) * 100)}%`;
    },
    remove: () => row.remove(),
  };
}

/** Draw the depth strip from a completed stack run rather than from the engine. */
function drawStackStrip(): void {
  if (stackSlices.length === 0) return;
  // Clamp before anything reads it: `relative_depth` below is computed from
  // the focus, so clamping afterwards would label every slice against an index
  // the strip never used.
  carouselFocus = Math.max(0, Math.min(carouselFocus, stackSlices.length - 1));
  const host = $("carousel-strip");

  const build: StackBuild = {
    project_id: graph.projectId ?? "",
    focus_frame: stackSlices[0]!.frame,
    sheet_path: "",
    sheet_width: 0,
    sheet_height: 0,
    slices: stackSlices.map((s, i) => ({
      frame: s.frame,
      relative_depth: i - carouselFocus,
      sheet_x: 0,
      sheet_y: 0,
      sheet_w: 176,
      sheet_h: 132,
      luminance: 0,
      sharpness: 0,
      score: -1,
      verdict: "",
    })),
  };
  carouselBuild = build;
  renderCarouselFromImages(host, stackSlices, carouselFocus, depthWrap());
  $("carousel-label").textContent = `${stackSlices.length} restored slices · frame ${
    stackSlices[carouselFocus]?.frame ?? 0
  }`;
}

// ===========================================================================
// Depth carousel
// ===========================================================================

async function loadCarousel(): Promise<void> {
  if (!graph.projectId) {
    $("carousel-label").textContent = "bind a project";
    return;
  }
  if (sequenceLength <= 0) {
    $("carousel-label").textContent = "no frames yet";
    return;
  }
  const depth = 6;
  const url = `/api/zstack/${encodeURIComponent(graph.projectId)}` +
    `?focus=${currentFrame}&stride=1&depth=${depth}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(await response.text());
    carouselBuild = await response.json() as StackBuild;
    carouselFocus = carouselBuild.slices.findIndex((s) => s.relative_depth === 0);
    if (carouselFocus < 0) carouselFocus = Math.floor(carouselBuild.slices.length / 2);
    drawCarousel();
  } catch {
    $("carousel-label").textContent = "depth unavailable";
  }
}

function drawCarousel(): void {
  if (!carouselBuild || !graph.projectId) return;
  const sheetUrl = `/api/zstack/${encodeURIComponent(graph.projectId)}/sheet` +
    `?focus=${currentFrame}&stride=1&depth=6`;
  renderCarousel($("carousel-strip"), carouselBuild, sheetUrl, carouselFocus, depthWrap());

  const slice = carouselBuild.slices[carouselFocus];
  $("carousel-label").textContent = slice
    ? `frame ${slice.frame}` +
      (slice.score >= 0 ? ` · score ${slice.score.toFixed(1)} · ${slice.verdict}` : " · unmeasured")
    : "";
}

function depthWrap(): boolean {
  const box = document.getElementById("var-loop") as HTMLInputElement | null;
  if (box) return box.checked;
  return Object.values(graph.stacks).some((s) => s.wrap);
}

function rollCarousel(delta: number): void {
  const count = stackSlices.length > 0 ? stackSlices.length : carouselBuild?.slices.length ?? 0;
  if (count === 0) return;
  carouselFocus =
    rollFocus({ sliceCount: count, focusIndex: carouselFocus, wrap: depthWrap() }, delta)
      .focusIndex;
  if (stackSlices.length > 0) drawStackStrip();
  else drawCarousel();
}

// ===========================================================================
// A starter graph
// ===========================================================================

/**
 * Seed the canvas with a working restoration chain.
 *
 * An empty canvas is a worse first impression than a wrong one: the user has
 * to guess both what the nodes are and how they connect. This builds the
 * chain the engine's own README recommends — stabilise first, because every
 * temporal stage compares neighbouring frames and gets sharply better once the
 * frames are aligned — so the first thing on screen is also correct advice.
 */
async function seedGraph(): Promise<void> {
  const fromUrl = new URLSearchParams(location.search).get("project");
  const saved = (await readStoredGraph(fromUrl)) ??
    (fromUrl ? null : await readStoredGraph(null));
  if (saved && Object.keys(saved.nodes).length > 0) {
    graph = saved;
    return;
  }
  if (fromUrl) {
    graph = { ...emptyGraph(asGraphId("g1")), projectId: fromUrl };
    return;
  }
  const place = (type: string, x: number, y: number): NodeId => {
    const spec = REGISTRY.require(type as never);
    const id = unusedNodeId();
    const inputs = visiblePortCount(spec.inputs);
    const media = cardShowsMedia(spec) ? spec.size.w : 0;
    graph = addNode(graph, {
      id,
      type: spec.id,
      name: spec.label,
      position: snapPoint(vec2(x, y)),
      size: { w: spec.size.w, h: cardHeight(inputs, spec.outputs.length, true, media) },
      values: {},
      authoredBy: {},
      state: "idle",
      revision: 0,
      collapsed: false,
    });
    return id;
  };

  const wire = (from: NodeId, fromPort: string, to: NodeId, toPort: string): void => {
    const result = connect(
      graph,
      { node: from, port: asPortId(fromPort) },
      { node: to, port: asPortId(toPort) },
      (n, p, d) => {
        const node = graph.nodes[n];
        return node ? REGISTRY.port(node.type, p, d) : null;
      },
    );
    if ("edge" in result) graph = result.graph;
  };

  const source = place("source.sequence", 40, 150);
  const pick = place("source.frame", 330, 176);
  const stabilise = place("stage.stabilize", 590, 60);
  const deflicker = place("stage.deflicker", 880, 96);
  const clahe = place("stage.clahe", 1150, 128);
  const view = place("out.view", 1420, 150);

  wire(source, "sequence", pick, "sequence");
  wire(pick, "image", stabilise, "image");
  wire(source, "sequence", stabilise, "neighbours");
  wire(stabilise, "image", deflicker, "image");
  wire(source, "sequence", deflicker, "neighbours");
  wire(deflicker, "image", clahe, "image");
  wire(clahe, "image", view, "image");
  wire(pick, "image", view, "compare");
}

function visiblePortCount(ports: readonly PortSpec[]): number {
  const structural = new Set(["image", "sequence", "neighbours", "mask", "a", "b", "base", "over", "index"]);
  return Math.min(7, ports.filter((p) => structural.has(p.id)).length);
}

// ===========================================================================
// Toast
// ===========================================================================

let toastTimer = 0;
function toast(message: string, bad = false): void {
  const el = $("toast");
  el.textContent = message;
  el.className = bad ? "t-primary bad" : "t-primary";
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), bad ? 6000 : 3600);
}

// ===========================================================================
// Wiring the chrome
// ===========================================================================

consoleUi = mountConsole({
  graph: () => graph,
  registry: REGISTRY,
  seeds: runSeeds,
  sequenceLength: () => sequenceLength,
  lastRun: (node) => {
    const latest = latestOf(ledger, node);
    return latest ? { elapsedMs: latest.elapsedMs, versions: historyOf(ledger, node).length } : null;
  },
  focusNode,
  toast,
});

$<HTMLInputElement>("palette-search").addEventListener("input", renderPalette);
renderPalette();
document.getElementById("filter-input")?.addEventListener("input", (e) => {
  filterText = (e.target as HTMLInputElement).value;
  invalidate();
});
document.getElementById("project-caret")?.addEventListener("click", (event) => {
  event.preventDefault();
  const ctl = document.getElementById("project-ctl");
  setProjectMenuOpen(!ctl?.classList.contains("is-open"));
});
document.getElementById("project-name")?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  (event.target as HTMLInputElement).blur();
});
document.getElementById("project-name")?.addEventListener("blur", (event) => {
  void renameCurrentProject((event.target as HTMLInputElement).value);
});
document.getElementById("project-switch")?.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  const action = t.closest("[data-switch]")?.getAttribute("data-switch");
  if (!action && t.id !== "project-switch") return;
  const dlg = document.getElementById("project-switch");
  const nextId = pendingSwitchId;
  pendingSwitchId = null;
  if (dlg) dlg.hidden = true;
  if (action === "save" && nextId !== null) {
    void (async () => {
      await flushGraph();
      await bindProject(nextId);
    })();
  } else if (action === "discard" && nextId !== null) {
    void (async () => {
      await revertLoadedGraph();
      await bindProject(nextId);
    })();
  } else {
    syncProjectChrome();
  }
});
$("btn-run").addEventListener("click", () => void runWorkflow());

// --- library tabs, files, flows --------------------------------------------

for (const tab of document.querySelectorAll<HTMLElement>(".lib-tab")) {
  tab.addEventListener("click", () => showLibTab(tab.dataset.lib as LibTab));
}

// --- the reference shelves --------------------------------------------------

for (const button of document.querySelectorAll<HTMLElement>(".ref-kind")) {
  button.addEventListener("click", () => {
    refKind = button.dataset.kind as ReferenceCard["kind"];
    for (const other of document.querySelectorAll<HTMLElement>(".ref-kind")) {
      const on = other === button;
      other.classList.toggle("is-on", on);
      other.setAttribute("aria-selected", String(on));
    }
    renderReferences();
  });
}

$("refs-search").addEventListener("input", (event) => {
  refSearch = (event.target as HTMLInputElement).value;
  renderReferences();
});

$("refs-reload").addEventListener("click", () => void loadReferences(true));

// Click places the card in the middle of the view; drag places it where it
// lands. Both exist because the grid is browsed with one hand — clicking
// through a shelf to try things is a different gesture from composing a graph.
$("refs-list").addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".ref-card");
  if (!card?.dataset.ref) return;
  placeReference(card.dataset.ref, toWorld(innerWidth / 2, innerHeight / 2));
});

$("refs-list").addEventListener("dragstart", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".ref-card");
  if (!card?.dataset.ref || !event.dataTransfer) return;
  // Its own MIME type, for the same reason the Files tab has one: the canvas
  // drop handler must be able to tell a reference from a node type without
  // guessing at the shape of a string.
  event.dataTransfer.setData("application/x-ars-ref", card.dataset.ref);
  event.dataTransfer.effectAllowed = "copy";
});

$("files-up").addEventListener("click", () => {
  if (!filesPath) {
    toast("Already at the top of the browsable root.");
    return;
  }
  const up = filesPath.split("/").slice(0, -1).join("/");
  void loadFolder(up);
});

$("files-filter").addEventListener("input", (event) => {
  filesFilter = (event.target as HTMLInputElement).value;
  renderFiles();
});

$("files-list").addEventListener("click", (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>(".fs-row");
  if (!row?.dataset.path) return;
  if (row.dataset.kind === "dir") {
    filesFilter = "";
    $<HTMLInputElement>("files-filter").value = "";
    void loadFolder(row.dataset.path);
  } else if (row.dataset.media === "1") {
    void openReel(row.dataset.path);
  }
});

$("flow-save").addEventListener("click", () => void saveCurrentFlow());
$("flow-refresh").addEventListener("click", () => void loadFlows());
$("flows-list").addEventListener("click", (event) => {
  const open = (event.target as HTMLElement).closest<HTMLElement>(".flow-open");
  if (open?.dataset.flow) void loadFlow(open.dataset.flow);
});
$("btn-fit").addEventListener("click", fitAll);
document.getElementById("btn-export")?.addEventListener("click", (e) => {
  e.preventDefault();
  requestExport();
  setSettingsOpen(false);
});
document.getElementById("btn-open")?.addEventListener("click", () => {
  requestOpen();
  setSettingsOpen(false);
});
$("roll-back").addEventListener("click", () => rollCarousel(-1));
$("roll-fwd").addEventListener("click", () => rollCarousel(1));

const loopEl = document.getElementById("var-loop") as HTMLInputElement | null;
const autoEl = document.getElementById("var-auto") as HTMLInputElement | null;
if (autoEl) {
  autoPreview = localStorage.getItem("ars:auto-preview") === "1";
  autoEl.checked = autoPreview;
  autoEl.addEventListener("change", () => {
    autoPreview = autoEl.checked;
    localStorage.setItem("ars:auto-preview", autoPreview ? "1" : "0");
    if (autoPreview) scheduleAutoPreview();
  });
}
setAutosaveOnSwitch(autosaveOnSwitch());
setShowRunCost(showRunCost());
for (const id of ["var-autosave-switch", "set-autosave-switch"]) {
  document.getElementById(id)?.addEventListener("change", (event) => {
    setAutosaveOnSwitch((event.target as HTMLInputElement).checked);
  });
}
document.getElementById("set-show-run-cost")?.addEventListener("change", (event) => {
  setShowRunCost((event.target as HTMLInputElement).checked);
});
if (loopEl) {
  loopEl.addEventListener("change", () => setDepthWrap(loopEl.checked));
}

function setDepthWrap(wrap: boolean): void {
  if (loopEl && loopEl.checked !== wrap) loopEl.checked = wrap;
  localStorage.setItem("ars:loop-depth", wrap ? "1" : "0");
  const stacks: Record<string, StackInstance> = { ...graph.stacks };
  let changed = false;
  for (const [id, stack] of Object.entries(stacks)) {
    if (stack.wrap === wrap) continue;
    stacks[id] = { ...stack, wrap };
    changed = true;
  }
  if (changed) commit({ ...graph, stacks, revision: graph.revision + 1 });
  lastGradeStepSig = "";
  if (stackSlices.length > 0) drawStackStrip();
  else drawCarousel();
  syncGradeToCanvas();
}

type WorkflowVar = { name: string; value: string };

function varsStorageKey(): string {
  return `ars:vars:${graph.projectId || "_"}`;
}

function readWorkflowVars(): WorkflowVar[] {
  try {
    const raw = localStorage.getItem(varsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkflowVar[];
    return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v.name === "string") : [];
  } catch {
    return [];
  }
}

function writeWorkflowVars(list: WorkflowVar[]): void {
  try {
    localStorage.setItem(varsStorageKey(), JSON.stringify(list));
  } catch { /* */ }
}

function renderWorkflowVars(): void {
  const host = document.getElementById("var-list");
  if (!host) return;
  const list = readWorkflowVars();
  host.replaceChildren();
  for (let i = 0; i < list.length; i++) {
    const row = document.createElement("div");
    row.className = "var-item";
    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = "name";
    name.value = list[i]!.name;
    const value = document.createElement("input");
    value.type = "text";
    value.placeholder = "value";
    value.value = list[i]!.value;
    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "action t-primary var-x";
    drop.textContent = "✕";
    const commitRow = () => {
      const next = readWorkflowVars();
      next[i] = { name: name.value.trim(), value: value.value };
      writeWorkflowVars(next.filter((v) => v.name || v.value));
      renderWorkflowVars();
    };
    name.addEventListener("change", commitRow);
    value.addEventListener("change", commitRow);
    drop.addEventListener("click", () => {
      writeWorkflowVars(readWorkflowVars().filter((_, j) => j !== i));
      renderWorkflowVars();
    });
    row.append(name, value, drop);
    host.append(row);
  }
}

function harvestWorkflowVars(): void {
  const next: WorkflowVar[] = [];
  for (const node of Object.values(graph.nodes)) {
    for (const [port, raw] of Object.entries(node.values)) {
      if (!raw || typeof raw !== "object") continue;
      const kind = (raw as { kind?: string }).kind;
      if (kind === "Image" || kind === "Mask" || kind === "Flow" || kind === "Sequence") continue;
      next.push({
        name: `${node.name || node.type}.${port}`,
        value: describeValue(raw as { kind: string; [k: string]: unknown }),
      });
    }
  }
  writeWorkflowVars(next);
  renderWorkflowVars();
}

function applyWorkflowVars(): void {
  let next = graph;
  let applied = 0;
  for (const row of readWorkflowVars()) {
    const cut = row.name.lastIndexOf(".");
    if (cut <= 0) continue;
    const who = row.name.slice(0, cut);
    const port = row.name.slice(cut + 1);
    const node = Object.values(next.nodes).find((n) => n.name === who || n.type === who);
    if (!node) continue;
    const spec = REGISTRY.get(node.type);
    const p = spec?.inputs.find((input) => input.id === port);
    if (!p) continue;
    let value: SignalValue | null = null;
    if (p.kind === "Number") {
      const n = Number(row.value);
      if (!Number.isFinite(n)) continue;
      value = { kind: "Number", value: p.range ? clampToRange(n, p.range) : n };
    } else if (p.kind === "Flag") {
      value = {
        kind: "Flag",
        value: row.value === "on" || row.value === "true" || row.value === "1",
      };
    } else if (p.kind === "Enum") {
      value = { kind: "Enum", value: row.value };
    } else if (p.kind === "Text") {
      value = { kind: "Text", value: row.value };
    }
    if (!value) continue;
    next = updateNode(next, node.id, {
      values: { ...next.nodes[node.id]!.values, [port]: value },
      authoredBy: { ...next.nodes[node.id]!.authoredBy, [port]: "user" },
    });
    applied += 1;
  }
  if (next !== graph) commit(next);
  toast(
    applied
      ? `Applied ${applied} variable${applied === 1 ? "" : "s"} to the graph.`
      : "No matching node ports.",
    !applied,
  );
}

document.getElementById("var-add")?.addEventListener("click", () => {
  writeWorkflowVars([...readWorkflowVars(), { name: "", value: "" }]);
  renderWorkflowVars();
});
document.getElementById("var-harvest")?.addEventListener("click", harvestWorkflowVars);
document.getElementById("var-apply")?.addEventListener("click", applyWorkflowVars);

if (loopEl) {
  loopEl.checked = localStorage.getItem("ars:loop-depth") !== "0";
}
renderWorkflowVars();

$("carousel-strip").addEventListener("click", (event) => {
  const slice = (event.target as HTMLElement).closest<HTMLElement>(".slice");
  if (!slice?.dataset.frame) return;
  currentFrame = Number(slice.dataset.frame);
  const frameInput = document.getElementById("frame-input") as HTMLInputElement | null;
  if (frameInput) frameInput.value = String(currentFrame);
  recompile();
  // A strip showing a completed stack run is already the right pictures; only
  // the engine-backed strip needs refetching when the focus frame moves.
  if (stackSlices.length > 0) {
    carouselFocus = stackSlices.findIndex((s) => s.frame === currentFrame);
    if (carouselFocus < 0) carouselFocus = 0;
    drawStackStrip();
  } else {
    void loadCarousel();
  }
});

globalThis.addEventListener("resize", () => {
  invalidate();
  if (stackSlices.length > 0) drawStackStrip();
  else drawCarousel();
});

// `requestAnimationFrame` does not fire in a hidden tab, so a canvas opened in
// a background tab stays blank until it is shown. The queued frame does run on
// becoming visible, but the pending-frame flag means anything that happened
// meanwhile was coalesced into it — so force one redraw here and let the
// normal path take over.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") draw();
});

// ===========================================================================
// Boot
// ===========================================================================

document.addEventListener(
  "ars:workspace-mode",
  ((event: Event) => {
    const detail = (event as CustomEvent<{
      mode?: string;
      showGraph?: boolean;
      showGrade?: boolean;
    }>).detail ?? {};
    const showGrade = detail.showGrade ?? detail.mode === "grade";
    const showGraph = detail.showGraph ?? detail.mode !== "grade";
    if (showGrade) {
      persistCompiledParams();
      const params = compiledStageParams();
      if (params) postToGrade({ type: "set-params", params });
      postToGrade({ type: "set-frame", frame: currentFrame });
    } else if (showGraph) {
      postToGrade({ type: "request-state" });
    }
  }) as EventListener,
);

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  const msg = event.data as {
    source?: string;
    type?: string;
    frame?: number;
    params?: Record<string, Record<string, unknown>>;
    projectId?: string;
    on?: boolean;
    nodeId?: string;
    muted?: boolean;
    wrap?: boolean;
  } | null;
  if (!msg || msg.source !== "ars-workshop") return;
  if (msg.type === "ready") {
    if (msg.params) applyDeskParams(msg.params, "system");
    persistCompiledParams();
    lastGradeStepSig = "";
    postToGrade({ type: "set-frame", frame: currentFrame });
    syncGradeToCanvas();
    applyLaunchIntent();
    return;
  }
  if (msg.type === "refresh") {
    postToDesk({ type: "refresh" }, ["grade-frame"]);
    return;
  }
  if (msg.type === "desk-cmd") {
    postToDesk(msg as Record<string, unknown>, ["grade-frame"]);
    return;
  }
  if (msg.type === "playing") {
    playing = Boolean(msg.on);
    syncPlayButtons();
    if (!playing) invalidate();
    return;
  }
  if (msg.type === "params" && msg.params) {
    applyDeskParams(msg.params, "user");
    return;
  }
  if (msg.type === "frame" && Number.isFinite(msg.frame)) {
    const frame = Math.max(0, Math.floor(msg.frame as number));
    if (frame === currentFrame) return;
    currentFrame = frame;
    const frameInput = document.getElementById("frame-input") as HTMLInputElement | null;
    if (frameInput) frameInput.value = String(frame);
    if (playing) {
      paintSourceThumbs(frame);
      return;
    }
    recompile();
    void loadCarousel();
    invalidate();
  }
  if (msg.type === "select-node" && msg.nodeId) {
    const id = asNodeId(String(msg.nodeId));
    if (!graph.nodes[id]) return;
    selected = new Set([id]);
    focusNode(id);
    return;
  }
  if (msg.type === "mute-step" && msg.nodeId) {
    const id = asNodeId(String(msg.nodeId));
    const node = graph.nodes[id];
    if (!node) return;
    const muted = Boolean(msg.muted);
    if ((node.state === "muted") === muted) return;
    toggleMute([id]);
    return;
  }
  if (msg.type === "set-wrap") {
    setDepthWrap(Boolean(msg.wrap));
    return;
  }
  if (msg.type === "evaluate-loop") {
    const id = msg.nodeId ? asNodeId(String(msg.nodeId)) : [...selected][0];
    if (id && graph.nodes[id]?.type === "flow.stack") void runStack(id);
    else toast("Select a Z Stack on the canvas to evaluate the loop.", true);
  }
});

ctx.cardsHost.addEventListener("pointerdown", (event) => {
  const play = (event.target as HTMLElement).closest(".card-play");
  if (!play) return;
  event.preventDefault();
  event.stopPropagation();
  togglePlay();
}, true);

ctx.cardsHost.addEventListener("input", (event) => {
  const scrub = (event.target as HTMLElement).closest<HTMLInputElement>(".card-scrub");
  if (!scrub) return;
  const frame = Math.max(0, Math.floor(Number(scrub.value) || 0));
  if (scrub.classList.contains("card-index") && scrub.dataset.node) {
    const card = scrub.closest(".card");
    const shot = card?.querySelector<HTMLElement>(".card-preview");
    if (shot && graph.projectId) {
      shot.style.backgroundImage =
        `url("/api/project/${encodeURIComponent(graph.projectId)}/frame/${frame}?max_edge=420")`;
    }
    const stamp = card?.querySelector(".preview-stamp");
    if (stamp) stamp.textContent = `frame ${frame}`;
    return;
  }
  seekFrame(frame, true);
});

ctx.cardsHost.addEventListener("change", (event) => {
  const scrub = (event.target as HTMLElement).closest<HTMLInputElement>(".card-scrub");
  if (!scrub) return;
  const frame = Math.max(0, Math.floor(Number(scrub.value) || 0));
  if (scrub.classList.contains("card-index") && scrub.dataset.node) {
    setValue(asNodeId(scrub.dataset.node), "index", { kind: "Number", value: frame });
    return;
  }
  seekFrame(frame, false);
});

stage.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});

function toggleShortcuts(force?: boolean): void {
  const sheet = document.getElementById("shortcuts");
  if (!sheet) return;
  sheet.hidden = force === undefined ? !sheet.hidden : !force;
  if (!sheet.hidden) setSettingsOpen(false);
}

document.getElementById("btn-settings")?.addEventListener("click", (event) => {
  event.preventDefault();
  const ctl = document.getElementById("settings-ctl");
  setSettingsOpen(!ctl?.classList.contains("is-open"));
});
document.getElementById("btn-help")?.addEventListener("click", () => toggleShortcuts());
document.getElementById("shortcuts")?.addEventListener("click", (event) => {
  const t = event.target as HTMLElement;
  if (t.id === "shortcuts" || t.closest("[data-close-shortcuts]")) {
    toggleShortcuts(false);
  }
});
void (async () => {
  await seedGraph();
  graph = attachStacks(graph);
  markGraphClean();
  recompile();
  invalidate();
  requestAnimationFrame(() => fitAll());
  await checkEngine();
  launchTool = new URLSearchParams(location.search).get("tool");
  applyLaunchIntent();
  setTimeout(applyLaunchIntent, 700);
})();

/**
 * Exposed for the console and for `check_runtime.ts`.
 *
 * `redraw` is here because `requestAnimationFrame` does not fire in a hidden
 * tab, so an automated check — which drives a backgrounded page — would see an
 * empty canvas and report a false failure. A headless driver calls this to
 * force the frame the browser is withholding.
 */
(globalThis as unknown as { __wiv: unknown }).__wiv = {
  get graph() {
    return graph;
  },
  get compiled() {
    return compiled;
  },
  get previews() {
    return previews;
  },
  registry: REGISTRY,
  fitAll,
  redraw: draw,
  runPreview,
  runStack,
  get console() {
    return consoleUi;
  },
  scopeOf: (id: string) => resolveStackScope(graph, asNodeId(id)),
};
