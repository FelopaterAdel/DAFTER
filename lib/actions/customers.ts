"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import {
  messages,
  readMoney,
  readOptionalString,
  readString,
} from "@/lib/validation";

const NAME_MAX = 80;

function revalidateCustomerPaths(customerId?: string) {
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/custodies");
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

async function resolveCustodyId(raw: string | null) {
  if (!raw) return { custodyId: null as string | null, error: null as string | null };

  const custody = await db.custody.findUnique({
    where: { id: raw },
    select: { id: true },
  });

  if (!custody) {
    return { custodyId: null, error: "العهدة المختارة مش موجودة." };
  }

  return { custodyId: custody.id, error: null };
}

function validateCustomer({
  name,
  country,
  custodyId,
}: {
  name: string;
  country: string | null;
  custodyId: string | null;
}) {
  if (name.length < 2) return "اكتب اسم الزبون (حرفين على الأقل).";
  if (name.length > NAME_MAX) return "اسم الزبون طويل جدًا.";
  if (country && country.length > NAME_MAX) return "اسم البلد أو المنطقة طويل جدًا.";
  if (!custodyId && !country) {
    return "الزبون المباشر لازم يكون ليه بلد أو منطقة.";
  }
  return null;
}

export async function createCustomerAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const name = readString(formData, "name");
  const phone = readOptionalString(formData, "phone");
  const country = readOptionalString(formData, "country");
  const note = readOptionalString(formData, "note");
  const rawCustodyId = readOptionalString(formData, "custodyId");
  const rawAmount = readString(formData, "initialAmount");

  const validationError = validateCustomer({ name, country, custodyId: rawCustodyId });
  if (validationError) return { error: validationError };

  const { custodyId, error } = await resolveCustodyId(rawCustodyId);
  if (error) return { error };

  // A direct customer always has a region, even after resolving the custody.
  if (!custodyId && !country) {
    return { error: "اكتب بلد أو منطقة الزبون المباشر." };
  }

  // Phase 3E: the first amount is an opening balance, not a fabricated charge,
  // so the opening-balance screen and this form can never double count.
  let openingBalanceCents = 0;
  if (rawAmount) {
    const parsed = readMoney(formData, "initialAmount");
    if (!parsed || parsed <= 0) return { error: messages.invalidAmount };
    openingBalanceCents = parsed;
  }

  const customer = await db.customer.create({
    data: {
      name,
      phone,
      country,
      note,
      custodyId,
      openingBalanceCents,
    },
  });

  revalidateCustomerPaths(customer.id);
  if (custodyId) revalidatePath(`/custodies/${custodyId}`);
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = readString(formData, "id");
  const name = readString(formData, "name");
  const phone = readOptionalString(formData, "phone");
  const country = readOptionalString(formData, "country");
  const note = readOptionalString(formData, "note");
  const rawCustodyId = readOptionalString(formData, "custodyId");

  if (!id) return { error: "الزبون مش موجود." };

  const customer = await db.customer.findUnique({
    where: { id },
    select: { id: true, custodyId: true },
  });
  if (!customer) return { error: "الزبون مش موجود." };

  const { custodyId, error } = await resolveCustodyId(rawCustodyId);
  if (error) return { error };

  const validationError = validateCustomer({ name, country, custodyId });
  if (validationError) return { error: validationError };

  await db.customer.update({
    where: { id },
    data: { name, phone, country, note, custodyId },
  });

  revalidateCustomerPaths(id);
  if (customer.custodyId) revalidatePath(`/custodies/${customer.custodyId}`);
  if (custodyId) revalidatePath(`/custodies/${custodyId}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomerAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  if (!id) return;

  const customer = await db.customer.findUnique({
    where: { id },
    select: { id: true, custodyId: true },
  });
  if (!customer) return;

  await db.customer.delete({ where: { id } });

  revalidateCustomerPaths();
  if (customer.custodyId) revalidatePath(`/custodies/${customer.custodyId}`);
  redirect("/customers");
}
