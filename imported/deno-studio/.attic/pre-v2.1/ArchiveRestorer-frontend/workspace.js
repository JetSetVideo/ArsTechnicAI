/**
 * workspace.js — sections, layers, colour, subject isolation, interpolation,
 * memory, and the link to the pop-out Inspector.
 *
 * `app.js` remains the grading desk: parameters, preview, generative AI. This
 * module owns everything that treats the reel as a *structured* piece of work
 * rather than a flat stack of sliders — which shot is which, what treatment
 * each one carries, who decided it, and what the machine has learned about
 * how long any of it takes.
 *
 * It attaches to the host controller through a small bridge rather than
 * reaching into it, so the two stay independently readable.
 */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Provenance is shown in exactly two colours everywhere in the UI, so the
// restorer never has to work out whether a value was theirs or the model's.
const ACTOR_LABEL = { user: "you", ai: "AI", system: "auto", mixed: "you + AI" };

let ctx = null;                 // bridge into app.js
const W = {
  segments: [],
  coverage: null,
  masks: [],
  selectedSegment: null,
  selectedMask: null,
  marked: null,                 // {start, end} drawn on the section strip
  lastColour: null,
  interpCandidates: [],
  inspector: null,
  // Tri-state filters over the coverage vocabulary: neutral / include / exclude.
  filters: {},
};

const FILTER_CATEGORIES = ["spec-none", "spec-partial", "spec-complete",
                           "by-user", "by-ai"];
const FILTER_STORAGE = "archive-restorer.filters";

const channel = new BroadcastChannel("archive-restorer");

// ===========================================================================
// Bridge
// ===========================================================================

export function attach(bridge) {
  ctx = bridge;
  loadFilters();
  wire();
  refreshMemory();
  refreshKeyStatus();
}

export async function onProjectOpen() {
  W.selectedSegment = null;
  W.marked = null;
  await Promise.all([refreshSegments(), refreshMasks()]);
  refreshMemory();
  broadcastProject();
  layoutStrip();
}

export function onFrameChange(frame) {
  drawStrip();
  highlightOwner(frame);
  renderKeyframes();
  channel.postMessage({ type: "frame", frame, from: "main" });
}

/** Called after every preview render, so section-aware readouts stay honest. */
export function onPreview() {
  renderKeyframes();
}

// ===========================================================================
// Section lookup — the colour and the name that govern a given frame
// ===========================================================================

export function coverageRuns() {
  return W.coverage?.runs ?? [];
}

export function runAt(frame) {
  return coverageRuns().find((r) => frame >= r.start && frame <= r.end) ?? null;
}

export function sectionAt(frame) {
  const run = runAt(frame);
  return run?.segment_id
    ? W.segments.find((s) => s.id === run.segment_id) ?? null
    : null;
}

/** What is being applied at a frame, for the viewer's "applied" readout. */
export function frameContext(frame) {
  const seg = sectionAt(frame);
  if (!seg) return { section: null, overrides: 0, layers: 0, keyframed: false };
  return {
    section: { id: seg.id, name: seg.name, color: seg.color },
    overrides: flattenParams(seg.params).length,
    layers: (seg.layers ?? []).filter((l) => l.enabled !== false).length,
    keyframed: Boolean((seg.keyframes ?? []).length),
  };
}

export function onParamsChange(params) {
  channel.postMessage({ type: "params", params, from: "main" });
}

export function onAnalysis() {
  channel.postMessage({ type: "analysis", from: "main" });
  drawStrip();
}

export function onJobDone(kind) {
  if (["render", "encode", "analyze", "extract", "track", "interpolate",
       "retime", "roll", "reconstruct"].includes(kind)) refreshMemory();
  if (kind === "track") refreshMasks();
}

/**
 * How each section contributes to an export, so the operator can see the
 * reel's structure — not just a duration — before committing to a render.
 */
export function exportBreakdown(selectedOnly) {
  const total = ctx?.S.frameCount ?? 0;
  const frames = ctx?.S.analysis?.frames ?? [];
  const kept = (i) => {
    if (!selectedOnly) return true;
    const meta = frames[i];
    return !meta || meta.selected !== false;
  };
  const rows = [];
  for (let i = 0; i < total; ) {
    const run = runAt(i);
    const id = run?.segment_id ?? null;
    let j = i + 1;
    while (j < total && (runAt(j)?.segment_id ?? null) === id) j++;
    let keep = 0, drop = 0;
    for (let k = i; k < j; k++) (kept(k) ? keep++ : drop++);
    rows.push({
      start: i, end: j - 1, length: j - i, keep, drop,
      name: run?.name ?? "untreated",
      color: run?.color ?? "#262b35",
      segment_id: id,
    });
    i = j;
  }
  return rows;
}

function broadcastProject() {
  channel.postMessage({
    type: "project",
    projectId: ctx.S.projectId,
    params: ctx.S.params,
    from: "main",
  });
}

channel.addEventListener("message", (e) => {
  const m = e.data ?? {};
  if (m.from === "main") return;
  if (m.type === "inspector-ready") broadcastProject();
  if (m.type === "frame" && typeof m.frame === "number") ctx.gotoFrame(m.frame, true);
  if (m.type === "segments") refreshSegments();
});

// ===========================================================================
// Section strip — coverage, provenance, range marking
// ===========================================================================

function stripCanvas() { return $("section-strip"); }

export function layoutStrip() {
  const c = stripCanvas();
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(c.clientWidth * dpr);
  c.height = Math.round(26 * dpr);
  c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  drawStrip();
}

function frameToX(frame, width) {
  return (frame / Math.max(ctx.S.frameCount - 1, 1)) * width;
}

function xToFrame(x, width) {
  return Math.round(clamp(x / width, 0, 1) * Math.max(ctx.S.frameCount - 1, 0));
}

