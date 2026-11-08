import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BriefcaseIcon, PlusIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/dal";
import { formatMoney } from "@/lib/money";
import { getCustodyBalanceMap } from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "العهد",
};

export const instant = false;

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CustodiesPage({
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

  const custodies = await db.custody.findMany({
    where: {
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
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
      _count: { select: { customers: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const balances = await getCustodyBalanceMap();
  const totalDebt = custodies.reduce(
    (total, custody) => total + (balances.get(custody.id) ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="العهد"
        title="عهدك وبضاعتها"
        description="كل عهدة ليها رصيد وبضاعة وزبائن وكشف حساب مستقل."
        actions={
          <Link href="/custodies/new" className={buttonStyles()}>
            <PlusIcon className="size-4" />
            عهدة جديدة
          </Link>
        }
      />

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ابحث بالاسم أو الهاتف أو البلد…"
          aria-label="بحث في العهد"
        />
        <Select name="status" defaultValue={status} aria-label="حالة العهدة">
          <option value="active">النشطة</option>
          <option value="inactive">الموقوفة</option>
          <option value="all">الكل</option>
        </Select>
        <button type="submit" className={buttonStyles({ variant: "secondary" })}>
          بحث
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          <span className="font-bold text-ink">{custodies.length}</span> عهدة
          ظاهرة
        </p>
        <p>
          إجمالي رصيد العهد:{" "}
          <span className="font-bold text-ink">{formatMoney(totalDebt)}</span>
        </p>
      </div>

      {custodies.length === 0 ? (
        <EmptyState
          icon={BriefcaseIcon}
          title={q ? "مفيش نتائج للبحث" : "مفيش عهد لسه"}
          description={
            q
              ? "جرّب اسم أو رقم تاني، أو غيّر فلتر الحالة."
              : "ابدأ بإضافة أول عهدة، وبعدها سجّل البضاعة والزبائن والتحصيل."
          }
          action={
            <Link href="/custodies/new" className={buttonStyles({ size: "sm" })}>
              <PlusIcon className="size-4" />
              أضف عهدة
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {custodies.map((custody) => {
              const balance = balances.get(custody.id) ?? 0;

              return (
                <Link
                  key={custody.id}
                  href={`/custodies/${custody.id}`}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink">
                        {custody.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {[custody.phone, custody.country]
                          .filter(Boolean)
                          .join(" · ") || "من غير رقم هاتف"}
                      </p>
                    </div>
                    <Badge tone={custody.isActive ? "success" : "neutral"}>
                      {custody.isActive ? "نشطة" : "موقوفة"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted">الرصيد الحالي</p>
                      <p className="mt-0.5 text-lg font-extrabold text-brand-dark">
                        {formatMoney(balance)}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {custody._count.customers} زبون
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
                  <TableHeaderCell>العهدة</TableHeaderCell>
                  <TableHeaderCell>الهاتف</TableHeaderCell>
                  <TableHeaderCell>الزبائن</TableHeaderCell>
                  <TableHeaderCell>الرصيد</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell> </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {custodies.map((custody) => {
                  const balance = balances.get(custody.id) ?? 0;

                  return (
                    <TableRow key={custody.id}>
                      <TableCell className="font-bold text-ink">
                        <Link
                          href={`/custodies/${custody.id}`}
                          className="hover:text-brand"
                        >
                          {custody.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted">
                        {[custody.phone, custody.country]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted">
                        {custody._count.customers}
                      </TableCell>
                      <TableCell className="font-extrabold text-brand-dark">
                        {formatMoney(balance)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={custody.isActive ? "success" : "neutral"}>
                          {custody.isActive ? "نشطة" : "موقوفة"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/custodies/${custody.id}`}
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
