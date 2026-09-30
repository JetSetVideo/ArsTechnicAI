/**
 * profiles_test.ts — display profiles, typography bounds, capture sidecars.
 *
 * The CSS parity test is the important one: breakpoints live in two places
 * (core/profiles.ts and ui/public/profiles.css) and this fails if they drift.
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  baseFontPx,
  FONT_CEILING_PX,
  FONT_FLOOR_PX,
  profileFor,
  PROFILES,
  validateSidecar,
} from "../core/profiles.ts";

const CSS = await Deno.readTextFile(new URL("../ui/public/profiles.css", import.meta.url));
const CANVAS_CSS = await Deno.readTextFile(new URL("../ui/public/canvas.css", import.meta.url));

Deno.test("profiles: the stylesheet declares exactly the bands and type ranges in PROFILES", () => {
  const declared = [...CSS.matchAll(
    /profile: (\S+) width (\d+)-(\d*) font (\d+)-(\d+) layout (\S+)/g,
  )].map((m) => ({
    key: m[1]!,
    min: Number(m[2]),
    max: m[3] ? Number(m[3]) : null,
    fontMin: Number(m[4]),
    fontMax: Number(m[5]),
    layout: m[6]!,
  }));
  assertEquals(declared.length, 4);
  for (const p of PROFILES) {
    const key = p.key.startsWith("mobile") ? "mobile" : p.key;
    const d = declared.find((x) => x.key === key);
    assert(d, `profiles.css declares ${key}`);
    assertEquals([d.min, d.max, d.fontMin, d.fontMax, d.layout], [
      p.minWidth,
      p.maxWidth,
      p.fontMin,
      p.fontMax,
      p.layout,
    ], p.key);
    // …and the media query and clamp() under that comment agree too.
    const block = CSS.slice(CSS.indexOf(`profile: ${key} `));
    const clamp = block.match(
      /--fs-base: clamp\((\d+)px, calc\((\d+)px \+ (\d+) \* \(\(100vw - (\d+)px\) \/ (\d+)\)\), (\d+)px\)/,
    );
    assert(clamp, `${key} has a --fs-base clamp`);
    assertEquals(Number(clamp[1]), p.fontMin);
    assertEquals(Number(clamp[6]), p.fontMax);
    assertEquals(Number(clamp[4]), p.minWidth);
    const media = block.match(/@media ([^{]+)\{/)![1]!;
    if (p.maxWidth !== null) assert(media.includes(`max-width: ${p.maxWidth}px`), media);
    if (p.minWidth > 320) assert(media.includes(`min-width: ${p.minWidth}px`), media);
  }
});

Deno.test("profiles: every width maps to one profile and bands do not overlap", () => {
  assertEquals(profileFor(390, 844).key, "mobile-p");
  assertEquals(profileFor(844, 390).key, "tablet", "844 wide is past the phone band");
  assertEquals(profileFor(740, 360).key, "mobile-l");
  assertEquals(profileFor(768, 1024).key, "tablet");
  assertEquals(profileFor(1024, 768).key, "tablet");
  assertEquals(profileFor(1025, 800).key, "desktop");
  assertEquals(profileFor(1920, 1080).key, "desktop");
  assertEquals(profileFor(1921, 1080).key, "lab-workstation");
});

Deno.test("profiles: base font stays inside the profile range and the global bounds", () => {
  for (let w = 280; w <= 5200; w += 17) {
    const px = baseFontPx(w, 900);
    const p = profileFor(w, 900);
    assert(px >= p.fontMin && px <= p.fontMax, `${w}px → ${px}`);
    assert(px >= FONT_FLOOR_PX && px <= FONT_CEILING_PX);
  }
  assertEquals(baseFontPx(1025, 800), 14);
  assertEquals(baseFontPx(1920, 1080), 18);
});

const CHROME_CSS = ["profiles.css", "inspect.css"].map((f) =>
  Deno.readTextFileSync(new URL(`../ui/public/${f}`, import.meta.url))
);

Deno.test("profiles.css and inspect.css: chrome fonts use the clamped profile scale only", () => {
  for (const css of CHROME_CSS) {
    for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = m[1]!.trim();
      assert(
        /^clamp\(8px, calc\(var\(--fs-base, 14px\) \* [0-9.]+\), 32px\)$/.test(value),
        `unbounded font-size: ${value}`,
      );
    }
  }
});

Deno.test("canvas.css: every chrome font size is clamped to [8px, 32px]", () => {
  const sizes = [...CANVAS_CSS.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim());
  const unbounded = sizes.filter((s) =>
    !s.startsWith("clamp(8px,") && s !== "var(--fs-base, 14px)" &&
    !/^\d+px$/.test(s) && s !== "inherit"
  );
  assertEquals(unbounded, []);
  // Fixed pixel sizes are allowed only in world-space card rules, and in range.
  for (const m of CANVAS_CSS.matchAll(/font-size:\s*(\d+)px/g)) {
    const n = Number(m[1]);
    assert(n >= FONT_FLOOR_PX && n <= FONT_CEILING_PX, `${n}px`);
  }
});

const SAMPLE = {
  timestamp: "2026-09-17T16:45:10Z",
  capture_id: "cap_vlm_009821",
  screen_profile: "desktop",
  resolution: { width: 1920, height: 1080 },
  telemetry: { current_fps: 60.0, vram_usage_mb: 3840, system_ram_mb: 7680, draw_calls: 245 },
  lineage_context: {
    active_node_id: "node_gen_img_088",
    parent_asset_id: "ast_img_087_v1",
    graph_node_depth: 4,
    columnar_record_id: "col_log_881923",
  },
  context: {
    active_route: "/canvas/infinite_workspace",
    radial_menu_open: false,
    bottom_terminal_expanded: true,
    theme: "dark_custom",
  },
  evaluation_target: {
    macro_region: "infinite_canvas",
    micro_region: "inspector_parameter_panel",
    intent: "Verify prompt delta comparison rendering between parent asset and derived child.",
  },
};

Deno.test("sidecar: the reference example validates", () => {
  assertEquals(validateSidecar(SAMPLE), []);
});

Deno.test("sidecar: a profile that contradicts the resolution is named", () => {
  const bad = { ...SAMPLE, screen_profile: "tablet" };
  assert(validateSidecar(bad).some((p) => p.includes("is profile desktop")));
  const worse = {
    ...SAMPLE,
    telemetry: { ...SAMPLE.telemetry, current_fps: "60" },
    capture_id: "x",
  };
  assertEquals(validateSidecar(worse).length, 2);
});
