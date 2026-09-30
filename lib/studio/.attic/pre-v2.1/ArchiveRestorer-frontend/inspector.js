/**
 * inspector.js — the pop-out review window.
 *
 * The main window is a grading desk: many small controls around a modest
 * preview. Judging whether a repair actually worked needs the opposite — one
 * large image, exact frame control, and the ability to watch a few seconds
 * loop until the eye catches what is wrong. That is this window.
 *
 * What it adds over the main viewer:
 *   * a full-window canvas with real zoom, including a pixel grid for
 *     inspecting dust repairs at 400%+;
 *   * frame-exact stepping by button, keyboard, or dragging the strip;
 *   * a loop range with in/out points, which can be *cached* — rendered once,
 *     then played from memory, because the restoration pipeline is far too
 *     slow to run at frame rate;
 *   * live section context, so the restorer always knows which treatment is
 *     responsible for what they are looking at.
 *
 * It shares the frame position and parameters with the main window over a
 * BroadcastChannel, so the two stay in step without either owning the other.
 */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const S = {
  projectId: null,
  params: {},
  frame: 0,
  frameCount: 0,
  fps: 25,
  view: "processed",
  zoom: "fit",
  pixelGrid: false,
  playing: false,
  playRate: 12,
  loopOn: false,
  loopIn: null,
  loopOut: null,
  sync: true,
  segments: [],
  coverage: null,
  analysis: null,
  // Rendered frames held as ImageBitmaps so a loop plays back at rate; the
  // pipeline takes ~100-800 ms per frame and could never keep up live.
  cache: new Map(),
  cacheKey: "",
  sourceCache: new Map(),
  busy: false,
  pan: { x: 0, y: 0 },
  dragging: null,
};

const channel = new BroadcastChannel("archive-restorer");

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
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error(data?.detail ?? `${res.status} ${res.statusText}`);
  return data;
}

function status(text, kind = "") {
  const pill = $("insp-status");
  pill.textContent = text;
  pill.dataset.state = kind;
}

// ===========================================================================
// Frame fetching
// ===========================================================================

/** The cache is only valid for one project + parameter set + view. */
function currentCacheKey() {
  return `${S.projectId}|${S.view}|${JSON.stringify(S.params)}`;
}

function invalidateCache() {
  const key = currentCacheKey();
  if (key !== S.cacheKey) {
    S.cache.clear();
    S.cacheKey = key;
    updateCacheBar();
  }
}

async function fetchProcessed(frame) {
  const r = await api("/api/pipeline/preview", {
    method: "POST",
    body: {
      project_id: S.projectId, frame, params: S.params,
      format: "jpeg", max_edge: 1600,
    },
  });
  return r.image;
}

function sourceUrl(frame) {
  return `/api/project/${S.projectId}/frame/${frame}`;
}

async function loadBitmap(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`frame fetch failed: ${res.status}`);
  return createImageBitmap(await res.blob());
}

async function bitmapFor(frame, view = S.view) {
  if (view === "source") {
    if (!S.sourceCache.has(frame)) {
      S.sourceCache.set(frame, await loadBitmap(sourceUrl(frame)));
      if (S.sourceCache.size > 400) {
        S.sourceCache.delete(S.sourceCache.keys().next().value);
      }
    }
    return S.sourceCache.get(frame);
  }

  invalidateCache();
  if (S.cache.has(frame)) return S.cache.get(frame);

  const dataUrl = await fetchProcessed(frame);
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  S.cache.set(frame, bmp);
  if (S.cache.size > 600) S.cache.delete(S.cache.keys().next().value);
  return bmp;
}

// ===========================================================================
// Drawing
// ===========================================================================

