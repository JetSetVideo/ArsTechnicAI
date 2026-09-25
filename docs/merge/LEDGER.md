# Ledger

Append-only. Newest round at the bottom. Format and rules: `PROGRAM.md`.

---

## Round 0 — baseline: what is actually true on 18 September 2026

### R0.1 surveyor — the two repositories, and which one is real
- **What**  `~/Desktop/ArsTechnicAI-app` is the GitHub-connected repository
  (`github.com/JetSetVideo/ArsTechnicAI`, branch `main`, clean tree, in sync with origin).
  `~/Desktop/ArsTechnicAI` is the Deno studio built by mistake; it is not a git repository at all.
- **Why**  everything merged must land in the app, and the donor's history cannot be relied on to
  carry anything: it has no commits to cherry-pick.
- **When**  round 0; blocks nothing, frames everything.
- **Where**  `git remote -v`, `git status -sb` in the app; `git rev-parse` fails in the donor.
- **Who**  `conductor` — the backlog is therefore a port list, not a merge of branches.
- **How**  `git remote -v && git status -sb && git log --oneline -8`.
- **Result**  `## main...origin/main` with no divergence; last commit `bd07b76 feat: Implement
  first-run onboarding overlay and enhance canvas interactions`.

### R0.2 evidence — the app runs, and the 404s were a stale server
- **What**  a dev server started by this programme on **port 3010** answers `/` `/home` `/aide`
  with 200. A pre-existing `next-server` on port 3002 answers 404 for the same paths.
- **Why**  the first measurements were taken against 3002 and were wrong. Two `next-server`
  processes were bound there — one the user's, one started by mistake — so nothing measured on 3002
  could be trusted. Cause proven by moving to a private port and re-measuring.
- **When**  round 0; unblocks every later claim that something "works".
- **Where**  `http://127.0.0.1:3010`; the user's own server stays on 3002 and is not ours to touch.
- **Who**  every agent — 3010 is the programme's port from now on.
- **How**  `npx next dev -p 3010`, then `curl -o /dev/null -w '%{http_code}'` per route.
- **Result**  `/` 200, `/home` 200, `/aide` 200, compiled in 1540 ms.

### R0.3 evidence — the type gate is red, and the cause is a stub package
- **What**  `tsc --noEmit` fails with `TS2688: Cannot find type definition file for 'bcryptjs'`.
- **Why**  proven, not guessed: `node_modules/@types/bcryptjs/package.json` declares itself a
  *stub* — `"main": ""`, no `.d.ts` file, `"deprecated": "bcryptjs provides its own type
  definitions"`. That is true of bcryptjs **3.x**; the installed runtime package is **2.4.3**,
  which ships no types. TypeScript loads every `@types/*` directory as an implicit type library,
  finds nothing to load, and fails the whole program.
- **When**  round 0; blocks B1 and therefore every merge that wants a green type gate.
- **Where**  `package.json` devDependencies; importers are `lib/auth/password.ts` and
  `services/auth/authService.ts`.
- **Who**  `porter` to change the pin; `evidence` to re-run the gate.
- **How**  `./node_modules/.bin/tsc --noEmit`; `cat node_modules/@types/bcryptjs/package.json`.
- **Result**  one error, repo-wide, before any merge work started.

### R0.4 surveyor — there is no test runner
- **What**  `vitest.config.ts` and `tests/{api,lib,services,stores}` exist; `vitest` is in
  neither `dependencies` nor `devDependencies`, and not in `node_modules/.bin`.
- **Why**  the test gate in this repository cannot be run at all today, so "tested" currently means
  "type-checked, built, photographed and abused by hand".
- **When**  round 0; B2.
- **Where**  `package.json`, `vitest.config.ts`.
- **Who**  `conductor` to decide whether to install a runner or to drop the config.
- **How**  `ls node_modules/.bin | grep vitest`; `python3 -c "json.load(open('package.json'))"`.
- **Result**  no runner present; 36 declared packages all installed, vitest not among them.

### R0.5 evidence — the first photographs
- **What**  three surfaces shot at 1440×900 and 420×860 into `shots/2026-09-18T09-15-49-927Z_baseline/`,
  and the donor's home shot for comparison.
