# Ars TechnicAI — Design System & UI Engineering Standards

This document defines **UI/UX rules**, **interaction patterns**, and **CSS specifications** for Ars TechnicAI (Deno 2 + Next.js + TypeScript). It is written as a **desktop-grade product spec** for **Windows/macOS + browser**, optimized for **keyboard + mouse** input today.

> **Implementation Status**: Most design specs are implemented. See `ARCHITECTURE.md` for UX analysis and recommendations.

Also see: `Structure.md` (module boundaries, naming, file layout).

---

## Product design goals (non-negotiable)

- **IDE-grade ergonomics**: consistent panels, predictable shortcuts, dense information layout without visual noise.
- **Local-first mental model**: assets feel like “files you own”, even if some are generated or remote-backed.
- **Provenance by default**: every generated artifact can show “how it was made” (prompt, references, parameters, model/provider, seed, time).
- **Fast feedback loop**: async jobs with progressive disclosure, streaming logs/progress, cancellation, retry.
- **Safety & trust**: transparent costs, rate limits, content policy boundaries, explicit export/share steps.

---

## App shell layout & regions

### Regions

- **Top Bar** (global): mode switcher, project controls, command palette, settings, user/account.
- **Left Panel**: Explorer (tree + search/filter + tags + collections).
- **Center Workspace**: Infinite Canvas (node graph) + overlays (minimap, zoom controls, rulers).
- **Right Panel**: Inspector (properties/parameters/metadata/history).
- **Bottom Panel (inside workspace)**: Timeline (tracks/clips/playhead) + transport controls.

### Layout implementation constraints (CSS)

- Use **CSS Grid** for the shell and **flex** inside components.
- Avoid layout thrash: prefer `transform` for animation, avoid animating `width/height/top/left`.
- Use **logical properties** where possible (`padding-inline`, `border-inline`, etc.) for future i18n.

Recommended grid:

```css
/* App shell grid — desktop */
.appShell {
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr;
  grid-template-columns: var(--leftpanel-w) 1fr var(--rightpanel-w);
  grid-template-areas:
    "topbar topbar topbar"
    "left   main   right";
  height: 100dvh;
  overflow: hidden;
}

.topbar { grid-area: topbar; }
.leftPanel { grid-area: left; }
.rightPanel { grid-area: right; }
.mainWorkspace { grid-area: main; position: relative; overflow: hidden; }
```

Timeline sits **within** `.mainWorkspace` as a docked region (absolute inset or nested grid).

---

## Design tokens (CSS variables)

Tokens must be defined in `styles/globals.css` and consumed by CSS Modules.

### Color model

- Use a **dark theme default** with **OKLCH/OKLab thinking** for perceptual steps (even if stored as hex for now).
- Background elevation is expressed as stepped surfaces: `--bg-0` … `--bg-5`.
- Functional colors are semantic: `--c-success`, `--c-warning`, `--c-danger`, `--c-info`.
- Selection is separate from accent: `--selection-*`.

Example token spec:

```css
:root {
  /* Surfaces */
  --bg-0: #07070a; /* app base */
  --bg-1: #0c0c10; /* main */
  --bg-2: #13131a; /* panels */
  --bg-3: #1a1a24; /* hover/elevated */
  --bg-4: #22222e; /* overlays */

  /* Text */
  --fg-0: #fafafc;
  --fg-1: #a8a8b3;
  --fg-2: #6b6b78;
  --fg-3: #3d3d4a;

  /* Borders */
  --b-0: #1e1e28;
  --b-1: #2a2a38;
  --b-2: #3a3a4a;
  --focus-ring: #5c7cfa;

  /* Accents */
  --a-0: #8b5cf6; /* primary */
  --a-1: #22d3ee; /* secondary */
  --a-2: #f59e0b; /* tertiary */

  /* States */
  --c-success: #22c55e;
  --c-warning: #f97316;
  --c-danger: #ef4444;
  --c-info: #3b82f6;

  /* Selection */
  --selection-bg: rgba(139, 92, 246, 0.15);
  --selection-border: rgba(139, 92, 246, 0.5);

  /* Radii */
  --r-xs: 2px;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;

  /* Spacing (4px baseline) */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-6: 24px;
  --s-8: 32px;

  /* Typography */
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Arial;
  --font-display: ui-serif, Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --dur-1: 120ms;
  --dur-2: 180ms;
  --dur-3: 240ms;

  /* Sizes */
  --topbar-h: 44px;
  --leftpanel-w: 280px;
  --rightpanel-w: 340px;
  --timeline-h: 240px;
}
```

