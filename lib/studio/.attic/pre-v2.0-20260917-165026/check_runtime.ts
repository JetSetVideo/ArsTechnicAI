/**
 * check_runtime.ts — load the real UI in Chrome and drive it.
 *
 * The unit suite proves the primitives. This proves the *page*: that the
 * bundle parses, the module graph resolves in a browser, every id the scripts
 * reach for exists in the HTML, the engine proxy answers, and a wire can
 * actually be dragged from one socket to another.
 *
 * That is the class of bug type-checking cannot see — a null dereference
 * inside an event handler, a selector that no longer matches, a route that
 * 404s only once a panel is opened. ArchiveRestorer has the same check for the
 * same reason; this is its twin.
 *
 * Usage:
 *   deno run -A check_runtime.ts              # against a already-running server
 *   WIV_UI=http://localhost:8090 deno run -A check_runtime.ts
 *
 * Requires Chrome. Exits non-zero on the first failure.
 */

const UI = Deno.env.get("WIV_UI") ?? "http://127.0.0.1:8090/blueprint";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function record(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
  const mark = ok ? "  ok  " : " FAIL ";
  console.log(`${mark} ${name}${detail ? `\n       ${detail}` : ""}`);
}

async function findChrome(): Promise<string | null> {
  for (const path of CHROME_CANDIDATES) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) return path;
    } catch {
      // try the next one
    }
  }
  return null;
}

/**
 * A minimal CDP client.
 *
 * Hand-rolled rather than pulled from a package: the whole need is "open a
 * page, evaluate some JavaScript, read the result", and a browser-automation
 * dependency would be larger than the application it is checking.
 */
class Devtools {
  #socket: WebSocket;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      if (message.id === undefined) return;
      const waiter = this.#pending.get(message.id);
      if (!waiter) return;
      this.#pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    };
  }

  static async connect(url: string): Promise<Devtools> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("Could not open a DevTools socket."));
    });
    // Replace the connect-time rejector. Killing Chrome drops this socket, and
    // an unhandled `error` event on it is fatal in Deno — which made a run
    // where every check passed still exit non-zero. A teardown error is not a
    // result, so it is swallowed rather than reported.
    socket.onerror = () => {};
    socket.onclose = () => {};
    return new Devtools(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.#nextId++;
    const pending = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.#pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 60_000);
    });

    // Mark the promise handled without consuming it.
    //
    // Chrome answers some requests only as the page context is torn down —
    // "Execution context was destroyed" arrives after the last check has
    // already been recorded. In Deno an unhandled rejection is fatal, so a run
    // where all 13 checks passed still exited non-zero. Attaching a handler
    // here settles that; the promise this returns still rejects normally for
    // anything actually awaiting it.
    pending.catch(() => {});
    return pending;
  }

  /**
   * Evaluate an expression in the page and return its value.
   *
   * `awaitPromise` is set so a driving script can use `await` at the top
   * level, which every check below needs — the app is asynchronous end to end.
   */
  async eval<T>(expression: string): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    }) as {
      result?: { value?: T };
      exceptionDetails?: { exception?: { description?: string }; text?: string };
    };
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ?? "page threw",
      );
    }
    return result.result?.value as T;
  }

  close(): void {
    this.#socket.onmessage = null;
    this.#socket.onerror = () => {};
    this.#socket.onclose = () => {};
    try {
      this.#socket.close();
    } catch {
      // already closing
    }
    // Anything still waiting will never be answered; fail it here rather than
    // leaving a promise pending for the process to hang on.
    for (const [, waiter] of this.#pending) {
      waiter.reject(new Error("DevTools socket closed"));
    }
    this.#pending.clear();
  }
}

/**
 * The driving script, run inside the page.
 *
 * `__wiv.redraw()` is called between steps because Chrome does not fire
 * `requestAnimationFrame` in a headless or backgrounded tab, so the canvas
 * would never paint and every DOM assertion below would fail for a reason that
 * has nothing to do with the application.
 */
