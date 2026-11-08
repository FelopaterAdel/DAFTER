import type { Metadata } from "next";
import Link from "next/link";

import { CollectionForm } from "@/components/collections/collection-form";
import { ActionForm } from "@/components/forms/action-form";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WalletIcon } from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  deletePaymentAction,
  updateCustodyCollectionAction,
  updateDirectPaymentAction,
} from "@/lib/actions/payments";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, isValidISODate, todayISO } from "@/lib/dates";
import { centsToInput, formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "التحصيل",
};

export const instant = false;

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  custodyId?: string | string[];
  type?: string | string[];
  all?: string | string[];
  edit?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const today = todayISO();
  const showAll = first(params.all) === "1";
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const from = showAll ? "" : isValidISODate(rawFrom) ? rawFrom : today;
  const to = showAll ? "" : isValidISODate(rawTo) ? rawTo : today;
  const custodyFilter = first(params.custodyId);
  const type = ["custody", "direct"].includes(first(params.type))
    ? first(params.type)
    : "all";
  const editId = first(params.edit);

  const paymentWhere = {
    ...(from || to
      ? {
          occurredOn: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(type === "custody"
      ? { customerId: null }
      : type === "direct"
        ? { custodyId: null }
        : { OR: [{ customerId: null }, { custodyId: null }] }),
    ...(custodyFilter ? { custodyId: custodyFilter } : {}),
  };

  const [
    custodies,
    directCustomers,
    custodyToday,
    directToday,
    payments,
    editPayment,
  ] = await Promise.all([
    db.custody.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.customer.findMany({
      where: { custodyId: null },
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
    }),
    db.payment.aggregate({
      where: { occurredOn: today, customerId: null },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: {
        occurredOn: today,
        custodyId: null,
        customerId: { not: null },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.payment.findMany({
      where: paymentWhere,
      include: {
        custody: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    }),
    editId
      ? db.payment.findUnique({
          where: { id: editId },
          include: {
            custody: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const custodyCash = custodyToday._sum.amountCents ?? 0;
  const directCash = directToday._sum.amountCents ?? 0;
  const totalCash = custodyCash + directCash;
  const totalCount = custodyToday._count + directToday._count;

  const activeCustodies = custodies.filter((custody) => custody.isActive);

  const listParams = new URLSearchParams();
  if (showAll) {
    listParams.set("all", "1");
  } else {
    listParams.set("from", from);
    listParams.set("to", to);
  }
  if (custodyFilter) listParams.set("custodyId", custodyFilter);
  if (type !== "all") listParams.set("type", type);

  const listHref = listParams.toString()
    ? `/collections?${listParams.toString()}`
    : "/collections";

  function editHref(id: string) {
    const next = new URLSearchParams(listParams);
    next.set("edit", id);
    return `/collections?${next.toString()}`;
  }

  const isEditingCustody = editPayment && editPayment.customerId === null;
  const isEditingDirect = editPayment && editPayment.custodyId === null;

  return (
    <>
      <PageHeader
        eyebrow="التحصيل"
        title="تحصيل اليوم"
        description="سجّل اللي استلمته من كل عهدة، والدفعات المباشرة اللي وصلتك من زبائنك."
        actions={
          <Link
            href="/collections"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            النهارده
          </Link>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-brand p-4 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">كاش اليوم</p>
          <p className="mt-1.5 text-2xl font-extrabold">{formatMoney(totalCash)}</p>
          <p className="mt-1 text-[11px] text-white/60">{totalCount} حركة</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">تحصيل من العهد</p>
          <p className="mt-1.5 text-xl font-extrabold text-ink">
            {formatMoney(custodyCash)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {custodyToday._count} حركة
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">دفعات الزبائن المباشرين</p>
          <p className="mt-1.5 text-xl font-extrabold text-ink">
            {formatMoney(directCash)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {directToday._count} حركة
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">الفلترة الحالية</p>
          <p className="mt-1.5 text-sm font-extrabold text-ink">
            {showAll ? "كل الحركات" : `${formatDate(from)} → ${formatDate(to)}`}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {payments.length} حركة في السجل
          </p>
        </div>
      </section>

      {editPayment ? (
        <Card className="mb-5 border-brand/30">
          <CardHeader>
            <CardTitle>
              {isEditingCustody ? "تعديل تحصيل عهدة" : "تعديل دفعة مباشرة"}
            </CardTitle>
            <Link
              href={listHref}
              className="text-xs font-bold text-muted hover:text-ink"
            >
              إلغاء
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {isEditingCustody ? (
              <ActionForm
                action={updateCustodyCollectionAction}
                submitLabel="حفظ التعديل"
                pendingLabel="جارٍ الحفظ..."
              >
                <input type="hidden" name="id" value={editPayment.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="العهدة" htmlFor="edit-custody">
                    <Select
                      id="edit-custody"
                      name="custodyId"
                      defaultValue={editPayment.custodyId ?? ""}
                      required
                    >
                      <option value="">اختار العهدة…</option>
                      {custodies.map((custody) => (
                        <option key={custody.id} value={custody.id}>
                          {custody.name}
                          {custody.isActive ? "" : " (موقوفة)"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="المبلغ (جنيه)" htmlFor="edit-amount">
                    <Input
                      id="edit-amount"
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={centsToInput(editPayment.amountCents)}
                    />
                  </Field>
                  <Field label="التاريخ" htmlFor="edit-date">
                    <Input
                      id="edit-date"
                      name="occurredOn"
                      type="date"
                      required
                      defaultValue={editPayment.occurredOn}
                    />
                  </Field>
                  <Field label="ملاحظات" htmlFor="edit-note">
                    <Input
                      id="edit-note"
                      name="note"
                      defaultValue={editPayment.note ?? ""}
                    />
                  </Field>
                </div>
              </ActionForm>
            ) : isEditingDirect ? (
              <ActionForm
                action={updateDirectPaymentAction}
                submitLabel="حفظ التعديل"
                pendingLabel="جارٍ الحفظ..."
              >
                <input type="hidden" name="id" value={editPayment.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="الزبون" htmlFor="edit-customer">
                    <Select
                      id="edit-customer"
                      name="customerId"
                      defaultValue={editPayment.customerId ?? ""}
                      required
                    >
                      <option value="">اختار الزبون…</option>
                      {directCustomers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                          {customer.country ? ` — ${customer.country}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="المبلغ (جنيه)" htmlFor="edit-direct-amount">
                    <Input
                      id="edit-direct-amount"
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={centsToInput(editPayment.amountCents)}
                    />
                  </Field>
                  <Field label="التاريخ" htmlFor="edit-direct-date">
                    <Input
                      id="edit-direct-date"
                      name="occurredOn"
                      type="date"
                      required
                      defaultValue={editPayment.occurredOn}
                    />
                  </Field>
                  <Field label="ملاحظات" htmlFor="edit-direct-note">
                    <Input
                      id="edit-direct-note"
                      name="note"
                      defaultValue={editPayment.note ?? ""}
                    />
                  </Field>
                </div>
              </ActionForm>
            ) : (
              <p className="rounded-xl bg-danger-soft/60 px-3.5 py-3 text-sm text-danger">
                الحركة المطلوب تعديلها مش موجودة.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>تسجيل تحصيل</CardTitle>
          <Badge tone="brand">كاش</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <CollectionForm
            custodies={activeCustodies}
            customers={directCustomers}
            redirectTo={listHref}
            defaultDate={today}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>سجل التحصيلات</CardTitle>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              <Link
                href="/collections"
                className="font-bold text-brand hover:underline"
              >
                النهارده
              </Link>
              <span className="text-line">•</span>
              <Link
                href="/collections?all=1"
                className="font-bold text-brand hover:underline"
              >
                كل الحركات
              </Link>
            </div>
          </div>
          <Badge tone="neutral">{payments.length} حركة</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            method="get"
            className="mb-4 grid gap-3 rounded-xl bg-surface-muted/50 p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          >
            {showAll ? <input type="hidden" name="all" value="1" /> : null}
            <Field label="من تاريخ" htmlFor="filter-from">
              <Input
                id="filter-from"
                name="from"
                type="date"
                defaultValue={showAll ? "" : from}
              />
            </Field>
            <Field label="إلى تاريخ" htmlFor="filter-to">
              <Input
                id="filter-to"
                name="to"
                type="date"
                defaultValue={showAll ? "" : to}
              />
            </Field>
            <Field label="العهدة" htmlFor="filter-custody">
              <Select
                id="filter-custody"
                name="custodyId"
                defaultValue={custodyFilter}
              >
                <option value="">كل العهد</option>
                {custodies.map((custody) => (
                  <option key={custody.id} value={custody.id}>
                    {custody.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="النوع" htmlFor="filter-type">
              <Select id="filter-type" name="type" defaultValue={type}>
                <option value="all">الكل</option>
                <option value="custody">تحصيل عهد</option>
                <option value="direct">دفعات مباشرة</option>
              </Select>
            </Field>
            <button
              type="submit"
              className={buttonStyles({ variant: "secondary" })}
            >
              تطبيق الفلتر
            </button>
          </form>

          {payments.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="مفيش حركات في الفترة دي"
              description="غيّر الفترة أو الفلتر، أو سجّل تحصيل جديد من الفورم فوق."
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-line bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
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
                      <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                        {formatMoney(payment.amountCents)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Badge
                        tone={payment.custody ? "brand" : "gold"}
                      >
                        {payment.custody ? "تحصيل عهدة" : "دفعة مباشرة"}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Link
                          href={editHref(payment.id)}
                          className="rounded-lg px-2 py-1 text-[11px] font-bold text-brand hover:bg-brand-soft"
                        >
                          تعديل
                        </Link>
                        <form action={deletePaymentAction}>
                          <input type="hidden" name="id" value={payment.id} />
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={listHref}
                          />
                          <ConfirmSubmitButton message="حذف الحركة؟ الأرصدة هتتعدّل.">
                            حذف
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>التاريخ</TableHeaderCell>
                      <TableHeaderCell>النوع</TableHeaderCell>
                      <TableHeaderCell>الجهة</TableHeaderCell>
                      <TableHeaderCell>المبلغ</TableHeaderCell>
                      <TableHeaderCell>ملاحظات</TableHeaderCell>
                      <TableHeaderCell> </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-muted">
                          {formatDate(payment.occurredOn)}
                        </TableCell>
                        <TableCell>
                          <Badge tone={payment.custody ? "brand" : "gold"}>
                            {payment.custody ? "تحصيل عهدة" : "دفعة مباشرة"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-ink">
                          {payment.custody ? (
                            <Link
                              href={`/custodies/${payment.custody.id}?tab=statement`}
                              className="hover:text-brand"
                            >
                              {payment.custody.name}
                            </Link>
                          ) : payment.customer ? (
                            <Link
                              href={`/customers/${payment.customer.id}`}
                              className="hover:text-brand"
                            >
                              {payment.customer.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                          {formatMoney(payment.amountCents)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-muted">
                          {payment.note || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link
                              href={editHref(payment.id)}
                              className="rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand-soft"
                            >
                              تعديل
                            </Link>
                            <form action={deletePaymentAction}>
                              <input type="hidden" name="id" value={payment.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={listHref}
                              />
                              <ConfirmSubmitButton message="حذف الحركة؟ الأرصدة هتتعدّل.">
                                حذف
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
