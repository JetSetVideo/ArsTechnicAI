# Home interface — round 2026-09-25

The running product is the Next.js home at `http://localhost:3002/home`. The color cycle is the studio equation from `lib/studio/ui/home/home.css`: seven peak OKLCH samples, 28s, `cubic-bezier(0.86, 0, 0.14, 1)`, hue wrapped by +360 so the loop does not jump.

## What the roles agreed

- **Design.** One spectrum drives the wordmark and the single New Project control. Depth is type weight and one accent, not three competing buttons.
- **UX.** New Project stays in the filter bar only. Asset Creator opens and closes the creation panel. Tools and shelves are closed until asked. The startup banner sits under the nav and leaves after 2.5s.
- **Architecture.** Inventory is `fileStore.assets.size` and `projects.length`, shown once in the explorer. The grid’s “Library · 0” counted a different path and is no longer on the home surface. Sort, platform, source, and favorites share the filter bar.
- **Performance.** The creation hero is not mounted until Asset Creator opens, so the home first paint is the project grid.
- **Test.** Check `/home` at 390×844, 768×1024, 1440×900, and 1920×1080. Confirm one New Project, the banner under the bar, and matching asset counts.
- **Optimiser.** Collapsed shelves and tools remove the empty rail that sat between the explorer and the grid.

## What the screenshots showed

Laptop, closed: one wordmark, one New Project, explorer inventory `0 assets · 1 project`, tools and shelves closed, no second New Project card, no “Library · 0”. The banner had already left. Asset Creator opens the creation panel under the bar. Phone (390px): the explorer starts collapsed so the project and New Project stay on screen; Platform is clipped to “Pl” and still needs a wrap. Tablet uses the same 800px rule.

## Round 2

Ars and Technic stay white. Only AI, and the New Project shadow, run the seven-color cycle, now 84 seconds. Search is centered; on a phone it is an icon that opens the field and turns the icon white at 90 degrees. Generate, Draw, and Export sit at the top of the explorer with icons. Files replaces Shelves and holds Refresh and New folder. Asset Creator opens the prompt. New Template opens templates without the prompt. The pipeline is a branch under the generator. The duplicate platform block starts closed.

## Round 3

The cycle is 56s, slightly faster than the 84s pass. New Project text and its hover shadow under the button use that same OKLCH cycle. Generate uses it too. Search focus turns the icon white and rotates it 90 degrees; a phone keyboard is requested only when the pointer is coarse. The degraded avatar and “Not connected” are `#ff2a4a`. Free is an orange button that says “No commercial plan available, to be implemented later.” Platform, Source, and Recent sit in the scroll area under the bar. The explorer header holds the workspace counts and stays half empty; Files sits with the other actions, all left aligned. The hero is a prompt, then one row of format, style, count, and Generate, then location and references. Extra parameters hold time, emotion, a project variable, camera, light, and composition. The second platform list, image-count row, and Asset Creator copy are gone from that panel.

## Round 4 — project workspace

See `docs/PROJECT_INTERFACE.md`. The workshop top bar, explorer rail, film strip, and fit/precise view are specified there.

## Where

`components/layout/DashboardLayout.tsx`, `DashboardLayout.module.css`, `components/dashboard/HomeLeftPanel.tsx`, `components/dashboard/ProjectsGrid.tsx`, `components/ui/ConnectionBanner.tsx`.
