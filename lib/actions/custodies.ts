"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { computeStockGroups, getCustodySales } from "@/lib/queries/balances";
import {
  messages,
  readDate,
  readMoney,
  readOptionalString,
  readPositiveInt,
  readString,
} from "@/lib/validation";

const CUSTODY_NAME_MAX = 80;
const COUNTRY_MAX = 80;

function custodyPaths(custodyId: string) {
  revalidatePath("/");
  revalidatePath("/custodies");
  revalidatePath(`/custodies/${custodyId}`);
  revalidatePath("/warehouse");
  revalidatePath("/goods");
}

export async function createCustodyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const name = readString(formData, "name");
  const phone = readOptionalString(formData, "phone");
  const country = readOptionalString(formData, "country");
  const note = readOptionalString(formData, "note");

  if (name.length < 2) return { error: "اكتب اسم العهدة (حرفين على الأقل)." };
  if (name.length > CUSTODY_NAME_MAX) return { error: "اسم العهدة طويل جدًا." };
  if (country && country.length > COUNTRY_MAX) {
    return { error: "اسم البلد أو المنطقة طويل جدًا." };
  }

  const existing = await db.custody.findUnique({ where: { name } });
  if (existing) return { error: "فيه عهدة بنفس الاسم بالفعل." };

  // No opening balance for a custody: its account is computed from its stock
  // and its customers (see computeCustodyBalance).
  const custody = await db.custody.create({
    data: { name, phone, country, note },
  });

  custodyPaths(custody.id);
  redirect(`/custodies/${custody.id}`);
}

export async function updateCustodyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = readString(formData, "id");
  const name = readString(formData, "name");
  const phone = readOptionalString(formData, "phone");
  const country = readOptionalString(formData, "country");
  const note = readOptionalString(formData, "note");

  if (!id) return { error: "العهدة مش موجودة." };
  if (name.length < 2) return { error: "اكتب اسم العهدة (حرفين على الأقل)." };
  if (name.length > CUSTODY_NAME_MAX) return { error: "اسم العهدة طويل جدًا." };
  if (country && country.length > COUNTRY_MAX) {
    return { error: "اسم البلد أو المنطقة طويل جدًا." };
  }

  const custody = await db.custody.findUnique({ where: { id } });
  if (!custody) return { error: "العهدة مش موجودة." };

  const duplicate = await db.custody.findFirst({
    where: { name, NOT: { id } },
  });
  if (duplicate) return { error: "فيه عهدة بنفس الاسم بالفعل." };

  await db.custody.update({
    where: { id },
    data: { name, phone, country, note },
  });

  custodyPaths(id);
  redirect(`/custodies/${id}`);
}

export async function toggleCustodyStatusAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  if (!id) return;

  const custody = await db.custody.findUnique({ where: { id } });
  if (!custody) return;

  await db.custody.update({
    where: { id },
    data: { isActive: !custody.isActive },
  });

  custodyPaths(id);
  redirect(`/custodies/${id}`);
}

export async function addCustodyDeliveryAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const custodyId = readString(formData, "custodyId");
  const name = readString(formData, "name");
  const unit = readOptionalString(formData, "unit");
  const quantity = readPositiveInt(formData, "quantity");
  const unitPriceCents = readMoney(formData, "unitPrice");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");

  if (!custodyId) return { error: "العهدة مش موجودة." };
  if (!name) return { error: "اكتب اسم الصنف." };
  if (!quantity) return { error: messages.invalidQuantity };
  if (unitPriceCents === null) return { error: "اكتب سعر الوحدة." };
  if (!occurredOn) return { error: messages.invalidDate };

  const custody = await db.custody.findUnique({ where: { id: custodyId } });
  if (!custody) return { error: "العهدة مش موجودة." };

  await db.custodyItem.create({
    data: {
      custodyId,
      type: "DELIVERY",
      name,
      unit,
      quantity,
      unitPriceCents,
      note,
      occurredOn,
    },
  });

  custodyPaths(custodyId);
  redirect(`/custodies/${custodyId}?tab=stock`);
}

export async function addCustodyReturnAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const custodyId = readString(formData, "custodyId");
  const stockKey = readString(formData, "stockKey");
  const productId = readString(formData, "productId");
  const quantity = readPositiveInt(formData, "quantity");
  const unitPriceCents = readMoney(formData, "unitPrice");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");

  if (!custodyId) return { error: "العهدة مش موجودة." };
  if (!stockKey) return { error: "اختار الصنف اللي راجع من العهدة." };
  if (!productId) return { error: "اختار منتج المخزن اللي هيستلم المرتجع." };
  if (!quantity) return { error: messages.invalidQuantity };
  if (unitPriceCents === null) return { error: "اكتب سعر الوحدة." };
  if (!occurredOn) return { error: messages.invalidDate };

  const [name, unitRaw] = stockKey.split("|||");
  const unit = unitRaw || null;

  if (!name) return { error: "اختار الصنف اللي راجع من العهدة." };

  const [custody, product, items, sales] = await Promise.all([
    db.custody.findUnique({ where: { id: custodyId } }),
    db.product.findUnique({ where: { id: productId } }),
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

  if (!custody) return { error: "العهدة مش موجودة." };
  if (!product) return { error: "منتج المخزن مش موجود." };

  // Sales count against what is really left: delivered − returned − sold.
  const group = computeStockGroups(items, sales).find(
    (item) => item.name === name && (item.unit ?? "") === (unit ?? ""),
  );

  if (!group || group.netQty < quantity) {
    return {
      error: `الكمية المتاحة في العهدة من «${name}» أقل من الكمية المرتجعة.`,
    };
  }

  await db.custodyItem.create({
    data: {
      custodyId,
      type: "RETURN",
      name,
      unit,
      quantity,
      unitPriceCents,
      note,
      occurredOn,
      productId,
      warehouseIn: {
        create: {
          productId,
          type: "IN",
          quantity,
          unitPriceCents,
          occurredOn,
          note,
        },
      },
    },
  });

  custodyPaths(custodyId);
  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/${productId}`);
  redirect(`/custodies/${custodyId}?tab=stock`);
}

export async function deleteCustodyItemAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  if (!id) return;

  const item = await db.custodyItem.findUnique({
    where: { id },
    select: { id: true, custodyId: true, productId: true },
  });
  if (!item) return;

  await db.custodyItem.delete({ where: { id } });

  custodyPaths(item.custodyId);
  if (item.productId) {
    revalidatePath(`/warehouse/${item.productId}`);
  }
  redirect(`/custodies/${item.custodyId}?tab=statement`);
}