export function drawStrip() {
  const c = stripCanvas();
  if (!c || !ctx?.S.frameCount) return;
  const g = c.getContext("2d");
  const w = c.clientWidth;
  const h = 26;

  g.clearRect(0, 0, w, h);
  g.fillStyle = "#181b21";
  g.fillRect(0, 0, w, h);

  for (const run of W.coverage?.runs ?? []) {
    const x0 = frameToX(run.start, w);
    const x1 = frameToX(run.end + 1, w);
    const bw = Math.max(x1 - x0, 1);

    g.fillStyle = run.segment_id ? run.color : "#23272e";
    g.fillRect(x0, 0, bw, h);

    if (!run.segment_id) continue;

    // Hatch anything not fully described, so unfinished stretches of the reel
    // read as unfinished at a glance rather than needing to be clicked.
    if (run.spec_state !== "complete") {
      g.save();
      g.beginPath();
      g.rect(x0, 0, bw, h);
      g.clip();
      g.strokeStyle = run.spec_state === "none"
        ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.30)";
      g.lineWidth = 2;
      for (let x = x0 - h; x < x1 + h; x += 7) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + h, 0);
        g.stroke();
      }
      g.restore();
    }

    // Authorship bar along the bottom edge.
    const byColour = { user: "#4da3d8", ai: "#e8a33d", mixed: "#c76a9f" }[run.authored_by];
    if (byColour) {
      g.fillStyle = byColour;
      g.fillRect(x0, h - 3, bw, 3);
    }

    // Key frames are the frames a human actually judged; everything between
    // them is inference, and the strip should not pretend otherwise.
    for (const kf of run.keyframes ?? []) {
      const kx = frameToX(kf, w);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(kx, 2);
      g.lineTo(kx + 3.5, 6);
      g.lineTo(kx, 10);
      g.lineTo(kx - 3.5, 6);
      g.closePath();
      g.fill();
    }

    if (run.segment_id === W.selectedSegment) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2;
      g.strokeRect(x0 + 1, 1, bw - 2, h - 2);
    }
  }

  // Frames the filter hides are veiled here too, so the strip, the graph and
  // the filmstrip never disagree about what is in play.
  g.fillStyle = "rgba(8,9,12,.72)";
  for (const [a, b] of excludedRanges()) {
    const x0 = frameToX(a, w);
    g.fillRect(x0, 0, Math.max(frameToX(b + 1, w) - x0, 1), h);
  }

  if (W.marked) {
    const x0 = frameToX(Math.min(W.marked.start, W.marked.end), w);
    const x1 = frameToX(Math.max(W.marked.start, W.marked.end) + 1, w);
    g.fillStyle = "rgba(255,255,255,.16)";
    g.fillRect(x0, 0, x1 - x0, h);
    g.strokeStyle = "#ffffff";
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    g.strokeRect(x0 + .5, .5, x1 - x0 - 1, h - 1);
    g.setLineDash([]);
  }

  const px = frameToX(ctx.S.frame, w);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(px, 0);
  g.lineTo(px, h);
  g.stroke();
}

function initStripPointer() {
  const c = stripCanvas();
  if (!c) return;
  let anchor = null;
  let moved = false;

  c.addEventListener("pointerdown", (e) => {
    const r = c.getBoundingClientRect();
    anchor = xToFrame(e.clientX - r.left, r.width);
    moved = false;
    c.setPointerCapture(e.pointerId);
  });

  c.addEventListener("pointermove", (e) => {
    if (anchor === null) return;
    const r = c.getBoundingClientRect();
    const frame = xToFrame(e.clientX - r.left, r.width);
    if (Math.abs(frame - anchor) > 1) moved = true;
    if (moved) {
      W.marked = { start: anchor, end: frame };
      updateMarkedReadout();
      drawStrip();
    }
  });

  const end = (e) => {
    if (anchor === null) return;
    const r = c.getBoundingClientRect();
    const frame = xToFrame(e.clientX - r.left, r.width);
    // A click selects the section under the cursor; a drag marks a range.
    if (!moved) {
      const run = (W.coverage?.runs ?? []).find((x) => frame >= x.start && frame <= x.end);
      if (run?.segment_id) selectSegment(run.segment_id);
      ctx.gotoFrame(frame);
    }
    anchor = null;
    try { c.releasePointerCapture(e.pointerId); } catch { /* gone */ }
    drawStrip();
  };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
}

function updateMarkedReadout() {
  const box = $("marked-range");
  if (!box) return;
  box.classList.toggle("set", !!W.marked);
  if (!W.marked) { box.textContent = "No range marked"; return; }
  const a = Math.min(W.marked.start, W.marked.end);
  const b = Math.max(W.marked.start, W.marked.end);
  box.textContent = `Marked ${a} – ${b}  (${b - a + 1} frames)`;
}

// ===========================================================================
// Tri-state filters over the coverage vocabulary
// ===========================================================================
//
// The legend used to be five inert swatches restating what the colours meant.
// Each is now a filter with three states — ignored, include only, exclude —
// and the states are carried by the shadow, not just the colour: raised for
// include, recessed for exclude, flat for neutral.

function loadFilters() {
  try {
    W.filters = JSON.parse(localStorage.getItem(FILTER_STORAGE) ?? "{}");
  } catch { W.filters = {}; }
  for (const key of FILTER_CATEGORIES) W.filters[key] ??= "neutral";
}

function saveFilters() {
  try { localStorage.setItem(FILTER_STORAGE, JSON.stringify(W.filters)); }
  catch { /* private browsing */ }
}

/** The categories a frame belongs to, in the same vocabulary as the legend. */
function categoriesAt(frame) {
  const run = runAt(frame);
  if (!run?.segment_id) return ["spec-none"];
  const out = [`spec-${run.spec_state ?? "none"}`];
  if (run.authored_by === "user" || run.authored_by === "mixed") out.push("by-user");
  if (run.authored_by === "ai" || run.authored_by === "mixed") out.push("by-ai");
  return out;
}

/**
 * Whether a frame survives the filter.
 *
 * Includes union, excludes subtract, and an exclusion always beats an
 * inclusion — a frame the restorer has asked not to see should not reappear
 * because it also matches something they asked to see.
 */
export function passesFilter(frame) {
  const active = Object.entries(W.filters).filter(([, s]) => s !== "neutral");
  if (!active.length) return true;
  const mine = new Set(categoriesAt(frame));
  if (active.some(([k, s]) => s === "exclude" && mine.has(k))) return false;
  const includes = active.filter(([, s]) => s === "include");
  if (!includes.length) return true;
  return includes.some(([k]) => mine.has(k));
}

export function filterActive() {
  return Object.values(W.filters).some((s) => s !== "neutral");
}

/** Contiguous ranges the filter hides, for veiling the graph in one pass. */
export function excludedRanges() {
  if (!filterActive() || !ctx?.S.frameCount) return [];
  const out = [];
  let start = null;
  for (let i = 0; i < ctx.S.frameCount; i++) {
    const hidden = !passesFilter(i);
    if (hidden && start === null) start = i;
    if (!hidden && start !== null) { out.push([start, i - 1]); start = null; }
  }
  if (start !== null) out.push([start, ctx.S.frameCount - 1]);
  return out;
}

export function matchingFrames() {
  const out = [];
  for (let i = 0; i < (ctx?.S.frameCount ?? 0); i++) if (passesFilter(i)) out.push(i);
  return out;
}

function cycleFilter(key, backwards = false) {
  const order = backwards
    ? { neutral: "exclude", exclude: "include", include: "neutral" }
    : { neutral: "include", include: "exclude", exclude: "neutral" };
  W.filters[key] = order[W.filters[key] ?? "neutral"];
  saveFilters();
  applyFilters();
}

function applyFilters() {
  renderFilterChips();
  ctx.renderFilmstrip();
  ctx.renderQualityGraph();
  drawStrip();
}

