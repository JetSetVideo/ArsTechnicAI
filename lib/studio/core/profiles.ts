/**
 * profiles.ts — display profiles, typography bounds, and the capture sidecar.
 *
 * Four hardware classes, each with a width band, a base type range and a
 * panel strategy. `ui/public/profiles.css` implements the same table as media
 * queries; `tests/profiles_test.ts` parses that file and fails if the two
 * disagree, so a breakpoint cannot drift between the spec and the stylesheet.
 *
 * Every rendered font size must sit in [8px, 32px] regardless of profile. The
 * runtime check measures computed styles on the live page against this.
 */

export type ProfileKey = "mobile-p" | "mobile-l" | "tablet" | "desktop" | "lab-workstation";

export type PanelStrategy =
  | "single-column-drawers"
  | "canvas-slide-over-inspector"
  | "full-four-panel"
  | "expanded-multi-dock";

export interface ScreenProfile {
  readonly key: ProfileKey;
  readonly deviceClass: string;
  /** Inclusive lower bound, px. */
  readonly minWidth: number;
  /** Inclusive upper bound, px. `null` means unbounded. */
  readonly maxWidth: number | null;
  readonly fontMin: number;
  readonly fontMax: number;
  readonly layout: PanelStrategy;
}

export const FONT_FLOOR_PX = 8;
export const FONT_CEILING_PX = 32;

export const PROFILES: readonly ScreenProfile[] = Object.freeze([
  {
    key: "mobile-p",
    deviceClass: "Smartphone (portrait)",
    minWidth: 320,
    maxWidth: 767,
    fontMin: 10,
    fontMax: 14,
    layout: "single-column-drawers",
  },
  {
    key: "mobile-l",
    deviceClass: "Smartphone (landscape)",
    minWidth: 320,
    maxWidth: 767,
    fontMin: 10,
    fontMax: 14,
    layout: "single-column-drawers",
  },
  {
    key: "tablet",
    deviceClass: "Tablet / foldable",
    minWidth: 768,
    maxWidth: 1024,
    fontMin: 12,
    fontMax: 16,
    layout: "canvas-slide-over-inspector",
  },
  {
    key: "desktop",
    deviceClass: "Standard monitor",
    minWidth: 1025,
    maxWidth: 1920,
    fontMin: 14,
    fontMax: 18,
    layout: "full-four-panel",
  },
  {
    key: "lab-workstation",
    deviceClass: "Ultra-wide / lab display",
    minWidth: 1921,
    maxWidth: null,
    fontMin: 16,
    fontMax: 24,
    layout: "expanded-multi-dock",
  },
]);

/**
 * Which profile a viewport belongs to. Width decides the band; orientation
 * only splits the phone band. Anything narrower than 320 is still a phone.
 */
export function profileFor(width: number, height: number): ScreenProfile {
  if (width <= 767) {
    return PROFILES.find((p) => p.key === (width > height ? "mobile-l" : "mobile-p"))!;
  }
  if (width <= 1024) return PROFILES.find((p) => p.key === "tablet")!;
  if (width <= 1920) return PROFILES.find((p) => p.key === "desktop")!;
  return PROFILES.find((p) => p.key === "lab-workstation")!;
}

/**
 * The base font size for a viewport: linear across the profile's band, then
 * clamped to its range and to the global [8, 32] bounds.
 */
export function baseFontPx(width: number, height: number): number {
  const p = profileFor(width, height);
  const lo = p.minWidth;
  const hi = p.maxWidth ?? 3840;
  const t = Math.min(1, Math.max(0, (width - lo) / Math.max(1, hi - lo)));
  const size = p.fontMin + t * (p.fontMax - p.fontMin);
  return clampFont(Math.round(size * 100) / 100);
}

export const clampFont = (px: number): number =>
  Math.min(FONT_CEILING_PX, Math.max(FONT_FLOOR_PX, px));

// ===========================================================================
// Screenshot evaluation sidecar
// ===========================================================================

