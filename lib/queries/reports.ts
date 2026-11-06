import "server-only";

import { db } from "@/lib/db";
import {
  computeCustomerBalance,
  currentProductQuantity,
  getCustodyBalanceMap,
  productStatus,
} from "@/lib/queries/balances";
import { daysBetween, monthKey, startOfWeek } from "@/lib/reports/periods";

// ---------------------------------------------------------------- collections

export type CollectionsGrouping = "day" | "week" | "month";

export type CollectionsReportRow = {
  key: string;
  count: number;
  totalCents: number;
  custodyCents: number;
  directCents: number;
};

export type CollectionsReport = {
  rows: CollectionsReportRow[];
  totals: {
    count: number;
    totalCents: number;
    custodyCents: number;
    directCents: number;
  };
};

/**
 * Cash received in a period.
 *
 * Only two kinds of payments are cash:
 * - custody collections: `customerId = null` (the shop receives from the seller)
 * - direct-customer payments: `custodyId = null` and `customerId != null`
 *
 * A payment that has both a custody and a customer is money the customer paid
 * to the seller. It never reaches the shop, so it is excluded here.
 */
export async function getCollectionsReport({
  from,
  to,
  groupBy,
  custodyId,
}: {
  from: string;
  to: string;
  groupBy: CollectionsGrouping;
  custodyId?: string;
}): Promise<CollectionsReport> {
  const payments = await db.payment.findMany({
    where: {
      occurredOn: { gte: from, lte: to },
      OR: [{ customerId: null }, { custodyId: null }],
      ...(custodyId ? { custodyId } : {}),
    },
    select: {
      occurredOn: true,
      amountCents: true,
      custodyId: true,
      customerId: true,
    },
  });

  const groups = new Map<string, CollectionsReportRow>();

  for (const payment of payments) {
    const key =
      groupBy === "month"
        ? monthKey(payment.occurredOn)
        : groupBy === "week"
          ? startOfWeek(payment.occurredOn)
          : payment.occurredOn;

    const row =
      groups.get(key) ??
      ({
        key,
        count: 0,
        totalCents: 0,
        custodyCents: 0,
        directCents: 0,
      } satisfies CollectionsReportRow);

    row.count += 1;
    row.totalCents += payment.amountCents;

    if (payment.customerId === null) row.custodyCents += payment.amountCents;
    else row.directCents += payment.amountCents;

    groups.set(key, row);
  }

  const rows = Array.from(groups.values()).sort((a, b) =>
    b.key.localeCompare(a.key),
  );

  const totals = rows.reduce(
    (acc, row) => ({
      count: acc.count + row.count,
      totalCents: acc.totalCents + row.totalCents,
      custodyCents: acc.custodyCents + row.custodyCents,
      directCents: acc.directCents + row.directCents,
    }),
    { count: 0, totalCents: 0, custodyCents: 0, directCents: 0 },
  );

  return { rows, totals };
}

// ---------------------------------------------------------------- custody debt

export type CustodyDebtRow = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  balanceCents: number;
};

export type CustodyDebtReport = {
  debtors: CustodyDebtRow[];
  credits: CustodyDebtRow[];
  zeroCount: number;
  totals: {
    debtCents: number;
    creditCents: number;
    netCents: number;
  };
};