- **Why**  every later claim about the interface is compared against these.
- **When**  round 0; the before-shot for U1, U2, U3.
- **Where**  `shots/2026-09-18T09-15-49-927Z_baseline/{home,home-mobile,aide}.{png,json}`.
- **Who**  `interface-smith` reads these two pictures side by side before touching home.
- **How**  `deno run -A tools/shot.ts --base=http://127.0.0.1:3010 --tag=baseline`.
- **Result**  home 200 in 3613 ms, 0 console errors, 4 failed requests. **Read from the picture:**
  the degraded-mode banner is an overlay across the top-left, its text drawn over itself and over
  the ArsTechnicAI brand mark, ending in `Validation Error Count: 1`. Underneath: explorer panel,
  tool rail, a Projects grid with a `New Project` card and one `Untitled Project` card, and a
  generate bar reading `Nanobanana · imagen-3.0-generate-002` beside `No API key — add one in
  Settings`. The donor's home, by contrast, leads with the wordmark, a centred search, one `New`
  button and `Settings`; its left column is five counted shelves; its project cards carry a frame
  thumbnail, the project id, `600 frames · graph · analysed` and tags.

### R0.6 surveyor — drag and drop already half exists
- **What**  `Canvas.tsx` accepts `application/x-ars-node-type`, `application/json` and dropped
  files; `AppShell.tsx` sets the node-type payload on drag start; `ExplorerPanel` has a
  `onDragStart` contract for file nodes.
- **Why**  U6 is an extension of a working mechanism, not new machinery — the missing payload is a
  *workflow*.
- **When**  round 0.
- **Where**  `components/layout/Canvas.tsx:598,607,619,736`, `AppShell.tsx:302`.
- **Who**  `graph-engineer` with `interface-smith`.
- **How**  `grep -n "dataTransfer" components/layout/*.tsx`.
- **Result**  node types and files drop; workflows do not.

### R0.7 graph-engineer — 115 modules, no loop
- **What**  `lib/modules/registry.ts` imports 115 `moduleDef`s across assembly, edit, generate,
  ingest, intelligence, publish and spatial. None of them iterates: the only match for
  loop/iterate/batch/frame in the whole registry is `generate/batch-prompts.ts`.
- **Why**  the user's flagship workflow — for each frame of a chosen range, generate an image with
  an assembled prompt and a reference image so results stay coherent — has no primitive to stand on.
- **When**  round 0; G1, the first real feature of the programme.
- **Where**  `lib/modules/`, `lib/modules/graph-executor.ts`.
- **Who**  `graph-engineer` builds it; `provider-broker` supplies the model that can honour it.
- **How**  `grep -c "^import { moduleDef" lib/modules/registry.ts`; `ls lib/modules/*/`.
- **Result**  115 modules, 0 iterators.

### R0.8 surveyor — nothing prices a run before it happens
- **What**  no match anywhere in `lib`, `services`, `components` or `pages` for a cost
  estimate or pre-run confirmation.
- **Why**  a 600-frame loop against a paid model is the most expensive thing this software can do,
  and it would currently start on a single click.
- **When**  round 0; G2 must land **with or before** G1 is wired to a paid provider.
- **Where**  absent by construction.
- **Who**  `provider-broker` (prices) with `graph-engineer` (iteration count).
- **How**  `grep -rln "estimateCost\|costEstimate\|pre-run\|confirmBeforeRun" lib services components pages`.
- **Result**  no matches.

### R0.9 provider-broker — "Nanobanana" is wired to Imagen 3
- **What**  the generate bar is labelled `Nanobanana` and carries `imagen-3.0-generate-002`;
  `lib/ai/providers/google-imagen.ts` supports `imagen-3.0-generate-001/002` only.
- **Why**  Nano Banana is Google's Gemini image model, and the distinction is functional rather than
  cosmetic: the user's workflow feeds **an image plus a prompt** into every iteration so consecutive
  frames stay coherent. A text-to-image endpoint cannot accept that image.
- **When**  round 0; M1, and a hard dependency of the flagship workflow.
- **Where**  `lib/ai/catalog.ts:13`, `lib/ai/providers/google-imagen.ts:9`,
  `services/generation.ts:39-47`.
- **Who**  `provider-broker`, before G1 is pointed at real money.
- **How**  `grep -n -i "nano.?banana\|imagen-3\|gemini" lib/ai/* services/generation.ts`.
- **Result**  no Gemini image provider exists in `lib/ai/providers/`.

