import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ReportNav } from "@/components/reports/report-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersIcon, WalletIcon } from "@/components/ui/icons";
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
import { formatDate, isValidISODate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCustomerDebtReport } from "@/lib/queries/reports";
import type { CustomerDebtType } from "@/lib/queries/reports";

export const metadata: Metadata = {
  title: "مديونيات الزبائن",
};

export const instant = false;

type SearchParams = Promise<{
  type?: string | string[];
  asOf?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const typeOptions: Array<{ value: CustomerDebtType; label: string }> = [
  { value: "all", label: "كل الزبائن" },
  { value: "custody", label: "زبائن العهد" },
  { value: "direct", label: "زبائن مباشرين" },
];

export default async function CustomerDebtsReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const type = typeOptions.some((option) => option.value === first(params.type))
    ? (first(params.type) as CustomerDebtType)
    : "all";
  const asOf = isValidISODate(first(params.asOf))
    ? first(params.asOf)
    : todayISO();

  const report = await getCustomerDebtReport({ type, asOf });

  return (
    <>
      <PageHeader
        eyebrow="التقارير"
        title="مديونيات الزبائن"
        description="أرصدة الزبائن وأعمار الديون بالفيفو: أقدم استحقاق بيتسدد الأول."
        actions={
          <Link
            href="/reports"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            كل التقارير
          </Link>
        }
      />

      <ReportNav active="customer-debts" />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="إجمالي المستحق"
          value={formatMoney(report.totals.debtCents)}
          hint={`${report.debtors.length} زبون عليه رصيد`}
          icon={UsersIcon}
          tone="brand"
        />
        <StatCard
          label="0–30 يوم"
          value={formatMoney(report.totals.bucket0to30)}
          hint="ديون حديثة"
          icon={WalletIcon}
          tone="info"
        />
        <StatCard
          label="31–60 يوم"
          value={formatMoney(report.totals.bucket31to60)}
          hint="محتاجة متابعة"
          icon={WalletIcon}
          tone="gold"
        />
        <StatCard
          label="أكثر من 60 يوم"
          value={formatMoney(report.totals.bucket61plus)}
          hint="متأخرة — الأولوية للتحصيل"
          icon={WalletIcon}
          tone="danger"
        />
      </section>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>أرصدة الزبائن</CardTitle>
          <Badge tone="neutral">{report.debtors.length} زبون</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            method="get"
            className="mb-4 grid gap-3 rounded-xl bg-surface-muted/50 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            <Field label="نوع الزبون" htmlFor="customer-report-type">
              <Select
                id="customer-report-type"
                name="type"
                defaultValue={type}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="حتى تاريخ"
              htmlFor="customer-report-asof"
              hint="بيتحسب عمر الدين بالنسبة للتاريخ ده."
            >
              <Input
                id="customer-report-asof"
                name="asOf"
                type="date"
                defaultValue={asOf}
              />
            </Field>
            <button
              type="submit"
              className={buttonStyles({ variant: "secondary" })}
            >
              تطبيق الفلتر
            </button>
          </form>

          {report.debtors.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="مفيش مديونيات زبائن"
              description="كل الزبائن مسددين أو لسه ما اتسجلش عليهم استحقاقات في الفلتر الحالي."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>الزبون</TableHeaderCell>
                  <TableHeaderCell>الجهة</TableHeaderCell>
                  <TableHeaderCell>الرصيد</TableHeaderCell>
                  <TableHeaderCell>0–30</TableHeaderCell>
                  <TableHeaderCell>31–60</TableHeaderCell>
                  <TableHeaderCell>+60</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.debtors.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {customer.name}
                      </Link>
                      {customer.country ? (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {customer.country}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {customer.type === "custody" ? (
                        <Link
                          href={`/custodies/${customer.custodyId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          <Badge tone="brand">عهدة</Badge>
                          <span className="max-w-28 truncate">
                            {customer.custodyName}
                          </span>
                        </Link>
                      ) : (
                        <Badge tone="gold">مباشر</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                      {formatMoney(customer.balanceCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatMoney(customer.bucket0to30)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatMoney(customer.bucket31to60)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-bold text-danger">
                      {formatMoney(customer.bucket61plus)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink" colSpan={2}>
                    الإجمالي
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                    {formatMoney(report.totals.debtCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold text-ink">
                    {formatMoney(report.totals.bucket0to30)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold text-ink">
                    {formatMoney(report.totals.bucket31to60)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-danger">
                    {formatMoney(report.totals.bucket61plus)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أرصدة دائنة للزبائن</CardTitle>
          <Badge tone="gold">{report.credits.length}</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {report.credits.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="مفيش أرصدة دائنة"
              description="مفيش زبون دفع أكتر من استحقاقاته."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>الزبون</TableHeaderCell>
                  <TableHeaderCell>الجهة</TableHeaderCell>
                  <TableHeaderCell>المبلغ الدائن</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.credits.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {customer.type === "custody" ? (
                        <span className="text-xs font-semibold text-muted">
                          {customer.custodyName ?? "زبون عهدة"}
                        </span>
                      ) : (
                        <Badge tone="gold">مباشر</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-extrabold text-gold">
                      {formatMoney(customer.creditCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink" colSpan={2}>
                    الإجمالي
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-gold">
                    {formatMoney(report.totals.creditCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 rounded-xl bg-surface-muted/60 px-3.5 py-3 text-xs leading-6 text-muted">
        الحساب: المدفوعات بتتخصم من أقدم الاستحقاق الأول (FIFO)، والحركات
        بتتحدد حتى تاريخ {formatDate(asOf)}. الباقي غير المدفوع بيتوزّع على
        0–30 و31–60 وأكثر من 60 يوم بالنسبة لتاريخ {formatDate(asOf)}. مجموع
        الخانات بيساوي رصيد الزبون المدين، والدفعات الزيادة بتظهر كرصيد دائن
        منفصل.
      </p>
    </>
  );
}