const canvas = $("insp-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

function stageSize() {
  const stage = $("insp-stage");
  return { w: stage.clientWidth, h: stage.clientHeight };
}

function drawScale(bmp) {
  const { w, h } = stageSize();
  if (S.zoom === "fit") return Math.min(w / bmp.width, h / bmp.height);
  return Number(S.zoom);
}

async function render() {
  if (!S.projectId || !S.frameCount) return;
  const frame = S.frame;

  let bmp;
  let sourceBmp = null;
  try {
    if (S.view === "split") {
      [bmp, sourceBmp] = await Promise.all([
        bitmapFor(frame, "processed"),
        bitmapFor(frame, "source"),
      ]);
    } else {
      bmp = await bitmapFor(frame);
    }
  } catch (err) {
    status(err.message, "err");
    return;
  }
  // A newer frame was requested while this one was in flight.
  if (frame !== S.frame) return;

  const { w, h } = stageSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  const scale = drawScale(bmp);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  const dx = (w - dw) / 2 + S.pan.x;
  const dy = (h - dh) / 2 + S.pan.y;

  // Nearest-neighbour above 200% so a dust repair is judged on actual pixels
  // rather than the browser's smoothing.
  ctx.imageSmoothingEnabled = !(scale >= 2);

  if (S.view === "split" && sourceBmp) {
    const mid = dw / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, mid, dh);
    ctx.clip();
    ctx.drawImage(sourceBmp, dx, dy, dw, dh);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(dx + mid, dy, dw - mid, dh);
    ctx.clip();
    ctx.drawImage(bmp, dx, dy, dw, dh);
    ctx.restore();

    ctx.strokeStyle = "#f0b429";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx + mid, dy);
    ctx.lineTo(dx + mid, dy + dh);
    ctx.stroke();
    label(ctx, "SOURCE", dx + 10, dy + 22);
    label(ctx, "RESTORED", dx + mid + 10, dy + 22);
  } else {
    ctx.drawImage(bmp, dx, dy, dw, dh);
  }

  if (S.pixelGrid && scale >= 6) drawPixelGrid(dx, dy, scale, bmp.width, bmp.height);

  $("insp-empty").classList.add("hidden");
  updateReadouts(bmp);
}

function label(c, text, x, y) {
  c.font = "600 12px ui-monospace, monospace";
  c.fillStyle = "rgba(0,0,0,.6)";
  c.fillRect(x - 6, y - 14, c.measureText(text).width + 12, 20);
  c.fillStyle = "#f5f7fa";
  c.fillText(text, x, y);
}

function drawPixelGrid(dx, dy, scale, iw, ih) {
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= iw; x++) {
    const px = Math.round(dx + x * scale) + 0.5;
    ctx.moveTo(px, dy);
    ctx.lineTo(px, dy + ih * scale);
  }
  for (let y = 0; y <= ih; y++) {
    const py = Math.round(dy + y * scale) + 0.5;
    ctx.moveTo(dx, py);
    ctx.lineTo(dx + iw * scale, py);
  }
  ctx.stroke();
}

