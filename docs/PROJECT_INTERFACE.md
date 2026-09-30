# Project workspace — round 2026-09-29

The workshop lives at `/project/[id]`. The home notes stay in `docs/HOME_INTERFACE.md`.

## What the roles agreed

- **Design.** The project name and the save icon are one control. The menu holds rename, save, save as, and export. Search keeps one field, two scopes that can each be off, and at most three name matches.
- **UX.** Closing the explorer leaves a 36px rail with the same toggle, so the panel can open again. Fit and reset are one button: Scan fits the pipeline, Maximize returns to the precise 85% view. The film strip spans the canvas; the inspector stays above it.
- **Architecture.** Search ranks local asset names and node titles in memory. The timing line under the three matches is the measured scan, not an estimate. Scope defaults are `localStorage` keys `ars:search:files`, `ars:search:google`, and `ars:search:suggestions`, edited from Settings → Search.
- **Performance.** The suggestion pass is a single scan of the asset map plus the node list, capped at three results. It should stay under a millisecond for a workshop of a few hundred names.
- **Test.** Open a project at 1440×900. Open the project menu, toggle Files and Google off and on, type until three matches appear, close the explorer and open it from the rail, and click the fit/precise button. At 390px the search bar is only the icon until it is opened.

## What the 1440×900 pass showed

Untitled Project opened Rename, Save, Save as, and Export JSON. Typing `gen` listed three file names out of 26 in 0.00 ms. The search icon moved to the right, turned white, and rotated 90 degrees while the field was focused. Clicking Files turned that scope off, and clicking it again turned it back on. Closing the explorer left a 36×851 rail; Open Explorer brought the panel back. The film strip measured 1148px wide. Fit whole pipeline switched the same button to Precise view. A 390px capture was not repeated in this pass.

## Where

`components/layout/TopBar.tsx`, `components/ui/SearchBar.tsx`, `components/layout/ExplorerPanel.tsx`, `components/layout/AppShell.tsx`, `components/workshop/WorkshopFlow.tsx`, `components/layout/SettingsModal.tsx`.