export interface CaptureSidecar {
  readonly timestamp: string;
  readonly capture_id: string;
  readonly screen_profile: ProfileKey;
  readonly resolution: { readonly width: number; readonly height: number };
  readonly telemetry: {
    readonly current_fps: number;
    readonly vram_usage_mb: number | null;
    readonly system_ram_mb: number | null;
    readonly draw_calls: number | null;
  };
  readonly lineage_context: {
    readonly active_node_id: string | null;
    readonly parent_asset_id: string | null;
    readonly graph_node_depth: number | null;
    readonly columnar_record_id: string | null;
  };
  readonly context: {
    readonly active_route: string;
    readonly radial_menu_open: boolean;
    readonly bottom_terminal_expanded: boolean;
    readonly theme: string;
  };
  readonly evaluation_target: {
    readonly macro_region: string;
    readonly micro_region: string;
    readonly intent: string;
  };
}

/** Problems with a sidecar, as sentences. Empty means valid. */
export function validateSidecar(doc: unknown): string[] {
  const out: string[] = [];
  if (typeof doc !== "object" || doc === null) return ["Sidecar is not an object."];
  const d = doc as Record<string, Record<string, unknown> & unknown>;
  const str = (v: unknown) => typeof v === "string" && v.length > 0;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const numOrNull = (v: unknown) => v === null || num(v);
  const strOrNull = (v: unknown) => v === null || str(v);

  if (!str(d.timestamp) || Number.isNaN(Date.parse(d.timestamp as unknown as string))) {
    out.push("timestamp must be an ISO-8601 string.");
  }
  if (!str(d.capture_id) || !/^cap_[a-z0-9_]+$/.test(d.capture_id as unknown as string)) {
    out.push("capture_id must look like cap_<id>.");
  }
  if (!PROFILES.some((p) => p.key === (d.screen_profile as unknown))) {
    out.push(`screen_profile must be one of ${PROFILES.map((p) => p.key).join(", ")}.`);
  }
  const r = d.resolution;
  if (!r || !num(r.width) || !num(r.height)) out.push("resolution needs numeric width and height.");
  else if (PROFILES.some((p) => p.key === (d.screen_profile as unknown))) {
    const expected = profileFor(r.width as number, r.height as number).key;
    if (expected !== (d.screen_profile as unknown)) {
      out.push(
        `resolution ${r.width}×${r.height} is profile ${expected}, not ${
          String(d.screen_profile)
        }.`,
      );
    }
  }
  const t = d.telemetry;
  if (!t) out.push("telemetry is required.");
  else {
    if (!num(t.current_fps) || (t.current_fps as number) < 0) {
      out.push("telemetry.current_fps must be ≥ 0.");
    }
    for (const k of ["vram_usage_mb", "system_ram_mb", "draw_calls"]) {
      if (!numOrNull(t[k])) out.push(`telemetry.${k} must be a number or null.`);
    }
  }
  const l = d.lineage_context;
  if (!l) out.push("lineage_context is required.");
  else {
    for (const k of ["active_node_id", "parent_asset_id", "columnar_record_id"]) {
      if (!strOrNull(l[k])) out.push(`lineage_context.${k} must be a string or null.`);
    }
    if (!numOrNull(l.graph_node_depth)) {
      out.push("lineage_context.graph_node_depth must be a number or null.");
    }
  }
  const c = d.context;
  if (!c) out.push("context is required.");
  else {
    if (!str(c.active_route)) out.push("context.active_route is required.");
    for (const k of ["radial_menu_open", "bottom_terminal_expanded"]) {
      if (typeof c[k] !== "boolean") out.push(`context.${k} must be boolean.`);
    }
    if (!str(c.theme)) out.push("context.theme is required.");
  }
  const e = d.evaluation_target;
  if (!e) out.push("evaluation_target is required.");
  else {
    for (const k of ["macro_region", "micro_region", "intent"]) {
      if (!str(e[k])) out.push(`evaluation_target.${k} is required.`);
    }
  }
  return out;
}
