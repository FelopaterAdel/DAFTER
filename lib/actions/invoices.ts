"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import {
  invoiceGrossCents,
  invoiceNetCents,
  invoiceReturnedCents,
  parseInvoiceLines,
  returnedQuantityMap,
} from "@/lib/invoices";
import { currentProductQuantity } from "@/lib/queries/balances";
import { formatMoney } from "@/lib/money";
import {
  messages,
  readDate,
  readMoney,
  readOptionalString,
  readPositiveInt,
  readString,
} from "@/lib/validation";

function revalidateInvoicePaths() {
  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/warehouse");
  revalidatePath("/goods");
  revalidatePath("/customers");
  revalidatePath("/reports/warehouse");
  revalidatePath("/reports/customer-debts");
}

function safeRedirect(value: string, fallback: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

/**
 * 3B — a quick sale from the warehouse: one OUT movement per line plus a
 * single charge that carries the invoice's current net amount.
 */
export async function createInvoiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const customerId = readOptionalString(formData, "customerId");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");
  const { lines, error } = parseInvoiceLines(readString(formData, "lines"));

  if (!occurredOn) return { error: messages.invalidDate };
  if (error) return { error };

  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) return { error: "الزبون مش موجود." };
  }

  const productIds = Array.from(new Set(lines.map((line) => line.productId)));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, isActive: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) return { error: "اختار الصنف من قائمة الأصناف." };
    if (!product.isActive) {
      return { error: `الصنف «${product.name}» موقوف، شغّله الأول.` };
    }
  }

  // A stock-out may never exceed what is on hand — same rule as the manual
  // warehouse movement form.
  const movements = await db.stockMovement.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, type: true, quantity: true },
  });
  const demand = new Map<string, number>();

  for (const line of lines) {
    demand.set(line.productId, (demand.get(line.productId) ?? 0) + line.quantity);
  }

  for (const [productId, wanted] of demand) {
    const available = currentProductQuantity(
      movements.filter((movement) => movement.productId === productId),
    );
    if (wanted > available) {
      const product = productById.get(productId);
      return {
        error: `المتاح من «${product?.name ?? "الصنف"}» ${available} بس.`,
      };
    }
  }

  const grossCents = invoiceGrossCents(lines);

  const invoice = await db.$transaction(async (tx) => {
    const last = await tx.salesInvoice.findFirst({
      orderBy: { invoiceNo: "desc" },
      select: { invoiceNo: true },
    });
    const invoiceNo = (last?.invoiceNo ?? 0) + 1;

    const created = await tx.salesInvoice.create({
      data: {
        invoiceNo,
        customerId: customerId ?? null,
        occurredOn,
        note,
      },
    });

    // A cash sale has no debt to record.
    if (customerId) {
      const charge = await tx.charge.create({
        data: {
          custodyId: null,
          customerId,
          amountCents: grossCents,
          occurredOn,
          note: `فاتورة رقم ${invoiceNo}`,
        },
      });

      await tx.salesInvoice.update({
        where: { id: created.id },
        data: { chargeId: charge.id },
      });
    }

    for (const line of lines) {
      await tx.salesInvoiceLine.create({
        data: { invoiceId: created.id, ...line },
      });

      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          type: "OUT",
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          occurredOn,
          note: `فاتورة رقم ${invoiceNo}`,
          salesInvoiceId: created.id,
        },
      });
    }

    return created;
  });

  revalidateInvoicePaths();
  for (const productId of productIds) revalidatePath(`/warehouse/${productId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  redirect(`/invoices/${invoice.id}`);
}

/** 3B — goods come back: IN movement + the invoice's charge shrinks. */
export async function addInvoiceReturnAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const invoiceId = readString(formData, "invoiceId");
  const productId = readString(formData, "productId");
  const quantity = readPositiveInt(formData, "quantity");
  const occurredOn = readDate(formData, "occurredOn");
  const note = readOptionalString(formData, "note");

  if (!invoiceId) return { error: "الفاتورة مش موجودة." };
  if (!productId) return { error: "اختار الصنف المرتجع." };
  if (!quantity) return { error: messages.invalidQuantity };
  if (!occurredOn) return { error: messages.invalidDate };

  const invoice = await db.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { select: { productId: true, quantity: true, unitPriceCents: true } },
      returns: { select: { productId: true, quantity: true, unitPriceCents: true } },
      charge: { select: { id: true } },
    },
  });
  if (!invoice) return { error: "الفاتورة مش موجودة." };

  const line = invoice.lines.find((row) => row.productId === productId);
  if (!line) return { error: "الصنف ده مش من أصناف الفاتورة." };

  const alreadyReturned = returnedQuantityMap(invoice.returns).get(productId) ?? 0;
  const stillReturnable = line.quantity - alreadyReturned;
  if (quantity > stillReturnable) {
    return { error: `المتاح للمرتجع ${stillReturnable} بس من الصنف ده.` };
  }

  const returnedRow = {
    productId,
    quantity,
    unitPriceCents: line.unitPriceCents,
  };
  const netCents = invoiceNetCents({
    lines: invoice.lines,
    returns: [...invoice.returns, returnedRow],
    discountCents: invoice.discountCents,
  });

  await db.$transaction(async (tx) => {
    await tx.invoiceReturn.create({
      data: {
        invoiceId: invoice.id,
        productId,
        quantity,
        unitPriceCents: line.unitPriceCents,
        occurredOn,
        note,
        stockMovement: {
          create: {
            productId,
            type: "IN",
            quantity,
            unitPriceCents: line.unitPriceCents,
            occurredOn,
            note,
          },
        },
      },
    });

    if (invoice.charge) {
      await tx.charge.update({
        where: { id: invoice.charge.id },
        data: { amountCents: netCents },
      });
    }
  });

  revalidateInvoicePaths();
  revalidatePath(`/warehouse/${productId}`);
  if (invoice.customerId) revalidatePath(`/customers/${invoice.customerId}`);
  redirect(`/invoices/${invoice.id}`);
}

/** 3B — a discount on the invoice lowers what the customer owes. */
export async function applyInvoiceDiscountAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const invoiceId = readString(formData, "invoiceId");
  const discountCents = readMoney(formData, "discount");
  const discountNote = readOptionalString(formData, "discountNote");

  if (!invoiceId) return { error: "الفاتورة مش موجودة." };
  if (discountCents === null || discountCents < 0) {
    return { error: "اكتب مبلغ الخصم (صفر أو أكبر)." };
  }

  const invoice = await db.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { select: { productId: true, quantity: true, unitPriceCents: true } },
      returns: { select: { productId: true, quantity: true, unitPriceCents: true } },
      charge: { select: { id: true } },
    },
  });
  if (!invoice) return { error: "الفاتورة مش موجودة." };

  const grossCents = invoiceGrossCents(invoice.lines);
  const returnedCents = invoiceReturnedCents(invoice.returns);
  const maxDiscount = grossCents - returnedCents;

  if (discountCents > maxDiscount) {
    return {
      error: `أقصى خصم ممكن على الفاتورة ${formatMoney(maxDiscount)}.`,
    };
  }

  const netCents = maxDiscount - discountCents;

  await db.$transaction(async (tx) => {
    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { discountCents, discountNote },
    });

    if (invoice.charge) {
      await tx.charge.update({
        where: { id: invoice.charge.id },
        data: { amountCents: netCents },
      });
    }
  });

  revalidateInvoicePaths();
  if (invoice.customerId) revalidatePath(`/customers/${invoice.customerId}`);
  redirect(`/invoices/${invoice.id}`);
}

/**
 * 3B — deleting the invoice restores every stock movement it created and
 * removes its charge, so nothing is left behind.
 */
export async function deleteInvoiceAction(formData: FormData) {
  await requireAuth();

  const id = readString(formData, "id");
  const redirectTo = readString(formData, "redirectTo");
  if (!id) return;

  const invoice = await db.salesInvoice.findUnique({
    where: { id },
    select: { id: true, chargeId: true, customerId: true },
  });
  if (!invoice) return;

  await db.$transaction(async (tx) => {
    if (invoice.chargeId) {
      await tx.charge.delete({ where: { id: invoice.chargeId } });
    }
    await tx.salesInvoice.delete({ where: { id } });
  });

  revalidateInvoicePaths();
  if (invoice.customerId) revalidatePath(`/customers/${invoice.customerId}`);
  redirect(safeRedirect(redirectTo, "/invoices"));
}
