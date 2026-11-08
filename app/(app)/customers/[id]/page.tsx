import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit";
import { PrintButton } from "@/components/reports/print-button";
import { PrintHeader } from "@/components/reports/print-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersIcon, ChartIcon } from "@/components/ui/icons";
import { Field, Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  createChargeAction,
  deleteChargeAction,
} from "@/lib/actions/charges";
import { deleteCustomerAction } from "@/lib/actions/customers";
import {
  createPaymentAction,
  deletePaymentAction,
} from "@/lib/actions/payments";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { computeCustomerBalance } from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "كشف حساب الزبون",
};

export const instant = false;

type LedgerEntry =
  | {
      kind: "opening";
      id: string;
      date: string;
      createdAt: Date;
      amountCents: number;
      note: string | null;
    }
  | {
      kind: "charge";
      id: string;
      date: string;
      createdAt: Date;
      amountCents: number;
      note: string | null;
    }
  | {
      kind: "payment";
      id: string;
      date: string;
      createdAt: Date;
      amountCents: number;
      note: string | null;
    };

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const setting = await requireAuth();

  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      custody: { select: { id: true, name: true, isActive: true } },
      charges: { orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] },
      payments: { orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!customer) notFound();

  // Includes the opening balance so this page matches the customers list,
  // the customer-debts report and the custody balance.
  const balance = computeCustomerBalance({
    openingBalanceCents: customer.openingBalanceCents,
    charges: customer.charges,
    payments: customer.payments,
  });

  const isCustodyCustomer = customer.custody !== null;
  const redirectTo = `/customers/${customer.id}`;

  const openingEntry: LedgerEntry[] =
    customer.openingBalanceCents !== 0
      ? [
          {
            kind: "opening",
            id: "opening",
            date: todayISO(customer.createdAt),
            createdAt: customer.createdAt,
            amountCents: customer.openingBalanceCents,
            note: null,
          },
        ]
      : [];

  const entries: LedgerEntry[] = [
    ...openingEntry,
    ...customer.charges.map((charge) => ({
      kind: "charge" as const,
      id: charge.id,
      date: charge.occurredOn,
      createdAt: charge.createdAt,
      amountCents: charge.amountCents,
      note: charge.note,
    })),
    ...customer.payments.map((payment) => ({
      kind: "payment" as const,
      id: payment.id,
      date: payment.occurredOn,
      createdAt: payment.createdAt,
      amountCents: payment.amountCents,
      note: payment.note,
    })),
  ].sort((a, b) => {
    // The opening balance always leads the statement, even when a movement is
    // backdated before the customer was created.
    if (a.kind === "opening" || b.kind === "opening") {
      if (a.kind === b.kind) return 0;
      return a.kind === "opening" ? -1 : 1;
    }
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const ledger = entries.reduce<
    Array<LedgerEntry & { balance: number }>
  >((rows, entry) => {
    const previous = rows.length > 0 ? rows[rows.length - 1]!.balance : 0;
    const effect = entry.kind === "payment" ? -entry.amountCents : entry.amountCents;
    rows.push({ ...entry, balance: previous + effect });
    return rows;
  }, []);

  const totalCharges = customer.charges.reduce(
    (sum, charge) => sum + charge.amountCents,
    0,
  );
  const totalPayments = customer.payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  // Everything ever owed: opening balance + charges. Opening + charges −
  // payments is exactly the remaining balance shown below.
  const totalOnCustomer = customer.openingBalanceCents + totalCharges;

  return (
    <>
      <PrintHeader
        shopName={setting.shopName}
        title={`كشف حساب ${customer.name}`}
        period={isCustodyCustomer ? `عهدة ${customer.custody?.name}` : "زبون مباشر"}
      />

      <BackLink href="/customers">كل الزبائن</BackLink>

      <PageHeader
        eyebrow="كشف حساب زبون"
        title={customer.name}
        description={
          isCustodyCustomer
            ? `زبون تابع لعهدة ${customer.custody?.name} — بيدفع للسيلر.`
            : `زبون مباشر${customer.country ? ` — ${customer.country}` : ""} — بيدفع لك.`
        }
        actions={
          <>
            <Link
              href={`/reports/customer-debts?type=${
                isCustodyCustomer ? "custody" : "direct"
              }`}
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              <ChartIcon className="size-4" />
              تقرير
            </Link>
            <PrintButton label="طباعة الكشف" />
            <Link
              href={`/customers/${customer.id}/edit`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              تعديل
            </Link>
            <form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <ConfirmSubmitButton message="حذف الزبون؟ كل استحقاقاته ومدفوعاته هتتشال معاه، ومش هينفع ترجع.">
                حذف
              </ConfirmSubmitButton>
            </form>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <p className="text-xs font-semibold text-muted">
            المبلغ الكلي اللي على الزبون
          </p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
            {formatMoney(totalOnCustomer)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {customer.charges.length} استحقاق
            {customer.openingBalanceCents !== 0
              ? ` · افتتاحي ${formatMoney(customer.openingBalanceCents)}`
              : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <p className="text-xs font-semibold text-muted">
            المبلغ الكلي المحصل منه
          </p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums text-success sm:text-2xl">
            {formatMoney(totalPayments)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {customer.payments.length} دفعة
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-brand p-4 text-white shadow-card sm:p-5">
          <p className="text-xs font-semibold text-white/70">
            الباقي عليه لسه
          </p>
          <p className="mt-1.5 text-xl font-extrabold tabular-nums sm:text-2xl">
            {formatMoney(balance)}
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            {isCustodyCustomer
              ? "مستحق على الزبون للسيـلر"
              : balance > 0
                ? "مستحق ليك عليه"
                : balance < 0
                  ? "دفع زيادة عن المطلوب"
                  : "الحساب متساوي"}
          </p>
        </div>
      </section>

      <div className="mb-5 grid gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">النوع</span>
          {isCustodyCustomer ? (
            <Link href={`/custodies/${customer.custody?.id}?tab=customers`}>
              <Badge tone="brand">عهدة: {customer.custody?.name}</Badge>
            </Link>
          ) : (
            <Badge tone="gold">زبون مباشر</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">الهاتف</span>
          <span className="font-bold text-ink">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="hover:text-brand">
                {customer.phone}
              </a>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            البلد / المنطقة
          </span>
          <span className="font-bold text-ink">{customer.country || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">تاريخ الإضافة</span>
          <span className="font-bold text-ink">
            {formatDate(todayISO(customer.createdAt))}
          </span>
        </div>
        {customer.note ? (
          <p className="rounded-xl bg-surface-muted/70 px-3 py-2 text-xs leading-6 text-ink sm:col-span-2">
            <span className="font-bold text-gold">ملاحظة: </span>
            {customer.note}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>إضافة استحقاق</CardTitle>
            <Badge tone="gold">على الزبون</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <ActionForm
              action={createChargeAction}
              submitLabel="إضافة الاستحقاق"
              pendingLabel="جارٍ الإضافة..."
              variant="secondary"
            >
              <input type="hidden" name="scope" value="customer" />
              <input type="hidden" name="customerId" value={customer.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المبلغ (جنيه)" htmlFor="charge-amount">
                  <Input
                    id="charge-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="0"
                  />
                </Field>
                <Field label="التاريخ" htmlFor="charge-date">
                  <Input
                    id="charge-date"
                    name="occurredOn"
                    type="date"
                    required
                    defaultValue={todayISO()}
                  />
                </Field>
                <Field
                  label="البيان"
                  htmlFor="charge-note"
                  className="sm:col-span-2"
                >
                  <Input
                    id="charge-note"
                    name="note"
                    placeholder="مثال: بضاعة، فرق حساب"
                  />
                </Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isCustodyCustomer ? "دفعة للسيـلر" : "تحصيل من الزبون"}
            </CardTitle>
            <Badge tone={isCustodyCustomer ? "neutral" : "brand"}>
              {isCustodyCustomer ? "مش كاش عندك" : "كاش"}
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="mb-4 rounded-xl bg-surface-muted/70 px-3.5 py-2.5 text-xs leading-6 text-muted">
              {isCustodyCustomer
                ? "الدفعة دي بتقلل رصيد الزبون بس، لأن الفلوس راحت للسيـلر مش ليك."
                : "الدفعة دي بتقلل رصيد الزبون وتتحسب كاش النهارده عندك."}
            </p>
            <ActionForm
              action={createPaymentAction}
              submitLabel="تسجيل الدفعة"
              pendingLabel="جارٍ التسجيل..."
            >
              <input
                type="hidden"
                name="kind"
                value={isCustodyCustomer ? "customer" : "direct"}
              />
              <input type="hidden" name="customerId" value={customer.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المبلغ (جنيه)" htmlFor="payment-amount">
                  <Input
                    id="payment-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="0"
                  />
                </Field>
                <Field label="التاريخ" htmlFor="payment-date">
                  <Input
                    id="payment-date"
                    name="occurredOn"
                    type="date"
                    required
                    defaultValue={todayISO()}
                  />
                </Field>
                <Field
                  label="ملاحظات"
                  htmlFor="payment-note"
                  className="sm:col-span-2"
                >
                  <Input
                    id="payment-note"
                    name="note"
                    placeholder="اختياري"
                  />
                </Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>كشف الحساب</CardTitle>
          <Badge tone="brand">{formatMoney(balance)}</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {ledger.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-4 py-10 text-center">
              <UsersIcon className="mx-auto size-8 text-muted" />
              <p className="mt-3 text-sm font-bold text-ink">
                مفيش حركات على الزبون
              </p>
              <p className="mt-1 text-xs text-muted">
                أضف استحقاق أو دفعة من الفورم اللي فوق.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>التاريخ</TableHeaderCell>
                  <TableHeaderCell>البيان</TableHeaderCell>
                  <TableHeaderCell>استحقاق</TableHeaderCell>
                  <TableHeaderCell>مدفوع</TableHeaderCell>
                  <TableHeaderCell>الرصيد</TableHeaderCell>
                  <TableHeaderCell> </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...ledger].reverse().map((entry) => (
                  <TableRow key={`${entry.kind}-${entry.id}`}>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-ink">
                        {entry.kind === "charge"
                          ? "استحقاق"
                          : entry.kind === "payment"
                            ? "دفعة"
                            : "رصيد افتتاحي"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted">
                        {entry.kind === "opening"
                          ? "بداية الحساب"
                          : entry.note || "بدون بيان"}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-danger">
                      {entry.kind !== "payment"
                        ? formatMoney(entry.amountCents)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-success">
                      {entry.kind === "payment"
                        ? formatMoney(entry.amountCents)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-bold text-ink">
                      {formatMoney(entry.balance)}
                    </TableCell>
                    <TableCell>
                      {entry.kind === "opening" ? null : (
                        <form
                          action={
                            entry.kind === "charge"
                              ? deleteChargeAction
                              : deletePaymentAction
                          }
                        >
                          <input type="hidden" name="id" value={entry.id} />
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={redirectTo}
                          />
                          <ConfirmSubmitButton
                            message={
                              entry.kind === "charge"
                                ? "حذف الاستحقاق؟ رصيد الزبون هيتعدّل."
                                : "حذف الدفعة؟ رصيد الزبون هيتعدّل."
                            }
                          >
                            حذف
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
