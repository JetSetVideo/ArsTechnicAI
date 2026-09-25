/**
 * desk-panels.js — drag the border between viewer and the right-hand cards.
 * Same gesture as the old ArsTechnicAI AppShell inspector handle (inverted X).
 */
(function () {
  const KEY = "ars:desk-inspector-w";
  const SHOW = "ars:desk-show-cards";
  const MIN = 280;
  const MAX = 560;
  const root = document.documentElement;
  const embed = new URLSearchParams(location.search).get("embed");
  let width = Number(localStorage.getItem(KEY)) || 400;
  width = Math.min(MAX, Math.max(MIN, width));
  let show = localStorage.getItem(SHOW) !== "0";

  if (embed === "1" || embed === "tools") root.classList.add("embed");
  if (embed === "1") {
    root.classList.add("embed-grade");
    show = false;
  }
  if (embed === "tools") {
    root.classList.add("embed-tools");
    show = true;
  }

  function apply() {
    root.style.setProperty("--desk-inspector-w", show ? `${width}px` : "0px");
    root.classList.toggle("hide-desk-cards", !show);
    const btn = document.getElementById("btn-toggle-cards");
    if (btn) {
      btn.setAttribute("aria-pressed", String(show));
      btn.classList.toggle("active", show);
    }
  }

  apply();

  let drag = null;
  document.addEventListener("mousedown", (e) => {
    const h = e.target instanceof Element ? e.target.closest("[data-resize=inspector]") : null;
    if (!h || e.button !== 0) return;
    e.preventDefault();
    show = true;
    drag = { start: e.clientX, size: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    apply();
  });
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    width = Math.min(MAX, Math.max(MIN, drag.size + (drag.start - e.clientX)));
    apply();
  });
  document.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      localStorage.setItem(KEY, String(Math.round(width)));
      if (embed !== "1" && embed !== "tools") {
        localStorage.setItem(SHOW, show ? "1" : "0");
      }
    } catch { /* */ }
  });

  document.getElementById("btn-toggle-cards")?.addEventListener("click", () => {
    if (embed === "1" || embed === "tools") return;
    show = !show;
    try { localStorage.setItem(SHOW, show ? "1" : "0"); } catch { /* */ }
    apply();
  });
})();
