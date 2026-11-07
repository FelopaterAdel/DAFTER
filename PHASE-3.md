# Daftar — Phase 3 plan

**Scope (owner decision):** only three workstreams ship in this phase.

| ID | Workstream | Status |
|---|---|---|
| **3A** | Sales ↔ custody stock (بيع من مخزون العهدة) | ✅ implemented — pending verification |
| **3B** | Sales invoices + returns + discounts (فواتير بيع، مرتجعات، خصومات) | 🚧 in progress (list page + actions done; new/detail screens pending) |
| **3E** | Manual opening balances (أرصدة افتتاحية — إدخال يدوي) | ✅ implemented — pending verification |
| 3C | Multiple users | ❌ out of scope |
| 3D | Collection reminders | ❌ out of scope |
| 3F | Warehouse transfers | ❌ out of scope |

Decisions captured from the owner (2026-11-07):

1. **Shortfall policy = “نسمح مع تحذير”.** A custody sale larger than the available
   quantity is recorded anyway; the stock goes negative and the app shows a warning.
   *This supersedes the “block” recommendation written in `PHASE-2.md` §7.2.*
2. **3B = invoices + returns + discounts.** No profit report, no multi-warehouse transfers.
3. **3E = paper-ledger manual entry.** A dedicated screen for opening balances — no file import.

---

## 3A — Sales ↔ custody stock

### Schema (migration `20261107131420_phase3_sales_and_opening`)

`Charge` gains three nullable columns so existing rows and non-stock charges are untouched:

```prisma
itemName String?   // stock group name, null = not a stock sale
unit     String?   // stock group unit
quantity Int?      // sold quantity, required when itemName is set
```

A stock sale also stores `custodyId` (the custody whose stock was deducted) **and**
`customerId`. Balance math only counts charges with `customerId = null`, so the custody
balance is still untouched by a sale — exactly like a custody-customer payment, which
already carries both ids.

### Logic (`lib/queries/balances.ts`)

`computeStockGroups(items, sales = [])` — the default keeps every existing caller working.

- groups stay keyed by `name + unit`;
- `soldQty` / `soldValue` are added from sale charges with `itemName != null`;
- `netQty = deliveredQty − returnedQty − soldQty`;
- `netValue = deliveredValue − returnedValue − soldQty × averageUnitPriceCents`;
- a sale whose item has no delivery rows still creates a group (negative net) so the
  deduction never disappears from view;
- with zero sales the numbers equal the Phase 2 numbers.

`createChargeAction`:

- reads the optional `stockKey` (`name|||unit`) + `quantity`;
- a stock sale requires a **custody** customer (direct customers have no custody stock);
- availability (delivered − returned − sold) is read from the same helpers the
  stock view uses, and on shortfall the charge is still written (warn-and-allow)
  with `?stockWarning=1` on the redirect;
- deleting the charge reverses the deduction automatically — stock is derived from rows,
  never from a mutable counter.

`addCustodyReturnAction` now passes sales into `computeStockGroups`, so a return can never
exceed what is really left (delivered − returned − sold).

### UI

- **Customer page (custody customers only):** a “بيع من مخزون العهدة” card — item select
  with the available quantity, quantity, price, date, note. Direct customers never see it.
- **Customer ledger:** sale rows show `itemName × quantity`.
- **Custody stock tab:** columns وارد / مرتجع / **مبيع** / **متبقي** / قيمة, and the
  movement table lists sales with a delete button (delete → stock returns).
- Shortfall warning banner on the customer page.

### Acceptance

- Sale of 3 from 5 → stock 2, customer balance +amount, custody balance unchanged.
- Sale of 6 from 5 → recorded, stock −1, warning banner shown (owner decision).
- Delete the sale charge → stock back to 5.
- Old charges with null item fields behave exactly as before.

---

## 3B — Sales invoices, returns, discounts

### Schema (same migration as 3A)

```
SalesInvoice      invoiceNo (auto), customerId?, occurredOn, note,
                  discountCents, discountNote, chargeId? (unique → Charge)
SalesInvoiceLine  invoiceId, productId, quantity, unitPriceCents
InvoiceReturn     invoiceId, productId, quantity, unitPriceCents, occurredOn, note
```

`StockMovement` gains two nullable, cascading links:

- `salesInvoiceId` → invoice **OUT** lines (deleting the invoice removes them),
- `invoiceReturnId` → invoice **IN** returns (deleting a return removes them).

### Flows

| Flow | Stock | Debt |
|---|---|---|
| **فاتورة بيع** | OUT movement per line (blocked when it exceeds the current quantity — same rule as manual stock-out) | one `Charge` per invoice, amount = gross, note `فاتورة رقم N` |
| **مرتجع فاتورة** | IN movement per returned line (≤ what is still returnable) | invoice charge amount reduced by the returned value |
| **خصم** | — | invoice charge amount reduced by the discount (≤ gross − returns) |
| **حذف الفاتورة** | OUT movements + returns + their IN movements all cascade | the invoice charge is deleted |

- Cash sale (`customerId = null`): stock only, no charge, no discount form.
- Invoice charges are **not deletable** from the customer ledger — the row links to the
  invoice instead; `deleteChargeAction` refuses them server-side.
- Net total = gross − discount − returned value, recomputed from rows on every change,
  so the customer balance, the debt report and the dashboard all stay consistent without
  touching their queries.

### UI

- `/invoices` list, `/invoices/new` (client line editor: product, qty, price, add/remove),
  `/invoices/[id]` detail with lines, returns, totals, return/discount/delete forms and
  A4 print (print header + print button).
- Entry points: warehouse header, dashboard shortcuts.

---

## 3E — Manual opening balances

### Schema (same migration as 3A)

`Customer.openingBalanceCents Int @default(0)` — mirrors the field `Custody` already had.

- `computeCustomerBalance` takes `openingBalanceCents` (callers: customer page,
  balance map, dashboard, debt report).
- `createCustomerAction` now writes the initial amount into `openingBalanceCents`
  instead of fabricating a charge, so the new-customer form and the opening-balance
  screen never double count. Customers created before this phase keep their
  `رصيد افتتاحي` charge and are unaffected.
- Aging: the opening balance enters the FIFO buckets as a charge dated at the customer’s
  creation date, so the buckets still sum to the reported balance.

### UI — `/opening-balances`

- Every custody and every customer in one place: current balance, an editable opening
  balance and a save button per row (`setOpeningBalanceAction`, scope = custody|customer,
  value ≥ 0).
- Quick links to add a missing custody or customer.
- Reached from the dashboard shortcuts and the settings page.

### Acceptance

- Setting a customer opening balance of 500 raises the balance, the ledger and the debt
  report by 500 without inventing a charge row.
- A custody opening balance behaves exactly as before.
- Zero is a valid value and clears the opening balance.

---

## Verification gates

1. `./node_modules/.bin/tsc --noEmit`
2. `./node_modules/.bin/eslint .`
3. `./node_modules/.bin/next build`
4. Runtime smoke test against an isolated `prisma/test.db`
   (`node scripts/seed-test.mjs`, PIN `1234`) — **never** `prisma/dev.db`; the test DB is
   deleted afterwards.
