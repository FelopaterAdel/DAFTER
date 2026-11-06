# Daftar — Phase 2 Plan

> **Status:** In progress — 2A complete and verified; 2B next.
> **Date:** 6 November 2026
> **Baseline:** Phase 1 is complete and verified. `prisma/dev.db` is clean.
> **Goal:** make Daftar safe to trust with real money, answer “where is my money?” with reports, get data out as CSV/print, and run it online.

---

## 1. Definition of done

Phase 2 is done when all of the following are true:

- [ ] The PIN can be changed from Settings, and every other device is signed out.
- [ ] The owner can download a consistent SQLite backup from Settings.
- [ ] The owner can restore a backup, with a safety copy and a clear failure path.
- [ ] Reports exist for collections, custody debt, customer debt/aging, and warehouse stock value.
- [ ] Every report can be exported as CSV and printed / saved as PDF from the browser.
- [ ] The app can be deployed online with HTTPS, persistent SQLite storage, and scheduled backups.
- [ ] The app is installable on a phone (PWA manifest + icons), without caching private data offline.
- [ ] `tsc --noEmit`, `eslint .`, and `next build` pass.
- [ ] Test data is removed and `prisma/dev.db` is back to its pre-Phase-2 state (or contains only the owner’s real data).

If the optional sales-automation workstream (2D) is not approved, remove its checkbox from the definition of done and ship 2A–2C + 2E.

---

## 2. Current baseline (do not break these)

Phase 1 delivered:

- PIN setup/login, scrypt hashing, HMAC session cookie, proxy protection.
- Custodies, custody items (`DELIVERY` / `RETURN`), customers, charges, payments, products, stock movements.
- Collections page with today/all filters and edit forms.
- Dashboard, custody/customer statements, warehouse movements.
- `instant = false` app-wide + `connection()` in auth guards, so the app is request-time.
- Amounts stored as integer piastres; business dates as `YYYY-MM-DD`.
- Clean DB and a passing build.

Invariants Phase 2 must preserve:

1. **Custody balance** = opening + deliveries − returns + manual custody charges − custody collections.
2. **Customer balance** = charges − payments.
3. **Cash today** = custody collections (`customerId = null`) + direct-customer payments (`custodyId = null` and `customerId != null`).
4. A custody-customer payment reduces only the customer balance; it never touches the custody balance or cash.
5. A return reduces custody stock/balance and creates a linked `StockMovement` of type `IN`.
6. No receipt printing; no multi-user roles; no multi-currency.
7. All business-data mutations go through Server Actions that call `requireAuth()` and validate on the server. Backup/restore are the exception: they use route handlers because they stream or replace a file.
8. No `use cache` for user data; all pages stay request-time.

---

## 3. Scope at a glance

| # | Workstream | Outcome | Priority | Depends on |
|---|---|---|---|---|
| **2A** | Security & data safety | PIN change, session revocation, backup download, restore | P0 | — |
| **2B** | Reports | Collections by period, custody debt, customer debt + aging, warehouse value | P0 | — |
| **2C** | Export & print | CSV for every report, browser print/PDF | P1 | 2B |
| **2D** | Sales ↔ custody stock *(optional)* | Deduct sold quantities from custody stock when recording a customer charge | P2 | Decision + 2B data checks |
| **2E** | Online & PWA | Deployment, HTTPS, scheduled backups, installable manifest | P1 | Deployment target decision |

Recommended order: **2A → 2B → 2C → 2D (if approved) → 2E**. 2B can start in parallel with 2A; 2E can move earlier if going online is urgent.

### Explicitly out of scope

- Old-data import (stays the final phase).
- Receipt/thermal printing.
- Multiple users, permissions, seller accounts.
- Multiple currencies or exchange rates.
- Stock transfers between warehouses.
- Full offline sync / offline mutation queue.
- Tax invoices or formal accounting reconciliation.
- Automatic WhatsApp/SMS reminders.

---

## 4. Workstream 2A — Security & data safety

### 4.1 PIN change

**Schema**

Add to `Setting` in `prisma/schema.prisma`:

```prisma
pinChangedAt  DateTime?
sessionVersion Int      @default(1)
```

Migration name: `phase2_security`.

**Server action** — `lib/actions/auth.ts`

Add `changePinAction(previousState, formData)`:

- `requireAuth()` first.
- Read `currentPin`, `newPin`, `confirmPin`; run `normalizeDigits`.
- Validate all three with the existing 4-digit `pinSchema`.
- Reject if `newPin === currentPin` (“الرمز الجديد لازم يختلف عن القديم.”).
- Reject if `newPin !== confirmPin`.
- Rate-limit current-PIN guesses with a **separate** key, `"pin-change"`, so a wrong current PIN cannot lock normal login. Refactor `lib/auth/rate-limit.ts` so every function takes an optional key (default `"owner"`).
- Verify with `verifyPin(currentPin, setting.pinHash)`.
- On success:
  - `pinHash: hashPin(newPin)`
  - `pinChangedAt: new Date()`
  - `sessionVersion: { increment: 1 }`
  - `createSession(updated.sessionVersion)` so the current device stays signed in.
  - `clearFailedAttempts("pin-change")`
  - `revalidatePath("/settings")`
  - return `{ error: null, success: "تم تغيير الرمز السري." }`
- On wrong current PIN: `recordFailedAttempt("pin-change")` and return an Arabic error with the remaining attempts.
- On lockout: “جرّب تاني بعد X دقيقة.”

**Session versioning** — `lib/auth/token.ts`, `lib/auth/session.ts`, `lib/auth/dal.ts`

- Token payload keeps `v: 1` and adds `sv?: number`.
- `createSessionToken(version, now)` writes `sv`.
- `verifySessionToken(token, expectedVersion?)`:
  - verify signature + expiry as today;
  - if `expectedVersion` is provided, require `(payload.sv ?? 1) === expectedVersion`.
- `createSession(version = 1)`.
- `hasValidSession(expectedVersion?)` forwards the version.
- `requireAuth()` and `redirectIfAuthenticated()` pass `setting.sessionVersion`.
- Add a non-redirecting helper for route handlers:

```ts
export async function getAuthenticatedSetting() {
  await connection();
  const setting = await getSetting();
  if (!setting) return null;
  return (await hasValidSession(setting.sessionVersion)) ? setting : null;
}
```

- `proxy.ts`:
  - **Remove** the “authenticated user visiting `/login` → `/`” redirect. That decision now belongs to `redirectIfAuthenticated()`, which can see the session version. Without this, an old token after a PIN change would loop between `/login` and `/`.
  - Let `/api/*` through the proxy and enforce auth inside each route handler (otherwise unauthenticated API calls get an HTML redirect instead of `401`).

**UI** — `app/(app)/settings/page.tsx`

- Replace the “تغيير الرمز السري هيتضاف في المرحلة الجاية” note with a real form.
- Use three `Input` fields (`type="password"`, `inputMode="numeric"`, `maxLength={4}`, `dir="ltr"`):
  - الرمز الحالي
  - الرمز الجديد
  - تأكيد الرمز الجديد
- Use `ActionForm`; extend `FormState` with an optional `success` and render a success `Alert` (`tone="success"`, `role="status"`).
- On success, keep the user on Settings and show the success message.

**Acceptance**

- Wrong current PIN → Arabic error, no hash change, attempt counted under `"pin-change"`.
- New PIN equal to old → rejected.
- Mismatch confirmation → rejected.
- Success → current session remains valid; a second browser session using the old token is redirected to `/login` on its next request.
- The original PIN still works if the test is cancelled before saving.
- **Never test this against `prisma/dev.db`.** The owner’s real PIN must not be changed during development. Use the isolated test DB in §11.

### 4.2 Backup download

**Route** — `app/api/backup/route.ts` (`GET`)

- `runtime = "nodejs"`.
- Auth: `getAuthenticatedSetting()`; return `401` JSON if missing.
- Resolve the DB path from `DATABASE_URL` with a shared helper (`lib/backup/paths.ts`):
  - `file:./prisma/dev.db` → `path.join(process.cwd(), "prisma/dev.db")`
  - absolute `file:/data/daftar.db` → used as-is.
- Open with `better-sqlite3` and use its online backup API, not a raw file copy:

```ts
const source = new Database(dbPath, { readonly: true, fileMustExist: true });
const tmp = path.join(os.tmpdir(), `daftar-backup-${randomUUID()}.db`);
await source.backup(tmp);
source.close();
const bytes = await readFile(tmp);
await rm(tmp, { force: true });
```

- Return `new Response(new Uint8Array(bytes), { headers })`:
  - `Content-Type: application/vnd.sqlite3`
  - `Content-Disposition: attachment; filename="daftar-backup-YYYY-MM-DD.db"`
  - `Cache-Control: no-store, max-age=0`
- Clean up the temp file even on failure (try/finally).

**Config**

- Add `"better-sqlite3"` to `serverExternalPackages` in `next.config.ts` (the Prisma adapter already uses it, but the route imports it directly).
- Add `/prisma/backups/` and `/prisma/test.db*` to `.gitignore`.

