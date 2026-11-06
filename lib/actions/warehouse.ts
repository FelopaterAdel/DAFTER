"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { currentProductQuantity } from "@/lib/queries/balances";
import {
  messages,
  readDate,
  readMoney,
  readNonNegativeInt,
  readOptionalString,
  readPositiveInt,
  readSignedInt,
  readString,
} from "@/lib/validation";

const NAME_MAX = 80;

function revalidateWarehousePaths(productId?: string) {
  revalidatePath("/");
  revalidatePath("/warehouse");
  if (productId) revalidatePath(`/warehouse/${productId}`);
}

function parseOptionalMoney(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) return { value: null as number | null, error: null as string | null };

  const value = readMoney(formData, key);
  if (value === null || value < 0) {
    return { value: null, error: "اكتب مبلغ صحيح (صفر أو أكبر)." };
  }

  return { value, error: null };
}

function validateProductName(name: string) {
  if (name.length < 2) return "اكتب اسم الصنف (حرفين على الأقل).";
  if (name.length > NAME_MAX) return "اسم الصنف طويل جدًا.";
  return null;
}

type ProductFormResult =
  | {
      ok: true;
      data: {
        name: string;
        unit: string | null;
        note: string | null;
        costPriceCents: number;
        salePriceCents: number | null;
        lowStockThreshold: number;
      };
    }
  | { ok: false; error: string };

async function readProductForm(formData: FormData): Promise<ProductFormResult> {
  const name = readString(formData, "name");
  const unit = readOptionalString(formData, "unit");
  const note = readOptionalString(formData, "note");
  const cost = parseOptionalMoney(formData, "costPrice");
  const sale = parseOptionalMoney(formData, "salePrice");
  const thresholdRaw = readString(formData, "lowStockThreshold");
  const threshold = thresholdRaw ? readNonNegativeInt(formData, "lowStockThreshold") : 0;

  const nameError = validateProductName(name);
  if (nameError) return { ok: false, error: nameError };
  if (cost.error) return { ok: false, error: cost.error };
  if (sale.error) return { ok: false, error: sale.error };
  if (threshold === null) {
    return { ok: false, error: "حد التنبيه لازم يكون رقم صحيح." };
  }

  return {
    ok: true,
    data: {
      name,
      unit,
      note,
      costPriceCents: cost.value ?? 0,
      salePriceCents: sale.value,
      lowStockThreshold: threshold,
    },
  };
}

export async function createProductAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const parsed = await readProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const duplicate = await db.product.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (duplicate) return { error: "فيه صنف بنفس الاسم بالفعل." };

  const product = await db.product.create({ data: parsed.data });

  revalidateWarehousePaths(product.id);
  redirect(`/warehouse/${product.id}`);
}

export async function updateProductAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = readString(formData, "id");
  if (!id) return { error: "الصنف مش موجود." };

  const parsed = await readProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const product = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return { error: "الصنف مش موجود." };

  const duplicate = await db.product.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) return { error: "فيه صنف بنفس الاسم بالفعل." };

  await db.product.update({ where: { id }, data: parsed.data });

  revalidateWarehousePaths(id);
  redirect(`/warehouse/${id}`);
}

export async function toggleProductStatusAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  if (!id) return;

  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!product) return;

  await db.product.update({
    where: { id },
    data: { isActive: !product.isActive },
  });

  revalidateWarehousePaths(id);
  redirect(`/warehouse/${id}`);
}

export async function addStockMovementAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const productId = readString(formData, "productId");
  const type = readString(formData, "type");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");
  const unitPrice = parseOptionalMoney(formData, "unitPrice");

  if (!productId) return { error: "الصنف مش موجود." };
  if (type !== "IN" && type !== "OUT" && type !== "ADJUST") {
    return { error: "نوع الحركة غير معروف." };
  }
  if (!occurredOn) return { error: messages.invalidDate };
  if (unitPrice.error) return { error: unitPrice.error };

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      movements: { select: { productId: true, type: true, quantity: true } },
    },
  });
  if (!product) return { error: "الصنف مش موجود." };

  const current = currentProductQuantity(product.movements);
  let quantity: number | null = null;

  if (type === "ADJUST") {
    const delta = readSignedInt(formData, "quantity");
    if (!delta) return { error: "اكتب فرق كمية صحيح (موجب أو سالب)." };
    if (current + delta < 0) {
      return { error: "التسوية هتخلي رصيد الصنف بالسالب. راجع الكمية." };
    }
    quantity = delta;
  } else {
    quantity = readPositiveInt(formData, "quantity");
    if (!quantity) return { error: messages.invalidQuantity };
    if (type === "OUT" && quantity > current) {
      return { error: `المتاح من «${product.name}» ${current} بس.` };
    }
  }

  await db.stockMovement.create({
    data: {
      productId,
      type,
      quantity,
      unitPriceCents: unitPrice.value,
      occurredOn,
      note,
    },
  });

  revalidateWarehousePaths(productId);
  redirect(`/warehouse/${productId}`);
}

export async function deleteStockMovementAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  const redirectTo = readString(formData, "redirectTo");
  if (!id) return;

  const movement = await db.stockMovement.findUnique({
    where: { id },
    select: { id: true, productId: true, custodyItemId: true },
  });
  if (!movement) return;

  // A movement created by a custody return is owned by that return. It is
  // removed by deleting the return item, not directly from the warehouse.
  if (movement.custodyItemId) {
    redirect(`/warehouse/${movement.productId}`);
  }

  await db.stockMovement.delete({ where: { id } });

  revalidateWarehousePaths(movement.productId);
  const safe =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : `/warehouse/${movement.productId}`;
  redirect(safe);
}
