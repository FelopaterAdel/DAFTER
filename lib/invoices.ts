import { parseMoneyToCents } from "@/lib/money";

// Shared invoice math (3B). Pure functions so the create/return/discount
// actions and every invoice screen compute the same totals.

export type InvoiceLineLike = {
  quantity: number;
  unitPriceCents: number;
};

export type InvoiceReturnLike = {
  productId?: string;
  quantity: number;
  unitPriceCents: number;
};

export type ParsedInvoiceLine = {
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

export function invoiceGrossCents(lines: InvoiceLineLike[]) {
  return lines.reduce(
    (total, line) => total + line.quantity * line.unitPriceCents,
    0,
  );
}

export function invoiceReturnedCents(returns: InvoiceReturnLike[]) {
  return returns.reduce(
    (total, row) => total + row.quantity * row.unitPriceCents,
    0,
  );
}

/** Amount still owed: gross − discount − value of returned goods. */
export function invoiceNetCents({
  lines,
  returns,
  discountCents,
}: {
  lines: InvoiceLineLike[];
  returns: InvoiceReturnLike[];
  discountCents: number;
}) {
  return (
    invoiceGrossCents(lines) -
    discountCents -
    invoiceReturnedCents(returns)
  );
}

/** How many units of each product have already been returned. */
export function returnedQuantityMap(returns: InvoiceReturnLike[]) {
  const map = new Map<string, number>();

  for (const row of returns) {
    if (!row.productId) continue;
    map.set(row.productId, (map.get(row.productId) ?? 0) + row.quantity);
  }

  return map;
}

/**
 * Parses the JSON produced by the invoice line editor. Every message is
 * user-facing Arabic, so validation stays in one place.
 */
export function parseInvoiceLines(raw: string): {
  lines: ParsedInvoiceLine[];
  error: string | null;
} {
  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    return { lines: [], error: "راجع أصناف الفاتورة وحاول تاني." };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { lines: [], error: "أضف صنف واحد على الأقل للفاتورة." };
  }

  if (data.length > 50) {
    return { lines: [], error: "الفاتورة فيها أكتر من 50 سطر." };
  }

  const lines: ParsedInvoiceLine[] = [];

  for (const entry of data) {
    const row = entry as Partial<ParsedInvoiceLine> & { unitPrice?: unknown };
    const productId = String(row.productId ?? "").trim();
    const quantity = Number(row.quantity);
    const unitPriceCents = parseMoneyToCents(String(row.unitPrice ?? ""));

    if (!productId) {
      return { lines: [], error: "اختار الصنف في كل سطر من الفاتورة." };
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return {
        lines: [],
        error: "كل كمية لازم تكون رقم صحيح أكبر من صفر.",
      };
    }
    if (unitPriceCents === null) {
      return {
        lines: [],
        error: "اكتب سعر وحدة صحيح لكل صنف (صفر أو أكبر).",
      };
    }

    lines.push({ productId, quantity, unitPriceCents });
  }

  return { lines, error: null };
}
