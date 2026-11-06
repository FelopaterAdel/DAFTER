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

function revalidatePaymentPaths(
  custodyId: string | null,
  customerId: string | null,
) {
  revalidatePath("/");
  revalidatePath("/collections");
  revalidatePath("/custodies");
  revalidatePath("/customers");
  if (custodyId) revalidatePath(`/custodies/${custodyId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function createPaymentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const kind = readString(formData, "kind");
  const custodyId = readOptionalString(formData, "custodyId");
  const customerId = readOptionalString(formData, "customerId");
  const amountCents = readMoney(formData, "amount");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");
  const redirectTo = readString(formData, "redirectTo");

  if (!amountCents || amountCents <= 0) return { error: messages.invalidAmount };
  if (!occurredOn) return { error: messages.invalidDate };

  // 1) General custody collection: reduces the custody balance + counts as cash.
  if (kind === "custody") {
    if (!custodyId) return { error: "اختار العهدة." };

    const custody = await db.custody.findUnique({ where: { id: custodyId } });
    if (!custody) return { error: "العهدة مش موجودة." };

    await db.payment.create({
      data: {
        custodyId,
        customerId: null,
        amountCents,
        occurredOn,
        note,
      },
    });

    revalidatePaymentPaths(custodyId, null);
    redirect(safeRedirect(redirectTo, "/collections"));
  }

  // 2) Custody customer payment: reduces the customer balance only.
  if (kind === "customer") {
    if (!customerId) return { error: "اختار الزبون." };

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "الزبون مش موجود." };
    if (!customer.custodyId) {
      return { error: "الزبون ده مباشر، استخدم تحصيل الزبائن المباشرين." };
    }

    await db.payment.create({
      data: {
        custodyId: customer.custodyId,
        customerId,
        amountCents,
        occurredOn,
        note,
      },
    });

    revalidatePaymentPaths(customer.custodyId, customerId);
    redirect(safeRedirect(redirectTo, `/customers/${customerId}`));
  }

  // 3) Direct customer payment: reduces the customer balance + counts as cash.
  if (kind === "direct") {
    if (!customerId) return { error: "اختار الزبون." };

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "الزبون مش موجود." };
    if (customer.custodyId) {
      return { error: "الزبون ده تابع لعهدة، سجّل دفعه من صفحة الزبون." };
    }

    await db.payment.create({
      data: {
        custodyId: null,
        customerId,
        amountCents,
        occurredOn,
        note,
      },
    });

    revalidatePaymentPaths(null, customerId);
    redirect(safeRedirect(redirectTo, "/collections"));
  }

  return { error: "نوع الدفعة غير معروف." };
}

export async function updateCustodyCollectionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = readString(formData, "id");
  const custodyId = readOptionalString(formData, "custodyId");
  const amountCents = readMoney(formData, "amount");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");

  if (!id) return { error: "الحركة مش موجودة." };
  if (!custodyId) return { error: "اختار العهدة." };
  if (!amountCents || amountCents <= 0) return { error: messages.invalidAmount };
  if (!occurredOn) return { error: messages.invalidDate };

  const [payment, custody] = await Promise.all([
    db.payment.findUnique({ where: { id } }),
    db.custody.findUnique({ where: { id: custodyId } }),
  ]);

  if (!payment || payment.customerId !== null) {
    return { error: "الحركة دي مش تحصيل عهدة." };
  }
  if (!custody) return { error: "العهدة مش موجودة." };

  await db.payment.update({
    where: { id },
    data: { custodyId, amountCents, occurredOn, note },
  });

  revalidatePaymentPaths(custodyId, null);
  if (payment.custodyId && payment.custodyId !== custodyId) {
    revalidatePath(`/custodies/${payment.custodyId}`);
  }
  redirect("/collections");
}

export async function updateDirectPaymentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = readString(formData, "id");
  const customerId = readOptionalString(formData, "customerId");
  const amountCents = readMoney(formData, "amount");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");

  if (!id) return { error: "الحركة مش موجودة." };
  if (!customerId) return { error: "اختار الزبون." };
  if (!amountCents || amountCents <= 0) return { error: messages.invalidAmount };
  if (!occurredOn) return { error: messages.invalidDate };

  const [payment, customer] = await Promise.all([
    db.payment.findUnique({ where: { id } }),
    db.customer.findUnique({ where: { id: customerId } }),
  ]);

  if (!payment || payment.custodyId !== null || payment.customerId === null) {
    return { error: "الحركة دي مش دفعة زبون مباشر." };
  }
  if (!customer) return { error: "الزبون مش موجود." };
  if (customer.custodyId) {
    return { error: "الزبون ده تابع لعهدة، سجّل دفعه من صفحة الزبون." };
  }

  await db.payment.update({
    where: { id },
    data: { customerId, amountCents, occurredOn, note },
  });

  revalidatePaymentPaths(null, customerId);
  if (payment.customerId !== customerId) {
    revalidatePath(`/customers/${payment.customerId}`);
  }
  redirect("/collections");
}

export async function deletePaymentAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  const redirectTo = readString(formData, "redirectTo");
  if (!id) return;

  const payment = await db.payment.findUnique({
    where: { id },
    select: { id: true, custodyId: true, customerId: true },
  });
  if (!payment) return;

  await db.payment.delete({ where: { id } });

  revalidatePaymentPaths(payment.custodyId, payment.customerId);
  redirect(safeRedirect(redirectTo, "/collections"));
}
