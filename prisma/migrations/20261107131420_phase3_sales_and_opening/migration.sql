-- AlterTable
ALTER TABLE "Charge" ADD COLUMN "itemName" TEXT;
ALTER TABLE "Charge" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "Charge" ADD COLUMN "unit" TEXT;

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" INTEGER NOT NULL,
    "customerId" TEXT,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "discountNote" TEXT,
    "chargeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoice_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceReturn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "custodyId" TEXT,
    "note" TEXT,
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "Custody" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("country", "createdAt", "custodyId", "id", "name", "note", "phone", "updatedAt") SELECT "country", "createdAt", "custodyId", "id", "name", "note", "phone", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_custodyId_idx" ON "Customer"("custodyId");
CREATE INDEX "Customer_country_idx" ON "Customer"("country");
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "custodyItemId" TEXT,
    "salesInvoiceId" TEXT,
    "invoiceReturnId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_custodyItemId_fkey" FOREIGN KEY ("custodyItemId") REFERENCES "CustodyItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_invoiceReturnId_fkey" FOREIGN KEY ("invoiceReturnId") REFERENCES "InvoiceReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("createdAt", "custodyItemId", "id", "note", "occurredOn", "productId", "quantity", "type", "unitPriceCents") SELECT "createdAt", "custodyItemId", "id", "note", "occurredOn", "productId", "quantity", "type", "unitPriceCents" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE UNIQUE INDEX "StockMovement_custodyItemId_key" ON "StockMovement"("custodyItemId");
CREATE UNIQUE INDEX "StockMovement_salesInvoiceId_key" ON "StockMovement"("salesInvoiceId");
CREATE UNIQUE INDEX "StockMovement_invoiceReturnId_key" ON "StockMovement"("invoiceReturnId");
CREATE INDEX "StockMovement_productId_occurredOn_idx" ON "StockMovement"("productId", "occurredOn");
CREATE INDEX "StockMovement_occurredOn_idx" ON "StockMovement"("occurredOn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_invoiceNo_key" ON "SalesInvoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_chargeId_key" ON "SalesInvoice"("chargeId");

-- CreateIndex
CREATE INDEX "SalesInvoice_occurredOn_idx" ON "SalesInvoice"("occurredOn");

-- CreateIndex
CREATE INDEX "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "SalesInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_productId_idx" ON "SalesInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "InvoiceReturn_invoiceId_idx" ON "InvoiceReturn"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceReturn_productId_idx" ON "InvoiceReturn"("productId");
