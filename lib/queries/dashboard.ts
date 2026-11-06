import "server-only";

import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import {
  computeCustomerBalance,
  computeCustodyBalance,
  currentProductQuantity,
  productStatus,
} from "@/lib/queries/balances";

type LiteItem = {
  custodyId: string;
  type: "DELIVERY" | "RETURN";
  name: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
};

type LiteCharge = {
  custodyId: string | null;
  customerId: string | null;
  amountCents: number;
};

type LitePayment = {
  custodyId: string | null;
  customerId: string | null;
  amountCents: number;
};

function pushInto<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

export async function getDashboardSnapshot() {
  const today = todayISO();

  const [
    custodies,
    items,
    charges,
    payments,
    products,
    movements,
    customers,
    recentPayments,
  ] = await Promise.all([
    db.custody.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        openingBalanceCents: true,
      },
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
      select: { custodyId: true, customerId: true, amountCents: true },
    }),
    db.payment.findMany({
      select: {
        custodyId: true,
        customerId: true,
        amountCents: true,
        occurredOn: true,
      },
    }),
    db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        costPriceCents: true,
        lowStockThreshold: true,
      },
    }),
    db.stockMovement.findMany({
      select: { productId: true, type: true, quantity: true },
    }),
    db.customer.findMany({
      select: { id: true, name: true, custodyId: true },
    }),
    db.payment.findMany({
      where: {
        OR: [{ customerId: null }, { custodyId: null }],
      },
      include: {
        custody: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const itemsByCustody = new Map<string, LiteItem[]>();
  for (const item of items) pushInto(itemsByCustody, item.custodyId, item);

  const chargesByCustody = new Map<string, LiteCharge[]>();
  const chargesByCustomer = new Map<string, LiteCharge[]>();
  for (const charge of charges) {
    if (charge.customerId) {
      pushInto(chargesByCustomer, charge.customerId, charge);
    } else if (charge.custodyId) {
      pushInto(chargesByCustody, charge.custodyId, charge);
    }
  }

  const paymentsByCustody = new Map<string, LitePayment[]>();
  const paymentsByCustomer = new Map<string, LitePayment[]>();
  for (const payment of payments) {
    if (payment.customerId) {
      pushInto(paymentsByCustomer, payment.customerId, payment);
    } else if (payment.custodyId) {
      pushInto(paymentsByCustody, payment.custodyId, payment);
    }
  }

  const custodyBalances = custodies.map((custody) => ({
    id: custody.id,
    name: custody.name,
    isActive: custody.isActive,
    balanceCents: computeCustodyBalance({
      openingBalanceCents: custody.openingBalanceCents,
      items: itemsByCustody.get(custody.id) ?? [],
      charges: chargesByCustody.get(custody.id) ?? [],
      payments: paymentsByCustody.get(custody.id) ?? [],
    }),
  }));

  let custodyDebtCents = 0;
  let custodyCustomersDebtCents = 0;
  let directDebtCents = 0;

  for (const custody of custodyBalances) {
    if (custody.isActive) custodyDebtCents += custody.balanceCents;
  }

  for (const customer of customers) {
    const balance = computeCustomerBalance({
      charges: chargesByCustomer.get(customer.id) ?? [],
      payments: paymentsByCustomer.get(customer.id) ?? [],
    });

    if (customer.custodyId) custodyCustomersDebtCents += balance;
    else directDebtCents += balance;
  }

  const movementsByProduct = new Map<
    string,
    Array<{ productId: string; type: "IN" | "OUT" | "ADJUST"; quantity: number }>
  >();
  for (const movement of movements) {
    pushInto(movementsByProduct, movement.productId, movement);
  }

  let warehouseValueCents = 0;
  const lowStock: Array<{
    id: string;
    name: string;
    unit: string | null;
    quantity: number;
    lowStockThreshold: number;
    status: "out" | "low" | "in";
  }> = [];

  for (const product of products) {
    const quantity = currentProductQuantity(
      movementsByProduct.get(product.id) ?? [],
    );
    warehouseValueCents += quantity * product.costPriceCents;

    const status = productStatus(quantity, product.lowStockThreshold);
    if (status !== "in") {
      lowStock.push({
        id: product.id,
        name: product.name,
        unit: product.unit,
        quantity,
        lowStockThreshold: product.lowStockThreshold,
        status,
      });
    }
  }

  lowStock.sort((a, b) => a.quantity - b.quantity);

  let custodyCashTodayCents = 0;
  let directCashTodayCents = 0;
  let paymentsToday = 0;

  for (const payment of payments) {
    if (payment.occurredOn !== today) continue;
    if (payment.customerId !== null && payment.custodyId !== null) continue;

    if (payment.customerId === null) custodyCashTodayCents += payment.amountCents;
    else directCashTodayCents += payment.amountCents;
    paymentsToday += 1;
  }

  const topCustodies = custodyBalances
    .filter((custody) => custody.isActive)
    .sort((a, b) => b.balanceCents - a.balanceCents)
    .slice(0, 5);

  return {
    activeCustodies: custodyBalances.filter((custody) => custody.isActive).length,
    customers: customers.length,
    products: products.length,
    custodyDebtCents,
    custodyCustomersDebtCents,
    directDebtCents,
    totalReceivableCents: custodyDebtCents + directDebtCents,
    todayCashCents: custodyCashTodayCents + directCashTodayCents,
    custodyCashTodayCents,
    directCashTodayCents,
    paymentsToday,
    warehouseValueCents,
    lowStock: lowStock.slice(0, 5),
    topCustodies,
    recentPayments: recentPayments.slice(0, 5),
  };
}
