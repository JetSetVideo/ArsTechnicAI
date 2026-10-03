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

### R2.1 surveyor — every ArsTechnicAI copy on the Ubuntu server, and what is not on GitHub
- **What**  Inventory on MaxPC (2026-10-02): (1) `~/Desktop/ArsTechnicAI` — this repository, `main` =
  `origin/main` = `a21fa94`, clean, one branch, no stash, no worktree, the only ArsTechnicAI repo on the
  GitHub account; (2) the Deno studio — already inside it at `lib/studio/` (`0a7a4e3` imported it as
  `imported/deno-studio`, `a86d06d` moved it: 559 pure renames + 4 near-identical, 564 files both sides,
  only `imported/README.md` deleted); (3) `~/Desktop/ArsTechnicAI-Server` — a separate Next 14 App Router
  app (login, signup, Google OAuth landing, profile, persisted session store), **not a git repository**,
  never on GitHub; (4) `/etc/arstechnicai/pki` — certificates, not source, left alone.
- **Why**  the user asked for every copy's features in the GitHub version. Only (3) was outside it.
- **When**  round 2 intake.
- **Where**  paths above; `git ls-remote --heads origin`, `gh repo list JetSetVideo`.
- **Who**  `porter` for (3); the donor backlog below is unchanged by this round.
- **How**  `git fetch --all --prune && git status -sb`; `git show a86d06d -M --name-status`;
  `find / -xdev -type d -name bridge` filtered for `core/` + `deno.json` siblings.
- **Result**  one un-merged codebase: ArsTechnicAI-Server (21 files, ~1 000 lines).

### R2.2 surveyor — the destination's auth store was replaced by a stub, and five consumers broke silently
- **What**  `stores/authStore.ts` held only `{ userId, role }` with `setAuth(userId, role)`, while
  `AuthContext`, `AuthModal`, `SettingsModal`, `AuthButton`, `GenerationContext` and `ProjectContext`
  read `user` / `token`, call `setAuth(user, token, expiresIn)` and import a type `AuthUser` that did not
  exist. Same pattern twice more: `SettingsModal` called `savePseudonym()` (deleted in `a63d587`, callers
  kept), and `AuthModal`'s Google button tested `typeof json === 'string'` against an API that answers
  `{ url }`. No `/auth/callback` page existed although the Google callback API redirects there.
- **Why**  `ae6a444` added a 104-line persisted JWT store; `dda6eb0` later re-created the file as a 17-line
  NextAuth stub. ArsTechnicAI-Server carries the same store shape, which is why it worked and this did not.
  Invisible because `next.config.js` sets `ignoreBuildErrors` and plain `tsc` stops at TS2688 (bcryptjs).
- **When**  round 2; blocks every signed-in feature (projects, generation, profile).
- **Where**  `git log --follow -- stores/authStore.ts`; `git log -S savePseudonym`.
- **Who**  `porter`.
- **How**  `./node_modules/.bin/tsc --noEmit -p . --types node` → 524 errors, 10 of them in the files above.
  Headless run of the sign-in flow on unmodified `main`: callback 404, register leaves no session,
  reload shows signed out, pseudonym edit throws.
- **Result**  cause established from history and from a failing run, before any edit.

### R2.3 porter — ArsTechnicAI-Server merged as a translation into pages-router idiom
- **What**  carried across: the persisted, expiry-checked session store (restored from `ae6a444`, plus the
  Server's `roles[]`), its typed API client (`lib/auth/client.ts`, now also tolerant of non-JSON error
  bodies and honouring `NEXT_PUBLIC_API_URL` so the Mac-frontend → Ubuntu-API split still works), and the
  Google OAuth landing page (`pages/auth/callback.tsx`, verifies the token via `/api/auth/me` before storing
  it, `replace()`s it out of the URL, routes failures to `/auth/error` with readable messages).
  Repaired in place: Google redirect in `AuthModal` (now shows "Google OAuth is not configured" instead of
  nothing), `savePseudonym` restored, role badge read from `roles[]` by rank, unused NextAuth `hooks/useAuth`
  repointed at the JWT store. **Not** carried: the Server's `/login`, `/signup`, `/home` pages — this app
  already signs in through `AuthModal`, and its `/home` is the dashboard; a second sign-in UI would be a
  parallel system. `~/Desktop/ArsTechnicAI-Server` is left on disk untouched (not deleted — `surgeon`, with a
  yes, if wanted).
