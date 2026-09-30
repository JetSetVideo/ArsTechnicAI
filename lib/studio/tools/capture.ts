/**
 * capture.ts — the visual verification pass.
 *
 * Loads the Workshop in headless Chrome at one viewport per display profile,
 * and for each one:
 *
 *   1. audits every rendered chrome font size against [8px, 32px] and the
 *      profile's base range (node cards are world-space and excluded);
 *   2. checks the panel strategy the profile promises actually happened —
 *      drawers on phones, a slide-over inspector on tablets, four docked
 *      panels on desktop, a persistent console on lab displays;
 *   3. checks the page never scrolls horizontally;
 *   4. on desktop, opens the pre-run gate and confirms it blocks;
 *   5. writes `<profile>.png` and a `<profile>.json` sidecar in the published
 *      capture schema, validated by `core/profiles.ts` before it is written.
 *
 * Output goes to a new `captures/<timestamp>/` directory every run; nothing
 * is overwritten. A VLM (or a person) reviews the PNGs with the sidecar as
 * the statement of what each one is meant to show.
 *
 * Usage: deno task capture            (server must be up; WIV_UI to point elsewhere)
 */

import { Devtools, findChrome } from "../check_runtime.ts";
import { profileFor, type ProfileKey, PROFILES, validateSidecar } from "../core/profiles.ts";
import type { CaptureSidecar } from "../core/profiles.ts";

const UI = Deno.env.get("WIV_UI") ?? "http://127.0.0.1:8090/blueprint/";

const VIEWPORTS: ReadonlyArray<{ key: ProfileKey; width: number; height: number }> = [
  { key: "mobile-p", width: 390, height: 844 },
  { key: "mobile-l", width: 740, height: 360 },
  { key: "tablet", width: 820, height: 1180 },
  { key: "desktop", width: 1440, height: 900 },
  { key: "lab-workstation", width: 2560, height: 1440 },
];

interface Audit {
  fsBase: number;
  fontMin: number;
  fontMax: number;
  outOfBounds: Array<{ selector: string; px: number }>;
  horizontalOverflow: number;
  palette: { left: number; width: number; position: string; visible: boolean };
  inspector: { left: number; width: number; position: string; visible: boolean };
  consolePresent: boolean;
  consoleExpanded: boolean;
  consoleRows: number;
  wheelOpen: boolean;
  cards: number;
  wires: number;
  heapMb: number | null;
  fps: number;
  activeNode: string | null;
  gate?: { opened: boolean; blocked: boolean; rows: string[] };
  inspectorTabs?: {
    tabs: number;
    visiblePanes: number;
    selectedNode: string | null;
    inputSurvivesRedraw: boolean | null;
    scrollSurvivesRedraw: boolean | null;
  };
  grade?: { mounted: boolean; project: boolean; pictureShare: number | null };
}

