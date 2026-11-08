#!/usr/bin/env node

/**
 * Creates an isolated test database with a known PIN and deterministic data.
 * Never point the app at this file when entering the owner's real PIN.
 *
 *   node scripts/seed-test.mjs
 *   DATABASE_URL=file:./prisma/test.db AUTH_SECRET=test-secret \
 *     ./node_modules/.bin/next dev -p 3000
 */

import { copyFileSync, existsSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";

import Database from "better-sqlite3";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "prisma", "dev.db");
const TARGET = path.join(ROOT, "prisma", "test.db");

if (!existsSync(SOURCE)) {
  console.error("prisma/dev.db is missing.");
  process.exit(1);
}

copyFileSync(SOURCE, TARGET);

const db = new Database(TARGET);

function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 });

  return [
    "scrypt",
    16384,
    8,
    1,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

const now = new Date().toISOString();

db.exec("PRAGMA foreign_keys = OFF");
db.exec(`
  DELETE FROM StockMovement;
  DELETE FROM CustodyItem;
  DELETE FROM Payment;
  DELETE FROM Charge;
  DELETE FROM Customer;
  DELETE FROM Product;
  DELETE FROM Custody;
`);

db.prepare(
  `UPDATE Setting
   SET shopName = ?, pinHash = ?, sessionVersion = 1, pinChangedAt = NULL, updatedAt = ?
   WHERE id = 1`,
).run("دفتر تجريبي", hashPin("1234"), now);

db.prepare(
  `INSERT INTO Custody
    (id, name, phone, note, openingBalanceCents, isActive, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-custody",
  "عهدة تجريبية",
  "01000000000",
  "بيانات اختبار",
  100000,
  1,
  now,
  now,
);

db.prepare(
  `INSERT INTO CustodyItem
    (id, custodyId, type, name, unit, quantity, unitPriceCents, note, occurredOn, productId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-delivery",
  "test-custody",
  "DELIVERY",
  "منتج تجريبي",
  "كرتونة",
  10,
  5000,
  null,
  "2026-11-01",
  null,
  now,
);

db.prepare(
  `INSERT INTO CustodyItem
    (id, custodyId, type, name, unit, quantity, unitPriceCents, note, occurredOn, productId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-return",
  "test-custody",
  "RETURN",
  "منتج تجريبي",
  "كرتونة",
  2,
  5000,
  null,
  "2026-11-02",
  null,
  now,
);

db.prepare(
  `INSERT INTO Charge
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-custody-charge",
  "test-custody",
  null,
  20000,
  "2026-11-03",
  "شحن يدوي على العهدة",
  now,
);

db.prepare(
  `INSERT INTO Payment
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-custody-payment",
  "test-custody",
  null,
  30000,
  "2026-11-04",
  "تحصيل من العهدة",
  now,
);

db.prepare(
  `INSERT INTO Customer
    (id, name, phone, country, custodyId, note, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-customer",
  "زبون تجريبي",
  null,
  null,
  "test-custody",
  null,
  now,
  now,
);

db.prepare(
  `INSERT INTO Charge
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-customer-charge",
  "test-custody",
  "test-customer",
  15000,
  "2026-11-01",
  "بضاعة",
  now,
);

db.prepare(
  `INSERT INTO Payment
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-customer-payment",
  "test-custody",
  "test-customer",
  5000,
  "2026-11-05",
  "دفعة للعهدة",
  now,
);

db.prepare(
  `INSERT INTO Customer
    (id, name, phone, country, custodyId, note, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-direct",
  "زبون مباشر",
  null,
  "مصر",
  null,
  null,
  now,
  now,
);

db.prepare(
  `INSERT INTO Charge
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-direct-charge",
  null,
  "test-direct",
  12000,
  "2026-11-02",
  "بضاعة مباشرة",
  now,
);

db.prepare(
  `INSERT INTO Payment
    (id, custodyId, customerId, amountCents, occurredOn, note, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-direct-payment",
  null,
  "test-direct",
  2000,
  "2026-11-05",
  "دفعة مباشرة",
  now,
);

db.prepare(
  `INSERT INTO Product
    (id, name, unit, costPriceCents, salePriceCents, lowStockThreshold, note, isActive, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-product",
  "منتج المخزن",
  "علبة",
  3000,
  5000,
  5,
  null,
  1,
  now,
  now,
);

db.prepare(
  `INSERT INTO StockMovement
    (id, productId, type, quantity, unitPriceCents, occurredOn, note, custodyItemId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-in",
  "test-product",
  "IN",
  10,
  3000,
  "2026-11-01",
  null,
  null,
  now,
);

db.prepare(
  `INSERT INTO StockMovement
    (id, productId, type, quantity, unitPriceCents, occurredOn, note, custodyItemId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-out",
  "test-product",
  "OUT",
  3,
  3000,
  "2026-11-02",
  null,
  null,
  now,
);

db.prepare(
  `INSERT INTO StockMovement
    (id, productId, type, quantity, unitPriceCents, occurredOn, note, custodyItemId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  "test-adjust",
  "test-product",
  "ADJUST",
  -1,
  3000,
  "2026-11-03",
  "تسوية",
  null,
  now,
);

db.close();

console.log("Test DB ready:", TARGET);
console.log("PIN: 1234");
console.log(
  "Custody balance: EGP 450.00 (stock 400 + customer 100 + collected 50 + charge 200 − collection 300; no opening balance)",
);
console.log("Custody customer balance: EGP 100.00");
console.log("Direct customer balance: EGP 100.00");
console.log("Collections 2026-11-01..05: EGP 320.00");
console.log("Warehouse quantity: 6");