- **Why**  R2.2.
- **When**  round 2.
- **Where**  `stores/authStore.ts`, `lib/auth/client.ts`, `pages/auth/callback.tsx`, `pages/auth/error.tsx`,
  `components/auth/AuthModal.tsx`, `components/layout/SettingsModal.tsx`, `contexts/AuthContext.tsx`,
  `hooks/useAuth.ts`, `services/auth/ARCHITECTURE.md`, `.env.example`.
- **Who**  `breaker`, `evidence`.
- **How**  edits with asserted match counts; no file removed.
- **Result**  see R2.4–R2.6.

### R2.4 evidence — before and after, in order
- **What**  shot five surfaces before (changes stashed) and after; added `auth-callback-error` and
  `auth-error-oauth-code` to `tools/shot_targets.json`. `tools/shot.ts` could not start Chromium on Ubuntu
  24.04 ("No usable sandbox!" — AppArmor blocks unprivileged user namespaces); it now passes `--no-sandbox`
  on Linux only.
- **Why**  rule: shoot before as well as after.
- **When**  round 2.
- **Where**  `shots/2026-10-02T19-28-11-505Z_before-auth-merge` → `shots/2026-10-02T19-28-43-834Z_after-auth-merge` (+ `shots/2026-10-02T19-29-35-171Z_after-auth-merge-probe` with a tightened token probe). Dev server on 3012 (3010 was the
  Mac's; 3002 is held by Cursor here).
- **Who**  `conductor`.
- **How**  `CHROME_PATH=… deno run -A tools/shot.ts --base=http://127.0.0.1:3012 --tag=…`, then `--compare`.
- **Result**  `auth-callback-error status 404 → 200 · path "/auth/callback" → "/auth/error" · text "404 This
  page could not be found." → "… Google sign-in was cancelled. …"`; `auth-error-oauth-code text "An
  authentication error occurred. Back to sign in" → "Your session could not be verified. …"`; `= home-mobile
  unchanged · = aide unchanged`; `home` lost the green "Connected" strip — `ConnectionBanner` leaves after
  `EPHEMERAL_DELAY_MS = 2500` and the after-shot loaded 0.8 s slower; it imports nothing touched here.
  `No regressions between these runs.` Token probe on the error path: `hasToken: False`.

### R2.5 breaker — the battery against sign-in
- **What**  headless Chromium against `next start` (production build) on 3012, a throwaway local account.
- **Why**  before anything is called done.
- **When**  round 2.
- **Where**  `/home` → Settings → Connect; `/auth/callback`; `/api/user/profile`.
- **Who**  `conductor`; one open finding below goes to the backlog (A2).
- **How**  register → reload → edit pseudonym (checked server-side through `/api/auth/me`) → log out →
  Google → log in → wrong password; then callback with a real token and `auth_expires_in=abc`, Back, the same
  callback twice, two tabs.
- **Result**  11/11 flow checks PASS, 0 page errors (same script on unmodified `main`: 5 FAIL then abort).
  `success: landed=/home tokenInUrl=false stored=true expiryDays≈7.00` · `back: tokenInUrl=false` ·
  `twice: stored=true expiryHours≈1.00 sameUser=true`. **Open, severity "looks wrong":** logging out in one
  tab leaves another tab signed in until it reloads — the persisted store has no cross-tab `storage`
  listener. No work is lost (JWT is stateless; the token stays valid until expiry either way).

### R2.6 conductor — gates, quoted
- **What**  type, test, build and run gates on the final tree.
- **Why**  "done means it ran".
- **When**  round 2 close.
- **Where**  repository root; dev server stopped before the build.
- **Who**  next round: `conductor` picks from the donor backlog (G1 loop, U1–U6, M1–M3, L1–L4 untouched).
- **How**  `tsc --noEmit -p . --types node`; `npm test`; `npx next build`; `next start -p 3012` + e2e.
- **Result**  type: 524 → 508, **0 new** (8 apparent "new" lines were the same errors with Prisma's type
  literal printed in another property order — identical file:line:code sets). test: `Tests 2 failed | 288
  passed (290)` — the 2 are `settingsStore` default-`apiKey` assertions, failing identically on unmodified
  `main`. build: `✓ Compiled successfully`, `○ /auth/callback 1.37 kB`. run: R2.5. B2 closed by declaring
  `vitest@4.0.18` + `"test": "vitest run"` (`deno install --allow-scripts`; `node_modules` still 166
  entries / 26 symlinks; Prisma client regenerated from the unchanged schema, type gate identical after).

### R3.1 surveyor — the backend the Mac would sync with did not exist, and its disk routes were open
- **What**  (1) 14 routes had no authentication, including `workspace/save|load|pipelines`,
  which build `canvas-${projectId}.json` from request input; (2) `createApiHandler` only
  accepted NextAuth sessions while the UI holds a custom JWT; (3) ~20 Prisma models the
  routes use (`asset`, `canvasState`, `timeline*`, `tag`, `userApiKey`…) exist in neither the
  schema nor the database; (4) `enqueueSync()` had no callers — nothing ever synced between
  machines; (5) login/register rate limits were one global bucket (`'LOGIN_TOKEN'`);
  (6) `JWT_SECRET` was the public placeholder, `.env*` were mode 664; (7) no security
  headers (`securityMiddleware` never wired); (8) nginx served a public `/storage/` alias.
- **Why**  the user wants to keep developing on the Mac offline while assets stay in sync
  across the Ubuntu database, OneDrive and the Mac.
- **When**  round 3 intake.
- **Where**  `pages/api/**`, `lib/api/handler.ts`, `utils/rateLimit.ts`, `/etc/nginx`.
- **Who**  `breaker` to prove, then `porter`.
- **How**  route-by-route grep for auth wrappers; `prisma.<model>` usage vs `pg_tables`.
- **Result**  see R3.2.

### R3.2 breaker — proofs before any fix
- **What**  an unauthenticated `POST /api/workspace/save` with
  `projectId=x/../../../../../../tmp/ars-poc-fffa0f93` wrote `/tmp/ars-poc-fffa0f93.json`, and
  `GET /api/workspace/load` read it back; `GET /api/workspace/scan` returned the settings file
  (where provider keys live — none were stored, so nothing leaked). A valid JWT got 200 from
  `/api/auth/me` and 401 from every `createApiHandler` route. Next 14 injects
  `x-forwarded-for`/`-host` itself (`base-server.js` `??=`) and keeps a client-supplied XFF.
- **Why**  rule 1.
- **When**  round 3, before R3.3.
- **Where**  dev server on 3012 (3002 is held by a Cursor port forward here).
- **Who**  `porter`.
- **How**  curl / python probes; a temporary header-echo route (removed).
- **Result**  all reproduced; probe file deleted.

### R3.3 porter — one request-auth layer, safe paths, secrets, limits, headers
- **What**  `lib/auth/requestAuth.ts` (user via JWT → NextAuth; `local` only for direct
  loopback — no proxy headers, localhost Host, not cross-site; off in production);
  `lib/auth/jwt.ts` (HS256 pinned, iss/aud, secret strength); `lib/security/safePath.ts`
  (`isSafeId`, `resolveInside`) on every path built from input; 14 routes wrapped; login
  per IP (10/min) and per account (20/15 min), register per IP, 429 not 400;
  `lib/security/clientIp.ts` (X-Real-IP, else the *last* XFF entry); headers in
  `next.config.js`; `lib/auth/fetchAuth.ts` attaches the token to own-API calls only;
  JWT secret rotated (64 chars), `.env*` and settings 600.
- **Why**  R3.2.
- **When**  round 3.
- **Where**  files named; `.env` (git-ignored).
- **Who**  `breaker`.
- **How**  asserted edits; `tests/lib/security.test.ts` (46).
- **Result**  traversal → 400, proxied/rebinding/CSRF → 401, forged `alg:none`/old-style/
  tampered tokens → 401, valid token through a proxy → 200, IP A blocked at try 10 while
  IP B is not, one account blocked at try 20 across 20 IPs.

### R3.4 porter — device sync on tables that exist
- **What**  `services/sync/syncService.ts` + `/api/sync/{manifest,projects/[id],assets/[projectId]/[assetId],local-file}`:
  projects in `Project`/`ProjectWorkspaceState` (compare-and-swap on version **and**
  content hash), files in a content-addressed store (`lib/storage/blobStore.ts`, verified
  while streamed, deduplicated), a readable OneDrive mirror (`lib/storage/oneDriveMirror.ts`,
  atomic `.~ars-*.tmp` writes the OneDrive client skips, never overwrites another file).
  Client: `lib/sync/syncEngine.ts` (push/pull/keep-both/defer-open), `hooks/useDeviceSync.ts`,
  `stores/syncStore.ts`, Settings → Data → `components/settings/SyncPanel.tsx`, notices with
  **Load latest**. Settings and API keys never sync.
- **Why**  the user's offline-Mac workflow.
- **When**  round 3.
- **Where**  files named; `docs/OFFLINE_SYNC.md`.
- **Who**  `breaker`, `evidence`.
- **How**  `tests/lib/sync.test.ts` (26).
- **Result**  API battery 21/21; 20 concurrent pushes from one base → exactly 1 updated, 19 conflicts.

### R3.5 breaker — two-machine simulation (Ubuntu with DB, Mac without), real UI in headless Chromium
- **What**  isolated copies on 3012 (home server) and 3014 (Mac: unreachable DB/Redis, its own
  JWT secret, `NEXT_PUBLIC_API_URL` → 3012). Create on Ubuntu → Mac receives project and
  byte-identical image; repeated syncs go quiet; Ubuntu down → Mac edits offline (kept);
  Ubuntu edits the same project → Mac reconnects → both versions on both machines; a normal
  edit flows without conflict; an open project is deferred and taken with **Load latest**.
- **Why**  "done means it ran".
- **When**  round 3.
- **Where**  scratch copies (no real `.ars-data`, OneDrive or storage touched).
- **Who**  `porter` for the five defects it found.
- **How**  step scripts with persistent browser profiles per device.
- **Result**  found and fixed, each proven first: (1) **data loss** — a project on disk but not
  in the browser's list was pulled over local edits → disk counts as local + `pull()` refuses
  to overwrite content that is neither the server's nor the last agreed; (2) spurious
  conflicts — `workspace/save` reshapes bundles → hash only disk-kept fields; (3) the
  dashboard deduplicated projects **by name**, hiding a different project (every device's
  "Untitled Project") → by id; (4) `X-Ars-Reuse` missing from CORS → Mac uploads blocked and
  reported as "offline" → header added, and a blocked request is no longer called offline;
  (5) a node without `variants` white-screened the dashboard → nodes normalised on load.
  Final: Ubuntu "Sim Film" holds all three edits from both machines; conflict copy holds the
  Mac's offline edit; 1 blob for 2 projects; 0 temp leftovers.

### R3.6 porter — nginx (live)
- **What**  removed the public `/storage/` alias, `server_tokens off`, nginx sign-in limit
  (`limit_req zone=ars_auth`, 20/min, burst 10, 429). Backup: `sites-available/arstechnicai.bak-2026-10-03`.
- **Why**  R3.1 (8); defense in depth.
- **When**  round 3.
- **Where**  `/etc/nginx/sites-available/arstechnicai`, `/etc/nginx/conf.d/arstechnicai-ratelimit.conf`.
- **Who**  the user — HTTPS needs `certbot` (terms + e-mail are theirs to accept).
- **How**  `nginx -t`, reload, curl with the site's Host header.
- **Result**  site 200, `/storage/` 404, `/.env` 403, `Server: nginx`, 35 rapid sign-ins → 14×400, 21×429.

### R3.7 conductor — gates, quoted
- **What**  type, test, build, production run.
- **Result**  tsc 508 → 507, 0 new in touched files. `npm test`: 2 failed | 364 passed — the 2 are
  the pre-existing `settingsStore` (B6); `save-meta` tests updated to call as the owner, plus
  a 401 case. `next build`: `✓ Compiled successfully`, 4 sync routes. `next start`: local
  call without session 401, with session 200, login 200, headers present.

### R3.8 surveyor — `/storage/` was never ignored: git has no trailing comments
- **What**  `.gitignore` line 41 read `/storage/   # anchored: …`. Git takes the whole line,
  spaces and `# …` included, as the pattern, so it matched nothing — the R1.6 fix never took
  effect. Found when `git check-ignore -v storage/blobs/…` printed nothing before the first
  commit that creates `storage/blobs` (synced media must never reach the public repo).
- **Why**  same family as R1.6: the ignore file silently disagreeing with its intent.
- **When**  round 3 close, before committing.
- **Where**  `.gitignore`.
- **Who**  anyone editing `.gitignore`: comments on their own line.
- **How**  `git check-ignore -v storage/blobs/ab/x lib/storage/blobStore.ts`.
- **Result**  now `.gitignore:44:/storage/  storage/blobs/ab/abcdef`; `lib/storage/` still
  tracked; `git ls-files storage` empty — nothing was ever committed there.

### R4.1 porter — B6: the settings tests were stale, and three passed vacuously
- **What**  `settingsStore` moved to `activeProvider` / `activeModel` / `apiKeys{}` in `0d8b9d3`
  (2026-05-22); the tests still read `aiProvider.provider` / `.apiKey` / `.model`. Two failed;
  two more passed only because a shallow merge stores whatever field you write.
- **Why**  a permanently red suite hides new failures.
- **When**  round 4.
- **Where**  `tests/stores/settingsStore.test.ts`.
- **Who**  —
- **How**  read the store defaults and the migration code before touching the tests.
- **Result**  4 tests rewritten against the real shape (incl. "reset clears stored keys");
  `npm test` fully green for the first time in this programme.

### R4.2 porter — files move server-to-server
- **What**  the engine read every file whole into the browser to hash and upload it. Now each
  machine's server hashes (`HEAD /api/sync/local-file` → `X-Ars-Sha256`, cached by size+mtime)
  and streams (`POST /api/sync/transfer/push|pull`), forwarding the session token only to the
  configured home server (`lib/sync/homeServerUrl.ts` — never request input).
  `lib/storage/generatedFiles.ts` holds the verified, never-overwriting write.
- **Why**  the user creates video; a multi-GB file would exhaust the page.
- **When**  round 4.
- **Where**  files named; two-machine simulation on 3012/3014.
- **Who**  `evidence`.
- **How**  700 MB file synced Ubuntu → server → Mac; page heap measured.
- **Result**  byte-identical on the Mac; heap 44–55 MB during the transfer; one 701 MB blob;
  conflict copy re-links both files without storing new blobs; 0 temp leftovers.

### R4.3 porter — runtime /generated/ files in production
- **What**  `next start` serves only build-time `public/` files: proven 200 for a build-time
  file, 404 for one added after. Fallback rewrite `/generated/:name` →
  `/api/files/generated/[name]` (only when no static file matched).
- **Result**  after the fix: both post-build files 200, correct type, byte-identical;
  traversal names 404. Exposure unchanged (S3).

### R4.4 evidence — incident: a test upload took down the public site
- **What**  I added an nginx location for `/api/sync/assets/` with a 2.1 GB limit and
  `proxy_request_buffering off`, then sent an unauthenticated 600 MB stream through it to
  check nginx would not buffer it (it did not: temp stayed at 0 bytes). Port 3002 was not
  this app but a Cursor port forward; it reset the connection at 13:17:25 and stopped
  listening — every request from 13:17:26 on, including the user's own (192.168.1.254,
  `/_next/webpack-hmr`), got "Connection refused".
