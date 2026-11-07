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

export function computeCustodyBalance({
  openingBalanceCents,
  items,
  charges,
  payments,
}: {
  openingBalanceCents: number;
  items: CustodyItemLite[];
  charges: ChargeLite[];
  payments: PaymentLite[];
}) {
  let balance = openingBalanceCents;

  for (const item of items) {
    balance +=
      item.type === "DELIVERY" ? itemValue(item) : -itemValue(item);
  }

  // A custody charge has no customer. Customer charges never touch this balance.
  for (const charge of charges) {
    if (charge.customerId === null) balance += charge.amountCents;
  }

  // Only a general custody collection reduces the balance. A custody customer's
  // payment goes to the seller, so it must have a customer and is ignored here.
  for (const payment of payments) {
    if (payment.customerId === null) balance -= payment.amountCents;
  }

  return balance;
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

export async function getCustodyBalanceMap() {
  const [custodies, items, charges, payments] = await Promise.all([
    db.custody.findMany({
      select: { id: true, openingBalanceCents: true },
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
  ]);

  const balances = new Map<string, number>();

  for (const custody of custodies) {
    balances.set(
      custody.id,
      computeCustodyBalance({
        openingBalanceCents: custody.openingBalanceCents,
        items: items.filter((item) => item.custodyId === custody.id),
        charges: charges.filter((charge) => charge.custodyId === custody.id),
        payments: payments.filter((payment) => payment.custodyId === custody.id),
      }),
    );
  }

  return balances;
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