**UI** — Settings backup card

- Replace the disabled “تحميل نسخة” button with an `<a href="/api/backup">` styled with `buttonStyles`.
- Show the DB location and a short “احتفظ بنسخة خارج الجهاز” note.

**Acceptance**

- Logged-in download returns a file named `daftar-backup-YYYY-MM-DD.db`.
- Logged-out request returns `401`, not the login HTML.
- Downloaded file passes `PRAGMA integrity_check` and opens with the app’s schema.
- Row counts in the backup match the live DB at download time.
- No temp file remains in `/tmp`.

### 4.3 Restore

Restore is the riskiest operation in Phase 2. Build it defensively.

**Route** — `app/api/restore/route.ts` (`POST`)

1. Auth with `getAuthenticatedSetting()`; `401` if missing.
2. Reject concurrent restores with a module-level `restoreInFlight` flag (`409`).
3. Read `formData().get("file")`; require a `File`.
4. Enforce max size (suggest 50 MB).
5. Write the upload to a temp file, then validate:
   - 16-byte header `SQLite format 3\0`.
   - `PRAGMA integrity_check` returns `ok`.
   - Required tables exist: `Setting`, `Custody`, `CustodyItem`, `Customer`, `Charge`, `Payment`, `Product`, `StockMovement`, `_prisma_migrations`.
   - `Setting` has exactly one row with `id = 1` and a non-empty `pinHash`.
   - The schema is current: `PRAGMA table_info(Setting)` includes `sessionVersion`; if 2D shipped, `PRAGMA table_info(Charge)` includes `itemName`, `unit`, `quantity`. Reject older/incompatible backups with a clear Arabic message instead of risking corruption.
6. Create a safety copy **before** touching the live DB:
   - `prisma/backups/pre-restore-YYYY-MM-DD-HHmmss.db`
   - Keep the last 10 safety copies; prune older ones.
7. Swap:
   - `await db.$disconnect()`
   - remove `dev.db-wal` / `dev.db-shm` if present (current DB is `journal_mode=delete`, but handle both)
   - copy validated upload over the live DB path
   - open the restored DB and run `UPDATE Setting SET sessionVersion = sessionVersion + 1 WHERE id = 1` so every existing session is invalid
   - `await db.$connect()`
8. `await destroySession()` and return `{ ok: true, redirect: "/login" }`.
9. On any failure after the swap started, copy the safety file back and return `500` with an Arabic message.

**UI** — `components/settings/restore-form.tsx` (client component)

- File input (`accept=".db,application/vnd.sqlite3"`), a “أنا متأكد” checkbox, and a submit button.
- Submit with `fetch("/api/restore", { method: "POST", body: formData })`.
- Show errors inline; on success show “تم الاسترجاع — سجّل الدخول من جديد” then `window.location.assign("/login")`.
- Do **not** use a Server Action for this: replacing the DB under a post-action re-render is exactly where the dev cookies invariant can bite.

**CLI fallback** — `scripts/restore.mjs`

For disaster recovery when the app will not boot:

```bash
# stop the app first
node scripts/restore.mjs prisma/backups/daftar-2026-11-06.db
```

It should create a safety copy, replace the DB, and print the restart command. Document it in `DEPLOYMENT.md`.

**Acceptance**

- Valid backup → data restored, session cleared, redirected to `/login`, restored PIN works.
- Non-SQLite file → `400`, live DB untouched.
- Truncated/corrupt file → `400`, live DB untouched.
- Backup missing a required table/column → `400` with a clear message.
- Two simultaneous restores → one succeeds, one gets `409`.
- Failure injected after the swap → safety copy restores the original DB.
- **Test only against `prisma/test.db`.**

### 4.4 2A file checklist

- [x] `prisma/schema.prisma` — `pinChangedAt`, `sessionVersion`
- [x] `prisma/migrations/*_phase2_security/` — generated migration
- [x] `lib/auth/token.ts` — `sv` payload + version check
- [x] `lib/auth/session.ts` — `createSession(version)`, `hasValidSession(version)`
- [x] `lib/auth/dal.ts` — pass version; `getAuthenticatedSetting()`
- [x] `lib/auth/rate-limit.ts` — keyed attempts
- [x] `lib/actions/auth.ts` — `changePinAction`
- [x] `lib/forms.ts` — optional `success`
- [x] `components/forms/action-form.tsx` — success alert
- [x] `app/(app)/settings/page.tsx` — PIN form + backup/restore cards
- [x] `app/api/backup/route.ts`
- [x] `app/api/restore/route.ts`
- [x] `lib/backup/paths.ts`
- [x] `components/settings/restore-form.tsx`
- [x] `scripts/restore.mjs`
- [x] `proxy.ts` — version-safe redirects + API passthrough
- [x] `next.config.ts` — `better-sqlite3` external + security headers
- [x] `.gitignore` — backups/test DB

