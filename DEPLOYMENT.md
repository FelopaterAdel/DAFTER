# Daftar — Deployment Guide

Everything you need to run Daftar online with HTTPS, a persistent database and
nightly backups.

**Decisions baked in (Phase 2):**

| Topic | Choice |
|---|---|
| Host | VPS + SQLite + Caddy + systemd (data stays with you) |
| HTTPS | Caddy automatic certificates, HTTP → HTTPS redirect |
| Database | single SQLite file on a persistent path / volume |
| Backups | nightly `scripts/backup.mjs` (14 days) + pre-restore safety copies (10) |
| PWA | installable manifest, **no service worker** (never cache money data) |

An alternative Docker path is at the end. The commands below assume `pnpm`;
if you do not have it, `corepack enable` installs it.

---

## Path A — VPS (recommended)

### 1. Server

A small VPS is enough (1 vCPU / 1 GB RAM), Ubuntu 22.04+ or Debian 12+:

```bash
sudo adduser --system --group --home /srv/daftar daftar
sudo apt update && sudo apt install -y git curl rsync nodejs npm caddy
sudo npm install -g pnpm@11
```

Node.js **22 or newer** is required (`node -v`). On Ubuntu, `apt` may ship an
older Node — use NodeSource or `nvm` if so.

### 2. DNS

Point your domain at the server, then wait for propagation:

```bash
dig +short daftar.example.com   # → your server IP
```

### 3. Get the code onto the server

```bash
git clone <your-repo> /srv/daftar
cd /srv/daftar
sudo chown -R daftar:daftar /srv/daftar
sudo -u daftar pnpm install
```

### 4. Environment

```bash
cd /srv/daftar
cp .env.example .env
nano .env
```

```env
DATABASE_URL="file:/data/daftar.db"
AUTH_SECRET="<openssl rand -hex 32>"
```

```bash
sudo install -d -o daftar -g daftar /data
sudo chmod 600 /srv/daftar/.env
```

> `AUTH_SECRET` is **required** in production: the app refuses to start without
> it rather than falling back to the development secret. If you ever change it,
> every signed-in device is signed out.

### 5. Build

```bash
cd /srv/daftar
sudo -u daftar pnpm exec prisma generate
sudo -u daftar pnpm exec prisma migrate deploy     # creates/updates /data/daftar.db
sudo -u daftar pnpm exec next build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

`output: "standalone"` in `next.config.ts` is what makes
`.next/standalone/server.js` runnable without a bundler step.

### 6. systemd

```bash
sudo cp deploy/daftar.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daftar
systemctl status daftar
```

The unit runs `prisma migrate deploy` before every start, so updating the code
also applies new migrations.

### 7. HTTPS with Caddy

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # replace daftar.example.com
sudo systemctl reload caddy
```

Caddy obtains and renews the certificate automatically; plain HTTP is
redirected to HTTPS.

### 8. First run

Open `https://daftar.example.com` — a fresh database lands on `/setup`, where
you choose the shop name and the 4-digit PIN. From then on every route
requires the PIN session.