function renderFilterChips() {
  const host = $("strip-legend");
  if (!host) return;
  const counts = {};
  for (const key of FILTER_CATEGORIES) counts[key] = 0;
  for (const run of coverageRuns()) {
    const length = run.end - run.start + 1;
    for (const key of categoriesAt(run.start)) counts[key] = (counts[key] ?? 0) + length;
  }

  for (const chip of host.querySelectorAll(".chip")) {
    const key = chip.dataset.filter;
    chip.dataset.state = W.filters[key] ?? "neutral";
    chip.querySelector(".chip-n").textContent = counts[key] ? ` ${counts[key]}` : "";
    chip.title = {
      neutral: "Ignored by the filter. Click to show only these; double-click to hide them.",
      include: "Showing only these. Click to hide them instead.",
      exclude: "Hidden. Click to clear.",
    }[chip.dataset.state];
    chip.setAttribute("aria-pressed", String(chip.dataset.state !== "neutral"));
  }

  const any = filterActive();
  const matching = any ? matchingFrames().length : 0;
  $("btn-filter-select").disabled = !any;
  $("btn-filter-select").textContent = any
    ? `Select ${matching} matching` : "Select matching";
  $("btn-filter-clear").classList.toggle("hidden", !any);
}

function initFilterChips() {
  const host = $("strip-legend");
  if (!host) return;
  for (const chip of host.querySelectorAll(".chip")) {
    chip.addEventListener("click", (e) => {
      if (e.detail > 1) return;            // the dblclick handler owns this
      cycleFilter(chip.dataset.filter);
    });
    // Double-click from neutral goes straight to exclude, which is the state
    // people actually want when a category is in the way.
    chip.addEventListener("dblclick", () => {
      W.filters[chip.dataset.filter] =
        W.filters[chip.dataset.filter] === "exclude" ? "neutral" : "exclude";
      saveFilters();
      applyFilters();
    });
  }

  $("btn-filter-clear")?.addEventListener("click", () => {
    for (const key of FILTER_CATEGORIES) W.filters[key] = "neutral";
    saveFilters();
    applyFilters();
  });

  $("btn-filter-select")?.addEventListener("click", async () => {
    const frames = matchingFrames();
    if (!frames.length) return;
    const selected = {};
    for (let i = 0; i < ctx.S.frameCount; i++) selected[String(i)] = passesFilter(i);
    await ctx.post("/api/pipeline/select",
      { project_id: ctx.S.projectId, selected });
    ctx.log(`${frames.length} frames matching the filter are now selected`, "ok");
    await ctx.loadAnalysis();
  });
}

function highlightOwner(frame) {
  const run = (W.coverage?.runs ?? []).find((r) => frame >= r.start && frame <= r.end);
  const label = $("project-label");
  if (label && run?.segment_id) label.dataset.section = run.name;
}

// ===========================================================================
// Sections
// ===========================================================================

async function refreshSegments() {
  if (!ctx.S.projectId) return;
  try {
    const [list, cov] = await Promise.all([
      ctx.get(`/api/segments/${ctx.S.projectId}`),
      ctx.get(`/api/segments/${ctx.S.projectId}/coverage`),
    ]);
    W.segments = list.segments ?? [];
    W.coverage = cov;
  } catch {
    W.segments = [];
    W.coverage = null;
  }

  $("sections-count").textContent = String(W.segments.length);
  const readout = $("coverage-readout");
  if (readout && W.coverage) {
    const undescribed = W.segments.filter(
      (s) => (s.spec_state?.state ?? "none") !== "complete").length;
    readout.textContent =
      `${W.coverage.coverage_pct}% of the reel is in a section` +
      (undescribed ? ` · ${undescribed} still need a treatment` : " · all described");
  }

  renderSegmentList();
  renderReferenceOptions();
  renderFilterChips();
  ctx.updateSectionBadge?.();
  drawStrip();
  channel.postMessage({ type: "segments", from: "main" });
}

function renderSegmentList() {
  const host = $("segment-list");
  if (!host) return;
  host.replaceChildren();

  if (!W.segments.length) {
    host.append(el("p", "muted small",
      "No sections yet. Use “From detected shots” to seed them from the analysis pass."));
    return;
  }

  for (const seg of W.segments) {
    const state = seg.spec_state ?? {};
    const row = el("div", `seg-row${seg.id === W.selectedSegment ? " active" : ""}`);
    row.style.setProperty("--seg-color", seg.color);

    const swatch = el("i", "seg-swatch");
    swatch.style.background = seg.color;

    const main = el("div", "seg-main");
    main.append(el("span", "seg-name", seg.name));
    main.append(el("span", "seg-range", `${seg.start}–${seg.end}`));

    const tags = el("div", "seg-tags");
    tags.append(el("span", `tag spec-${state.state ?? "none"}`, state.state ?? "none"));
    if (state.authored_by && state.authored_by !== "none") {
      tags.append(el("span", `tag by-${state.authored_by}`,
        ACTOR_LABEL[state.authored_by] ?? state.authored_by));
    }
    if (state.has_overrides) tags.append(el("span", "tag ovr", "overrides"));
    if (state.layer_count) tags.append(el("span", "tag lyr", `${state.layer_count}L`));
    if (state.keyframe_count) {
      tags.append(el("span", "tag kf", `▲${state.keyframe_count}`));
    }
    if (state.needs_review) tags.append(el("span", "tag review", "review"));
    main.append(tags);

    row.append(swatch, main);
    row.onclick = () => { selectSegment(seg.id); ctx.gotoFrame(seg.start); };
    host.append(row);
  }
}

function selectedSegment() {
  return W.segments.find((s) => s.id === W.selectedSegment) ?? null;
}

function selectSegment(id) {
  W.selectedSegment = id;
  renderSegmentList();
  renderSegmentEditor();
  drawStrip();
}

function specValue(seg, field) {
  const entry = seg.spec?.[field];
  if (entry && typeof entry === "object" && "value" in entry) return entry.value ?? "";
  return entry ?? "";
}

function specActor(seg, field) {
  const entry = seg.spec?.[field];
  return entry && typeof entry === "object" ? entry.actor : null;
}

function renderSegmentEditor() {
  const box = $("segment-editor");
  const seg = selectedSegment();
  if (!box) return;
  if (!seg) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");

  $("seg-name").value = seg.name;
  $("seg-color").value = seg.color;
  $("seg-start").value = seg.start;
  $("seg-end").value = seg.end;
  $("seg-enabled").checked = seg.enabled !== false;
  $("seg-lock").textContent = seg.locked ? "🔒" : "🔓";
  $("seg-lock").classList.toggle("active", Boolean(seg.locked));

  for (const field of ["content", "damage", "intent"]) {
    $(`spec-${field}`).value = specValue(seg, field);
    const badge = $(`prov-${field}`);
    const actor = specActor(seg, field);
    badge.className = `prov${actor ? ` by-${actor}` : ""}`;
    badge.textContent = actor ? ACTOR_LABEL[actor] ?? actor : "";
    badge.title = actor === "ai"
      ? `Written by ${seg.spec[field].model ?? "a model"} — review before trusting it`
      : actor === "user" ? "Your own note" : "Not written yet";
  }

  renderOverrides(seg);
  renderKeyframes();
  renderLayers(seg);
}

// ===========================================================================
// Key frames — the mechanism that expands one judgement across a section
// ===========================================================================

