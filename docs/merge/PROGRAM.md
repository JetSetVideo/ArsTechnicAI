# The merge programme

Two programs exist. **`../ArsTechnicAI`** is a Deno 2 studio built on the Desktop by mistake — it is
not connected to GitHub and nothing there ships. **This repository** is the real one: Next.js 14,
Prisma, 115 module definitions, connected to `github.com/JetSetVideo/ArsTechnicAI`.

The goal of both is the same: a no-code interface for managing media with AI — analysing, generating
and versioning every asset in every format — built around an infinite canvas in the manner of
ComfyUI or Figma Weave, with a top bar (navigation, search, settings), a left panel (folders, nodes,
workflows), a bottom panel (long programmes: films, sequences, loops) and a right panel (options,
parameters, the decision tree of connected nodes and the loops that drive them).

This document is how the donor's work gets into the destination without breaking it.

## The three standing rules

1. **Prove the cause first.** Every fix names the evidence that established its cause — a log line,
   a failing command, a sidecar field, a screenshot. A plausible story is not a cause.
2. **Never delete by script.** No `rm -rf`, no glob delete, no cleanup codemod. Removals go to
   `surgeon`: one file, with proof nothing imports it, after the user says yes. Assets, uploads and
   project bundles are out of reach entirely.
3. **"Done" means it ran.** A claim of completion quotes the real output of the gates below, from
   this session. Anything else is a failed round, no matter how good the code looks.

## The ten agents

| Agent | Verb it owns | Territory |
| ----- | ------------ | --------- |
| `conductor` | plan, route, close | the ledger, the backlog, the gates |
| `surveyor` | understand | both repositories; parity maps; never edits |
| `porter` | merge, update | translating a donor feature into this app's idiom |
| `interface-smith` | improve | home, canvas, the four panels, the top bar |
| `graph-engineer` | solve | nodes, ports, edges, loops, execution |
| `provider-broker` | connect | models, keys, cost, Nano Banana |
| `optimiser` | optimise | speed and memory, always measured |
| `breaker` | break | adversarial testing before the user finds it |
| `evidence` | test | running it, photographing it, comparing runs |
| `surgeon` | delete | removals, one at a time, with approval |

Definitions live in `.claude/agents/`. Invoke one by name; it reads this file first.

## How they talk

Every agent posts to `LEDGER.md` in one form, and **answers all six questions**. "Unknown" is an
acceptable answer; a missing line is not.

```
### R<round>.<n> <agent> — <one-line subject>
- **What**  the thing done or found, concretely
- **Why**   the reason it mattered, and the evidence that established it
- **When**  round, and what it blocks or unblocks
- **Where** files, routes, ports, URLs
- **Who**   which agent acts next, and what they need
- **How**   the method, and the command anyone can re-run
- **Result** what actually happened, quoted — or `open`
```

A dispatch that disagrees with another agent says so in the same form rather than silently doing
something else. Disagreement is recorded, then `conductor` decides and records why.

## A round

1. **Intake** — `conductor` picks the next backlog row and writes the dispatch.
2. **Survey** — `surveyor` establishes the real state of both sides. No code changes.
3. **Before-shot** — `evidence` photographs the surfaces the change will touch.
4. **Build** — `porter`, `interface-smith`, `graph-engineer` or `provider-broker` does the work.
5. **Break** — `breaker` runs the battery against it.
6. **Measure** — `optimiser` where speed is claimed or at risk.
7. **After-shot and compare** — `evidence` re-shoots and runs the comparison **in chronological
   order**, reading the pictures as well as the numbers.
8. **Close** — `conductor` runs the gates, quotes them, and moves the backlog row. If a gate is red,
   the row does not move; the round stays open and says why.

## The gates

Run from the repository root; quote the real output.

**Install with Deno, never npm.** This repository sets `nodeModulesDir: "auto"` in `deno.json`, so
`node_modules/` is a tree of symlinks into `node_modules/.deno/`. Running `npm install` replaces
that with a second, parallel npm tree while `node_modules/.bin/next` still points into the Deno
store — Next then loads one React and the application another, and every page dies with
`Cannot read properties of null (reading 'useContext')`. To change a dependency: edit
`package.json`, then `deno install --allow-scripts`, then `deno run -A npm:prisma generate`.

**Never build while a dev server is running.** `next build` overwrites the `.next` directory that
`next dev` is serving from, and every route starts returning `MODULE_NOT_FOUND`. Stop the dev
server, build, start it again.

```bash
./node_modules/.bin/tsc --noEmit                 # type gate
npx next build                                    # build gate
npx next dev -p 3010                              # run gate (a port of our own; never 3002)
deno run -A tools/shot.ts --base=http://127.0.0.1:3010 --tag=<change>
deno run -A tools/shot.ts --compare shots/<older> shots/<newer>
```

## Where we are allowed to work

- **Port 3010** is this programme's dev server. **Port 3002 is the user's** — never start, stop or
  test against it, and never assume the process listening there is ours.
- The donor's live servers (`:8090` host, `:8000` engine) are the user's too. Its sandbox copies
  (`:8091` host, `:8012` engine) are ours.
- The database is off in `.env.local`, so the app runs in degraded mode. That is the normal
  condition for this work, and every surface must be legible in it.

## Definition of done, per backlog row

A row is done when: it runs on 3010; `breaker` has run the battery and its findings are closed or
recorded as accepted; `evidence` holds a before-and-after comparison with no regression; the type
and build gates are green with output quoted in the ledger; and the ledger entry answers all six
questions.

## Round 5

The dispatch for the blueprint-into-workshop pass, the shared wordmark, and the check-up
order is `docs/merge/ROUND5_PROMPT.md`. Agents still post to `LEDGER.md` in the form above.
