/**
 * console.ts — the bottom terminal: the graph as a table, the pre-run gate,
 * live telemetry, and the lineage query box.
 *
 * The canvas shows the graph as a picture. This shows the same graph as the
 * evaluator will see it: execution order, how many times each node runs once
 * loops multiply, which steps leave the machine, the memory a run will hold,
 * and — after a run — how long each step actually took. Loop counts can be
 * overridden here before a run; the override feeds both the report and the
 * stack evaluation, so what the table says is what runs.
 *
 * Kept out of `app.ts` on purpose: it reads the canvas through a narrow host
 * interface and owns no graph state beyond the overrides and the lineage.
 */

import type { GraphDocument } from "../core/graph.ts";
import type { NodeId } from "../core/ids.ts";
import type { NodeRegistry } from "../core/registry.ts";
import {
  confirmRun,
  gateAllows,
  type GateToken,
  type PreRunReport,
  preRunReport,
  summarise,
} from "../core/diagnostics.ts";
import { describeRun } from "../core/providers.ts";
import { type Cell, parseFilter } from "../core/columnar.ts";
import { HybridLineage, type HybridSnapshot, type Transformation } from "../core/hybrid.ts";
import type { AssetSource } from "../core/assets.ts";
import { originOf } from "../core/hybrid.ts";

export interface ConsoleHost {
  graph(): GraphDocument;
  readonly registry: NodeRegistry;
  seeds(): NodeId[];
  sequenceLength(): number;
  /** Last recorded elapsed ms and version count for a node, if any. */
  lastRun(node: NodeId): { elapsedMs: number; versions: number } | null;
  focusNode(id: NodeId): void;
  toast(message: string, bad?: boolean): void;
}

export interface LineageRecordInput {
  readonly versionId: string;
  readonly node: NodeId;
  readonly nodeType: string;
  readonly nodeName: string;
  readonly source: AssetSource;
  readonly frame: number;
  readonly params: Readonly<Record<string, unknown>>;
  /** Latest versions of upstream nodes. */
  readonly upstream: readonly string[];
  /** The node's own previous version, when this is a re-run with changes. */
  readonly previous: string | null;
  readonly elapsedMs?: number;
  readonly widthPx?: number;
  readonly heightPx?: number;
}