### Shadows & elevation

- Use layered shadows with consistent alpha.
- For “glass” overlays, use `backdrop-filter` with a non-blurry fallback.

```css
:root {
  --shadow-1: 0 1px 2px rgba(0,0,0,.35), 0 0 1px rgba(0,0,0,.2);
  --shadow-2: 0 4px 12px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.25);
  --glass: rgba(34, 34, 46, 0.72);
  --glass-border: rgba(58, 58, 74, 0.55);
}
```

---

## Typography & density

- Default UI font is **neutral, highly legible**, with tabular numerals for timecode.
- Use **compact vertical rhythm** for pro apps:
  - Table row: 28–32px
  - List item: 28–34px
  - Button: 32–36px
  - Input: 32–36px
  - Slider height: 24px + thumb 12–14px

Text sizes (desktop baseline):

- **Title**: 18–20px, 600
- **Section header**: 13px, 600, uppercase optional (tracking)
- **Body**: 13–14px, 400–500
- **Meta/caption**: 11–12px, 400
- **Timecode/mono**: 12–13px, tabular-nums

CSS requirements:

- Use `font-variant-numeric: tabular-nums;` for timecode, frame counts, sizes.
- Never rely on color alone to convey meaning; use iconography/badges as secondary encoding.

---

## Motion & interaction states

### Motion principles

- **Motion is functional**: communicates state changes (open/close, selection, drag).
- Respect `prefers-reduced-motion: reduce` by disabling non-essential animations.

### Universal interaction states (all interactive elements)

Every interactive component must define:

- **Default**
- **Hover**
- **Active/Pressed**
- **Focus-visible**
- **Disabled**
- **Selected/On**
- **Dragging / Drop target** (when applicable)

Token-driven defaults:

```css
.interactive {
  transition:
    background-color var(--dur-2) var(--ease-out),
    border-color var(--dur-2) var(--ease-out),
    box-shadow var(--dur-2) var(--ease-out),
    transform var(--dur-1) var(--ease-in);
}
.interactive:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.interactive:disabled,
.interactive[aria-disabled="true"] {
  opacity: .5;
  cursor: not-allowed;
}
```

---

## HTML primitives & baseline styling (exhaustive)

These specs apply to the semantic HTML tags used throughout the app. Prefer semantic tags first; add ARIA only when semantics are insufficient.

### `body`, `main`, `header`, `nav`, `aside`, `section`, `footer`

- **Layout**: the app uses an **application shell** pattern; `main` should represent the central workspace.
- **Overflow**: avoid `body` scrolling for desktop shells; manage scrolling inside panels.
- **Background**: body uses `--bg-1` and optional subtle grid/mesh overlay.

### `a` (links)

- **Default**: inherits text color; underline on hover; avoid hard-to-see low-contrast links.
- **Focus**: `:focus-visible` must show focus ring.
- **External**: use icon or `aria-label` to indicate external when needed.

### `button`

- **Reset**: remove default UA styles; keep accessible semantics.
- **Hit target**: minimum 32px height (36px in comfortable density).
- **States**:
  - hover: subtle surface lift (`--bg-3`) and border shift
  - active: `transform: translateY(1px)` or inner-shadow “pressed”
  - focus-visible: `outline` ring via `--focus-ring`
  - disabled: reduce opacity and remove hover transforms

Example baseline:

```css
button {
  appearance: none;
  border: 1px solid var(--b-1);
  background: var(--bg-2);
  color: var(--fg-0);
  border-radius: var(--r-sm);
  height: 32px;
  padding-inline: 12px;
  font: 500 13px/1 var(--font-ui);
  cursor: pointer;
}
button:hover { background: var(--bg-3); }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
```

### `input`, `textarea`

- **Baseline**:
  - height: 32–36px (`textarea` auto)
  - background: `--bg-1` or `--bg-2` depending on panel density
  - border: `1px solid --b-1`; focus border may shift to `--focus-ring`
