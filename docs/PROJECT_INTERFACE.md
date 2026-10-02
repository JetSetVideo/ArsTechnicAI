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

## Round 2026-09-30 — output behind the graph, map above the nodes

Gall's law: one working slice before the next. This slice is the two things you can see without a second editor.

- The canvas background is the workflow's last picture: the last film-strip frame, otherwise the rightmost node that has an image. This project has neither yet, so the background says to run the pipeline. A generated picture replaces that sentence.
- The map sits in the bottom-right, above the film strip. Default size is 148×78 at 42% opacity. Settings → Appearance → Pipeline map changes visibility, width, height, and opacity. It draws one mark per node. The white rectangle is the current window.

Checked: the map is on screen above the Script lane, the window rectangle is inside it, and the empty output line is visible because no node has a picture yet.

## Round 2026-09-30 — backdrop switch, cook, Nano Banana 2

- Settings → Appearance → Workshop result turns the picture behind the nodes on or off. It is on by default.
- Running a node that returns a picture sets that picture as the background. The film strip still wins only when nothing has been cooked in this project.
- Image generation calls `gemini-3.1-flash-image` (Nano Banana 2), then Pro, Lite, and the original Nano Banana. Text nodes call `gemini-3.8-flash`, then 3.7, 3.6, and 3.5. `gemini-2.0-flash` is retired and is no longer called. If the known ids are missing, the key’s model list is searched. An invalid key or a quota error still stops immediately. Old “model is no longer available” messages are cleared from nodes that have not been run again.

## What exists, and what the other tools still have

This workshop already has a left-to-right stage graph, typed links, pan and zoom, fit/precise view, per-node generate, variant decks, layers, an inspector, a film strip, and local save.

Not built yet, in the order the next slices should land:

1. TouchDesigner cook: run one node and have the background update from that node's picture without a reload.
2. Notch output: a fixed viewer that stays on the final delivery node while you edit upstream.
3. Figma multiplayer: two cursors on one project. There is no shared session yet.
4. Comments, components, and version history that more than one person can see.
5. A timeline that scrubs the film strip and the background together.
6. Realtime parameters (sliders that change the picture while you drag). The inspector edits values; it does not cook them live.

## Round 2026-09-30 — one history

Undo and the corner log were two lists. The button restored the graph and forgot to say what it restored. The log was mostly repeated searches, labelled SRC, and its own undo only deleted the line.

They are one record now. A workshop edit becomes a sentence (`Added Generate Moodboard`, `Moved Key Visual`, `Linked Script to Prompt Lab`). That sentence is the Undo tooltip and the first row of History. Returning an edit keeps the line, struck through, so the order of what happened is still there. Searches and settings sit under Other activity. `window.__arsHistory` on the workshop page exposes `steps()`, `undo()`, and `depth()` for an agent reading the same record.

## Where

`components/layout/TopBar.tsx`, `components/ui/SearchBar.tsx`, `components/layout/ExplorerPanel.tsx`, `components/layout/AppShell.tsx`, `components/workshop/WorkshopFlow.tsx`, `components/layout/SettingsModal.tsx`.