function renderKeyframes() {
  const host = $("keyframe-list");
  const seg = selectedSegment();
  if (!host) return;
  host.replaceChildren();
  const count = $("seg-keyframe-count");

  if (!seg) { if (count) count.textContent = ""; return; }
  const keys = seg.keyframes ?? [];
  const span = seg.end - seg.start + 1;
  if (count) {
    count.textContent = keys.length
      ? `${keys.length} pinned across ${span} frames`
      : "none yet";
  }

  const inside = ctx.S.frame >= seg.start && ctx.S.frame <= seg.end;
  $("btn-key-set").disabled = !inside;
  $("btn-key-set").title = inside
    ? "Pin the current slider values to this frame"
    : "Move to a frame inside this section first";
  $("btn-key-delete").disabled =
    !keys.some((k) => Number(k.frame) === ctx.S.frame);

  for (const kf of [...keys].sort((a, b) => a.frame - b.frame)) {
    const chip = el("div", `kf${Number(kf.frame) === ctx.S.frame ? " current" : ""}`
      + (kf.actor === "ai" ? " by-ai" : ""));
    chip.textContent = `▲ ${kf.frame}`;
    chip.title = `Pinned by ${ACTOR_LABEL[kf.actor] ?? kf.actor}`
      + (kf.note ? ` — ${kf.note}` : "")
      + ". Click to jump there.";
    chip.onclick = () => ctx.gotoFrame(Number(kf.frame));
    host.append(chip);
  }
}

async function setKeyframe() {
  const seg = selectedSegment();
  if (!seg) { ctx.log("select a section first — key frames belong to one", "err"); return; }
  try {
    await ctx.post(`/api/segments/${ctx.S.projectId}/${seg.id}/keyframe`, {
      frame: ctx.S.frame,
      params: structuredClone(ctx.S.params),
      actor: "user",
    });
    await refreshSegments();
    renderSegmentEditor();
    ctx.requestPreview();
    ctx.log(`frame ${ctx.S.frame} pinned — “${seg.name}” now interpolates through it`, "ok");
  } catch (err) {
    ctx.log(`could not pin the frame: ${err.message}`, "err");
  }
}

async function deleteKeyframe() {
  const seg = selectedSegment();
  if (!seg) return;
  await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}/keyframe/${ctx.S.frame}`,
    { method: "DELETE" });
  await refreshSegments();
  renderSegmentEditor();
  ctx.requestPreview();
}

/**
 * Ask where the section's key frames can honestly be trusted to govern.
 *
 * Propagation is only defensible while the content still resembles the frame
 * that was judged. Where it does not, the frames are surfaced for review
 * rather than being treated silently.
 */
async function checkPropagation() {
  const seg = selectedSegment();
  const box = $("propagation-result");
  if (!seg || !box) return;
  box.textContent = "comparing each frame against its nearest key frame…";
  try {
    const r = await ctx.get(
      `/api/segments/${ctx.S.projectId}/${seg.id}/propagation`);
    box.replaceChildren();
    if (r.message) { box.append(el("p", "muted small", r.message)); return; }

    box.append(el("p", "small",
      `${r.coverage_pct}% of the sampled frames are close enough to a key frame `
      + `for its treatment to carry (${r.governed} of ${r.probed} probed).`));

    if (!r.reviewed.length) {
      box.append(el("p", "muted small",
        "Nothing in this section has diverged — the treatment propagates cleanly."));
      return;
    }
    box.append(el("p", "muted small",
      `${r.reviewed.length} need review rather than propagation:`));
    const list = el("div", "detect-list");
    for (const item of r.reviewed.slice(0, 20)) {
      const row = el("div", "detect-row");
      row.append(el("span", "detect-label",
        `frame ${item.frame} — ${item.reasons.join("; ")}`));
      row.append(el("span", "score", `${item.disagreement_pct ?? "?"}%`));
      row.onclick = () => ctx.gotoFrame(item.frame);
      list.append(row);
    }
    box.append(list);
  } catch (err) {
    box.textContent = err.message;
  }
}

/** Write the level reference onto the governing section, not the whole reel. */
export async function commitLevelReference(degrees) {
  const seg = sectionAt(ctx.S.frame);
  if (!seg) return;
  try {
    await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}`, {
      method: "PATCH",
      body: {
        changes: { params: { level: { enabled: true, reference: degrees } } },
        actor: "user",
      },
    });
    await refreshSegments();
    ctx.log(`true level for “${seg.name}” declared at ${degrees.toFixed(1)}°`, "ok");
  } catch (err) {
    ctx.log(`could not write the level reference: ${err.message}`, "err");
  }
}

function flattenParams(tree, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(tree ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flattenParams(v, path));
    else out.push([path, v]);
  }
  return out;
}

function renderOverrides(seg) {
  const host = $("override-list");
  host.replaceChildren();
  const entries = flattenParams(seg.params);
  $("seg-override-count").textContent = entries.length ? `${entries.length} value(s)` : "";

  if (!entries.length) {
    host.append(el("p", "muted small",
      "None — this section uses the project parameters unchanged."));
    return;
  }
  for (const [path, value] of entries) {
    const actor = seg.param_provenance?.[path];
    const row = el("div", "override-row");
    row.append(el("code", null, path));
    row.append(el("b", null, String(value)));
    if (actor) row.append(el("span", `tag by-${actor}`, ACTOR_LABEL[actor] ?? actor));
    host.append(row);
  }
}

function renderLayers(seg) {
  const host = $("layer-list");
  host.replaceChildren();
  const layers = seg.layers ?? [];
  if (!layers.length) {
    host.append(el("p", "muted small",
      "No layers. A layer applies an adjustment through a matte, so one subject "
      + "can be corrected without touching the rest of the frame."));
    return;
  }

  for (const layer of layers) {
    const row = el("div", "layer-row");

    const on = el("input");
    on.type = "checkbox";
    on.checked = layer.enabled !== false;
    on.onchange = () => patchLayer(seg.id, layer.id, { enabled: on.checked });

    const name = el("span", "layer-name", layer.name);
    const mask = el("span", "muted small",
      layer.mask_ref ? `via ${layer.mask_ref}` : "whole frame");

    const opacity = el("input");
    opacity.type = "range";
    opacity.min = 0; opacity.max = 1; opacity.step = 0.01;
    opacity.value = layer.opacity ?? 1;
    opacity.title = "Opacity";
    opacity.onchange = () => patchLayer(seg.id, layer.id, { opacity: Number(opacity.value) });

    const mode = el("select");
    for (const m of ["normal", "multiply", "screen", "overlay", "soft-light", "luminosity"]) {
      const o = el("option", null, m);
      o.value = m;
      if (m === layer.blend_mode) o.selected = true;
      mode.append(o);
    }
    mode.onchange = () => patchLayer(seg.id, layer.id, { blend_mode: mode.value });

    const del = el("button", "tool danger", "🗑");
    del.onclick = async () => {
      await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}/layers/${layer.id}`,
        { method: "DELETE" });
      await refreshSegments();
      renderSegmentEditor();
      ctx.requestPreview();
    };

    if (layer.created_by) {
      row.append(el("span", `tag by-${layer.created_by}`,
        ACTOR_LABEL[layer.created_by] ?? layer.created_by));
    }
    row.append(on, name, mask, mode, opacity, del);
    host.append(row);
  }
}

async function patchLayer(segId, layerId, changes) {
  await ctx.api(`/api/segments/${ctx.S.projectId}/${segId}/layers/${layerId}`,
    { method: "PATCH", body: { changes, actor: "user" } });
  await refreshSegments();
  renderSegmentEditor();
  ctx.requestPreview();
}

async function patchSegment(changes, actor = "user") {
  const seg = selectedSegment();
  if (!seg) return;
  try {
    await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}`,
      { method: "PATCH", body: { changes, actor } });
    await refreshSegments();
    renderSegmentEditor();
    ctx.requestPreview();
  } catch (err) {
    ctx.log(`could not update section: ${err.message}`, "err");
  }
}