---

## 5. Workstream 2B — Reports

### 5.1 Report semantics (write these down in code comments)

**Collections report**

- Cash received in the period:
  - custody collections: `Payment` where `customerId = null`
  - direct-customer payments: `Payment` where `custodyId = null` and `customerId != null`
- Excluded: custody-customer payments (`customerId != null` and `custodyId != null`) — they never touch cash.
- Group by:
  - `day` → `occurredOn`
  - `week` → Saturday-start week key (Egypt). Label with the Saturday date.
  - `month` → `YYYY-MM`
- With a `custodyId` filter, show only that custody’s collections; direct payments have no custody and are therefore excluded. Say so in the UI.

**Custody debt report**

- Reuse `getCustodyBalanceMap()` and `computeCustodyBalance`.
- Show active and inactive custodies; inactive gets a badge.
- Separate:
  - debtors (`balance > 0`), sorted descending;
  - credit/overpaid (`balance < 0`), sorted ascending;
  - zero balances can be hidden by default.
- Totals: total debt, total credit, net.

**Customer debt + aging**

- Reuse `getCustomerBalanceMap()` for the total.
- Aging uses **FIFO allocation**:
  1. Sort charges by `occurredOn`, then `createdAt`.
  2. Sort payments by `occurredOn`, then `createdAt`.
  3. Apply the payment pool to the oldest charges first.
  4. Any remaining unpaid charge goes into a bucket based on `today - occurredOn`:
     - `0–30`
     - `31–60`
     - `61+`
  5. If payments exceed charges, show a **credit** row; do not put it in an aging bucket.
- Include both custody customers and direct customers; filter by `type=all|custody|direct`.
- The sum of the buckets must equal the customer’s positive balance. This is a unit-test/acceptance check.

**Warehouse report**

- Current quantity from `getProductQuantityMap()` (`IN − OUT + ADJUST`).
- Stock value = `quantity × costPriceCents`; also show `quantity × salePriceCents` when a sale price exists.
- Status from `productStatus()`.
- Period movement summary: total IN / OUT / ADJUST quantities and counts.
- Include inactive products when they still have stock.

### 5.2 Pages

| Route | Purpose |
|---|---|
| `/reports` | Overview cards + links + current snapshots |
| `/reports/collections` | Period/grouping/custody filters, table, totals, export/print |
| `/reports/custody-debts` | Debtor table, credit table, totals, export/print |
| `/reports/customer-debts` | Aging table with bucket columns, filters, export/print |
| `/reports/warehouse` | Stock value table + movement summary, export/print |

- Every page: `await requireAuth()`, `export const instant = false`, `metadata`.
- `searchParams` is a `Promise` in Next 16 — await it.
- Use plain `<form method="get">` filters; no client-side data fetching.
- Empty states must be Arabic and specific (“مفيش تحصيل في الفترة دي.”).
- Add a `ChartIcon` (and `DownloadIcon` / `PrintIcon`) to `components/ui/icons.tsx`.
- Add “التقارير” to `primaryItems` in `components/layout/nav.tsx`. Mobile bottom nav becomes `grid-cols-6`; reduce the icon pill width and verify at 360px.
- Add report links to the dashboard and to custody/customer detail pages where useful.

### 5.3 Data layer

`lib/queries/reports.ts`:

```ts
getCollectionsReport({ from, to, groupBy, custodyId })
getCustodyDebtReport()
getCustomerDebtReport({ type, today })
getWarehouseReport({ from, to, productId })
```

- Aggregate in JS over `findMany` for now; the data volume is small and the payment semantics are easier to keep correct.
- Reuse `computeCustodyBalance`, `computeCustomerBalance`, `getProductQuantityMap`.
- Add `lib/reports/periods.ts` for `normalizeRange`, `startOfWeek`, `monthKey`, `daysBetween`.
- Add indexes only if a query becomes slow; existing `occurredOn` / `customerId` / `custodyId` indexes cover the current filters.

### 5.4 Acceptance

- Collections report total for a period equals the Collections page total for the same filters.
- Custody-customer payments never appear as cash.
- Custody debt total equals the sum of positive balance cards on `/custodies`.
- Customer aging buckets sum to each customer’s positive balance; credits are separate.
- Week grouping starts on Saturday and does not duplicate cross-month days.
- Warehouse quantity matches the product page; stock value uses cost price.
- All pages return `200` with an authenticated session and `302`/`307` to `/login` without one.
- 360px viewport: no horizontal overflow; tables scroll inside their card.

