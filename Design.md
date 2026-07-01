# Ars TechnicAI — Design System & UI Engineering Standards

> **Document Version**: 2.0 · **Last Updated**: June 2026 · **Status**: Living Document
>
> This document defines the **complete visual language**, **interaction patterns**, **CSS specifications**, and **div hierarchy** for Ars TechnicAI. It is written from the perspective of a professional design director who has shipped desktop-grade creative tools.
>
> Also see: `Structure.md` (module boundaries, naming), `README.md` (feature catalog, architecture overview).

---

## Table of Contents

1. [Design Philosophy & Critique](#1-design-philosophy--critique)
2. [Complete Div & Bubble Hierarchy](#2-complete-div--bubble-hierarchy)
3. [Color System & Token Architecture](#3-color-system--token-architecture)
4. [Parametric Design Knobs](#4-parametric-design-knobs)
5. [Typography & Density](#5-typography--density)
6. [Spacing & Layout Grid](#6-spacing--layout-grid)
7. [Motion & Interaction States](#7-motion--interaction-states)
8. [Homepage Specification](#8-homepage-specification)
9. [Workshop Specification](#9-workshop-specification)
10. [Explorer Panel (Left Bar) Specification](#10-explorer-panel-left-bar-specification)
11. [Canvas & Grouping Specification](#11-canvas--grouping-specification)
12. [Timeline Specification](#12-timeline-specification)
13. [Settings Modal Specification](#13-settings-modal-specification)
14. [Filter System Specification](#14-filter-system-specification)
15. [HTML Primitives & Baseline Styling](#15-html-primitives--baseline-styling)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [Performance Requirements](#17-performance-requirements)
18. [Naming Conventions](#18-naming-conventions)
19. [Implementation Status Audit](#19-implementation-status-audit)

---

## 1. Design Philosophy & Critique

### Design Director's Assessment

*"The dark theme is well-calibrated — `#0a0a0b` base with stepped surfaces creates depth without harsh contrast. The parametric system (density, roundness, glow, contrast as first-class knobs) is genuinely innovative for a web app. But the critique:

1. The **homepage** feels under-designed — projects are data rows, not creative artifacts. A film director opening this should feel like they're entering a post-production suite, not a database browser. Project cards need visual weight: cover images, status pulses, media type badges with color, expandable detail panels.

2. The **workshop** has tool redundancy — the same actions appear in the TopBar, FloatingToolbar, context menus, and Inspector. This breaks the principle of 'one action, one canonical location.' The FloatingToolbar should be the primary interaction surface for canvas operations. The TopBar is for navigation and global state. The Inspector is for properties. Context menus are accelerators.

3. The **Explorer left bar** wastes precious horizontal space — padding from the left edge creates a dead zone. Icons should sit at 4px from the left border. Empty folders should visually collapse (grey, low opacity) so the user's eye goes straight to active content.

4. The **filter system** must graduate from a simple search bar to a faceted search panel with multi-dimensional filtering — type, status, date, platform, source. This is how professionals browse asset libraries in tools like DaVinci Resolve and Adobe Bridge.

5. The **connection dot** metaphor for linking assets is elegant but underspecified — the dots, the lines, the grouping interaction, and the group contour all need precise visual definitions."*

### Creative Director's Assessment

*"The color story is strong but incomplete. Every media type should have an inherent color that follows it everywhere — in the Explorer icon, on the canvas item border, in the timeline clip, in the filter badges. The user should develop color intuition: pink = image, purple = video, green = audio, blue = text. This is how Premiere Pro users navigate complex timelines — by color, not by reading labels.

The element color coding in the Workshop (blue = original, red = added, grey = hidden, green = imported) is an excellent semantic system. It should be extended to Layers, Timeline, and Explorer.

The homepage needs a 'mood' — it's not a settings page. The hero area with the prompt input and pipeline visualizer is the right direction but should feel like a launchpad, not a form. Gradient borders, subtle particle animations on the Generate button, and platform cards that glow when selected."*

---

## 2. Complete Div & Bubble Hierarchy

### 2.1 App Shell (Workshop / Editor)

```
app-shell-layout-root                                          ← CSS Grid: topbar + workspace
├── top-bar-navigation-primary-at-top                           ← 40px height, mode switcher
│   ├── top-bar-mode-segmented-control                       ← Create | Rework | Comic | Video | 3D
│   ├── top-bar-project-breadcrumb                           ← Project name (editable)
│   ├── top-bar-action-group-right                            ← Save, Settings, Account
│   └── connection-status-indicator                          ← Green/orange/red dot
│
├── app-shell-workspace-region                                 ← CSS Grid: left | main | right
│   │
│   ├── explorer-panel-left-sidebar                            ← Collapsible, 240-280px
│   │   ├── explorer-tab-bar (Local | Cloud)
│   │   ├── explorer-search-bar-with-filter-chips
│   │   ├── explorer-file-tree-virtualized                    ← Virtualized tree
│   │   │   └── explorer-tree-item-row (per node)
│   │   │       ├── explorer-tree-item-icon (4px from left)
│   │   │       ├── explorer-tree-item-name
│   │   │       └── explorer-tree-item-badge (asset count)
│   │   └── explorer-upload-button-bottom
│   │
│   ├── resize-handle-explorer-active                          ← Drag to resize
│   │
│   ├── main-area-workspace-center                             ← flex column
│   │   ├── canvas-infinite-workspace-active                   ← Infinite pan/zoom
│   │   │   ├── canvas-grid-background
│   │   │   ├── canvas-item-layer (per asset)
│   │   │   │   ├── canvas-item-thumbnail
│   │   │   │   ├── canvas-item-label
│   │   │   │   ├── canvas-item-resize-handles (8)
│   │   │   │   └── canvas-item-connection-dot-bottom         ← Link dot
│   │   │   ├── canvas-connection-line (per edge)            ← Colored line between dots
│   │   │   ├── canvas-selection-rectangle                    ← Multiselect drag rect
│   │   │   ├── canvas-group-contour                          ← Thick stacked-border outline
│   │   │   └── canvas-minimap-overlay
│   │   │
│   │   ├── floating-toolbar-vertical-left                    ← Frosted glass icon bar
│   │   │   ├── floating-toolbar-group-selection (Pointer, Lasso, Pan)
│   │   │   ├── floating-toolbar-divider
│   │   │   ├── floating-toolbar-group-creation (AI, Pen, Shape, Text, Eyedropper)
│   │   │   ├── floating-toolbar-divider
│   │   │   ├── floating-toolbar-group-history (Undo, Redo)
│   │   │   ├── floating-toolbar-divider
│   │   │   ├── floating-toolbar-group-view (Zoom In, Out, Fit)
│   │   │   ├── floating-toolbar-divider
│   │   │   └── floating-toolbar-group-output (Layers, Export, Video, Audio, Publish)
│   │   │
│   │   └── timeline-docked-bottom (optional, toggled)        ← 160-240px
│   │       ├── timeline-timecode-ruler
│   │       ├── timeline-track-video-primary
│   │       ├── timeline-track-video-overlay
│   │       ├── timeline-track-audio-music
│   │       ├── timeline-track-audio-voice
│   │       ├── timeline-track-effects
│   │       ├── timeline-track-captions
│   │       ├── timeline-track-prompts
│   │       ├── timeline-track-groups
│   │       └── timeline-transport-controls-bottom
│   │
│   ├── resize-handle-inspector-active                         ← Drag to resize
│   │
│   └── inspector-panel-right-sidebar                          ← Collapsible, 300-340px
│       ├── inspector-section-generate (collapsible)
│       ├── inspector-section-templates
│       ├── inspector-section-api-settings
│       ├── inspector-section-selected-item-properties
│       ├── inspector-section-version-history
│       └── inspector-section-recent-jobs
│
└── settings-modal-overlay (conditional)
```

### 2.2 Homepage (Dashboard)

Information hierarchy: projects first, quick-create hero at the bottom (compact by default).

```
dashboard-layout-root-page-region                                ← flex column, 100vh
│
├── connection-banner-status-at-startup                          ← Fixed top, ephemeral
│
├── dashboard-layout-header-primary-at-top                       ← 44px, flex row
│   ├── brand-logo (Ars TechnicAI)                              ← Serif italic + mono + gradient
│   ├── search-box-global                                        ← flex: 1, max 560px
│   │   ├── search-icon-magnifier
│   │   └── search-input-text (searches projects + assets + tags + synopsis)
│   └── avatar-button-account-settings                           ← 28px circle, status ring
│
├── app-shell-workspace-region                                    ← flex row
│   ├── home-left-panel-file-tree                                ← Collapsible, 240px
│   ├── home-left-toolbar-actions                                ← Icon rail, 40px
│   │
│   └── dashboard-main-content-region                            ← flex column, flex: 1
│       │
│       ├── content-filter-bar-secondary                         ← LEVEL 1: Always above fold
│       │   ├── tab-nav-projects-assets                          ← Projects | Assets
│       │   │   └── tab-button-role-tablist (×2)
│       │   └── new-project-button-primary
│       │
│       ├── content-grid-main-scrollable                         ← LEVEL 1: Primary content
│       │   └── project-cards-grid-responsive
│       │       ├── new-project-card-button
│       │       └── project-card-component (×N)
│       │           ├── project-card-thumbnail-cover             ← Full-bleed cover image
│       │           ├── project-card-toolbar-top                 ← Favorite + Edit + ••• menu
│       │           │   ├── toolbar-left-actions (favorite, edit)
│       │           │   └── toolbar-right-actions (menu)
│       │           └── project-card-info-overlay-bottom
│       │               ├── project-card-name-row               ← Name + path prefix + drag handle
│       │               ├── project-card-hierarchy-badges       ← Child-of / Parent-of indicators
│       │               ├── project-card-media-badges-row       ← 🖼 images · 🎬 videos · 🎵 audio · 📝 text · ✨ AI/import/remix counts
│       │               ├── project-card-details-chips          ← type, aspect ratio, genre, style
│       │               ├── project-card-meta-row               ← Calendar date · status dot · asset count button
│       │               ├── project-card-asset-list-expanded    ← (conditional) thumbnails + type
│       │               └── project-card-tags-row               ← Tag chips
│       │
│       ├── generation-results-strip                             ← LEVEL 2: Appears when results exist
│       │   └── gen-results-grid-scrollable
│       │       └── gen-result-card (×N)
│       │           ├── gen-result-image
│       │           └── gen-result-overlay-actions (Edit · Save)
│       │
│       └── creation-hero-section-main                           ← LEVEL 3+4: Compact at bottom
│           │
│           ├── pipeline-visualizer-steps-row                    ← LEVEL 3: Pipeline step dots
│           │   └── pipeline-step (×7: Script·MoodBoard·Prompts·Generate·Storyboard·Timeline·Publish)
│           │       ├── pipeline-dot (filled=done, empty=pending)
│           │       └── pipeline-label
│           │
│           ├── prompt-input-group-flex                          ← LEVEL 3: Compact prompt strip
│           │   ├── prompt-compact-row
│           │   │   ├── platform-tabs-compact (icon chips, vertical)
│           │   │   ├── prompt-textarea-multiline
│           │   │   └── prompt-compact-actions
│           │   │       ├── style-picker-dropdown
│           │   │       ├── image-count-selector-compact (×1, ×2, ×4)
│           │   │       ├── generate-button-primary-gradient
│           │   │       └── hero-expand-button (▲/▼ chevron)
│           │   └── dim-hint-label (WxH · Style)
│           │
│           └── creation-hero-advanced-panel                     ← LEVEL 4: Hidden by default
│               ├── negative-prompt-input-row
│               ├── platform-selector-row-full (with Custom dims)
│               ├── cinematic-controls-section (Composition · Lighting · Camera · Ratios)
│               ├── image-count-selector-row-full
│               ├── character-creator-section
│               ├── prompt-templates-section
│               └── module-badges-row (×7 categories)
```

---

## 3. Color System & Token Architecture

### 3.1 Core Palette (Dark Theme — Default)

```css
:root {
  /* ── Background Hierarchy (5 levels of elevation) ── */
  --bg-0: #07070a;       /* App base — deepest */
  --bg-1: #0a0a0b;       /* Main workspace — `--bg-primary` */
  --bg-2: #121215;       /* Panels — `--bg-secondary` */
  --bg-3: #1a1a1f;       /* Hover / elevated surfaces — `--bg-tertiary` */
  --bg-4: #222228;       /* Overlays / modals — `--bg-elevated` */
  --bg-5: #2a2a32;       /* Peak elevation / tooltips — `--bg-overlay` */

  /* ── Foreground Hierarchy (4 levels of text contrast) ── */
  --fg-0: #fafafc;       /* Primary text — `--text-primary` */
  --fg-1: #a1a1aa;       /* Secondary text — `--text-secondary` */
  --fg-2: #52525b;       /* Muted / placeholder — `--text-muted` */
  --fg-3: #3d3d4a;       /* Disabled / decorative */

  /* ── Border Hierarchy (3 levels) ── */
  --b-0: #1e1e28;        /* Subtle separator */
  --b-1: #27272a;        /* Standard border — `--border-color` */
  --b-2: #3f3f46;        /* Strong / focus border — `--border-strong` */

  /* ── Accent System ── */
  --a-primary:     #00d4aa;    /* Teal-green — primary CTA, active states */
  --a-primary-a:   rgba(0, 212, 170, 0.15);   /* Alpha variant */
  --a-secondary:   #7c3aed;    /* Violet — secondary accent */
  --a-secondary-a: rgba(124, 58, 237, 0.15);
  --a-tertiary:    #f59e0b;    /* Amber — warnings, highlights */
  --a-gradient:    linear-gradient(135deg, #00d4aa 0%, #7c3aed 100%);

  /* ── Semantic Status Colors ── */
  --c-success:     #22c55e;    /* Green — complete, ready, online */
  --c-success-a:   rgba(34, 197, 94, 0.15);
  --c-warning:     #f97316;    /* Orange — degraded, generating */
  --c-warning-a:   rgba(249, 115, 22, 0.15);
  --c-error:       #ef4444;    /* Red — failed, offline, delete */
  --c-error-a:     rgba(239, 68, 68, 0.15);
  --c-info:        #3b82f6;    /* Blue — informational */
  --c-info-a:      rgba(59, 130, 246, 0.15);

  /* ── Media Type Colors (follow asset through all views) ── */
  --t-image:       #ec4899;    /* Pink — raster/vector images */
  --t-video:       #8b5cf6;    /* Purple — video clips */
  --t-audio:       #22c55e;    /* Green — audio/waveforms */
  --t-text:        #60a5fa;    /* Blue — text/scripts/subtitles */
  --t-3d:          #f59e0b;    /* Amber — 3D models/splats */
  --t-folder:      #f59e0b;    /* Amber — folders */
  --t-prompt:      #c084fc;    /* Lavender — prompt assets */
  --t-data:        #94a3b8;    /* Slate — data/JSON/CSV */

  /* ── Element Origin Colors (Workshop element list) ── */
  --e-original:    #3b82f6;    /* Blue — elements from source image */
  --e-user-added:  #ef4444;    /* Red — drawn/written by user */
  --e-hidden:      #6b7280;    /* Grey — hidden or removed */
  --e-imported:    #22c55e;    /* Green — imported from other assets */

  /* ── Selection ── */
  --selection-bg:     rgba(0, 212, 170, 0.2);
  --selection-border: rgba(0, 212, 170, 0.5);
  --selection-rect:   rgba(0, 212, 170, 0.08);
  --selection-rect-border: rgba(0, 212, 170, 0.3);

  /* ── Focus Ring ── */
  --focus-ring: #00d4aa;

  /* ── Shadows (parametric — see Section 4) ── */
  --shadow-xs:  0 1px 2px  rgba(0, 0, 0, 0.40);
  --shadow-sm:  0 2px 4px  rgba(0, 0, 0, 0.45);
  --shadow-md:  0 4px 12px rgba(0, 0, 0, 0.50);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.55);
  --shadow-xl:  0 16px 32px rgba(0, 0, 0, 0.60);
  --shadow-glow-accent: 0 0 10px rgba(0, 212, 170, 0.18);

  /* ── Glass (frosted toolbar / overlays) ── */
  --glass-bg:       rgba(18, 18, 21, 0.88);
  --glass-border:   rgba(62, 62, 74, 0.6);
  --glass-blur:     12px;

  /* ── Radii ── */
  --r-xs:  2px;
  --r-sm:  6px;
  --r-md:  10px;
  --r-lg:  14px;
  --r-xl:  20px;
  --r-pill: 9999px;

  /* ── Typography ── */
  --font-serif:  'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-mono:   'Geist Mono', 'Fira Code', 'JetBrains Mono', Menlo, monospace;
  --font-ui:     'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;

  /* ── Layout Constants ── */
  --topbar-h:     40px;
  --leftpanel-w:  240px;
  --rightpanel-w: 300px;
  --timeline-h:   140px;
  --toolbar-w:    44px;
}
```

### 3.2 Color Variable Relations (Semantic Mapping)

Every component should consume these high-level tokens, NEVER raw hex values:

```css
/* ✅ DO: Use semantic tokens */
.myComponent {
  background: var(--bg-2);         /* panel surface */
  color: var(--fg-0);              /* primary text */
  border: 1px solid var(--b-1);   /* standard border */
}

/* ❌ DON'T: Hardcode hex values */
.myComponent {
  background: #121215;  /* Fragile — won't respond to param knobs */
}
```

### 3.3 Explorer Color Coding

| State | Icon Color | Name Color | Background | Meaning |
|-------|-----------|------------|------------|---------|
| **Empty folder** | `--fg-3` (grey, op: 0.35) | `--fg-2` (muted) | transparent | No children or all children empty |
| **Closed folder (with assets)** | `--fg-1` | `--fg-1` | transparent | Has content, not active |
| **Open active folder** | `--a-tertiary` (#f59e0b orange) | `--fg-0` | `--a-tertiary` at 8% opacity | Currently selected + expanded |
| **File (general)** | `--fg-1` | `--fg-1` | transparent | Standard file node |
| **File (media typed)** | respective `--t-*` color | `--fg-0` | transparent | Image=pink, Video=purple, etc. |

---

## 4. Parametric Design Knobs

### 4.1 The Five Knobs

These are first-class CSS custom properties that cascade via `calc()` into EVERY visual token in the app. Users adjust them in Settings → Appearance via sliders (range 0→2).

```css
:root {
  /* ── Knobs (range 0–2, default 1) ── */
  --param-density:   1;   /* 0=airy (1.5× spacing), 1=balanced, 2=compact (0.5×) */
  --param-roundness: 1;   /* 0=sharp (2px), 1=rounded (6px), 2=pill (10px) */
  --param-glow:      1;   /* 0=flat (no shadows), 1=subtle, 2=vivid (bold glow) */
  --param-contrast:  1;   /* 0=soft (low shadow depth), 1=normal, 2=crisp (deep) */
  --param-speed:     1;   /* 0=instant (no animation), 1=default, 2=slow (longer) */
}
```

### 4.2 Cascading Derivatives

```css
:root {
  /* ── Density → spacing multiplier ── */
  --density-scale: calc(1.5 - var(--param-density) * 0.5);
  /* density 0 → 1.5× (airy) | 1 → 1.0× | 2 → 0.5× (compact) */

  --sp-unit: calc(4px * var(--density-scale));
  --sp-xs:   var(--sp-unit);                  /* 2–6px */
  --sp-sm:   calc(var(--sp-unit) * 2);        /* 4–12px */
  --sp-md:   calc(var(--sp-unit) * 3);        /* 6–18px */
  --sp-lg:   calc(var(--sp-unit) * 4);        /* 8–24px */
  --sp-xl:   calc(var(--sp-unit) * 6);        /* 12–36px */
  --sp-2xl:  calc(var(--sp-unit) * 8);        /* 16–48px */

  /* ── Roundness → border radii ── */
  /* roundness 0 → 2px (sharp) | 1 → 6px | 2 → 10px */
  --r-base: calc(2px + var(--param-roundness) * 4px);
  --r-xs:   var(--r-base);
  --r-sm:   calc(var(--r-base) * 1.25);
  --r-md:   calc(var(--r-base) * 1.75);
  --r-lg:   calc(var(--r-base) * 2.5);
  --r-xl:   calc(var(--r-base) * 3.5);
  --r-pill: calc(var(--r-base) * 8);

  /* ── Glow → shadow spread + accent glow ── */
  --glow-spread:    calc(var(--param-glow) * 10px);
  --glow-alpha:     calc(var(--param-glow) * 0.18);
  --glow-accent:    rgba(0, 212, 170, var(--glow-alpha));
  --glow-secondary: rgba(124, 58, 237, var(--glow-alpha));

  /* ── Contrast → shadow depth ── */
  --shadow-depth: calc(0.25 + var(--param-contrast) * 0.15);
  --shadow-xs:  0 1px 2px  rgba(0, 0, 0, var(--shadow-depth));
  --shadow-sm:  0 2px 4px  rgba(0, 0, 0, var(--shadow-depth));
  --shadow-md:  0 4px 12px rgba(0, 0, 0, var(--shadow-depth));
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, var(--shadow-depth));
  --shadow-xl:  0 16px 32px rgba(0, 0, 0, var(--shadow-depth));

  --shadow-glow-accent:   0 0 var(--glow-spread) var(--glow-accent);
  --shadow-glow-secondary: 0 0 var(--glow-spread) var(--glow-secondary);

  /* ── Speed → animation durations ── */
  --dur-fast:   calc(80ms  + (1 - var(--param-speed)) * 80ms);
  --dur-normal: calc(150ms + (1 - var(--param-speed)) * 100ms);
  --dur-slow:   calc(250ms + (1 - var(--param-speed)) * 150ms);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:  cubic-bezier(0.32, 0, 0.67, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### 4.3 Preset Classes (Applied by JS)

```css
.theme-airy      { --param-density: 0; }
.theme-compact   { --param-density: 2; }
.theme-sharp     { --param-roundness: 0; }
.theme-pill      { --param-roundness: 2; }
.theme-flat      { --param-glow: 0;    --param-contrast: 0; }
.theme-vivid     { --param-glow: 2;    --param-contrast: 2; }
.theme-instant   { --param-speed: 0; }
.theme-slow      { --param-speed: 2; }
```

### 4.4 Knob Relationships (Visualized)

```
DENSITY ◄── affects ──► SPACING (all --sp-* tokens)
   │                        │
   ▼                        ▼
ROUNDNESS ◄── affects ──► RADII (all --r-* tokens)
   │                        
   ▼                        
GLOW ◄── affects ──► SHADOW SPREAD + ACCENT GLOW
   │                        │
   ▼                        ▼
CONTRAST ◄── affects ──► SHADOW DEPTH + BORDER CONTRAST
   │                        
   ▼                        
SPEED ◄── affects ──► ANIMATION DURATIONS
```

Knobs are **independent** — changing Density does not affect Roundness and vice versa. This orthogonality is by design. Each knob controls ONE visual dimension.

---

## 5. Typography & Density

### 5.1 Font Scale (Parametric)

```css
:root {
  --font-scale: 1;   /* adjustable via Settings → Appearance: small(0.875), medium(1), large(1.125) */

  --font-2xs: calc(0.625rem * var(--font-scale));   /* 10px */
  --font-xs:  calc(0.6875rem * var(--font-scale));   /* 11px */
  --font-sm:  calc(0.75rem * var(--font-scale));     /* 12px */
  --font-base: calc(0.8125rem * var(--font-scale));  /* 13px */
  --font-md:  calc(0.875rem * var(--font-scale));    /* 14px */
  --font-lg:  calc(1rem * var(--font-scale));        /* 16px */
  --font-xl:  calc(1.125rem * var(--font-scale));    /* 18px */
  --font-2xl: calc(1.25rem * var(--font-scale));     /* 20px */
  --font-3xl: calc(1.5rem * var(--font-scale));      /* 24px */
}
```

### 5.2 Typographic Roles

| Role | Font Family | Size | Weight | Letter Spacing |
|------|------------|------|--------|----------------|
| **Display / Brand** | `--font-serif` | `--font-xl`–`--font-3xl` | 400 italic | -0.01em |
| **Page Title** | `--font-ui` | `--font-xl` | 600 | -0.01em |
| **Section Header** | `--font-ui` | `--font-xs` | 600 | +0.06em uppercase |
| **Body** | `--font-ui` | `--font-sm`–`--font-base` | 400–500 | 0 |
| **Meta / Caption** | `--font-ui` | `--font-2xs`–`--font-xs` | 400 | +0.02em |
| **Code / Mono** | `--font-mono` | `--font-xs`–`--font-sm` | 400–500 | 0 |
| **Timecode** | `--font-mono` | `--font-sm` | 500 | tabular-nums |
| **Button** | `--font-ui` | `--font-xs`–`--font-sm` | 500–600 | 0 |

### 5.3 Density Guidelines

| Element | Height (comfortable) | Height (compact) |
|---------|---------------------|------------------|
| Table row | 32px | 24px |
| List item | 32px | 24px |
| Button (sm) | 28px | 22px |
| Button (md) | 32px | 26px |
| Button (lg) | 40px | 32px |
| Input | 32px | 26px |
| Select | 32px | 26px |
| Slider track | 4px | 3px |
| Slider thumb | 14px | 12px |

---

## 6. Spacing & Layout Grid

### 6.1 Spacing Scale

```css
:root {
  --space-1: 0.25rem;  /* 4px  — icon padding, tight gaps */
  --space-2: 0.5rem;   /* 8px  — inline gaps, small padding */
  --space-3: 0.75rem;  /* 12px — panel padding, section gaps */
  --space-4: 1rem;     /* 16px — component padding, card gap */
  --space-5: 1.25rem;  /* 20px — section margin */
  --space-6: 1.5rem;   /* 24px — page margin */
  --space-8: 2rem;     /* 32px — large section gap */
  --space-10: 2.5rem;  /* 40px — hero padding */
  --space-12: 3rem;    /* 48px — page padding */
}
```

### 6.2 App Shell Grid

```css
.appShellLayoutRoot {
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr;
  grid-template-columns: var(--leftpanel-w) 1fr var(--rightpanel-w);
  grid-template-areas:
    "topbar topbar topbar"
    "left   main   right";
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-1);
  color: var(--fg-0);
}
```

### 6.3 Homepage Layout

```css
.dashboardLayoutRootPageRegion {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-1);
}

.creationHeroSectionMain {
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-bottom: 1px solid var(--b-1);
}

.contentGridMainScrollable {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-md) var(--sp-lg);
}
```

---

## 7. Motion & Interaction States

### 7.1 Universal Interaction States

Every interactive element MUST define these states:

| State | Visual Treatment |
|-------|-----------------|
| **Default** | Base appearance |
| **Hover** | Slight surface lift (+`--bg-3`), border shift |
| **Active / Pressed** | `transform: translateY(1px)`, inner shadow |
| **Focus-visible** | `outline: 2px solid var(--focus-ring)`, offset 2px |
| **Disabled** | `opacity: 0.45`, `cursor: not-allowed`, no hover effect |
| **Selected / On** | `background: var(--selection-bg)`, `border: var(--selection-border)` |
| **Dragging** | `opacity: 0.8`, `scale: 1.02`, drop shadow |
| **Drop target** | `border: 2px dashed var(--a-secondary)`, pulsing background |

### 7.2 Transitions

```css
/* Standard interactive transition */
.interactive {
  transition:
    background-color var(--dur-normal) var(--ease-out),
    border-color var(--dur-normal) var(--ease-out),
    box-shadow var(--dur-normal) var(--ease-out),
    transform var(--dur-fast) var(--ease-in);
}

/* Quick micro-interaction (icons, badges) */
.micro {
  transition: all var(--dur-fast) var(--ease-out);
}

/* Panel open/close */
.panelTransition {
  transition: width var(--dur-slow) var(--ease-in-out),
              opacity var(--dur-normal) var(--ease-out);
}
```

### 7.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.4 Button State Progression

```
Activated (primary):
  background: var(--accent-gradient);
  color: white;
  border: none;
  box-shadow: 0 4px 16px var(--c-success-alpha);

Neutral (secondary):
  background: var(--bg-2);
  color: var(--fg-0);
  border: 1px solid var(--b-1);
  box-shadow: none;

Pressed (active):
  background: darken of activated color;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), var(--shadow-sm);
  transform: translateY(1px);

Disabled:
  background: var(--bg-2);
  color: var(--fg-2);
  border: 1px solid var(--b-0);
  box-shadow: none;
  opacity: 0.5;
```

---

## 8. Homepage Specification

### 8.1 Mission Control Philosophy

The Homepage is not a "file listing." It is a **creative mission control center**. A film director, content creator, or social media producer should:

1. **See projects immediately** — the project grid is the primary content and must be visible above the fold by default
2. **Filter intelligently** across multiple dimensions to find the right project or asset
3. **Quick-create** via a compact prompt strip (docked at bottom); expands on demand for full creative tools
4. **Expand projects** to see asset details, pipeline phase, and published status without navigating away

### 8.2 Information Hierarchy (Critical)

The homepage has four visibility levels, ordered most visible → least visible:

```
LEVEL 1 — Always above the fold (primary content)
  ├── Header: brand + global search + account avatar
  ├── Filter bar: Projects|Assets tabs + filter chips + sort + New Project button
  └── Project/Asset grid (scrollable)

LEVEL 2 — Visible when generation results exist (between grid and hero)
  └── Results strip: thumbnail row + Edit in Workshop / Save per image

LEVEL 3 — Compact bar at bottom (always visible, small footprint)
  ├── Pipeline visualizer: Script → Mood Board → Prompts → Generate → Storyboard → Timeline → Publish
  └── Quick-create strip: [platforms] [prompt textarea] [style] [×count] [Generate] [expand ▲]

LEVEL 4 — Expanded creative tools (hidden by default, chevron reveals)
  ├── Negative prompt
  ├── Platform & dimensions selector (full)
  ├── Cinematic controls: composition / lighting / camera / aspect ratio
  ├── Character creator (name, appearance, wardrobe, pose, background)
  ├── Prompt templates (built-in + create new)
  └── Module catalog (Generate / Edit / 3D / Intelligence / Assembly / Ingest / Publish)
```

**Critical rule**: Levels 3 and 4 must never push Level 1 off-screen by default. The hero should default to compact mode.

### 8.2 Project Card Component (Full Spec)

```
┌─────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────┐ │
│ │               COVER THUMBNAIL                       │ │
│ │         (first generated image or video frame)      │ │
│ │                                                     │ │
│ │  ┌──────┐  ┌──────┐                                │ │
│ │  │🎬 Vid│  │📱Short│  ← type badges (top-left)     │ │
│ │  └──────┘  └──────┘                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│  "Summer Campaign 2026"                    [•••]  menu │
│                                                         │
│  🎬 16:9 YouTube  ·  📱 9:16 TikTok   ← platform badges│
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  🖼 12 images   🎵 3 audio   🎬 2 videos   📝 1 script │
│                                                         │
│  Source: 8 AI-gen · 3 imported · 1 remixed              │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ● Active  ·  Modified 3 hours ago          [Expand ▾] │
│                                                         │
│  ═══════════════════════════════════════════════════    │
│  EXPANDED VIEW (when open):                             │
│  ═══════════════════════════════════════════════════    │
│                                                         │
│  Recent Assets:                                         │
│  [🖼] [🖼] [🎬] [🖼] [🖼]  ← thumbnail strip            │
│                                                         │
│  Published:                                             │
│  ✅ TikTok · 3h ago · 1.2K views                       │
│  ✅ Instagram · 1d ago · 450 likes                     │
│  ⬜ YouTube · Scheduled                                 │
│                                                         │
│  Asset Status:                                          │
│  ● 10 Ready  ● 2 Generating  ● 1 Failed                │
│                                                         │
│  [Open in Workshop] [Duplicate] [Archive] [Delete]      │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Filter System (Faceted Search)

The filter engine supports multi-dimensional filtering:

```typescript
interface HomepageFilters {
  search: string;              // free-text search across name + tags
  types: ProjectType[];        // video, short, film, comic, etc.
  statuses: AssetStatus[];     // active, ready, archived, failed, generating
  platforms: Platform[];       // tiktok, instagram, youtube, twitter, linkedin
  sources: AssetSource[];      // ai-generated, imported, remixed, manual
  dateRange: { from?: Date; to?: Date };
  sortBy: 'recent' | 'alpha' | 'size' | 'published';
  sortOrder: 'asc' | 'desc';
}
```

**Filter UI**: Chips in the content bar showing active filters with × to remove. Dropdowns for adding new filter dimensions.

**Search behavior**: Case-insensitive substring match on `project.name`, `project.tags`, and `project.synopsis`. Uses `useDeferredValue` to avoid blocking on large datasets.

---

## 9. Workshop Specification

### 9.1 Canvas Asset Lifecycle

```
DRAG TO CANVAS  →  POSITION/RESIZE/ROTATE  →  GROUP  →  CONNECT  →  EXPORT
     │                    │                       │           │
     ▼                    ▼                       ▼           ▼
  Asset from        8-handle resize         Group contour   Colored lines
  Explorer          Rotation ±15°          Animated open    between dots
                    Z-order stack          /close
```

### 9.2 Connection Dots (Node Linking)

- Each asset has a **connection dot** centered at its bottom edge
- Dot: 8px circle, `--b-2` border, `--bg-3` fill, `z-index: above asset`
- **Hover**: dot scales to 12px, border becomes `--a-primary`, shows pulsing glow
- **Drag from dot**: creates a rubber-band line following cursor
- **Drop on another dot**: creates a connection edge (persistent colored line)
- **Connection line**: 2px solid, color = gradient blend of both connected nodes' media type colors
- **Click connection line**: shows "Group these assets?" tooltip with [Group] [Cancel]

### 9.3 Multiselect Rectangle

- Hold left mouse button on empty canvas → drag → translucent rectangle appears
- Rectangle style:
  ```css
  .canvasSelectionRectangle {
    border: 1px solid var(--selection-rect-border);
    background: var(--selection-rect);
    position: absolute;
    pointer-events: none;
  }
  ```
- Selection logic: any asset whose bounding box overlaps (partially or totally) the rectangle gets selected
- On mouse up: all selected assets show selection outlines
- A context toolbar appears above the selection with: [Group] [Duplicate] [Delete] [Align]

### 9.4 Group Component

When assets are grouped:
- **Thick external contour**: 4px solid border made of 4 stacked stripes:
  - Each stripe is the media type color of one member asset
  - Stripes are 1px each, cycling through member colors
  - If >4 members, colors repeat
- **Group transform**: move/resize/rotate the group → all children transform
- **Group open/close animation**:
  ```css
  .groupOpen {
    animation: groupExpand var(--dur-slow) var(--ease-out);
  }
  @keyframes groupExpand {
    from { gap: 0; padding: 0; }
    to   { gap: var(--sp-md); padding: var(--sp-sm); }
  }
  ```
- **Double-click group** → enters nested view (zooms to group bounds)
- **Escape** → exits nested view, returns to parent canvas

### 9.5 Layers Panel

Opened via FloatingToolbar "Layers" button. Shows a vertical list of ALL canvas assets:

```
┌─────────────────────────────────────┐
│  Layers                         [×] │
│ ─────────────────────────────────── │
│                                      │
│  ● summer-sunset.jpg          👁 🔒 │  ← blue left border (original)
│  ● ai-character.png           👁 🔒 │  ← green left border (imported)
│  ● text-overlay-1             👁 🔒 │  ← red left border (user added)
│  ○ hidden-layer               👁 🔒 │  ← grey (hidden), strikethrough
│                                      │
│  ┌ Group: Scene 1 ───────────────┐ │
│  │ ● bg-plate.jpg           👁 🔒 │ │
│  │ ● subject-cutout.png     👁 🔒 │ │
│  │ ● fx-glow.png            👁 🔒 │ │
│  └────────────────────────────────┘ │
│                                      │
│  [+ Add Layer]  [Group Selected]     │
└─────────────────────────────────────┘
```

Color-coded left borders:
- **Blue** (`--e-original` #3b82f6): Original elements from source image
- **Red** (`--e-user-added` #ef4444): Added by user (drawn, written, generated)
- **Grey** (`--e-hidden` #6b7280): Hidden or removed elements
- **Green** (`--e-imported` #22c55e): Imported from other assets

---

## 10. Explorer Panel (Left Bar) Specification

### 10.1 Layout Improvements

Current issues and fixes:
1. **Left margin too large** → reduce icon padding-left from 16px to 4px
2. **Empty folders not visually distinct** → grey out (opacity 0.35)
3. **Active folder highlighting missing** → orange (#f59e0b) for open+active
4. **Redundant file type icons** → unify icon set, remove duplicate representations

### 10.2 Explorer Item States

```css
/* Default file */
.explorerTreeItemRow {
  display: grid;
  grid-template-columns: 20px 1fr auto;  /* icon → name → badge */
  gap: 6px;
  align-items: center;
  height: 28px;
  padding-left: 4px;    /* ← REDUCED from 16px */
  padding-right: 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background-color var(--dur-fast);
}

/* Hover */
.explorerTreeItemRow:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* Selected (closed folder with assets) */
.explorerTreeItemRow[data-selected="true"] {
  background: var(--selection-bg);
}

/* Empty folder */
.explorerTreeItemRow[data-empty="true"] {
  opacity: 0.35;
}
.explorerTreeItemRow[data-empty="true"] .explorerTreeItemName {
  color: var(--fg-2);
  font-style: italic;
}
.explorerTreeItemRow[data-empty="true"]::after {
  content: "Empty";
  font-size: var(--font-2xs);
  color: var(--fg-3);
}

/* Active open folder (with assets inside) */
.explorerTreeItemRow[data-active-folder="true"] .explorerTreeItemIcon {
  color: var(--a-tertiary);  /* #f59e0b orange */
}
.explorerTreeItemRow[data-active-folder="true"] .explorerTreeItemName {
  color: var(--fg-0);
}
.explorerTreeItemRow[data-active-folder="true"] {
  background: rgba(245, 158, 11, 0.08);  /* subtle amber wash */
}

/* Drop target */
.explorerTreeItemRow[data-drop-target="true"] {
  border: 2px dashed var(--a-secondary);
  background: rgba(124, 58, 237, 0.1);
}
```

### 10.3 Filter System (Explorer)

**Fix**: The current filter doesn't properly match files by substring. Use:
```typescript
const matchesFilter = (node: FileNode, query: string): boolean => {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return node.name.toLowerCase().includes(q);
};
```

**New**: Add filter dropdown for type and sort:
```
[🔍 Search files...]  [Type ▾]  [Sort: Name ▾]
                       ☐ Images
                       ☐ Videos
                       ☐ Audio
                       ☐ Text
                       ☐ 3D Models
```

---

## 11. Canvas & Grouping Specification

### 11.1 Canvas Item States

| State | Visual |
|-------|--------|
| Default | Slight shadow, `--b-1` border |
| Hover | Border becomes `--a-primary` at 50% opacity |
| Selected | `--selection-border` border, 8 resize handles visible |
| Multi-selected | Same as selected for all items in set |
| Dragging | `opacity: 0.85`, `scale: 1.02`, `--shadow-lg` |
| Locked | Small lock badge top-right, no pointer events |
| Hidden | `opacity: 0.2`, no pointer events |
| Drop target | Dashed `--a-secondary` border |

### 11.2 Resize Handles

8 handles: NW, N, NE, E, SE, S, SW, W. Each is a 8px × 8px square, white with `--a-primary` border, positioned at the respective corner/edge.

### 11.3 Group Contour

```css
.canvasGroupContour {
  position: absolute;
  border: 4px solid transparent;
  border-image: repeating-linear-gradient(
    90deg,
    var(--t-image) 0px,
    var(--t-image) 1px,
    var(--t-video) 1px,
    var(--t-video) 2px,
    var(--t-audio) 2px,
    var(--t-audio) 3px,
    var(--t-text) 3px,
    var(--t-text) 4px
  ) 4;
  border-radius: var(--r-md);
  pointer-events: none;
  z-index: 1000;
}
```

---

## 12. Timeline Specification

### 12.1 Track Types & Colors

| Track Type | Color | Height | Icon |
|-----------|-------|--------|------|
| Video Primary | `--t-video` (#8b5cf6) | 52px | 🎬 |
| Video Overlay | `--t-video` at 60% | 40px | 🎬 |
| Audio Music | `--t-audio` (#22c55e) | 36px | 🎵 |
| Audio Voice | `--t-audio` at 70% | 36px | 🎤 |
| SFX | `--t-audio` at 50% | 30px | 🔊 |
| Captions | `--t-text` (#60a5fa) | 28px | 📝 |
| Effects | `--a-tertiary` (#f59e0b) | 30px | 🎨 |
| Prompts | `--t-prompt` (#c084fc) | 30px | 💬 |
| Groups | `--a-secondary` (#7c3aed) | 40px | 📦 |

### 12.2 Clip Styling

```css
.timelineClipVideo {
  background: var(--t-video);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-sm);
  height: calc(100% - 8px);
  margin: 4px 0;
}

.timelineClipSelected {
  border-color: var(--a-primary);
  box-shadow: 0 0 0 1px var(--a-primary);
}

.timelineClipTrimHandle {
  width: 6px;
  cursor: col-resize;
  background: rgba(255, 255, 255, 0.15);
  border-radius: var(--r-xs);
}

.timelinePlayhead {
  position: absolute;
  width: 2px;
  background: var(--c-error);  /* red playhead */
  top: 0;
  bottom: 0;
  z-index: 100;
}

.timelinePlayheadHead {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid var(--c-error);
  position: absolute;
  top: 0;
  left: -5px;
}

.timelineTransition {
  background: linear-gradient(90deg, transparent, var(--a-primary-alpha), transparent);
  border-left: 1px solid var(--a-primary);
  border-right: 1px solid var(--a-primary);
}
```

---

## 13. Settings Modal Specification

### 13.1 Tabs

| Tab | Icon | Content |
|-----|------|---------|
| Account | UserRound | Profile, session devices, role |
| API Keys | Key | Multi-provider key inputs with validation |
| Appearance | Palette | Parametric knob sliders, font size, compact mode |
| Shortcuts | Keyboard | Full shortcut reference table |
| Publishing | Share2 | Connected platform accounts |
| Usage | BarChart3 | Session stats, storage usage, telemetry toggle |
| Help | HelpCircle | Keyboard shortcuts, documentation links |
| About | Info | Version, build ID, client signature |

### 13.2 Appearance Knobs (Slider UI)

Each parametric knob is a range slider from 0 to 2 with labels:

```
Density:     ○────●────○   Airy ← Balanced → Compact
             0     1     2

Roundness:   ○────●────○   Sharp ← Rounded → Pill
             0     1     2

Glow:        ○────●────○   Flat ← Subtle → Vivid
             0     1     2

Contrast:    ○────●────○   Soft ← Normal → Crisp
             0     1     2

Speed:       ○────●────○   Instant ← Default → Slow
             0     1     2
```

Each knob change applies instantly via CSS variable update on `:root`.

---

## 14. Filter System Specification

### 14.1 Homepage Filters

```
┌──────────────────────────────────────────────────────────┐
│ FILTER BAR                                               │
│                                                           │
│ [All Types ▾]  [All Status ▾]  [All Platforms ▾]         │
│ [All Sources ▾]  [Any Date ▾]                            │
│                                                           │
│ Sort: [Most Recent ▾]  ↑↓                                │
│                                                           │
│ Active filters: [🎬 Video ×] [✅ Ready ×] [Clear All]     │
└──────────────────────────────────────────────────────────┘
```

### 14.2 Filter Logic

```typescript
function filterProjects(projects: Project[], filters: HomepageFilters): Project[] {
  return projects
    .filter(p => {
      // Text search
      if (filters.search && !matchesText(p, filters.search)) return false;
      // Type filter
      if (filters.types.length && !filters.types.includes(p.type)) return false;
      // Status filter
      if (filters.statuses.length && !filters.statuses.includes(p.status)) return false;
      // Platform filter
      if (filters.platforms.length && !p.platforms.some(pl => filters.platforms.includes(pl))) return false;
      // Source filter
      if (filters.sources.length && !p.sources.some(s => filters.sources.includes(s))) return false;
      // Date range
      if (filters.dateRange.from && p.modifiedAt < filters.dateRange.from) return false;
      if (filters.dateRange.to && p.modifiedAt > filters.dateRange.to) return false;
      return true;
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'alpha': return a.name.localeCompare(b.name) * (filters.sortOrder === 'asc' ? 1 : -1);
        case 'size': return (b.assetCount - a.assetCount) * (filters.sortOrder === 'asc' ? -1 : 1);
        case 'published': return (b.publishedCount - a.publishedCount) * (filters.sortOrder === 'asc' ? -1 : 1);
        case 'recent':
        default: return (b.modifiedAt - a.modifiedAt) * (filters.sortOrder === 'asc' ? -1 : 1);
      }
    });
}
```

---

## 15. HTML Primitives & Baseline Styling

### 15.1 Button

```css
button {
  appearance: none;
  border: 1px solid var(--b-1);
  background: var(--bg-2);
  color: var(--fg-0);
  border-radius: var(--r-sm);
  height: 32px;
  padding-inline: var(--sp-md);
  font: 500 13px/1 var(--font-ui);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-xs);
  transition: background-color var(--dur-normal) var(--ease-out),
              border-color var(--dur-normal) var(--ease-out),
              box-shadow var(--dur-normal) var(--ease-out),
              transform var(--dur-fast) var(--ease-in);
}

button:hover { background: var(--bg-3); border-color: var(--b-2); }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
button:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

/* Primary variant */
button.buttonPrimary {
  background: var(--a-gradient);
  border: none;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 212, 170, 0.25);
}
button.buttonPrimary:hover { opacity: 0.9; transform: translateY(-1px); }
button.buttonPrimary:active { transform: translateY(0); }
```

### 15.2 Input / Textarea

```css
input, textarea {
  appearance: none;
  border: 1px solid var(--b-1);
  background: var(--bg-1);
  color: var(--fg-0);
  border-radius: var(--r-sm);
  padding: var(--sp-xs) var(--sp-sm);
  font: 500 13px/1.2 var(--font-ui);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}
input::placeholder, textarea::placeholder { color: var(--fg-2); }
input:focus-visible, textarea:focus-visible {
  outline: none;
  border-color: var(--focus-ring);
  box-shadow: 0 0 0 2px var(--a-primary-a);
}
```

### 15.3 Select

```css
select {
  appearance: none;
  border: 1px solid var(--b-1);
  background: var(--bg-2);
  color: var(--fg-0);
  border-radius: var(--r-sm);
  height: 32px;
  padding-inline: var(--sp-sm);
  padding-right: 28px;
  font: 500 13px var(--font-ui);
  background-image: url("data:image/svg+xml,..."); /* chevron */
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px;
  cursor: pointer;
}
```

### 15.4 Kbd (Keyboard Shortcut Hint)

```css
kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid var(--b-1);
  background: var(--bg-3);
  border-radius: 4px;
  color: var(--fg-1);
  line-height: 1.4;
}
```

### 15.5 Code / Pre

```css
code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 1px 4px;
  background: var(--bg-3);
  border-radius: var(--r-xs);
  color: var(--a-primary);
}

pre {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  background: var(--bg-2);
  border: 1px solid var(--b-1);
  border-radius: var(--r-md);
  padding: var(--sp-md);
  overflow-x: auto;
  color: var(--fg-1);
}
```

---

## 16. Accessibility Requirements

### 16.1 WCAG Compliance

| Requirement | Level | Status |
|------------|-------|--------|
| Color contrast ≥ 4.5:1 (body text) | AA | ⚠️ Need audit |
| Color contrast ≥ 3:1 (UI chrome, large text) | AA | ⚠️ Need audit |
| Keyboard navigation (all controls) | AA | ✅ |
| Visible focus indicators | AA | ✅ |
| Focus trapping in modals | AA | ✅ |
| ARIA roles for tree, grid, menu, dialog | AA | ⚠️ Partial |
| `aria-live` regions for status updates | AA | ⚠️ Partial |
| `prefers-reduced-motion` support | AA | ❌ |
| Screen reader announcements for job status | AA | ⚠️ Partial |
| Minimum touch target 44×44px | AA | ✅ (touch mode) |

### 16.2 Focus Management

- Modal open: trap focus inside, focus first focusable element
- Modal close: return focus to trigger element
- Panel toggle: if panel opens, focus its search bar
- Tree navigation: roving tabindex, arrow keys, typeahead
- Canvas: Escape deselects all

---

## 17. Performance Requirements

| Metric | Target | Current |
|--------|--------|---------|
| First paint | < 500ms | ✅ localStorage hydration is instant |
| Canvas FPS (100 items) | 60fps | ✅ DOM-based, adequate |
| Canvas FPS (1000+ items) | 30fps+ | ❌ Needs WebGL |
| Explorer scroll (1000 files) | 30fps+ | ❌ Needs virtualization |
| Image load (thumbnail) | < 200ms | ⚠️ Needs lazy loading |
| Generation placeholder | < 50ms | ✅ SVG placeholder |
| Filter response (1000 items) | < 100ms | ⚠️ Needs deferred value |
| Panel open animation | < 200ms | ✅ CSS transition |

### 17.1 Virtualization Strategy

```
Explorer:      react-window FixedSizeList (32px row height)
Timeline:      Custom canvas-based renderer (no DOM per clip)
Asset Grid:    react-window VariableSizeGrid (thumbnails)
Inspector:     Native DOM (small, no virtualization needed)
Canvas:        DOM for <500 items, WebGL for 500+ items
```

---

## 18. Naming Conventions

### 18.1 CSS Class Naming (Mandatory)

Pattern: `<component><goal><location><state>`

```
connectionBannerStatusRootAtStartup
dashboardLayoutHeaderPrimaryAtTop
explorerTreeItemRowIdle
explorerTreeItemRowActiveFolder
canvasSelectionRectangleActive
floatingToolbarButtonPromptIdle
```

### 18.2 HTML ID Naming (Mandatory)

Pattern: `<component>-<goal>-<location>-<state>`

```
connection-banner-status-at-startup
dashboard-layout-header-primary-at-top
app-shell-workspace-region
explorer-tree-item-row
canvas-selection-rectangle
floating-toolbar-group-selection
```

### 18.3 Forbidden Patterns

- ❌ Generic names: `.container`, `.header`, `.row`, `.item`, `.active`
- ❌ Random suffixes: `.sidebar_1`, `.panel_2`
- ❌ Color-based names: `.blue-border`, `.red-text` — use semantic tokens
- ❌ Abbreviations: `.btn`, `.txt`, `.img` — use full words

---

## 19. Skeleton Screens & Loading States

### 19.1 Skeleton Design Principles

A skeleton screen shows the *shape* of content before it loads, reducing perceived latency and preventing layout shift. Rules:
1. Match the skeleton geometry exactly to the loaded content (same height, same column count)
2. Use CSS animation `shimmer` — a repeating gradient that moves left-to-right
3. Never mix real content and skeletons in the same grid (show ALL skeletons, then ALL real content)
4. Skeleton duration: show if content hasn't loaded in >150ms (avoid flash for fast connections)

```css
/* Skeleton shimmer animation */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeletonBase {
  background: linear-gradient(
    90deg,
    var(--bg-3) 25%,
    var(--bg-4) 50%,
    var(--bg-3) 75%
  );
  background-size: 200% 100%;
  animation: shimmer calc(1200ms * var(--param-speed)) ease-in-out infinite;
  border-radius: var(--r-sm);
}

/* Respect reduced-motion: freeze the animation */
@media (prefers-reduced-motion: reduce) {
  .skeletonBase { animation: none; background: var(--bg-3); }
}
```

### 19.2 Skeleton Component Catalog

| Component | When Used | Geometry |
|-----------|----------|----------|
| `SkeletonProjectCard` | Project grid loading | 200px tall, full card width, cover + 2 text lines + badge row |
| `SkeletonAssetCard` | Cloud asset grid loading | 80×80 square + 1 text line |
| `SkeletonExplorerRow` | Explorer tree loading | 28px height, icon + name line |
| `SkeletonGeneratedImage` | Generation in-progress | Aspect-ratio box (matches requested dims) with pulsing Sparkles icon |
| `SkeletonInspectorSection` | Inspector tab loading | Section header + 3 property rows |
| `SkeletonTimelineClip` | Timeline loading | Clip height for track type |

```tsx
// components/ui/Skeleton.tsx
export const SkeletonProjectCard = () => (
  <div className={styles.skeletonCard}>
    <div className={`${styles.skeletonBase} ${styles.skeletonCover}`} />
    <div className={styles.skeletonBody}>
      <div className={`${styles.skeletonBase} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonSubtitle}`} />
      <div className={styles.skeletonBadges}>
        <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
        <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
      </div>
    </div>
  </div>
);

export const SkeletonExplorerRow = ({ depth = 0 }: { depth?: number }) => (
  <div className={styles.skeletonRow} style={{ paddingLeft: `${depth * 12 + 4}px` }}>
    <div className={`${styles.skeletonBase} ${styles.skeletonIcon}`} />
    <div className={`${styles.skeletonBase} ${styles.skeletonName}`} />
  </div>
);

export const SkeletonGeneratedImage = ({ width, height }: { width: number; height: number }) => (
  <div className={styles.skeletonGenImage} style={{ aspectRatio: `${width}/${height}` }}>
    <div className={styles.skeletonBase} style={{ inset: 0, position: 'absolute', borderRadius: 'var(--r-md)' }} />
    <Sparkles size={24} className={styles.skeletonSpinner} />
  </div>
);
```

---

## 20. Empty State Standardization

### 20.1 Empty State Anatomy

Every panel that can be empty must show a consistent empty state with:
1. **Icon** — 28-32px, `opacity: 0.3`, relevant to the panel's purpose
2. **Title** — `--font-sm`, `--fg-1`, describes what's missing
3. **Body** — `--font-xs`, `--fg-2`, contextual hint on how to populate
4. **Primary CTA** — (optional) action button to get started

```tsx
// components/ui/EmptyState.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action }) => (
  <div id="empty-state-centered-panel" className={styles.emptyState}>
    <div className={styles.emptyStateIcon}>{icon}</div>
    <p className={styles.emptyStateTitle}>{title}</p>
    {body && <p className={styles.emptyStateBody}>{body}</p>}
    {action && (
      <button className={styles.emptyStateAction} onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);
```

### 20.2 Empty State Catalog (Per Panel)

| Panel | Icon | Title | Body | CTA |
|-------|------|-------|------|-----|
| Explorer — no files | `Upload` | "No files yet" | "Drag any file here or click Import" | "Import Files" |
| Explorer — empty folder | `Folder` | "This folder is empty" | "Drag files here to organize them" | — |
| Canvas — no items | `Layers` | "Your canvas is empty" | "Drag assets from Explorer or generate images from the prompt panel" | "Generate Image" |
| Timeline — no clips | `Film` | "Add media to the timeline" | "Drag generated images and videos here to sequence them" | — |
| Inspector — nothing selected | `Palette` | "Select an item to inspect it" | "Click any item on the canvas to see its properties and generation metadata" | — |
| Cloud — not signed in | `Cloud` | "Sign in to sync assets" | "Your generated images are saved to the cloud and available on all devices" | "Sign In" |
| Cloud — no assets | `Sparkles` | "No cloud assets yet" | "Generated images appear here automatically" | — |
| Projects grid — no projects | `FolderOpen` | "No projects yet" | "Create your first project to start building your creative pipeline" | "New Project" |
| Results strip — no results | — | *(hidden — only shows when results exist)* | — | — |
| Character DB — no characters | `Users` | "No characters defined" | "Add character profiles to maintain visual consistency across generated images" | "Add Character" |

### 20.3 Empty State CSS

```css
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-sm);
  padding: var(--sp-2xl) var(--sp-lg);
  text-align: center;
  pointer-events: none;  /* allow clicks to pass through to drop target */
}

.emptyState > button { pointer-events: all; }

.emptyStateIcon { color: var(--fg-2); opacity: 0.3; }
.emptyStateTitle { font: 500 var(--font-sm)/1.4 var(--font-ui); color: var(--fg-1); margin: 0; }
.emptyStateBody  { font: 400 var(--font-xs)/1.5 var(--font-ui); color: var(--fg-2); margin: 0; max-width: 200px; }

.emptyStateAction {
  margin-top: var(--sp-xs);
  padding: var(--sp-xs) var(--sp-sm);
  background: var(--bg-3);
  border: 1px solid var(--b-1);
  border-radius: var(--r-sm);
  color: var(--fg-0);
  font: 500 var(--font-xs)/1 var(--font-ui);
  cursor: pointer;
  pointer-events: all;
}
.emptyStateAction:hover { background: var(--bg-4); border-color: var(--b-2); }
```

---

## 21. Color Script Visualization

### 21.1 Concept

A Color Script is the cinematographer's tool for planning the emotional palette journey of a film. Pixar's Lee Unkrich popularized the concept with *Toy Story 3* — the 80-minute arc was planned as a 3-foot scroll of color swatches. In ArsTechnicAI, the Color Script module provides:

1. **Timeline view**: Horizontal strip of scene swatches running in story order
2. **Arc graph**: Showing how warmth/coolness, saturation, and value change over time
3. **Feed-forward**: Swatch colors lock into generation prompts automatically

### 21.2 Color Script Data Model

```typescript
interface ColorScript {
  id: string;
  projectId: string;
  scenes: ColorScriptScene[];
}

interface ColorScriptScene {
  sceneId: string;
  sceneLabel: string;       // "ACT 1: OPENING", "MIDPOINT CRISIS", etc.
  orderIndex: number;
  
  palette: {
    dominant: string;       // hex — the primary color defining this scene
    secondary: string;      // hex
    accent: string;         // hex
    swatches: string[];     // 3–7 hex colors in the scene's palette
  };
  
  mood: {
    temperature: 'very cold' | 'cold' | 'neutral' | 'warm' | 'very warm';
    saturation: 'desaturated' | 'muted' | 'balanced' | 'vivid' | 'hyper-vivid';
    value: 'dark' | 'mid-dark' | 'mid' | 'mid-bright' | 'bright';
    emotion: string;        // "dread", "hope", "confusion", "triumph"
  };
  
  // Auto-appended to generation prompts for scenes in this script block
  promptFragment: string;   // "dim cool blue-grey palette, desaturated, overcast mood"
  
  generatedAt?: number;
  referenceImageId?: string; // Optional: a reference image that captures this palette
}
```

### 21.3 Color Script UI

```
Color Script — Summer Campaign 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[OPENING]     [ACT 1]        [MIDPOINT]    [DARK NIGHT]  [CLIMAX]    [RESOLUTION]
  ████           ████           ████           ████         ████          ████
  ████  → → →   ████  → → →   ████  → → →   ████  → → → ████  → → →  ████
  ████           ████           ████           ████         ████          ████

 Cool Blue     Warm Gold      Neutral Grey  Near Black    Deep Red      Warm White
 (hope, dawn)  (adventure)    (uncertainty)  (despair)    (intensity)   (resolution)

Warmth arc:   ──────/──────────\──────────────────────────/──────────────────
Saturation:   ─────────/─────────────────────────────────────────────────────
```

### 21.4 Color Arc Metrics

For each scene transition, compute and display:
- **ΔTemperature**: How many degrees Kelvin the scene shifts (cold → warm = positive)
- **ΔSaturation**: How much more/less vivid the palette becomes
- **ΔValue**: Lightness shift (dark to bright, or bright to dark)
- **Harmony Type**: Complementary, Analogous, Triadic, Split-Complementary, Monochromatic

---

## 22. First-Run Onboarding Specification

### 22.1 Trigger Conditions

Show the onboarding overlay when ALL of the following are true:
- `userStore.sessionCount === 1` (first session ever)
- `fileStore.rootNodes.length === 0` (no files imported)
- `canvasStore.items.length === 0` (canvas is empty)
- `generationStore.generatedImages.length === 0` (nothing generated)

### 22.2 Overlay Design

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Welcome to Ars TechnicAI                                       │
│   ────────────────────────────────────────────────────────       │
│                                                                  │
│   ● Step 1 of 3                                                  │
│                                                                  │
│   [📥]                                                           │
│   Import or Generate                                             │
│   Drag any image, video, or audio file into the Explorer,        │
│   or type a prompt below to generate your first image.           │
│                                                                  │
│            [Skip tour]              [Next →]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Step 2: Place on Canvas
  Drag assets from Explorer onto the infinite canvas.
  Connect them with arrows to define your creative pipeline.

Step 3: Export to Social
  Use the Format Profiles to export in 9:16 for TikTok,
  1:1 for Instagram, or 16:9 for YouTube.
  One click to auto-post when you're ready.
```

### 22.3 Completion Conditions

The onboarding is complete (permanently dismissed) when:
- User clicks "Skip tour", OR
- User completes Step 3, OR
- User has successfully generated at least one image

Dismissal is stored in: `localStorage['ars:onboarding-complete'] = 'true'`

---

## 23. Error Boundary Specification

### 23.1 Panel Error Boundary

Each major panel wraps in a `PanelErrorBoundary` class component:

```tsx
// components/ui/PanelErrorBoundary.tsx
interface PanelErrorBoundaryProps {
  panelName: string;
  children: React.ReactNode;
}

interface State { hasError: boolean; error?: Error; }

export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Emit to event bus
    bus.emit('error:boundary', { panel: this.props.panelName, error: error.message });
    // Log to error store
    useErrorStore.getState().addError({
      code: 'PANEL_CRASH',
      message: error.message,
      context: { panel: this.props.panelName, stack: info.componentStack ?? '' },
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div id={`panel-error-boundary-${this.props.panelName}`} className={styles.panelError}>
          <AlertTriangle size={24} />
          <p className={styles.panelErrorTitle}>{this.props.panelName} encountered an error</p>
          <p className={styles.panelErrorDetail}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Reload {this.props.panelName}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 23.2 Error Boundary Placement

```tsx
// AppShell.tsx wrapping each panel:
<PanelErrorBoundary panelName="Explorer">
  <ExplorerPanel ... />
</PanelErrorBoundary>

<PanelErrorBoundary panelName="Canvas">
  <Canvas ... />
</PanelErrorBoundary>

<PanelErrorBoundary panelName="Inspector">
  <InspectorPanel ... />
</PanelErrorBoundary>

<PanelErrorBoundary panelName="Timeline">
  <Timeline ... />
</PanelErrorBoundary>

<PanelErrorBoundary panelName="NodeGraph">
  <NodeGraph ... />
</PanelErrorBoundary>
```

---

## 24. Implementation Status Audit (Updated)

### 19.1 Design Tokens

| Token System | Spec | Implementation | Notes |
|-------------|------|----------------|-------|
| Core palette (bg/fg/border hierarchies) | ✅ | ✅ Complete | 5 bg levels, 4 fg levels, 3 border levels |
| Semantic status colors | ✅ | ✅ Complete | success/warning/error/info |
| Media type colors | ✅ | ✅ Complete | image/video/audio/text/folder |
| Element origin colors | ✅ | ⬜ Not implemented | blue/red/grey/green for element list |
| Parametric knobs | ✅ | ✅ Complete | density/roundness/glow/contrast/speed |
| Cascading computed tokens | ✅ | ✅ Complete | calc() derivatives for spacing, radii, shadows |

### 19.2 Components

| Component | Design Spec | Implementation | Gaps |
|-----------|------------|----------------|------|
| Button | ✅ Complete | ✅ Complete | All variants |
| Input/Textarea | ✅ Complete | ✅ Complete | — |
| Select | ✅ Complete | ⚠️ Native only | Need custom combobox for large lists |
| TopBar | ✅ Complete | ✅ Complete | Mode switcher, project name, connection status |
| Explorer Panel | ✅ Complete | ⚠️ Partial | Needs: reduced left margin, empty-folder grey, active-folder orange, virtualization |
| Canvas | ✅ Complete | ⚠️ Partial | Needs: connection dots, multiselect rectangle, group contour, WebGL for scale |
| FloatingToolbar | ✅ Complete | ✅ Complete | Frosted glass, tool groups, dividers, tooltips |
| Inspector | ✅ Complete | ✅ Complete | Generate form, properties, history |
| Timeline | ✅ Complete | ⚠️ UI only | Needs: playback engine, transitions, multi-track rendering |
| Settings Modal | ✅ Complete | ✅ Complete | 8 tabs, account through about |
| Connection Banner | ✅ Complete | ✅ Complete | Health status overlay |
| Layers Panel | ⬜ Not implemented | ❌ | Needs full build |
| Connection Dots | ⬜ Not implemented | ❌ | Needs full build |
| Multiselect Rectangle | ⬜ Not implemented | ❌ | Needs full build |
| Group Contour | ⬜ Not implemented | ❌ | Needs full build |
| Homepage Filters | ⬜ Partial | ⚠️ Basic search only | Needs faceted filter UI |
| Homepage Project Card | ⬜ Partial | ⚠️ Basic grid | Needs expanded card with media badges and status |

---

*This document should be reviewed and updated with every major UI change. The parametric knob system ensures visual consistency across every future component — always consume tokens, never hardcode hex values.*
