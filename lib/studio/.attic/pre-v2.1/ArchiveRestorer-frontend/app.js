/**
 * app.js — Archive Film Restorer UI controller.
 *
 * Talks to the Python engine exclusively through the Deno proxy (same origin):
 *   /api/*  REST      /ws  progress stream      /shared/*  parameter schema
 *
 * Structure:
 *   State ─ Net ─ Controls ─ Viewer ─ Timeline ─ AI ─ Export ─ Boot
 *
 * Sections, layers, colour measurement, subject isolation, interpolation and
 * project memory live in workspace.js and attach through the bridge built at
 * the bottom of this file.
 */

import * as workspace from "./workspace.js";

// ===========================================================================
// State
// ===========================================================================

const S = {
  projectId: null,
  manifest: null,
  analysis: null,
  frameCount: 0,
  frame: 0,
  params: {},
  defaults: {},
  schema: null,
  view: "processed",          // processed | source | split
  tool: "pan",                // pan | roi | mask | erase
  roi: null,                  // {x,y,w,h} normalised
  splitAt: 0.5,
  splitAxis: "x",             // x | y
  brush: 48,
  live: true,
  busy: false,
  lastGenerated: null,
  imgProcessed: null,         // Image objects for the two views
  imgSource: null,
  workshopStep: null,
  workshopSteps: [],
  workshopWrap: true,
  maskCanvas: null,           // offscreen, frame-resolution
  frameW: 0,
  frameH: 0,

  // View transform. `zoom: null` means "fit"; anything else is an explicit
  // scale the operator chose, and the fit is no longer recomputed on resize.
  zoom: null,
  pan: { x: 0, y: 0 },
  peeking: false,             // momentary A/B: holding the key shows source
  playing: false,

  // Freshness of what is on screen: idle | live | computing | stale.
  freshness: "idle",
  previewedParams: null,

  // Neighbour comparison.
  neighbours: { on: false, distance: 1, operation: "none", tolerance: 0,
                lastMask: null, overlay: null, overlayOpacity: 0.55 },

  // Reframe rectangle is authored on the picture, not only with sliders.
  reframeEdit: false,

  // Camera roll, measured across the reel, and the level band.
  roll: null,
  showLevelBand: false,

  health: { engine: "unknown", encoder: "unknown", ai: "unknown" },
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// ===========================================================================
// Net
// ===========================================================================

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = data?.detail ?? `${res.status} ${res.statusText}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

const get = (p) => api(p);
const post = (p, body) => api(p, { method: "POST", body });

// ---------------------------------- log ------------------------------------
//
// The log used to grow without limit. It now lives inside a budget, and when
// it passes it the oldest lines are *folded* rather than dropped: the digest
// keeps the counts and the span, and errors are never folded at all, because
// the one line worth reading a week later is the one that failed.

const LOG_BUDGET = { lines: 400, chars: 120_000 };
const logState = { chars: 0, folded: 0, foldedFrom: null, errorsOnly: false };

function log(msg, kind = "") {
  const box = $("log");
  if (!box) return;
  const line = el("div", kind, `${new Date().toLocaleTimeString()}  ${msg}`);
  line.dataset.kind = kind || "info";
  if (logState.errorsOnly && kind !== "err") line.classList.add("hidden");
  box.prepend(line);
  logState.chars += msg.length + 12;
  if (box.childElementCount > LOG_BUDGET.lines || logState.chars > LOG_BUDGET.chars) {
    compactLog();
  }
}

/** Fold the oldest half of the log into one digest line, keeping every error. */
function compactLog(keep = Math.floor(LOG_BUDGET.lines / 2)) {
  const box = $("log");
  if (!box) return 0;
  const lines = [...box.children];
  if (lines.length <= keep) return 0;

  const victims = lines.slice(keep);
  const counts = { ok: 0, err: 0, info: 0 };
  let folded = 0;
  for (const node of victims) {
    if (node.dataset.kind === "err" || node.dataset.digest) continue;
    counts[node.dataset.kind === "ok" ? "ok" : "info"] += 1;
    folded += 1;
    node.remove();
  }
  if (!folded) return 0;

  logState.folded += folded;
  logState.foldedFrom ??= new Date().toLocaleTimeString();
  const existing = box.querySelector("[data-digest]");
  const text = `${logState.folded} earlier lines folded `
    + `(${counts.ok} ok, ${counts.info} info) — errors kept in full`;
  if (existing) {
    existing.textContent = text;
  } else {
    const digest = el("div", "sys", text);
    digest.dataset.digest = "1";
    box.append(digest);
  }
  logState.chars = Math.max(0, logState.chars - folded * 60);
  refreshLogBudget();
  return folded;
}

function refreshLogBudget() {
  const box = $("log-budget");
  if (!box) return;
  const lines = $("log")?.childElementCount ?? 0;
  const pct = Math.min(100, Math.round(100 * lines / LOG_BUDGET.lines));
  box.classList.toggle("over", pct >= 100);
  box.replaceChildren();
  box.append(el("div", null,
    `${lines} of ${LOG_BUDGET.lines} lines held in this window`
    + (logState.folded ? ` · ${logState.folded} folded into a digest` : "")));
  const bar = el("div", "bar");
  const fill = el("i");
  fill.style.width = `${pct}%`;
  bar.append(fill);
  box.append(bar);
  if (engineLogBudget) {
    box.append(el("div", "muted", engineLogBudget));
  }
}

let engineLogBudget = "";

/** The engine keeps its own durable log; this reports where that one stands. */
async function refreshEngineLogBudget() {
  try {
    const q = S.projectId ? `?project_id=${encodeURIComponent(S.projectId)}` : "";
    const st = await get(`/api/memory/log-stats${q}`);
    engineLogBudget =
      `engine store: ${st.records} of ${st.max_records} records, `
      + `${(st.bytes / 1024).toFixed(0)} of ${(st.max_bytes / 1024).toFixed(0)} kB`
      + (st.digests ? ` · ${st.digests} digest(s)` : "")
      + (st.over_budget ? " — over budget, will compact" : "");
  } catch {
    engineLogBudget = "engine store: unavailable";
  }
  refreshLogBudget();
}

// -------------------------------- health -----------------------------------
//
// One ring instead of three pills. Red means something is blocking work, amber
// means it will still run but worse, green means get on with it.

const HEALTH_COPY = {
  engine: { ok: "Engine reachable", warn: "Engine degraded", error: "Engine offline — nothing will run" },
  encoder: { ok: "H.264 encoder available", warn: "No ffmpeg — export falls back to the mp4v encoder, which most browsers cannot play", error: "No encoder" },
  ai: { ok: "Google AI credential verified", warn: "AI credential partially working", error: "No Google AI credential — the vision inspector, generative restoration and semantic subject naming are unavailable" },
};

function setHealth(part, state, message) {
  S.health[part] = state;
  S.health[`${part}_msg`] = message ?? HEALTH_COPY[part]?.[state] ?? "";
  renderHealth();
}

function worstHealth() {
  const parts = ["engine", "encoder", "ai"];
  if (parts.some((p) => S.health[p] === "error")) return "error";
  if (parts.some((p) => S.health[p] === "warn")) return "warn";
  if (parts.every((p) => S.health[p] === "ok")) return "ok";
  return "unknown";
}

function renderHealth() {
  const btn = $("btn-settings");
  if (!btn) return;
  const overall = worstHealth();
  btn.dataset.health = overall;

  const detail = ["engine", "encoder", "ai"]
    .filter((p) => S.health[p] !== "ok")
    .map((p) => S.health[`${p}_msg`] || p)
    .join(". ");
  btn.title = overall === "ok"
    ? "Settings — everything is ready"
    : `Settings — ${detail}`;
  btn.setAttribute("aria-label", btn.title);

  const line = $("health-line");
  if (!line) return;
  line.replaceChildren();
  for (const part of ["engine", "encoder", "ai"]) {
    const row = el("div", "hl");
    const dot = el("span", `dot ${S.health[part]}`);
    row.append(dot, el("span", null,
      S.health[`${part}_msg`] || HEALTH_COPY[part]?.[S.health[part]] || `${part}: unknown`));
    line.append(row);
  }
}

/**
 * Open Settings on the pane that needs attention.
 *
 * The ring is a call to action, so activating it must land on the offending
 * subsystem rather than making the operator hunt for it. A missing credential
 * is answered in Credentials; an absent encoder or an unreachable engine is
 * explained in Diagnostics.
 */
function openSettings(pane) {
  const target = pane
    ? (pane.startsWith("pane-") ? pane : `pane-${pane}`)
    : S.health.ai !== "ok" ? "pane-credentials"
    : (S.health.engine !== "ok" || S.health.encoder !== "ok") ? "pane-diagnostics"
    : "pane-credentials";
  showSettingsPane(target);
  $("modal-settings").classList.remove("hidden");
  workspace.refreshMemory();
  refreshEngineLogBudget();
}

function showSettingsPane(id) {
  document.querySelectorAll("#modal-settings .pane").forEach((p) =>
    p.classList.toggle("hidden", p.id !== id));
  document.querySelectorAll("#modal-settings .tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.pane === id));
}

// -------------------------------- WebSocket --------------------------------

let ws = null;
let wsRetry = 0;

function connectWS() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => { wsRetry = 0; log("progress channel connected", "ok"); };

  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    handleEvent(m);
  };

  ws.onclose = () => {
    // Exponential backoff so a stopped engine does not spin the browser.
    wsRetry = Math.min(wsRetry + 1, 6);
    setTimeout(connectWS, 400 * 2 ** wsRetry);
  };
  ws.onerror = () => ws.close();
}

function handleEvent(m) {
  switch (m.type) {
    case "progress": showProgress(m); break;
    case "job_started": log(`${m.kind} started`); break;
    case "job_done":
      hideProgress();
      log(`${m.kind} finished`, "ok");
      if (m.kind === "analyze") loadAnalysis();
      if (m.kind === "render") {
        refreshExportInfo();
        const r = m.result ?? {};
        log(`${r.rendered} frames written to ${r.dir}`, "ok");
      }
      if (m.kind === "encode") {
        refreshExportInfo();
        const r = m.result ?? {};
        log(`video written: ${r.path} (${r.size_mb} MB, ${r.encoder})`, "ok");
      }
      if (m.kind === "roll") {
        loadRoll();
        const r = m.result ?? {};
        log(`camera roll measured — worst tilt ${r.max_abs}°, mean ${r.mean}°`, "ok");
      }
      if (m.kind === "reconstruct") {
        const r = m.result ?? {};
        log(`${r.repaired} frames rebuilt (${r.skipped} left alone as barely damaged), `
            + `${r.mean_transplanted_pct}% of repaired pixels came from real neighbours — ${r.dir}`, "ok");
      }
      workspace.onJobDone(m.kind, m.result);
      break;
    case "job_error":
      hideProgress();
      log(`${m.kind} failed: ${m.error}`, "err");
      // A failed encode leaves the rendered frames intact, so the expensive
      // half of the work is still on disk and only the mux needs retrying.
      alert(m.kind === "encode"
        ? `Encoding failed:\n\n${m.error}\n\nThe rendered frames are still on `
          + `disk — reopen Export and press "Encode only" to retry the mux.`
        : `${m.kind} failed:\n\n${m.error}`);
      refreshExportInfo();
      break;
    case "chain_aborted":
      hideProgress();
      log(`${m.skipped} was skipped because ${m.failed} failed`, "err");
      refreshExportInfo();
      break;
    case "params_suggested":
      S.params = m.params;
      renderControls();
      log("auto-calibration applied from measured sequence statistics", "ok");
      break;
    case "project_ready":
      openProject(m.project_id);
      break;
    case "engine_unreachable":
      setHealth("engine", "error");
      break;
  }
}

function showProgress(m) {
  $("progress-bar").classList.remove("hidden");
  $("progress-fill").style.width = `${m.percent ?? 0}%`;
  const eta = m.eta_s ? ` · eta ${Math.round(m.eta_s)}s` : "";
  $("progress-text").textContent =
    `${m.phase} ${m.current ?? 0}/${m.total ?? 0} — ${(m.percent ?? 0).toFixed(1)}%${eta}`;
}
function hideProgress() {
  $("progress-bar").classList.add("hidden");
  $("progress-fill").style.width = "0%";
}


// ===========================================================================
// Parameter controls — generated from /shared/controls.json
// ===========================================================================

function paramValue(section, key) {
  return S.params?.[section]?.[key] ?? S.defaults?.[section]?.[key];
}

function setParam(section, key, value) {
  S.params[section] ??= {};
  S.params[section][key] = value;
  workspace.onParamsChange(S.params);
  markStale();
  schedulePersistParams();
  scheduleWorkshopParams();
}

let persistParamsTimer = 0;
function schedulePersistParams() {
  if (!S.projectId) return;
  clearTimeout(persistParamsTimer);
  persistParamsTimer = setTimeout(() => {
    post("/api/project/params", { project_id: S.projectId, params: S.params })
      .catch(() => {});
  }, 700);
}

/** Same-origin bridge to the Workshop parent when Desk is an iframe. */
function embedMode() {
  try {
    return new URLSearchParams(location.search).get("embed") || "";
  } catch {
    return "";
  }
}

function isGradeEmbed() {
  return embedMode() === "1" && window.parent !== window;
}

function isWorkshopEmbed() {
  const mode = embedMode();
  return (mode === "1" || mode === "tools") && window.parent !== window;
}

function isToolsEmbed() {
  return embedMode() === "tools" && window.parent !== window;
}

function applyWorkshopStep(msg) {
  if (!isGradeEmbed()) return;
  S.workshopStep = msg.step && typeof msg.step === "object" ? msg.step : null;
  S.workshopSteps = Array.isArray(msg.steps) ? msg.steps : [];
  if (typeof msg.wrap === "boolean") S.workshopWrap = msg.wrap;
  renderGradeStep();
  renderControls();
  const kind = S.workshopStep?.kind;
  if (kind === "source") setView("source");
  else if (kind === "stage" || kind === "output" || kind === "stack") setView("processed");
}

function renderGradeStep() {
  const host = $("grade-step");
  if (!host) return;

  const rail = $("grade-step-rail");
  const label = $("grade-step-label");
  const bypassWrap = $("grade-step-bypass-wrap");
  const bypass = $("grade-step-bypass");
  const loop = $("grade-loop");
  const wrapBox = $("grade-loop-wrap");
  if (rail) {
    rail.replaceChildren();
    for (const step of S.workshopSteps) {
      const chip = el("button", `grade-chip${step.id === S.workshopStep?.id ? " is-on" : ""}${step.muted ? " is-muted" : ""}`);
      chip.type = "button";
      chip.textContent = step.label || step.type;
      chip.title = step.muted ? `${step.label} — bypassed` : (step.label || step.type);
      chip.style.setProperty("--chip-accent", step.colour || "var(--accent)");
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(step.id === S.workshopStep?.id));
      chip.onclick = () => postToWorkshop("select-node", { nodeId: step.id });
      rail.append(chip);
    }
  }

  const step = S.workshopStep;
  if (!step) {
    if (label) {
      label.textContent = S.workshopSteps.length
        ? "Select a node on the canvas to grade that step"
        : "Drop a node from the library — Grade follows the selection";
    }
    if (bypassWrap) bypassWrap.hidden = true;
    if (loop) loop.hidden = true;
    return;
  }

  if (label) {
    if (step.kind === "stage") {
      label.textContent = `Grading ${step.label}`;
    } else if (step.kind === "source") {
      label.textContent = `${step.label} — source picture and play`;
    } else if (step.kind === "stack") {
      const n = step.bodyCount ?? 0;
      label.textContent = `Loop · ${n} node${n === 1 ? "" : "s"} per slice`;
    } else if (step.kind === "output") {
      label.textContent = `${step.label} — restored result`;
    } else {
      label.textContent = `${step.label} — knobs stay in Inspect`;
    }
  }

  if (bypassWrap && bypass) {
    const canBypass = step.kind === "stage" || step.kind === "other";
    bypassWrap.hidden = !canBypass;
    bypass.checked = Boolean(step.muted);
  }
  if (loop && wrapBox) {
    loop.hidden = step.kind !== "stack";
    wrapBox.checked = Boolean(S.workshopWrap);
  }
}

function bindGradeStepChrome() {
  const bypass = $("grade-step-bypass");
  if (bypass) {
    bypass.addEventListener("change", () => {
      const step = S.workshopStep;
      if (!step?.id) return;
      postToWorkshop("mute-step", { nodeId: step.id, muted: bypass.checked });
      if (step.engineStage) setParam(step.engineStage, "enabled", !bypass.checked);
    });
  }
  const wrapBox = $("grade-loop-wrap");
  if (wrapBox) {
    wrapBox.addEventListener("change", () => {
      postToWorkshop("set-wrap", { wrap: wrapBox.checked });
    });
  }
  const evalBtn = $("grade-loop-eval");
  if (evalBtn) {
    evalBtn.addEventListener("click", () => {
      const step = S.workshopStep;
      postToWorkshop("evaluate-loop", { nodeId: step?.id || "" });
    });
  }
}

let applyingWorkshop = false;
let workshopParamsTimer = 0;

function postToWorkshop(type, extra = {}) {
  if (!isWorkshopEmbed()) return;
  try {
    window.parent.postMessage({
      source: "ars-workshop",
      type,
      frame: S.frame,
      params: S.params,
      projectId: S.projectId,
      ...extra,
    }, location.origin);
  } catch {
    /* parent gone */
  }
}

function scheduleWorkshopParams() {
  if (applyingWorkshop || !isWorkshopEmbed()) return;
  clearTimeout(workshopParamsTimer);
  workshopParamsTimer = setTimeout(() => postToWorkshop("params"), 80);
}

function mergeWorkshopParams(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  applyingWorkshop = true;
  for (const [sec, bag] of Object.entries(incoming)) {
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) continue;
    S.params[sec] = { ...(S.params[sec] || {}), ...bag };
  }
  renderControls();
  requestPreview();
  applyingWorkshop = false;
}

function bindWorkshop() {
  if (!isWorkshopEmbed()) return;
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.source !== "ars-workshop" || !msg.type) return;
    if (msg.type === "set-frame") {
      gotoFrame(Number(msg.frame) || 0, true);
      return;
    }
    if (msg.type === "set-params") {
      mergeWorkshopParams(msg.params);
      return;
    }
    if (msg.type === "set-project") {
      const pid = String(msg.projectId || "");
      if (pid && pid !== S.projectId) {
        void openProject(pid);
      } else {
        postToWorkshop("ready");
      }
      return;
    }
    if (msg.type === "open-export") {
      refreshExportInfo();
      $("modal-export").classList.remove("hidden");
      return;
    }
    if (msg.type === "open-file") {
      $("modal-open").classList.remove("hidden");
      browseTo("~/Desktop");
      return;
    }
    if (msg.type === "refresh") {
      if (!isToolsEmbed()) void refreshPreview();
      return;
    }
    if (msg.type === "desk-cmd" && msg.cmd === "reframe-edit") {
      if (!isToolsEmbed()) setReframeEdit(Boolean(msg.on));
      return;
    }
    if (msg.type === "request-state") {
      postToWorkshop("params");
      return;
    }
    if (msg.type === "focus-card") {
      focusDeskCard(String(msg.card || ""));
      return;
    }
    if (msg.type === "focus-section") {
      focusDeskSection(String(msg.section || ""));
      return;
    }
    if (msg.type === "set-step") {
      applyWorkshopStep(msg);
      return;
    }
    if (msg.type === "play") {
      setPlaying(true);
      return;
    }
    if (msg.type === "pause") {
      setPlaying(false);
      return;
    }
    if (msg.type === "toggle-play") {
      setPlaying(!S.playing);
    }
  });
}

function focusDeskCard(name) {
  if (!name) return;
  const el = document.getElementById(`card-${name}`) ||
    document.querySelector(`[data-card="${name}"]`);
  if (!(el instanceof HTMLDetailsElement) && !(el instanceof HTMLElement)) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ block: "start", behavior: "smooth" });
}

function focusDeskSection(key) {
  if (!key) return;
  const tryFocus = () => {
    const el = document.querySelector(`.psec[data-key="${key}"]`);
    if (!el) return false;
    el.classList.add("open");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  };
  if (!tryFocus()) setTimeout(tryFocus, 400);
}

function shouldShow(section, ctl) {
  if (!ctl.showIf) return true;
  return Object.entries(ctl.showIf).every(([k, v]) => paramValue(section, k) === v);
}

function renderControls() {
  const host = $("param-sections");
  const openState = new Map(
    [...host.querySelectorAll(".psec")].map((n) => [n.dataset.key, n.classList.contains("open")]),
  );
  host.replaceChildren();
  const focusKey = isGradeEmbed() ? (S.workshopStep?.engineStage || "") : "";
  const paramsBox = $("params");
  if (paramsBox) {
    paramsBox.classList.toggle("is-step-empty", isGradeEmbed() && !focusKey);
    paramsBox.classList.toggle("is-step-stage", isGradeEmbed() && Boolean(focusKey));
  }
  const paramsTitle = paramsBox?.querySelector(".params-head h3");
  if (paramsTitle) {
    paramsTitle.textContent = isGradeEmbed() && focusKey ? "This step" : "Pipeline parameters";
  }
  if (!S.schema) return;

  for (const sec of S.schema.sections) {
    const enabled = paramValue(sec.key, "enabled") !== false;
    const focused = Boolean(focusKey) && sec.key === focusKey;
    const wrap = el(
      "div",
      `psec${openState.get(sec.key) || focused ? " open" : ""}${enabled ? "" : " off"}${focused ? " is-focus" : ""}`,
    );
    wrap.dataset.key = sec.key;

    const head = el("div", "psec-head");
    head.append(el("span", "caret", "▶"));
    if (!(isGradeEmbed() && focused)) {
      const toggle = el("input");
      toggle.type = "checkbox";
      toggle.checked = enabled;
      toggle.title = `Enable ${sec.label}`;
      toggle.onclick = (e) => {
        e.stopPropagation();
        setParam(sec.key, "enabled", toggle.checked);
        wrap.classList.toggle("off", !toggle.checked);
        requestPreview();
      };
      head.append(toggle);
    }
    head.append(el("h4", null, sec.label));
    head.onclick = () => wrap.classList.toggle("open");
    wrap.append(head);

    const body = el("div", "psec-body");
    if (sec.hint) body.append(el("p", "psec-hint", sec.hint));

    for (const ctl of sec.controls) {
      if (!shouldShow(sec.key, ctl)) continue;
      body.append(buildControl(sec, ctl));
    }
    wrap.append(body);
    host.append(wrap);
  }
}

function buildControl(sec, ctl) {
  const box = el("div", "ctl");
  const value = paramValue(sec.key, ctl.key);

  if (ctl.type === "toggle") {
    const lab = el("label", "chk");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = Boolean(value);
    cb.onchange = () => { setParam(sec.key, ctl.key, cb.checked); renderControls(); requestPreview(); };
    lab.append(cb, el("span", null, ctl.label));
    box.append(lab);
    return box;
  }

  if (ctl.type === "select") {
    const label = el("div", "ctl-label");
    label.append(el("span", null, ctl.label));
    box.append(label);
    const sel = el("select");
    for (const o of ctl.options) {
      const opt = el("option", null, o);
      opt.value = o;
      if (o === value) opt.selected = true;
      sel.append(opt);
    }
    sel.onchange = () => { setParam(sec.key, ctl.key, sel.value); renderControls(); requestPreview(); };
    box.append(sel);
    if (ctl.help) box.append(el("div", "ctl-help", ctl.help));
    return box;
  }

  if (ctl.type === "number") {
    const label = el("div", "ctl-label");
    label.append(el("span", null, ctl.label));
    box.append(label);
    const inp = el("input");
    inp.type = "number";
    inp.min = ctl.min; inp.max = ctl.max; inp.step = ctl.step;
    inp.value = value;
    inp.onchange = () => { setParam(sec.key, ctl.key, Number(inp.value)); requestPreview(); };
    box.append(inp);
    return box;
  }

  // range
  const scale = ctl.scale ?? 1;
  const label = el("div", "ctl-label");
  const readout = el("b", null, fmt(value, scale, ctl.unit));
  label.append(el("span", null, ctl.label), readout);
  box.append(label);

  const inp = el("input");
  inp.type = "range";
  inp.min = ctl.min; inp.max = ctl.max; inp.step = ctl.step;
  inp.value = value;
  inp.oninput = () => {
    const v = Number(inp.value);
    readout.textContent = fmt(v, scale, ctl.unit);
    setParam(sec.key, ctl.key, v);
    requestPreview();
  };
  box.append(inp);
  if (ctl.help) box.append(el("div", "ctl-help", ctl.help));
  return box;
}

function fmt(v, scale, unit) {
  if (typeof v !== "number") return String(v);
  const scaled = v * scale;
  const txt = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(scaled < 10 ? 2 : 1);
  return unit ? `${txt}${unit}` : txt;
}

// ===========================================================================
// Viewer
// ===========================================================================

const wrap = () => $("canvas-wrap");
const imgCanvas = () => $("canvas-image");
const ovCanvas = () => $("canvas-overlay");

// ---------------------------------------------------------------------------
// View transform
//
// Wheel and pinch inside the picture used to scale the whole application,
// which is useless: 8mm damage is a few pixels across and has to be magnified
// *in place*. Zoom is anchored at the cursor, so the pixel under the pointer
// stays under the pointer, and it is purely a view transform — mask and ROI
// coordinates are still stored in source-image space.
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.1, ZOOM_MAX = 16;

/** Scale at which the frame just fits the viewport. */
function fitScale() {
  const box = wrap().getBoundingClientRect();
  if (!S.frameW || !S.frameH) return 1;
  return Math.max(0.01, Math.min((box.width - 24) / S.frameW,
                                 (box.height - 24) / S.frameH));
}

const currentScale = () => S.zoom ?? fitScale();

/** Image coordinates (0..1) under a client point. */
function screenToImage(clientX, clientY) {
  const box = wrap().getBoundingClientRect();
  const scale = currentScale();
  const cx = box.left + box.width / 2 + S.pan.x;
  const cy = box.top + box.height / 2 + S.pan.y;
  return {
    x: (clientX - cx) / (S.frameW * scale) + 0.5,
    y: (clientY - cy) / (S.frameH * scale) + 0.5,
  };
}

/** Zoom to `scale`, keeping the image point `anchor` under the same pixel. */
function setScale(scale, anchor, clientX, clientY) {
  const next = clamp(scale, ZOOM_MIN, ZOOM_MAX);
  const box = wrap().getBoundingClientRect();
  S.zoom = next;
  if (anchor) {
    S.pan.x = clientX - (box.left + box.width / 2) - (anchor.x - 0.5) * S.frameW * next;
    S.pan.y = clientY - (box.top + box.height / 2) - (anchor.y - 0.5) * S.frameH * next;
  }
  layoutCanvases();
  updateZoomReadout();
}

function resetView() {
  S.zoom = null;
  S.pan = { x: 0, y: 0 };
  layoutCanvases();
  updateZoomReadout();
}

function updateZoomReadout() {
  const box = $("zoom-readout");
  if (!box) return;
  box.textContent = S.zoom === null ? "fit" : `${S.zoom.toFixed(S.zoom < 1 ? 2 : 1)}×`;
}

function layoutCanvases() {
  if (!S.frameW) return;
  const scale = currentScale();
  const w = S.frameW * scale, h = S.frameH * scale;
  for (const c of [imgCanvas(), ovCanvas()]) {
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.style.transform = `translate(${S.pan.x}px, ${S.pan.y}px)`;
    // Grain and dust are the subject at high magnification; smoothing them
    // away would hide exactly what the operator zoomed in to judge.
    c.style.imageRendering = scale >= 2 ? "pixelated" : "auto";
    c.width = S.frameW;
    c.height = S.frameH;
  }
  drawViewer();
}

function initZoom() {
  const box = wrap();

  box.addEventListener("wheel", (e) => {
    // Always swallow the gesture over the canvas: letting it reach the browser
    // is what used to scale the entire application.
    e.preventDefault();
    if (!S.frameW) return;
    const anchor = screenToImage(e.clientX, e.clientY);
    // Continuous, not a preset ladder — trackpads deliver fractional deltas
    // and a ladder makes them feel broken.
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
    setScale(currentScale() * factor, anchor, e.clientX, e.clientY);
  }, { passive: false });

  // Safari raises its own pinch events, which bypass `wheel` entirely.
  let gestureStart = 1;
  box.addEventListener("gesturestart", (e) => {
    e.preventDefault();
    gestureStart = currentScale();
  });
  box.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    if (!S.frameW) return;
    setScale(gestureStart * e.scale,
             screenToImage(e.clientX, e.clientY), e.clientX, e.clientY);
  });
  box.addEventListener("gestureend", (e) => e.preventDefault());

  box.addEventListener("dblclick", (e) => {
    e.preventDefault();
    resetView();
  });
}

/** Select a view mode, keeping the tablist and the canvas in agreement. */
function setView(view) {
  S.view = view;
  for (const b of document.querySelectorAll(".seg-btn")) {
    const on = b.dataset.view === view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $("btn-split-axis")?.classList.toggle("hidden", view !== "split");
  drawViewer();
}

function drawViewer() {
  const c = imgCanvas();
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  const proc = S.imgProcessed, src = S.imgSource;
  // The momentary peek overrides the tab without changing it: press to see the
  // film, release and you are back where you were.
  const view = S.peeking ? "source" : S.view;

  if (view === "source" && src) {
    ctx.drawImage(src, 0, 0, c.width, c.height);
  } else if (view === "split" && proc && src) {
    drawSplit(ctx, c, src, proc);
  } else if (proc) {
    ctx.drawImage(proc, 0, 0, c.width, c.height);
  }

  // The combination of this frame with a neighbour is an overlay, not a
  // replacement of either pane — the triptych stays the two neighbours.
  const ov = S.neighbours.overlay;
  if (ov && S.neighbours.overlayOpacity > 0 && S.neighbours.operation !== "none") {
    ctx.save();
    ctx.globalAlpha = S.neighbours.overlayOpacity;
    ctx.drawImage(ov, 0, 0, c.width, c.height);
    ctx.restore();
  }
  drawOverlay();
}

function drawSplit(ctx, c, src, proc) {
  const vertical = S.splitAxis === "y";
  const pos = Math.round((vertical ? c.height : c.width) * S.splitAt);

  ctx.drawImage(src, 0, 0, c.width, c.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(vertical ? 0 : pos, vertical ? pos : 0,
           vertical ? c.width : c.width - pos,
           vertical ? c.height - pos : c.height);
  ctx.clip();
  ctx.drawImage(proc, 0, 0, c.width, c.height);
  ctx.restore();

  // An explicit handle, because a two-pixel line is not something anyone can
  // reliably grab, least of all while zoomed in.
  const grip = Math.max(9, Math.round(c.width * 0.008));
  ctx.strokeStyle = "#ffb454";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (vertical) { ctx.moveTo(0, pos); ctx.lineTo(c.width, pos); }
  else { ctx.moveTo(pos, 0); ctx.lineTo(pos, c.height); }
  ctx.stroke();

  ctx.fillStyle = "#ffb454";
  const hx = vertical ? c.width / 2 : pos;
  const hy = vertical ? pos : c.height / 2;
  ctx.beginPath();
  ctx.arc(hx, hy, grip, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#201503";
  ctx.font = `bold ${grip}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(vertical ? "⇕" : "⇔", hx, hy);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const label = (text, x, y) => {
    ctx.font = "13px monospace";
    const pad = 6, w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(x, y, w, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + pad, y + 14);
  };
  if (vertical) {
    label("SOURCE", 8, 8);
    label("RESTORED", 8, c.height - 28);
  } else {
    label("SOURCE", 8, 8);
    label("RESTORED", c.width - 96, 8);
  }
}

