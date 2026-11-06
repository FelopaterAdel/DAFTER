# Daftar — Custody & Daily Collection Manager

> **Status:** Phase 0 complete — foundation ready; Phase 1 next.
> **Version:** 1.2 — November 2026
> **Currency:** Egyptian Pound (EGP)
> **Language:** Arabic UI (RTL), mobile-first.

---

## 1. Overview

**Daftar** (دفتر) is a web app for managing goods sold on credit through sellers/distributors called **custodies** (عهد). It tracks each custody's stock, customers, and balance, records **daily collections** from each custody, and manages a **personal warehouse** plus **direct customers without a custody**.

### The problem

- Accounts are scattered across paper notebooks and WhatsApp.
- Hard to know each custody's and customer's balance at any moment.
- Daily collections are not documented and can be lost or duplicated.
- Personal warehouse quantities and value are unknown.
- Direct customers (tracked by country/region) have no organized record.

### The solution

One simple system with:

1. **Custodies** — each has stock, customers, and a balance.
2. **Daily collections** — record the amount received from each custody every day.
3. **My warehouse** — products, quantities, and stock in/out movements.
4. **Direct customers** — name, country/region, amount, and note.
5. **Statements and reports** — know exactly where your money is.

---

## 2. Glossary

| Term | Meaning in the system |
|---|---|
| **Custody** (عهدة) | A seller/distributor holding your goods and carrying a balance. |
| **Custody stock** (بضاعة العهدة) | Items and quantities delivered to a custody; increases its debt. |
| **Custody return** (مرتجع) | Goods returned from a custody; reduces its stock/balance and is added to my warehouse. |
| **Collection** (تحصيل) | Money received from a custody (a general payment on account). |
| **Customer** (زبون) | Someone who bought on credit; either belongs to a custody or is direct. |
| **Charge** (استحقاق) | An amount owed by a customer (increases their balance). |
| **Custody customer payment** | Money paid by the customer to the custody seller; reduces the customer's balance only. |
| **Direct customer payment** | Money paid by your direct customer to you; reduces their balance and increases today's cash. |
| **My warehouse** (مخزني) | Your own stock, not delivered to anyone. |
| **Balance** (رصيد) | Charges − payments. |

> **Golden rule:** a custody's balance with you is separate from its customers' balances.
> When a customer pays the seller, that does not mean the seller paid you.
> **Cash today** = custody collections + payments from your direct customers only.

---

## 3. User and access

- **Single user** (you) — PIN-based login.
- First run: setup screen (shop name + PIN + confirmation).
- Afterwards: login screen with the PIN.
- Session stored in a signed cookie for 30 days, with a logout option.
- PIN is hashed (scrypt); login attempts are rate-limited.
- No multi-user roles or employee accounts in the current version.

---

## 4. Scope

### In scope — Phase 1 (MVP)

- System setup and PIN.
- Custody management: create, edit, deactivate, search.
- Custody stock: add items with quantities and prices.
- Custody returns: deduct from custody stock and balance, and add the goods to my warehouse.
- Custody customers: create, balances, payments (paid to the seller).
- Direct customers: name + country + amount + note + payments (paid to you).
- Daily collections: create, edit, delete, filter by date and custody.
- My warehouse: products, quantities, stock in/out, movement log.
- Dashboard with totals, today's cash, and recent activity.
- Simple statement for each custody and each customer.

### Out of scope for now (later phases)

- Automatically deducting customer sales from custody stock.
- Stock transfers between warehouses.
- Tax invoices or formal accounting reconciliation.
- Multiple users and permissions.
- Native mobile apps (iOS/Android).
- Multiple currencies.
- Barcodes and thermal printing.
- WhatsApp/SMS reminders.
- Full offline sync (PWA).
- Importing old data (final phase).

---

## 5. Data model

### Relationship diagram