---

## 6. Workstream 2C — Export & print

### 6.1 CSV

**Helper** — `lib/reports/csv.ts`

- `toCsv(headers: string[], rows: Array<Array<string | number>>)`.
- Escape `"` by doubling; quote fields containing `,`, `"`, `\n`.
- Join with `\r\n`.
- Prefix `\uFEFF` (UTF-8 BOM) so Excel renders Arabic correctly.
- Amounts as decimal strings (`cents / 100`, e.g. `1234.50`), no `EGP` prefix, no thousands separators.
- Dates as `YYYY-MM-DD`.
- Header row in Arabic.

**Route** — `app/api/export/[report]/route.ts` (`GET`)

- `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Auth with `getAuthenticatedSetting()`; `401` JSON if missing.
- `report` ∈ `collections | custody-debts | customer-debts | warehouse`.
- Parse the same query params as the report page and call the same query functions.
- Return:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="daftar-<report>-YYYY-MM-DD.csv"`
  - `Cache-Control: no-store`
- Invalid report → `404`; invalid dates → `400`.

**UI**

- “تصدير CSV” link on each report page, preserving the current query string.
- No client-side CSV generation; the server is the source of truth.

### 6.2 Print / PDF

- `components/reports/print-button.tsx` (client) calls `window.print()`.
- Add print buttons to report pages and to custody/customer statement pages.
- Add `print:hidden` to:
  - `DesktopSidebar`, `MobileHeader`, `MobileBottomNav`
  - page header actions and filter forms
  - export/print buttons and edit/delete controls
- Add print CSS in `app/globals.css`:

```css
@media print {
  @page { size: A4; margin: 12mm; }
  body { background: #fff; }
  main { max-width: none; padding: 0; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
}
```

- Each printable page gets a small header: shop name, report title, period, print date.
- “Save as PDF” is the browser’s print dialog; no server PDF dependency.

### 6.3 Acceptance

- CSV opens in Excel/LibreOffice with correct Arabic (BOM) and no mojibake.
- CSV totals match the on-screen report.
- Exporting without auth returns `401`.
- Print preview hides navigation, filters, and action buttons.
- Tables repeat their header across pages and do not split rows.
- PDF of a statement fits A4 with RTL alignment.

---

## 7. Workstream 2D — Sales ↔ custody stock *(optional, decision-gated)*

> README currently lists this under Phase 3. Include it in Phase 2 only if the owner approves the shortfall policy below.

### 7.1 Problem

Today a customer charge increases the customer’s debt, but it does **not** reduce the custody’s stock. The owner has to remember to deduct sold quantities separately. 2D links a charge to a custody stock item.

### 7.2 Decision needed: shortfall policy

Pick one before coding:

| Option | Behavior |
|---|---|
| **A. Block (recommended)** | Cannot record a sale larger than the available stock for that item. Clear Arabic error. |
| B. Warn and allow | Allow negative stock, show a warning. |
| C. Allow with override | Block by default; a checkbox “بدون خصم من المخزون” records the charge without linking stock. |

Recommendation: **A**, plus the existing “no item link” path for charges that are not stock sales. Do not retroactively deduct old charges.

### 7.3 Schema

Add to `Charge`:

```prisma
itemName String?
unit     String?
quantity Int?
```

- Nullable, so existing charges and non-stock charges are unaffected.
- `quantity` is required only when `itemName` is set.
- Migration name: `phase2_sales_stock`.

### 7.4 Logic

- Extend `computeStockGroups(items, sales = [])` in `lib/queries/balances.ts` (defaulting to `[]` keeps every existing caller working):
  - `sales` = charges for this custody where `itemName != null`.
  - Group by `name + unit`, same as deliveries/returns.
  - Add `soldQty` and `soldValue`.
  - `netQty = deliveredQty − returnedQty − soldQty`.
  - `netValue = deliveredValue − returnedValue − soldQty × averageUnitPriceCents`.
  - With zero sales this must equal today’s numbers.
- **Custody balance is unchanged by a sale.** The customer owes the seller; the custody’s debt to the owner does not change. Only stock quantity changes.
- `createChargeAction`:
  - If `itemName` is present, require a custody customer.
  - Read `itemName`, `unit`, `quantity` (positive int).
  - Compute available stock for that name+unit inside a transaction.
  - If `quantity > available`, return the Arabic shortfall error; do not write.
  - Create the charge with the item fields.