function drawOverlay() {
  const c = ovCanvas();
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  if (S.maskCanvas) {
    ctx.globalAlpha = 0.45;
    ctx.drawImage(S.maskCanvas, 0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
  }
  if (S.roi) {
    const { x, y, w, h } = S.roi;
    ctx.strokeStyle = "#58c9d8";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(x * c.width, y * c.height, w * c.width, h * c.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(88,201,216,.12)";
    ctx.fillRect(x * c.width, y * c.height, w * c.width, h * c.height);
  }
  drawReframeGuide(ctx, c);
}

/**
 * Show where the film ends and invention would begin.
 *
 * The outline is the extent the camera actually photographed, placed inside
 * the recomposed frame. Everything shaded outside it is the generation region:
 * area no negative covers, which the mosaic fill or an outpaint must answer.
 */
function drawReframeGuide(ctx, c) {
  const r = reframeRect();
  if (!r) return;

  ctx.save();
  ctx.fillStyle = "rgba(214,92,72,.18)";
  ctx.beginPath();
  ctx.rect(0, 0, c.width, c.height);
  ctx.rect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height);
  ctx.fill("evenodd");

  ctx.strokeStyle = "#e8b64c";
  ctx.lineWidth = S.reframeEdit ? 2.5 : 2;
  ctx.setLineDash(S.reframeEdit ? [] : [10, 6]);
  ctx.strokeRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height);

  if (S.reframeEdit) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#e8b64c";
    const hs = Math.max(5, Math.round(c.width * 0.012));
    for (const [hx, hy] of [
      [r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h],
    ]) {
      ctx.fillRect(hx * c.width - hs, hy * c.height - hs, hs * 2, hs * 2);
    }
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(0,0,0,.65)";
    const label = "FILM";
    const tw = ctx.measureText(label).width + 10;
    const lx = r.x * c.width + 6, ly = r.y * c.height + 6;
    ctx.fillRect(lx, ly, tw, 16);
    ctx.fillStyle = "#e8b64c";
    ctx.fillText(label, lx + 5, ly + 12);
  }
  ctx.restore();
}