### 9. Health check

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://daftar.example.com/login   # 200
systemctl is-active daftar                                                     # active
```

### 10. Nightly backups

```bash
cd /srv/daftar
node scripts/backup.mjs
ls -l backups/
```

Schedule it:

```bash
sudo crontab -u daftar -e
```

```cron
15 2 * * * cd /srv/daftar && node scripts/backup.mjs >> backups/backup.log 2>&1
```

Copy the files off the machine as well — a backup on the same disk as the
database only protects against mistakes, not disk loss:

```cron
30 3 * * * rsync -a /srv/daftar/backups/ user@otherhost:/backups/daftar/
```

Retention: `--keep 14` (default) daily backups, plus the last 10
`pre-restore-*.db` safety copies.

---

## Updating

```bash
cd /srv/daftar
sudo systemctl stop daftar
sudo -u daftar git pull
sudo -u daftar pnpm install
sudo -u daftar pnpm exec prisma generate
sudo -u daftar pnpm exec prisma migrate deploy
sudo -u daftar pnpm exec next build
cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static
sudo systemctl start daftar
curl -fsS -o /dev/null -w "%{http_code}\n" https://daftar.example.com/login
```

Snapshot the database first when a release includes migrations:

```bash
sudo -u daftar node scripts/backup.mjs
```

---

## Restoring

### Normal path — from the app

Settings → النسخ الاحتياطي → choose the `.db` file → confirm.
The app validates the file, saves `pre-restore-<timestamp>.db` next to the
database, swaps, signs every device out and sends you to `/login`.

### Disaster path — app will not boot

```bash
sudo systemctl stop daftar
cd /srv/daftar
DATABASE_URL="file:/data/daftar.db" node scripts/restore.mjs backups/daftar-2026-11-07.db
sudo systemctl start daftar
```

The CLI performs the same validation, keeps a safety copy, bumps
`sessionVersion` (all sessions invalid) and prints the restart command.

### Restore drill (do this once, before you need it)

1. `node scripts/backup.mjs`
2. Restore that file into a scratch path — the target must exist first, so
   start from a copy of the live database:
   ```bash
   cp /data/daftar.db /tmp/drill.db
   DATABASE_URL=file:/tmp/drill.db node scripts/restore.mjs backups/daftar-YYYY-MM-DD.db
   ```
3. Open the app against the scratch DB (`DATABASE_URL=file:/tmp/drill.db`)
   and confirm the totals.
4. Delete `/tmp/drill.db` (and the `pre-restore-*.db` copy it wrote next to it).

---

## Path B — Docker

```bash
cp .env.example .env         # set AUTH_SECRET
docker compose up -d --build
docker compose logs -f
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/login
```

- Data: named volume `daftar-data` mounted at `/data`
  (`DATABASE_URL=file:/data/daftar.db`).
- Migrations run on container start.
- Backups: `docker compose exec daftar node scripts/backup.mjs` (written to
  `./backups` on the host) — schedule that in cron.
- HTTPS: still Caddy in front, proxying to `127.0.0.1:3000` (the compose file
  only publishes loopback).
- Stop: `docker compose down` (the volume survives).

---

## PWA (installable, not offline)

`app/manifest.ts` ships an Arabic/RTL manifest with 192/512/maskable/apple
icons from `public/icons/`. On Android: Chrome menu → *تثبيت التطبيق*. On iOS:
Safari Share → *إضافة إلى الشاشة الرئيسية*.

There is deliberately **no service worker**: Daftar shows live balances, and a
cached page would lie about money. The installed app always needs a network.

Regenerate the icons after art changes: `./scripts/icons.sh` (needs
`rsvg-convert`).

---

## Security notes

- `/api/*` returns `401` JSON for unauthenticated callers; pages redirect to
  `/login`.
- Security headers (nosniff, X-Frame-Options DENY, Referrer-Policy,
  Permissions-Policy, HSTS in production) come from `next.config.ts` + Caddy.
- No CSP yet (Next inline scripts make a strict one brittle) — revisit with
  nonces later.
- SQLite is never web-reachable: it lives outside `public/`, and the Caddyfile
  blocks `/prisma`, `/backups` and `/data` paths defensively.
- Rate limits: 5 wrong PIN attempts → 5-minute lockout, tracked separately for
  login and PIN change.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AUTH_SECRET is required in production.` | Set it in `.env`; the app fails fast on purpose. |
| `Could not locate the bindings file` (better-sqlite3) | The native module was not built on install: `pnpm rebuild better-sqlite3`, or `npm run install` inside `node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3`. |
| `/setup` on every deploy | `DATABASE_URL` points at a new/empty file — check the path and that the volume is mounted. |
| `SQLITE_CANTOPEN` | Directory of `DATABASE_URL` does not exist or is not writable by the service user. |
| Migrations pending | `pnpm exec prisma migrate deploy` (systemd runs it on start). |
| 502 from Caddy | App not running: `journalctl -u daftar -n 50`. |
| Downloads blocked over HTTP | Backups/exports require the session cookie; use HTTPS (cookies are `Secure` there). |
| Disk filling up | `backups/` retention is 14 days; check `backup.log` and prune old logs. |
