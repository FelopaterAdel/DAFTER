-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopName" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Custody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustodyItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custodyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "note" TEXT,
    "occurredOn" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustodyItem_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "Custody" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustodyItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "custodyId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "Custody" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custodyId" TEXT,
    "customerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Charge_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "Custody" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Charge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custodyId" TEXT,
    "customerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "Custody" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "costPriceCents" INTEGER NOT NULL DEFAULT 0,
    "salePriceCents" INTEGER,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "custodyItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_custodyItemId_fkey" FOREIGN KEY ("custodyItemId") REFERENCES "CustodyItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Custody_name_key" ON "Custody"("name");

-- CreateIndex
CREATE INDEX "Custody_isActive_idx" ON "Custody"("isActive");

-- CreateIndex
CREATE INDEX "CustodyItem_custodyId_occurredOn_idx" ON "CustodyItem"("custodyId", "occurredOn");

-- CreateIndex
CREATE INDEX "CustodyItem_name_idx" ON "CustodyItem"("name");

-- CreateIndex
CREATE INDEX "Customer_custodyId_idx" ON "Customer"("custodyId");

-- CreateIndex
CREATE INDEX "Customer_country_idx" ON "Customer"("country");

-- CreateIndex
CREATE INDEX "Charge_occurredOn_idx" ON "Charge"("occurredOn");

-- CreateIndex
CREATE INDEX "Charge_custodyId_idx" ON "Charge"("custodyId");

-- CreateIndex
CREATE INDEX "Charge_customerId_idx" ON "Charge"("customerId");

-- CreateIndex
CREATE INDEX "Payment_occurredOn_idx" ON "Payment"("occurredOn");

-- CreateIndex
CREATE INDEX "Payment_custodyId_idx" ON "Payment"("custodyId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_custodyItemId_key" ON "StockMovement"("custodyItemId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_occurredOn_idx" ON "StockMovement"("productId", "occurredOn");

-- CreateIndex
CREATE INDEX "StockMovement_occurredOn_idx" ON "StockMovement"("occurredOn");
