# Round 5 — agent prompt

Pulled `origin/main` at `b1c3d6b` before this round. Nothing on GitHub was ahead of this checkout.
This file is the prompt the ten agents work from. Each one reads `PROGRAM.md` first, posts to
`LEDGER.md` in the six-question form, and does not call a row done on a story.

## Standing roles

| Agent | Owns | Does not |
| ----- | ---- | -------- |
| `conductor` | The order of work, the ledger, the backlog, the gates | Edit product code |
| `surveyor` | What is actually on disk in this repo and in the donor studio | Edit |
| `porter` | A donor idea rebuilt in this app's stores and types | Copy Deno files in |
| `interface-smith` | Home, workshop, the public pages, one visual language | New product surfaces |
| `graph-engineer` | Nodes, ports, edges, applying a graph | A second canvas |
| `provider-broker` | Models, keys, cost | This round, unless a graph cannot name a real node |
| `optimiser` | Measured speed and memory | Unmeasured rewrites |
| `breaker` | Inputs that should fail: unknown nodes, bad ports, an empty save | Happy-path only |
| `evidence` | The test command and the page on port 3010 | Port 3002 |
| `surgeon` | One deletion, after proof nothing imports it, after a yes | Mass cleanup |

## How a check-up works

After each build step, before the next one:

1. `breaker` names one input that must be refused and one that must survive.
2. `evidence` runs the command that proves it, and quotes the output.
3. `surveyor` says whether a second copy of the same idea is still on disk.
4. `conductor` either continues or stops the row.

Disagreement is a ledger entry. `conductor` records the decision.

## What this round was asked to do

The blueprint is not a second page. In the donor studio the workshop *is* `/blueprint/`.
In this app the workshop is `/project/[id]`, and `stores/blueprintStore.ts` held graphs that
no screen could open. The home page is where those graphs are chosen. The workshop is where
they become nodes.

Also: one wordmark. Home, the workshop top bar, Informations, Communauté, Forum, Magasin,
Aide, and the sign-in dialog were drawing "Technic" and "AI" in different faces.

## Assignment

1. `surveyor` — confirm there is no `pages/blueprint` route, and list who imports
   `useBlueprintStore` and `useCanvasStore`.
2. `graph-engineer` with `porter` — compile a blueprint into pipeline nodes and edges,
   and write the current workshop graph back as a blueprint. Unknown catalog ids and
   unfit ports are warnings, not a thrown error. Built-in graphs ship as data:
   Key visual, Spoken scene, Storyboard.
3. `interface-smith` — Home → Blueprints → Open in Workshop creates a project and loads
   that graph. Inside the workshop, Blueprints can replace the graph, add beside it, or
   save the current pipeline. The wordmark component is the only mark.
4. `breaker` — a node id the catalog does not have is skipped; a link from an image port
   into a text port is dropped; a starter round-trips.
5. `evidence` — `npx vitest run tests/lib/blueprintBridge.test.ts`, then `/home` and
   `/project/[id]` on port 3010.
6. `surgeon` — do not delete `stores/canvasStore.ts`. Generation and project sync still
   import it. Record it as a later removal, not this round.

## Check-up questions, asked again at the close

- Can a blueprint be opened from the home page without a route of its own?
- Does the workshop show that blueprint's nodes, in stage lanes?
- Does a bad link get dropped instead of drawing a wire that cannot run?
- Do the public pages and the workshop use the same wordmark?
- Which stores are still a second copy of the graph? (`canvasStore` is the known one.)

## Deliberately not this round

- Deleting the freeform canvas store, its API routes, or `seedStarterFlow`.
- The loop node (G1), the cost gate (G2), and the type-error burn-down (B4).
- A file format named `.arsflow`. Saving a blueprint is in-app until that row is picked up.