```
Setting (singleton)

Custody 1 ──< CustodyItem (delivery / return)
   │
   ├──< Customer (custody customer, optional)
   │        ├──< Charge
   │        └──< Payment (customer payment)
   ├──< Charge (manual custody charge)
   └──< Payment (custody collection)

Product 1 ──< StockMovement
```

### Tables and fields

#### `Setting` — system settings (single row)

| Field | Type | Notes |
|---|---|---|
| `id` | Int | Always 1 |
| `shopName` | String | Business/shop name |
| `pinHash` | String | Hashed PIN |
| `currency` | String | `EGP` by default |
| `createdAt` / `updatedAt` | DateTime | — |

#### `Custody` — custody account

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | — |
| `name` | String | Unique, required |
| `phone` | String? | Optional |
| `note` | String? | General note |
| `openingBalanceCents` | Int | Opening balance (default 0) |
| `isActive` | Boolean | Default true |
| `createdAt` / `updatedAt` | DateTime | — |

#### `CustodyItem` — custody stock movement (delivery or return)

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `custodyId` | String | Foreign key |
| `type` | `DELIVERY` \| `RETURN` | Delivered to or returned from the custody |
| `name` | String | Item name |
| `unit` | String? | Piece/box/kg |
| `quantity` | Int | Whole units |
| `unitPriceCents` | Int | Price per unit |
| `note` | String? | — |
| `occurredOn` | String | Business date `YYYY-MM-DD` |
| `productId` | String? | For returns: the warehouse product that receives the goods |
| `createdAt` | DateTime | — |

**Line value** = `quantity × unitPriceCents`.
A **delivery** increases the custody balance; a **return** decreases it.

**Returns:** a return decreases custody stock/balance and creates a warehouse `StockMovement` of type `IN` for the linked `productId`, so the goods appear immediately in my warehouse. The movement is linked to the return and removed with it.

**Custody stock per item** (Phase 1) = sum of delivered quantities − sum of returned quantities, grouped by item name.
> Once sales are linked to stock (Phase 2), sold quantities will also be deducted.

#### `Customer` — customer

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `name` | String | Required |
| `phone` | String? | Optional |
| `country` | String? | Required for direct customers (no custody) |
| `custodyId` | String? | `null` = direct customer |
| `note` | String? | — |
| `createdAt` / `updatedAt` | DateTime | — |

#### `Charge` — amount owed

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `custodyId` | String? | Charge on the custody (no customer) |
| `customerId` | String? | Charge on a customer |
| `amountCents` | Int | Positive |
| `occurredOn` | String | `YYYY-MM-DD` |
| `note` | String? | Reason/description |
| `createdAt` | DateTime | — |

> Every charge must belong to a custody or a customer (at least one).
> Customer charges do not affect the custody balance.

#### `Payment` — collection or customer payment

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `custodyId` | String? | `null` for a direct customer payment |
| `customerId` | String? | `null` for a general custody collection |
| `amountCents` | Int | Positive |
| `occurredOn` | String | `YYYY-MM-DD` |
| `note` | String? | — |
| `createdAt` | DateTime | — |

**The three payment cases:**

| Case | `custodyId` | `customerId` | Effect |
|---|---|---|---|
| Custody collection | set | `null` | Reduces custody balance + counts as cash received |
| Custody customer payment | set | set | Reduces the customer's balance only (money went to the seller) |
| Direct customer payment | `null` | set | Reduces the customer's balance + counts as cash received |

#### `Product` — item in my warehouse

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `name` | String | Unique |
| `unit` | String? | — |
| `costPriceCents` | Int | Cost price |
| `salePriceCents` | Int? | Sale price (optional) |
| `lowStockThreshold` | Int | Low-stock alert threshold (default 0) |
| `note` | String? | — |
| `isActive` | Boolean | — |
| `createdAt` / `updatedAt` | DateTime | — |

#### `StockMovement` — my warehouse movement