- **Why**  the change assumed the app (which authenticates before reading a body) was the
  upstream. It was not, and the test went to the real upstream instead of a sandbox.
- **When**  round 4.
- **Where**  `/var/log/nginx/error.log`, `/etc/nginx/sites-available/arstechnicai`.
- **Who**  the user re-forwards 3002 in Cursor (their choice); nobody else touches 3002.
- **How**  nginx error-log timeline; `ss -ltnp | grep :3002`.
- **Result**  nginx reverted within minutes to the R3.6 config (500 MB cap, buffered).
  Rule kept: never send load tests through the public proxy; test against our own ports.

### R4.5 porter — real data-integrity check (S2)
- **What**  Settings → Data showed five hard-coded "✓ Verified" rows. Now
  `/api/workspace/integrity` + `components/settings/IntegrityPanel.tsx`: unreadable project
  files, referenced `/generated/` files missing from disk, unreferenced files (listed, kept).
- **Result**  with one of each planted in the Mac sandbox, each was reported exactly; a
  proxied caller without a session got 401. Its test caught a scanner bug
  (`/generated/sub/x.png` counted `sub` as a file), fixed.

### R4.6 surveyor — the Mac cannot reach :3002 on the LAN
- **What**  `docs/OFFLINE_SYNC.md` told the Mac to use `http://192.168.1.50:3002`, but UFW has
  no rule for 3002. Corrected: a LAN-only rule the user adds, or the domain through nginx
  (HTTP, 500 MB per file).