const el = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${fmtInt(mb)} MB`;

export function mountConsole(host: ConsoleHost) {
  const overrides: Record<string, number> = {};
  let token: GateToken | null = null;
  let lastReport: PreRunReport | null = null;
  let refreshQueued = false;

  // ---------------------------------------------------------------- chrome
  const root = el("console");
  const toggle = el<HTMLButtonElement>("console-toggle");
  const setExpanded = (on: boolean) => {
    root?.classList.toggle("is-expanded", on);
    if (toggle) {
      toggle.textContent = on ? "Hide" : "Console";
      toggle.setAttribute("aria-expanded", String(on));
    }
    try {
      localStorage.setItem("ars:console-expanded", on ? "1" : "0");
    } catch { /* private mode */ }
    globalThis.dispatchEvent(new Event("resize"));
  };
  // Expanded by default only where it does not starve Grade and the canvas of
  // height: tall desktop windows and lab displays. Everywhere else it is one
  // bar away, with the summary line always visible.
  let initial = globalThis.innerWidth >= 768 && globalThis.innerHeight >= 1000;
  try {
    const saved = localStorage.getItem("ars:console-expanded");
    if (saved !== null) initial = saved === "1";
  } catch { /* private mode */ }
  setExpanded(initial);
  toggle?.addEventListener("click", () => setExpanded(!root?.classList.contains("is-expanded")));

  document.querySelectorAll<HTMLButtonElement>("[data-console-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.consoleTab;
      document.querySelectorAll<HTMLButtonElement>("[data-console-tab]").forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", String(on));
      });
      document.querySelectorAll<HTMLElement>("[data-console-pane]").forEach((pane) => {
        pane.hidden = pane.dataset.consolePane !== name;
      });
      if (!root?.classList.contains("is-expanded")) setExpanded(true);
      if (name === "lineage") void runQuery();
    });
  });

  // -------------------------------------------------------------- telemetry
  const fpsEl = el("console-fps");
  let frames = 0;
  let windowStart = performance.now();
  let fps = 0;
  const tick = (now: number) => {
    frames++;
    if (now - windowStart >= 500) {
      fps = (frames * 1000) / (now - windowStart);
      frames = 0;
      windowStart = now;
      if (fpsEl) {
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        fpsEl.textContent = `${fps.toFixed(0)} fps` +
          (mem ? ` · ${Math.round(mem.usedJSHeapSize / 1048576)} MB heap` : "");
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ------------------------------------------------------ execution table
  function report(): PreRunReport {
    const graph = host.graph();
    lastReport = preRunReport(graph, host.registry, {
      seeds: host.seeds(),
      sequenceLength: Math.max(1, host.sequenceLength()),
      iterationOverrides: overrides,
    });
    return lastReport;
  }

  function render(): void {
    const r = report();
    const summaryEl = el("console-summary");
    if (summaryEl) summaryEl.textContent = r.scope === 0 ? "Empty canvas." : summarise(r);
    const body = el("console-exec");
    if (!body) return;
    const graph = host.graph();
    const loopByStack = new Map(r.loops.map((l) => [l.stack, l]));
    const inLoop = new Set(r.loops.flatMap((l) => l.body));
    body.innerHTML = r.order.map((step) => {
      const loop = loopByStack.get(step.node);
      const last = host.lastRun(step.node as NodeId);
      const state = graph.nodes[step.node]?.state ?? "idle";
      const classes = [
        step.cost === "network" ? "is-network" : "",
        inLoop.has(step.node) || loop ? "is-loop" : "",
      ].join(" ");
      const runs = loop
        ? `<input class="console-iter" type="number" min="1" max="240" step="1" ` +
          `data-override="${escapeHtml(step.node)}" value="${loop.iterations}" ` +
          `title="Iterations for this loop. Requested: ${loop.requested}${
            loop.overridden ? " (overridden)" : ""
          }" aria-label="Iterations for ${escapeHtml(step.name)}">`
        : fmtInt(step.runs);
      return `<tr class="${classes}" data-node="${escapeHtml(step.node)}">` +
        `<td class="num">${step.order + 1}</td>` +
        `<td>${escapeHtml(step.name)}</td>` +
        `<td>${escapeHtml(step.type)}</td>` +
        `<td>${step.cost}</td>` +
        `<td class="num">${runs}</td>` +
        `<td>${escapeHtml(step.model ?? "—")}</td>` +
        `<td class="num">${
          step.inputTokens + step.outputTokens > 0
            ? `${fmtInt(step.inputTokens)} / ${fmtInt(step.outputTokens)}`
            : "—"
        }</td>` +
        `<td class="num">${step.vramMb > 0 ? fmtMb(step.vramMb) : "—"}</td>` +
        `<td class="num">${last ? `${fmtInt(Math.round(last.elapsedMs))} ms` : "—"}</td>` +
        `<td class="num">${last ? `v${last.versions}` : "—"}</td>` +
        `<td>${state}</td>` +
        `</tr>`;
    }).join("");

    const foot = el("console-exec-foot");
    if (foot) {
      foot.innerHTML = r.scope === 0 ? "" : `<tr>` +
        `<td></td><td colspan="3">${r.executionPaths} path(s) · ${r.childBranches} branch(es) · ${r.loops.length} loop(s)</td>` +
        `<td class="num">${fmtInt(r.evaluations)}</td><td>${escapeHtml(describeRun(r.cost))}</td>` +
        `<td class="num">${fmtInt(r.tokens.input)} / ${fmtInt(r.tokens.output)}</td>` +
        `<td class="num">${r.memory.peakVramMb > 0 ? fmtMb(r.memory.peakVramMb) : "—"}</td>` +
        `<td colspan="3">~${fmtMb(r.memory.peakRamMb)} RAM</td></tr>`;
    }
    const problems = el("console-problems");
    if (problems) {
      problems.hidden = r.problems.length === 0;
      problems.textContent = r.problems.join(" · ");
    }
  }

  el("console-exec")?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("input")) return;
    const row = target.closest<HTMLTableRowElement>("tr[data-node]");
    if (row?.dataset.node) host.focusNode(row.dataset.node as NodeId);
  });
  el("console-exec")?.addEventListener("change", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("input[data-override]");
    if (!input) return;
    const value = Math.floor(Number(input.value));
    if (Number.isFinite(value) && value >= 1) {
      overrides[input.dataset.override!] = Math.min(240, value);
    } else delete overrides[input.dataset.override!];
    render();
  });

  function refresh(): void {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      render();
    }, 120);
  }

  // ------------------------------------------------------------ the gate
  /**
   * Show the structural report and wait. Resolves true only on an explicit
   * Run. A token for exactly this structure (same digest, under 15 minutes
   * old) skips the dialog — widen a loop and it asks again.
   */
  function confirmBeforeRun(
    seedsOverride?: readonly NodeId[],
    /** Inspect a graph other than the canvas's — for verification; never committed. */
    graphOverride?: GraphDocument,
  ): Promise<boolean> {
    const graph = graphOverride ?? host.graph();
    const r = preRunReport(graph, host.registry, {
      seeds: seedsOverride ? [...seedsOverride] : graphOverride ? [] : host.seeds(),
      sequenceLength: Math.max(graphOverride ? 24 : 1, host.sequenceLength()),
      iterationOverrides: overrides,
    });
    if (gateAllows(r, token).ok) return Promise.resolve(true);
    const hard = r.problems.find((p) => p.includes("cycle"));
    if (hard) {
      host.toast(hard, true);
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "consent-back";
      back.id = "run-gate";
      const loops = r.loops.length === 0
        ? "none"
        : r.loops.map((l) =>
          `${escapeHtml(l.label)} ×${l.iterations}${l.overridden ? " (override)" : ""}`
        ).join(", ");
      const byModel = r.cost.byModel.map((m) =>
        `<div class="consent-line"><span>${escapeHtml(m.name)} · ${m.calls} call(s)</span>` +
        `<span>${
          m.localAlternative
            ? `<span class="consent-alt">local: ${escapeHtml(m.localAlternative)}</span>`
            : ""
        }</span></div>`
      ).join("");
      back.innerHTML = `
        <div class="consent t-primary" role="dialog" aria-modal="true" aria-labelledby="run-gate-title">
          <h2 id="run-gate-title">Before this runs</h2>
          <p class="consent-lead">${
        escapeHtml(
          describeRun(r.cost) === "Nothing to run."
            ? `${r.evaluations} evaluations · free`
            : describeRun(r.cost),
        )
      }</p>
          <dl class="gate-grid t-secondary">
            <dt>Execution paths</dt><dd>${r.executionPaths}</dd>
            <dt>Loops</dt><dd>${loops}</dd>
            <dt>Child branches</dt><dd>${r.childBranches}</dd>
            <dt>Node evaluations</dt><dd>${fmtInt(r.evaluations)} across ${r.scope} node(s)</dd>
            <dt>Peak memory</dt><dd>~${fmtMb(r.memory.peakRamMb)} RAM${
        r.memory.peakVramMb > 0 ? ` · ~${fmtMb(r.memory.peakVramMb)} VRAM` : ""
      }</dd>
            <dt>Tokens</dt><dd>${
        r.tokens.input + r.tokens.output > 0
          ? `~${fmtInt(r.tokens.input)} in / ~${fmtInt(r.tokens.output)} out`
          : "none"
      }</dd>
            <dt>API calls</dt><dd>${r.cost.billedCalls} paid · ${r.cost.localCalls} local</dd>
          </dl>
          ${byModel ? `<div class="consent-lines t-secondary">${byModel}</div>` : ""}
          ${
        r.problems.length
          ? `<ul class="gate-problems">${
            r.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
          }</ul>`
          : ""
      }
          <div class="consent-actions">
            <button type="button" class="action t-primary" data-gate="cancel">Cancel</button>
            <button type="button" class="action t-primary consent-go" data-gate="run">Run</button>
          </div>
        </div>`;
      const finish = (ok: boolean) => {
        if (ok) token = confirmRun(r);
        back.remove();
        document.removeEventListener("keydown", onKey, true);
        resolve(ok);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          finish(false);
        }
      };
      back.addEventListener("click", (e) => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-gate]");
        if (button) finish(button.dataset.gate === "run");
        else if (e.target === back) finish(false);
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(back);
      back.querySelector<HTMLButtonElement>('[data-gate="run"]')?.focus();
    });
  }

  // -------------------------------------------------------------- lineage
  let lineage = new HybridLineage();
  let lineageProject: string | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  async function bindProject(projectId: string | null): Promise<void> {
    if (projectId === lineageProject) return;
    lineageProject = projectId;
    lineage = new HybridLineage();
    const link = el<HTMLAnchorElement>("console-blueprint");
    if (link) link.href = projectId ? `/lineage/${encodeURIComponent(projectId)}/blueprint` : "#";
    if (!projectId) return;
    try {
      const res = await fetch(`/lineage/${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const body = await res.json() as { snapshot: HybridSnapshot | null };
      if (body.snapshot && lineageProject === projectId) {
        lineage = HybridLineage.fromSnapshot(body.snapshot);
      }
    } catch {
      // Server down: lineage starts empty and the next save will be refused
      // if it would not extend what is on disk. Nothing is lost.
    }
  }

  const scalar = (v: unknown): Cell | undefined => {
    if (v && typeof v === "object" && "value" in v) v = (v as { value: unknown }).value;
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") return v.length > 2000 ? v.slice(0, 2000) : v;
    return undefined;
  };

  /** Mirror one ledger version into the graph + column stores. */
  function record(input: LineageRecordInput): void {
    if (lineage.node(input.versionId)) return; // already mirrored: identical re-run
    const params: Record<string, Cell> = {
      node: input.node,
      node_type: input.nodeType,
      node_name: input.nodeName,
      frame: input.frame,
    };
    for (const [port, value] of Object.entries(input.params)) {
      const s = scalar(value);
      if (s === undefined) continue;
      params[port === "model" ? "model_name" : port] = s;
    }
    if (input.elapsedMs !== undefined) params.execution_time_ms = input.elapsedMs;
    if (input.widthPx !== undefined) params.width_px = input.widthPx;
    if (input.heightPx !== undefined) params.height_px = input.heightPx;

    const parents: string[] = [];
    const transformations: Transformation[] = [];
    if (input.previous && lineage.node(input.previous)) {
      parents.push(input.previous);
      transformations.push("param_tweak");
    }
    for (const up of input.upstream) {
      if (lineage.node(up) && !parents.includes(up)) {
        parents.push(up);
        transformations.push(input.nodeType);
      }
    }
    try {
      if (parents.length === 0) {
        const origin = originOf(input.source);
        lineage.create({
          id: input.versionId,
          origin_type: origin === "derived" ? "generated" : origin,
          label: `${input.nodeName} · f${input.frame}`,
          params,
        });
      } else {
        lineage.derive({
          id: input.versionId,
          parents,
          transformations,
          transformation: input.nodeType,
          inherit: false,
          label: `${input.nodeName} · f${input.frame}`,
          changes: params,
        });
      }
    } catch (error) {
      host.toast(
        `Lineage not recorded: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
      return;
    }
    scheduleSave();
  }

  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!lineageProject) return;
      try {
        const res = await fetch(`/lineage/${encodeURIComponent(lineageProject)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(lineage.snapshot()),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          host.toast(`Lineage save refused: ${body.detail ?? res.status}`, true);
        }
      } catch {
        // Offline: kept in memory; the next save carries it.
      }
    }, 600);
  }

  async function runQuery(): Promise<void> {
    const note = el("console-lineage-note");
    const head = el("console-lineage-head");
    const body = el("console-lineage");
    if (!note || !head || !body) return;
    const text = el<HTMLInputElement>("console-filter")?.value ?? "";
    note.classList.remove("is-error");
    try {
      parseFilter(text); // fail fast in the browser with the same message
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : String(error);
      note.classList.add("is-error");
      return;
    }
    if (!lineageProject) {
      note.textContent = "Bind a project to query its lineage.";
      head.innerHTML = "";
      body.innerHTML = "";
      return;
    }
    try {
      const res = await fetch(`/lineage/${encodeURIComponent(lineageProject)}/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filter: text, limit: 500 }),
      });
      const data = await res.json() as {
        detail?: string;
        version?: number;
        schema?: Array<{ field: string }>;
        rows?: Array<Record<string, unknown>>;
      };
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
      const rows = data.rows ?? [];
      const preferred = [
        "label",
        "origin_type",
        "depth",
        "model_name",
        "prompt",
        "seed",
        "guidance_scale",
        "execution_time_ms",
        "record_id",
      ];
      const present = new Set(rows.flatMap((r) => Object.keys(r)));
      const cols = preferred.filter((c) => present.has(c)).concat(
        [...present].filter((c) =>
          !preferred.includes(c) && !["asset_id", "parents", "node"].includes(c)
        ).slice(0, 6),
      );
      note.textContent = `${rows.length} record(s) · lineage v${data.version ?? 0}`;
      head.innerHTML = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
      body.innerHTML = rows.map((r) =>
        `<tr data-node="${escapeHtml(String(r.node ?? ""))}">${
          cols.map((c) => `<td>${escapeHtml(r[c] === undefined ? "" : String(r[c]))}</td>`).join("")
        }</tr>`
      ).join("");
    } catch (error) {
      note.textContent = `Query failed: ${error instanceof Error ? error.message : String(error)}`;
      note.classList.add("is-error");
    }
  }

  el("console-query")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void runQuery();
  });
  el("console-lineage")?.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-node]");
    if (row?.dataset.node && host.graph().nodes[row.dataset.node]) {
      host.focusNode(row.dataset.node as NodeId);
    }
  });

  render();

  return {
    refresh,
    confirmBeforeRun,
    overrideFor: (stack: NodeId): number | null => overrides[stack] ?? null,
    bindProject,
    record,
    get lineage() {
      return lineage;
    },
    get lastReport() {
      return lastReport;
    },
    get fps() {
      return fps;
    },
    expanded: () => root?.classList.contains("is-expanded") ?? false,
  };
}
