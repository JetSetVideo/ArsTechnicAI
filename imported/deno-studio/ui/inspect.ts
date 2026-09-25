/**
 * inspect.ts — the inspector's frame: tabs, badges, and render keying.
 *
 * The inspector used to be one long column — node values, a whole second desk
 * in an iframe, the depth carousel, workflow variables and diagnostics —
 * scrolled as one, with the iframe scrolling inside it. Two things were wrong
 * with that beyond the nested scroll:
 *
 *   1. **It rebuilt on every paint.** `renderInspector` ran inside `draw()`,
 *      replaced every control and reset `scrollTop` to 0. Panning the canvas
 *      threw the panel back to the top each frame, and a slider being dragged
 *      was destroyed under the pointer by the commit its own `input` caused.
 *   2. **It booted the desk twice on load.** The Restorer iframe is a full app
 *      (4.8 MB of analysis, WebSocket, filmstrip) whether or not anyone opened
 *      those cards.
 *
 * So the column is four tabs, the Restorer frame mounts on first open, and
 * rendering is keyed: `RenderKey` decides whether the DOM needs rebuilding at
 * all, and an edit that came from the inspector itself never rebuilds it.
 */

export type InspectorTab = "node" | "restorer" | "depth" | "workflow";

const TABS: readonly InspectorTab[] = ["node", "restorer", "depth", "workflow"];
const STORE = "ars:inspector-tab";

export interface InspectorTabs {
  show(tab: InspectorTab): void;
  current(): InspectorTab;
  badge(tab: InspectorTab, text: string, tone?: "error" | "info"): void;
}

function readStored(): InspectorTab {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && (TABS as readonly string[]).includes(saved)) return saved as InspectorTab;
  } catch { /* private mode */ }
  return "node";
}

export function mountInspectorTabs(options: {
  /** Called after a tab becomes visible — lazy mounts and size-dependent paints go here. */
  onShow: (tab: InspectorTab, first: boolean) => void;
}): InspectorTabs {
  let active: InspectorTab = readStored();
  const seen = new Set<InspectorTab>();

  const show = (tab: InspectorTab) => {
    active = tab;
    document.querySelectorAll<HTMLButtonElement>("[data-insp-tab]").forEach((b) => {
      const on = b.dataset.inspTab === tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll<HTMLElement>("[data-insp-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.inspPane !== tab;
    });
    try {
      localStorage.setItem(STORE, tab);
    } catch { /* private mode */ }
    const first = !seen.has(tab);
    seen.add(tab);
    options.onShow(tab, first);
  };

  document.querySelectorAll<HTMLButtonElement>("[data-insp-tab]").forEach((b) => {
    b.addEventListener("click", () => show(b.dataset.inspTab as InspectorTab));
    // Arrow keys move along the tablist, per the ARIA tabs pattern.
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const i = TABS.indexOf(active);
      const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
      show(next);
      document.querySelector<HTMLButtonElement>(`[data-insp-tab="${next}"]`)?.focus();
    });
  });

  // ⌥1–⌥4 jump straight to a tab. `code` rather than `key`: Option+digit
  // produces a symbol on a Mac keyboard.
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    const m = e.code.match(/^Digit([1-4])$/);
    if (!m) return;
    e.preventDefault();
    show(TABS[Number(m[1]) - 1]!);
  });

  show(active);

  return {
    show,
    current: () => active,
    badge(tab, text, tone = "info") {
      const el = document.getElementById(`insp-badge-${tab}`);
      if (!el) return;
      el.textContent = text;
      el.hidden = text === "";
      el.classList.toggle("is-error", tone === "error");
    },
  };
}

/**
 * Decides whether the Node pane must be rebuilt.
 *
 * `claim()` is called with the key of what the inspector would show now. It
 * answers true only when that differs from what is on screen — and never for
 * the change an inspector control just made, which `absorb()` pre-registers.
 */
export class RenderKey {
  #shown = "";
  #absorbNext = false;

  /** The next differing key came from the inspector's own control: accept it silently. */
  absorb(): void {
    this.#absorbNext = true;
  }

  claim(key: string): boolean {
    if (key === this.#shown) return false;
    this.#shown = key;
    if (this.#absorbNext) {
      this.#absorbNext = false;
      return false;
    }
    return true;
  }

  /** Force the next claim to rebuild (e.g. after the pane was hidden and re-shown). */
  reset(): void {
    this.#shown = "";
    this.#absorbNext = false;
  }
}

/**
 * Keep the user's place across a rebuild: scroll offset and the focused
 * control (by its `data-port`). Selection changes deliberately do not use
 * this — a different node starts at the top.
 */
export function preservePlace(container: HTMLElement, rebuild: () => void): void {
  const scroller = container.closest<HTMLElement>(".insp-pane") ?? container;
  const top = scroller.scrollTop;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const port = active && container.contains(active)
    ? active.closest<HTMLElement>("[data-port]")?.dataset.port
    : undefined;
  rebuild();
  scroller.scrollTop = top;
  if (port) {
    container.querySelector<HTMLElement>(
      `[data-port="${CSS.escape(port)}"] input, [data-port="${CSS.escape(port)}"] select`,
    )
      ?.focus({ preventScroll: true });
  }
}

/** "3s ago", "4 min ago", "yesterday" — for version rows. */
export function ago(epochMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - epochMs) / 1000));
  if (s < 45) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
