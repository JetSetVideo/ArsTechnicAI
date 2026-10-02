/**
 * shot.ts — evidence, not impressions.
 *
 * Every claim about the interface in this repository has to be backed by a
 * picture taken the same way twice, so that two runs differ only where the
 * software differs. This drives a headless Chrome over the DevTools protocol —
 * no dependency, no npm package, nothing to install — and writes, per run:
 *
 *     shots/<ISO timestamp>/<name>.png     what the page looked like
 *     shots/<ISO timestamp>/<name>.json    what it did while looking like that
 *     shots/<ISO timestamp>/run.json       the whole run, for comparison
 *
 * The sidecar is the half people forget. A screenshot cannot tell you that the
 * page threw during hydration, requested a route that 404'd, or painted before
 * its data arrived; the sidecar records console errors, failed requests, the
 * document title, the element counts a reviewer asked about, and the viewport,
 * so a later run can be compared on facts rather than on eyesight.
 *
 * Usage:
 *
 *     deno run -A tools/shot.ts --base=http://127.0.0.1:3010 --tag=baseline
 *     deno run -A tools/shot.ts --compare shots/<older> shots/<newer>
 *
 * Pages come from `tools/shot_targets.json` so that adding a surface to the
 * evidence set is a data change, not a code change.
 */

const DEFAULT_BASE = Deno.env.get("SHOT_BASE") ?? "http://127.0.0.1:3010";

export interface ShotTarget {
  /** File name, and the key comparisons are made on. */
  readonly name: string;
  /** Path appended to the base URL. */
  readonly path: string;
  readonly width?: number;
  readonly height?: number;
  /** Extra milliseconds to wait after the network goes quiet. */
  readonly settle?: number;
  /**
   * Expression evaluated in the page, returning anything JSON-serialisable.
   * Use it to count what matters — cards, nodes, panels — so a regression is
   * visible as a number and not only as a picture.
   */
  readonly probe?: string;
}

export interface ShotRecord {
  readonly name: string;
  readonly url: string;
  readonly viewport: { width: number; height: number };
  readonly title: string;
  readonly status: number | null;
  readonly ms: number;
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly probe: unknown;
  readonly png: string;
}

// --- the thinnest possible CDP client -------------------------------------