// ===========================================================================
// Colour
// ===========================================================================

export function activeRange() {
  if (W.marked) {
    return [Math.min(W.marked.start, W.marked.end), Math.max(W.marked.start, W.marked.end)];
  }
  const seg = selectedSegment();
  if (seg) return [seg.start, seg.end];
  const run = (W.coverage?.runs ?? []).find(
    (r) => ctx.S.frame >= r.start && ctx.S.frame <= r.end);
  if (run) return [run.start, run.end];
  return [Math.max(ctx.S.frame - 24, 0), Math.min(ctx.S.frame + 24, ctx.S.frameCount - 1)];
}

async function analyseColour() {
  const [start, end] = activeRange();
  ctx.log(`measuring colour across frames ${start}–${end}…`);
  try {
    const r = await ctx.post("/api/colour/analyse",
      { project_id: ctx.S.projectId, start, end, sample: 12 });
    W.lastColour = r;
    renderColour(r);
    $("btn-colour-apply").disabled = false;
  } catch (err) {
    ctx.log(`colour analysis failed: ${err.message}`, "err");
  }
}

function renderColour(r) {
  $("colour-result").classList.remove("hidden");

  const pal = $("colour-palette");
  pal.replaceChildren();
  // The palette is taken from the middle of the range, which is the most
  // representative single frame of a shot.
  const mid = r.samples?.[Math.floor((r.samples?.length ?? 1) / 2)];
  pal.append(el("span", "muted small", `sampled ${r.frames_sampled} frames`));
  if (mid) pal.append(el("span", "muted small", ` · mid frame ${mid.index}`));

  const m = r.mean;
  const rows = [
    ["Luma mean", m.luma_mean],
    ["Contrast (σ)", m.luma_std],
    ["Usable black / white", `${m.black_point} / ${m.white_point}`],
    ["Colour cast", `${m.cast_direction} (${m.cast_severity})`],
    ["Shadows / highlights", `${(m.shadows * 100).toFixed(1)}% / ${(m.highlights * 100).toFixed(1)}%`],
    ["Luma drift over shot", `${r.gradation.luma.total_change} (${r.gradation.luma.steady ? "steady" : "unsteady"})`],
  ];
  const table = $("colour-stats");
  table.replaceChildren();
  for (const [k, v] of rows) {
    const tr = el("tr");
    tr.append(el("th", null, k), el("td", null, String(v)));
    table.append(tr);
  }

  $("colour-verdict").textContent = r.gradation.verdict;
  $("colour-rationale").textContent = r.suggested?.rationale ?? "";
}

async function applyColourSuggestion() {
  const seg = selectedSegment();
  if (!seg || !W.lastColour?.suggested) {
    ctx.log("select a section first — the suggestion is written onto it", "err");
    return;
  }
  await patchSegment({ params: { levels: W.lastColour.suggested.levels } }, "ai");
  ctx.log(`levels suggestion written onto “${seg.name}” and marked as AI-derived`, "ok");
}

function renderReferenceOptions() {
  const sel = $("colour-ref");
  if (!sel) return;
  sel.replaceChildren();
  for (const seg of W.segments) {
    const o = el("option", null, `${seg.name} (${seg.start}–${seg.end})`);
    o.value = seg.id;
    sel.append(o);
  }
}

async function matchColour() {
  const seg = selectedSegment();
  const refId = $("colour-ref").value;
  const ref = W.segments.find((s) => s.id === refId);
  if (!seg || !ref) {
    ctx.log("pick both a target section and a reference section", "err");
    return;
  }
  try {
    const r = await ctx.post("/api/colour/match", {
      project_id: ctx.S.projectId,
      target_start: seg.start, target_end: seg.end,
      reference_start: ref.start, reference_end: ref.end,
      apply_to_segment: seg.id,
    });
    $("colour-match-result").textContent =
      `${r.delta.match_quality} — luma ${r.delta.luma_delta > 0 ? "+" : ""}${r.delta.luma_delta}, `
      + `a ${r.delta.a_delta > 0 ? "+" : ""}${r.delta.a_delta}, b ${r.delta.b_delta > 0 ? "+" : ""}${r.delta.b_delta}. `
      + `Correction written onto “${seg.name}”.`;
    await refreshSegments();
    renderSegmentEditor();
    ctx.requestPreview();
  } catch (err) {
    ctx.log(`colour match failed: ${err.message}`, "err");
  }
}

// ===========================================================================
// Subject isolation
// ===========================================================================

async function detectSubjects() {
  if (!ctx.S.projectId) return;
  const mode = $("detect-mode")?.value ?? "auto";
  ctx.log(mode === "local"
    ? `looking for subjects in frame ${ctx.S.frame} with local vision…`
    : `locating subjects in frame ${ctx.S.frame}…`);
  const button = $("btn-detect");
  button.disabled = true;
  try {
    const r = await ctx.post("/api/vision/detect", {
      project_id: ctx.S.projectId,
      frame: ctx.S.frame,
      hint: $("detect-hint").value,
      mode,
      params: ctx.S.params,
      build_masks: true,
    });
    renderDetections(r.detections, r);
    await refreshMasks();
    ctx.log(
      `${r.count} subject(s) located by the ${r.source === "model" ? "vision model" : "local detector"}`
      + (r.fallback_reason ? ` — the model was unavailable (${r.fallback_reason})` : ""),
      "ok");
  } catch (err) {
    ctx.log(`detection failed: ${err.message}`, "err");
  } finally {
    button.disabled = false;
  }
}