const AUDIT = (withGate: boolean) => `
const pause = (ms) => new Promise(r => setTimeout(r, ms));
let W = null;
for (let i = 0; i < 80 && !(W = window.__wiv); i++) await pause(100);
if (!W) throw new Error("window.__wiv never appeared");
W.redraw();
W.console?.refresh();
await pause(400);

const cs = getComputedStyle(document.documentElement);
const probe = document.createElement('span');
probe.style.fontSize = 'var(--fs-base)';
document.body.appendChild(probe);
const fsBase = parseFloat(getComputedStyle(probe).fontSize);
probe.remove();

const outOfBounds = [];
for (const el of document.querySelectorAll('body *')) {
  if (el.closest('#world, iframe, svg, script, style, #node-wheel')) continue;
  const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  if (!text) continue;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) continue;
  const px = parseFloat(getComputedStyle(el).fontSize);
  if (px < 8 || px > 32) {
    outOfBounds.push({ selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), px });
  }
}

const box = (id) => {
  const el = document.getElementById(id);
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const visible = r.width > 0 && r.right > 1 && r.left < innerWidth - 1 && st.visibility !== 'hidden';
  return { left: Math.round(r.left), width: Math.round(r.width), position: st.position, visible };
};

const out = {
  fsBase,
  outOfBounds: outOfBounds.slice(0, 20),
  horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
  palette: box('palette'),
  inspector: box('inspector'),
  consolePresent: !!document.getElementById('console'),
  consoleExpanded: getComputedStyle(document.querySelector('#console .console-body')).display !== 'none',
  consoleRows: document.querySelectorAll('#console-exec tr').length,
  wheelOpen: !document.getElementById('node-wheel').hidden,
  cards: document.querySelectorAll('.card').length,
  wires: Object.keys(W.graph.edges).length,
  heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  fps: W.console?.fps ?? 0,
  activeNode: document.querySelector('.card.selected')?.dataset.node ?? null,
};

if (${withGate}) {
  // Inspector: tabs are exclusive, and a redraw keeps controls and scroll.
  const tabs = document.querySelectorAll('[data-insp-tab]').length;
  const visiblePanes = [...document.querySelectorAll('[data-insp-pane]')].filter(p => !p.hidden).length;
  const firstId = Object.keys(W.graph.nodes).find(id => (W.registry.get(W.graph.nodes[id].type)?.inputs.length ?? 0) > 3) ?? Object.keys(W.graph.nodes)[0] ?? null;
  let inputSurvivesRedraw = null, scrollSurvivesRedraw = null;
  if (firstId) {
    W.inspectorTabs?.show('node');
    W.select([firstId]);
    await pause(100);
    const pane = document.getElementById('insp-pane-node');
    const input = document.querySelector('#inspect-body input');
    pane.scrollTop = Math.min(40, pane.scrollHeight - pane.clientHeight);
    const top = pane.scrollTop;
    for (let i = 0; i < 5; i++) W.redraw();
    inputSurvivesRedraw = input ? document.contains(input) : null;
    scrollSurvivesRedraw = pane.scrollTop === top;
    W.select([]);
  }
  out.inspectorTabs = { tabs, visiblePanes, selectedNode: firstId, inputSurvivesRedraw, scrollSurvivesRedraw };

  // Grade: when a reel is bound, the picture owns most of the pane.
  const gf = document.getElementById('grade-frame');
  const gdoc = gf?.contentDocument;
  const wrapEl = gdoc?.querySelector('.canvas-wrap');
  const hasProject = !!gf?.getAttribute('src')?.includes('project=');
  out.grade = {
    mounted: !!gf?.getAttribute('src'),
    project: hasProject,
    pictureShare: hasProject && wrapEl && gf.clientHeight > 0
      ? Math.round(wrapEl.getBoundingClientRect().height / gf.clientHeight * 100) / 100 : null,
  };

  // A saved workflow, passed straight to the gate: the canvas (and the
  // project's graph.json it autosaves to) is never touched.
  const flows = await (await fetch('/flows')).json();
  const first = (flows.flows ?? flows)[0];
  const flow = first ? await (await fetch('/flows/' + encodeURIComponent(first.id))).json() : null;
  const pending = W.console.confirmBeforeRun(undefined, flow?.graph);
  await pause(150);
  const gate = document.getElementById('run-gate');
  let settled = false;
  pending.then(() => { settled = true; });
  await pause(50);
  out.gate = {
    opened: !!gate,
    blocked: !settled,
    rows: gate ? [...gate.querySelectorAll('dt')].map(d => d.textContent) : [],
  };
  window.__gateOpen = !!gate;
}
return out;
`;