| Field | Type | Notes |
|---|---|---|
| `id` | String | — |
| `productId` | String | — |
| `type` | `IN` \| `OUT` \| `ADJUST` | Stock in / out / adjustment |
| `quantity` | Int | Positive |
| `unitPriceCents` | Int? | Movement price (optional) |
| `occurredOn` | String | `YYYY-MM-DD` |
| `note` | String? | — |
| `custodyItemId` | String? | Set when this movement was created by a custody return (unique) |
| `createdAt` | DateTime | — |

**Suggested indexes:** `Custody.name`, `Customer.custodyId`, `Customer.country`, `Charge.occurredOn`, `Payment.occurredOn`, `StockMovement(productId, occurredOn)`.

---

## 6. Calculation rules

```
Custody balance =
    openingBalance
  + sum(deliveries: quantity × unit price)
  − sum(returns: quantity × unit price)
  + sum(manual custody charges)
  − sum(custody collections)

Customer balance =
    sum(customer charges)
  − sum(customer payments)

Total custody debt =
    sum of balances of active custodies

Custody customers' debt (informational — owed to the sellers) =
    sum of custody-customer balances

Direct customers' debt (owed to you) =
    sum of direct-customer balances

Total owed to you =
    total custody debt + direct customers' debt

My warehouse value =
    sum(current quantity × cost price)

Current product quantity =
    sum(IN) − sum(OUT) ± ADJUST

Cash today =
    sum(custody collections today)
  + sum(direct customer payments today)

Net custody stock per item =
    sum(delivered quantity) − sum(returned quantity)
```

### Key accounting decisions

1. **Daily collection** is a general payment against a custody; no customer must be selected.
2. **A custody customer's payment** does not reduce the custody balance, because the money went to the seller, not to you.
3. **A direct customer's payment** reduces their balance and counts as cash received by you.
4. **Custody stock** is the basis of the custody's debt to you.
5. **Returns** reduce both custody stock and the custody balance, and add the returned quantity to my warehouse as an `IN` movement.
6. **Opening balance** allows starting with existing balances without entering full history.
7. All amounts are stored as **integer piastres** (`Cents`) to avoid floating-point errors.

---

## 7. Screens

### 7.1 Initial setup `/setup`

- Shop name.
- PIN (exactly 4 digits) + confirmation.
- “Start using Daftar” button.
- Shown only once, when no `Setting` exists.

### 7.2 Login `/login`

- PIN field + login button.
- Clear error messages.
- After 5 failed attempts: temporary 5-minute lockout.

### 7.3 Dashboard `/`

**Summary cards:**

- Total custody debt.
- Total owed to you (custody debt + direct customer debt).
- Today's cash (count + amount), with a breakdown: custody collections vs direct customer payments.
- My warehouse value.
- Direct customers' debt (owed to you).
- Custody customers' debt (informational — owed to the sellers).
- Number of active custodies.

**Sections:**

- Last 5 collections.
- Top 5 custodies by debt.
- Low-stock products.
- Quick actions: “New collection”, “New custody”, “New customer”, “New product”.

### 7.4 Custodies `/custodies`

- Search by name/phone.
- Filter: active / inactive / all.
- Table: name, phone, customer count, balance, status, actions.
- On mobile: cards instead of a table.
- “New custody” opens a form (name, phone, note, opening balance).

### 7.5 Custody details `/custodies/[id]`

**Header:** name, phone, status, current balance, actions (collect, return, edit, deactivate).

**Tabs:**

1. **Stock:** items table (name, delivered, returned, net quantity, unit price, value, note) + totals + “Add stock” / “Record return”.
2. **Customers:** the custody's customers and their balances + “New customer” + link to each customer.
3. **Statement:** all movements newest first (deliveries / returns / charges / collections) with a running balance and date filter.
4. **Notes:** custody note and general notes.

### 7.6 Customers `/customers`

- Two tabs: **Custody customers** / **Direct customers**.
- Filters: custody, country, search by name/phone.
- Table: name, custody or country, balance, last payment.
- Add customer:
  - Custody customer: select a custody (required).
  - Direct customer: country/region name (required).