function renderDetections(list, meta = {}) {
  const host = $("detect-list");
  host.replaceChildren();
  if (!list?.length) {
    host.append(el("p", "muted small",
      "Nothing detected in this frame. Try a frame with more movement, or "
      + "name what you are looking for in the hint."));
    return;
  }
  if (meta.source) {
    host.append(el("p", "muted small",
      meta.source === "local"
        ? "Found locally from face and body cascades, motion against the temporal "
          + "median, and spectral saliency. No credential was used, so the subjects "
          + "are numbered rather than named."
        : "Named by the vision model; each box refined into a matte locally."));
  }
  for (const d of list) {
    const row = el("div", "detect-row");
    row.append(el("span", `tag cat-${d.category}`, d.category));
    row.append(el("span", "detect-label", d.label));
    // A weak matte should look weak rather than be discovered later.
    const conf = el("span", "muted small", `${Math.round(d.confidence * 100)}%`);
    conf.title = d.evidence?.length
      ? `Agreed on by: ${d.evidence.join(", ")}`
      : "Model confidence";
    row.append(conf);
    if (d.matte_quality && d.matte_quality !== "good") {
      const warn = el("span", "tag review",
        d.matte_quality === "empty" ? "no matte" : "box-shaped");
      warn.title = d.matte_quality === "empty"
        ? "GrabCut found no subject inside the box — paint over it or pick another frame."
        : "The matte fills its whole box, so it did not find an edge. Treat it as a rectangle.";
      row.append(warn);
    }
    if (d.coverage !== undefined) {
      row.append(el("span", "muted small", `${(d.coverage * 100).toFixed(1)}% of frame`));
    }
    const use = el("button", "btn small", "Use as layer");
    use.onclick = () => addLayerWithMask(d.mask_id, d.label);
    row.append(use);
    host.append(row);
  }
}

async function refreshMasks() {
  if (!ctx.S.projectId) return;
  try {
    const r = await ctx.get(`/api/vision/masks/${ctx.S.projectId}`);
    W.masks = r.masks ?? [];
  } catch { W.masks = []; }

  const host = $("mask-list");
  if (host) {
    host.replaceChildren();
    if (!W.masks.length) {
      host.append(el("p", "muted small", "No mattes stored yet."));
    }
    for (const m of W.masks) {
      const row = el("div", `mask-row${m.id === W.selectedMask ? " active" : ""}`);
      row.append(el("span", "mask-name", m.id));
      row.append(el("span", "muted small",
        m.kind === "tracked" ? `${m.frame_count} frames (${m.first}–${m.last})` : "static"));
      const del = el("button", "tool danger", "🗑");
      del.onclick = async (e) => {
        e.stopPropagation();
        await ctx.api(`/api/vision/masks/${ctx.S.projectId}/${m.id}`, { method: "DELETE" });
        refreshMasks();
      };
      row.append(del);
      row.onclick = () => {
        W.selectedMask = m.id;
        $("btn-track-mask").disabled = false;
        refreshMasks();
      };
      host.append(row);
    }
  }

  const sel = $("layer-mask-select");
  if (sel) {
    const keep = sel.value;
    sel.replaceChildren();
    const none = el("option", null, "no mask (whole frame)");
    none.value = "";
    sel.append(none);
    for (const m of W.masks) {
      const o = el("option", null, m.id);
      o.value = m.id;
      sel.append(o);
    }
    sel.value = keep;
  }
}

async function addLayerWithMask(maskId, name) {
  const seg = selectedSegment();
  if (!seg) { ctx.log("select a section first — layers belong to a section", "err"); return; }
  await ctx.post(`/api/segments/${ctx.S.projectId}/${seg.id}/layers`, {
    name: name || maskId || "Layer",
    mask_source: maskId ? "ai" : "none",
    mask_ref: maskId || null,
    adjustments: { levels: { enabled: true, gamma: 1.0, black: 0, white: 255, saturation: 1.0 } },
    actor: "user",
  });
  await refreshSegments();
  renderSegmentEditor();
  ctx.log(`layer “${name || maskId}” added to “${seg.name}”`, "ok");
}

async function buildBackgroundPlate() {
  const [start, end] = activeRange();
  ctx.log(`building a background plate from frames ${start}–${end}…`);
  try {
    const r = await ctx.post("/api/vision/background", {
      project_id: ctx.S.projectId, start, end, frame: ctx.S.frame,
      mask_id: `movers-${start}`,
    });
    ctx.log(`plate written; moving subjects cover ${(r.coverage * 100).toFixed(1)}% of frame ${r.frame}`, "ok");
    await refreshMasks();
  } catch (err) {
    ctx.log(`background plate failed: ${err.message}`, "err");
  }
}

async function trackMask() {
  if (!W.selectedMask) return;
  const [start, end] = activeRange();
  try {
    const r = await ctx.post("/api/vision/track", {
      project_id: ctx.S.projectId, mask_id: W.selectedMask,
      start: ctx.S.frame, end,
    });
    ctx.log(`tracking “${W.selectedMask}” across ${r.frames} frames…`);
  } catch (err) {
    ctx.log(`tracking failed: ${err.message}`, "err");
  }
}

// ===========================================================================
// Interpolation
// ===========================================================================