function timecode(frame) {
  const total = frame / (S.fps || 25);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(Math.floor(total % 60)).padStart(2, "0");
  const ff = String(Math.floor((frame % (S.fps || 25)))).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${ff}`;
}

function updateReadouts() {
  $("insp-frame").value = S.frame;
  $("insp-total").textContent = `/ ${S.frameCount - 1}`;
  $("insp-tc").textContent = timecode(S.frame);

  const owner = segmentAt(S.frame);
  const pill = $("insp-segment");
  if (owner) {
    pill.textContent = owner.name;
    pill.style.borderColor = owner.color;
    pill.style.color = owner.color;
    pill.title = describeSpec(owner);
  } else {
    pill.textContent = "no section";
    pill.style.borderColor = "";
    pill.style.color = "";
    pill.title = "This frame is not covered by any section.";
  }
}

function describeSpec(seg) {
  const st = seg.spec_state ?? {};
  const parts = [`${st.state ?? "none"} spec`];
  if (st.authored_by && st.authored_by !== "none") parts.push(`written by ${st.authored_by}`);
  if (st.layer_count) parts.push(`${st.layer_count} layer(s)`);
  if (st.needs_review) parts.push("needs review");
  return parts.join(" · ");
}

function segmentAt(frame) {
  const covering = S.segments.filter(
    (s) => s.enabled !== false && s.start <= frame && frame <= s.end);
  return covering.length ? covering[covering.length - 1] : null;
}

// ===========================================================================
// Scrub strip — position, loop range, section colours, quality
// ===========================================================================

const scrub = $("insp-scrub");
const sctx = scrub.getContext("2d");

function layoutScrub() {
  const wrap = scrub.parentElement;
  const dpr = window.devicePixelRatio || 1;
  scrub.width = Math.round(wrap.clientWidth * dpr);
  scrub.height = Math.round(46 * dpr);
  scrub.style.width = `${wrap.clientWidth}px`;
  scrub.style.height = "46px";
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScrub();
}

function frameToX(frame, width) {
  return (frame / Math.max(S.frameCount - 1, 1)) * width;
}

function xToFrame(x, width) {
  return Math.round(clamp(x / width, 0, 1) * (S.frameCount - 1));
}

function drawScrub() {
  const w = scrub.clientWidth;
  const h = 46;
  if (!w) return;

  sctx.clearRect(0, 0, w, h);
  sctx.fillStyle = "#14171c";
  sctx.fillRect(0, 0, w, h);

  // Band 1: which section owns each frame, in that section's colour.
  const bandY = 4;
  const bandH = 12;
  if (S.coverage?.runs?.length) {
    for (const run of S.coverage.runs) {
      const x0 = frameToX(run.start, w);
      const x1 = frameToX(run.end + 1, w);
      sctx.fillStyle = run.segment_id ? run.color : "#272b31";
      sctx.fillRect(x0, bandY, Math.max(x1 - x0, 1), bandH);

      // A section with no treatment written yet is hatched, so unfinished
      // stretches of the reel are obvious at a glance.
      if (run.segment_id && run.spec_state !== "complete") {
        sctx.save();
        sctx.beginPath();
        sctx.rect(x0, bandY, Math.max(x1 - x0, 1), bandH);
        sctx.clip();
        sctx.strokeStyle = "rgba(0,0,0,.45)";
        sctx.lineWidth = 2;
        for (let x = x0 - bandH; x < x1 + bandH; x += 6) {
          sctx.beginPath();
          sctx.moveTo(x, bandY + bandH);
          sctx.lineTo(x + bandH, bandY);
          sctx.stroke();
        }
        sctx.restore();
      }
    }
  } else {
    sctx.fillStyle = "#272b31";
    sctx.fillRect(0, bandY, w, bandH);
  }

  // Band 2: per-frame quality, so damaged stretches are visible while scrubbing.
  const qY = 20;
  const qH = 14;
  sctx.fillStyle = "#0f1216";
  sctx.fillRect(0, qY, w, qH);
  if (S.analysis?.frames?.length) {
    const frames = S.analysis.frames;
    const stepPx = Math.max(1, Math.floor(frames.length / Math.max(w, 1)));
    for (let i = 0; i < frames.length; i += stepPx) {
      const f = frames[i];
      const x = frameToX(f.index, w);
      const score = clamp(f.quality_score ?? 0.5, 0, 1);
      sctx.fillStyle = f.selected === false
        ? "#4a2027"
        : `hsl(${Math.round(score * 110)}, 55%, ${28 + score * 22}%)`;
      sctx.fillRect(x, qY + qH - score * qH, Math.max(stepPx, 1), score * qH);
      if (f.is_cut) {
        sctx.fillStyle = "#f0b429";
        sctx.fillRect(x, qY, 1, qH);
      }
    }
  }

  // Loop range.
  if (S.loopIn !== null && S.loopOut !== null) {
    const x0 = frameToX(Math.min(S.loopIn, S.loopOut), w);
    const x1 = frameToX(Math.max(S.loopIn, S.loopOut) + 1, w);
    sctx.fillStyle = S.loopOn ? "rgba(240,180,41,.22)" : "rgba(240,180,41,.10)";
    sctx.fillRect(x0, 0, x1 - x0, h);
    sctx.strokeStyle = "#f0b429";
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.moveTo(x0, 0); sctx.lineTo(x0, h);
    sctx.moveTo(x1, 0); sctx.lineTo(x1, h);
    sctx.stroke();

    // Show how much of the loop is cached and therefore plays at rate.
    if (S.cache.size) {
      sctx.fillStyle = "rgba(110,220,160,.85)";
      for (let f = Math.min(S.loopIn, S.loopOut); f <= Math.max(S.loopIn, S.loopOut); f++) {
        if (S.cache.has(f)) sctx.fillRect(frameToX(f, w), h - 4, Math.max(w / S.frameCount, 1), 3);
      }
    }
  }

  // Playhead.
  const px = frameToX(S.frame, w);
  sctx.strokeStyle = "#ffffff";
  sctx.lineWidth = 2;
  sctx.beginPath();
  sctx.moveTo(px, 0);
  sctx.lineTo(px, h);
  sctx.stroke();
  sctx.fillStyle = "#ffffff";
  sctx.beginPath();
  sctx.moveTo(px - 5, 0);
  sctx.lineTo(px + 5, 0);
  sctx.lineTo(px, 7);
  sctx.closePath();
  sctx.fill();
}

// ===========================================================================
// Navigation
// ===========================================================================

let renderQueued = false;

function goto(frame, { broadcast = true } = {}) {
  const next = clamp(Math.round(frame), 0, Math.max(S.frameCount - 1, 0));
  if (next === S.frame) { drawScrub(); return; }
  S.frame = next;
  drawScrub();
  updateReadouts();

  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(async () => {
      renderQueued = false;
      await render();
    });
  }
  if (broadcast && S.sync) {
    channel.postMessage({ type: "frame", frame: S.frame, from: "inspector" });
  }
}

function step(n) {
  goto(S.frame + n);
}

// ===========================================================================
// Loop playback
// ===========================================================================

let playTimer = null;

function loopBounds() {
  if (S.loopIn === null || S.loopOut === null) return null;
  return [Math.min(S.loopIn, S.loopOut), Math.max(S.loopIn, S.loopOut)];
}

function setPlaying(on) {
  S.playing = on;
  $("insp-play").textContent = on ? "⏸" : "▶";
  $("insp-play").classList.toggle("active", on);
  clearInterval(playTimer);
  if (!on) { status("idle"); return; }

  const bounds = loopBounds();
  const interval = 1000 / clamp(S.playRate, 1, 60);

  // Outside a cached loop the pipeline cannot keep up, so say so rather than
  // silently playing at whatever rate the network allows.
  if (S.loopOn && bounds) {
    const [a, b] = bounds;
    const cached = countCached(a, b);
    status(cached === b - a + 1
      ? `looping ${a}–${b} at ${S.playRate} fps`
      : `looping ${a}–${b} — ${cached}/${b - a + 1} cached, playback will stutter`,
      cached === b - a + 1 ? "ok" : "warn");
  } else {
    status(`playing at ${S.playRate} fps`);
  }

  playTimer = setInterval(() => {
    let next = S.frame + 1;
    if (S.loopOn && bounds) {
      if (next > bounds[1] || S.frame < bounds[0]) next = bounds[0];
    } else if (next >= S.frameCount) {
      next = 0;
    }
    goto(next);
  }, interval);
}

function countCached(a, b) {
  let n = 0;
  const map = S.view === "source" ? S.sourceCache : S.cache;
  for (let f = a; f <= b; f++) if (map.has(f)) n++;
  return n;
}

async function cacheLoop() {
  const bounds = loopBounds();
  if (!bounds) { status("mark a loop range first", "warn"); return; }
  const [a, b] = bounds;
  const total = b - a + 1;
  if (total > 900) { status(`loop of ${total} frames is too long to cache`, "err"); return; }

  invalidateCache();
  const bar = $("insp-cachebar");
  bar.classList.remove("hidden");
  status(`caching ${total} frames…`);

  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    const frame = a + i;
    try {
      await bitmapFor(frame);
    } catch (err) {
      status(`cache failed at frame ${frame}: ${err.message}`, "err");
      break;
    }
    const pct = ((i + 1) / total) * 100;
    $("insp-cachefill").style.width = `${pct}%`;
    const rate = (i + 1) / ((performance.now() - t0) / 1000);
    $("insp-cachetext").textContent =
      `${i + 1}/${total} · ${rate.toFixed(1)} frames/s · ${Math.round((total - i - 1) / rate)}s left`;
    if (i % 4 === 0) drawScrub();
  }

  drawScrub();
  const secs = (performance.now() - t0) / 1000;
  status(`cached ${total} frames in ${secs.toFixed(1)}s — loop plays at rate now`, "ok");
  setTimeout(() => bar.classList.add("hidden"), 2500);
}

function updateCacheBar() {
  const bounds = loopBounds();
  $("insp-loop-readout").textContent = bounds
    ? `${bounds[0]} · ${bounds[1]}  (${bounds[1] - bounds[0] + 1}f)`
    : "— · —";
}

// ===========================================================================
// Interaction
// ===========================================================================

function initScrubPointer() {
  let mode = null;
  let anchor = 0;

  scrub.addEventListener("pointerdown", (e) => {
    const rect = scrub.getBoundingClientRect();
    const frame = xToFrame(e.clientX - rect.left, rect.width);
    scrub.setPointerCapture(e.pointerId);
    // Shift-drag marks a range; a plain drag scrubs. Marking a loop is the
    // most common reason to touch this strip, so it gets the modifier-free
    // gesture once a drag actually travels.
    mode = e.shiftKey ? "range" : "scrub";
    anchor = frame;
    if (mode === "range") {
      S.loopIn = frame;
      S.loopOut = frame;
      updateCacheBar();
    }
    goto(frame);
  });

  scrub.addEventListener("pointermove", (e) => {
    if (!mode) return;
    const rect = scrub.getBoundingClientRect();
    const frame = xToFrame(e.clientX - rect.left, rect.width);
    if (mode === "range" || (mode === "scrub" && Math.abs(frame - anchor) > 6 && e.buttons && e.altKey)) {
      S.loopIn = anchor;
      S.loopOut = frame;
      updateCacheBar();
      drawScrub();
    } else {
      goto(frame);
    }
  });

  const end = (e) => {
    if (mode === "range") {
      S.loopOn = true;
      $("insp-loop").classList.add("active");
      status(`loop range ${Math.min(S.loopIn, S.loopOut)}–${Math.max(S.loopIn, S.loopOut)}`);
    }
    mode = null;
    try { scrub.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    drawScrub();
  };
  scrub.addEventListener("pointerup", end);
  scrub.addEventListener("pointercancel", end);
}

function initStagePointer() {
  const stage = $("insp-stage");
  let last = null;

  stage.addEventListener("pointerdown", (e) => {
    if (S.zoom === "fit") return;
    last = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    stage.style.cursor = "grabbing";
  });
  stage.addEventListener("pointermove", (e) => {
    if (!last) return;
    S.pan.x += e.clientX - last.x;
    S.pan.y += e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    render();
  });
  const end = () => { last = null; stage.style.cursor = ""; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);

  // Wheel scrubs frames, which is the fastest way to hunt for a specific
  // moment; Ctrl+wheel zooms, matching every other image tool.
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const order = ["fit", "1", "2", "4", "8"];
      const i = order.indexOf(String(S.zoom));
      const next = order[clamp(i + (e.deltaY < 0 ? 1 : -1), 0, order.length - 1)];
      $("insp-zoom").value = next;
      S.zoom = next;
      if (next === "fit") S.pan = { x: 0, y: 0 };
      render();
    } else {
      step(e.deltaY > 0 ? 1 : -1);
    }
  }, { passive: false });
}

function initKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    const big = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft": case ",": step(-big); break;
      case "ArrowRight": case ".": step(big); break;
      case "Home": goto(0); break;
      case "End": goto(S.frameCount - 1); break;
      case " ": e.preventDefault(); setPlaying(!S.playing); break;
      case "i": case "I": markIn(); break;
      case "o": case "O": markOut(); break;
      case "l": case "L": toggleLoop(); break;
      case "s": case "S": setView(S.view === "source" ? "processed" : "source"); break;
      default: return;
    }
    e.preventDefault();
  });
}

function markIn() {
  S.loopIn = S.frame;
  if (S.loopOut === null || S.loopOut < S.loopIn) S.loopOut = S.frame;
  updateCacheBar();
  drawScrub();
  status(`loop in at ${S.frame}`);
}

function markOut() {
  S.loopOut = S.frame;
  if (S.loopIn === null || S.loopIn > S.loopOut) S.loopIn = S.frame;
  updateCacheBar();
  drawScrub();
  status(`loop out at ${S.frame}`);
}

function toggleLoop() {
  S.loopOn = !S.loopOn;
  $("insp-loop").classList.toggle("active", S.loopOn);
  drawScrub();
  status(S.loopOn ? "loop on" : "loop off");
  if (S.playing) setPlaying(true);
}

function setView(view) {
  S.view = view;
  document.querySelectorAll(".seg-btn").forEach(
    (b) => b.classList.toggle("active", b.dataset.view === view));
  render();
  drawScrub();
}

// ===========================================================================
// Project sync
// ===========================================================================

async function adoptProject(pid, params) {
  S.projectId = pid;
  S.params = params ?? S.params;
  $("insp-project").textContent = pid ?? "—";
  if (!pid) return;

  try {
    const info = await api(`/api/project/${pid}`);
    S.frameCount = info.frame_count ?? info.manifest?.frame_count ?? 0;
    S.fps = info.manifest?.fps ?? 25;
  } catch { /* the main window will retry */ }

  await Promise.all([refreshSegments(), refreshAnalysis()]);
  $("insp-frame").max = Math.max(S.frameCount - 1, 0);
  layoutScrub();
  await render();
}

async function refreshSegments() {
  if (!S.projectId) return;
  try {
    const [list, cov] = await Promise.all([
      api(`/api/segments/${S.projectId}`),
      api(`/api/segments/${S.projectId}/coverage`),
    ]);
    S.segments = list.segments ?? [];
    S.coverage = cov;
  } catch { /* sections are optional */ }
  drawScrub();
  updateReadouts();
}

async function refreshAnalysis() {
  if (!S.projectId) return;
  try {
    S.analysis = await api(`/api/project/${S.projectId}/analysis`);
  } catch { S.analysis = null; }
  drawScrub();
}

channel.addEventListener("message", (e) => {
  const m = e.data ?? {};
  if (m.from === "inspector") return;

  switch (m.type) {
    case "project":
      adoptProject(m.projectId, m.params);
      break;
    case "params":
      S.params = m.params;
      invalidateCache();
      render();
      break;
    case "frame":
      if (S.sync) goto(m.frame, { broadcast: false });
      break;
    case "segments":
      refreshSegments();
      break;
    case "analysis":
      refreshAnalysis();
      break;
    case "close":
      window.close();
      break;
  }
});

// ===========================================================================
// Wiring
// ===========================================================================

function wire() {
  document.querySelectorAll(".seg-btn").forEach(
    (b) => b.addEventListener("click", () => setView(b.dataset.view)));

  $("insp-zoom").addEventListener("change", (e) => {
    S.zoom = e.target.value;
    if (S.zoom === "fit") S.pan = { x: 0, y: 0 };
    render();
  });
  $("insp-grain").addEventListener("click", (e) => {
    S.pixelGrid = !S.pixelGrid;
    e.currentTarget.classList.toggle("active", S.pixelGrid);
    render();
  });

  $("insp-first").addEventListener("click", () => goto(0));
  $("insp-last").addEventListener("click", () => goto(S.frameCount - 1));
  $("insp-prev").addEventListener("click", () => step(-1));
  $("insp-next").addEventListener("click", () => step(1));
  $("insp-back10").addEventListener("click", () => step(-10));
  $("insp-fwd10").addEventListener("click", () => step(10));
  $("insp-play").addEventListener("click", () => setPlaying(!S.playing));
  $("insp-frame").addEventListener("change", (e) => goto(Number(e.target.value)));

  $("insp-loop").addEventListener("click", toggleLoop);
  $("insp-mark-in").addEventListener("click", markIn);
  $("insp-mark-out").addEventListener("click", markOut);
  $("insp-loop-clear").addEventListener("click", () => {
    S.loopIn = S.loopOut = null;
    S.loopOn = false;
    $("insp-loop").classList.remove("active");
    updateCacheBar();
    drawScrub();
  });
  $("insp-cache").addEventListener("click", cacheLoop);

  $("insp-make-section").addEventListener("click", async () => {
    const bounds = loopBounds();
    if (!bounds || !S.projectId) { status("mark a loop range first", "warn"); return; }
    const name = prompt("Name this section:", `Frames ${bounds[0]}–${bounds[1]}`);
    if (name === null) return;
    try {
      await api("/api/segments", {
        method: "POST",
        body: { project_id: S.projectId, start: bounds[0], end: bounds[1], name },
      });
      status(`section "${name}" created`, "ok");
      await refreshSegments();
      channel.postMessage({ type: "segments", from: "inspector" });
    } catch (err) {
      status(err.message, "err");
    }
  });

  $("insp-fps").addEventListener("change", (e) => {
    S.playRate = clamp(Number(e.target.value) || 12, 1, 60);
    if (S.playing) setPlaying(true);
  });
  $("insp-sync").addEventListener("change", (e) => { S.sync = e.target.checked; });

  window.addEventListener("resize", () => { layoutScrub(); render(); });
  window.addEventListener("beforeunload", () => {
    channel.postMessage({ type: "inspector-closed", from: "inspector" });
  });

  initScrubPointer();
  initStagePointer();
  initKeys();
}

// ===========================================================================
// Boot
// ===========================================================================

(function boot() {
  wire();
  const q = new URLSearchParams(location.search);
  const pid = q.get("project");
  const frame = Number(q.get("frame") ?? 0);
  layoutScrub();

  // Ask the main window for the live parameter set; the URL only carries
  // enough to identify the project.
  channel.postMessage({ type: "inspector-ready", from: "inspector" });

  if (pid) {
    adoptProject(pid).then(() => goto(frame, { broadcast: false }));
  }
})();
