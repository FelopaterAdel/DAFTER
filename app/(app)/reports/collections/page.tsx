import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ReportNav } from "@/components/reports/report-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WalletIcon } from "@/components/ui/icons";
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
import { getCollectionsReport } from "@/lib/queries/reports";
import type { CollectionsGrouping } from "@/lib/queries/reports";
import {
  defaultPeriod,
  formatMonthLabel,
  normalizeRange,
} from "@/lib/reports/periods";

export const metadata: Metadata = {
  title: "تقرير التحصيل",
};

export const instant = false;

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  groupBy?: string | string[];
  custodyId?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function groupLabel(groupBy: CollectionsGrouping, key: string) {
  if (groupBy === "month") return `شهر ${formatMonthLabel(key)}`;
  if (groupBy === "week") return `أسبوع ${formatDate(key)}`;
  return formatDate(key);
}

const groupOptions: Array<{ value: CollectionsGrouping; label: string }> = [
  { value: "day", label: "يومي" },
  { value: "week", label: "أسبوعي (السبت)" },
  { value: "month", label: "شهري" },
];

export default async function CollectionsReportPage({
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
  const groupBy = groupOptions.some(
    (option) => option.value === first(params.groupBy),
  )
    ? (first(params.groupBy) as CollectionsGrouping)
    : "day";
  const custodyId = first(params.custodyId);

  const [report, custodies] = await Promise.all([
    getCollectionsReport({
      from: period.from,
      to: period.to,
      groupBy,
      custodyId: custodyId || undefined,
    }),
    db.custody.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  const selectedCustody = custodies.find((custody) => custody.id === custodyId);

  return (
    <>
      <PageHeader
        eyebrow="التقارير"
        title="تقرير التحصيل"
        description="كل كاش دخل في الفترة، مقسّم بين تحصيل العهد والدفعات المباشرة."
        actions={
          <Link
            href="/reports"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            كل التقارير
          </Link>
        }
      />

      <ReportNav active="collections" />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="إجمالي الكاش"
          value={formatMoney(report.totals.totalCents)}
          hint={`${report.totals.count} حركة`}
          icon={WalletIcon}
          tone="brand"
        />
        <StatCard
          label="تحصيل من العهد"
          value={formatMoney(report.totals.custodyCents)}
          hint="فلوس وصلتك من السيلرات"
          icon={WalletIcon}
          tone="gold"
        />
        <StatCard
          label="دفعات مباشرة"
          value={formatMoney(report.totals.directCents)}
          hint="فلوس وصلتك من زبائنك"
          icon={WalletIcon}
          tone="info"
        />
        <StatCard
          label="فترات في التقرير"
          value={String(report.rows.length)}
          hint={`${formatDate(period.from)} → ${formatDate(period.to)}`}
          icon={WalletIcon}
          tone="danger"
        />
      </section>

      {selectedCustody ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/50 px-3.5 py-3 text-xs text-ink">
          <Badge tone="brand">عهدة</Badge>
          <span className="font-bold">{selectedCustody.name}</span>
          <span className="text-muted">
            — الدفعات المباشرة مش بتظهر هنا لأنها مش مرتبطة بعهدة.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>حركة التحصيل</CardTitle>
          <Badge tone="neutral">{report.rows.length} فترة</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            method="get"
            className="mb-4 grid gap-3 rounded-xl bg-surface-muted/50 p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          >
            <Field label="من تاريخ" htmlFor="report-from">
              <Input
                id="report-from"
                name="from"
                type="date"
                defaultValue={period.from}
              />
            </Field>
            <Field label="إلى تاريخ" htmlFor="report-to">
              <Input
                id="report-to"
                name="to"
                type="date"
                defaultValue={period.to}
              />
            </Field>
            <Field label="التجميع" htmlFor="report-group">
              <Select id="report-group" name="groupBy" defaultValue={groupBy}>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="العهدة" htmlFor="report-custody">
              <Select
                id="report-custody"
                name="custodyId"
                defaultValue={custodyId}
              >
                <option value="">كل العهد</option>
                {custodies.map((custody) => (
                  <option key={custody.id} value={custody.id}>
                    {custody.name}
                    {custody.isActive ? "" : " (موقوفة)"}
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
              icon={WalletIcon}
              title="مفيش تحصيل في الفترة دي"
              description="غيّر الفترة أو فلتر العهدة، أو سجّل تحصيل جديد من صفحة التحصيل."
              action={
                <Link
                  href="/collections"
                  className={buttonStyles({ size: "sm" })}
                >
                  سجّل تحصيل
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>الفترة</TableHeaderCell>
                  <TableHeaderCell>الحركات</TableHeaderCell>
                  <TableHeaderCell>تحصيل عهد</TableHeaderCell>
                  <TableHeaderCell>دفعات مباشرة</TableHeaderCell>
                  <TableHeaderCell>الإجمالي</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="whitespace-nowrap font-semibold text-ink">
                      {groupLabel(groupBy, row.key)}
                    </TableCell>
                    <TableCell className="text-muted">{row.count}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatMoney(row.custodyCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatMoney(row.directCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                      {formatMoney(row.totalCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink">
                    الإجمالي
                  </TableCell>
                  <TableCell className="font-bold text-ink">
                    {report.totals.count}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold text-ink">
                    {formatMoney(report.totals.custodyCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold text-ink">
                    {formatMoney(report.totals.directCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                    {formatMoney(report.totals.totalCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
