/**
 * studio.ts — the blank project a creator opens before there is a reel.
 *
 * ArchiveRestorer creates a project by extracting a video (`POST /api/video/load`).
 * Home also needs a project that starts as metadata: a name, a media type, a
 * length, tags, and the models the user intends to use. That shape lives here
 * so the gateway and the tests agree, and so extract stays a separate path.
 */

export const STUDIO_MEDIA_TYPES = [
  "movie",
  "tv",
  "reel",
  "comic",
  "manga",
  "music",
  "book",
] as const;

export type StudioMediaType = typeof STUDIO_MEDIA_TYPES[number];

export const STUDIO_MEDIA_TYPE_SET: ReadonlySet<string> = new Set(STUDIO_MEDIA_TYPES);

export function isStudioMediaType(value: string): value is StudioMediaType {
  return STUDIO_MEDIA_TYPE_SET.has(value);
}

/** What Home POSTs to `POST /studio/projects`. */
export interface StudioProjectCreate {
  readonly name?: string;
  readonly media_type?: string;
  readonly length?: string | number;
  readonly tags?: readonly string[];
  readonly models?: readonly string[];
  readonly favorite?: boolean;
}

/**
 * Canonical on-disk `project.json` for a studio-created project.
 *
 * Engine extract manifests keep every key they already have. This record is
 * additive: the fields Home's `projectName` / `projectId` / tags already read
 * (`project_id`, `source_name`, `created_at`, `tags`, `favorite`, `frame_count`)
 * are filled, and the studio-only keys sit beside them.
 */
export interface StudioProject {
  readonly project_id: string;
  readonly name: string;
  readonly source_name: string;
  /** Unix seconds, matching extract manifests. Home also reads `createdAt`. */
  readonly created_at: number;
  /** ISO timestamp so `Date.parse` on Home sorts studio cards. */
  readonly createdAt: string;
  readonly media_type: StudioMediaType;
  readonly length: string;
  readonly tags: readonly string[];
  readonly models: readonly string[];
  readonly favorite: boolean;
  readonly frame_count: number;
  readonly origin: "studio";
  readonly moodboard: readonly unknown[];
  readonly assets: readonly unknown[];
  readonly references: readonly string[];
  readonly workflow_id: string | null;
  readonly source_path: string;
  /** Canonical edges Home and Workshop both read. Arrays of ids, never blobs. */
  readonly relations: StudioRelations;
}

export interface StudioRelations {
  readonly assets: readonly string[];
  readonly references: readonly string[];
  readonly workflows: readonly string[];
  readonly projects: readonly string[];
}

export function slugify(name: string): string {
  const ascii = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return slug || "project";
}

export function newStudioProjectId(name: string, now = Date.now()): string {
  return `${slugify(name)}-${Math.floor(now / 1000)}`;
}

export function formatStudioLength(value: string | number | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

export function createStudioManifest(
  input: StudioProjectCreate,
  now = Date.now(),
): StudioProject {
  const name = (input.name ?? "").trim() || "Untitled";
  const media_type: StudioMediaType = isStudioMediaType(input.media_type ?? "")
    ? input.media_type as StudioMediaType
    : "movie";
  const tags = [...new Set((input.tags ?? []).map((t) => String(t).trim()).filter(Boolean))];
  const models = [...new Set((input.models ?? []).map((m) => String(m).trim()).filter(Boolean))];
  const project_id = newStudioProjectId(name, now);
  return {
    project_id,
    name,
    source_name: name,
    created_at: now / 1000,
    createdAt: new Date(now).toISOString(),
    media_type,
    length: formatStudioLength(input.length),
    tags,
    models,
    favorite: input.favorite === true,
    frame_count: 0,
    origin: "studio",
    moodboard: [],
    assets: [],
    references: [],
    workflow_id: null,
    source_path: "",
    relations: { assets: [], references: [], workflows: [], projects: [] },
  };
}

/**
 * Workflow list media type. An authored `media_type` wins; otherwise the graph
 * itself says whether this is restoration footage or something else.
 */
export function inferFlowMediaType(
  parsed: {
    media_type?: unknown;
    graph?: { nodes?: Record<string, { type?: string }> } | undefined;
  },
): StudioMediaType {
  if (typeof parsed.media_type === "string" && isStudioMediaType(parsed.media_type)) {
    return parsed.media_type;
  }
  const types = Object.values(parsed.graph?.nodes ?? {}).map((n) => n.type ?? "");
  if (types.some((t) => t.includes("audio") || t.includes("music"))) return "music";
  if (types.some((t) => t.startsWith("source.sequence") || t.startsWith("stage."))) {
    return "reel";
  }
  return "movie";
}
