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
  charges,
  payments,
}: {
  charges: ChargeLite[];
  payments: PaymentLite[];
}) {
  const charged = charges.reduce((total, charge) => total + charge.amountCents, 0);
  const paid = payments.reduce((total, payment) => total + payment.amountCents, 0);

  return charged - paid;
}

export type StockGroup = {
  key: string;
  name: string;
  unit: string | null;
  deliveredQty: number;
  returnedQty: number;
  netQty: number;
  deliveredValue: number;
  returnedValue: number;
  netValue: number;
  averageUnitPriceCents: number;
};

/** Groups a custody's items by name + unit and totals deliveries/returns. */
export function computeStockGroups(items: CustodyItemLite[]) {
  const groups = new Map<string, StockGroup>();

  for (const item of items) {
    const key = `${item.name}|||${item.unit ?? ""}`;
    const group =
      groups.get(key) ??
      ({
        key,
        name: item.name,
        unit: item.unit,
        deliveredQty: 0,
        returnedQty: 0,
        netQty: 0,
        deliveredValue: 0,
        returnedValue: 0,
        netValue: 0,
        averageUnitPriceCents: 0,
      } satisfies StockGroup);

    if (item.type === "DELIVERY") {
      group.deliveredQty += item.quantity;
      group.deliveredValue += itemValue(item);
    } else {
      group.returnedQty += item.quantity;
      group.returnedValue += itemValue(item);
    }

    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      netQty: group.deliveredQty - group.returnedQty,
      netValue: group.deliveredValue - group.returnedValue,
      averageUnitPriceCents:
        group.deliveredQty > 0
          ? Math.round(group.deliveredValue / group.deliveredQty)
          : 0,
    }))
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
    select: { id: true, custodyId: true },
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
        charges: charges.filter((charge) => charge.customerId === customer.id),
        payments: payments.filter(
          (payment) => payment.customerId === customer.id,
        ),
      }),
    );
  }

  return balances;
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