### R0.10 surveyor — the canvas cannot generate
- **What**  `lib/modules/generate/image.ts` defines 10 parameters and 3 outputs, and its
  `execute` returns `{ note: 'Call /api/generate with these params' }`.
- **Why**  the module system looks complete and is, at the executing end, a description. This is the
  same gap the donor has, so neither side can be copied into the other as a solution.
- **When**  round 0; M2, immediately after M1.
- **Where**  `lib/modules/generate/image.ts:33-52`.
- **Who**  `porter` with `provider-broker`.
- **How**  read the file; `pages/api/generate.ts` (427 lines) is where the real call lives.
- **Result**  graph execution and generation are two systems that do not meet.

---

## Round 1 — make the gates real

### R1.1 porter — the type gate was not red, it was blind
- **What**  pinned `@types/bcryptjs` to `^2.4.6` (the version that matches the installed
  `bcryptjs@2.4.3`) and excluded `tools/` — Deno scripts — from the Next type-check.
- **Why**  `TS2688` on an implicit type library is a *program-level* failure: TypeScript stopped
  before checking the application. With it gone, the real state appeared — **498 errors across 158
  files**, none of which anybody could see while one stub package was failing first.
- **When**  round 1; closes B1, opens B4.
- **Where**  `package.json` devDependencies, `tsconfig.json` exclude.
- **Who**  `conductor` must decide what 498 errors mean for the programme: they are now visible,
  and `next.config.js` sets `typescript.ignoreBuildErrors: true`, so they block nothing at build
  time and everything at review time.
- **How**  `./node_modules/.bin/tsc --noEmit | grep -c "error TS"`.
- **Result**  before: 1 error, everything else unchecked. After: 498 errors, 0 of them bcryptjs.

### R1.2 porter — `next build` has never succeeded on this branch
- **What**  wrote `lib/storage/local.ts`, the module six files have imported since the asset
  pipeline was written and which was never committed.
- **Why**  proven, not assumed: `npx next build` failed with `Module not found: Can't resolve
  '@/lib/storage/local'`; `git log --all -- lib/storage` returns nothing, so no commit has ever
  contained it. The production build was impossible, which also means it was never deployed from
  this branch.
- **When**  round 1; this outranked every feature in the backlog, because nothing ships from a
  repository that cannot build.
- **Where**  new `lib/storage/local.ts`; importers `lib/queue/worker.ts`, `lib/media/processor.ts`,
  `pages/api/assets/{upload,batch,[id]}.ts`, `pages/api/admin/cleanup.ts`.
- **Who**  `breaker` should attack it next: path traversal on delete, a name collision under
  concurrency, a full disk mid-write.
- **How**  contract derived from the call sites (`saveFile(data, filename, bucket)`,
  `deleteFile(path, bucket)`, `cleanTempFiles(ms)`) and the four buckets already declared in
  `.env.local` (`UPLOAD_DIR`, `THUMBNAIL_DIR`, `PREVIEW_DIR`, `TEMP_DIR`). A save never overwrites —
  it claims the next free name; a delete refuses anything outside its bucket and never recurses;
  only `temp` is swept.
- **Result**  `✓ Compiled successfully`, 40 routes, first-load JS 126 kB.

### R1.3 evidence — a self-inflicted outage, and the rule it produced
- **What**  after the build, every route returned 404/500. Nothing in the source had changed.
- **Why**  two causes, both proven from logs rather than guessed. First, `next build` overwrote the
  `.next` directory the running `next dev` was serving from — `MODULE_NOT_FOUND` at
  `.next/server/webpack-runtime.js`. Second, and worse, `npm install` had replaced this repository's
  **Deno-managed** `node_modules` (27 symlinks into `node_modules/.deno/`) with a full npm tree of
  165 real directories, while `node_modules/.bin/next` still pointed into the Deno store — so Next's
  runtime loaded React from `.deno/react@18.3.1` and the application loaded it from
  `node_modules/react`. Two React instances give exactly the symptom seen:
  `TypeError: Cannot read properties of null (reading 'useContext')`.
- **When**  round 1; cost about forty minutes and produced two standing rules.
- **Where**  `node_modules/`, `node_modules/.bin/next`, `.next/`.
- **Who**  every agent, from now on:
  1. **This repository is installed with Deno, not npm** (`deno.json` `nodeModulesDir: auto`,
     `deno task install`). Never run `npm install` here. To change a dependency, edit
     `package.json` and run `deno install --allow-scripts`.
  2. **Never run `next build` while a dev server is up.** Stop it, build, restart.
