import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { GoodsCatalog } from "@/components/goods/goods-catalog";
import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { Field, Input } from "@/components/ui/input";
import { createQuickProductAction } from "@/lib/actions/warehouse";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getProductQuantityMap } from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "البضائع",
};

export const instant = false;

type SearchParams = Promise<{
  q?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function GoodsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const q = first(params.q).trim();

  const [products, custodies, quantityMap] = await Promise.all([
    db.product.findMany({
      where: {
        isActive: true,
        ...(q ? { name: { contains: q } } : {}),
      },
      select: {
        id: true,
        name: true,
        unit: true,
        costPriceCents: true,
        salePriceCents: true,
      },
      orderBy: { name: "asc" },
    }),
    db.custody.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getProductQuantityMap(),
  ]);

  const quantities: Record<string, number> = {};
  for (const [productId, quantity] of quantityMap) {
    quantities[productId] = quantity;
  }

  const totalQuantity = products.reduce(
    (sum, product) => sum + (quantities[product.id] ?? 0),
    0,
  );
  const totalValue = products.reduce(
    (sum, product) =>
      sum + (quantities[product.id] ?? 0) * product.costPriceCents,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="البضائع"
        title="دليل البضائع"
        description="كل أسماء بضائعك بسعر كل اسم — ورّد لأي عهدة أو ادخل كمية للمخزن من نفس الصفحة."
        actions={
          <Link href="/warehouse/new" className={buttonStyles()}>
            <PlusIcon className="size-4" />
            منتج جديد
          </Link>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">عدد البضائع</p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
            {products.length}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">كميات في المخزن</p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
            {totalQuantity}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-brand p-4 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">قيمة الكميات</p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums sm:text-2xl">
            {formatMoney(totalValue)}
          </p>
          <p className="mt-1 text-[10px] text-white/60">بسعر التكلفة</p>
        </div>
      </section>

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ابحث باسم البضاعة…"
          aria-label="بحث في البضائع"
        />
        <button
          type="submit"
          className={buttonStyles({ variant: "secondary" })}
        >
          بحث
        </button>
      </form>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>بضاعة جديدة</CardTitle>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-dark">
            إضافة سريعة
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          <ActionForm
            action={createQuickProductAction}
            submitLabel="إضافة البضاعة"
            pendingLabel="جارٍ الإضافة..."
          >
            <input type="hidden" name="redirectTo" value="/goods" />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Field label="اسم البضاعة" htmlFor="quick-name">
                <Input
                  id="quick-name"
                  name="name"
                  required
                  placeholder="مثال: زيت، أرز، سكر"
                />
              </Field>
              <Field
                label="السعر (جنيه)"
                htmlFor="quick-price"
                hint="بيتسجل كسعر تكلفة وسعر بيع مع بعض."
              >
                <Input
                  id="quick-price"
                  name="price"
                  inputMode="decimal"
                  required
                  placeholder="0"
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <GoodsCatalog
        products={products}
        custodies={custodies}
        quantities={quantities}
        today={todayISO()}
        hasQuery={Boolean(q)}
      />
    </>
  );
}