const DRIVE = `
const pause = (ms) => new Promise(r => setTimeout(r, ms));

// Poll for the app rather than assuming it has run.
//
// A page target appears in /json/list as soon as the tab exists, which is
// before the document has loaded and well before an ES module has executed. A
// bare check here passes on a warm Chrome and fails on a cold one, which is
// the worst kind of check: green locally, red in CI, for a reason that has
// nothing to do with the code.
let W = null;
for (let i = 0; i < 80; i++) {
  W = window.__wiv;
  if (W) break;
  await pause(100);
}
if (!W) return { fatal: "window.__wiv never appeared — the bundle did not run." };
const step = async () => { W.redraw(); await pause(30); };
const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; };
const ev = (p, x) => new PointerEvent(x.type, { bubbles: true, cancelable: true, pointerId: 1,
  pointerType: 'mouse', clientX: p.x, clientY: p.y, buttons: x.buttons ?? 1, ...x });
const cardOf = (t) => [...document.querySelectorAll('.card')].find(c => W.graph.nodes[c.dataset.node]?.type === t);
const dotOf = (t, p, d) => cardOf(t)?.querySelector('.port-dot[data-port="' + p + '"][data-dir="' + d + '"]');
const stage = document.getElementById('stage');

await pause(600);
await step();

const out = {};
out.ids = ['topbar','palette','stage','world','cards','stacks','wires','inspector',
           'diagnostics','carousel','carousel-strip','toast','empty-hint','wire-hint',
           'project-picker','project-name','project-caret','btn-run','btn-fit','btn-settings']
  .filter(id => !document.getElementById(id));
out.seededNodes = Object.keys(W.graph.nodes).length;
out.seededEdges = Object.keys(W.graph.edges).length;
out.cardsDrawn = document.querySelectorAll('.card').length;
out.paletteItems = document.querySelectorAll('.pal-item').length;
out.compileRunnable = W.compiled?.runnable ?? false;
out.compileErrors = (W.compiled?.diagnostics ?? []).filter(d => d.severity === 'error').length;
out.engineStatus = document.getElementById('engine-status').textContent;
out.projectBound = W.graph.projectId;

// Every port with a range must have drawn a socket somewhere.
out.socketsDrawn = document.querySelectorAll('.port-dot').length;

// A wire that must be refused: an output back into an upstream input.
const from = dotOf('stage.clahe', 'image', 'output');
const to = dotOf('stage.stabilize', 'image', 'input');
if (from && to) {
  const edgesBefore = Object.keys(W.graph.edges).length;
  const a = centre(from), b = centre(to);
  from.dispatchEvent(ev(a, { type: 'pointerdown' }));
  stage.dispatchEvent(ev({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 }, { type: 'pointermove' }));
  to.dispatchEvent(ev(b, { type: 'pointermove' }));
  to.dispatchEvent(ev(b, { type: 'pointerup', buttons: 0 }));
  await step();
  out.refusalShown = !document.getElementById('toast').hidden;
  out.refusalText = document.getElementById('toast').textContent;
  out.edgesUnchanged = Object.keys(W.graph.edges).length === edgesBefore;
} else {
  out.refusalShown = false;
  out.refusalText = 'sockets not found';
  out.edgesUnchanged = false;
}

// The three-state filter must dim without moving anything.
const f = document.getElementById('filter-input');
if (f) {
  const before = [...document.querySelectorAll('.card')].map(c => c.style.left).join(',');
  f.value = 'clahe'; f.dispatchEvent(new Event('input', { bubbles: true }));
  await step();
  out.filterIn = document.querySelectorAll('.card.f-in').length;
  out.filterOut = document.querySelectorAll('.card.f-out').length;
  out.layoutStable = [...document.querySelectorAll('.card')].map(c => c.style.left).join(',') === before;
  f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true }));
  await step();
} else {
  out.filterIn = 0;
  out.filterOut = 0;
  out.layoutStable = true;
}

// --- merged from the GitHub version: marquee, run, card options, library ---

// Left-drag on empty canvas must rectangle-select. Right-click still opens
// the node wheel — the two gestures no longer share a button.
const canvasStage = document.getElementById('stage');
const boxes = [...document.querySelectorAll('.card')].map(c => c.getBoundingClientRect());
const left = Math.min(...boxes.map(b => b.left)) - 8;
const top = Math.min(...boxes.map(b => b.top)) - 8;
const right = Math.max(...boxes.map(b => b.right)) + 8;
const bottom = Math.max(...boxes.map(b => b.bottom)) + 8;
const lmb = (type, x, y) => canvasStage.dispatchEvent(new PointerEvent(type, {
  bubbles: true, cancelable: true, clientX: x, clientY: y,
  button: 0, buttons: 1, pointerId: 909, pointerType: 'mouse', isPrimary: true,
}));
lmb('pointerdown', left, top);
lmb('pointermove', (left + right) / 2, (top + bottom) / 2);
out.marqueeVisible = !document.getElementById('marquee').hidden;
lmb('pointermove', right, bottom);
lmb('pointerup', right, bottom);
await step();
out.marqueeSelected = document.querySelectorAll('.card.selected').length;
out.wheelStayedShut = document.getElementById('node-wheel').hidden;

// Every card carries its own options control, and it opens a real panel.
out.cardOptions = document.querySelectorAll('.card-opts').length;
const firstOpts = document.querySelector('.card-opts');
if (firstOpts) {
  const r = firstOpts.getBoundingClientRect();
  firstOpts.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    button: 0, buttons: 1, pointerId: 910, pointerType: 'mouse', isPrimary: true,
  }));
  await step();
  const menu = document.getElementById('card-menu');
  out.menuOpened = !menu.hidden;
  out.menuSections = [...menu.querySelectorAll('.cm-section > h4')].map(h => h.textContent.trim());
  out.menuActions = [...menu.querySelectorAll('.cm-actions button')].map(b => b.textContent.trim());
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await step();
  out.menuClosed = menu.hidden;
}

// Run must exist and name the selection-scoped act, distinct from Preview.
out.hasRunButton = Boolean(document.getElementById('btn-run'));
out.runDistinctFromPreview = out.hasRunButton && !document.getElementById('btn-preview') && Boolean(document.getElementById('btn-fit'));

// The library has four tabs, and Files/Refs/Flows reach this server's own routes.
out.libTabs = [...document.querySelectorAll('.lib-tab')].map(t => t.dataset.lib);
try {
  const fs = await fetch('/fs/list?path=').then(r => r.json());
  out.fsEntries = Array.isArray(fs.entries) ? fs.entries.length : -1;
  out.fsJailed = typeof fs.root === 'string' && fs.root.length > 1;
} catch { out.fsEntries = -1; out.fsJailed = false; }
try {
  const esc = await fetch('/fs/list?path=' + encodeURIComponent('../../../../etc'));
  out.fsRefusesEscape = esc.status === 403 || esc.status === 404;
} catch { out.fsRefusesEscape = false; }
try {
  const flows = await fetch('/flows').then(r => r.json());
  out.flowsReachable = Array.isArray(flows.flows);
} catch { out.flowsReachable = false; }

// --- the reference library -------------------------------------------------
//
// The Refs shelf is the newest surface and the one with the most ways to look
// fine while doing nothing: a tab that switches but never fetches, a card that
// renders but drops no node, a thumbnail path that 404s into a broken image.
// Each of those is checked here because none of them is a type error.
try {
  const refsTab = document.querySelector('.lib-tab[data-lib="refs"]');
  refsTab.click();
  await pause(900);

  const cards = [...document.querySelectorAll('.ref-card')];
  out.refsRendered = cards.length;

  // Every shelf must have cards. An empty category is a tab that opens on
  // nothing, which reads as a broken build rather than as an absence.
  const shelfCounts = {};
  for (const kind of ['movie', 'star', 'comic', 'script']) {
    // Concatenation, not a template literal: this whole probe lives inside one,
    // and a nested backtick would close it.
    document.querySelector('.ref-kind[data-kind="' + kind + '"]').click();
    await pause(120);
    shelfCounts[kind] = document.querySelectorAll('.ref-card').length;
  }
  out.shelfCounts = shelfCounts;
  out.everyShelfHasCards = Object.values(shelfCounts).every((n) => n > 0);

  // A card must survive being sized: the grid's implicit rows once divided the
  // panel height between 55 rows and clipped every thumbnail to 6px.
  document.querySelector('.ref-kind[data-kind="movie"]').click();
  await pause(150);
  const first = document.querySelector('.ref-card');
  const rect = first.getBoundingClientRect();
  out.refCardHeight = Math.round(rect.height);
  out.refCardIsLegible = rect.height > 60 &&
    first.querySelector('.ref-name').getBoundingClientRect().height > 8;

  // The thumbnail must actually be there. A card pointing at a missing frame
  // renders a broken image, which reads as a bug rather than as an absence.
  const thumb = first.querySelector('img.ref-thumb');
  out.refThumbLoads = !!thumb && thumb.complete && thumb.naturalWidth > 0;

  // Clicking a card must put a ref.card node on the canvas with its id
  // already filled in. A node that arrives blank is a worse palette.
  const before = Object.keys(__wiv.graph.nodes).length;
  first.click();
  await pause(400);
  const added = Object.values(__wiv.graph.nodes).filter((n) => n.type === 'ref.card');
  out.refDropsNode = Object.keys(__wiv.graph.nodes).length === before + 1;
  out.refNodeCarriesId = added.some((n) => (n.values?.reference_id?.value ?? '') !== '');
} catch (error) {
  out.refsRendered = 0;
  out.everyShelfHasCards = false;
  out.refCardIsLegible = false;
  out.refThumbLoads = false;
  out.refDropsNode = false;
  out.refNodeCarriesId = false;
  out.refsError = String(error).slice(0, 120);
}

// --- the consent gate ------------------------------------------------------
//
// The one check that is about money. A 240-slice run through a paid model must
// come back refused, with the count and the cost in the refusal — a gate that
// approves by default is worse than no gate, because it looks like one.
try {
  const response = await fetch('/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      graphDigest: 'runtime-check',
      calls: [{ modelId: 'fal:flux-pro/v1.1', nodeId: 'n1', count: 240 }],
    }),
  });
  const body = await response.json();
  out.consentRefusesUnapproved = body.verdict?.ok === false;
  out.consentNamesTheCount = String(body.summary ?? '').includes('240');
  out.consentSummary = String(body.summary ?? '').slice(0, 60);

  // And a local model must NOT be gated, or the free path grows a dialog.
  const free = await fetch('/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      graphDigest: 'runtime-check',
      calls: [{ modelId: 'comfy:flux-dev', nodeId: 'n1', count: 240 }],
    }),
  });
  out.localRunsUngated = (await free.json()).verdict?.ok === true;
} catch (error) {
  out.consentRefusesUnapproved = false;
  out.consentNamesTheCount = false;
  out.localRunsUngated = false;
  out.consentSummary = String(error).slice(0, 60);
}

// The generation node types must be in the registry the page is running, or
// a reference has nothing to feed.
out.generationTypesPresent = ['ref.card', 'ref.blend', 'ref.prompt', 'gen.image', 'gen.video', 'llm.ask']
  .filter((id) => __wiv.registry.get(id) !== null).length;

// A media row must be draggable onto the canvas, and opening a reel must
// reach the engine's own ingest route rather than a message nobody handles.
try {
  const bad = await fetch('/api/video/load', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '/nonexistent/ars-runtime-check.mov', start: 0, end: null, step: 1, analyze: true }),
  });
  const body = await bad.json().catch(() => ({}));
  out.ingestRouteAnswers = bad.status === 404 && typeof body.detail === 'string';
  out.ingestReason = String(body.detail ?? '').slice(0, 60);
} catch { out.ingestRouteAnswers = false; out.ingestReason = 'unreachable'; }

// Wiring by drag must actually connect. Pointer capture retargets every
// event to #stage, so a hit-test on event.target silently connects nothing.
const outDot = document.querySelector('.port-dot[data-dir="output"]');
out.wireHitTestUsesPoint = false;
if (outDot) {
  const r = outDot.getBoundingClientRect();
  out.wireHitTestUsesPoint =
    document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      ?.closest('.port-dot') === outDot;
}

return out;
`;

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nWIV runtime check — ${UI}\n${"-".repeat(72)}`);

  // The server has to be up before Chrome is worth starting.
  try {
    const response = await fetch(UI, { signal: AbortSignal.timeout(4000) });
    record("canvas is served", response.ok, `HTTP ${response.status}`);
    if (!response.ok) Deno.exit(1);
  } catch (error) {
    record("canvas is served", false, `${error instanceof Error ? error.message : error}`);
    console.error(`\nStart it first:  cd ${Deno.cwd()} && ./start.sh\n`);
    Deno.exit(1);
  }

  const chrome = await findChrome();
  if (!chrome) {
    console.error("\nChrome was not found. This check needs it; the unit suite does not.\n");
    Deno.exit(2);
  }

  const profile = await Deno.makeTempDir({ prefix: "wiv-check-" });
  const port = 9222 + Math.floor(Math.random() * 500);
  const browser = new Deno.Command(chrome, {
    args: [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--window-size=1600,1000",
      UI,
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();

  try {
    // Wait for the debugging endpoint rather than sleeping a fixed amount:
    // a cold Chrome start is far slower than a warm one.
    let target: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 60; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`, {
          signal: AbortSignal.timeout(1000),
        });
        const pages = await list.json() as Array<
          { type: string; url: string; webSocketDebuggerUrl: string }
        >;
        target = pages.find((p) => p.type === "page" && p.url.startsWith(UI)) ?? null;
        if (target) break;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) {
      record("chrome attaches to the page", false, "no page target appeared");
      Deno.exit(1);
    }
    record("chrome attaches to the page", true);

    const devtools = await Devtools.connect(target.webSocketDebuggerUrl);
    await devtools.send("Runtime.enable");
    await devtools.send("Page.enable");

    // Wait for the document to finish loading before evaluating anything.
    //
    // A page target appears in /json/list while it is still navigating, and
    // completing that navigation *destroys the execution context* an in-flight
    // `Runtime.evaluate` is running in — which surfaced as
    // "Execution context was destroyed" killing the run at check 3. Polling
    // `document.readyState` is enough and needs no event plumbing.
    for (let i = 0; i < 80; i++) {
      const state = await devtools
        .eval<string>("return document.readyState;")
        .catch(() => "");
      if (state === "complete") break;
      await new Promise((r) => setTimeout(r, 100));
    }

    type Driven = {
      fatal?: string;
      ids: string[];
      seededNodes: number;
      seededEdges: number;
      cardsDrawn: number;
      paletteItems: number;
      compileRunnable: boolean;
      compileErrors: number;
      engineStatus: string;
      projectBound: string | null;
      socketsDrawn: number;
      refusalShown: boolean;
      refusalText: string;
      edgesUnchanged: boolean;
      filterIn: number;
      filterOut: number;
      layoutStable: boolean;
      marqueeVisible: boolean;
      marqueeSelected: number;
      wheelStayedShut: boolean;
      cardOptions: number;
      menuOpened: boolean;
      menuSections: string[];
      menuActions: string[];
      menuClosed: boolean;
      hasRunButton: boolean;
      runDistinctFromPreview: boolean;
      libTabs: string[];
      fsEntries: number;
      fsJailed: boolean;
      fsRefusesEscape: boolean;
      flowsReachable: boolean;
      refsRendered: number;
      shelfCounts: Record<string, number>;
      everyShelfHasCards: boolean;
      refCardHeight: number;
      refCardIsLegible: boolean;
      refThumbLoads: boolean;
      refDropsNode: boolean;
      refNodeCarriesId: boolean;
      refsError?: string;
      consentRefusesUnapproved: boolean;
      consentNamesTheCount: boolean;
      consentSummary: string;
      localRunsUngated: boolean;
      generationTypesPresent: number;
      ingestRouteAnswers: boolean;
      ingestReason: string;
      wireHitTestUsesPoint: boolean;
    };

    // Retry once on a destroyed context: a late redirect or an extension
    // injecting itself can still pull the rug, and one retry against the new
    // context is cheaper than a flaky check nobody trusts.
    let result: Driven | null = null;
    let failure = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await devtools.eval<Driven>(DRIVE);
        break;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        if (!failure.includes("context was destroyed")) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    devtools.close();

    if (!result) {
      record("the page can be driven", false, failure);
      console.log("=".repeat(72));
      console.log(`${checks.filter((c) => c.ok).length} passed, 1 failed`);
      Deno.exit(1);
    }

    if (result?.fatal) {
      record("the bundle runs", false, result.fatal);
      Deno.exit(1);
    }
    record("the bundle runs", true);

    record(
      "every id the scripts use exists in the page",
      result.ids.length === 0,
      result.ids.length ? `missing: ${result.ids.join(", ")}` : "",
    );
    record(
      "the starter graph is seeded",
      result.seededNodes >= 6 && result.seededEdges >= 6,
      `${result.seededNodes} nodes, ${result.seededEdges} edges`,
    );
    record(
      "cards are drawn for every node",
      result.cardsDrawn === result.seededNodes,
      `${result.cardsDrawn} cards for ${result.seededNodes} nodes`,
    );
    record(
      "the palette is populated",
      result.paletteItems >= 20,
      `${result.paletteItems} node types`,
    );
    record("sockets are drawn", result.socketsDrawn > 0, `${result.socketsDrawn} ports`);
    record(
      "the seeded graph compiles",
      result.compileRunnable && result.compileErrors === 0,
      `${result.compileErrors} error(s)`,
    );
    record(
      "the engine is reachable through the proxy",
      result.engineStatus.includes("ok"),
      result.engineStatus,
    );
    record(
      "a project is bound",
      Boolean(result.projectBound),
      String(result.projectBound ?? "none"),
    );
    record(
      "an illegal wire is refused, with a reason",
      result.refusalShown && result.edgesUnchanged,
      result.refusalText,
    );
    record(
      "the filter dims without moving the layout",
      result.filterIn > 0 && result.filterOut > 0 && result.layoutStable,
      `${result.filterIn} in, ${result.filterOut} out, layout stable: ${result.layoutStable}`,
    );
    record(
      "left-drag rectangle-selects",
      result.marqueeVisible && result.marqueeSelected > 1,
      `${result.marqueeSelected} card(s) caught`,
    );
    record(
      "a left-drag does not also open the node wheel",
      result.wheelStayedShut,
      result.wheelStayedShut ? "wheel stayed shut" : "wheel opened over the selection",
    );
    record(
      "every card carries an options control",
      result.cardOptions > 0,
      `${result.cardOptions} control(s)`,
    );
    record(
      "the card menu opens with versions, lineage and info",
      result.menuOpened && result.menuSections.length >= 3 && result.menuClosed,
      `${result.menuSections.join(", ")} · ${result.menuActions.join(" ")}`,
    );
    record(
      "Run sits next to Fit; This frame is gone",
      result.runDistinctFromPreview,
      result.hasRunButton ? "Run + Fit" : "no Run button",
    );
    record(
      "the library offers Nodes, Files, Refs and Flows",
      result.libTabs.join(",") === "nodes,files,refs,flows",
      result.libTabs.join(", ") || "no tabs",
    );
    record(
      "the file browser lists a jailed root",
      result.fsEntries > 0 && result.fsJailed,
      `${result.fsEntries} entries`,
    );
    record(
      "the file browser refuses to escape its root",
      result.fsRefusesEscape,
      result.fsRefusesEscape ? "../ refused" : "TRAVERSAL ACCEPTED",
    );
    record(
      "saved workflows are reachable",
      result.flowsReachable,
      result.flowsReachable ? "/flows answers" : "/flows unreachable",
    );
    record(
      "opening a reel reaches the engine's ingest route",
      result.ingestRouteAnswers,
      result.ingestReason || "no reason returned",
    );
    record(
      "the reference library loads onto the shelves",
      result.refsRendered > 0,
      result.refsError ?? `${result.refsRendered} cards on the movie shelf`,
    );
    record(
      "every shelf has cards",
      result.everyShelfHasCards,
      JSON.stringify(result.shelfCounts ?? {}),
    );
    record(
      "a reference card is legible rather than collapsed",
      result.refCardIsLegible,
      `card is ${result.refCardHeight}px tall`,
    );
    record(
      "a reference card's frame actually loads",
      result.refThumbLoads,
      result.refThumbLoads ? "thumbnail decoded" : "BROKEN IMAGE",
    );
    record(
      "clicking a reference puts a node on the canvas",
      result.refDropsNode && result.refNodeCarriesId,
      result.refNodeCarriesId
        ? "ref.card arrives with its id set"
        : "node arrived blank, so the user must type an identifier",
    );
    record(
      "the generation node types are registered",
      result.generationTypesPresent === 6,
      `${result.generationTypesPresent}/6 present`,
    );
    record(
      "a paid run is refused until it is confirmed",
      result.consentRefusesUnapproved && result.consentNamesTheCount,
      result.consentSummary,
    );
    record(
      "a local run is not gated",
      result.localRunsUngated,
      result.localRunsUngated ? "free path stays frictionless" : "LOCAL RUN GATED",
    );
    record(
      "a socket is findable by point, not by event target",
      result.wireHitTestUsesPoint,
      result.wireHitTestUsesPoint
        ? "elementFromPoint resolves the socket"
        : "wire drops would connect nothing",
    );
  } finally {
    try {
      browser.kill();
      await browser.status;
    } catch {
      // already gone
    }
    await Deno.remove(profile, { recursive: true }).catch(() => {});
  }

  const failed = checks.filter((c) => !c.ok);
  console.log("=".repeat(72));
  console.log(`${checks.length - failed.length} passed, ${failed.length} failed`);
  for (const f of failed) console.log(`  - ${f.name}`);
  console.log();
  if (failed.length > 0) Deno.exit(1);
}

if (import.meta.main) await main();
