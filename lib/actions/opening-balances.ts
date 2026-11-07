"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { readMoney, readString } from "@/lib/validation";

function safeRedirect(value: string, fallback: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

/**
 * Phase 3E: sets the opening balance of a custody or a customer straight from
 * the "أرصدة افتتاحية" screen — the paper-ledger way of moving old balances in.
 */
export async function setOpeningBalanceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const scope = readString(formData, "scope");
  const id = readString(formData, "id");
  const raw = readString(formData, "openingBalance");
  const redirectTo = readString(formData, "redirectTo");

  if (!id) return { error: "السجل مش موجود." };

  // Blank is an error on purpose: a cleared field must not silently wipe an
  // existing opening balance.
  if (!raw) return { error: "اكتب الرصيد الافتتاحي (أو صفر)." };

  const value = readMoney(formData, "openingBalance");
  if (value === null || value < 0) {
    return { error: "الرصيد الافتتاحي لازم يكون صفر أو أكبر." };
  }

  if (scope === "custody") {
    const custody = await db.custody.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!custody) return { error: "العهدة مش موجودة." };

    await db.custody.update({
      where: { id },
      data: { openingBalanceCents: value },
    });

    revalidatePath("/");
    revalidatePath("/custodies");
    revalidatePath(`/custodies/${id}`);
    revalidatePath("/opening-balances");
    revalidatePath("/reports/custody-debts");
    redirect(safeRedirect(redirectTo, "/opening-balances"));
  }

  if (scope === "customer") {
    const customer = await db.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) return { error: "الزبون مش موجود." };

    await db.customer.update({
      where: { id },
      data: { openingBalanceCents: value },
    });

    revalidatePath("/");
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    revalidatePath("/opening-balances");
    revalidatePath("/reports/customer-debts");
    redirect(safeRedirect(redirectTo, "/opening-balances"));
  }

  return { error: "نوع السجل غير معروف." };
}
