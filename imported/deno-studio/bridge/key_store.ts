/**
 * key_store.ts — provider credentials and subscription notes, on this machine.
 *
 * The catalogue in `core/providers.ts` knows what a model costs; it has never
 * known whether you can call it. That answer lived entirely in environment
 * variables, which means adding a provider meant restarting the app with a new
 * `export`. This is the other half: a key you can paste, and the plan you are
 * paying for, stored beside the workspace.
 *
 * ## What this file is careful about
 *
 * A credential store is a liability, so the rules are narrow and stated here
 * rather than assumed:
 *
 *   - **The key never travels back.** Reads return whether a key exists and its
 *     last four characters, never the secret. Nothing in the UI can display it,
 *     because nothing in the UI is ever sent it.
 *   - **The file is the user's alone**: written `0600`, inside the workspace
 *     this host already owns, never into the repository.
 *   - **The environment still wins.** A `FAL_KEY` in the environment overrides
 *     a stored one, so a deployment's own secrets management is never silently
 *     replaced by a file someone pasted into.
 *   - **Forgetting is complete.** Clearing a key rewrites the file without it;
 *     no history of secrets is kept, because a store that remembers revoked
 *     credentials is a store that leaks them later.
 *   - **Nothing here reads a key back into a response, a log or a message.**
 *     `resolveKey` exists for the one caller that will need it — the provider
 *     client that makes the HTTP request — and is deliberately the only way out.
 */

import { provider, PROVIDERS } from "../core/providers.ts";

export interface PlanNote {
  /** What the user calls this subscription: "Pro", "pay as you go". */
  readonly label?: string;
  /** Monthly ceiling in US dollars, for the reminder the gate can show. */
  readonly capUsd?: number;
  /** ISO date the allowance renews, if it does. */
  readonly renewsOn?: string;
  readonly note?: string;
}

interface StoredProvider {
  key?: string;
  updatedAt?: number;
  plan?: PlanNote;
}

interface StoreFile {
  readonly version: 1;
  readonly providers: Record<string, StoredProvider>;
}

/** What a caller outside this module may know about a provider. */
export interface ProviderStatus {
  readonly id: string;
  readonly name: string;
  readonly locality: "local" | "remote";
  readonly hint: string;
  /** Environment variable this provider reads, when it takes a key. */
  readonly keyEnv: string | null;
  readonly endpointEnv: string | null;
  /** Can this provider be called at all? */
  readonly configured: boolean;
  /** Where the credential comes from. `local` providers need none. */
  readonly source: "environment" | "stored" | "none" | "not-needed";
  /** Last four characters of the stored key — never the key. */
  readonly tail: string | null;
  readonly updatedAt: number | null;
  readonly plan: PlanNote | null;
  readonly models: number;
}

const EMPTY: StoreFile = { version: 1, providers: {} };

function fileFor(root: string): string {
  return `${root}/.provider-keys.json`;
}

async function read(root: string): Promise<StoreFile> {
  try {
    const parsed = JSON.parse(await Deno.readTextFile(fileFor(root))) as StoreFile;
    if (parsed && typeof parsed === "object" && parsed.providers) return parsed;
  } catch {
    // No store yet, or an unreadable one: an empty store is the safe answer.
    // A corrupt file is never "fixed" by guessing at its contents.
  }
  return EMPTY;
}

async function write(root: string, file: StoreFile): Promise<void> {
  await Deno.mkdir(root, { recursive: true });
  const path = fileFor(root);
  await Deno.writeTextFile(path, JSON.stringify(file, null, 2) + "\n");
  try {
    await Deno.chmod(path, 0o600);
  } catch {
    // chmod is unavailable on some filesystems; the file is still ours.
  }
}

const tailOf = (key: string): string | null => key.length >= 4 ? key.slice(-4) : null;