- **Text**: use `--fg-0` and placeholder `--fg-2`
- **Validation**:
  - invalid: border `--c-danger`
  - warning: border `--c-warning`

```css
input, textarea {
  appearance: none;
  border: 1px solid var(--b-1);
  background: var(--bg-1);
  color: var(--fg-0);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font: 500 13px/1.2 var(--font-ui);
}
input::placeholder, textarea::placeholder { color: var(--fg-2); }
input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

### `select`

- Prefer a custom combobox for large lists (models/presets). Use native `select` only for small lists.
- Must be keyboard accessible (native is best; custom must replicate).

### `label`

- Labels must be clickable and connected via `for`/`id` where possible.
- Use concise labels; show units as suffix.

### `kbd`, `code`, `pre`

- `kbd`: used for shortcut hints in menus and tooltips.
- `code/pre`: used for logs, provider request previews, prompt templates.

```css
kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid var(--b-1);
  background: var(--bg-2);
  border-radius: 6px;
  color: var(--fg-1);
}
```

### `ul`, `ol`, `li`

- Lists used for menus and property lists should use `role="menu"` or `role="listbox"` only when appropriate.
- Avoid nested scrolling lists without clear focus management.

### `table`

- Tables are used for dense metadata, job history, and batch operations.
- Requirements:
  - sticky header for long lists
  - row hover highlight
  - keyboard navigation (optional in MVP) with focusable row actions

### `dialog` (or modal root)

- Use modal dialogs for destructive confirmations, provider settings, export.
- Requirements:
  - focus trap
  - close on Esc
  - restore focus on close
  - `aria-modal="true"` and labeled title

### `details` / `summary` (collapsibles)

- Can be used for inspector section collapse when semantics fit; otherwise implement accessible disclosure components.
- Must support keyboard activation.

---

## Component specifications (CSS + UX)

### Top Bar

**Responsibilities**:

- Mode switching (primary navigation)
- Command palette entry point
- Project selector / breadcrumb
- Account + settings
- Global status (sync, job queue, warnings)

**CSS**:

- height: `var(--topbar-h)`
- background: `--bg-2` with subtle gradient optional
- bottom border: `1px solid var(--b-0)`
- content spacing: `padding-inline: var(--s-4)`
- supports “dense” mode via `data-density="compact"`

**Mode Switcher (segmented control)**:

- Each segment min-width 96px
- Selected segment uses `--selection-bg` + `--selection-border`
- Keyboard:
  - Left/Right to move
  - Enter/Space to activate
  - Cmd/Ctrl+1..5 optional quick switch

### Left Panel — Explorer

**Core widgets**:

- Search bar with scope chips (Name / Tags / Type / Provider / Status)
- Filter bar (asset type, rating, date, size, color label)
- Tree view with virtualized rows
- Collections (smart folders) + Favorites + Recents

**Tree View (ARIA)**:

- `role="tree"`, items `role="treeitem"`, groups `role="group"`
- Roving tab index, arrow key navigation, typeahead
- Expand/collapse with Right/Left

**Row CSS requirements**:

- Height: 28–32px
- `display: grid; grid-template-columns: 20px 1fr auto; gap: 8px;`
- States:
  - hover: `background: rgba(255,255,255,.03)`
  - selected: `background: var(--selection-bg)` + left indicator strip
  - drop target: `border: 2px dashed var(--a-1)` + `background: rgba(34,211,238,.14)`

**Drag & drop**:

- Drag ghost uses reduced opacity + thumbnail + name
- Drop zones: folder rows + canvas surface
- Modifiers:
  - Alt/Option: “copy”
  - Default: “move/link” depending on asset type

**Context menus**:

- Use a single menu system across app (consistent shortcuts displayed on right)
- Must support keyboard invocation (Shift+F10 / Menu key)

### Right Panel — Inspector

**Responsibilities**:

- Properties & metadata of selected item(s)
- Generation parameters (provider/model, prompt vars, seed, steps, CFG, aspect)
- Transform & effects stacks (non-destructive)
- History / provenance panel

**Sections**:

- Collapsible groups with sticky headers
- Consistent control row layout: label, control, suffix (unit)

**Control specs**:

- Text input: supports tokens, autocompletion, multiline prompt editor
- Number input: stepper + scrub-to-adjust (drag label)
- Slider: optional logarithmic scale for exposure/gamma
- Toggle: accessible `role="switch"`
- Select: searchable combobox for large lists (models/presets)
- Color: color picker + numeric fields + swatches
- Curve editor: (for later) canvas-based with keyboard nudge

### Main Workspace — Infinite Canvas (Blueprint)

**Core behaviors**:

- Infinite pan/zoom with smooth inertia (optional)
- Selection rectangle
- Multi-select with Shift/Cmd/Ctrl
- Snap lines (grid + alignment)
- Node ports and edge routing
- Comments/frames to group nodes (like Figma)
- Minimap + zoom slider

**Canvas visuals (CSS/Canvas)**:

- Grid: subtle dot/grid using `radial-gradient` or WebGL shader
- Zoom-aware line thickness (keep 1px in screen space)
- Selection outline uses `--selection-border`

**Node spec**:

- Node container:
  - background: `--bg-2`
  - border: `1px solid var(--b-1)`
  - radius: `--r-md`
  - shadow: `--shadow-1`
- Node header:
  - height: 32px
  - draggable region
  - icon + title + status badge
- Ports:
  - 10–12px circle
  - hover glow on connect
  - type color coding (image/video/audio/text/data)

### Timeline (bottom)

**Core behaviors**:

- Multi-track: video, audio, subtitle, fx/data tracks
- Ruler with timecode + zoom
- Scrubbing with red playhead (line + triangle head)
- Clips with handles, snapping, ripple edit (later), markers

**Visual spec**:

- height: `--timeline-h` (collapsible to 120px)
- track row: 44–52px depending on density
- clip:
  - radius: `--r-sm`
  - border: `1px solid rgba(255,255,255,.08)`
  - selected: `--selection-bg` + stronger border
- playhead:
  - line: `2px solid var(--c-danger)`
  - head: downward triangle, 10px base

**Keyboard**:

- Space: play/pause
- J/K/L: shuttle
- Arrow keys: nudge frame/second (with modifiers)
- Cmd/Ctrl+Z: undo edit, Cmd/Ctrl+Shift+Z redo

---

## Navigation modes (top bar)

Modes are first-class UI contexts with shared shell:

- **Image Create**: prompt → ref set → generate → variations → upscale/export
- **Image Rework**: inpaint/outpaint, masks, layers, control nets, color grade
- **Comic**: panels, speech bubbles, layout templates, character consistency
- **Video**: storyboard → clips → timeline → effects → render
- **3D Scene**: scene graph, camera rigs, lighting, assets placement, renders

Each mode defines:

- primary toolset (left toolbar optional)
- default inspector tabs
- default canvas node palette

---

## Accessibility (a11y) requirements

- WCAG 2.2 AA target for web.
- All controls must be reachable by keyboard and have visible focus.
- Provide ARIA roles for tree, grid, menus, dialogs, tabs.
- Use `aria-live="polite"` for job status updates; avoid spam.
- Color contrast: body text ≥ 4.5:1, UI chrome ≥ 3:1.

---

## Performance requirements

- Virtualize large lists (Explorer, history, job logs).
- Avoid re-render storms: memoize row items, use stable keys, avoid inline objects.
- Prefer requestAnimationFrame for canvas interactions; debounce expensive filters.
- Use progressive image loading (thumbnail → full-res) with cancellation.

---

## Coding standards (Next.js + TypeScript)

- Strict TS. No `any` in app code.
- Components:
  - Presentational components are pure and stateless where possible.
  - Complex state belongs in stores/services, not deeply nested props.
- CSS:
  - Use CSS Modules for component scoping.
  - Global CSS only for tokens, resets, and app-wide primitives.
- Testing (later):
  - Unit: pure functions, parsers, adapters
  - Integration: explorer CRUD, canvas graph ops, timeline edits

---

## Current Implementation Status (February 2026)

### Implemented Design Tokens

```css
/* Typography Scale (user-configurable) */
--font-scale: 1;                    /* 0.875 | 1 | 1.125 */
--font-2xs: calc(0.625rem * var(--font-scale));
--font-xs: calc(0.6875rem * var(--font-scale));
--font-sm: calc(0.75rem * var(--font-scale));
--font-base: calc(0.8125rem * var(--font-scale));
--font-md: calc(0.875rem * var(--font-scale));
--font-lg: calc(1rem * var(--font-scale));