- **How**  repaired by moving the npm tree aside and re-running `deno install --allow-scripts`,
  then `prisma generate` and `scripts/patch-nextjs.ts`. Verified by running the routes again.
- **Result**  `node_modules` back to 27 symlinked entries; `/` `/home` `/aide` all 200.

### R1.4 conductor — the disk is full, and it is not mainly us
- **What**  `/System/Volumes/Data` is at 100%: 427 GiB used of 460 GiB, 758 MiB free. A command
  failed outright with `ENOSPC` mid-round.
- **Why**  the repair above left two working copies (`node_modules.npm-*` 1.4 GB, `.next.stale-*`
  349 MB) on a volume that was already essentially full. The copies were the last straw, not the
  cause.
- **When**  round 1; blocks `next build`, which needs room to write `.next`.
- **Where**  the machine, not the repository.
- **Who**  the user — asked before anything was removed, because removals are theirs to authorise.
  They approved removing exactly the two copies this session created; both were regenerable
  (`deno task install`, any build) and nothing of theirs was touched.
- **How**  `df -h /System/Volumes/Data`; `du -sh` on each copy; then one `rm -rf` per named path,
  each announced with its full path and size.
- **Result**  1.7 GiB free. Still tight: a production build needs roughly 400 MB, so `next build`
  should be treated as a gate that may fail for space until the user clears more.

### R1.5 evidence — nothing on screen moved
- **What**  re-shot all three surfaces and compared them with the baseline, in order.
- **Why**  round 1 changed dependency resolution, a tsconfig and added a storage module; the point
  of the comparison is that none of that was allowed to change what the user sees.
- **When**  round 1 close.
- **Where**  `shots/2026-09-18T09-15-49-927Z_baseline` →
  `shots/2026-09-18T09-46-32-865Z_r1-storage-types`.
- **Who**  `interface-smith` next, on U1 and U2, which are the first deliberate visual changes.
- **How**  `deno run -A tools/shot.ts --compare <baseline> <r1>`.
- **Result**  `= home unchanged · = home-mobile unchanged · = aide unchanged · No regressions
  between these runs.` Status 200 on all three, 0 console errors, 0 page exceptions.

### R1.6 surveyor — why the storage module was missing: `.gitignore` ate it
- **What**  `.gitignore` line 41 was `storage/` — an **unanchored** pattern, which git applies to a
  directory of that name at *any* depth. It therefore matched `lib/storage/`, which is source code.
  Changed to `/storage/`, anchored to the repository root, where the upload buckets actually live.
- **Why**  this is the cause behind R1.2, and it was found by accident: after writing
  `lib/storage/local.ts`, `git status` did not list it. The original author almost certainly *did*
  write that module; git silently refused to track it, the commit went out without it, and every
  clone since has been unable to build. Nobody noticed because `next dev` compiles routes lazily and
  those six API routes are not hit on a normal page load.
- **When**  round 1; this is the row that explains B3 rather than merely fixing it.
- **Where**  `.gitignore:41`; `git check-ignore -v lib/storage/local.ts` named the rule.
- **Who**  `surveyor` — worth a sweep for other source paths the ignore file is swallowing.
- **How**  `git check-ignore -v <path>` prints the file, line and pattern responsible. It is the
  only honest way to ask "why is git not seeing this?".
- **Result**  before: `.gitignore:41:storage/  lib/storage/local.ts`. After: not ignored, and
  `git status` lists `?? lib/storage/`. `shots/` was added to the ignore file in the same pass —
  screenshots are local evidence, regenerable, and large.

### R1.7 evidence — both gates, under the restored install
- **What**  stopped the dev server, ran the production build, restarted the dev server, re-checked
  the routes.
- **Why**  round 1 touched dependency resolution twice; a green build from before the repair proves
  nothing about the state after it.
- **When**  round 1 close.
- **Where**  repository root; dev server on 3010.
- **Who**  `conductor` to open round 2 on G1 (the loop) and U1/U2 (the home page).
- **How**  `npx next build`, then `npx next dev -p 3010`, then one `curl` per route.
- **Result**  `✓ Compiled successfully`; `/` 200, `/home` 200, `/aide` 200; 1.5 GiB disk free,
  which is enough for one build at a time and not much more.