function ensureMaskCanvas() {
  if (!S.maskCanvas || S.maskCanvas.width !== S.frameW || S.maskCanvas.height !== S.frameH) {
    const c = document.createElement("canvas");
    c.width = S.frameW; c.height = S.frameH;
    S.maskCanvas = c;
  }
  return S.maskCanvas;
}

function clearMask() {
  if (!S.maskCanvas) return;
  const ctx = S.maskCanvas.getContext("2d");
  ctx.clearRect(0, 0, S.maskCanvas.width, S.maskCanvas.height);
  drawOverlay();
}

function maskIsEmpty() {
  if (!S.maskCanvas) return true;
  const d = S.maskCanvas.getContext("2d")
    .getImageData(0, 0, S.maskCanvas.width, S.maskCanvas.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
  return true;
}

// ------------------------------ pointer input ------------------------------

function canvasPoint(ev) {
  const r = ovCanvas().getBoundingClientRect();
  return {
    x: clamp((ev.clientX - r.left) / r.width, 0, 1),
    y: clamp((ev.clientY - r.top) / r.height, 0, 1),
  };
}

/** Whether a pointer is close enough to the wipe to be grabbing it. */
function nearSplitHandle(e) {
  if (S.view !== "split") return false;
  const r = ovCanvas().getBoundingClientRect();
  const along = S.splitAxis === "y"
    ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
  const px = Math.abs(along - S.splitAt) * (S.splitAxis === "y" ? r.height : r.width);
  return px < 22;
}

function initPointer() {
  const ov = ovCanvas();
  let mode = null, roiStart = null, panStart = null, reframeDrag = null;

  const paint = (p) => {
    const c = ensureMaskCanvas();
    const ctx = c.getContext("2d");
    ctx.globalCompositeOperation = S.tool === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = "#e0685f";
    ctx.beginPath();
    ctx.arc(p.x * c.width, p.y * c.height, S.brush / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    drawOverlay();
  };

  const moveSplit = (e) => {
    const r = ov.getBoundingClientRect();
    S.splitAt = clamp(S.splitAxis === "y"
      ? (e.clientY - r.top) / r.height
      : (e.clientX - r.left) / r.width, 0.02, 0.98);
    drawViewer();
  };

  ov.addEventListener("pointerdown", (e) => {
    if (!S.frameW) return;
    ov.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);

    if (nearSplitHandle(e)) { mode = "split"; moveSplit(e); return; }

    const rfHit = S.reframeEdit ? reframeHandleAt(p) : null;
    if (rfHit) {
      mode = "reframe";
      reframeDrag = { handle: rfHit, start: p, rect: { ...reframeRect() } };
      return;
    }

    if (S.tool === "roi") {
      mode = "roi"; roiStart = p;
      S.roi = { x: p.x, y: p.y, w: 0, h: 0 };
      drawOverlay();
    } else if (S.tool === "mask" || S.tool === "erase") {
      mode = "paint"; paint(p);
    } else {
      mode = "pan";
      panStart = { x: e.clientX - S.pan.x, y: e.clientY - S.pan.y };
      wrap().classList.add("grabbing");
    }
  });

  ov.addEventListener("pointermove", (e) => {
    if (!mode) {
      if (nearSplitHandle(e)) {
        ov.style.cursor = S.splitAxis === "y" ? "ns-resize" : "ew-resize";
      } else if (S.reframeEdit) {
        const hit = reframeHandleAt(canvasPoint(e));
        ov.style.cursor = hit === "body" ? "move"
          : hit ? "nwse-resize" : "";
      } else {
        ov.style.cursor = "";
      }
      return;
    }
    if (mode === "split") { moveSplit(e); return; }
    if (mode === "reframe" && reframeDrag) {
      applyReframeDrag(reframeDrag, canvasPoint(e));
      return;
    }
    const p = canvasPoint(e);
    if (mode === "roi" && roiStart) {
      S.roi = {
        x: Math.min(roiStart.x, p.x), y: Math.min(roiStart.y, p.y),
        w: Math.abs(p.x - roiStart.x), h: Math.abs(p.y - roiStart.y),
      };
      drawOverlay();
    } else if (mode === "paint") {
      paint(p);
    } else if (mode === "pan") {
      // Panning at fit scale would slide the picture off centre for no gain,
      // so the first drag implicitly commits to the current magnification.
      S.zoom ??= fitScale();
      S.pan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
      layoutCanvases();
    }
  });

  const release = () => {
    mode = null;
    reframeDrag = null;
    wrap().classList.remove("grabbing");
    if (S.tool === "roi" && S.roi && (S.roi.w < 0.01 || S.roi.h < 0.01)) {
      S.roi = null;
      drawOverlay();
    }
  };
  ov.addEventListener("pointerup", release);
  ov.addEventListener("pointercancel", release);

  new ResizeObserver(() => layoutCanvases()).observe(wrap());
}

// ------------------------------ preview fetch ------------------------------

const requestPreview = debounce(() => { if (S.live) refreshPreview(); }, 220);

/**
 * Say whether the restored frame on screen reflects the current settings.
 *
 * With live preview off, or between a slider moving and the render landing,
 * what is displayed is a *previous* answer. Grading against it is the most
 * expensive mistake this interface can invite, so it is stated outright.
 */
function setFreshness(state) {
  S.freshness = state;
  const box = $("view-control");
  const label = $("freshness");
  if (!box || !label) return;
  box.dataset.freshness = state;
  label.textContent = {
    idle: "—", live: "current", computing: "computing…",
    stale: "stale", peek: "source",
  }[state] ?? state;
  label.title = {
    live: "This is the restoration as currently configured.",
    computing: "Recomputing with the settings you just changed.",
    stale: "Settings changed since this frame was rendered — press ⏎ or re-enable live preview.",
    peek: "Holding the source for comparison; release to return.",
    idle: "Nothing rendered yet.",
  }[state] ?? "";
}

function markStale() {
  if (S.peeking) return;
  const same = JSON.stringify(S.params) === JSON.stringify(S.previewedParams);
  if (!same && S.freshness !== "computing") setFreshness("stale");
}

async function refreshPreview() {
  if (isToolsEmbed()) {
    postToWorkshop("refresh");
    return;
  }
  if (!S.projectId || S.busy) return;
  S.busy = true;
  setFreshness("computing");
  $("preview-spinner").classList.remove("hidden");
  try {
    const r = await post("/api/pipeline/preview", {
      project_id: S.projectId,
      frame: S.frame,
      params: S.params,
      include_source: true,
      max_edge: 1400,
    });

    const [proc, src] = await Promise.all([loadImage(r.image), loadImage(r.source)]);
    const first = !S.frameW;
    S.imgProcessed = proc;
    S.imgSource = src;
    S.frameW = r.width; S.frameH = r.height;
    if (first) layoutCanvases(); else drawViewer();

    const m = r.report.metrics ?? {};
    const s = r.source_metrics ?? {};
    $("viewer-meta").textContent =
      `${r.width}×${r.height} · ${r.elapsed_ms}ms · ` +
      `sharp ${fmtN(s.tenengrad)}→${fmtN(m.tenengrad)} · ` +
      `contrast ${fmtN(s.contrast)}→${fmtN(m.contrast)} · ` +
      `noise ${fmtN(s.noise)}→${fmtN(m.noise)}`;
    $("viewer-empty").classList.add("hidden");
    showHud();

    S.previewedParams = structuredClone(S.params);
    setFreshness(S.peeking ? "peek" : "live");
    describeApplied(r.report);
    workspace.onPreview(r);
    if (S.neighbours.on) refreshNeighbours();
  } catch (err) {
    setFreshness("stale");
    log(`preview failed: ${err.message}`, "err");
  } finally {
    S.busy = false;
    $("preview-spinner").classList.add("hidden");
  }
}

/**
 * State what is actually being applied, so the gap between source and restored
 * is attributable rather than merely visible.
 */
function describeApplied(report) {
  const box = $("applied-summary");
  if (!box) return;
  const stages = (report?.stages ?? []).map((s) => s.stage);
  const bits = [`${stages.length} stage${stages.length === 1 ? "" : "s"}`];

  const context = workspace.frameContext(S.frame);
  if (context.section) bits.push(`§ ${context.section.name}`);
  if (context.overrides) bits.push(`${context.overrides} override(s)`);
  if (context.layers) bits.push(`${context.layers} layer(s)`);
  if (context.keyframed) bits.push("key-framed");
  if (report?.ai_frame || context.aiFrame) bits.push("AI frame");
  if (report?.synthetic_fraction) {
    bits.push(`${(report.synthetic_fraction * 100).toFixed(1)}% synthesised`);
  }

  box.textContent = bits.join(" · ");
  box.title = stages.length
    ? `Active pipeline stages: ${stages.join(", ")}`
    : "No pipeline stage is enabled — the restored view equals the source.";
  showHud();
}

function showHud() {
  const hud = $("viewer-hud");
  if (!hud) return;
  const meta = $("viewer-meta")?.textContent ?? "";
  const applied = $("applied-summary")?.textContent ?? "";
  hud.classList.toggle("hidden", (!meta || meta === "—") && !applied);
}

const fmtN = (v) => (typeof v === "number" ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) : "—");