- **Who**  the user (firewall change).

### R4.7 conductor — gates
- **Result**  `npm test`: 17 files, 371 passed, 0 failed. tsc 507 (unchanged, none in new
  files). `next build`: `✓ Compiled successfully`, new routes `/api/sync/transfer/{push,pull}`,
  `/api/files/generated/[name]`, `/api/workspace/integrity`. Slip: the pre-build guard that
  looks for a dev server serving this checkout only *printed* a hit (a short-lived process,
  gone seconds later; a Cursor agent and terminal are active in this repository) instead of
  aborting — nothing was serving from `.next`, so no harm, but the guard must exit non-zero.

---

## Round 5 — the blueprint is the workshop

### R5.1 surveyor — there is no blueprint page
- **What**  `git pull --ff-only` was already at `b1c3d6b`. No `pages/blueprint`. The workshop
  is `/project/[id]` (`AppShell` → `WorkshopFlow`). `useBlueprintStore` was imported only by
  `stores/index.ts` and `hooks/useDiskReconciliation.ts`. `useCanvasStore` is still imported
  by generation, project sync, disk save, and telemetry.
- **Why**  a second page would split the editor the home page is supposed to open.
- **When**  round 5, before any edit. Unblocks U7. Leaves U8 for `surgeon`.
- **Where**  `stores/blueprintStore.ts`, `stores/canvasStore.ts`, `pages/project/[id].tsx`.
- **Who**  `graph-engineer` and `interface-smith`.
- **How**  `git pull --ff-only origin main`; search for `useBlueprintStore` and `pages/blueprint`.
- **Result**  `Already up to date.` Last commit `b1c3d6b`.

