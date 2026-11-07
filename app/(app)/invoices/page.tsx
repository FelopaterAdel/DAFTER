import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import { PrintHeader } from "@/components/reports/print-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon, BoxIcon } from "@/components/ui/icons";
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
import { formatDate } from "@/lib/dates";
import {
  invoiceGrossCents,
  invoiceNetCents,
  invoiceReturnedCents,
} from "@/lib/invoices";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "فواتير البيع",
};

export const instant = false;

export default async function InvoicesPage() {
  const setting = await requireAuth();

  const invoices = await db.salesInvoice.findMany({
    include: {
      customer: { select: { id: true, name: true } },
      lines: { select: { quantity: true, unitPriceCents: true } },
      returns: { select: { quantity: true, unitPriceCents: true } },
    },
    orderBy: [{ invoiceNo: "desc" }],
  });

  const rows = invoices.map((invoice) => {
    const grossCents = invoiceGrossCents(invoice.lines);
    const returnedCents = invoiceReturnedCents(invoice.returns);

    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      occurredOn: invoice.occurredOn,
      customerName: invoice.customer?.name ?? null,
      lineCount: invoice.lines.length,
      returnedCount: invoice.returns.length,
      grossCents,
      returnedCents,
      discountCents: invoice.discountCents,
      netCents: invoiceNetCents({
        lines: invoice.lines,
        returns: invoice.returns,
        discountCents: invoice.discountCents,
      }),
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      netCents: acc.netCents + row.netCents,
      returnedCents: acc.returnedCents + row.returnedCents,
      discountCents: acc.discountCents + row.discountCents,
    }),
    { netCents: 0, returnedCents: 0, discountCents: 0 },
  );

  return (
    <>
      <PrintHeader
        shopName={setting.shopName}
        title="فواتير البيع"
        period={`${rows.length} فاتورة`}
      />

      <PageHeader
        eyebrow="فواتير البيع"
        title="فواتير المخزن"
        description="فاتورة بيع بتخصم المخزون وتسجّل المستحق على الزبون، وعليها مرتجع وخصم."
        actions={
          <>
            <Link
              href="/warehouse"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              <BoxIcon className="size-4" />
              المخزن
            </Link>
            <Link href="/invoices/new" className={buttonStyles({ size: "sm" })}>
              <PlusIcon className="size-4" />
              فاتورة جديدة
            </Link>
            <PrintButton label="طباعة" />
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">عدد الفواتير</p>
          <p className="mt-1.5 text-2xl font-extrabold text-ink">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">إجمالي المرتجعات</p>
          <p className="mt-1.5 text-2xl font-extrabold text-gold">
            {formatMoney(totals.returnedCents)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand bg-brand p-4 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">
            إجمالي المتبقي (بعد الخصم)
          </p>
          <p className="mt-1.5 text-2xl font-extrabold">
            {formatMoney(totals.netCents)}
          </p>
          <p className="mt-1 text-[10px] text-white/60">
            خصومات {formatMoney(totals.discountCents)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BoxIcon}
          title="مفيش فواتير لسه"
          description="سجّل أول فاتورة بيع من المخزن، وهيخصم الكمية وتسجّل المستحق على الزبون."
          action={
            <Link href="/invoices/new" className={buttonStyles({ size: "sm" })}>
              <PlusIcon className="size-4" />
              فاتورة جديدة
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>الفاتورة</TableHeaderCell>
                    <TableHeaderCell>التاريخ</TableHeaderCell>
                    <TableHeaderCell>الزبون</TableHeaderCell>
                    <TableHeaderCell>الأصناف</TableHeaderCell>
                    <TableHeaderCell>الإجمالي</TableHeaderCell>
                    <TableHeaderCell>المرتجع</TableHeaderCell>
                    <TableHeaderCell>الخصم</TableHeaderCell>
                    <TableHeaderCell>المتبقي</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap font-bold text-ink">
                        <Link
                          href={`/invoices/${row.id}`}
                          className="hover:text-brand"
                        >
                          #{row.invoiceNo}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {formatDate(row.occurredOn)}
                      </TableCell>
                      <TableCell>
                        {row.customerName ? (
                          <Badge tone="brand">{row.customerName}</Badge>
                        ) : (
                          <Badge tone="neutral">كاش</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted">
                        {row.lineCount}
                        {row.returnedCount > 0
                          ? ` · ${row.returnedCount} مرتجع`
                          : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {formatMoney(row.grossCents)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gold">
                        {row.returnedCents > 0
                          ? `− ${formatMoney(row.returnedCents)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted">
                        {row.discountCents > 0
                          ? `− ${formatMoney(row.discountCents)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                        {formatMoney(row.netCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
