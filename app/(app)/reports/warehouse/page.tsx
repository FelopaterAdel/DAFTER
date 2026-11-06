import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ReportNav } from "@/components/reports/report-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BoxIcon, WalletIcon } from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getWarehouseReport } from "@/lib/queries/reports";
import { defaultPeriod, normalizeRange } from "@/lib/reports/periods";

export const metadata: Metadata = {
  title: "تقرير المخزن",
};

export const instant = false;

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  productId?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const statusMeta = {
  in: { label: "متوفر", tone: "success" as const },
  low: { label: "قليل", tone: "gold" as const },
  out: { label: "نافد", tone: "danger" as const },
};

function signedQuantity(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export default async function WarehouseReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const today = todayISO();
  const period = normalizeRange(
    first(params.from),
    first(params.to),
    defaultPeriod(today),
  );
  const productId = first(params.productId);

  const [report, products] = await Promise.all([
    getWarehouseReport({
      from: period.from,
      to: period.to,
      productId: productId || undefined,
    }),
    db.product.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  const movementCount =
    report.totals.inCount +
    report.totals.outCount +
    report.totals.adjustCount;

  return (
    <>
      <PageHeader
        eyebrow="التقارير"
        title="تقرير المخزن"
        description="قيمة البضاعة الموجودة عندك، وحركة الإدخال والإخراج والتسويات في الفترة."
        actions={
          <Link
            href="/reports"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            كل التقارير
          </Link>
        }
      />

      <ReportNav active="warehouse" />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="قيمة المخزن"
          value={formatMoney(report.totals.costValueCents)}
          hint={`${report.rows.length} صنف بسعر التكلفة`}
          icon={BoxIcon}
          tone="brand"
        />
        <StatCard
          label="قيمة البيع المتوقعة"
          value={formatMoney(report.totals.saleValueCents)}
          hint="للأصناف اللي لها سعر بيع"
          icon={WalletIcon}
          tone="gold"
        />
        <StatCard
          label="إجمالي الكميات"
          value={String(report.totals.quantity)}
          hint="صافي الكميات الحالية"
          icon={BoxIcon}
          tone="info"
        />
        <StatCard
          label="حركات الفترة"
          value={String(movementCount)}
          hint={`${report.totals.inCount} داخل · ${report.totals.outCount} خارج · ${report.totals.adjustCount} تسوية`}
          icon={WalletIcon}
          tone="danger"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>أصناف المخزن</CardTitle>
          <Badge tone="neutral">{report.rows.length} صنف</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            method="get"
            className="mb-4 grid gap-3 rounded-xl bg-surface-muted/50 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            <Field label="من تاريخ" htmlFor="warehouse-report-from">
              <Input
                id="warehouse-report-from"
                name="from"
                type="date"
                defaultValue={period.from}
              />
            </Field>
            <Field label="إلى تاريخ" htmlFor="warehouse-report-to">
              <Input
                id="warehouse-report-to"
                name="to"
                type="date"
                defaultValue={period.to}
              />
            </Field>
            <Field label="الصنف" htmlFor="warehouse-report-product">
              <Select
                id="warehouse-report-product"
                name="productId"
                defaultValue={productId}
              >
                <option value="">كل الأصناف</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.isActive ? "" : " (موقوف)"}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="submit"
              className={buttonStyles({ variant: "secondary" })}
            >
              تطبيق الفلتر
            </button>
          </form>

          {report.rows.length === 0 ? (
            <EmptyState
              icon={BoxIcon}
              title="مفيش أصناف في التقرير"
              description="غيّر الفترة أو الصنف، أو أضف منتج جديد للمخزن."
              action={
                <Link
                  href="/warehouse/new"
                  className={buttonStyles({ size: "sm" })}
                >
                  منتج جديد
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>الصنف</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell>الكمية</TableHeaderCell>
                  <TableHeaderCell>التكلفة</TableHeaderCell>
                  <TableHeaderCell>البيع</TableHeaderCell>
                  <TableHeaderCell>داخل</TableHeaderCell>
                  <TableHeaderCell>خارج</TableHeaderCell>
                  <TableHeaderCell>تسوية</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.map((product) => {
                  const status = statusMeta[product.status];

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          href={`/warehouse/${product.id}`}
                          className="font-bold text-ink hover:text-brand"
                        >
                          {product.name}
                        </Link>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {product.unit || "بدون وحدة"}
                          {product.isActive ? "" : " · موقوف"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-bold text-ink">
                        {product.quantity}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {formatMoney(product.costValueCents)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {product.saleValueCents === null
                          ? "—"
                          : formatMoney(product.saleValueCents)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-success">
                        {product.inQty}
                        <span className="ms-1 text-[10px] text-muted">
                          ({product.inCount})
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-danger">
                        {product.outQty}
                        <span className="ms-1 text-[10px] text-muted">
                          ({product.outCount})
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gold">
                        {signedQuantity(product.adjustQty)}
                        <span className="ms-1 text-[10px] text-muted">
                          ({product.adjustCount})
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink" colSpan={2}>
                    الإجمالي
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-ink">
                    {report.totals.quantity}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                    {formatMoney(report.totals.costValueCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-gold">
                    {formatMoney(report.totals.saleValueCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-success">
                    {report.totals.inQty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-danger">
                    {report.totals.outQty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-gold">
                    {signedQuantity(report.totals.adjustQty)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 rounded-xl bg-surface-muted/60 px-3.5 py-3 text-xs leading-6 text-muted">
        الكمية الحالية = الداخل − الخارج + التسويات. قيمة المخزن بتتحسب بسعر
        التكلفة. الأصناف الموقوفة بتظهر فقط لو لسه عندها كمية. حركة الفترة{" "}
        {formatDate(period.from)} → {formatDate(period.to)}.
      </p>
    </>
  );
}