class Chrome {
  #socket: WebSocket;
  #next = 1;
  #pending = new Map<number, (value: Record<string, unknown>) => void>();
  readonly events: ((method: string, params: Record<string, unknown>) => void)[] = [];

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: Record<string, unknown>;
      };
      if (message.id && this.#pending.has(message.id)) {
        this.#pending.get(message.id)!(message.result ?? {});
        this.#pending.delete(message.id);
      } else if (message.method) {
        for (const listener of this.events) listener(message.method, message.params ?? {});
      }
    };
  }

  static async connect(url: string): Promise<Chrome> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("Could not open the DevTools socket."));
    });
    return new Chrome(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = this.#next++;
    return new Promise((resolve) => {
      this.#pending.set(id, resolve);
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluate an expression in the page and return its value. */
  async eval<T>(expression: string): Promise<T | null> {
    const result = await this.send("Runtime.evaluate", {
      expression: `(() => { try { return JSON.stringify((() => { ${expression} })()); } catch (error) { return JSON.stringify({ __error: String(error) }); } })()`,
      returnByValue: true,
      awaitPromise: true,
    }) as { result?: { value?: string } };
    const value = result.result?.value;
    return value ? JSON.parse(value) as T : null;
  }

  close(): void {
    try {
      this.#socket.close();
    } catch {
      // Already gone; the browser process is killed by the caller regardless.
    }
  }
}

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

export async function findChrome(): Promise<string | null> {
  const fromEnv = Deno.env.get("CHROME_PATH");
  if (fromEnv) return fromEnv;
  for (const path of CHROME_PATHS) {
    try {
      const info = await Deno.stat(path);
      if (info.isFile) return path;
    } catch {
      // Not this one.
    }
  }
  return null;
}

// --- taking the pictures ---------------------------------------------------

async function shoot(
  base: string,
  targets: readonly ShotTarget[],
  outDir: string,
): Promise<ShotRecord[]> {
  const chrome = await findChrome();
  if (!chrome) {
    throw new Error(
      "No Chrome found. Set CHROME_PATH, or install Google Chrome / Chromium.",
    );
  }
  const profile = await Deno.makeTempDir({ prefix: "ars-shot-" });
  const port = 9300 + Math.floor(Math.random() * 400);
  const browser = new Deno.Command(chrome, {
    args: [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      // Ubuntu 23.10+ restricts unprivileged user namespaces (AppArmor), so Chromium aborts with
      // "No usable sandbox!" and never offers a page target. This tool only loads the local app.
      ...(Deno.build.os === "linux" ? ["--no-sandbox"] : []),
      "about:blank",
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();

  const records: ShotRecord[] = [];
  try {
    const page = await waitForPage(port);
    const devtools = await Chrome.connect(page);
    await devtools.send("Page.enable");
    await devtools.send("Runtime.enable");
    await devtools.send("Network.enable");
    await devtools.send("Log.enable");

    for (const target of targets) {
      records.push(await captureOne(devtools, base, target, outDir));
    }
    devtools.close();
  } finally {
    try {
      browser.kill();
    } catch {
      // It may already have exited.
    }
    await browser.status;
  }
  return records;
}

async function waitForPage(port: number): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const page = list.find((entry) => entry.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome started but never offered a page target.");
}

async function captureOne(
  devtools: Chrome,
  base: string,
  target: ShotTarget,
  outDir: string,
): Promise<ShotRecord> {
  const width = target.width ?? 1440;
  const height = target.height ?? 900;
  const url = `${base}${target.path}`;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  let status: number | null = null;

  const listener = (method: string, params: Record<string, unknown>) => {
    if (method === "Runtime.consoleAPICalled") {
      const event = params as { type?: string; args?: { value?: unknown; description?: string }[] };
      if (event.type === "error") {
        consoleErrors.push(
          (event.args ?? []).map((a) => String(a.value ?? a.description ?? "")).join(" "),
        );
      }
    } else if (method === "Runtime.exceptionThrown") {
      const event = params as {
        exceptionDetails?: { exception?: { description?: string }; text?: string };
      };
      pageErrors.push(
        event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? "unknown",
      );
    } else if (method === "Network.responseReceived") {
      const event = params as { response?: { status?: number; url?: string }; type?: string };
      const code = event.response?.status ?? 0;
      if (event.type === "Document" && status === null) status = code;
      if (code >= 400) failedRequests.push(`${code} ${event.response?.url ?? ""}`);
    } else if (method === "Network.loadingFailed") {
      const event = params as { errorText?: string; type?: string };
      // A cancelled prefetch is noise, not a failure.
      if (event.errorText && event.errorText !== "net::ERR_ABORTED") {
        failedRequests.push(`${event.errorText} (${event.type ?? "?"})`);
      }
    }
  };
  devtools.events.push(listener);

  const started = Date.now();
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await devtools.send("Page.navigate", { url });
  await settle(devtools, target.settle ?? 1200);

  const title = await devtools.eval<string>("return document.title") ?? "";
  const probe = target.probe ? await devtools.eval<unknown>(target.probe) : null;
  const shot = await devtools.send("Page.captureScreenshot", { format: "png" }) as {
    data?: string;
  };
  const png = `${target.name}.png`;
  if (shot.data) {
    await Deno.writeFile(
      `${outDir}/${png}`,
      Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
    );
  }

  devtools.events.splice(devtools.events.indexOf(listener), 1);

  const record: ShotRecord = {
    name: target.name,
    url,
    viewport: { width, height },
    title,
    status,
    ms: Date.now() - started,
    consoleErrors,
    pageErrors,
    failedRequests,
    probe,
    png,
  };
  await Deno.writeTextFile(
    `${outDir}/${target.name}.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}

/** Wait for the page to stop fetching, then a little longer for paint. */
async function settle(devtools: Chrome, extra: number): Promise<void> {
  const deadline = Date.now() + 15000;
  let quietSince = 0;
  let inFlight = 0;
  const counter = (method: string) => {
    if (method === "Network.requestWillBeSent") {
      inFlight++;
      quietSince = 0;
    }
    if (method === "Network.loadingFinished" || method === "Network.loadingFailed") {
      inFlight = Math.max(0, inFlight - 1);
      if (inFlight === 0) quietSince = Date.now();
    }
  };
  devtools.events.push(counter);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (inFlight === 0 && quietSince > 0 && Date.now() - quietSince > 500) break;
  }
  devtools.events.splice(devtools.events.indexOf(counter), 1);
  await new Promise((resolve) => setTimeout(resolve, extra));
}

// --- comparing two runs ----------------------------------------------------

interface RunFile {
  readonly tag: string;
  readonly base: string;
  readonly takenAt: string;
  readonly records: ShotRecord[];
}

async function compare(olderDir: string, newerDir: string): Promise<number> {
  const older = JSON.parse(await Deno.readTextFile(`${olderDir}/run.json`)) as RunFile;
  const newer = JSON.parse(await Deno.readTextFile(`${newerDir}/run.json`)) as RunFile;
  console.log(`\n${older.tag} (${older.takenAt})  →  ${newer.tag} (${newer.takenAt})\n`);

  let regressions = 0;
  const names = [...new Set([...older.records.map((r) => r.name), ...newer.records.map((r) => r.name)])];
  for (const name of names) {
    const a = older.records.find((r) => r.name === name);
    const b = newer.records.find((r) => r.name === name);
    if (!a) {
      console.log(`  +  ${name}  new surface`);
      continue;
    }
    if (!b) {
      console.log(`  -  ${name}  no longer captured`);
      continue;
    }
    const notes: string[] = [];
    if (a.status !== b.status) notes.push(`status ${a.status} → ${b.status}`);
    if (a.title !== b.title) notes.push(`title "${a.title}" → "${b.title}"`);
    const errorDelta = b.consoleErrors.length + b.pageErrors.length -
      (a.consoleErrors.length + a.pageErrors.length);
    if (errorDelta !== 0) {
      notes.push(
        `${errorDelta > 0 ? "+" : ""}${errorDelta} error(s) → ${
          b.consoleErrors.length + b.pageErrors.length
        }`,
      );
    }
    const failDelta = b.failedRequests.length - a.failedRequests.length;
    if (failDelta !== 0) {
      notes.push(`${failDelta > 0 ? "+" : ""}${failDelta} failed request(s)`);
    }
    const probeDiff = diffProbe(a.probe, b.probe);
    notes.push(...probeDiff);

    const worse = errorDelta > 0 || failDelta > 0 ||
      (a.status !== null && b.status !== null && b.status >= 400 && a.status < 400);
    if (worse) regressions++;
    const mark = worse ? "!!" : notes.length > 0 ? " ~" : " =";
    console.log(`  ${mark} ${name}${notes.length ? "  " + notes.join(" · ") : "  unchanged"}`);
  }
  console.log(
    `\n${regressions === 0 ? "No regressions" : `${regressions} regression(s)`} between these runs.\n`,
  );
  return regressions;
}

function diffProbe(a: unknown, b: unknown): string[] {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return [];
  const out: string[] = [];
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const x = left[key];
    const y = right[key];
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${key} ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
  }
  return out;
}

// --- entry point -----------------------------------------------------------

if (import.meta.main) {
  const args = Deno.args;
  if (args[0] === "--compare") {
    const older = args[1];
    const newer = args[2];
    if (!older || !newer) {
      console.error("usage: deno run -A tools/shot.ts --compare <older-dir> <newer-dir>");
      Deno.exit(2);
    }
    Deno.exit((await compare(older, newer)) > 0 ? 1 : 0);
  }

  const base = (args.find((a) => a.startsWith("--base="))?.split("=")[1]) ?? DEFAULT_BASE;
  const tag = (args.find((a) => a.startsWith("--tag="))?.split("=")[1]) ?? "run";
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  const targetsFile = new URL("./shot_targets.json", import.meta.url);
  const all = JSON.parse(await Deno.readTextFile(targetsFile)) as ShotTarget[];
  const targets = only ? all.filter((t) => t.name === only || t.name.startsWith(only)) : all;
  if (targets.length === 0) {
    console.error(`No target matched "${only}".`);
    Deno.exit(2);
  }

  const takenAt = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `shots/${takenAt}_${tag}`;
  await Deno.mkdir(outDir, { recursive: true });

  console.log(`\nShooting ${targets.length} surface(s) at ${base}\n`);
  const records = await shoot(base, targets, outDir);
  for (const record of records) {
    const problems = record.consoleErrors.length + record.pageErrors.length;
    const mark = record.status !== null && record.status >= 400 ? "!!" : problems > 0 ? " ~" : " ok";
    console.log(
      `  ${mark} ${record.name.padEnd(22)} ${String(record.status ?? "—").padEnd(4)} ${
        String(record.ms + "ms").padEnd(8)
      } ${problems} error(s), ${record.failedRequests.length} failed request(s)`,
    );
  }
  await Deno.writeTextFile(
    `${outDir}/run.json`,
    JSON.stringify({ tag, base, takenAt: new Date().toISOString(), records }, null, 2) + "\n",
  );
  console.log(`\nWritten to ${outDir}\n`);
}
