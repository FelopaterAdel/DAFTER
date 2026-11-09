"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BoxIcon,
  BriefcaseIcon,
  TagIcon,
} from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { addCustodyDeliveryAction } from "@/lib/actions/custodies";
import { addStockMovementAction } from "@/lib/actions/warehouse";
import { formatMoney } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  unit: string | null;
  costPriceCents: number;
  salePriceCents: number | null;
};

type Custody = { id: string; name: string };

type Kind = "custody" | "warehouse";

type OpenPanel = { productId: string; kind: Kind };

export function GoodsCatalog({
  products,
  custodies,
  quantities,
  today,
  hasQuery,
}: {
  products: Product[];
  custodies: Custody[];
  quantities: Record<string, number>;
  today: string;
  hasQuery: boolean;
}) {
  const [open, setOpen] = useState<OpenPanel | null>(null);

  function toggle(productId: string, kind: Kind) {
    setOpen((current) =>
      current && current.productId === productId && current.kind === kind
        ? null
        : { productId, kind },
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={TagIcon}
        title={hasQuery ? "مفيش نتائج للبحث" : "مفيش بضائع لسه"}
        description={
          hasQuery
            ? "جرّب اسم تاني، أو امسح البحث تشوف كل البضائع."
            : "أضف أول بضاعة من الفورم فوق (اسم وسعر)، وهيظهر هنا بسعرها وتقدر تورّدها لأي عهدة أو تدخلها للمخزن."
        }
      />
    );
  }

  function actions(product: Product, compact: boolean) {
    const custodyOpen =
      open?.productId === product.id && open.kind === "custody";
    const warehouseOpen =
      open?.productId === product.id && open.kind === "warehouse";

    return (
      <div
        className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap justify-end gap-2"}
      >
        <button
          type="button"
          onClick={() => toggle(product.id, "custody")}
          aria-expanded={custodyOpen}
          className={buttonStyles({
            variant: custodyOpen ? "primary" : "secondary",
            size: "sm",
            className: "whitespace-nowrap",
          })}
        >
          <BriefcaseIcon className="size-4" />
          توريد لعهدة
        </button>
        <button
          type="button"
          onClick={() => toggle(product.id, "warehouse")}
          aria-expanded={warehouseOpen}
          className={buttonStyles({
            variant: warehouseOpen ? "gold" : "secondary",
            size: "sm",
            className: "whitespace-nowrap",
          })}
        >
          <BoxIcon className="size-4" />
          إدخال للمخزن
        </button>
      </div>
    );
  }

  function panel(product: Product, kind: Kind, idPrefix: string) {
    return (
      <ActionPanel
        product={product}
        kind={kind}
        custodies={custodies}
        today={today}
        idPrefix={idPrefix}
        onClose={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile: one card per product. */}
      <div className="grid gap-3 md:hidden">
        {products.map((product) => {
          const quantity = quantities[product.id] ?? 0;

          return (
            <div
              key={product.id}
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-muted">
                    {product.unit || "بدون وحدة"} · تكلفة{" "}
                    {formatMoney(product.costPriceCents)}
                    {product.salePriceCents !== null
                      ? ` · بيع ${formatMoney(product.salePriceCents)}`
                      : ""}
                  </p>
                </div>
                <Badge tone={quantity === 0 ? "danger" : "neutral"}>
                  {quantity === 0 ? "نافد" : `المتاح ${quantity}`}
                </Badge>
              </div>

              <div className="mt-3 print:hidden">{actions(product, true)}</div>

              {open && open.productId === product.id ? (
                <div className="mt-4 border-t border-line pt-4 print:hidden">
                  {panel(product, open.kind, `m-${product.id}`)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop: one table. */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>البضاعة</TableHeaderCell>
              <TableHeaderCell>سعر التكلفة</TableHeaderCell>
              <TableHeaderCell>سعر البيع</TableHeaderCell>
              <TableHeaderCell>المتاح</TableHeaderCell>
              <TableHeaderCell> </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => {
              const quantity = quantities[product.id] ?? 0;

              return (
                <Fragment key={product.id}>
                  <TableRow>
                    <TableCell>
                      <p className="font-bold text-ink">{product.name}</p>
                      <span className="block text-[11px] font-medium text-muted">
                        {product.unit || "بدون وحدة"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted">
                      {formatMoney(product.costPriceCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted">
                      {product.salePriceCents === null
                        ? "—"
                        : formatMoney(product.salePriceCents)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={quantity === 0 ? "danger" : "neutral"}>
                        {quantity === 0 ? "نافد" : quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="print:hidden">{actions(product, false)}</div>
                    </TableCell>
                  </TableRow>
                  {open && open.productId === product.id ? (
                    <TableRow className="hover:bg-transparent print:hidden">
                      <TableCell
                        colSpan={5}
                        className="bg-surface-muted/40 align-top"
                      >
                        {panel(product, open.kind, `d-${product.id}`)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActionPanel({
  product,
  kind,
  custodies,
  today,
  idPrefix,
  onClose,
}: {
  product: Product;
  kind: Kind;
  custodies: Custody[];
  today: string;
  idPrefix: string;
  onClose: () => void;
}) {
  const cancel = (
    <button
      type="button"
      onClick={onClose}
      className={buttonStyles({ variant: "ghost", size: "sm" })}
    >
      إلغاء
    </button>
  );

  if (kind === "custody") {
    if (custodies.length === 0) {
      return (
        <p className="rounded-xl bg-gold-soft/60 px-3.5 py-3 text-sm leading-6 text-ink">
          مفيش عهد نشطة —{" "}
          <Link
            href="/custodies/new"
            className="font-bold text-brand hover:underline"
          >
            أضف عهدة
          </Link>{" "}
          الأول عشان تورّد البضاعة.
        </p>
      );
    }

    // Deliveries are priced from the catalog: sale price, else cost price.
    const defaultPrice = product.salePriceCents || product.costPriceCents;
    const priceLabel =
      defaultPrice > 0
        ? formatMoney(defaultPrice)
        : "بدون سعر — حدّثه من صفحة البضائع";

    return (
      <ActionForm
        action={addCustodyDeliveryAction}
        submitLabel="إضافة التوريد"
        pendingLabel="جارٍ الإضافة..."
        footer={cancel}
      >
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="redirectTo" value="/goods" />
        <p className="mb-4 rounded-xl bg-surface-muted px-3.5 py-3 text-sm leading-6 text-ink">
          <span className="font-extrabold">{product.name}</span>
          {product.unit ? ` · ${product.unit}` : ""} ·{" "}
          <span className="font-bold text-brand-dark">{priceLabel}</span>{" "}
          <span className="text-muted">— السعر تلقائي من البضاعة.</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="العهدة" htmlFor={`${idPrefix}-custody`}>
            <Select
              id={`${idPrefix}-custody`}
              name="custodyId"
              required
              defaultValue=""
            >
              <option value="">اختار العهدة…</option>
              {custodies.map((custody) => (
                <option key={custody.id} value={custody.id}>
                  {custody.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الكمية" htmlFor={`${idPrefix}-qty`}>
            <Input
              id={`${idPrefix}-qty`}
              name="quantity"
              inputMode="numeric"
              required
              placeholder="1"
            />
          </Field>
          <Field label="التاريخ" htmlFor={`${idPrefix}-date`}>
            <Input
              id={`${idPrefix}-date`}
              name="occurredOn"
              type="date"
              required
              defaultValue={today}
            />
          </Field>
          <Field
            label="ملاحظات"
            htmlFor={`${idPrefix}-note`}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Input id={`${idPrefix}-note`} name="note" placeholder="اختياري" />
          </Field>
        </div>
      </ActionForm>
    );
  }

  return (
    <ActionForm
      action={addStockMovementAction}
      submitLabel="إدخال للمخزن"
      pendingLabel="جارٍ الإدخال..."
      variant="gold"
      footer={cancel}
    >
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="type" value="IN" />
      <input type="hidden" name="redirectTo" value="/goods" />
      <p className="mb-4 rounded-xl bg-surface-muted px-3.5 py-3 text-sm leading-6 text-ink">
        <span className="font-extrabold">{product.name}</span>
        {product.unit ? ` · ${product.unit}` : ""} ·{" "}
        <span className="font-bold text-brand-dark">
          {formatMoney(product.costPriceCents)}
        </span>{" "}
        <span className="text-muted">— بيتسجل بسعر التكلفة.</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="الكمية" htmlFor={`${idPrefix}-qty`}>
          <Input
            id={`${idPrefix}-qty`}
            name="quantity"
            inputMode="numeric"
            required
            placeholder="1"
          />
        </Field>
        <Field label="التاريخ" htmlFor={`${idPrefix}-date`}>
          <Input
            id={`${idPrefix}-date`}
            name="occurredOn"
            type="date"
            required
            defaultValue={today}
          />
        </Field>
        <Field label="ملاحظات" htmlFor={`${idPrefix}-note`}>
          <Input id={`${idPrefix}-note`} name="note" placeholder="اختياري" />
        </Field>
      </div>
    </ActionForm>
  );
}