### 7.7 Customer details `/customers/[id]`

- Current balance card + customer info.
- Movements table (charges + payments) with a running balance.
- “Add charge” (amount + date + note).
- “Record payment” (amount + date + note).
- The payment hint changes by type:
  - Custody customer: “Paid to the custody seller — does not affect your custody balance.”
  - Direct customer: “Paid to you — counts as cash received.”

### 7.8 Daily collections `/collections`

**Quick form at the top (custody collection):**

- Date (defaults to today).
- Custody (searchable dropdown).
- Amount.
- Note.
- “Record collection” button.

**Today's summary:**

- Total cash today.
- Custody collections total.
- Direct customer payments total.
- Number of operations.
- Breakdown by custody.

**Direct customer payments section:**

- List of today's direct customer payments.
- Quick “Record payment” action (select direct customer + amount).

**Collection log:**

- Filters: from date – to date, custody.
- Table: date, custody, amount, note, actions (edit/delete).
- Total for the filtered period.

### 7.9 My warehouse `/warehouse`

**Products tab:**

- Search.
- Table: product, unit, current quantity, cost, value, status (in stock / low / out of stock).
- “New product” and “Stock in/out”.

**Movements tab:**

- Filters: product, type, period.
- Table: date, product, type, quantity, price, note.

### 7.10 Settings `/settings`

- Shop name.
- Change PIN (after entering the old one).
- Currency (locked to EGP for now).
- Backup: download the database file.
- Logout.
- About.

---

## 8. A day in the life

1. **Morning:** open the dashboard and review yesterday's collections and custody balances.
2. **Deliver goods:** open the custody → “Add stock” → record items, quantities, and prices → the custody balance increases.
3. **Customer buys:** open the customer → “Add charge” → record the amount → the customer balance increases.
4. **Customer pays the seller:** record a “customer payment” → the customer balance decreases; the custody balance stays the same.
5. **Goods returned from a custody:** open the custody → “Record return” → stock and balance decrease, and the returned quantity is added to the linked product in my warehouse.
6. **End of day:** open “Daily collections” → record the amount received from each custody → the custody balance decreases.
7. **Direct customer:** “Customers without custody” → name + country + amount + note, then track payments the same way (these count as your cash).
8. **Review:** the custody statement shows stock, returns, collections, and the current balance.

---

## 9. Reports and export

### Phase 1

- Custody statement (movements + running balance).
- Customer statement.
- Daily cash summary (custody collections + direct customer payments).

### Phase 2

- Daily/weekly/monthly collection report.
- Custody debt report.
- Customer debt report with aging buckets (0–30, 31–60, 60+ days).
- Warehouse movement and stock value report.
- Printable/PDF statements (no receipt printing).
- CSV/Excel export.

> Receipt printing is out of scope. Statement printing/PDF is optional in Phase 2.

---

## 10. Tech stack and architecture

### Stack

| Part | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router) |
| Language | TypeScript |
| Database | SQLite via Prisma 7 + `better-sqlite3` |
| Styling | Tailwind CSS v4 |
| Icons | Custom SVGs or a lightweight library |
| Font | Clear Arabic font (Cairo / IBM Plex Sans Arabic) |
| Auth | PIN + signed session cookie |
| Deployment | Decided later (VPS with persistent disk or cloud Postgres) |

### Why SQLite?

- Single file, easy to back up.
- Very fast for a single-business dataset.
- No separate database server.
- Note: not suitable for serverless hosting without a persistent disk; we will choose a suitable host at deployment time.

### Proposed project structure