function loadImage(src) {
  return new Promise((res, rej) => {
    if (!src) return res(null);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image decode failed"));
    i.src = src;
  });
}

// ===========================================================================
// Timeline
// ===========================================================================

function renderFilmstrip() {
  const strip = $("filmstrip");
  strip.replaceChildren();
  if (!S.projectId) return;

  const frames = S.analysis?.frames ?? [];
  const total = S.frameCount;
  const maxThumbs = 160;
  const stride = Math.max(1, Math.ceil(total / maxThumbs));

  for (let i = 0; i < total; i += stride) {
    const meta = frames[i];
    const t = el("div", "thumb");
    t.dataset.index = i;
    if (i === S.frame) t.classList.add("active");
    if (meta?.is_cut) t.classList.add("cut");
    if (meta && meta.selected === false) t.classList.add("deselected");

    // The section's colour rides the thumbnail's spine, so scrubbing the strip
    // shows the reel's structure rather than an undifferentiated ribbon.
    const run = workspace.runAt(i);
    if (run?.segment_id) {
      t.style.setProperty("--seg-color", run.color);
      t.title = `${run.name} (${run.start}–${run.end})`;
    }
    if (!workspace.passesFilter(i)) t.classList.add("filtered-out");

    const img = el("img");
    img.loading = "lazy";
    img.src = `/api/project/${S.projectId}/frame/${i}?max_edge=150`;
    t.append(img, el("span", "n", String(i)));
    if (meta?.verdict) t.append(el("div", `vd ${meta.verdict}`));
    t.onclick = () => gotoFrame(i);
    strip.append(t);
  }
}

/** Name the governing section over the picture itself. */
function updateSectionBadge() {
  const badge = $("section-badge");
  if (!badge) return;
  const run = workspace.runAt(S.frame);
  if (!run?.segment_id) { badge.classList.add("hidden"); return; }
  badge.classList.remove("hidden");
  badge.style.setProperty("--seg-color", run.color);
  badge.textContent = `${run.name} · ${run.start}–${run.end}`;
  badge.title = "The section whose treatment governs this frame. "
    + "Parameter changes captured onto it affect this whole range.";
}

// ===========================================================================
// Neighbour comparison and frame algebra
// ===========================================================================
//
// A frame cannot be judged alone. A stable interior and a whip-pan want
// completely different treatment, and neither is legible from a single image —
// so the neighbours are shown alongside, and their distance from the frame in
// hand is measured *after* registration, so camera movement is not mistaken
// for a change of content.

function toggleNeighbours(force) {
  S.neighbours.on = force ?? !S.neighbours.on;
  $("neighbours").classList.toggle("hidden", !S.neighbours.on);
  $("btn-neighbours").classList.toggle("active", S.neighbours.on);
  // Deliberately does not touch zoom, pan, mask or the active view mode.
  if (!S.neighbours.on) {
    S.neighbours.overlay = null;
    drawViewer();
  }
  layoutCanvases();
  if (S.neighbours.on) refreshNeighbours();
}

async function refreshNeighbours() {
  if (!S.neighbours.on || !S.projectId) return;
  const d = S.neighbours.distance;

  for (const [id, offset] of [["nb-prev", -d], ["nb-next", d]]) {
    const index = S.frame + offset;
    const fig = $(id).closest(".nb");
    const run = workspace.runAt(index);
    fig.style.setProperty("--nb-color", run?.color ?? "transparent");
    fig.querySelector(".nb-label").textContent =
      index < 0 || index >= S.frameCount
        ? `${offset < 0 ? "before" : "after"} the reel`
        : `frame ${index}${run?.segment_id ? ` · ${run.name}` : ""}`;
    drawNeighbour(id, index);
  }

  try {
    const r = await post("/api/frames/divergence", {
      project_id: S.projectId, frame: S.frame, offsets: [-d, d],
      tolerance: S.neighbours.tolerance || null,
    });
    for (const nb of r.neighbours) {
      const id = nb.offset < 0 ? "nb-prev-stats" : "nb-next-stats";
      const fig = $(id).closest(".nb");
      if (!nb.available) {
        $(id).textContent = "outside the sequence";
        fig.classList.remove("cut");
        continue;
      }
      fig.classList.toggle("cut", Boolean(nb.crosses_cut));
      $(id).textContent =
        `rms ${nb.rms} · ${nb.disagreement_pct}% differ · ${nb.displacement_px ?? "—"}px`;
      $(id).title =
        `Residual difference ${nb.rms} after registration, `
        + `${nb.disagreement_pct}% of pixels beyond a tolerance of ${nb.tolerance}, `
        + `camera moved ${nb.displacement_px ?? "?"}px.`
        + (nb.crosses_cut
          ? " A scene cut lies between these frames — this comparison is meaningless "
            + "and no temporal tool will use it."
          : "");
    }
  } catch (err) {
    log(`divergence unavailable: ${err.message}`, "err");
  }

  if (S.neighbours.operation !== "none") runAlgebra();
}

function drawNeighbour(canvasId, index) {
  const c = $(canvasId);
  const ctx = c.getContext("2d");
  if (index < 0 || index >= S.frameCount) {
    c.width = 16; c.height = 9;
    ctx.clearRect(0, 0, c.width, c.height);
    return;
  }
  const img = new Image();
  img.onload = () => {
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
  };
  img.src = `/api/project/${S.projectId}/frame/${index}?max_edge=520`;
}

/**
 * Run one of the four set operations against the chosen neighbour.
 *
 * The result goes three ways at the operator's choice — looked at, committed
 * as a matte, or handed to the reconstruction engine as the repair region —
 * which is why one call returns both a picture and a mask.
 */
async function runAlgebra() {
  const op = S.neighbours.operation;
  if (op === "none" || !S.projectId) {
    $("btn-nb-commit").disabled = true;
    $("btn-nb-repair").disabled = true;
    S.neighbours.overlay = null;
    drawViewer();
    return;
  }
  const note = $("nb-note");
  note.textContent = "combining…";
  try {
    const r = await post("/api/frames/compare", {
      project_id: S.projectId,
      frame: S.frame,
      offset: S.neighbours.distance,
      operation: op,
      tolerance: S.neighbours.tolerance || null,
      use_processed: false,
    });
    S.neighbours.lastResult = r;
    // A result the engine could not register describes camera movement, not
    // content, so it may be looked at but not turned into a matte or a repair.
    const usable = r.registered !== false && !r.crosses_cut;
    $("btn-nb-commit").disabled = !usable;
    $("btn-nb-repair").disabled = !usable;

    const img = new Image();
    img.onload = () => {
      S.neighbours.overlay = img;
      drawViewer();
    };
    img.src = r.image;

    const pct = (r.disagreement * 100).toFixed(2);
    note.textContent = r.crosses_cut
      ? `A cut lies between these frames — this result means nothing. ${pct}% differ.`
      : r.reason
      ? r.reason
      : `${pct}% of the frame in ${op === "intersect" ? "disagreement" : "the result"}, `
        + `tolerance ${r.tolerance} (from the measured noise floor).`;
    note.classList.toggle("warn", !usable);
    $("nb-tol-val").textContent = S.neighbours.tolerance
      ? String(S.neighbours.tolerance) : `auto ${r.tolerance}`;
  } catch (err) {
    note.textContent = err.message;
  }
}

async function commitAlgebraMask() {
  const op = S.neighbours.operation;
  if (op === "none") return;
  const maskId = `algebra-${op}-${S.frame}`;
  try {
    await post("/api/frames/compare", {
      project_id: S.projectId, frame: S.frame,
      offset: S.neighbours.distance, operation: op,
      tolerance: S.neighbours.tolerance || null,
      commit_mask: maskId,
    });
    await workspace.refreshMasks();
    log(`“${maskId}” stored as a matte — attach it to a layer from Subject Isolation`, "ok");
  } catch (err) {
    log(`could not store the matte: ${err.message}`, "err");
  }
}

// The information band under the picture. Its upper two thirds carry the
// per-frame quality and luminance curves; its lower third, when armed, is the
// level band: a continuous trace of how far the camera was off level, grey at
// zero and saturating to red as the applied rotation grows, with a draggable
// reference line declaring where true level actually is.

const GRAPH_H = 104;
const BAND_H = 34;                 // height of the level band at the bottom
const ROLL_RANGE = 10;             // degrees mapped across the band, ±

function graphGeometry(c) {
  const W = c.clientWidth;
  const bandTop = GRAPH_H - BAND_H;
  return { W, H: GRAPH_H, bandTop, bandMid: bandTop + BAND_H / 2 };
}

function rollColour(magnitude) {
  // Grey at rest, deepening to red as the correction grows. Reading the worst
  // passages should not require reading any numbers.
  const t = clamp(Math.abs(magnitude) / 6, 0, 1);
  const r = Math.round(122 + t * 133);
  const g = Math.round(122 - t * 66);
  const b = Math.round(122 - t * 74);
  return `rgb(${r},${g},${b})`;
}

