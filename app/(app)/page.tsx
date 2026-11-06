import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  AlertIcon,
  ArrowLeftIcon,
  BoxIcon,
  BriefcaseIcon,
  ChartIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { requireAuth } from "@/lib/auth/dal";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getDashboardSnapshot } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "الرئيسية",
};

export const instant = false;

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const quickLinks: QuickLink[] = [
  {
    href: "/collections",
    label: "سجّل تحصيل",
    description: "استلم من عهدة أو زبون مباشر",
    icon: WalletIcon,
  },
  {
    href: "/custodies/new",
    label: "أضف عهدة",
    description: "بضاعة وسجل جديد لسيلر",
    icon: BriefcaseIcon,
  },
  {
    href: "/customers/new",
    label: "أضف زبون",
    description: "زبون عهدة أو زبون مباشر",
    icon: UsersIcon,
  },
  {
    href: "/warehouse/new",
    label: "أضف منتج",
    description: "صنف جديد في مخزنك",
    icon: BoxIcon,
  },
  {
    href: "/reports",
    label: "التقارير",
    description: "تحصيل ومديونيات ومخزن في مكان واحد",
    icon: ChartIcon,
  },
];

export default async function DashboardPage() {
  const setting = await requireAuth();
  const snapshot = await getDashboardSnapshot();

  return (
    <>
      <PageHeader
        eyebrow="لوحة التحكم"
        title={`أهلًا، ${setting.shopName}`}
        description={`النهارده ${formatDate(
          todayISO(),
        )} — دي نظرة سريعة على فلوسك وبضاعتك.`}
        actions={
          <Link
            href="/reports"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <ChartIcon className="size-4" />
            التقارير
          </Link>
        }
      />

      <section className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-lift sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 31px, rgba(255,255,255,.22) 31px 32px)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-gold/30 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
              <WalletIcon className="size-3.5" />
              إجمالي المستحق ليك
            </span>
            <p className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {formatMoney(snapshot.totalReceivableCents)}
            </p>
            <p className="mt-3 text-sm leading-7 text-white/75">
              عهد نشطة: {formatMoney(snapshot.custodyDebtCents)} · زبائن مباشرين:{" "}
              {formatMoney(snapshot.directDebtCents)}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-white/55">
              مستحقات زبائن العهد عند السيلر (للمعلومة):{" "}
              {formatMoney(snapshot.custodyCustomersDebtCents)}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs">
            <Link
              href="/collections"
              className={buttonStyles({
                variant: "gold",
                className: "bg-white text-brand-dark hover:bg-white/90",
              })}
            >
              <PlusIcon className="size-4" />
              تحصيل
            </Link>
            <Link
              href="/custodies/new"
              className={buttonStyles({
                variant: "secondary",
                className:
                  "border-white/20 bg-white/10 text-white hover:bg-white/15",
              })}
            >
              <BriefcaseIcon className="size-4" />
              عهدة
            </Link>
            <Link
              href="/customers/new"
              className={buttonStyles({
                variant: "secondary",
                className:
                  "border-white/20 bg-white/10 text-white hover:bg-white/15",
              })}
            >
              <UsersIcon className="size-4" />
              زبون
            </Link>
            <Link
              href="/warehouse/new"
              className={buttonStyles({
                variant: "secondary",
                className:
                  "border-white/20 bg-white/10 text-white hover:bg-white/15",
              })}
            >
              <BoxIcon className="size-4" />
              منتج
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="كاش اليوم"
          value={formatMoney(snapshot.todayCashCents)}
          hint={`${snapshot.paymentsToday} حركة · عهد ${formatMoney(
            snapshot.custodyCashTodayCents,
          )} · مباشر ${formatMoney(snapshot.directCashTodayCents)}`}
          icon={WalletIcon}
          tone="brand"
        />
        <StatCard
          label="العهد النشطة"
          value={String(snapshot.activeCustodies)}
          hint={`${snapshot.customers} زبون مسجّل`}
          icon={BriefcaseIcon}
          tone="info"
        />
        <StatCard
          label="قيمة المخزن"
          value={formatMoney(snapshot.warehouseValueCents)}
          hint={`${snapshot.products} صنف نشط بسعر التكلفة`}
          icon={BoxIcon}
          tone="gold"
        />
        <StatCard
          label="زبائن مباشرين"
          value={formatMoney(snapshot.directDebtCents)}
          hint="مستحق ليك عليهم"
          icon={UsersIcon}
          tone="danger"
        />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-ink">
              أكبر أرصدة العهد
            </h2>
            <Link
              href="/custodies"
              className="text-[11px] font-bold text-brand hover:underline"
            >
              عرض الكل
            </Link>
          </div>

          {snapshot.topCustodies.length === 0 ? (
            <EmptyState
              icon={BriefcaseIcon}
              title="مفيش عهد لسه"
              description="ابدأ بإضافة أول عهدة، وبعدها سجّل البضاعة والتحصيل."
              action={
                <Link
                  href="/custodies/new"
                  className={buttonStyles({ size: "sm" })}
                >
                  <PlusIcon className="size-4" />
                  أضف عهدة
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {snapshot.topCustodies.map((custody) => (
                <Link
                  key={custody.id}
                  href={`/custodies/${custody.id}`}
                  className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5 transition-colors last:border-0 hover:bg-brand-soft/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {custody.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      رصيد العهدة
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                      {formatMoney(custody.balanceCents)}
                    </span>
                    <ArrowLeftIcon className="size-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-ink">
              آخر التحصيلات
            </h2>
            <Link
              href="/collections?all=1"
              className="text-[11px] font-bold text-brand hover:underline"
            >
              عرض الكل
            </Link>
          </div>

          {snapshot.recentPayments.length === 0 ? (
            <EmptyState
              icon={ClockIcon}
              title="مفيش تحصيلات لسه"
              description="أول ما تسجّل تحصيل من أي عهدة أو زبون مباشر، هيظهر هنا."
              action={
                <Link
                  href="/collections"
                  className={buttonStyles({ size: "sm" })}
                >
                  <PlusIcon className="size-4" />
                  سجّل تحصيل
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {snapshot.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {payment.custody
                        ? payment.custody.name
                        : payment.customer?.name || "دفعة مباشرة"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatDate(payment.occurredOn)}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={payment.custody ? "brand" : "gold"}>
                      {payment.custody ? "عهدة" : "مباشر"}
                    </Badge>
                    <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                      {formatMoney(payment.amountCents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-ink">
              تنبيهات المخزن
            </h2>
            <Link
              href="/warehouse"
              className="text-[11px] font-bold text-brand hover:underline"
            >
              المخزن
            </Link>
          </div>

          {snapshot.lowStock.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <p className="text-sm font-bold text-ink">
                كل الأصناف متوفرة
              </p>
              <p className="mt-1 text-xs leading-6 text-muted">
                مفيش أصناف نافدة أو قريبة من حد التنبيه حاليًا.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {snapshot.lowStock.map((product) => (
                <Link
                  key={product.id}
                  href={`/warehouse/${product.id}`}
                  className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5 transition-colors last:border-0 hover:bg-gold-soft/30"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
                      <AlertIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        متاح {product.quantity}
                        {product.unit ? ` ${product.unit}` : ""}
                        {product.lowStockThreshold > 0
                          ? ` · التنبيه عند ${product.lowStockThreshold}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Badge tone={product.status === "out" ? "danger" : "gold"}>
                    {product.status === "out" ? "نافد" : "قليل"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-ink">اختصارات</h2>
            <span className="text-[11px] font-medium text-muted">
              ابدأ بسرعة
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/30 hover:bg-brand-soft/30",
                    link.href === "/reports" && "sm:col-span-2",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-brand-dark transition-colors group-hover:bg-brand group-hover:text-white">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-ink">
                        {link.label}
                      </span>
                      <ArrowLeftIcon className="size-4 text-muted transition-transform group-hover:-translate-x-0.5" />
                    </span>
                    <span className="mt-1 block text-xs leading-6 text-muted">
                      {link.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
