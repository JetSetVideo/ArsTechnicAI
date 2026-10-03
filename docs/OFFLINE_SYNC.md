# Working offline on the Mac, syncing through the Ubuntu home server

ArsTechnicAI runs as the same Next.js app on every machine. Each machine keeps its
own projects on its own disk (`.ars-data/`, `public/generated/`), so the Mac keeps
working with no network at all. When the **home server** (the Ubuntu desktop) is
reachable, each machine syncs with it.

```
   Mac (offline-capable)                 Ubuntu desktop (home server)                OneDrive
 ┌──────────────────────┐   /api/sync   ┌─────────────────────────────────┐   mirror  ┌────────────────────────────┐
 │ UI + local API       │ ────────────▶ │ PostgreSQL  Project /           │ ───────▶ │ ArsTechnicAI/<Project>-id/ │
 │ .ars-data (projects) │ ◀──────────── │   ProjectWorkspaceState /       │          │   original file names      │
 │ public/generated     │   JWT Bearer  │   ProjectAsset                  │          │   project.arstechnic.json  │
 │ (files)              │               │ storage/blobs/<sha256> (files)  │          │   .arstechnicai-manifest   │
 └──────────────────────┘               └─────────────────────────────────┘          └────────────────────────────┘
```

| What | Where | Synced |
|------|-------|--------|
| Projects: canvas, Workshop pipeline, file tree | `.ars-data/*-<projectId>*.json` on each machine | yes — by content hash |
| Generated files referenced by a project | `public/generated/` on each machine | yes — by SHA-256, deduplicated |
| Settings and **provider API keys** | `.ars-settings.json` (mode 600) | **never** — keys stay on the machine that holds them |
| Database backups | nightly `pg_dumpall` → `~/OneDrive/Backups/postgres` (`~/scripts/pg_backup.sh`) | already in place |

## How a sync decides (lib/sync/syncEngine.ts)

Runs 5 s after load, every 2 minutes, when the browser comes back online, when the tab
becomes visible, and from **Settings → Data → Sync now**. Each machine remembers what it
last agreed with the server (per server and per account).

| Situation | Result |
|-----------|--------|
| Changed here only | pushed (the server accepts it only if nobody pushed in between) |
| Changed on another machine only | pulled |
| Changed on both | **both kept**: the server's version stays under the project, yours becomes *"Name (conflict copy · Mac · date)"* — on every machine. A notice says so. |
| Project open in an editor here, and changed elsewhere | **not replaced** under you — a notice offers **Load latest** (your unsynced work is kept as a copy first) |
| Home server unreachable | status *offline*; everything stays on this disk until the next run |

Nothing is ever deleted by sync. Removing a project on one machine does not remove it elsewhere.

## Run the home server on Ubuntu

1. `.env` / `.env.local` (git-ignored, mode 600) need `DATABASE_URL`, `REDIS_URL` and a
   `JWT_SECRET` of at least 32 random characters (`openssl rand -base64 48`). In production a
   weak or placeholder secret stops the server from issuing tokens.
2. Allow the browser origins that will call it, e.g. the Mac's dev server:
   `CORS_ALLOWED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002`
3. Optional: `ARS_STORAGE_DIR` (default `./storage`, git-ignored), `ARS_ONEDRIVE_DIR`
   (default `~/OneDrive/ArsTechnicAI` when `~/OneDrive` exists; `off` disables the mirror),
   `ARS_MAX_ASSET_BYTES` (default 2 GiB).
4. Build and start: `deno task build`, then `pm2 start ecosystem.config.cjs && pm2 save`
   (port 3002, `NODE_ENV=production`). Never run `next build` while a dev server serves the
   same checkout.
5. Sign in on the Ubuntu UI too, so its own projects reach the database and the Mac.

## Set up the Mac

1. Clone the repository and install with Deno (`deno task install` — never `npm install`).
2. In the Mac's `.env.local`, point `NEXT_PUBLIC_API_URL` at the home server — one of:
   - **Home network (recommended):** `http://192.168.1.50:3002`. UFW does not allow 3002
     today; open it to the LAN only, like Netdata:
     `sudo ufw allow from 192.168.1.0/24 to any port 3002 proto tcp`.
     No size limit beyond `ARS_MAX_ASSET_BYTES`.
   - **Anywhere:** `http://arstechnicai.freeboxos.fr` through nginx — plain HTTP until a
     certificate is issued, and files over 500 MB are refused by nginx
     (`client_max_body_size`). Sync those on the home network.
   The Mac needs no database: without one the app runs in degraded mode and saves to its
   own disk.
3. `deno task dev`, open `http://localhost:3002`, sign in (Settings → Account): the login goes to
   the home server, and its token is kept for 7 days — enough to keep working offline.

## Security model (lib/auth/requestAuth.ts)

- Every API route has a principal: a **user** (Bearer JWT from `/api/auth/*`, NextAuth as
  fallback) or, for routes that only touch this machine's disk, the **local owner** — a
  direct loopback request. Loopback trust is refused for anything that came through a
  proxy (nginx sets `X-Real-IP`), a foreign `Host` (DNS rebinding) or another site in the
  browser (`Origin` / `Sec-Fetch-Site`). It is on by default only outside production
  (`ARS_TRUST_LOOPBACK=auto|1|0`); in production even local callers sign in.
- Sync routes always need a user, and only the owner of a project can read or write it.
- Tokens: HS256 pinned, issuer/audience checked, banned/inactive accounts refused within 30 s.
- Uploaded files are hashed while streamed; a mismatch stores nothing. Served files carry
  `Content-Security-Policy: sandbox`.
- Sign-in is rate limited per IP and per account (app) and per IP again in nginx.

## Known limits

- Bundles carry canvas items, which can embed base64 images: one project push is capped
  at 100 MB.
- Files move server-to-server (`/api/sync/transfer/push|pull`): each machine's own server
  hashes and streams them, so a multi-GB video never passes through the browser (a 700 MB
  test file synced byte-identical with the page heap at ~50 MB). Largest file:
  `ARS_MAX_ASSET_BYTES` (2 GiB by default); through nginx, 500 MB (`client_max_body_size`).
  A larger nginx limit needs `proxy_request_buffering off` *and* this app on port 3002 —
  with buffering off, an unauthenticated 600 MB test stream crashed the Cursor port
  forward that was listening there instead (merge ledger R4.4).
- An editor that rewrites a project when it opens (normalising old data) counts as an
  edit: if the other machine also changed it, you get a conflict copy (never a loss).
- Each fresh device creates an empty "Untitled Project"; after syncing you will see one
  per device. They are different projects and are kept.
- Next.js serves `public/` files that existed at build time only; files generated or
  pulled later are served by a fallback route (`/api/files/generated/[name]`), so the
  UI's `/generated/…` links work in production too. Like the static files, they are
  reachable by anyone who knows the URL (backlog S3).
- **Settings → Data → Data integrity** checks this machine for real: unreadable project
  files, referenced files that are missing, and files no project uses (listed, never deleted).
- The public site (`arstechnicai.freeboxos.fr`) is plain HTTP until a certificate is
  issued (`sudo certbot --nginx -d arstechnicai.freeboxos.fr`). Until then prefer the
  home-network address.