async function findCandidates() {
  // Scan the marked range, the selected section, or the whole reel — working
  // a shot at a time is the normal case, but the overview matters too.
  const whole = $("interp-whole-reel")?.checked;
  const [start, end] = whole
    ? [0, Math.max(ctx.S.frameCount - 1, 0)]
    : activeRange();

  // Confirming a candidate means reading its neighbourhood and rehearsing the
  // repair, so this is seconds of work, not milliseconds.
  const button = $("btn-interp-candidates");
  button.disabled = true;
  $("interp-result").textContent =
    `Checking frames ${start}–${end} against their own shots…`;

  try {
    const r = await ctx.get(
      `/api/interpolate/candidates/${ctx.S.projectId}?start=${start}&end=${end}`);
    W.interpCandidates = r.frames;
    $("btn-interp-rebuild").disabled = !r.count;

    const box = $("interp-result");
    box.replaceChildren();
    const where = whole ? "the whole reel" : `frames ${start}–${end}`;

    const stuck = r.unbridgeable ?? [];
    const skipped = r.not_worth_it ?? [];
    if (!r.damaged) {
      box.append(el("p", "muted small",
        `Nothing in ${where} is damaged enough to be worth rebuilding.`));
      return;
    }

    box.append(el("p", "small",
      `${r.damaged} of ${end - start + 1} frames in ${where} were flagged by the `
      + `analysis pass. ${r.count} are worth rebuilding — those go to a separate `
      + `folder, leaving the extraction alone.`));

    // Being flagged is not the same as being repairable, and saying why the
    // other frames were left out is the difference between a tool the restorer
    // can trust and a number they have to take on faith.
    const held = [];
    if (skipped.length) {
      held.push(`${skipped.length} look no worse than the rest of their own shot, `
        + `or sit beside an unmarked cut where interpolating would dissolve two `
        + `different shots together`);
    }
    if (stuck.length) {
      held.push(`${stuck.length} sit in runs with no clean frame either side, so `
        + `there is nothing to interpolate from`);
    }
    if (held.length) {
      box.append(el("p", "muted small",
        `Left alone: ${held.join("; ")}. Those want a grade or a cut, not a rebuild.`));
    }

    const list = el("div", "detect-list");
    for (const c of (r.candidates ?? []).slice(0, 40)) {
      const row = el("div", "detect-row");
      row.append(el("span", "detect-label",
                    `frame ${c.index} — ${c.outlier_by} dB off its shot`),
                 el("span", "score", `${Math.round((c.confidence ?? 0) * 100)}%`));
      row.title = `${c.reason}. Would be rebuilt from frames ${c.anchors[0]} and `
        + `${c.anchors[1]} by ${c.method}; the synthesiser rates that result `
        + `${Math.round((c.confidence ?? 0) * 100)}% trustworthy.`;
      row.onclick = () => ctx.gotoFrame(c.index);
      list.append(row);
    }
    box.append(list);
    if (r.count > 40) {
      box.append(el("p", "muted small", `…and ${r.count - 40} more.`));
    }
  } catch (err) {
    $("interp-result").textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function previewInterp() {
  const before = Math.max(ctx.S.frame - 1, 0);
  const after = Math.min(ctx.S.frame + 1, ctx.S.frameCount - 1);
  try {
    const r = await ctx.post("/api/interpolate/preview", {
      project_id: ctx.S.projectId, before, after, t: 0.5,
    });
    const rep = r.report;
    $("interp-result").innerHTML = "";
    const img = el("img", "interp-preview");
    img.src = r.image;
    $("interp-result").append(
      img,
      el("p", "muted small",
        `Rebuilt frame ${ctx.S.frame} from ${before} and ${after} using ${rep.method}. `
        + `Confidence ${(rep.confidence * 100).toFixed(0)}%. `
        + (rep.reason ? rep.reason : `Motion ${rep.mean_motion_px}px, flow gain ${rep.flow_gain_db} dB.`)),
    );
  } catch (err) {
    $("interp-result").textContent = err.message;
  }
}

async function rebuildFrames() {
  if (!W.interpCandidates.length) return;
  if (!confirm(`Rebuild ${W.interpCandidates.length} damaged frames from their neighbours?`)) return;
  await ctx.post("/api/interpolate/rebuild", {
    project_id: ctx.S.projectId, frames: W.interpCandidates, quality: "balanced",
  });
}

async function retime() {
  const [start, end] = activeRange();
  await ctx.post("/api/interpolate/retime", {
    project_id: ctx.S.projectId, start, end,
    factor: Number($("retime-factor").value),
  });
  ctx.log(`retiming frames ${start}–${end}…`);
}

// ===========================================================================
// Memory
// ===========================================================================

const fmtDuration = (s) => {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
};

async function refreshMemory() {
  try {
    const { machine, ffmpeg } = await ctx.get("/api/memory/machine");
    $("machine-info").textContent =
      `${machine.platform} · ${machine.cores} cores · ${machine.ram_gb} GB · `
      + `OpenCV ${machine.opencv} · encoder ${ffmpeg.source}`;
  } catch { /* engine may be starting */ }

  if (!ctx.S.projectId) return;

  try {
    const { runs } = await ctx.get(`/api/memory/runs?project_id=${ctx.S.projectId}&limit=12`);
    const table = $("runs-table");
    table.replaceChildren();
    if (!runs.length) {
      const tr = el("tr");
      tr.append(el("td", "muted small", "Nothing run yet on this project."));
      table.append(tr);
    }
    for (const r of runs) {
      const tr = el("tr");
      tr.append(el("th", null, r.kind));
      tr.append(el("td", null, `${r.frames || "—"} frames`));
      tr.append(el("td", null, fmtDuration(r.elapsed_s)));
      tr.append(el("td", r.state === "error" ? "err" : "ok",
        r.state === "error" ? "failed" : `${r.per_frame_s ? (r.per_frame_s * 1000).toFixed(0) + "ms/f" : "done"}`));
      if (r.error) tr.title = r.error;
      table.append(tr);
    }
  } catch { /* no runs */ }

  try {
    const { notes } = await ctx.get(`/api/memory/notes/${ctx.S.projectId}`);
    const host = $("note-list");
    host.replaceChildren();
    for (const n of notes) {
      const row = el("div", "note-row");
      row.append(el("span", `tag by-${n.actor}`, ACTOR_LABEL[n.actor] ?? n.actor));
      row.append(el("span", "note-text", n.text));
      const del = el("button", "tool danger", "✕");
      del.onclick = async () => {
        await ctx.api(`/api/memory/notes/${n.id}`, { method: "DELETE" });
        refreshMemory();
      };
      row.append(del);
      host.append(row);
    }
  } catch { /* no notes */ }

  try {
    const { events } = await ctx.get(`/api/memory/events?project_id=${ctx.S.projectId}&limit=20`);
    const host = $("activity-list");
    host.replaceChildren();
    for (const e of events) {
      const row = el("div", "activity-row");
      row.append(el("span", `tag by-${e.actor}`, ACTOR_LABEL[e.actor] ?? e.actor));
      row.append(el("span", null, e.action.replace(/_/g, " ")));
      if (e.target) row.append(el("span", "muted small", e.target));
      host.append(row);
    }
  } catch { /* no events */ }
}

// ===========================================================================
// API key health
// ===========================================================================

export async function refreshKeyStatus(force = false) {
  const keyPill = $("key-pill");
  try {
    const st = await ctx.get(`/api/settings/api-key/status${force ? "?force=true" : ""}`);

    let state = "error";
    let message = "No Google AI credential. Everything deterministic still works; "
      + "the vision inspector, generative restoration and semantic subject naming do not.";
    // Order matters: an unconfigured key reports unreachable too, and the
    // useful thing to tell the operator is that there is no key, not that
    // Google could not be raised.
    if (!st.configured) {
      // the default above already says it
    } else if (st.verified === true && st.quota_exceeded) {
      state = "warn";
      message = "Google AI quota exhausted — deterministic work is unaffected.";
    } else if (st.verified === true && st.missing_models?.length) {
      state = "warn";
      message = `Credential valid, but ${st.missing_models.length} model(s) are unavailable to it.`;
    } else if (st.verified === true) {
      state = "ok";
      message = "Google AI credential verified.";
    } else if (st.reachable === false) {
      state = "warn";
      message = "Google is unreachable from this machine.";
    } else if (st.verified === false) {
      state = "error";
      message = `Google rejected the stored credential: ${st.message ?? "no reason given"}`;
    }

    ctx.setHealth("ai", state, message);

    if (keyPill) {
      keyPill.dataset.state = state === "ok" ? "ok" : "down";
      keyPill.textContent = st.configured ? `key ${st.masked}` : "not set";
    }
    const msg = $("key-message");
    if (msg) msg.textContent = st.message ?? "";

    const avail = $("model-availability");
    if (avail) {
      avail.replaceChildren();
      for (const [label, ok] of Object.entries(st.models_available ?? {})) {
        avail.append(el("span", `tag ${ok ? "ok" : "missing"}`,
          `${label.replace(/_/g, " ")}${ok ? " ✓" : " ✕"}`));
      }
    }
  } catch (err) {
    ctx.setHealth("ai", "error", `Could not check the credential: ${err.message}`);
  }
}

/** Encoder health. Missing ffmpeg is degraded, not fatal: export still runs. */
export function reportEncoder(info) {
  if (info?.available) {
    ctx.setHealth("encoder", "ok",
      `H.264 encoder available (${info.encoder} from ${info.source})`);
  } else {
    ctx.setHealth("encoder", "warn",
      info?.warning
      ?? "No ffmpeg on this machine — export falls back to the mp4v encoder, "
         + "which most browsers cannot play.");
  }
}

// ===========================================================================
// Inspector
// ===========================================================================

function openInspector() {
  if (!ctx.S.projectId) return;
  const root = location.pathname.startsWith("/desk") ? "/desk" : "";
  const url = `${root}/inspector.html?project=${encodeURIComponent(ctx.S.projectId)}&frame=${ctx.S.frame}`;
  if (W.inspector && !W.inspector.closed) {
    W.inspector.focus();
    broadcastProject();
    return;
  }
  W.inspector = window.open(url, "archive-inspector",
    "width=1400,height=920,menubar=no,toolbar=no,location=no,status=no");
  // The child announces itself over the channel once loaded; this is only a
  // fallback for a browser that blocks the handshake.
  setTimeout(broadcastProject, 900);
}

// ===========================================================================
// Wiring
// ===========================================================================

function wire() {
  initStripPointer();
  initFilterChips();
  window.addEventListener("resize", () => layoutStrip());

  $("btn-key-set")?.addEventListener("click", setKeyframe);
  $("btn-key-delete")?.addEventListener("click", deleteKeyframe);
  $("btn-key-check")?.addEventListener("click", checkPropagation);

  // -- sections ----------------------------------------------------------
  $("btn-seg-from-scenes")?.addEventListener("click", async () => {
    const replace = W.segments.length
      ? confirm("Replace the existing sections?\n\nOK replaces them, Cancel adds alongside.")
      : false;
    try {
      const r = await ctx.post(
        `/api/segments/${ctx.S.projectId}/from-scenes?replace=${replace}`, {});
      ctx.log(`created ${r.created} sections from detected shot boundaries`, "ok");
      await refreshSegments();
    } catch (err) {
      ctx.log(`could not build sections: ${err.message}`, "err");
    }
  });

  $("btn-seg-add")?.addEventListener("click", async () => {
    if (!W.marked) { ctx.log("drag on the section strip to mark a range first", "err"); return; }
    const a = Math.min(W.marked.start, W.marked.end);
    const b = Math.max(W.marked.start, W.marked.end);
    const name = prompt("Name this section:", `Frames ${a}–${b}`);
    if (name === null) return;
    const seg = await ctx.post("/api/segments",
      { project_id: ctx.S.projectId, start: a, end: b, name });
    W.marked = null;
    updateMarkedReadout();
    await refreshSegments();
    selectSegment(seg.id);
  });

  $("btn-seg-describe")?.addEventListener("click", describeSection);

  $("seg-name")?.addEventListener("change", (e) => patchSegment({ name: e.target.value }));
  $("seg-color")?.addEventListener("change", (e) => patchSegment({ color: e.target.value }));
  $("seg-start")?.addEventListener("change", (e) => patchSegment({ start: Number(e.target.value) }));
  $("seg-end")?.addEventListener("change", (e) => patchSegment({ end: Number(e.target.value) }));
  $("seg-enabled")?.addEventListener("change", (e) => patchSegment({ enabled: e.target.checked }));
  $("seg-lock")?.addEventListener("click", () => {
    const seg = selectedSegment();
    if (seg) patchSegment({ locked: !seg.locked });
  });
  $("seg-delete")?.addEventListener("click", async () => {
    const seg = selectedSegment();
    if (!seg || !confirm(`Delete section “${seg.name}”?`)) return;
    await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}`, { method: "DELETE" });
    W.selectedSegment = null;
    $("segment-editor").classList.add("hidden");
    await refreshSegments();
    ctx.requestPreview();
  });

  for (const field of ["content", "damage", "intent"]) {
    $(`spec-${field}`)?.addEventListener("change", (e) =>
      patchSegment({ spec: { [field]: e.target.value } }, "user"));
  }

  $("btn-seg-capture")?.addEventListener("click", () => {
    const seg = selectedSegment();
    if (!seg) return;
    patchSegment({ params: structuredClone(ctx.S.params) }, "user");
    ctx.log(`current slider values captured onto “${seg.name}”`, "ok");
  });
  $("btn-seg-clear-params")?.addEventListener("click", async () => {
    const seg = selectedSegment();
    if (!seg) return;
    // A merge cannot remove keys, so overrides are cleared by replacing the
    // whole section record's params through a direct write.
    await ctx.api(`/api/segments/${ctx.S.projectId}/${seg.id}`, {
      method: "PATCH",
      body: { changes: { params: {}, param_provenance: {} }, actor: "user" },
    });
    await refreshSegments();
    renderSegmentEditor();
  });

  $("btn-layer-add")?.addEventListener("click", () =>
    addLayerWithMask($("layer-mask-select").value, $("layer-mask-select").value || "Adjustment"));

  // -- colour ------------------------------------------------------------
  $("btn-colour-analyse")?.addEventListener("click", analyseColour);
  $("btn-colour-apply")?.addEventListener("click", applyColourSuggestion);
  $("btn-colour-match")?.addEventListener("click", matchColour);

  // -- vision ------------------------------------------------------------
  $("btn-detect")?.addEventListener("click", detectSubjects);
  $("btn-bg-plate")?.addEventListener("click", buildBackgroundPlate);
  $("btn-track-mask")?.addEventListener("click", trackMask);

  // -- interpolation -----------------------------------------------------
  $("btn-interp-candidates")?.addEventListener("click", findCandidates);
  $("btn-interp-preview")?.addEventListener("click", previewInterp);
  $("btn-interp-rebuild")?.addEventListener("click", rebuildFrames);
  $("btn-retime")?.addEventListener("click", retime);

  // -- memory ------------------------------------------------------------
  $("btn-add-note")?.addEventListener("click", async () => {
    const input = $("note-text");
    if (!input.value.trim() || !ctx.S.projectId) return;
    await ctx.post("/api/memory/notes", {
      project_id: ctx.S.projectId, text: input.value.trim(), actor: "user",
    });
    input.value = "";
    refreshMemory();
  });

  $("btn-check-key")?.addEventListener("click", () => refreshKeyStatus(true));
}

/**
 * Ask the vision model to describe the current section, writing its answer into
 * the spec fields tagged as AI-authored.
 */
async function describeSection() {
  const seg = selectedSegment();
  if (!seg) { ctx.log("select a section to describe", "err"); return; }
  const mid = Math.floor((seg.start + seg.end) / 2);
  ctx.log(`asking the model to describe “${seg.name}” from frame ${mid}…`);

  try {
    const digest = await ctx.get(`/api/memory/digest/${ctx.S.projectId}`);
    const r = await ctx.post("/api/ai/analyze-frame", {
      project_id: ctx.S.projectId,
      frame: mid,
      context: `${$("ai-context").value}\n\n${digest.text}`,
      model: $("ai-model").value,
      params: ctx.S.params,
    });

    await patchSegment({
      spec: {
        content: r.scene_description ?? "",
        damage: (r.inexistant_or_damaged_elements ?? []).join("; "),
        intent: r.recommended_adjustments?.rationale ?? "",
      },
    }, "ai");
    ctx.log(`“${seg.name}” described by ${r._model} — shown in AI colour for review`, "ok");
  } catch (err) {
    ctx.log(`could not describe the section: ${err.message}`, "err");
  }
}

export { refreshSegments, refreshMasks, refreshMemory, openInspector };