- `updateChargeAction` (if/when added) must re-check availability. Deleting a charge automatically reverses the deduction because stock is computed from charge rows.
- No separate mutable “sold” counter, so there is nothing to drift.

### 7.5 UI

- Customer detail charge form (only for custody customers):
  - optional “خصم من مخزون العهدة” section;
  - item select populated from the custody’s stock groups (name + unit, available quantity shown);
  - quantity input;
  - hint: “الكمية هتتخصم من مخزون العهدة، والرصيد مش هيتأثر.”
- Custody stock tab:
  - columns: delivered, returned, sold, remaining;
  - remaining must never go negative under policy A.
- Customer ledger:
  - sale description shows `itemName × quantity` in the note/description.
- Direct customers never see this section.

### 7.6 Acceptance

- Sale of 3 units from 5 available → stock becomes 2, customer balance increases by the charge amount, custody balance unchanged.
- Sale of 6 from 5 → blocked, no charge row, no stock change.
- Delete the charge → stock returns to 5.
- Existing charges with null item fields behave exactly as before.
- Refreshing the page and re-running the reports shows consistent quantities.
- The database transaction prevents a partial write on failure.

---

## 8. Workstream 2E — Online & PWA

### 8.1 Deployment target

Recommended: **VPS + SQLite + Caddy + systemd**, because data stays with the owner and backups are simple.

- Persistent path: `/data/daftar.db` (or a mounted volume).
- `.env`:
  - `DATABASE_URL=file:/data/daftar.db`
  - `AUTH_SECRET=<openssl rand -base64 32>`
- `next.config.ts`: `output: "standalone"` if using the Docker/standalone path.
- HTTPS via Caddy; HSTS in production.
- First run goes to `/setup`; then the owner creates the real PIN.

Deliverables:

- [ ] `DEPLOYMENT.md` — VPS steps, DNS, Caddy, systemd, backup cron, restore drill.
- [ ] `.env.example`
- [ ] `deploy/Caddyfile`
- [ ] `deploy/daftar.service`
- [ ] `Dockerfile` + `docker-compose.yml` (optional alternative; persistent volume for `/data`).
- [ ] `scripts/backup.mjs` — online SQLite backup to `backups/daftar-YYYY-MM-DD.db`, keep 14 days.
- [ ] Cron example: `15 2 * * * cd /srv/daftar && node scripts/backup.mjs`.
- [ ] Health check: `GET /login` returns `200`.

### 8.2 Security headers

Add to `next.config.ts`:

- `poweredByHeader: false`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` in production only

Do not add a strict CSP in Phase 2; Next’s inline scripts make it easy to break the app. Revisit with nonces later.

### 8.3 PWA (installable only)

- `app/manifest.ts`:
  - `name: "دفتر — إدارة العهد والتحصيل"`
  - `short_name: "دفتر"`
  - `lang: "ar"`, `dir: "rtl"`
  - `start_url: "/"`, `scope: "/"`
  - `display: "standalone"`
  - `background_color: "#f7f3ea"`, `theme_color: "#17553d"`
  - icons: 192, 512, maskable 512, Apple touch icon.
- Add `public/icons/*.png` (generate once; keep them in the repo).
- `app/layout.tsx`: verify the manifest link is emitted; update `viewport.themeColor` to the brand green.
- **No service worker in Phase 2.** Daftar shows live money data; caching authenticated HTML risks stale balances. The app is installable but requires a network connection.
- Add a short “ثبّت دفتر على شاشتك” note in Settings.

### 8.4 Acceptance

- Fresh server + empty volume → `/setup` works; data persists across restart.
- HTTPS is enforced; HTTP redirects.
- `AUTH_SECRET` missing in production → app fails fast instead of using the dev secret.
- Downloading a backup through the public URL works after login.
- Cron creates a valid backup; restore drill succeeds on a copy.
- Manifest validates; Android/iOS “Add to Home Screen” opens standalone.
- No private page is cached by a service worker.
- `next build` and `next start` pass with an absolute `DATABASE_URL`.

---

## 9. Cross-cutting engineering rules

- Every new page calls `await requireAuth()` and exports `instant = false`.
- Every Server Action calls `await requireAuth()`, validates all input server-side, returns `FormState` with Arabic errors, and revalidates every affected path.
- Route handlers never redirect to `/login`; they return `401` JSON.
- Amounts remain integer piastres; never use floats for money.
- Dates remain `YYYY-MM-DD`; parse/format through `lib/dates.ts`.
- Use `cache()` for per-request settings; never `use cache` for user data.
- Prefer server components; client components only for `window.print`, file upload, and `useActionState`.
- Keep the existing visual language: warm paper background, white cards, green primary, gold accents, large numbers.
- Arabic UI strings should match the existing Egyptian tone; errors must say what to do next.
- Before writing code, read the Next 16 docs bundled in `node_modules/next/dist/docs/` for route handlers, metadata/manifest, caching, and `connection()`.
- This repo is **not** a git repo. Do not rely on commits; rely on DB snapshots and file backups.

---

## 10. Execution order and checkpoints

### Checkpoint 0 — Prepare

- [ ] Confirm the scope decisions in §12.
- [ ] Snapshot the live DB:

```bash
mkdir -p /tmp/opencode
cp prisma/dev.db /tmp/opencode/daftar-pre-phase2.db
node -e "const D=require('better-sqlite3');const d=new D('/tmp/opencode/daftar-pre-phase2.db',{readonly:true});console.log(d.pragma('integrity_check'));d.close()"
```

- [x] Read the relevant Next 16 docs.
- [x] Create `scripts/seed-test.mjs` and generate `prisma/test.db` with a known PIN and known balances.
- [x] Confirm `prisma/dev.db` is clean.

### Checkpoint 1 — 2A

- [x] Migration applied.
- [x] PIN change + session revocation tested on `prisma/test.db`.
- [x] Backup download verified.
- [x] Restore verified including failure paths.
- [x] `tsc`, `eslint`, `next build` pass.
- [x] `prisma/dev.db` untouched (compare row counts and hash with the snapshot).

### Checkpoint 2 — 2B

- [x] Four report pages + overview.
- [x] Report totals match existing pages for the same filters.
- [x] Aging buckets sum correctly.
- [x] Mobile 360px verified.
- [x] `tsc`, `eslint`, `next build` pass.

Verified on `prisma/test.db` (PIN `1234`): collections EGP 320 (custody 300 + direct 20, custody-customer payment excluded); custody debt EGP 1,300 (net); customer debts EGP 200 with FIFO buckets summing to the balance; warehouse quantity 6 and cost value EGP 180. Inactive products with stock stay visible; zero-stock inactive products are hidden. Week grouping starts Saturday 31/10/2026. All report routes redirect to `/login` without a session and return `200` with one. At 360px the document width stays 360 and all six bottom-nav items fit (57px each); desktop 1280px has no overflow.

### Checkpoint 3 — 2C

- [ ] CSV for all four reports; BOM + Arabic headers verified in LibreOffice/Excel.
- [ ] Print CSS verified via browser print preview.
- [ ] Statement print buttons added.
- [ ] `tsc`, `eslint`, `next build` pass.

### Checkpoint 4 — 2D (only if approved)

- [ ] Shortfall policy implemented.
- [ ] Stock tab shows sold quantities.
- [ ] Charge create/delete round-trip verified.
- [ ] Custody balance unchanged by sales.
- [ ] `tsc`, `eslint`, `next build` pass.

### Checkpoint 5 — 2E

- [ ] Deployment doc + files.
- [ ] Fresh deploy, HTTPS, persistent volume.
- [ ] Backup cron + restore drill.
- [ ] Manifest/icons verified on a phone.
- [ ] Security headers verified.
- [ ] `tsc`, `eslint`, `next build` pass.

### Checkpoint 6 — Close

- [ ] Update `README.md`: status line, Phase 1 checkboxes, Phase 2 section, new report routes, backup/restore instructions.
- [ ] Update Settings copy (remove “قريبًا” badges that are now live).
- [ ] Delete `prisma/test.db`, `prisma/test.db-*`, and test backups.
- [ ] Re-run the full verification matrix.
- [ ] Confirm `prisma/dev.db` still has the owner’s data and the original PIN.

---

## 11. Test isolation (important)

The owner’s real PIN must not be used for development tests. Do not run PIN-change or restore tests against `prisma/dev.db`.

**Fixture approach**

1. Stop the dev server.
2. Copy the clean DB:

```bash
cp prisma/dev.db prisma/test.db
```

3. Run `scripts/seed-test.mjs` against `prisma/test.db`:
   - set `pinHash` to a known hash for `1234` (same scrypt parameters and `scrypt$N$r$p$salt$hash` format as `lib/auth/pin.ts`);
   - seed one custody with a known opening balance, delivery, return, customer charge/payment, one direct customer, and one product with IN/OUT/ADJUST movements;
   - print the expected balances and aging buckets.
4. Start the app against the test DB:

```bash
DATABASE_URL=file:./prisma/test.db \
AUTH_SECRET=test-secret \
./node_modules/.bin/next dev -p 3000
```

5. Run the checks with PIN `1234`.
6. Stop the server; restart with the normal `.env` and `prisma/dev.db`.
7. Delete the test DB and test backups.

**Test matrix**

| Test | How | Expected |
|---|---|---|
| Login with test PIN | `/login` | dashboard |
| Wrong PIN x5 | `/login` | lockout message, then unlock after 5 min or restart |
| Change PIN | `/settings` | success; old token rejected in a second browser |
| Backup download | `/api/backup` | valid SQLite file |
| Backup unauthenticated | `curl` without cookie | `401` |
| Restore valid backup | `/api/restore` + file | data restored, redirected to `/login` |
| Restore invalid file | upload a text file | `400`, DB unchanged |
| Collections report | known fixture | totals match `computeCustodyBalance` / cash rules |
| Customer aging | known fixture | buckets sum to positive balance |
| Warehouse report | known fixture | quantity = IN − OUT + ADJUST |
| CSV export | report page link | BOM, Arabic headers, correct totals |
| Print preview | browser print | nav/filters hidden, table header repeats |
| Mobile | 360px viewport | no horizontal overflow |

---

## 12. Open decisions

Answer these before the related checkpoint. Defaults are recommendations.

| # | Decision | Recommendation | Default if no answer |
|---|---|---|---|
| 1 | Is sales automation (2D) in Phase 2? | Approve it only after 2A–2C; it is the highest-risk scope. | Defer to Phase 3, as README currently says. |
| 2 | Shortfall policy for 2D | Block the sale; allow unlinked charges for exceptions. | Block. |
| 3 | Deployment target | VPS + SQLite + Caddy + systemd. | VPS + SQLite. |
| 4 | PWA depth | Installable manifest only; no service worker. | Manifest only. |
| 5 | Week start for reports | Saturday (Egypt). | Saturday. |
| 6 | PDF approach | Browser print → Save as PDF. | Browser print. |
| 7 | Restore behavior | Hot swap with safety copy + CLI fallback. | Hot swap. |
| 8 | Backup retention | 14 daily backups + last 10 pre-restore safety copies. | 14 / 10. |

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Restore corrupts the live DB | Validate header/integrity/schema first; safety copy before swap; rollback on failure; reject concurrent restores; test on `prisma/test.db`. |
| PIN change locks the owner out | Require the current PIN; keep the current session; separate rate-limit key; test with a known PIN on a test DB. |
| Session revocation breaks other devices unexpectedly | Intended after a PIN change; document it in the success message: “الأجهزة التانية هتخرج.” |
| Report totals disagree with existing pages | Centralize formulas in `lib/queries/balances.ts`; acceptance compares report totals with page totals. |
| Aging allocation bugs | FIFO algorithm documented; sum-of-buckets assertion; fixture with multiple charges/payments. |
| Excel mangles Arabic CSV | UTF-8 BOM + CRLF; test in LibreOffice and Excel. |
| Next 16 caching/prerender surprises | `instant = false`, `connection()` in guards, dynamic route handlers, `next build` in every checkpoint. |
| PWA caches stale money data | No service worker in Phase 2. |
| Sales automation double-deducts | Derive stock from charge rows; no mutable counters; transaction around validation + insert. |
| Migration data loss | Snapshot before every migration; never run `prisma migrate reset`; test migration on a copy first. |
| Backup route leaks the DB | `getAuthenticatedSetting()` + `401`; `Cache-Control: no-store`; no public directory. |

---

## 14. Commands (pnpm is not on PATH)

```bash
# typecheck / lint / build
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/next build

# dev server
./node_modules/.bin/next dev -p 3000

# prisma
./node_modules/.bin/prisma migrate dev --name phase2_security
./node_modules/.bin/prisma generate

# DB integrity
node -e "const D=require('better-sqlite3');const d=new D('prisma/dev.db',{readonly:true});console.log(d.pragma('integrity_check'));d.close()"
```

---

## 15. Completion checklist

- [x] 2A security & data safety shipped and verified.
- [x] 2B reports shipped and verified.
- [ ] 2C CSV + print shipped and verified.
- [ ] 2D sales automation shipped *(only if approved)*.
- [ ] 2E deployment + PWA shipped and verified.
- [ ] README and Settings copy updated.
- [x] Test DB and test backups removed after 2A.
- [ ] Live DB intact, original PIN intact.
- [ ] `tsc`, `eslint`, `next build` pass.
- [ ] Owner has a downloaded backup and knows where the restore CLI lives.