async function main(): Promise<void> {
  const chrome = await findChrome();
  if (!chrome) {
    console.error("Chrome was not found.");
    Deno.exit(2);
  }
  try {
    const r = await fetch(UI, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (error) {
    console.error(`The Workshop is not reachable at ${UI}: ${error}`);
    Deno.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `captures/${stamp}`;
  await Deno.mkdir(outDir, { recursive: true });

  const profileDir = await Deno.makeTempDir({ prefix: "ars-capture-" });
  const port = 9722 + Math.floor(Math.random() * 200);
  const browser = new Deno.Command(chrome, {
    args: [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--window-size=1440,900",
      "about:blank",
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();

  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.log(`  FAIL  ${msg}`);
  };
  const ok = (msg: string) => console.log(`   ok   ${msg}`);

  try {
    let target: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 60 && !target; i++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as Array<
          { type: string; webSocketDebuggerUrl: string }
        >;
        target = pages.find((p) => p.type === "page") ?? null;
      } catch { /* not up */ }
      if (!target) await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("Chrome did not expose a page target.");
    const dt = await Devtools.connect(target.webSocketDebuggerUrl);
    await dt.send("Page.enable");
    await dt.send("Runtime.enable");

    for (const vp of VIEWPORTS) {
      console.log(`\n${vp.key} — ${vp.width}×${vp.height}`);
      const expected = profileFor(vp.width, vp.height);
      await dt.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.key.startsWith("mobile"),
      });
      // Fresh load per profile, and a clean console preference, so the
      // profile's own default is what is captured.
      await dt.send("Page.navigate", { url: UI });
      for (let i = 0; i < 80; i++) {
        const state = await dt.eval<string>("return document.readyState;").catch(() => "");
        if (state === "complete") break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await dt.eval(
        "localStorage.removeItem('ars:console-expanded'); localStorage.removeItem('ars:workspace-layout'); return true;",
      ).catch(() => {});
      await dt.send("Page.reload", {});
      await new Promise((r) => setTimeout(r, 300));
      for (let i = 0; i < 80; i++) {
        const state = await dt.eval<string>("return document.readyState;").catch(() => "");
        if (state === "complete") break;
        await new Promise((r) => setTimeout(r, 100));
      }

      const a = await dt.eval<Audit>(AUDIT(vp.key === "desktop"));
      const p = PROFILES.find((x) => x.key === vp.key)!;

      if (expected.key !== vp.key) fail(`viewport classifies as ${expected.key}`);
      if (a.fsBase >= p.fontMin - 0.01 && a.fsBase <= p.fontMax + 0.01) {
        ok(`base font ${a.fsBase.toFixed(2)}px within ${p.fontMin}–${p.fontMax}px`);
      } else fail(`base font ${a.fsBase}px outside ${p.fontMin}–${p.fontMax}px`);
      if (a.outOfBounds.length === 0) ok("every chrome font within 8–32px");
      else fail(`fonts out of bounds: ${JSON.stringify(a.outOfBounds.slice(0, 5))}`);
      if (a.horizontalOverflow <= 0) ok("no horizontal page overflow");
      else fail(`page overflows horizontally by ${a.horizontalOverflow}px`);
      if (a.consolePresent) ok(`console present, ${a.consoleRows} execution row(s)`);
      else fail("console missing");

      switch (p.layout) {
        case "single-column-drawers":
          if (
            !a.palette.visible && !a.inspector.visible &&
            a.palette.position === "absolute" && a.inspector.position === "absolute"
          ) ok("library and inspector are overlay drawers, shut on first load");
          else fail(`phone drawers wrong: ${JSON.stringify([a.palette, a.inspector])}`);
          break;
        case "canvas-slide-over-inspector":
          if (
            a.inspector.position === "absolute" && !a.inspector.visible &&
            a.palette.position !== "absolute" && a.palette.visible
          ) {
            ok("library docked, inspector slide-over shut on first load");
          } else fail(`tablet layout wrong: ${JSON.stringify([a.palette, a.inspector])}`);
          break;
        case "full-four-panel":
        case "expanded-multi-dock":
          if (
            a.palette.visible && a.inspector.visible && a.palette.position !== "absolute" &&
            a.inspector.position !== "absolute" && a.consolePresent &&
            (p.layout !== "expanded-multi-dock" || a.consoleExpanded)
          ) {
            ok(
              "library, canvas, console and inspector all docked" +
                (p.layout === "expanded-multi-dock" ? " — console held open" : ""),
            );
          } else {fail(
              `four-panel layout wrong: ${
                JSON.stringify([a.palette, a.inspector, a.consoleExpanded])
              }`,
            );}
          break;
      }
      if (a.inspectorTabs) {
        const i = a.inspectorTabs;
        if (i.tabs === 4 && i.visiblePanes === 1) ok("inspector: four tabs, one pane at a time");
        else fail(`inspector tabs wrong: ${JSON.stringify(i)}`);
        if (i.selectedNode === null) ok("inspector redraw check skipped — empty canvas");
        else if (i.inputSurvivesRedraw !== false && i.scrollSurvivesRedraw) {
          ok("inspector keeps its controls and scroll across redraws");
        } else fail(`inspector rebuilt on redraw: ${JSON.stringify(i)}`);
      }
      if (a.grade) {
        const g = a.grade;
        if (!g.project) {
          ok(
            `grade ${g.mounted ? "mounted" : "not mounted"} without a reel — picture check skipped`,
          );
        } else if (g.pictureShare !== null && g.pictureShare >= 0.5) {
          ok(`grade picture holds ${Math.round(g.pictureShare * 100)}% of the pane`);
        } else fail(`grade picture starved: ${JSON.stringify(g)}`);
      }
      if (a.gate) {
        if (a.gate.opened && a.gate.blocked) {
          ok(`run gate opens and holds: ${a.gate.rows.join(", ")}`);
        } else fail(`run gate did not block: ${JSON.stringify(a.gate)}`);
      }

      const shot = await dt.send("Page.captureScreenshot", { format: "png" }) as { data: string };
      const png = Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0));
      await Deno.writeFile(`${outDir}/${vp.key}.png`, png, { createNew: true });

      if (a.gate) {
        await dt.eval(
          "document.querySelector('#run-gate [data-gate=\"cancel\"]')?.click(); return true;",
        );
      }

      const sidecar: CaptureSidecar = {
        timestamp: new Date().toISOString(),
        capture_id: `cap_vlm_${stamp.replace(/-/g, "").slice(0, 14).toLowerCase()}_${
          vp.key.replace(/-/g, "_")
        }`,
        screen_profile: vp.key,
        resolution: { width: vp.width, height: vp.height },
        telemetry: {
          current_fps: Math.round(a.fps * 10) / 10,
          // A browser page cannot read GPU memory; null rather than invented.
          vram_usage_mb: null,
          system_ram_mb: a.heapMb,
          draw_calls: a.cards + a.wires,
        },
        lineage_context: {
          active_node_id: a.activeNode,
          parent_asset_id: null,
          graph_node_depth: null,
          columnar_record_id: null,
        },
        context: {
          active_route: new URL(UI).pathname,
          radial_menu_open: a.wheelOpen,
          bottom_terminal_expanded: a.consoleExpanded,
          theme: "dark_custom",
        },
        evaluation_target: {
          macro_region: "workshop_shell",
          micro_region: a.gate ? "pre_run_gate_dialog" : "panel_layout",
          intent: a.gate
            ? "Verify the pre-run gate lists paths, loops, branches, memory, tokens and cost above a docked four-panel layout."
            : `Verify the ${p.layout} layout and ${p.fontMin}–${p.fontMax}px base typography at ${vp.width}×${vp.height}.`,
        },
      };
      const problems = validateSidecar(sidecar);
      if (problems.length) fail(`sidecar invalid: ${problems.join("; ")}`);
      await Deno.writeTextFile(
        `${outDir}/${vp.key}.json`,
        JSON.stringify(sidecar, null, 2) + "\n",
        {
          createNew: true,
        },
      );
    }
    dt.close();
  } finally {
    try {
      browser.kill("SIGTERM");
    } catch { /* gone */ }
    await browser.status.catch(() => {});
  }

  console.log(
    `\n${
      failures === 0 ? "All profile checks passed." : `${failures} failure(s).`
    } Captures: ${outDir}/`,
  );
  Deno.exit(failures === 0 ? 0 : 1);
}

if (import.meta.main) await main();