### R5.2 graph-engineer — a blueprint compiles into workshop nodes
- **What**  `lib/pipeline/blueprintBridge.ts` turns a blueprint into pipeline nodes and edges,
  and writes a workshop graph back. Unknown catalog ids and unfit ports become warnings.
  Three built-in graphs: Key visual, Spoken scene, Storyboard. `applyBlueprint` replaces or
  inserts. The store seeds those three once (`startersSeeded`).
- **Why**  the blueprint store had graphs and no screen.
- **When**  round 5. U7.
- **Where**  `lib/pipeline/blueprintBridge.ts`, `stores/pipelineStore.ts`, `stores/blueprintStore.ts`,
  `tests/lib/blueprintBridge.test.ts`.
- **Who**  `breaker`, then `interface-smith`.
- **How**  `npx vitest run tests/lib/blueprintBridge.test.ts`.
- **Result**  `Test Files 1 passed (1)`, `Tests 4 passed (4)`, duration 208 ms.

### R5.3 interface-smith — home opens the graph; one wordmark
- **What**  Home → Blueprints → Open in Workshop creates a project and loads the graph after
  that project's pipeline has loaded. The workshop toolbar can replace, add beside, or save
  the current pipeline. `components/ui/Wordmark.tsx` is the mark on home, the workshop, the
  sign-in dialog, and Informations, Communauté, Forum, Magasin, Aide. Workshop toolbar and
  the home left panel use the shared surface tokens.