/** Every provider, with whether it can be called and where that comes from. */
export async function providerStatuses(
  root: string,
  env: (name: string) => string | undefined = (n) => Deno.env.get(n),
  modelCount: (id: string) => number = () => 0,
): Promise<ProviderStatus[]> {
  const store = await read(root);
  return PROVIDERS.map((spec) => {
    const stored = store.providers[spec.id] ?? {};
    const fromEnv = spec.keyEnv ? (env(spec.keyEnv) ?? "") : "";
    const hasStored = Boolean(stored.key);
    const source: ProviderStatus["source"] = spec.locality === "local"
      ? "not-needed"
      : fromEnv
      ? "environment"
      : hasStored
      ? "stored"
      : "none";
    return {
      id: spec.id,
      name: spec.name,
      locality: spec.locality,
      hint: spec.hint,
      keyEnv: spec.keyEnv ?? null,
      endpointEnv: spec.endpointEnv ?? null,
      configured: source === "not-needed" || source === "environment" || source === "stored",
      source,
      tail: hasStored ? tailOf(stored.key!) : null,
      updatedAt: stored.updatedAt ?? null,
      plan: stored.plan ?? null,
      models: modelCount(spec.id),
    };
  });
}

export type StoreResult =
  | { readonly ok: true; readonly status: ProviderStatus }
  | { readonly ok: false; readonly status: number; readonly reason: string };

/** Store (or, with an empty string, forget) one provider's key. */
export async function setKey(root: string, id: string, key: string): Promise<StoreResult> {
  const spec = provider(id);
  if (!spec) return { ok: false, status: 404, reason: `No provider "${id}" in the catalogue.` };
  if (spec.locality === "local") {
    return {
      ok: false,
      status: 400,
      reason: `${spec.name} runs on this machine and takes no key. Point it somewhere else with ` +
        `${spec.endpointEnv ?? "its endpoint variable"}.`,
    };
  }
  const trimmed = key.trim();
  if (trimmed.length > 0 && trimmed.length < 8) {
    return { ok: false, status: 400, reason: "That does not look like an API key." };
  }

  const file = await read(root);
  const providers = { ...file.providers };
  const existing = providers[id] ?? {};
  if (trimmed === "") {
    // Forgetting drops the secret and keeps the plan note, which is not one.
    const { key: _dropped, ...rest } = existing;
    providers[id] = { ...rest, updatedAt: Date.now() };
  } else {
    providers[id] = { ...existing, key: trimmed, updatedAt: Date.now() };
  }
  await write(root, { version: 1, providers });
  const statuses = await providerStatuses(root);
  return { ok: true, status: statuses.find((s) => s.id === id)! };
}

/** Record what the user is paying for. Never a credential. */
export async function setPlan(root: string, id: string, plan: PlanNote): Promise<StoreResult> {
  const spec = provider(id);
  if (!spec) return { ok: false, status: 404, reason: `No provider "${id}" in the catalogue.` };
  const clean: PlanNote = {
    ...(plan.label ? { label: String(plan.label).slice(0, 60) } : {}),
    ...(typeof plan.capUsd === "number" && Number.isFinite(plan.capUsd) && plan.capUsd >= 0
      ? { capUsd: Math.round(plan.capUsd * 100) / 100 }
      : {}),
    ...(plan.renewsOn && /^\d{4}-\d{2}-\d{2}$/.test(plan.renewsOn)
      ? { renewsOn: plan.renewsOn }
      : {}),
    ...(plan.note ? { note: String(plan.note).slice(0, 400) } : {}),
  };
  const file = await read(root);
  const providers = { ...file.providers };
  providers[id] = { ...(providers[id] ?? {}), plan: clean };
  await write(root, { version: 1, providers });
  const statuses = await providerStatuses(root);
  return { ok: true, status: statuses.find((s) => s.id === id)! };
}

/**
 * The key a provider client should use, or null.
 *
 * The environment wins over the store, deliberately: a machine configured by
 * its operator must not be overridden by a file. This is the only function
 * that returns a secret, and it is not reachable from any route.
 */
export async function resolveKey(
  root: string,
  id: string,
  env: (name: string) => string | undefined = (n) => Deno.env.get(n),
): Promise<string | null> {
  const spec = provider(id);
  if (!spec?.keyEnv) return null;
  const fromEnv = env(spec.keyEnv);
  if (fromEnv) return fromEnv;
  const store = await read(root);
  return store.providers[id]?.key ?? null;
}
