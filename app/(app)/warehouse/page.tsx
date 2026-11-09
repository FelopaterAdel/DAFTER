import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BoxIcon, PlusIcon } from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { addStockMovementAction } from "@/lib/actions/warehouse";
import { requireAuth } from "@/lib/auth/dal";
import { todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import {
  getProductQuantityMap,
  productStatus,
} from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "المخزن",
};

export const instant = false;

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const statusMeta = {
  in: { label: "متوفر", tone: "success" as const },
  low: { label: "قليل", tone: "gold" as const },
  out: { label: "نافد", tone: "danger" as const },
};

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const q = first(params.q).trim();
  const status = ["active", "inactive", "all"].includes(first(params.status))
    ? first(params.status)
    : "active";

  const [products, quantities, activeProducts] = await Promise.all([
    db.product.findMany({
      where: {
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    getProductQuantityMap(),
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalQuantity = products.reduce(
    (sum, product) => sum + (quantities.get(product.id) ?? 0),
    0,
  );
  const totalValue = products.reduce(
    (sum, product) =>
      sum + (quantities.get(product.id) ?? 0) * product.costPriceCents,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="المخزن"
        title="مخزنك الخاص"
        description="أصنافك وكمياتك وتكلفتها، وكل حركة إدخال أو إخراج أو تسوية."
        actions={
          <Link href="/warehouse/new" className={buttonStyles()}>
            <PlusIcon className="size-4" />
            منتج جديد
          </Link>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">أصناف ظاهرة</p>
          <p className="mt-1.5 text-2xl font-extrabold text-ink">
            {products.length}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">إجمالي الكميات</p>
          <p className="mt-1.5 text-2xl font-extrabold text-ink">
            {totalQuantity}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-brand p-4 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">قيمة المخزن</p>
          <p className="mt-1.5 text-2xl font-extrabold">
            {formatMoney(totalValue)}
          </p>
          <p className="mt-1 text-[10px] text-white/60">بسعر التكلفة</p>
        </div>
      </section>

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ابحث باسم الصنف…"
          aria-label="بحث في المخزن"
        />
        <Select name="status" defaultValue={status} aria-label="حالة الصنف">
          <option value="active">الأصناف النشطة</option>
          <option value="inactive">الموقوفة</option>
          <option value="all">الكل</option>
        </Select>
        <button type="submit" className={buttonStyles({ variant: "secondary" })}>
          بحث
        </button>
      </form>

      {activeProducts.length > 0 ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>إدخال سريع للمخزن</CardTitle>
            <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-ink">
              اختار الصنف والكمية
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <ActionForm
              action={addStockMovementAction}
              submitLabel="إدخال للمخزن"
              pendingLabel="جارٍ الإدخال..."
              variant="gold"
            >
              <input type="hidden" name="type" value="IN" />
              <input type="hidden" name="redirectTo" value="/warehouse" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_120px_170px_minmax(0,1fr)]">
                <Field label="الصنف" htmlFor="quick-product">
                  <Select
                    id="quick-product"
                    name="productId"
                    required
                    defaultValue=""
                  >
                    <option value="">اختار الصنف…</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {product.unit ? ` (${product.unit})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="الكمية" htmlFor="quick-quantity">
                  <Input
                    id="quick-quantity"
                    name="quantity"
                    inputMode="numeric"
                    required
                    placeholder="1"
                  />
                </Field>
                <Field label="التاريخ" htmlFor="quick-date">
                  <Input
                    id="quick-date"
                    name="occurredOn"
                    type="date"
                    required
                    defaultValue={todayISO()}
                  />
                </Field>
                <Field label="ملاحظات" htmlFor="quick-note">
                  <Input
                    id="quick-note"
                    name="note"
                    placeholder="اختياري"
                  />
                </Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          icon={BoxIcon}
          title={q ? "مفيش نتائج للبحث" : "مخزنك فاضي"}
          description={
            q
              ? "جرّب اسم تاني، أو غيّر فلتر الحالة."
              : "أضف أول منتج، وبعدها سجّل الإدخال والإخراج والمرتجعات."
          }
          action={
            <Link href="/warehouse/new" className={buttonStyles({ size: "sm" })}>
              <PlusIcon className="size-4" />
              أضف منتج
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {products.map((product) => {
              const quantity = quantities.get(product.id) ?? 0;
              const state = productStatus(quantity, product.lowStockThreshold);
              const meta = statusMeta[state];

              return (
                <Link
                  key={product.id}
                  href={`/warehouse/${product.id}`}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {product.unit || "بدون وحدة"} · تكلفة{" "}
                        {formatMoney(product.costPriceCents)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!product.isActive ? (
                        <Badge tone="neutral">موقوف</Badge>
                      ) : null}
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted">الكمية الحالية</p>
                      <p className="mt-0.5 text-lg font-extrabold text-brand-dark">
                        {quantity}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-muted">
                      {formatMoney(quantity * product.costPriceCents)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>الصنف</TableHeaderCell>
                  <TableHeaderCell>الكمية</TableHeaderCell>
                  <TableHeaderCell>التكلفة</TableHeaderCell>
                  <TableHeaderCell>سعر البيع</TableHeaderCell>
                  <TableHeaderCell>القيمة</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell> </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((product) => {
                  const quantity = quantities.get(product.id) ?? 0;
                  const state = productStatus(
                    quantity,
                    product.lowStockThreshold,
                  );
                  const meta = statusMeta[state];

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-bold text-ink">
                        <Link
                          href={`/warehouse/${product.id}`}
                          className="hover:text-brand"
                        >
                          {product.name}
                        </Link>
                        <span className="block text-[11px] font-medium text-muted">
                          {product.unit || "بدون وحدة"}
                          {!product.isActive ? " · موقوف" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="font-extrabold text-brand-dark">
                        {quantity}
                      </TableCell>
                      <TableCell className="text-muted">
                        {formatMoney(product.costPriceCents)}
                      </TableCell>
                      <TableCell className="text-muted">
                        {product.salePriceCents === null
                          ? "—"
                          : formatMoney(product.salePriceCents)}
                      </TableCell>
                      <TableCell className="font-semibold text-ink">
                        {formatMoney(quantity * product.costPriceCents)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/warehouse/${product.id}`}
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          التفاصيل
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
