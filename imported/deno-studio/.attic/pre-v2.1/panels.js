/**
 * panels.js — draggable splitters and panel open/close (Design.md workshop).
 *
 * Holds left-click on a 4px border and drags. Same contract as old AppShell:
 * explorer min 200 / max 500, inspector inverted delta, grade split 160+.
 * Depth lives inside the inspector, so there is no separate bottom strip.
 * Graph and Grade share the center column (never XOR). Layout is persisted in
 * localStorage so a session survives reload.
 */
(function () {
  const KEY = "ars:workspace-layout";
  const MIN_W = 200;
  const MIN_INSPECTOR = 260;
  const MAX_W = 520;
  const MIN_GRADE = 220;

  const defaults = {
    palette: 218,
    inspector: 340,
    grade: 340,
    showPalette: true,
    showInspector: true,
    showGraph: true,
    showGrade: true,
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
      // Display profiles (core/profiles.ts): on a first visit, phones start
      // with both drawers shut and tablets with the slide-over inspector shut,
      // so the canvas is what you see. A saved layout still wins.
      if (!raw && globalThis.innerWidth <= 1024) {
        parsed.showInspector = false;
        if (globalThis.innerWidth <= 767) parsed.showPalette = false;
      }
      // Lab displays: type runs 16–24px, so the docks widen with it.
      if (!raw && globalThis.innerWidth > 1920) {
        parsed.palette = 290;
        parsed.inspector = 440;
      }
      if (parsed.showGraph === undefined) parsed.showGraph = true;
      if (parsed.showGrade === undefined) parsed.showGrade = true;
      if (!Number.isFinite(Number(parsed.grade))) parsed.grade = defaults.grade;
      const q = new URLSearchParams(location.search);
      const pane = q.get("pane") || q.get("mode");
      if (pane === "grade") {
        parsed.showGrade = true;
        parsed.showGraph = true;
        parsed.grade = Math.max(Number(parsed.grade) || 0, 360);
      } else if (pane === "graph") {
        parsed.showGraph = true;
        parsed.showGrade = true;
      } else if (pane === "grade-only") {
        parsed.showGrade = true;
        parsed.showGraph = false;
      } else if (pane === "graph-only") {
        parsed.showGraph = true;
        parsed.showGrade = false;
      }
      if (!parsed.showGraph && !parsed.showGrade) parsed.showGraph = true;
      return parsed;
    } catch {
      return { ...defaults };
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }
  }

  const state = load();
  let lastSignature = null;

  function ensureOnePane() {
    if (!state.showGraph && !state.showGrade) state.showGraph = true;
  }

  function maxGrade() {
    const host = document.getElementById("center");
    return Math.max(MIN_GRADE, (host?.clientHeight || 720) - 88);
  }

  function apply() {
    ensureOnePane();
    state.inspector = clamp(state.inspector, MIN_INSPECTOR, MAX_W);
    const root = document.documentElement;
    root.style.setProperty("--palette-w", state.showPalette ? `${state.palette}px` : "0px");
    root.style.setProperty("--inspector-w", state.showInspector ? `${state.inspector}px` : "0px");
    const gradeH = state.showGrade && state.showGraph
      ? clamp(state.grade, MIN_GRADE, maxGrade())
      : state.showGrade
      ? 0
      : 0;
    if (state.showGrade && state.showGraph) state.grade = gradeH;
    root.style.setProperty("--grade-h", state.showGrade && state.showGraph ? `${gradeH}px` : "0px");
    document.body.classList.toggle("hide-palette", !state.showPalette);
    document.body.classList.toggle("hide-inspector", !state.showInspector);
    document.body.classList.toggle("hide-graph", !state.showGraph);
    document.body.classList.toggle("hide-grade", !state.showGrade);
    document.body.classList.toggle("mode-grade", state.showGrade);
    document.body.classList.toggle("mode-graph", state.showGraph);
    document.getElementById("palette")?.classList.toggle("open", state.showPalette);
    document.getElementById("inspector")?.classList.toggle("open", state.showInspector);
    syncButtons();
    syncGrade();
    const signature = `${state.showGraph}:${state.showGrade}`;
    if (lastSignature !== signature) {
      lastSignature = signature;
      document.dispatchEvent(new CustomEvent("ars:workspace-mode", {
        detail: {
          mode: state.showGrade && !state.showGraph ? "grade" : "graph",
          showGraph: state.showGraph,
          showGrade: state.showGrade,
        },
      }));
    }
    globalThis.dispatchEvent(new Event("resize"));
  }

  function syncButtons() {
    document.querySelectorAll("[data-toggle-panel]").forEach((btn) => {
      const name = btn.getAttribute("data-toggle-panel");
      const on = name === "palette"
        ? state.showPalette
        : name === "inspector" || name === "carousel"
        ? state.showInspector
        : name === "graph"
        ? state.showGraph
        : name === "grade"
        ? state.showGrade
        : false;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("is-on", on);
    });
    document.querySelectorAll("[data-workspace-mode]").forEach((btn) => {
      const name = btn.getAttribute("data-workspace-mode");
      const on = name === "grade" ? state.showGrade : state.showGraph;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function bindDeskFrame(el, embed) {
    if (!(el instanceof HTMLIFrameElement)) return;
    const picker = document.getElementById("project-picker");
    const pid = picker instanceof HTMLSelectElement ? picker.value : "";
    const frames = picker instanceof HTMLSelectElement
      ? Number(picker.selectedOptions[0]?.dataset.frames ?? 0)
      : 0;
    // A studio project has no reel. Reloading Grade with that id kept the
    // previous filmstrip because the engine 404s and the iframe kept state.
    const next = pid && frames > 0
      ? `/desk/?embed=${embed}&project=${encodeURIComponent(pid)}`
      : `/desk/?embed=${embed}`;
    const current = el.getAttribute("src") || "";
    if (current !== next) el.src = next;
  }

  function syncGrade() {
    bindDeskFrame(document.getElementById("grade-frame"), "1");
    bindDeskFrame(document.getElementById("desk-tools"), "tools");
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  let drag = null;

  function setDragging(on) {
    document.body.classList.toggle("is-dragging", on);
    document.body.style.cursor = on
      ? (drag?.kind === "palette" || drag?.kind === "inspector" ? "col-resize" : "row-resize")
      : "";
    document.body.style.userSelect = on ? "none" : "";
  }

  function onMove(e) {
    if (!drag) return;
    if (drag.kind === "palette") {
      state.palette = clamp(drag.startSize + (e.clientX - drag.start), MIN_W, MAX_W);
    } else if (drag.kind === "inspector") {
      state.inspector = clamp(drag.startSize + (drag.start - e.clientX), MIN_INSPECTOR, MAX_W);
    } else if (drag.kind === "grade") {
      state.grade = clamp(drag.startSize + (drag.start - e.clientY), MIN_GRADE, maxGrade());
      state.showGrade = true;
      state.showGraph = true;
    }
    apply();
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    setDragging(false);
    save(state);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  document.addEventListener("mousedown", (e) => {
    const handle = e.target instanceof Element
      ? e.target.closest("[data-resize]")
      : null;
    if (!handle || e.button !== 0) return;
    const kind = handle.getAttribute("data-resize");
    e.preventDefault();
    if (kind === "palette") {
      state.showPalette = true;
      drag = { kind, start: e.clientX, startSize: state.palette || defaults.palette };
    } else if (kind === "inspector") {
      state.showInspector = true;
      drag = { kind, start: e.clientX, startSize: state.inspector || defaults.inspector };
    } else if (kind === "grade") {
      state.showGraph = true;
      state.showGrade = true;
      drag = { kind, start: e.clientY, startSize: state.grade || defaults.grade };
    } else {
      return;
    }
    setDragging(true);
  });

  document.addEventListener("click", (e) => {
    const tog = e.target instanceof Element
      ? e.target.closest("[data-toggle-panel]")
      : null;
    if (tog) {
      const name = tog.getAttribute("data-toggle-panel");
      if (name === "palette") state.showPalette = !state.showPalette;
      if (name === "inspector" || name === "carousel") state.showInspector = !state.showInspector;
      if (name === "graph") state.showGraph = !state.showGraph;
      if (name === "grade") state.showGrade = !state.showGrade;
      ensureOnePane();
      save(state);
      apply();
      return;
    }
    const modeBtn = e.target instanceof Element
      ? e.target.closest("[data-workspace-mode]")
      : null;
    if (modeBtn) {
      const name = modeBtn.getAttribute("data-workspace-mode");
      if (name === "grade") state.showGrade = !state.showGrade;
      else state.showGraph = !state.showGraph;
      ensureOnePane();
      save(state);
      apply();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement) return;
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "1") {
      e.preventDefault();
      state.showPalette = !state.showPalette;
      save(state);
      apply();
    } else if (e.key === "2" || e.key === "3") {
      e.preventDefault();
      state.showInspector = !state.showInspector;
      save(state);
      apply();
    } else if (e.key === "4") {
      e.preventDefault();
      state.showGraph = !state.showGraph;
      ensureOnePane();
      save(state);
      apply();
    } else if (e.key === "5") {
      e.preventDefault();
      state.showGrade = !state.showGrade;
      ensureOnePane();
      save(state);
      apply();
    }
  });

  globalThis.ArsPanels = {
    state,
    apply,
    save: () => save(state),
    setMode(mode) {
      if (mode === "grade") state.showGrade = true;
      else state.showGraph = true;
      ensureOnePane();
      save(state);
      apply();
    },
    showPane(name, on) {
      if (name === "grade") state.showGrade = on !== false;
      if (name === "graph") state.showGraph = on !== false;
      if (name === "inspector") state.showInspector = on !== false;
      if (name === "palette") state.showPalette = on !== false;
      ensureOnePane();
      save(state);
      apply();
    },
    cycleFocus() {
      if (state.showGraph && state.showGrade) state.showGrade = false;
      else if (state.showGraph) {
        state.showGraph = false;
        state.showGrade = true;
      } else {
        state.showGraph = true;
        state.showGrade = true;
      }
      save(state);
      apply();
    },
    refreshGrade: syncGrade,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
