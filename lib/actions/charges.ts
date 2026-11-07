"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import {
  computeStockGroups,
  getCustodySales,
} from "@/lib/queries/balances";
import {
  messages,
  readDate,
  readMoney,
  readOptionalString,
  readPositiveInt,
  readString,
} from "@/lib/validation";

function safeRedirect(value: string, fallback: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

function appendParam(url: string, key: string, value: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${value}`;
}

function revalidateChargePaths(custodyId: string | null, customerId: string | null) {
  revalidatePath("/");
  revalidatePath("/custodies");
  revalidatePath("/customers");
  if (custodyId) revalidatePath(`/custodies/${custodyId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

/** How many units of a custody stock group are still on hand (3A). */
async function availableQuantity(
  custodyId: string,
  itemName: string,
  unit: string | null,
) {
  const [items, sales] = await Promise.all([
    db.custodyItem.findMany({
      where: { custodyId },
      select: {
        custodyId: true,
        type: true,
        name: true,
        unit: true,
        quantity: true,
        unitPriceCents: true,
      },
    }),
    getCustodySales(custodyId),
  ]);

  const group = computeStockGroups(items, sales).find(
    (item) => item.name === itemName && (item.unit ?? "") === (unit ?? ""),
  );

  return group?.netQty ?? 0;
}

export async function createChargeAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const scope = readString(formData, "scope");
  const custodyId = readOptionalString(formData, "custodyId");
  const customerId = readOptionalString(formData, "customerId");
  const amountCents = readMoney(formData, "amount");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");
  const redirectTo = readString(formData, "redirectTo");
  const stockKey = readOptionalString(formData, "stockKey");
  const saleQuantity = readPositiveInt(formData, "quantity");

  if (!amountCents || amountCents <= 0) return { error: messages.invalidAmount };
  if (!occurredOn) return { error: messages.invalidDate };

  if (scope === "custody") {
    if (!custodyId) return { error: "اختار العهدة." };

    const custody = await db.custody.findUnique({ where: { id: custodyId } });
    if (!custody) return { error: "العهدة مش موجودة." };

    await db.charge.create({
      data: { custodyId, customerId: null, amountCents, occurredOn, note },
    });

    revalidateChargePaths(custodyId, null);
    redirect(safeRedirect(redirectTo, `/custodies/${custodyId}?tab=statement`));
  }

  if (scope === "customer") {
    if (!customerId) return { error: "اختار الزبون." };

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "الزبون مش موجود." };

    // Optional stock sale (3A): only custody customers have custody stock.
    let itemName: string | null = null;
    let unit: string | null = null;
    let quantity: number | null = null;
    let saleCustodyId: string | null = null;
    let shortfall = false;

    if (stockKey) {
      if (!customer.custodyId) {
        return { error: "الخصم من المخزون متاح لزبائن العهدة بس." };
      }
      if (!saleQuantity) return { error: messages.invalidQuantity };

      const [name, unitRaw] = stockKey.split("|||");
      if (!name) return { error: "اختار الصنف اللي هيتباع." };

      itemName = name;
      unit = unitRaw || null;
      quantity = saleQuantity;
      saleCustodyId = customer.custodyId;

      // Warn and allow (owner decision): the charge is recorded even when the
      // quantity is larger than what is on hand; the stock view goes negative
      // and the customer page shows a warning.
      shortfall = saleQuantity > (await availableQuantity(saleCustodyId, itemName, unit));
    }

    // A customer charge never changes the custody balance. For a stock sale the
    // custody id is stored only to attribute the deduction to that stock.
    await db.charge.create({
      data: {
        custodyId: saleCustodyId,
        customerId,
        amountCents,
        occurredOn,
        note,
        itemName,
        unit,
        quantity,
      },
    });

    revalidateChargePaths(saleCustodyId, customerId);
    const target = safeRedirect(redirectTo, `/customers/${customerId}`);
    redirect(shortfall ? appendParam(target, "stockWarning", "1") : target);
  }

  return { error: "نوع الاستحقاق غير معروف." };
}

export async function deleteChargeAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  const redirectTo = readString(formData, "redirectTo");
  if (!id) return;

  const charge = await db.charge.findUnique({
    where: { id },
    select: {
      id: true,
      custodyId: true,
      customerId: true,
      invoice: { select: { id: true } },
    },
  });
  if (!charge) return;

  // An invoice charge is owned by its invoice; delete the invoice instead.
  if (charge.invoice) redirect(`/invoices/${charge.invoice.id}`);

  await db.charge.delete({ where: { id } });

  revalidateChargePaths(charge.custodyId, charge.customerId);
  redirect(safeRedirect(redirectTo, "/"));
}