function renderQualityGraph() {
  const c = $("quality-graph");
  if (!c) return;
  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  c.width = c.clientWidth * dpr;
  c.height = GRAPH_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { W, H, bandTop, bandMid } = graphGeometry(c);

  ctx.clearRect(0, 0, W, H);
  const frames = S.analysis?.frames;
  const n = S.frameCount || frames?.length || 0;
  const x = (i) => (i / Math.max(n - 1, 1)) * W;

  // Section colour behind everything, so a glance at the band says which
  // treatment governs which stretch of the reel.
  for (const run of workspace.coverageRuns()) {
    if (!run.segment_id) continue;
    ctx.fillStyle = run.color;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(x(run.start), 0, Math.max(x(run.end + 1) - x(run.start), 1),
                 S.showLevelBand ? bandTop : H);
    ctx.globalAlpha = 1;
  }

  if (!frames?.length) {
    ctx.fillStyle = "#6a7382";
    ctx.font = "11px monospace";
    ctx.fillText("run analysis to see per-frame quality", 12, 40);
    if (S.showLevelBand) drawLevelBand(ctx, c);
    return;
  }

  const plotH = S.showLevelBand ? bandTop : H;
  const y = (s) => plotH - 8 - (s / 100) * (plotH - 16);

  ctx.fillStyle = "rgba(181,126,224,.14)";
  for (const f of frames) if (f.is_cut) ctx.fillRect(x(f.index) - 1, 0, 2, plotH);

  for (const [s, col] of [[55, "rgba(78,201,138,.25)"], [32, "rgba(224,104,95,.25)"]]) {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y(s)); ctx.lineTo(W, y(s)); ctx.stroke();
  }

  ctx.beginPath();
  frames.forEach((f, i) => {
    const px = x(i), py = y(f.quality_score ?? 0);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 1.4; ctx.stroke();

  ctx.beginPath();
  frames.forEach((f, i) => {
    const px = x(i), py = y((f.metrics.brightness / 255) * 100);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.strokeStyle = "rgba(88,201,216,.55)"; ctx.lineWidth = 1; ctx.stroke();

  // Frames the filter has excluded are veiled here as well as in the strip,
  // so all three surfaces agree about what is currently in play.
  const excluded = workspace.excludedRanges();
  if (excluded.length) {
    ctx.fillStyle = "rgba(8,9,12,.72)";
    for (const [a, b] of excluded) {
      ctx.fillRect(x(a), 0, Math.max(x(b + 1) - x(a), 1), plotH);
    }
  }

  if (S.showLevelBand) drawLevelBand(ctx, c);

  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x(S.frame), 0); ctx.lineTo(x(S.frame), H); ctx.stroke();
}

function drawLevelBand(ctx, c) {
  const { W, bandTop, bandMid } = graphGeometry(c);
  const n = S.frameCount || 1;
  const x = (i) => (i / Math.max(n - 1, 1)) * W;
  const yFor = (deg) => bandMid - clamp(deg / ROLL_RANGE, -1, 1) * (BAND_H / 2 - 3);

  ctx.fillStyle = "#0b0d11";
  ctx.fillRect(0, bandTop, W, BAND_H);
  ctx.strokeStyle = "#1e222a";
  ctx.beginPath(); ctx.moveTo(0, bandTop + .5); ctx.lineTo(W, bandTop + .5); ctx.stroke();

  const angles = S.roll?.angles;
  if (!angles?.length) {
    ctx.fillStyle = "#6a7382";
    ctx.font = "9.5px monospace";
    ctx.fillText("press “Measure roll” to trace the camera’s tilt across the reel",
                 8, bandMid + 3);
    drawLevelReference(ctx, c);
    return;
  }

  const reference = levelReference();
  const step = Math.max(1, Math.floor(angles.length / Math.max(W, 1)));

  // Filled area between the measured tilt and the declared level, coloured by
  // how much rotation that difference implies.
  for (let i = 0; i < angles.length - step; i += step) {
    const deg = angles[i];
    const px = x(i), pw = Math.max(x(i + step) - px, 1);
    ctx.fillStyle = rollColour(deg - reference);
    ctx.globalAlpha = 0.55;
    const y0 = yFor(reference), y1 = yFor(deg);
    ctx.fillRect(px, Math.min(y0, y1), pw, Math.max(Math.abs(y1 - y0), 1));
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  for (let i = 0; i < angles.length; i += step) {
    const px = x(i), py = yFor(angles[i]);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.strokeStyle = "#d9705b";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  drawLevelReference(ctx, c);
}

function drawLevelReference(ctx, c) {
  const { W, bandMid } = graphGeometry(c);
  const reference = levelReference();
  const y = bandMid - clamp(reference / ROLL_RANGE, -1, 1) * (BAND_H / 2 - 3);

  ctx.save();
  ctx.strokeStyle = "#9aa3b2";
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#9aa3b2";
  ctx.font = "9px monospace";
  ctx.fillText(`true level ${reference.toFixed(1)}°`, 6, y - 4);
}

/** The declared true level for the frame on screen, section overrides first. */
function levelReference() {
  const seg = workspace.sectionAt(S.frame);
  const fromSection = seg?.params?.level?.reference;
  if (typeof fromSection === "number") return fromSection;
  return Number(S.params?.level?.reference ?? 0);
}

function initGraphPointer() {
  const c = $("quality-graph");
  if (!c) return;
  let dragging = false;

  const onReference = (e) => {
    if (!S.showLevelBand) return false;
    const r = c.getBoundingClientRect();
    const { bandMid } = graphGeometry(c);
    const y = ((e.clientY - r.top) / r.height) * GRAPH_H;
    const refY = bandMid - clamp(levelReference() / ROLL_RANGE, -1, 1) * (BAND_H / 2 - 3);
    return Math.abs(y - refY) < 8;
  };

  const setReference = (e) => {
    const r = c.getBoundingClientRect();
    const { bandMid } = graphGeometry(c);
    const y = ((e.clientY - r.top) / r.height) * GRAPH_H;
    const deg = clamp(-(y - bandMid) / (BAND_H / 2 - 3) * ROLL_RANGE,
                      -ROLL_RANGE, ROLL_RANGE);
    applyLevelReference(Math.round(deg * 10) / 10);
  };

  c.addEventListener("pointerdown", (e) => {
    if (onReference(e)) {
      dragging = true;
      c.setPointerCapture(e.pointerId);
      setReference(e);
      return;
    }
    const n = S.frameCount;
    if (!n) return;
    const r = c.getBoundingClientRect();
    gotoFrame(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
  });

  c.addEventListener("pointermove", (e) => {
    if (dragging) { setReference(e); return; }
    c.style.cursor = onReference(e) ? "ns-resize" : "pointer";
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    // The reference is a statement about this shot, so it is written onto the
    // section rather than the whole reel wherever a section owns the frame.
    workspace.commitLevelReference(levelReference());
    requestPreview();
  };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
}

function applyLevelReference(deg) {
  setParam("level", "reference", deg);
  setParam("level", "enabled", true);
  renderQualityGraph();
  updateRollReadout();
}

function updateRollReadout() {
  const box = $("roll-readout");
  if (!box) return;
  if (!S.roll?.angles?.length) { box.textContent = ""; return; }
  const measured = S.roll.angles[S.frame] ?? 0;
  const reference = levelReference();
  const correction = -(measured - reference);
  const confidence = S.roll.confidence?.[S.frame];
  box.textContent =
    `frame ${S.frame}: measured ${measured.toFixed(2)}°, `
    + `correcting ${correction >= 0 ? "+" : ""}${correction.toFixed(2)}°`
    + (confidence !== undefined ? ` · ${Math.round(confidence * 100)}% confident` : "");
  box.style.color = rollColour(correction);
}

async function loadRoll() {
  if (!S.projectId) return;
  try {
    const r = await get(`/api/geometry/roll/${S.projectId}`);
    S.roll = r.measured ? r : null;
    if (S.roll) {
      S.showLevelBand = true;
      $("chk-level-band").checked = true;
    }
  } catch { S.roll = null; }
  renderQualityGraph();
  updateRollReadout();
}

function gotoFrame(i, fromInspector = false) {
  S.frame = clamp(i, 0, Math.max(0, S.frameCount - 1));
  $("frame-number").value = S.frame;
  document.querySelectorAll(".thumb").forEach((t) =>
    t.classList.toggle("active", Number(t.dataset.index) === S.frame));
  updateFrameBadges();
  renderQualityGraph();
  updateRollReadout();
  updateSectionBadge();
  clearMask();
  S.lastGenerated = null;
  $("btn-reblend").disabled = true;
  refreshPreview();
  if (S.neighbours.on) refreshNeighbours();
  // Guard against a ping-pong when the move originated in the Inspector.
  if (!fromInspector) workspace.onFrameChange(S.frame);
  else workspace.drawStrip();
  if (!fromInspector) postToWorkshop("frame");
}

let playTimer = 0;
let playToken = 0;

function setPlaying(on) {
  if (isToolsEmbed()) return;
  const want = Boolean(on) && Boolean(S.projectId) && (S.frameCount || 0) > 1;
  S.playing = want;
  playToken += 1;
  const btn = $("btn-play");
  if (btn) {
    btn.textContent = S.playing ? "⏸" : "▶";
    btn.classList.toggle("active", S.playing);
  }
  clearInterval(playTimer);
  playTimer = 0;
  postToWorkshop("playing", { on: S.playing });
  if (!S.playing) {
    if (S.projectId) void refreshPreview();
    return;
  }
  const fps = 12;
  playTimer = setInterval(() => {
    if (!S.playing) return;
    const n = Math.max(1, S.frameCount || 1);
    const next = (S.frame + 1) % n;
    void playToFrame(next);
  }, 1000 / fps);
}

async function playToFrame(i) {
  if (!S.playing) return;
  const token = playToken;
  S.frame = clamp(i, 0, Math.max(0, S.frameCount - 1));
  const num = $("frame-number");
  if (num) num.value = S.frame;
  document.querySelectorAll(".thumb").forEach((t) =>
    t.classList.toggle("active", Number(t.dataset.index) === S.frame));
  updateFrameBadges();
  updateSectionBadge();
  if (!S.playing || token !== playToken) return;
  postToWorkshop("frame");
  if (!S.projectId) return;
  try {
    const img = await loadImage(`/api/project/${S.projectId}/frame/${S.frame}?max_edge=900`);
    if (!S.playing || token !== playToken || !img) return;
    S.imgSource = img;
    if (!S.imgProcessed) S.imgProcessed = img;
    if (!S.frameW) {
      S.frameW = img.naturalWidth;
      S.frameH = img.naturalHeight;
      layoutCanvases();
    }
    const empty = $("viewer-empty");
    if (empty) empty.classList.add("hidden");
    drawViewer();
  } catch {
    /* keep last picture */
  }
}

// ===========================================================================
// Damage reconstruction
// ===========================================================================

function damageOptions() {
  return {
    project_id: S.projectId,
    frame: S.frame,
    radius: Number($("dmg-radius").value),
    min_area: Number($("dmg-area").value),
    regrain: $("dmg-regrain").checked,
  };
}

async function detectDamage() {
  if (!S.projectId) return;
  const box = $("dmg-result");
  box.textContent = "looking for emulsion loss…";
  try {
    const r = await post("/api/damage/detect", damageOptions());
    box.replaceChildren();
    if (!r.regions?.length) {
      box.append(el("p", "muted small",
        r.reason ?? "Nothing here is damaged beyond what the defect stage handles."));
      return;
    }
    box.append(el("p", null,
      `${r.region_count} region(s), ${r.damaged_pct}% of the frame, `
      + `judged against ${r.neighbours} registered neighbour(s) at tolerance ${r.tolerance}.`));
    const img = el("img");
    img.src = r.mask;
    img.alt = "Detected damage mask";
    box.append(img);
  } catch (err) {
    box.textContent = err.message;
  }
}

async function repairDamage() {
  if (!S.projectId) return;
  const box = $("dmg-result");
  box.textContent = "rebuilding from neighbouring frames…";
  try {
    const body = damageOptions();
    if ($("dmg-use-mask").checked) {
      if (maskIsEmpty()) {
        box.textContent = "Paint a mask first, or untick “use the mask I painted”.";
        return;
      }
      body.mask_png_base64 = S.maskCanvas.toDataURL("image/png");
    }
    const r = await post("/api/damage/repair", body);
    box.replaceChildren();
    if (!r.repaired_pct) {
      box.append(el("p", "muted small", r.detected?.reason
        ?? "Nothing needed rebuilding on this frame."));
      return;
    }
    const img = el("img");
    img.src = r.image;
    img.alt = "Rebuilt frame";
    box.append(img);

    const split = el("div", "dmg-split");
    split.append(
      el("span", null, `repaired ${r.repaired_pct}%`),
      el("span", null, `from film: ${r.transplanted_pct}%`),
      el("span", null, `synthesised: ${r.synthesised_pct}%`));
    box.append(split);
    box.append(el("p", "muted small",
      r.sources?.length
        ? `Sourced from frame offset ${r.sources.map((s) => s.offset).join(", ")}. `
          + `Synthesised pixels are the ones no neighbour ever observed.`
        : "No neighbour observed these regions, so all of it is synthesis."));
  } catch (err) {
    box.textContent = err.message;
  }
}

async function repairRange() {
  if (!S.projectId) return;
  const [start, end] = workspace.activeRange();
  if (!confirm(
    `Rebuild damaged frames from ${start} to ${end}?\n\n`
    + `Results are written to a separate "reconstructed" folder — the `
    + `extraction is never overwritten.`)) return;
  try {
    await post("/api/damage/repair-range", {
      project_id: S.projectId, start, end,
      radius: Number($("dmg-radius").value),
      min_area: Number($("dmg-area").value),
    });
    log(`rebuilding frames ${start}–${end}…`);
  } catch (err) {
    log(`could not start the rebuild: ${err.message}`, "err");
  }
}

// ===========================================================================
// Reframe and outpaint
// ===========================================================================

function reframeOptions() {
  return {
    project_id: S.projectId,
    frame: S.frame,
    zoom: Number($("rf-zoom").value),
    offset_x: Number($("rf-x").value),
    offset_y: Number($("rf-y").value),
    fill: $("rf-fill").value,
    params: S.params,
  };
}

/**
 * Where the source frame lands inside the recomposed one, normalised 0–1.
 *
 * Returns null while the framing is untouched, or while it only crops — the
 * guide is worth drawing precisely when the declared composition is larger
 * than the film and a margin is therefore exposed.
 */
function reframeRect() {
  const zoom = Number($("rf-zoom")?.value ?? 1);
  const ox = Number($("rf-x")?.value ?? 0);
  const oy = Number($("rf-y")?.value ?? 0);
  if (!S.reframeEdit && zoom >= 0.999) return null;
  return {
    x: (1 - zoom) / 2 + ox,
    y: (1 - zoom) / 2 + oy,
    w: zoom, h: zoom,
  };
}

/** Which part of the gold rectangle is under a normalised image point. */
function reframeHandleAt(p) {
  const r = reframeRect();
  if (!r) return null;
  const hit = 0.028;
  const corners = [
    ["nw", r.x, r.y],
    ["ne", r.x + r.w, r.y],
    ["sw", r.x, r.y + r.h],
    ["se", r.x + r.w, r.y + r.h],
  ];
  for (const [name, hx, hy] of corners) {
    if (Math.hypot(p.x - hx, p.y - hy) < hit) return name;
  }
  if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return "body";
  return null;
}

function writeReframeSliders(zoom, ox, oy) {
  zoom = clamp(zoom, 0.5, 1.5);
  ox = clamp(ox, -0.3, 0.3);
  oy = clamp(oy, -0.3, 0.3);
  $("rf-zoom").value = zoom;
  $("rf-x").value = ox;
  $("rf-y").value = oy;
  syncReframeReadout();
}

function syncReframeFromParams() {
  const rf = S.params?.reframe;
  if (!rf || !$("rf-zoom")) return;
  $("rf-zoom").value = rf.zoom ?? 1;
  $("rf-x").value = rf.offset_x ?? 0;
  $("rf-y").value = rf.offset_y ?? 0;
  if (rf.fill) $("rf-fill").value = rf.fill;
  syncReframeReadout();
}

function syncReframeReadout() {
  if (!$("rf-zoom-val")) return;
  $("rf-zoom-val").textContent = Number($("rf-zoom").value).toFixed(2);
  $("rf-x-val").textContent = Number($("rf-x").value).toFixed(3);
  $("rf-y-val").textContent = Number($("rf-y").value).toFixed(3);
  drawOverlay();
}

/**
 * Resize keeps the opposite corner planted and the aspect of the frame, so
 * the declared composition never shears.
 */
function applyReframeDrag(drag, p) {
  const r = drag.rect;
  const dx = p.x - drag.start.x;
  const dy = p.y - drag.start.y;
  if (drag.handle === "body") {
    writeReframeSliders(r.w, r.x + dx - (1 - r.w) / 2, r.y + dy - (1 - r.h) / 2);
    return;
  }
  const right = r.x + r.w, bottom = r.y + r.h;
  let nx = r.x, ny = r.y, nRight = right, nBottom = bottom;
  if (drag.handle.includes("w")) nx = r.x + dx;
  if (drag.handle.includes("e")) nRight = right + dx;
  if (drag.handle.includes("n")) ny = r.y + dy;
  if (drag.handle.includes("s")) nBottom = bottom + dy;
  const zoom = clamp(Math.max(nRight - nx, nBottom - ny), 0.5, 1.5);
  // Plant the opposite corner.
  let x = r.x, y = r.y;
  if (drag.handle.includes("e")) x = right - zoom;
  if (drag.handle.includes("s")) y = bottom - zoom;
  if (drag.handle.includes("w")) x = nx;
  if (drag.handle.includes("n")) y = ny;
  writeReframeSliders(zoom, x - (1 - zoom) / 2, y - (1 - zoom) / 2);
}

function setReframeEdit(on) {
  S.reframeEdit = on;
  $("btn-rf-edit")?.classList.toggle("active", on);
  if (isToolsEmbed()) {
    postToWorkshop("desk-cmd", { cmd: "reframe-edit", on: Boolean(on) });
    return;
  }
  wrap()?.classList.toggle("reframe", on);
  if (on) {
    // A full-frame rectangle has nothing to grab; pull back a hair so the
    // handles sit inside the picture.
    if (Number($("rf-zoom").value) >= 0.999) writeReframeSliders(0.92, 0, 0);
    document.querySelectorAll(".card").forEach((c) => {
      if (c.querySelector("summary")?.textContent.includes("Reframe")) c.open = true;
    });
  }
  drawOverlay();
}

async function previewReframe() {
  if (!S.projectId) return;
  const box = $("rf-result");
  box.textContent = "recomposing…";
  try {
    const r = await post("/api/reframe/preview", reframeOptions());
    S.imgProcessed = await loadImage(r.image);
    setView("processed");
    drawViewer();
    setFreshness("live");
    box.replaceChildren();
    const pct = (r.margin_fraction * 100).toFixed(1);
    box.append(el("p", "small", r.margin_fraction > 0
      ? `${pct}% of this framing lies outside the film. `
        + ($("rf-fill").value === "mosaic"
          ? "It has been filled from what neighbouring frames photographed."
          : "It is filled by reflection, which is a placeholder rather than a repair.")
      : "This framing stays inside the film — nothing is invented."));
    if (r.margin_fraction > 0.25) {
      box.append(el("p", "muted small",
        "That is a great deal of invented picture. Consider pulling back less, "
        + "or outpainting with the model."));
    }
  } catch (err) {
    box.textContent = err.message;
  }
}

/** Write the framing into the parameters, so the whole section inherits it. */
function applyReframe() {
  setParam("reframe", "enabled", true);
  setParam("reframe", "zoom", Number($("rf-zoom").value));
  setParam("reframe", "offset_x", Number($("rf-x").value));
  setParam("reframe", "offset_y", Number($("rf-y").value));
  setParam("reframe", "fill", $("rf-fill").value);
  renderControls();
  markStale();
  refreshPreview();
  const seg = workspace.sectionAt?.(S.frame);
  log(seg
    ? `framing applied — pin it as a key frame to hold it across “${seg.name}”`
    : "framing applied", "ok");
}

async function outpaintMargin() {
  if (!S.projectId) return;
  const box = $("rf-result");
  if (S.health.ai === "error") {
    box.textContent = "Outpainting needs a Google AI credential. "
      + "Without one the mosaic fill is the honest option.";
    openSettings("credentials");
    return;
  }
  box.textContent = "asking the model to extend the frame…";
  try {
    const r = await post("/api/reframe/outpaint", {
      ...reframeOptions(),
      positive_prompt: $("prompt-positive")?.value ?? "",
      negative_prompt: $("prompt-negative")?.value ?? "",
      influence: Number($("gen-influence")?.value ?? 0.85),
    });
    S.imgProcessed = await loadImage(r.blended);
    setView("processed");
    drawViewer();
    setFreshness("live");
    box.textContent = `${(r.margin_fraction * 100).toFixed(1)}% of the frame `
      + `was extended by ${r.model}, blended into the photography rather than `
      + `pasted over it. Move the AI influence slider under Generative `
      + `Restoration to re-blend without spending another call.`;
  } catch (err) {
    box.textContent = err.message;
  }
}

function updateFrameBadges() {
  const meta = S.analysis?.frames?.[S.frame];
  const v = $("frame-verdict"), sc = $("frame-score");
  if (!meta) { v.textContent = "—"; v.className = "badge"; sc.textContent = "—"; return; }
  v.textContent = meta.verdict ?? "—";
  v.className = `badge ${meta.verdict ?? ""}`;
  sc.textContent = `${(meta.quality_score ?? 0).toFixed(1)}`;
  $("chk-selected").checked = meta.selected !== false;
}

// ===========================================================================
// Project loading
// ===========================================================================

async function openProject(pid) {
  const info = await get(`/api/project/${pid}`);
  S.projectId = pid;
  S.manifest = info.manifest;
  S.frameCount = info.frame_count;
  S.params = info.manifest.params ?? structuredClone(S.defaults);
  S.frame = 0;
  S.frameW = 0;
  syncReframeFromParams();
  syncBlueprintLink();

  $("project-label").textContent =
    `${info.manifest.source_name} · ${info.frame_count} frames · ` +
    `${(info.manifest.fps ?? 0).toFixed(2)} fps`;
  $("frame-total").textContent = `/ ${info.frame_count - 1}`;
  $("btn-export").disabled = false;
  $("btn-inspector").disabled = false;

  renderControls();
  await loadAnalysis();
  await workspace.onProjectOpen();
  renderFilmstrip();
  await loadRoll();
  gotoFrame(0);
  refreshEngineLogBudget();
  log(`project "${pid}" opened`, "ok");
  postToWorkshop("ready");
}

async function loadAnalysis() {
  if (!S.projectId) return;
  try {
    S.analysis = await get(`/api/project/${S.projectId}/analysis`);
    const g = S.analysis.global;
    log(`analysis: keep ${g.keep} / review ${g.review} / drop ${g.drop} · ` +
        `flicker ±${g.flicker_amplitude}`);
    renderFilmstrip();
    renderQualityGraph();
    updateFrameBadges();
    workspace.onAnalysis();
  } catch {
    S.analysis = null;   // not analysed yet — the graph shows its own hint
  }
}

// ===========================================================================
// AI panel
// ===========================================================================

async function analyzeFrame() {
  if (!S.projectId) return alert("Load a video first.");
  const btn = $("btn-analyze-frame");
  btn.disabled = true;
  btn.textContent = "Analysing…";
  try {
    const r = await post("/api/ai/analyze-frame", {
      project_id: S.projectId,
      frame: S.frame,
      roi: $("ai-use-roi").checked ? S.roi : null,
      context: $("ai-context").value,
      model: $("ai-model").value,
      params: S.params,
      use_processed: true,
    });
    showAnalysis(r.analysis);
    log(`Gemini analysed frame ${S.frame}`, "ok");
  } catch (err) {
    log(`AI analysis failed: ${err.message}`, "err");
    alert(`AI analysis failed:\n\n${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Analyse current frame";
  }
}

let lastRecs = null;

function showAnalysis(a) {
  $("ai-result").classList.remove("hidden");
  $("ai-scene").textContent = a.scene_description ?? "";
  $("ai-history").textContent = a.historical_context ?? "";
  $("ai-severity").textContent = `severity ${a.damage_severity ?? "?"}/10`;

  const ul = $("ai-damage");
  ul.replaceChildren();
  for (const d of a.inexistant_or_damaged_elements ?? []) ul.append(el("li", null, d));

  const recs = a.recommended_adjustments ?? {};
  lastRecs = recs;
  $("ai-rationale").textContent = recs.rationale ?? "";
  const table = $("ai-recs");
  table.replaceChildren();
  for (const [k, v] of Object.entries(recs)) {
    if (k === "rationale") continue;
    const tr = el("tr");
    tr.append(el("td", null, k.replace(/_/g, " ")), el("td", null, String(v)));
    table.append(tr);
  }

  $("prompt-positive").value = a.suggested_positive_prompt ?? "";
  $("prompt-negative").value = a.suggested_negative_prompt ?? "";
  $("ai-color-notes").textContent = a.colorization_notes ?? "";
}

function applyRecommendations() {
  if (!lastRecs) return;
  const map = {
    clahe_clip_limit: ["clahe", "clip_limit"],
    deflicker_window: ["deflicker", "window"],
    denoise_strength: ["denoise", "h_luma"],
    sharpen_amount: ["sharpen", "amount"],
    gamma: ["levels", "gamma"],
  };
  let n = 0;
  for (const [key, [sec, field]] of Object.entries(map)) {
    const v = lastRecs[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      setParam(sec, field, v);
      setParam(sec, "enabled", true);
      n++;
    }
  }
  renderControls();
  refreshPreview();
  log(`applied ${n} AI-recommended parameter values`, "ok");
}

async function generateFrame() {
  if (!S.projectId) return alert("Load a video first.");
  const positive = $("prompt-positive").value.trim();
  if (!positive) return alert("Write or generate a positive prompt first.");

  const btn = $("btn-generate");
  btn.disabled = true;
  btn.textContent = "Generating…";
  try {
    const body = {
      project_id: S.projectId,
      frame: S.frame,
      positive_prompt: positive,
      negative_prompt: $("prompt-negative").value.trim(),
      mode: $("gen-mode").value,
      model: $("gen-model").value,
      influence: Number($("gen-influence").value),
      temperature: Number($("gen-temp").value),
      params: S.params,
      use_processed: true,
    };
    if (!maskIsEmpty()) body.mask_png_base64 = S.maskCanvas.toDataURL("image/png");

    const r = await post("/api/ai/enhance-frame", body);
    $("gen-preview").classList.remove("hidden");
    $("gen-img-base").src = r.base;
    $("gen-img-raw").src = r.generated;
    $("gen-img-blend").src = r.blended;
    $("gen-note").textContent =
      `${r.model} · frame ${r.frame} · influence ${r.influence} · cached at ${r.generated_path}`;
    S.lastGenerated = r;
    $("btn-reblend").disabled = false;
    log(`generated frame ${S.frame} via ${r.model}`, "ok");
  } catch (err) {
    log(`generation failed: ${err.message}`, "err");
    alert(`Generation failed:\n\n${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate for this frame";
  }
}

async function reblend() {
  try {
    const r = await post("/api/ai/reblend", {
      project_id: S.projectId,
      frame: S.frame,
      influence: Number($("gen-influence").value),
      params: S.params,
      use_mask: true,
    });
    $("gen-img-blend").src = r.blended;
    log(`re-blended at influence ${r.influence} (no API call)`);
  } catch (err) {
    alert(`Re-blend failed:\n\n${err.message}`);
  }
}

// ===========================================================================
// Selection + export
// ===========================================================================

async function applySelection(opts) {
  if (!S.projectId) return;
  try {
    const r = await post("/api/pipeline/select", { project_id: S.projectId, ...opts });
    log(`selection: ${r.selected_count} of ${r.total} frames kept`, "ok");
    await loadAnalysis();
  } catch (err) {
    log(`selection failed: ${err.message}`, "err");
  }
}

async function refreshExportInfo() {
  if (!S.projectId) return;
  try {
    const [e, a] = await Promise.all([
      get(`/api/project/${S.projectId}/export`),
      get(`/api/project/${S.projectId}/ai-frames`),
    ]);

    const bits = [`${e.rendered_frames} frames rendered`,
                  `${a.frames.length} AI frames cached`];
    if (e.video) {
      bits.push(`video ${e.video_size_mb} MB`);
    }
    $("exp-info").textContent = bits.join(" · ");

    const dl = $("btn-download");
    dl.classList.toggle("hidden", !e.download_url);
    if (e.download_url) dl.href = e.download_url;

    // A mismatch between the manifest and what is on disk means the folder
    // holds frames from more than one pass; encoding it would splice them.
    const warn = $("exp-warning");
    if (e.stale) {
      warn.classList.remove("hidden");
      warn.textContent =
        `${e.rendered_frames} frames on disk cannot be trusted (${e.stale_reason}). `
        + `Render again before encoding, or the video will splice two passes.`;
    } else {
      warn.classList.add("hidden");
    }

    $("btn-encode-only").disabled = !e.rendered_frames || e.stale;
  } catch { /* project may have no export yet */ }

  await refreshExportPlan();
}

/**
 * Show what the export will actually produce, and how long it should take,
 * before the user commits to it.
 */
async function refreshExportPlan() {
  const box = $("exp-plan");
  if (!S.projectId || !box) return;
  const timing = $("exp-timing").value;

  try {
    const r = await post("/api/memory/estimate", {
      project_id: S.projectId,
      kind: "render",
      params: S.params,
      timing,
      frames: $("exp-selected").checked ? null : undefined,
    });
    const p = r.plan ?? {};
    const est = r.estimate ?? {};

    // Frame rate follows the extraction, not the source: a decimated
    // extraction plays too fast if encoded at the original rate.
    if (!$("exp-fps").dataset.touched) $("exp-fps").value = (p.fps ?? 25).toFixed(2);

    const lines = [
      `${p.output_count} frames out — ${fmtSeconds(p.duration_s)} at ${(p.fps ?? 0).toFixed(2)} fps`,
    ];
    if (p.held_count) {
      lines.push(timing === "preserve"
        ? `${p.render_count} rendered, ${p.held_count} held in place to keep the original duration`
        : `${p.held_count} deselected frames omitted — the result runs shorter than the source`);
    }
    lines.push(est.known
      ? `Estimated ${fmtSeconds(est.eta_s)} (${(est.per_frame_s * 1000).toFixed(0)} ms/frame, `
        + `from ${est.samples} past run(s) with ${est.basis})`
      : "No timing history for these settings yet — this run will establish it.");

    box.replaceChildren();
    for (const line of lines) box.append(el("div", null, line));
    renderExportSections($("exp-selected").checked);
  } catch { /* estimate is advisory */ }
}

/** Colour-coded map of which section the export will actually walk. */
function renderExportSections(selectedOnly) {
  const host = $("exp-sections");
  if (!host) return;
  const rows = workspace.exportBreakdown(selectedOnly);
  if (!rows.length) { host.classList.add("hidden"); return; }
  host.classList.remove("hidden");
  host.replaceChildren();

  const strip = el("div", "export-strip");
  for (const row of rows) {
    const band = el("i");
    band.style.background = row.color;
    band.style.flex = `${row.length} 0 0`;
    band.title = `${row.name} · ${row.start}–${row.end}`;
    strip.append(band);
  }
  host.append(strip);

  for (const row of rows) {
    const line = el("div", "export-sec");
    const sw = el("i", "sw");
    sw.style.background = row.color;
    const kept = selectedOnly
      ? `${row.keep} kept${row.drop ? ` · ${row.drop} dropped` : ""}`
      : `${row.length} frames`;
    line.append(sw,
      el("span", "name", row.name),
      el("span", "range", `${row.start}–${row.end}`),
      el("span", selectedOnly ? "kept" : "range", kept));
    host.append(line);
  }
}

function fmtSeconds(s) {
  if (!s && s !== 0) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function doExport() {
  try {
    const r = await post("/api/pipeline/render", {
      project_id: S.projectId,
      params: S.params,
      only_selected: $("exp-selected").checked,
      ai_influence: Number($("exp-influence").value),
      encode: $("exp-encode").checked,
      timing: $("exp-timing").value,
      audio: $("exp-audio").checked,
      fps: Number($("exp-fps").value),
      crf: Number($("exp-crf").value),
    });
    closeModals();
    log(`render started — ${r.timing === "preserve" ? "holding" : "omitting"} `
        + `deselected frames, ${r.ai_frames} AI frames at influence `
        + `${$("exp-influence").value}`);
  } catch (err) {
    alert(`Render failed to start:\n\n${err.message}`);
  }
}

async function doEncodeOnly() {
  try {
    await post("/api/pipeline/encode", {
      project_id: S.projectId,
      fps: Number($("exp-fps").value),
      crf: Number($("exp-crf").value),
      audio: $("exp-audio").checked,
    });
    log("re-encoding the frames already rendered");
  } catch (err) {
    alert(`Encode failed to start:\n\n${err.message}`);
  }
}

// ===========================================================================
// Modals: file browser + projects
// ===========================================================================

function closeModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
  setFileMenu(false);
  closePalette();
}

async function browseTo(path) {
  try {
    const r = await get(`/api/browse?path=${encodeURIComponent(path)}`);
    $("browser-path").textContent = r.path;
    const list = $("browser-list");
    list.replaceChildren();

    const up = el("div", "browser-item");
    up.append(el("span", null, "📁"), el("span", null, ".. (parent)"));
    up.onclick = () => browseTo(r.parent);
    list.append(up);

    for (const d of r.dirs) {
      const row = el("div", "browser-item");
      row.append(el("span", null, "📁"), el("span", null, d.name));
      row.onclick = () => browseTo(d.path);
      list.append(row);
    }
    for (const f of r.videos) {
      const row = el("div", "browser-item video");
      row.append(el("span", null, "🎞"), el("span", null, f.name), el("span", "sz", `${f.size_mb} MB`));
      row.onclick = () => { $("open-path").value = f.path; };
      row.ondblclick = () => { $("open-path").value = f.path; doLoad(); };
      list.append(row);
    }
  } catch (err) {
    $("browser-path").textContent = `error: ${err.message}`;
  }
}

async function doLoad() {
  const path = $("open-path").value.trim();
  if (!path) return alert("Choose a video file.");
  try {
    const endVal = $("open-end").value;
    const r = await post("/api/video/load", {
      path,
      start: Number($("open-start").value) || 0,
      end: endVal === "" ? null : Number(endVal),
      step: Number($("open-step").value) || 1,
      max_edge: Number($("open-maxedge").value) || 0,
      analyze: true,
      scene_threshold: Number($("open-scene").value) || 0.35,
    });
    closeModals();
    log(`extracting ~${r.estimated_frames} frames from ${path}`);
  } catch (err) {
    alert(`Could not load the video:\n\n${err.message}`);
  }
}

async function showProjects() {
  const { projects } = await get("/api/projects");
  const list = $("project-list");
  list.replaceChildren();
  if (!projects.length) list.append(el("p", "muted", "No projects yet."));

  for (const p of projects) {
    const row = el("div", "project-item");
    row.append(el("span", null, "🎞"), el("span", null, p.source_name ?? p.project_id));
    row.append(el("span", "meta",
      `${p.frame_count} frames · ${new Date(p.created_at * 1000).toLocaleString()}`));
    const del = el("button", "tool del", "🗑");
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete project "${p.project_id}" and all its frames from disk?`)) return;
      await api(`/api/project/${p.project_id}`, { method: "DELETE" });
      showProjects();
      log(`deleted project ${p.project_id}`);
    };
    row.append(del);
    row.onclick = () => { closeModals(); openProject(p.project_id); };
    list.append(row);
  }
  $("modal-projects").classList.remove("hidden");
}

// ===========================================================================
// Inspector
// ===========================================================================

/** Collapse the filmstrip and parameter drawer so the picture gets the column. */
function toggleFocus() {
  const on = document.querySelector(".panel.left").classList.toggle("focus");
  layoutCanvases();
  renderQualityGraph();
  workspace.layoutStrip();
  log(on ? "focus mode — press F or ⤢ to bring the controls back" : "controls restored");
}

function openInspector() {
  if (!S.projectId) {
    log("load a project first — the Inspector needs a reel", "err");
    return;
  }
  workspace.openInspector();
}

// ===========================================================================
// File menu and command palette
// ===========================================================================

function fileMenuOpen() {
  return !$("file-menu-pop").classList.contains("hidden");
}

function setFileMenu(open) {
  $("file-menu-pop").classList.toggle("hidden", !open);
  $("btn-file").setAttribute("aria-expanded", String(open));
}

function commands() {
  return [
    { label: "Open video", keys: "O", run: () => $("btn-open").click() },
    { label: "Projects", run: () => $("btn-projects").click() },
    { label: "Inspector", keys: "I", run: () => openInspector() },
    { label: "Export restoration", keys: "E", run: () => $("btn-export").click() },
    { label: "Open Blueprint canvas", run: () => openBlueprint() },
    { label: "Settings", run: () => openSettings() },
    { label: "View restored", keys: "1", run: () => setView("processed") },
    { label: "View source", keys: "2", run: () => setView("source") },
    { label: "View split wipe", keys: "3", run: () => setView("split") },
    { label: "Toggle neighbour frames", keys: "N", run: () => toggleNeighbours() },
    { label: "Edit reframe on the picture", keys: "R", run: () => setReframeEdit(!S.reframeEdit) },
    { label: "Focus the picture", keys: "F", run: () => toggleFocus() },
    { label: "Annotation tools", keys: "A", run: () => $("rail-toggle").click() },
    { label: "Fit picture to viewer", keys: "0", run: () => resetView() },
    { label: "Refresh preview", keys: "⏎", run: () => refreshPreview() },
    { label: "Analyse this frame", run: () => $("btn-analyze-frame").click() },
    { label: "Detect subjects", run: () => $("btn-detect").click() },
    { label: "Find damage in this frame", run: () => $("btn-dmg-detect").click() },
    { label: "Auto-calibrate pipeline", run: () => $("btn-suggest").click() },
    { label: "Pin this frame as a key frame", run: () => $("btn-key-set")?.click() },
  ];
}

/** Open the Blueprint surface, carrying the bound project when possible. */
function blueprintUrl() {
  const base = "/blueprint/";
  const pid = S.projectId;
  return pid ? `${base}?project=${encodeURIComponent(pid)}` : base;
}

function openBlueprint() {
  setFileMenu(false);
  window.location.href = blueprintUrl();
}

function syncBlueprintLink() {
  const bp = $("btn-blueprint");
  if (bp) bp.setAttribute("href", blueprintUrl());
}

const palette = { items: [], index: 0 };

function paletteOpen() {
  return !$("command-palette").classList.contains("hidden");
}

function openPalette() {
  setFileMenu(false);
  $("command-palette").classList.remove("hidden");
  $("palette-q").value = "";
  filterPalette("");
  $("palette-q").focus();
}

function closePalette() {
  $("command-palette").classList.add("hidden");
}

function filterPalette(q) {
  const needle = q.trim().toLowerCase();
  palette.items = commands().filter((c) =>
    !needle || c.label.toLowerCase().includes(needle) || (c.keys ?? "").toLowerCase().includes(needle));
  palette.index = 0;
  renderPalette();
}

function renderPalette() {
  const host = $("palette-list");
  host.replaceChildren();
  palette.items.forEach((c, i) => {
    const row = el("div", `palette-item${i === palette.index ? " active" : ""}`);
    row.append(el("span", null, c.label));
    if (c.keys) row.append(el("span", "pal-keys", c.keys));
    row.onmousedown = (e) => { e.preventDefault(); runPalette(i); };
    host.append(row);
  });
}

function runPalette(i = palette.index) {
  const cmd = palette.items[i];
  closePalette();
  cmd?.run();
}

function bindFileMenu() {
  $("btn-file").onclick = (e) => {
    e.stopPropagation();
    setFileMenu(!fileMenuOpen());
  };
  $("file-menu-pop").addEventListener("click", () => setFileMenu(false));
  $("btn-commands").onclick = (e) => { e.stopPropagation(); openPalette(); };
  $("btn-open-blueprint").onclick = (e) => {
    e.stopPropagation();
    openBlueprint();
  };
  const bp = $("btn-blueprint");
  if (bp) {
    bp.addEventListener("click", (e) => {
      // Keep the <a> semantics for middle-click / open-in-tab, but sync href.
      bp.setAttribute("href", blueprintUrl());
    });
    bp.setAttribute("href", blueprintUrl());
  }
  document.addEventListener("click", (e) => {
    if (fileMenuOpen() && !e.target.closest("#file-menu")) setFileMenu(false);
  });
  $("palette-q").addEventListener("input", (e) => filterPalette(e.target.value));
  $("palette-q").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      palette.index = Math.min(palette.items.length - 1, palette.index + 1);
      renderPalette();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      palette.index = Math.max(0, palette.index - 1);
      renderPalette();
    } else if (e.key === "Enter") {
      e.preventDefault();
      runPalette();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  });
  $("command-palette").addEventListener("click", (e) => {
    if (e.target.id === "command-palette") closePalette();
  });
}

// ===========================================================================
// Boot
// ===========================================================================

function bindUI() {
  bindFileMenu();
  $("btn-open").onclick = $("btn-open-2").onclick = () => {
    $("modal-open").classList.remove("hidden");
    browseTo("~/Desktop");
  };
  $("btn-do-load").onclick = doLoad;
  $("btn-projects").onclick = showProjects;
  $("btn-inspector").onclick = openInspector;
  $("btn-focus").onclick = toggleFocus;
  $("btn-export").onclick = () => { refreshExportInfo(); $("modal-export").classList.remove("hidden"); };
  $("btn-do-export").onclick = doExport;
  $("btn-encode-only").onclick = doEncodeOnly;
  $("exp-timing").onchange = refreshExportPlan;
  $("exp-selected").onchange = refreshExportPlan;
  $("exp-fps").oninput = (e) => { e.target.dataset.touched = "1"; };
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModals));
  document.querySelectorAll(".modal").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));

  // settings
  $("btn-settings").onclick = () => openSettings();
  document.querySelectorAll("#modal-settings .tab").forEach((t) => {
    t.onclick = () => showSettingsPane(t.dataset.pane);
  });
  $("btn-log-compact").onclick = () => {
    const folded = compactLog(40);
    post("/api/memory/compact", { project_id: S.projectId })
      .then((r) => log(`log compacted — ${folded} lines folded here, `
        + `${r.compacted} records folded in the engine store into ${r.digests} digest(s)`, "ok"))
      .catch(() => log(`${folded} lines folded in this window`, "ok"))
      .finally(refreshEngineLogBudget);
  };
  $("btn-log-export").onclick = async () => {
    try {
      const q = S.projectId ? `?project_id=${encodeURIComponent(S.projectId)}` : "";
      const { events } = await get(`/api/memory/log-export${q}`);
      const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
      const a = el("a");
      a.href = URL.createObjectURL(blob);
      a.download = `restorer-log-${S.projectId ?? "all"}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      log(`exported ${events.length} log records`, "ok");
    } catch (err) {
      log(`log export failed: ${err.message}`, "err");
    }
  };
  $("chk-log-errors").onchange = (e) => {
    logState.errorsOnly = e.target.checked;
    [...$("log").children].forEach((line) =>
      line.classList.toggle("hidden",
        logState.errorsOnly && line.dataset.kind !== "err" && !line.dataset.digest));
  };

  // view modes
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.onclick = () => setView(b.dataset.view);
  });
  $("btn-split-axis").onclick = () => {
    S.splitAxis = S.splitAxis === "x" ? "y" : "x";
    $("btn-split-axis").textContent = S.splitAxis === "x" ? "⇔" : "⇕";
    $("btn-split-axis").title = S.splitAxis === "x"
      ? "Wipe left to right — click for a top-to-bottom wipe"
      : "Wipe top to bottom — click for a left-to-right wipe";
    setView("split");
  };

  // neighbours
  $("btn-neighbours").onclick = () => toggleNeighbours();
  $("btn-play")?.addEventListener("click", () => setPlaying(!S.playing));
  $("nb-distance").oninput = (e) => {
    S.neighbours.distance = Number(e.target.value);
    $("nb-distance-val").textContent = e.target.value;
    refreshNeighbours();
  };
  $("nb-operation").onchange = (e) => {
    S.neighbours.operation = e.target.value;
    if (e.target.value === "none") {
      refreshNeighbours();
    } else {
      runAlgebra();
    }
  };
  $("nb-tolerance").oninput = (e) => {
    S.neighbours.tolerance = Number(e.target.value);
    $("nb-tol-val").textContent = e.target.value === "0" ? "auto" : e.target.value;
  };
  $("nb-tolerance").onchange = () => runAlgebra();
  $("nb-overlay").oninput = (e) => {
    S.neighbours.overlayOpacity = Number(e.target.value) / 100;
    $("nb-overlay-val").textContent = `${e.target.value}%`;
    drawViewer();
  };
  $("btn-nb-commit").onclick = commitAlgebraMask;
  $("btn-nb-repair").onclick = () => {
    $("dmg-use-mask").checked = false;
    repairDamage();
    document.querySelectorAll(".card").forEach((c) => {
      if (c.querySelector("summary")?.textContent.includes("Damage")) c.open = true;
    });
  };

  // level band
  $("chk-level-band").onchange = (e) => {
    S.showLevelBand = e.target.checked;
    renderQualityGraph();
  };
  $("btn-measure-roll").onclick = async () => {
    if (!S.projectId) return;
    try {
      await post("/api/geometry/roll", { project_id: S.projectId, step: 2 });
      log("measuring camera roll across the reel…");
    } catch (err) {
      log(`roll measurement failed to start: ${err.message}`, "err");
    }
  };

  // damage
  $("dmg-radius").oninput = (e) => ($("dmg-radius-val").textContent = e.target.value);
  $("dmg-area").oninput = (e) => ($("dmg-area-val").textContent = e.target.value);
  $("btn-dmg-detect").onclick = detectDamage;
  $("btn-dmg-repair").onclick = repairDamage;
  $("btn-dmg-range").onclick = repairRange;

  // reframe — the rectangle is live on the canvas; drag it, don't just slide
  $("btn-rf-edit").onclick = () => setReframeEdit(!S.reframeEdit);
  for (const id of ["rf-zoom", "rf-x", "rf-y"]) $(id).oninput = syncReframeReadout;
  $("btn-rf-preview").onclick = previewReframe;
  $("btn-rf-apply").onclick = applyReframe;
  $("btn-rf-outpaint").onclick = outpaintMargin;

  // tools — hidden behind the rail until annotation is actually wanted
  const rail = $("annot-rail");
  const setRail = (open) => {
    rail.classList.toggle("open", open);
    // Collapsing disarms annotation and returns the pointer to inspection,
    // but never discards a mask that is already painted.
    if (!open && S.tool !== "pan") selectTool("tool-pan");
  };
  $("rail-toggle").onclick = () => setRail(!rail.classList.contains("open"));

  const tools = { "tool-pan": "pan", "tool-roi": "roi", "tool-mask": "mask", "tool-erase": "erase" };
  function selectTool(id) {
    Object.keys(tools).forEach((t) => $(t).classList.remove("active"));
    $(id).classList.add("active");
    S.tool = tools[id];
    wrap().classList.toggle("pan", S.tool === "pan");
  }
  for (const id of Object.keys(tools)) $(id).onclick = () => selectTool(id);
  $("brush-size").oninput = (e) => (S.brush = Number(e.target.value));
  $("mask-clear").onclick = clearMask;

  // frame navigation
  $("btn-prev").onclick = () => gotoFrame(S.frame - 1);
  $("btn-next").onclick = () => gotoFrame(S.frame + 1);
  $("frame-number").onchange = (e) => gotoFrame(Number(e.target.value));
  $("chk-selected").onchange = (e) =>
    applySelection({ selected: { [String(S.frame)]: e.target.checked } });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      paletteOpen() ? closePalette() : openPalette();
      return;
    }
    if (paletteOpen()) return;
    if (e.key === "Escape") {
      if (fileMenuOpen()) { setFileMenu(false); return; }
      closeModals();
      return;
    }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      paletteOpen() ? closePalette() : openPalette();
      return;
    }
    if (e.key === "ArrowLeft") gotoFrame(S.frame - 1);
    if (e.key === "ArrowRight") gotoFrame(S.frame + 1);
    if (e.key === "k" || e.key === "K") { e.preventDefault(); setPlaying(!S.playing); }
    if (e.key === " ") { e.preventDefault(); $("chk-selected").click(); }
    if (e.key === "f" || e.key === "F") toggleFocus();
    if (e.key === "i" || e.key === "I") openInspector();
    if (e.key === "o" || e.key === "O") $("btn-open").click();
    if (e.key === "e" || e.key === "E") $("btn-export").click();
    if (e.key === "1") setView("processed");
    if (e.key === "2") setView("source");
    if (e.key === "3") setView("split");
    if (e.key === "a" || e.key === "A") $("rail-toggle").click();
    if (e.key === "n" || e.key === "N") toggleNeighbours();
    if (e.key === "r" || e.key === "R") setReframeEdit(!S.reframeEdit);
    if (e.key === "0") resetView();
    if (e.key === "Enter") refreshPreview();
    // Momentary A/B against the source — the standard grading gesture, and far
    // faster than round-tripping through the tabs.
    if ((e.key === "b" || e.key === "B") && !e.repeat && !S.peeking) {
      S.peeking = true;
      setFreshness("peek");
      drawViewer();
    }
  });

  document.addEventListener("keyup", (e) => {
    if ((e.key === "b" || e.key === "B") && S.peeking) {
      S.peeking = false;
      setFreshness(JSON.stringify(S.params) === JSON.stringify(S.previewedParams)
        ? "live" : "stale");
      drawViewer();
    }
  });
  // A key held while the window loses focus would otherwise stick.
  window.addEventListener("blur", () => {
    if (!S.peeking) return;
    S.peeking = false;
    setFreshness("live");
    drawViewer();
  });

  // selection tools
  $("btn-apply-selection").onclick = () =>
    applySelection({ min_score: Number($("sel-min-score").value) });
  $("btn-best-scene").onclick = () => applySelection({ best_per_scene: true });
  $("btn-select-all").onclick = () => applySelection({ min_score: 0 });

  // params
  $("chk-live").onchange = (e) => {
    S.live = e.target.checked;
    if (S.live) refreshPreview(); else markStale();
  };
  $("btn-reset").onclick = () => {
    S.params = structuredClone(S.defaults);
    renderControls();
    refreshPreview();
    schedulePersistParams();
    scheduleWorkshopParams();
  };
  $("btn-suggest").onclick = async () => {
    S.params = await get(`/api/project/${S.projectId}/suggest-params`);
    renderControls();
    refreshPreview();
    schedulePersistParams();
    scheduleWorkshopParams();
    log("re-derived parameters from sequence statistics", "ok");
  };

  // AI
  $("btn-analyze-frame").onclick = analyzeFrame;
  $("btn-apply-recs").onclick = applyRecommendations;
  $("btn-generate").onclick = generateFrame;
  $("btn-reblend").onclick = reblend;
  $("gen-influence").oninput = (e) => ($("gen-influence-val").textContent = Number(e.target.value).toFixed(2));
  $("gen-temp").oninput = (e) => ($("gen-temp-val").textContent = Number(e.target.value).toFixed(2));
  $("exp-influence").oninput = (e) => ($("exp-inf-val").textContent = Number(e.target.value).toFixed(2));

  $("btn-save-key").onclick = async () => {
    const key = $("api-key").value.trim();
    if (!key) return;
    const st = await post("/api/settings/api-key", { api_key: key });
    $("api-key").value = "";
    await workspace.refreshKeyStatus(true);
    log(st.verified
      ? "API key stored and verified against Google"
      : `API key stored, but the check failed: ${st.message}`,
      st.verified ? "ok" : "err");
  };

  window.addEventListener("resize", debounce(() => {
    layoutCanvases();
    renderQualityGraph();
    workspace.layoutStrip();
  }, 120));
  bindWorkshop();
  bindGradeStepChrome();
}

async function boot() {
  bindUI();
  initPointer();
  initZoom();
  initGraphPointer();
  connectWS();
  renderHealth();

  // The bridge is the only surface workspace.js may touch, which keeps the
  // two halves of the UI from growing into each other.
  workspace.attach({
    S, api, get, post, log, el,
    gotoFrame,
    requestPreview,
    renderControls,
    renderFilmstrip,
    renderQualityGraph,
    updateSectionBadge,
    loadAnalysis,
    setHealth,
    openSettings,
  });

  try {
    S.schema = await (await fetch("/shared/controls.json")).json();
    S.defaults = await get("/api/params/defaults");
    S.params = structuredClone(S.defaults);
    renderControls();

    const h = await get("/api/health");
    setHealth("engine", "ok", `Engine ${h.version} on OpenCV ${h.opencv}`);
    workspace.reportEncoder(h.ffmpeg);
    await workspace.refreshKeyStatus();

    $("engine-info").textContent =
      `engine ${h.version} · OpenCV ${h.opencv} · encoder ${h.ffmpeg.encoder} `
      + `(${h.ffmpeg.source})\nworkspace ${h.workspace}`;
    log(`engine ready — OpenCV ${h.opencv}`, "ok");

    if (!h.ffmpeg.available) {
      log(h.ffmpeg.warning, "err");
    }

    const { projects } = await get("/api/projects");
    const fromUrl = new URLSearchParams(location.search).get("project");
    const embed = new URLSearchParams(location.search).get("embed");
    if (fromUrl) {
      const match = projects.find((p) => p.project_id === fromUrl);
      if (match) {
        await openProject(match.project_id);
        log("opened project from Blueprint hand-off", "ok");
      } else {
        // Studio ids are not in the engine list. Stay empty rather than
        // resuming someone else's reel.
        log("no reel on this project yet", "ok");
      }
    } else if (!embed && projects[0]) {
      await openProject(projects[0].project_id);
      log("resumed most recent project", "ok");
    }
  } catch (err) {
    setHealth("engine", "error", `Engine unreachable: ${err.message}`);
    log(`cannot reach engine: ${err.message}`, "err");
  }

  renderQualityGraph();
  updateZoomReadout();
  refreshEngineLogBudget();
}

boot();
