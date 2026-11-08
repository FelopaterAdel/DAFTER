import "server-only";

import { db } from "@/lib/db";

export type CustodyItemLite = {
  custodyId: string;
  type: "DELIVERY" | "RETURN";
  name: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
};

export type ChargeLite = {
  custodyId: string | null;
  customerId: string | null;
  amountCents: number;
};

/** A stock sale: a charge that carries an item name and a quantity (3A). */
export type SaleLite = {
  itemName: string | null;
  unit: string | null;
  quantity: number | null;
};

export type PaymentLite = {
  custodyId: string | null;
  customerId: string | null;
  amountCents: number;
};

export type MovementLite = {
  productId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
};

export function itemValue(item: CustodyItemLite) {
  return item.quantity * item.unitPriceCents;
}

/** What a custody's customers add up to: what they owe + what they paid the seller. */
export type CustodyCustomerTotals = {
  balanceCents: number;
  collectedCents: number;
};

const NO_CUSTOMERS: CustodyCustomerTotals = {
  balanceCents: 0,
  collectedCents: 0,
};

/**
 * A custody account is built from its two sides only — there is no opening
 * balance for a custody:
 *
 * - **stock** still with the seller: delivered − returned − sold, at the
 *   average delivery price (the warehouse side), and
 * - **its customers**: what they still owe plus the cash they already handed
 *   to the seller (money that stays with the custody until it is remitted).
 *
 * On top of that, a manual custody charge adds and a general custody
 * collection (the seller handing money to the shop) subtracts.
 *
 * `charges` / `payments` may also carry customer rows; only the custody's own
 * rows (`customerId === null`) are counted here, customer rows are counted
 * through `customerTotals`.
 */
export function computeCustodyBalance({
  items,
  sales = [],
  charges,
  payments,
  customerTotals = NO_CUSTOMERS,
}: {
  items: CustodyItemLite[];
  sales?: SaleLite[];
  charges: ChargeLite[];
  payments: PaymentLite[];
  customerTotals?: CustodyCustomerTotals;
}) {
  const stockValue = computeStockGroups(items, sales).reduce(
    (total, group) => total + group.netValue,
    0,
  );

  // A customer's payment to the seller only swaps a receivable for cash in the
  // seller's hand, so the custody keeps both: the debt and the cash collected.
  const balance =
    stockValue + customerTotals.balanceCents + customerTotals.collectedCents;

  let running = balance;

  // A custody charge has no customer. Customer charges are counted above.
  for (const charge of charges) {
    if (charge.customerId === null) running += charge.amountCents;
  }

  // Only a general custody collection (money the seller hands to the shop)
  // reduces the balance.
  for (const payment of payments) {
    if (payment.customerId === null) running -= payment.amountCents;
  }

  return running;
}

export function computeCustomerBalance({
  openingBalanceCents = 0,
  charges,
  payments,
}: {
  openingBalanceCents?: number;
  charges: ChargeLite[];
  payments: PaymentLite[];
}) {
  const charged = charges.reduce((total, charge) => total + charge.amountCents, 0);
  const paid = payments.reduce((total, payment) => total + payment.amountCents, 0);

  return openingBalanceCents + charged - paid;
}

export type StockGroup = {
  key: string;
  name: string;
  unit: string | null;
  deliveredQty: number;
  returnedQty: number;
  soldQty: number;
  netQty: number;
  deliveredValue: number;
  returnedValue: number;
  soldValue: number;
  netValue: number;
  averageUnitPriceCents: number;
};

function emptyStockGroup(key: string, name: string, unit: string | null): StockGroup {
  return {
    key,
    name,
    unit,
    deliveredQty: 0,
    returnedQty: 0,
    soldQty: 0,
    netQty: 0,
    deliveredValue: 0,
    returnedValue: 0,
    soldValue: 0,
    netValue: 0,
    averageUnitPriceCents: 0,
  };
}

/**
 * Groups a custody's items by name + unit and totals deliveries, returns and
 * (Phase 3A) sales. `sales` defaults to `[]`, so callers that predate sales
 * keep the exact numbers they had.
 */
