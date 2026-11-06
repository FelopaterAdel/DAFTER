import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ReportNav } from "@/components/reports/report-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeftIcon,
  BoxIcon,
  BriefcaseIcon,
  ChartIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { StatCard } from "@/components/ui/stat-card";
import { requireAuth } from "@/lib/auth/dal";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  getCollectionsReport,
  getCustodyDebtReport,
  getCustomerDebtReport,
  getWarehouseReport,
} from "@/lib/queries/reports";
import { defaultPeriod } from "@/lib/reports/periods";

export const metadata: Metadata = {
  title: "التقارير",
};

export const instant = false;

type ReportLink = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const reportLinks: ReportLink[] = [
  {
    href: "/reports/collections",
    label: "تقرير التحصيل",
    description: "كاش الفترة مقسّم بين العهد والزبائن المباشرين.",
    icon: WalletIcon,
  },
  {
    href: "/reports/custody-debts",
    label: "مديونيات العهد",
    description: "أرصدة العهد المدينة والدائنة والصافي.",
    icon: BriefcaseIcon,
  },
  {
    href: "/reports/customer-debts",
    label: "مديونيات الزبائن",
    description: "أعمار الديون بالفيفو: 0–30 و31–60 وأكثر من 60 يوم.",
    icon: UsersIcon,
  },
  {
    href: "/reports/warehouse",
    label: "تقرير المخزن",
    description: "قيمة المخزن وحركة الأصناف داخل الفترة.",
    icon: BoxIcon,
  },
];

export default async function ReportsPage() {
  await requireAuth();

  const today = todayISO();
  const period = defaultPeriod(today);

  const [collections, custodyDebts, customerDebts, warehouse] = await Promise.all(
    [
      getCollectionsReport({ ...period, groupBy: "month" }),
      getCustodyDebtReport(),
      getCustomerDebtReport({ type: "all", asOf: today }),
      getWarehouseReport(period),
    ],
  );

  return (
    <>
      <PageHeader
        eyebrow="التقارير"
        title="نظرة على أرقامك"
        description="ملخص سريع للتحصيل والمديونيات والمخزن، وكل تقرير فيه تفاصيل وفلترة."
        actions={
          <Link
            href="/reports/collections"
            className={buttonStyles({ size: "sm" })}
          >
            <WalletIcon className="size-4" />
            تقرير التحصيل
          </Link>
        }
      />

      <ReportNav active="overview" />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="تحصيل الشهر"
          value={formatMoney(collections.totals.totalCents)}
          hint={`${collections.totals.count} حركة · من ${formatDate(period.from)}`}
          icon={WalletIcon}
          tone="brand"
        />
        <StatCard
          label="مديونيات العهد"
          value={formatMoney(custodyDebts.totals.debtCents)}
          hint={`${custodyDebts.debtors.length} عهدة مدينة · صافي ${formatMoney(
            custodyDebts.totals.netCents,
          )}`}
          icon={BriefcaseIcon}
          tone="gold"
        />
        <StatCard
          label="مديونيات الزبائن"
          value={formatMoney(customerDebts.totals.debtCents)}
          hint={`${customerDebts.debtors.length} زبون · متأخر +60 يوم ${formatMoney(
            customerDebts.totals.bucket61plus,
          )}`}
          icon={UsersIcon}
          tone="danger"
        />
        <StatCard
          label="قيمة المخزن"
          value={formatMoney(warehouse.totals.costValueCents)}
          hint={`${warehouse.rows.length} صنف · ${warehouse.lowStockCount} تنبيه مخزون`}
          icon={BoxIcon}
          tone="info"
        />
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        {reportLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/30 hover:bg-brand-soft/30"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-brand-dark transition-colors group-hover:bg-brand group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">{link.label}</span>
                  <ArrowLeftIcon className="size-4 text-muted transition-transform group-hover:-translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-6 text-muted">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أكبر مديونيات العهد</CardTitle>
            <Link
              href="/reports/custody-debts"
              className="text-[11px] font-bold text-brand hover:underline"
            >
              التقرير
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {custodyDebts.debtors.length === 0 ? (
              <EmptyState
                icon={BriefcaseIcon}
                title="مفيش مديونيات عهد"
                description="كل العهد مسددة أو لسه ما اتسجلتش عليها أرصدة."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-line">
                {custodyDebts.debtors.slice(0, 5).map((custody) => (
                  <Link
                    key={custody.id}
                    href={`/custodies/${custody.id}`}
                    className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-brand-soft/30"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        {custody.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        رصيد العهدة
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                        {formatMoney(custody.balanceCents)}
                      </span>
                      <ArrowLeftIcon className="size-4 text-muted" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أكبر مديونيات الزبائن</CardTitle>
            <Link
              href="/reports/customer-debts"
              className="text-[11px] font-bold text-brand hover:underline"
            >
              التقرير
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {customerDebts.debtors.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="مفيش مديونيات زبائن"
                description="كل الزبائن مسددين أو لسه ما اتسجلش عليهم استحقاقات."
              />
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-line">
                  {customerDebts.debtors.slice(0, 5).map((customer) => (
                    <Link
                      key={customer.id}
                      href={`/customers/${customer.id}`}
                      className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-brand-soft/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">
                          {customer.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {customer.type === "custody"
                            ? customer.custodyName ?? "زبون عهدة"
                            : "زبون مباشر"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge
                          tone={
                            customer.type === "custody" ? "brand" : "gold"
                          }
                        >
                          {customer.type === "custody" ? "عهدة" : "مباشر"}
                        </Badge>
                        <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                          {formatMoney(customer.balanceCents)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "0–30 يوم", value: customerDebts.totals.bucket0to30 },
                    { label: "31–60 يوم", value: customerDebts.totals.bucket31to60 },
                    { label: "+60 يوم", value: customerDebts.totals.bucket61plus },
                  ].map((bucket) => (
                    <div
                      key={bucket.label}
                      className="rounded-xl bg-surface-muted/60 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold text-muted">
                        {bucket.label}
                      </p>
                      <p className="mt-0.5 text-xs font-extrabold text-ink">
                        {formatMoney(bucket.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-muted shadow-card">
        <ChartIcon className="size-4 shrink-0 text-brand" />
        الأرقام دي بتتحسب من نفس الحركات المسجّلة في الدفتر، من غير أي إدخال
        مكرر.
      </div>
    </>
  );
}