```
app/
  (auth)/
    login/page.tsx
    setup/page.tsx
  (app)/
    layout.tsx              ← sidebar / bottom navigation
    page.tsx                ← dashboard
    custodies/
      page.tsx
      [id]/page.tsx
    customers/
      page.tsx
      [id]/page.tsx
    collections/page.tsx
    warehouse/page.tsx
    settings/page.tsx
  layout.tsx                ← RTL + font + colors
  globals.css
lib/
  db.ts                     ← Prisma Client
  auth.ts                   ← session + PIN
  money.ts                  ← piastre conversion and formatting
  dates.ts                  ← business dates YYYY-MM-DD
  validation.ts             ← validation rules
  queries/                  ← read queries
  actions/                  ← write Server Actions
components/
  ui/                       ← buttons, cards, inputs, tables, modals
  layout/                   ← navigation, header
  forms/                    ← custody/customer/collection forms
prisma/
  schema.prisma
  dev.db                    ← gitignored
```

### Technical decisions

- **Money:** integer piastres + a single formatting helper (`EGP 1,234.50`, Latin digits).
- **Dates:** `YYYY-MM-DD` strings for business dates to avoid timezone issues; display as `DD/MM/YYYY`.
- **Deletion:** custodies/products with movements are deactivated instead of deleted; movements are deleted after confirmation.
- **Validation:** Server Actions + double validation (client/server).
- **Security:** `httpOnly` + `sameSite=lax` + `secure` in production.
- **Access:** all pages protected except `/login` and `/setup`.
- **Responsive:** mobile-first, works from 360px and scales to desktop.
- **RTL:** `dir="rtl"` and `lang="ar"` on the root.
- **Overpayment:** blocked in Phase 1 (a payment cannot exceed the customer's/custody's balance).

### Visual direction (proposal)

- Warm light background, white cards, soft borders.
- Primary color: deep green or royal blue; semantic colors: green for collections, red for debt.
- Clear, large numbers — especially balances.
- No decorative clutter; optimize for quick reading.

---

## 11. Implementation phases

### Phase 0 — Foundation

- [x] Clean dependencies and a fresh install.
- [x] Prisma + SQLite + first migration.
- [x] RTL, font, colors, and navigation.
- [x] Session and PIN system (setup + login + protection).
- [x] Core UI components (button, input, card, table, modal, confirm).

### Phase 1 — Core features

- [ ] Custodies: list + create/edit + details.
- [ ] Custody stock (deliveries).
- [ ] Custody returns.
- [ ] Customers (custody + direct) + balances.
- [ ] Charges and customer payments.
- [ ] Daily collections + filters.
- [ ] My warehouse: products + movements.
- [ ] Dashboard totals and today's cash.
- [ ] Statements.

### Phase 2 — Reports and polish

- [ ] Daily/monthly reports.
- [ ] CSV/Excel export.
- [ ] Statement printing/PDF.
- [ ] Advanced search and saved filters.
- [ ] Debt aging.
- [ ] One-click backup and restore.

### Phase 3 — Expansion

- [ ] Link sales to automatic custody stock deduction.
- [ ] Warehouse transfers.
- [ ] PWA / offline support.
- [ ] Multiple users.
- [ ] Collection reminders.
- [ ] Online deployment + scheduled backups.
- [ ] Import old data (final task).

---

## 12. Acceptance criteria

### Custodies

- Creating a custody shows it immediately in the list with a balance of 0.
- Delivering goods worth EGP 1,000 raises the balance to 1,000.
- Collecting EGP 300 lowers the balance to 700.
- Returning goods worth EGP 200 lowers the balance to 500 and reduces custody stock.
- Editing/deleting stock, returns, or collections recalculates the balance immediately.
- A custody with movements cannot be deleted; it is deactivated instead.

### Customers

- A custody customer appears under “Custody customers” within their custody.
- A direct customer must have a country and appears in the other tab.
- A charge of 500 and a payment of 200 → balance 300.
- A custody customer's payment does not change the custody balance.
- A direct customer's payment does not change any custody balance but increases today's cash.

### Collections

