import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon, UsersIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
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
import { formatMoney } from "@/lib/money";
import { getCustomerBalanceMap } from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "الزبائن",
};

export const instant = false;

type SearchParams = Promise<{
  q?: string | string[];
  type?: string | string[];
  country?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const q = first(params.q).trim();
  const type = ["custody", "direct", "all"].includes(first(params.type))
    ? first(params.type)
    : "all";
  const country = first(params.country).trim();

  const [customers, countryRows, balances] = await Promise.all([
    db.customer.findMany({
      where: {
        ...(type === "custody" ? { custodyId: { not: null } } : {}),
        ...(type === "direct" ? { custodyId: null } : {}),
        ...(country
          ? { country: { equals: country, mode: "insensitive" } }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { phone: { contains: q } },
                { country: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        custody: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.customer.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
    getCustomerBalanceMap(),
  ]);

  const countries = countryRows
    .map((row) => row.country)
    .filter((value): value is string => Boolean(value));
  const hasFilters = Boolean(q || country || type !== "all");

  const total = customers.reduce(
    (sum, customer) => sum + (balances.get(customer.id) ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="الزبائن"
        title="زبائن العهد والزبائن المباشرين"
        description="زبون العهدة بيدفع للسيلر، والزبون المباشر بيدفع لك. كل واحد ليه رصيده المستقل."
        actions={
          <Link href="/customers/new" className={buttonStyles()}>
            <PlusIcon className="size-4" />
            زبون جديد
          </Link>
        }
      />

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:grid-cols-[minmax(0,1fr)_160px_160px_auto] sm:items-center"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ابحث بالاسم أو الهاتف…"
          aria-label="بحث في الزبائن"
        />
        <Select name="type" defaultValue={type} aria-label="نوع الزبون">
          <option value="all">كل الزبائن</option>
          <option value="custody">زبائن العهد</option>
          <option value="direct">زبائن مباشرين</option>
        </Select>
        <Select
          name="country"
          defaultValue={country}
          aria-label="فلتر البلد"
          disabled={countries.length === 0}
        >
          <option value="">كل البلدان</option>
          {countries.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonStyles({ variant: "secondary" })}>
          بحث
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          <span className="font-bold text-ink">{customers.length}</span> زبون
          ظاهر
          {hasFilters ? (
            <>
              {" "}
              ·{" "}
              <Link
                href="/customers"
                className="font-bold text-brand hover:underline"
              >
                مسح الفلاتر
              </Link>
            </>
          ) : null}
        </p>
        <p>
          إجمالي الأرصدة:{" "}
          <span className="font-bold text-ink">{formatMoney(total)}</span>
        </p>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={hasFilters ? "مفيش نتائج للبحث" : "مفيش زبائن لسه"}
          description={
            hasFilters
              ? "جرّب اسم أو رقم تاني، أو غيّر الفلاتر (النوع / البلد)."
              : "أضف زبون عهدة أو زبون مباشر، وسجّل استحقاقاته ومدفوعاته."
          }
          action={
            <Link href="/customers/new" className={buttonStyles({ size: "sm" })}>
              <PlusIcon className="size-4" />
              أضف زبون
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {customers.map((customer) => {
              const customerBalance = balances.get(customer.id) ?? 0;

              return (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink">
                        {customer.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {customer.custody
                          ? `عهدة: ${customer.custody.name}`
                          : customer.country || "زبون مباشر"}
                      </p>
                    </div>
                    <Badge tone={customer.custody ? "brand" : "gold"}>
                      {customer.custody ? "عهدة" : "مباشر"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted">الرصيد</p>
                      <p className="mt-0.5 text-lg font-extrabold text-brand-dark">
                        {formatMoney(customerBalance)}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {customer.phone || "بدون هاتف"}
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
                  <TableHeaderCell>الزبون</TableHeaderCell>
                  <TableHeaderCell>النوع</TableHeaderCell>
                  <TableHeaderCell>الهاتف / المنطقة</TableHeaderCell>
                  <TableHeaderCell>الرصيد</TableHeaderCell>
                  <TableHeaderCell> </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => {
                  const customerBalance = balances.get(customer.id) ?? 0;

                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-bold text-ink">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="hover:text-brand"
                        >
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge tone={customer.custody ? "brand" : "gold"}>
                          {customer.custody
                            ? `عهدة: ${customer.custody.name}`
                            : "مباشر"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted">
                        {customer.phone || "—"}
                        {customer.country ? ` · ${customer.country}` : ""}
                      </TableCell>
                      <TableCell className="font-extrabold text-brand-dark">
                        {formatMoney(customerBalance)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${customer.id}`}
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