export async function getCustodyDebtReport(): Promise<CustodyDebtReport> {
  const [balances, custodies] = await Promise.all([
    getCustodyBalanceMap(),
    db.custody.findMany({
      select: { id: true, name: true, phone: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = custodies.map((custody) => ({
    ...custody,
    balanceCents: balances.get(custody.id) ?? 0,
  }));

  const debtors = rows
    .filter((row) => row.balanceCents > 0)
    .sort((a, b) => b.balanceCents - a.balanceCents);
  const credits = rows
    .filter((row) => row.balanceCents < 0)
    .sort((a, b) => a.balanceCents - b.balanceCents);

  let debtCents = 0;
  let creditCents = 0;

  for (const row of debtors) debtCents += row.balanceCents;
  for (const row of credits) creditCents += -row.balanceCents;

  return {
    debtors,
    credits,
    zeroCount: rows.length - debtors.length - credits.length,
    totals: { debtCents, creditCents, netCents: debtCents - creditCents },
  };
}

// ---------------------------------------------------------------- customer debt

export type CustomerDebtType = "all" | "custody" | "direct";

export type CustomerDebtRow = {
  id: string;
  name: string;
  country: string | null;
  custodyId: string | null;
  custodyName: string | null;
  type: "custody" | "direct";
  balanceCents: number;
  bucket0to30: number;
  bucket31to60: number;
  bucket61plus: number;
  creditCents: number;
};

export type CustomerDebtReport = {
  debtors: CustomerDebtRow[];
  credits: CustomerDebtRow[];
  zeroCount: number;
  asOf: string;
  totals: {
    debtCents: number;
    creditCents: number;
    bucket0to30: number;
    bucket31to60: number;
    bucket61plus: number;
  };
};

/**
 * FIFO aging: payments are a pool applied to the oldest charges first. What is
 * left unpaid is bucketed by `asOf - occurredOn`. Overpayments are credits and
 * never enter an aging bucket.
 */
function agingBuckets(
  charges: Array<{ amountCents: number; occurredOn: string }>,
  payments: Array<{ amountCents: number }>,
  asOf: string,
) {
  let pool = payments.reduce((total, payment) => total + payment.amountCents, 0);

  let bucket0to30 = 0;
  let bucket31to60 = 0;
  let bucket61plus = 0;

  for (const charge of charges) {
    if (pool >= charge.amountCents) {
      pool -= charge.amountCents;
      continue;
    }

    const unpaid = charge.amountCents - pool;
    pool = 0;

    const age = daysBetween(charge.occurredOn, asOf);

    if (age <= 30) bucket0to30 += unpaid;
    else if (age <= 60) bucket31to60 += unpaid;
    else bucket61plus += unpaid;
  }

  return { bucket0to30, bucket31to60, bucket61plus };
}

export async function getCustomerDebtReport({
  type,
  asOf,
}: {
  type: CustomerDebtType;
  asOf: string;
}): Promise<CustomerDebtReport> {
  const customers = await db.customer.findMany({
    where:
      type === "custody"
        ? { custodyId: { not: null } }
        : type === "direct"
          ? { custodyId: null }
          : {},
    select: {
      id: true,
      name: true,
      country: true,
      custodyId: true,
      custody: { select: { name: true } },
      charges: {
        where: { occurredOn: { lte: asOf } },
        select: {
          custodyId: true,
          customerId: true,
          amountCents: true,
          occurredOn: true,
          createdAt: true,
        },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
      payments: {
        where: { occurredOn: { lte: asOf } },
        select: {
          custodyId: true,
          customerId: true,
          amountCents: true,
          occurredOn: true,
          createdAt: true,
        },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = customers.map((customer) => {
    const balanceCents = computeCustomerBalance({
      charges: customer.charges,
      payments: customer.payments,
    });

    const buckets = agingBuckets(
      customer.charges,
      customer.payments,
      asOf,
    );

    return {
      id: customer.id,
      name: customer.name,
      country: customer.country,
      custodyId: customer.custodyId,
      custodyName: customer.custody?.name ?? null,
      type: customer.custodyId ? ("custody" as const) : ("direct" as const),
      balanceCents,
      ...buckets,
      creditCents: balanceCents < 0 ? -balanceCents : 0,
    };
  });

  const debtors = rows
    .filter((row) => row.balanceCents > 0)
    .sort((a, b) => b.balanceCents - a.balanceCents);
  const credits = rows
    .filter((row) => row.balanceCents < 0)
    .sort((a, b) => b.creditCents - a.creditCents);

  const totals = {
    debtCents: 0,
    creditCents: 0,
    bucket0to30: 0,
    bucket31to60: 0,
    bucket61plus: 0,
  };

  for (const row of debtors) {
    totals.debtCents += row.balanceCents;
    totals.bucket0to30 += row.bucket0to30;
    totals.bucket31to60 += row.bucket31to60;
    totals.bucket61plus += row.bucket61plus;
  }

  for (const row of credits) totals.creditCents += row.creditCents;

  return {
    debtors,
    credits,
    zeroCount: rows.length - debtors.length - credits.length,
    asOf,
    totals,
  };
}

// ---------------------------------------------------------------- warehouse

export type WarehouseReportRow = {
  id: string;
  name: string;
  unit: string | null;
  isActive: boolean;
  quantity: number;
  costPriceCents: number;
  salePriceCents: number | null;
  costValueCents: number;
  saleValueCents: number | null;
  status: "in" | "low" | "out";
  inQty: number;
  outQty: number;
  adjustQty: number;
  inCount: number;
  outCount: number;
  adjustCount: number;
};

export type WarehouseReport = {
  rows: WarehouseReportRow[];
  totals: {
    costValueCents: number;
    saleValueCents: number;
    quantity: number;
    inQty: number;
    outQty: number;
    adjustQty: number;
    inCount: number;
    outCount: number;
    adjustCount: number;
  };
  lowStockCount: number;
};

export async function getWarehouseReport({
  from,
  to,
  productId,
}: {
  from: string;
  to: string;
  productId?: string;
}): Promise<WarehouseReport> {
  const [products, movements] = await Promise.all([
    db.product.findMany({
      where: productId ? { id: productId } : undefined,
      select: {
        id: true,
        name: true,
        unit: true,
        costPriceCents: true,
        salePriceCents: true,
        lowStockThreshold: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    }),
    db.stockMovement.findMany({
      select: {
        productId: true,
        type: true,
        quantity: true,
        occurredOn: true,
      },
    }),
  ]);

  const movementsByProduct = new Map<
    string,
    Array<{
      productId: string;
      type: "IN" | "OUT" | "ADJUST";
      quantity: number;
      occurredOn: string;
    }>
  >();

  for (const movement of movements) {
    const list = movementsByProduct.get(movement.productId) ?? [];
    list.push(movement);
    movementsByProduct.set(movement.productId, list);
  }

  const rows: WarehouseReportRow[] = [];

  for (const product of products) {
    const productMovements = movementsByProduct.get(product.id) ?? [];
    const quantity = currentProductQuantity(productMovements);

    // Inactive products only matter while they still hold stock.
    if (!product.isActive && quantity === 0 && product.id !== productId) {
      continue;
    }

    let inQty = 0;
    let outQty = 0;
    let adjustQty = 0;
    let inCount = 0;
    let outCount = 0;
    let adjustCount = 0;

    for (const movement of productMovements) {
      if (movement.occurredOn < from || movement.occurredOn > to) continue;

      if (movement.type === "IN") {
        inQty += movement.quantity;
        inCount += 1;
      } else if (movement.type === "OUT") {
        outQty += movement.quantity;
        outCount += 1;
      } else {
        adjustQty += movement.quantity;
        adjustCount += 1;
      }
    }

    rows.push({
      id: product.id,
      name: product.name,
      unit: product.unit,
      isActive: product.isActive,
      quantity,
      costPriceCents: product.costPriceCents,
      salePriceCents: product.salePriceCents,
      costValueCents: quantity * product.costPriceCents,
      saleValueCents:
        product.salePriceCents === null
          ? null
          : quantity * product.salePriceCents,
      status: productStatus(quantity, product.lowStockThreshold),
      inQty,
      outQty,
      adjustQty,
      inCount,
      outCount,
      adjustCount,
    });
  }

  const totals = rows.reduce(
    (acc, row) => ({
      costValueCents: acc.costValueCents + row.costValueCents,
      saleValueCents: acc.saleValueCents + (row.saleValueCents ?? 0),
      quantity: acc.quantity + row.quantity,
      inQty: acc.inQty + row.inQty,
      outQty: acc.outQty + row.outQty,
      adjustQty: acc.adjustQty + row.adjustQty,
      inCount: acc.inCount + row.inCount,
      outCount: acc.outCount + row.outCount,
      adjustCount: acc.adjustCount + row.adjustCount,
    }),
    {
      costValueCents: 0,
      saleValueCents: 0,
      quantity: 0,
      inQty: 0,
      outQty: 0,
      adjustQty: 0,
      inCount: 0,
      outCount: 0,
      adjustCount: 0,
    },
  );

  return {
    rows,
    totals,
    lowStockCount: rows.filter((row) => row.status !== "in").length,
  };
}
