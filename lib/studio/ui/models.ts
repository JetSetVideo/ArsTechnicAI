/**
 * models.ts — the Models panel: which providers you can call, and on what plan.
 *
 * Before this, "can this graph run?" had an answer nobody could see or change:
 * a provider was usable if an environment variable happened to be set when the
 * host started. Adding fal.ai meant quitting, exporting a variable, and coming
 * back. This is the same information as a surface — a provider, its models,
 * whether a credential exists, where that credential came from, and the
 * subscription the user is actually paying for.
 *
 * What it deliberately does not do: show a key. The host returns four
 * characters and a source (`environment`, `stored`, `none`); the secret is
 * never sent to the page, so this panel cannot leak, log or display one.
 */

export interface ProviderRow {
  id: string;
  name: string;
  locality: "local" | "remote";
  hint: string;
  keyEnv: string | null;
  endpointEnv: string | null;
  configured: boolean;
  source: "environment" | "stored" | "none" | "not-needed";
  tail: string | null;
  updatedAt: number | null;
  plan: { label?: string; capUsd?: number; renewsOn?: string; note?: string } | null;
  models: number;
}

const SOURCE_LABEL: Record<ProviderRow["source"], string> = {
  "environment": "key from the environment",
  "stored": "key stored here",
  "none": "no key",
  "not-needed": "runs locally",
};

export interface ModelManager {
  open(): void;
  close(): void;
  /** Providers as last loaded — the canvas uses this to explain a refusal. */
  rows(): readonly ProviderRow[];
}