export function computeStockGroups(
  items: CustodyItemLite[],
  sales: SaleLite[] = [],
) {
  const groups = new Map<string, StockGroup>();

  for (const item of items) {
    const key = `${item.name}|||${item.unit ?? ""}`;
    const group = groups.get(key) ?? emptyStockGroup(key, item.name, item.unit);

    if (item.type === "DELIVERY") {
      group.deliveredQty += item.quantity;
      group.deliveredValue += itemValue(item);
    } else {
      group.returnedQty += item.quantity;
      group.returnedValue += itemValue(item);
    }

    groups.set(key, group);
  }

  for (const sale of sales) {
    if (!sale.itemName || !sale.quantity) continue;

    const key = `${sale.itemName}|||${sale.unit ?? ""}`;
    // A sale for an item that no longer has delivery rows still gets a group,
    // otherwise the deduction would silently disappear from the stock view.
    const group =
      groups.get(key) ?? emptyStockGroup(key, sale.itemName, sale.unit);

    group.soldQty += sale.quantity;
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const averageUnitPriceCents =
        group.deliveredQty > 0
          ? Math.round(group.deliveredValue / group.deliveredQty)
          : 0;
      const soldValue = group.soldQty * averageUnitPriceCents;

      return {
        ...group,
        soldValue,
        netQty: group.deliveredQty - group.returnedQty - group.soldQty,
        netValue:
          group.deliveredValue - group.returnedValue - soldValue,
        averageUnitPriceCents,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function currentProductQuantity(movements: MovementLite[]) {
  let quantity = 0;

  for (const movement of movements) {
    if (movement.type === "IN") quantity += movement.quantity;
    else if (movement.type === "OUT") quantity -= movement.quantity;
    else quantity += movement.quantity; // ADJUST stores a signed delta.
  }

  return quantity;
}

/**
 * Aggregates every custody's customers into `{ balance, collected }` totals.
 * Customers with no custody are skipped — they belong to direct customers.
 */
export async function getCustodyCustomerTotalsMap(): Promise<
  Map<string, CustodyCustomerTotals>
> {
  const [customers, charges, payments] = await Promise.all([
    db.customer.findMany({
      select: { id: true, custodyId: true, openingBalanceCents: true },
    }),
    db.charge.findMany({
      where: { customerId: { not: null } },
      select: { customerId: true, amountCents: true },
    }),
    db.payment.findMany({
      where: { customerId: { not: null } },
      select: { customerId: true, amountCents: true },
    }),
  ]);

  const charged = new Map<string, number>();
  for (const charge of charges) {
    if (!charge.customerId) continue;
    charged.set(
      charge.customerId,
      (charged.get(charge.customerId) ?? 0) + charge.amountCents,
    );
  }

  const paid = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.customerId) continue;
    paid.set(
      payment.customerId,
      (paid.get(payment.customerId) ?? 0) + payment.amountCents,
    );
  }

  const totals = new Map<string, CustodyCustomerTotals>();

  for (const customer of customers) {
    if (!customer.custodyId) continue;

    const collectedCents = paid.get(customer.id) ?? 0;
    const entry = totals.get(customer.custodyId) ?? {
      balanceCents: 0,
      collectedCents: 0,
    };

    entry.balanceCents +=
      customer.openingBalanceCents +
      (charged.get(customer.id) ?? 0) -
      collectedCents;
    entry.collectedCents += collectedCents;
    totals.set(customer.custodyId, entry);
  }

  return totals;
}

export async function getCustodyBalanceMap() {
  const [custodies, items, charges, payments, sales, customerTotals] =
    await Promise.all([
      db.custody.findMany({
        select: { id: true },
      }),
      db.custodyItem.findMany({
        select: {
          custodyId: true,
          type: true,
          name: true,
          unit: true,
          quantity: true,
          unitPriceCents: true,
        },
      }),
      db.charge.findMany({
        where: { customerId: null },
        select: { custodyId: true, customerId: true, amountCents: true },
      }),
      db.payment.findMany({
        where: { customerId: null },
        select: { custodyId: true, customerId: true, amountCents: true },
      }),
      db.charge.findMany({
        where: { itemName: { not: null }, custodyId: { not: null } },
        select: {
          custodyId: true,
          itemName: true,
          unit: true,
          quantity: true,
        },
      }),
      getCustodyCustomerTotalsMap(),
    ]);

  const salesByCustody = new Map<string, SaleLite[]>();
  for (const sale of sales) {
    if (!sale.custodyId) continue;
    pushIntoList(salesByCustody, sale.custodyId, {
      itemName: sale.itemName,
      unit: sale.unit,
      quantity: sale.quantity,
    });
  }

  const balances = new Map<string, number>();

  for (const custody of custodies) {
    balances.set(
      custody.id,
      computeCustodyBalance({
        items: items.filter((item) => item.custodyId === custody.id),
        sales: salesByCustody.get(custody.id) ?? [],
        charges: charges.filter((charge) => charge.custodyId === custody.id),
        payments: payments.filter((payment) => payment.custodyId === custody.id),
        customerTotals: customerTotals.get(custody.id),
      }),
    );
  }

  return balances;
}

function pushIntoList<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

export async function getCustomerBalanceMap() {
  const customers = await db.customer.findMany({
    select: { id: true, custodyId: true, openingBalanceCents: true },
  });
  const [charges, payments] = await Promise.all([
    db.charge.findMany({
      where: { customerId: { not: null } },
      select: { custodyId: true, customerId: true, amountCents: true },
    }),
    db.payment.findMany({
      where: { customerId: { not: null } },
      select: { custodyId: true, customerId: true, amountCents: true },
    }),
  ]);

  const balances = new Map<string, number>();

  for (const customer of customers) {
    balances.set(
      customer.id,
      computeCustomerBalance({
        openingBalanceCents: customer.openingBalanceCents,
        charges: charges.filter((charge) => charge.customerId === customer.id),
        payments: payments.filter(
          (payment) => payment.customerId === customer.id,
        ),
      }),
    );
  }

  return balances;
}

/** Stock-sale charges of one custody (Phase 3A). */
export async function getCustodySales(custodyId: string): Promise<SaleLite[]> {
  return db.charge.findMany({
    where: { custodyId, itemName: { not: null } },
    select: { itemName: true, unit: true, quantity: true },
  });
}

export async function getProductQuantityMap() {
  const movements = await db.stockMovement.findMany({
    select: { productId: true, type: true, quantity: true },
  });

  const byProduct = new Map<string, MovementLite[]>();

  for (const movement of movements) {
    const list = byProduct.get(movement.productId) ?? [];
    list.push(movement);
    byProduct.set(movement.productId, list);
  }

  const quantities = new Map<string, number>();

  for (const [productId, list] of byProduct) {
    quantities.set(productId, currentProductQuantity(list));
  }

  return quantities;
}

export function productStatus(quantity: number, lowStockThreshold: number) {
  if (quantity <= 0) return "out" as const;
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) return "low" as const;
  return "in" as const;
}