- **Why**  the user asked for the blueprint inside the workshop, reachable from home, and for
  the surfaces that had drifted to share one design.
- **When**  round 5.
- **Where**  `components/workshop/BlueprintShelf.tsx`, `WorkshopFlow.tsx`, `HomeLeftPanel.tsx`,
  `components/ui/Wordmark.tsx`. Prompt: `docs/merge/ROUND5_PROMPT.md`.
- **Who**  `evidence`.
- **How**  dev server on port 3010. Click Blueprints, then Open in Workshop.
- **Result**  `/home` lists three Open in Workshop actions. Opening the first created project
  `proj-5686c98b-c7f3-407c-a0f3-56aee97e2f28` titled Key visual. The live store held
  `moodboard-gen`, `style-dna`, `prompt-craft`, `keyframe-gen` and 4 edges. Technic computed
  as Instrument Serif on the workshop and on `/informations`; AI computed as
  `oklch(0.7384 0.0997 176.1)`.

### R5.4 conductor — the row stays open for the build gate
- **What**  U7 is evidenced on 3010 and by the four tests. It is not moved to done.
- **Why**  `PROGRAM.md` requires a quoted `next build`, and a dev server is serving this
  checkout. Building now would overwrite `.next` out from under it.
- **When**  round 5 close.
- **Where**  `docs/merge/BACKLOG.md` row U7. U8 stays open for `surgeon`.
- **Who**  the next round, after this server is stopped: `next build`, then move U7.
- **How**  the browser session above; no `next build` in this round.
- **Result**  open. Dev server left on `http://127.0.0.1:3010`.