- Recording a collection dated today shows in today's log and total.
- A collection with a past date appears when filtering the correct period.
- The filtered total equals the sum of the displayed rows.
- Zero or negative amounts are rejected.
- Today's cash equals custody collections + direct customer payments.
- “Total owed to you” equals custody debt + direct customer debt, excluding custody customers' debt (which belongs to the sellers).

### Warehouse

- Stock in 10 → quantity 10.
- Stock out 3 → quantity 7.
- Adjust to 5 → quantity 5.
- Warehouse value = 5 × cost price.
- Products below the threshold show an alert.

### UI and security

- All screens work at 360px wide without horizontal scrolling.
- All amounts are in EGP with consistent formatting.
- No internal page can be opened without logging in.
- Error messages are clear and in Arabic.
- Every create/edit/delete shows a success or failure message.

---

## 13. Security and backups

- PIN hashed with scrypt + salt.
- Session signed with HMAC, valid for 30 days.
- Temporary lockout after 5 failed login attempts.
- All inputs validated on the server.
- Database file excluded from Git.
- Manual backup from Settings (download the file).
- In production: mandatory HTTPS + daily automatic backups.
- Recommendation: keep a weekly copy on a separate device/cloud.

---

## 14. Deployment options (decided before Phase 3)

| Option | Pros | Cons |
|---|---|---|
| **VPS + SQLite** | Cheap, data stays with you, simple backups | Requires light server management |
| **Railway/Render + persistent disk** | Easy deploy, SQLite works | Monthly cost, disk may be limited |
| **Vercel + Postgres (Neon/Supabase)** | Free to start, reliable, no server | Requires switching the database + a cloud account |
| **Your machine + Tailscale** | Completely free, local data | Your machine must stay on; not always online |

**Initial recommendation:** start with local SQLite, then choose a VPS with a persistent disk at deployment time (or Postgres if using Vercel). The design does not rely on SQLite-specific features, so migration is possible.

---

## 15. Future ideas

- Quick sales invoices from the warehouse.
- Automatic link: customer sale → deduct from custody stock.
- Returns and discounts.
- Multiple currencies and exchange rates.
- Profit reports (cost vs. sale price).
- Overdue collection reminders.
- Seller accounts with restricted access.
- PWA with sync.
- Barcode scanning.
- Excel import.

---

## 16. Resolved decisions

All decisions that previously blocked implementation are now settled:

1. **Returned goods destination:** a return is linked to a warehouse product, reduces the custody stock/balance, and adds the goods to my warehouse.
2. **PIN length:** exactly 4 digits.
3. **Custody customer payments:** they reduce the customer's balance only and never affect the custody balance.
4. **Old data:** the import format will be decided when the final phase starts.

---

## 17. Running the project (developer)

```bash
# Install dependencies (pnpm preferred). postinstall generates Prisma Client.
pnpm install

# Create/update the SQLite database
pnpm db:migrate

# Start development
pnpm dev

# Type check
pnpm typecheck

# Production build
pnpm build
```

### Environment variables

```env
# .env (read by prisma7.config.ts and Next.js)
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="put-a-long-random-value-here"
```

> Prisma 7 does not load `.env` automatically; `prisma7.config.ts` imports `dotenv/config`.

> Before writing code, read the Next.js 16 guides bundled in `node_modules/next/dist/docs/` — this version has breaking changes.

---

## 18. Changelog

| Date | Change |
|---|---|
| 2026-11-04 | Initial plan and core decisions. |
| 2026-11-04 | Finalized returns (deduct from custody stock), payment routing (custody customers → seller, direct customers → you), no receipt printing, old-data import moved to the final phase, README translated to English. |
| 2026-11-05 | Returns now also add the goods to my warehouse via a linked product; PIN fixed at exactly 4 digits; open decisions resolved and Phase 0 started. |
| 2026-11-05 | Phase 0 complete: Prisma 7 + SQLite schema/migration, PIN auth + signed sessions + proxy protection, RTL Arabic shell, self-hosted Cairo font, and core UI components. |
