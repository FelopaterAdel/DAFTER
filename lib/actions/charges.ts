"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import {
  messages,
  readDate,
  readMoney,
  readOptionalString,
  readString,
} from "@/lib/validation";

function safeRedirect(value: string, fallback: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

function revalidateChargePaths(custodyId: string | null, customerId: string | null) {
  revalidatePath("/");
  revalidatePath("/custodies");
  revalidatePath("/customers");
  if (custodyId) revalidatePath(`/custodies/${custodyId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
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

    // A customer charge never affects the custody balance.
    await db.charge.create({
      data: { custodyId: null, customerId, amountCents, occurredOn, note },
    });

    revalidateChargePaths(null, customerId);
    redirect(safeRedirect(redirectTo, `/customers/${customerId}`));
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
    select: { id: true, custodyId: true, customerId: true },
  });
  if (!charge) return;

  await db.charge.delete({ where: { id } });

  revalidateChargePaths(charge.custodyId, charge.customerId);
  redirect(safeRedirect(redirectTo, "/"));
}
