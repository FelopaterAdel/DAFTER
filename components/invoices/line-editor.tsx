"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import { centsToInput } from "@/lib/money";

export type InvoiceProductOption = {
  id: string;
  name: string;
  unit: string | null;
  salePriceCents: number | null;
  quantity: number;
};

type Line = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

const emptyLine = (): Line => ({ productId: "", quantity: "", unitPrice: "" });

/**
 * Dynamic invoice line rows. The rows are serialised into a single hidden
 * `lines` field (JSON) that the server action parses and validates.
 */
export function InvoiceLineEditor({
  products,
}: {
  products: InvoiceProductOption[];
}) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  function update(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);

    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;

        return {
          ...line,
          productId,
          // Sensible defaults, but only while the fields are still untouched.
          quantity: line.quantity || "1",
          unitPrice:
            line.unitPrice ||
            (product?.salePriceCents != null
              ? centsToInput(product.salePriceCents)
              : ""),
        };
      }),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  const payload = JSON.stringify(
    lines
      // Rows the owner never touched are dropped; half-filled rows are kept so
      // the server can point at what is missing.
      .filter(
        (line) => line.productId || line.quantity || line.unitPrice.trim(),
      )
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice.trim(),
      })),
  );

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const product = products.find((item) => item.id === line.productId);

        return (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-line bg-surface-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_auto] sm:items-end"
          >
            <Field label="الصنف" htmlFor={`line-product-${index}`}>
              <Select
                id={`line-product-${index}`}
                value={line.productId}
                onChange={(event) => selectProduct(index, event.target.value)}
              >
                <option value="">اختار الصنف…</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.unit ? ` (${item.unit})` : ""}
                  </option>
                ))}
              </Select>
              {product ? (
                <p className="mt-1.5 text-[11px] leading-5 text-muted">
                  متاح {product.quantity}
                  {product.unit ? ` ${product.unit}` : ""}
                </p>
              ) : null}
            </Field>

            <Field label="الكمية" htmlFor={`line-quantity-${index}`}>
              <Input
                id={`line-quantity-${index}`}
                inputMode="numeric"
                value={line.quantity}
                onChange={(event) => update(index, { quantity: event.target.value })}
                placeholder="1"
              />
            </Field>

            <Field label="سعر الوحدة" htmlFor={`line-price-${index}`}>
              <Input
                id={`line-price-${index}`}
                inputMode="decimal"
                value={line.unitPrice}
                onChange={(event) => update(index, { unitPrice: event.target.value })}
                placeholder="0"
              />
            </Field>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
              className="text-danger disabled:opacity-40"
            >
              إزالة
            </Button>
          </div>
        );
      })}

      <input type="hidden" name="lines" value={payload} />

      <Button type="button" variant="secondary" size="sm" onClick={addLine}>
        <PlusIcon className="size-4" />
        إضافة صنف
      </Button>
    </div>
  );
}