/* Spacing Scale */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;

/* Component-specific spacing */
--panel-padding: var(--space-3);
--input-padding-x: var(--space-3);
--input-padding-y: var(--space-2);
--button-padding-x: var(--space-3);
--button-padding-y: var(--space-2);

/* Border Radius */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
```

### Responsive Breakpoints

| Breakpoint | Width | Changes |
|------------|-------|---------|
| Large Desktop | > 1440px | Wider panels, generous spacing |
| Desktop | 1024-1440px | Default settings |
| Tablet Landscape | 768-1024px | Reduced sizes, 95% font |
| Tablet Portrait | 640-768px | Compact layout, 90% font |
| Mobile | < 640px | Full-width panels, 87.5% font |
| Touch devices | (hover: none) | 44px minimum touch targets |

### User-Configurable Appearance

Users can adjust in Settings > Appearance:

1. **Font Size**: Small (87.5%) / Medium (100%) / Large (112.5%)
2. **Compact Mode**: Reduces all spacing by ~30%
3. **Show Filenames**: Toggle filename tags on canvas items

### Component Implementation Status

| Component | Spec | Implementation | Notes |
|-----------|------|----------------|-------|
| Button | ✅ | ✅ | All variants, sizes |
| Input | ✅ | ✅ | With icons, validation |
| SearchBar | ✅ | ✅ | Scope chips, shortcuts |
| Toast | ✅ | ✅ | Error codes, progress |
| TopBar | ✅ | ✅ | Mode switcher, menu |
| ConnectionBanner | ✅ | ✅ | Green/orange/red, X dismiss, ephemeral when ok |
| Settings > About | ✅ | ✅ | Client signature, telemetry toggle |
| Explorer | ✅ | ✅ | Tree, drag-drop |
| Canvas | ✅ | ✅ | Pan/zoom, selection |
| Inspector | ✅ | ✅ | Forms, properties |
| Timeline | ⚠️ | ✅ UI | No playback engine |
| Modal | ✅ | ✅ | Focus trap, escape |
| Tooltip | ❌ | ❌ | Not implemented |
| Combobox | ❌ | ❌ | Using native select |

### ArsTechnicAI Title Style

The ArsTechnicAI logo is styled consistently across the canvas TopBar and home DashboardLayout:

- **Ars**: `font-family: var(--font-serif)`, italic, primary text
- **Technic**: `font-family: var(--font-mono)`, secondary text
- **AI**: `background: var(--accent-gradient)`, gradient clip text, mono, bold

### Accessibility Status

| Requirement | Status |
|-------------|--------|
| Keyboard navigation | ✅ Implemented |
| Focus management | ✅ Implemented |
| ARIA roles | ⚠️ Partial |
| Color contrast | ⚠️ Check needed |
| Reduced motion | ❌ Not implemented |
| Screen reader | ⚠️ Partial |

---

## UX Improvements Needed

Based on the critical analysis in `ARCHITECTURE.md`:

### High Priority

1. **Add skeleton loaders** for async content
2. **Improve empty states** with clear call-to-actions
3. **Add contextual tooltips** for complex controls
4. **Implement keyboard shortcut hints** in menus

### Medium Priority

1. **Add first-run tutorial** overlay
2. **Implement drag preview** improvements
3. **Add progress indicators** for long operations
4. **Improve error message** specificity

### Low Priority

1. **Add themes** beyond dark mode
2. **Implement custom keyboard shortcuts**
3. **Add animation preferences** (reduced motion)

Generally speaking, buttons can have 4 modes: activated, neutral, pushed, disabled.
Those states are typically represented by the following CSS style:
- colored background, border, text color with outer shadow.
- white text with black border and background, no shadow, feels flat.
- A dark color of the activated style, with a dark inner shadow and light outter shadow to feel encasted.
- No shadow at all and the text color is a dark grey color to feel disabled.

The default state is the neutral style.