export function mountModelManager(options: {
  toast: (message: string, bad?: boolean) => void;
  /** Called after any change, so a cost estimate can re-ask what is reachable. */
  onChange?: () => void;
}): ModelManager {
  let rows: ProviderRow[] = [];
  let open = false;

  const back = document.createElement("div");
  back.className = "models-back";
  back.id = "models-dialog";
  back.hidden = true;
  document.body.append(back);

  const close = () => {
    open = false;
    back.hidden = true;
    back.replaceChildren();
  };

  back.addEventListener("click", (event) => {
    if (event.target === back) close();
  });
  document.addEventListener("keydown", (event) => {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }, true);

  async function load(): Promise<void> {
    try {
      const response = await fetch("/providers");
      const data = await response.json() as { providers: ProviderRow[] };
      rows = data.providers ?? [];
    } catch {
      rows = [];
      options.toast("Could not read the provider list. Is the canvas server running?", true);
    }
  }

  async function post(path: string, body: unknown): Promise<boolean> {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { detail?: string };
      if (!response.ok) throw new Error(data.detail ?? `HTTP ${response.status}`);
      return true;
    } catch (error) {
      options.toast(error instanceof Error ? error.message : String(error), true);
      return false;
    }
  }

  function card(row: ProviderRow): HTMLElement {
    const box = document.createElement("section");
    box.className = `model-card is-${row.source}`;

    const head = document.createElement("div");
    head.className = "model-head";
    const title = document.createElement("b");
    title.textContent = row.name;
    const count = document.createElement("span");
    count.className = "model-count t-secondary";
    count.textContent = `${row.models} model${row.models === 1 ? "" : "s"}`;
    const status = document.createElement("span");
    status.className = "model-status t-secondary";
    status.textContent = SOURCE_LABEL[row.source] + (row.tail ? ` ····${row.tail}` : "");
    head.append(title, count, status);

    const hint = document.createElement("p");
    hint.className = "model-hint t-secondary";
    hint.textContent = row.hint;
    box.append(head, hint);

    if (row.locality === "local") {
      const local = document.createElement("p");
      local.className = "model-hint t-secondary";
      local.textContent = row.endpointEnv
        ? `Free and private. Point it elsewhere with ${row.endpointEnv}.`
        : "Free and private — nothing leaves this machine.";
      box.append(local);
      return box;
    }

    // --- the key -------------------------------------------------------------
    const keyRow = document.createElement("form");
    keyRow.className = "model-row";
    const input = document.createElement("input");
    input.type = "password";
    input.className = "t-secondary";
    input.placeholder = row.configured ? "replace the key" : `paste your ${row.name} key`;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", `${row.name} API key`);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "action t-primary";
    save.textContent = "Save key";
    keyRow.append(input, save);

    if (row.source === "stored") {
      const forget = document.createElement("button");
      forget.type = "button";
      forget.className = "action t-primary";
      forget.textContent = "Forget";
      forget.title = "Remove the stored key from this machine";
      forget.addEventListener("click", async () => {
        if (await post(`/providers/${row.id}/key`, { key: "" })) {
          options.toast(`${row.name} key forgotten.`);
          await refresh();
        }
      });
      keyRow.append(forget);
    }
    keyRow.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (value === "") return;
      if (await post(`/providers/${row.id}/key`, { key: value })) {
        input.value = "";
        options.toast(`${row.name} is configured.`);
        await refresh();
      }
    });
    box.append(keyRow);

    if (row.source === "environment" && row.keyEnv) {
      const note = document.createElement("p");
      note.className = "model-hint t-secondary";
      note.textContent =
        `${row.keyEnv} is set in the environment, and takes precedence over anything stored here.`;
      box.append(note);
    }

    // --- the subscription ----------------------------------------------------
    const plan = document.createElement("form");
    plan.className = "model-plan";
    const label = fieldInput("Plan", "text", row.plan?.label ?? "", "Pro, pay as you go…");
    const cap = fieldInput("Monthly cap (USD)", "number", row.plan?.capUsd?.toString() ?? "", "0");
    const renews = fieldInput("Renews", "date", row.plan?.renewsOn ?? "", "");
    const note = fieldInput("Note", "text", row.plan?.note ?? "", "seat, billing owner, limits…");
    const planSave = document.createElement("button");
    planSave.type = "submit";
    planSave.className = "action t-primary";
    planSave.textContent = "Save plan";
    plan.append(label.wrap, cap.wrap, renews.wrap, note.wrap, planSave);
    plan.addEventListener("submit", async (event) => {
      event.preventDefault();
      const ok = await post(`/providers/${row.id}/plan`, {
        plan: {
          label: label.input.value.trim(),
          capUsd: cap.input.value === "" ? undefined : Number(cap.input.value),
          renewsOn: renews.input.value || undefined,
          note: note.input.value.trim(),
        },
      });
      if (ok) {
        options.toast(`${row.name} plan saved.`);
        await refresh();
      }
    });
    box.append(plan);

    if (row.plan?.capUsd) {
      const capNote = document.createElement("p");
      capNote.className = "model-hint t-secondary";
      capNote.textContent =
        `The run dialog prices every paid call before it happens; this cap is the number to read it against.`;
      box.append(capNote);
    }
    return box;
  }

  function fieldInput(
    labelText: string,
    type: string,
    value: string,
    placeholder: string,
  ): { wrap: HTMLElement; input: HTMLInputElement } {
    const wrap = document.createElement("label");
    wrap.className = "model-field";
    const span = document.createElement("span");
    span.className = "t-secondary";
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.className = "t-secondary";
    input.value = value;
    input.placeholder = placeholder;
    if (type === "number") {
      input.min = "0";
      input.step = "1";
    }
    wrap.append(span, input);
    return { wrap, input };
  }

  function paint(): void {
    const panel = document.createElement("div");
    panel.className = "models-panel t-primary";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Models and keys");

    const head = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "Models & keys";
    const shut = document.createElement("button");
    shut.type = "button";
    shut.className = "action t-primary";
    shut.textContent = "Close";
    shut.addEventListener("click", close);
    head.append(title, shut);

    const intro = document.createElement("p");
    intro.className = "model-hint t-secondary";
    intro.textContent =
      "Keys are stored on this machine only, in the workspace, readable by you alone — never sent " +
      "to the page, never included in a saved project. An environment variable always wins over a " +
      "key stored here.";

    panel.append(head, intro);
    const remote = rows.filter((r) => r.locality === "remote");
    const local = rows.filter((r) => r.locality === "local");
    for (const row of [...remote, ...local]) panel.append(card(row));

    const configured = rows.filter((r) => r.configured).length;
    const foot = document.createElement("p");
    foot.className = "model-hint t-secondary";
    foot.textContent = `${configured} of ${rows.length} providers reachable · ` +
      `${rows.reduce((n, r) => n + r.models, 0)} models in the catalogue`;
    panel.append(foot);

    back.replaceChildren(panel);
  }

  async function refresh(): Promise<void> {
    await load();
    if (open) paint();
    options.onChange?.();
  }

  return {
    open() {
      open = true;
      back.hidden = false;
      paint();
      void refresh();
    },
    close,
    rows: () => rows,
  };
}
