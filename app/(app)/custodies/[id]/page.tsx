import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BriefcaseIcon,
  ChartIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  addCustodyDeliveryAction,
  addCustodyReturnAction,
  deleteCustodyItemAction,
  toggleCustodyStatusAction,
} from "@/lib/actions/custodies";
import {
  createChargeAction,
  deleteChargeAction,
} from "@/lib/actions/charges";
import {
  createPaymentAction,
  deletePaymentAction,
} from "@/lib/actions/payments";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  computeCustodyBalance,
  computeStockGroups,
  getCustomerBalanceMap,
} from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "تفاصيل العهدة",
};

export const instant = false;

type SearchParams = Promise<{ tab?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

type LedgerRow = {
  id: string;
  kind: "opening" | "delivery" | "return" | "charge" | "payment";
  date: string;
  title: string;
  detail: string;
  effect: number;
  balance: number;
};

export default async function CustodyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireAuth();

  const { id } = await params;
  const query = await searchParams;
  const tab = ["stock", "customers", "statement"].includes(first(query.tab))
    ? first(query.tab)
    : "stock";

  const custody = await db.custody.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
      customers: {
        orderBy: { name: "asc" },
      },
      charges: {
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
      payments: {
        include: { customer: { select: { id: true, name: true } } },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!custody) notFound();

  const [products, customerBalances] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    getCustomerBalanceMap(),
  ]);

  const balance = computeCustodyBalance({
    openingBalanceCents: custody.openingBalanceCents,
    items: custody.items,
    charges: custody.charges,
    payments: custody.payments,
  });

  const stockGroups = computeStockGroups(custody.items);
  const returnableGroups = stockGroups.filter((group) => group.netQty > 0);

  const ledger: LedgerRow[] = [];
  let running = 0;

  if (custody.openingBalanceCents !== 0) {
    running += custody.openingBalanceCents;
    ledger.push({
      id: "opening",
      kind: "opening",
      date: todayISO(custody.createdAt),
      title: "الرصيد الافتتاحي",
      detail: "رصيد بداية العهدة",
      effect: custody.openingBalanceCents,
      balance: running,
    });
  } else {
    ledger.push({
      id: "opening",
      kind: "opening",
      date: todayISO(custody.createdAt),
      title: "الرصيد الافتتاحي",
      detail: "بداية العهدة",
      effect: 0,
      balance: 0,
    });
  }

  for (const item of custody.items) {
    const value = item.quantity * item.unitPriceCents;
    const effect = item.type === "DELIVERY" ? value : -value;
    running += effect;

    ledger.push({
      id: `item-${item.id}`,
      kind: item.type === "DELIVERY" ? "delivery" : "return",
      date: item.occurredOn,
      title: item.name,
      detail:
        item.type === "DELIVERY"
          ? `توريد ${item.quantity}${item.unit ? ` ${item.unit}` : ""} × ${formatMoney(
              item.unitPriceCents,
            )}`
          : `مرتجع ${item.quantity}${item.unit ? ` ${item.unit}` : ""} × ${formatMoney(
              item.unitPriceCents,
            )}${item.product ? ` → مخزن: ${item.product.name}` : ""}`,
      effect,
      balance: running,
    });
  }

  for (const charge of custody.charges) {
    if (charge.customerId !== null) continue;
    running += charge.amountCents;

    ledger.push({
      id: `charge-${charge.id}`,
      kind: "charge",
      date: charge.occurredOn,
      title: charge.note || "استحقاق على العهدة",
      detail: "مبلغ مستحق على العهدة",
      effect: charge.amountCents,
      balance: running,
    });
  }

  for (const payment of custody.payments) {
    if (payment.customerId !== null) continue;
    running -= payment.amountCents;

    ledger.push({
      id: `payment-${payment.id}`,
      kind: "payment",
      date: payment.occurredOn,
      title: payment.note || "تحصيل من العهدة",
      detail: "تحصيل نقدي من العهدة",
      effect: -payment.amountCents,
      balance: running,
    });
  }

  const statementRows = [...ledger].reverse();

  const tabs = [
    {
      href: `/custodies/${id}?tab=stock`,
      label: "البضاعة",
      active: tab === "stock",
      count: custody.items.length,
    },
    {
      href: `/custodies/${id}?tab=customers`,
      label: "الزبائن",
      active: tab === "customers",
      count: custody.customers.length,
    },
    {
      href: `/custodies/${id}?tab=statement`,
      label: "كشف الحساب",
      active: tab === "statement",
    },
  ];

  return (
    <>
      <BackLink href="/custodies">كل العهد</BackLink>

      <PageHeader
        eyebrow="تفاصيل العهدة"
        title={custody.name}
        description={
          custody.phone
            ? `هاتف: ${custody.phone}`
            : "عهدة بدون رقم هاتف مسجّل."
        }
        actions={
          <>
            <Link
              href={`/custodies/${id}?tab=statement#collect`}
              className={buttonStyles({ size: "sm" })}
            >
              <WalletIcon className="size-4" />
              تحصيل
            </Link>
            <Link
              href={`/custodies/${id}?tab=stock#return`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              مرتجع
            </Link>
            <Link
              href={`/reports/collections?custodyId=${custody.id}`}
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              <ChartIcon className="size-4" />
              تقرير
            </Link>
            <Link
              href={`/custodies/${id}/edit`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              تعديل
            </Link>
            <form action={toggleCustodyStatusAction}>
              <input type="hidden" name="id" value={custody.id} />
              <ConfirmSubmitButton
                variant={custody.isActive ? "ghost" : "secondary"}
                message={
                  custody.isActive
                    ? "إيقاف العهدة؟ هتفضل بياناتها محفوظة وتقدر ترجّعها في أي وقت."
                    : "إعادة تنشيط العهدة؟"
                }
              >
                {custody.isActive ? "إيقاف" : "تنشيط"}
              </ConfirmSubmitButton>
            </form>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-brand p-5 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">رصيد العهدة</p>
          <p className="mt-1.5 text-2xl font-extrabold">
            {formatMoney(balance)}
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            {balance > 0
              ? "مستحق عليك للعهدة"
              : balance < 0
                ? "العهدة ليها رصيد ليك"
                : "الرصيد متساوي"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-xs font-semibold text-muted">حالة العهدة</p>
          <div className="mt-2">
            <Badge tone={custody.isActive ? "success" : "neutral"}>
              {custody.isActive ? "نشطة" : "موقوفة"}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            بدأت في {formatDate(todayISO(custody.createdAt))}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-xs font-semibold text-muted">البضاعة والزبائن</p>
          <p className="mt-1.5 text-2xl font-extrabold text-ink">
            {stockGroups.length} صنف
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {custody.customers.length} زبون تابع للعهدة
          </p>
        </div>
      </section>

      {custody.note ? (
        <div className="mb-5 rounded-2xl border border-gold/25 bg-gold-soft/50 px-4 py-3 text-sm leading-7 text-ink">
          <span className="font-bold text-gold">ملاحظة: </span>
          {custody.note}
        </div>
      ) : null}

      <Tabs items={tabs} ariaLabel="أقسام العهدة" />

      {tab === "stock" ? (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>ملخص البضاعة</CardTitle>
              <Badge tone="brand">{stockGroups.length} صنف</Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {stockGroups.length === 0 ? (
                <EmptyState
                  icon={BriefcaseIcon}
                  title="مفيش بضاعة مسجّلة"
                  description="سجّل أول توريد من الفورم اللي تحت، وهيظهر هنا بالكمية والقيمة."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs text-muted">
                        <th className="px-2 py-2 text-start font-semibold">
                          الصنف
                        </th>
                        <th className="px-2 py-2 text-start font-semibold">
                          الوارد
                        </th>
                        <th className="px-2 py-2 text-start font-semibold">
                          المرتجع
                        </th>
                        <th className="px-2 py-2 text-start font-semibold">
                          الصافي
                        </th>
                        <th className="px-2 py-2 text-start font-semibold">
                          القيمة
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockGroups.map((group) => (
                        <tr
                          key={group.key}
                          className="border-b border-line/60 last:border-0"
                        >
                          <td className="px-2 py-3">
                            <p className="font-bold text-ink">{group.name}</p>
                            <p className="text-[11px] text-muted">
                              {group.unit || "بدون وحدة"} · متوسط{" "}
                              {formatMoney(group.averageUnitPriceCents)}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-muted">
                            {group.deliveredQty}
                          </td>
                          <td className="px-2 py-3 text-muted">
                            {group.returnedQty}
                          </td>
                          <td className="px-2 py-3 font-bold text-ink">
                            {group.netQty}
                          </td>
                          <td className="px-2 py-3 font-bold text-brand-dark">
                            {formatMoney(group.netValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card id="delivery">
              <CardHeader>
                <CardTitle>توريد بضاعة للعهدة</CardTitle>
                <Badge tone="info">وارد</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <ActionForm
                  action={addCustodyDeliveryAction}
                  submitLabel="إضافة التوريد"
                  pendingLabel="جارٍ الإضافة..."
                >
                  <input type="hidden" name="custodyId" value={custody.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="اسم الصنف"
                      htmlFor="delivery-name"
                      className="sm:col-span-2"
                    >
                      <Input
                        id="delivery-name"
                        name="name"
                        required
                        placeholder="مثال: زيت، أرز، سكر"
                      />
                    </Field>
                    <Field label="الوحدة" htmlFor="delivery-unit" hint="اختياري">
                      <Input
                        id="delivery-unit"
                        name="unit"
                        placeholder="كرتونة، كيس، قطعة"
                      />
                    </Field>
                    <Field label="الكمية" htmlFor="delivery-quantity">
                      <Input
                        id="delivery-quantity"
                        name="quantity"
                        inputMode="numeric"
                        required
                        placeholder="1"
                      />
                    </Field>
                    <Field label="سعر الوحدة (جنيه)" htmlFor="delivery-price">
                      <Input
                        id="delivery-price"
                        name="unitPrice"
                        inputMode="decimal"
                        required
                        placeholder="0"
                      />
                    </Field>
                    <Field label="التاريخ" htmlFor="delivery-date">
                      <Input
                        id="delivery-date"
                        name="occurredOn"
                        type="date"
                        required
                        defaultValue={todayISO()}
                      />
                    </Field>
                    <Field
                      label="ملاحظات"
                      htmlFor="delivery-note"
                      className="sm:col-span-2"
                    >
                      <Input id="delivery-note" name="note" placeholder="اختياري" />
                    </Field>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>

            <Card id="return">
              <CardHeader>
                <CardTitle>مرتجع من العهدة</CardTitle>
                <Badge tone="gold">يضاف للمخزن</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                {returnableGroups.length === 0 ? (
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="مفيش بضاعة ترجع"
                    description="لازم يكون فيه بضاعة صافية في العهدة الأول."
                  />
                ) : products.length === 0 ? (
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="مخزنك فاضي"
                    description="أضف منتج في المخزن الأول عشان المرتجع يتحوّل عليه."
                    action={
                      <Link
                        href="/warehouse/new"
                        className={buttonStyles({ size: "sm" })}
                      >
                        <PlusIcon className="size-4" />
                        منتج جديد
                      </Link>
                    }
                  />
                ) : (
                  <ActionForm
                    action={addCustodyReturnAction}
                    submitLabel="تسجيل المرتجع"
                    pendingLabel="جارٍ التسجيل..."
                    variant="gold"
                  >
                    <input type="hidden" name="custodyId" value={custody.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="الصنف الراجع"
                        htmlFor="return-stock"
                        className="sm:col-span-2"
                      >
                        <Select id="return-stock" name="stockKey" required>
                          <option value="">اختار الصنف…</option>
                          {returnableGroups.map((group) => (
                            <option key={group.key} value={group.key}>
                              {group.name} — متاح {group.netQty}
                              {group.unit ? ` ${group.unit}` : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="منتج المخزن المستلم"
                        htmlFor="return-product"
                        hint="المرتجع هيتسجل كإدخال للمنتج ده."
                        className="sm:col-span-2"
                      >
                        <Select id="return-product" name="productId" required>
                          <option value="">اختار منتج المخزن…</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.unit ? ` (${product.unit})` : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="الكمية" htmlFor="return-quantity">
                        <Input
                          id="return-quantity"
                          name="quantity"
                          inputMode="numeric"
                          required
                          placeholder="1"
                        />
                      </Field>
                      <Field
                        label="سعر الوحدة (جنيه)"
                        htmlFor="return-price"
                        hint="هيتخصم من رصيد العهدة."
                      >
                        <Input
                          id="return-price"
                          name="unitPrice"
                          inputMode="decimal"
                          required
                          placeholder="0"
                        />
                      </Field>
                      <Field label="التاريخ" htmlFor="return-date">
                        <Input
                          id="return-date"
                          name="occurredOn"
                          type="date"
                          required
                          defaultValue={todayISO()}
                        />
                      </Field>
                      <Field
                        label="ملاحظات"
                        htmlFor="return-note"
                        className="sm:col-span-2"
                      >
                        <Input id="return-note" name="note" placeholder="اختياري" />
                      </Field>
                    </div>
                  </ActionForm>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>حركة البضاعة</CardTitle>
              <Badge tone="neutral">{custody.items.length} حركة</Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {custody.items.length === 0 ? (
                <p className="rounded-xl bg-surface-muted/60 px-3.5 py-3 text-xs leading-6 text-muted">
                  لسه مفيش توريد أو مرتجع مسجّل على العهدة.
                </p>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>التاريخ</TableHeaderCell>
                      <TableHeaderCell>النوع</TableHeaderCell>
                      <TableHeaderCell>الصنف</TableHeaderCell>
                      <TableHeaderCell>الكمية</TableHeaderCell>
                      <TableHeaderCell>سعر الوحدة</TableHeaderCell>
                      <TableHeaderCell>القيمة</TableHeaderCell>
                      <TableHeaderCell> </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...custody.items].reverse().map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap text-muted">
                          {formatDate(item.occurredOn)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            tone={item.type === "DELIVERY" ? "info" : "gold"}
                          >
                            {item.type === "DELIVERY" ? "توريد" : "مرتجع"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-ink">
                          {item.name}
                          {item.unit ? (
                            <span className="text-[11px] text-muted">
                              {" "}
                              · {item.unit}
                            </span>
                          ) : null}
                          {item.product ? (
                            <span className="block text-[10px] text-muted">
                              مخزن: {item.product.name}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted">{item.quantity}</TableCell>
                        <TableCell className="text-muted">
                          {formatMoney(item.unitPriceCents)}
                        </TableCell>
                        <TableCell className="font-bold text-ink">
                          {formatMoney(item.quantity * item.unitPriceCents)}
                        </TableCell>
                        <TableCell>
                          <form action={deleteCustodyItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <ConfirmSubmitButton
                              message={
                                item.type === "RETURN"
                                  ? "حذف المرتجع؟ هيتشال من العهدة ومن المخزن كمان."
                                  : "حذف التوريد؟ رصيد العهدة هيتعدّل."
                              }
                            >
                              حذف
                            </ConfirmSubmitButton>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "customers" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>زبائن العهدة</CardTitle>
              <p className="mt-1 text-xs leading-5 text-muted">
                الزبون بيدفع للسيلر، والرصيد هنا للمتابعة فقط.
              </p>
            </div>
            <Link
              href={`/customers/new?custodyId=${custody.id}`}
              className={buttonStyles({ size: "sm" })}
            >
              <PlusIcon className="size-4" />
              زبون
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {custody.customers.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="مفيش زبائن على العهدة"
                description="أضف زبائن العهدة عشان تسجل استحقاقاتهم ومدفوعاتهم."
                action={
                  <Link
                    href={`/customers/new?custodyId=${custody.id}`}
                    className={buttonStyles({ size: "sm" })}
                  >
                    <PlusIcon className="size-4" />
                    أضف زبون
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {custody.customers.map((customer) => {
                  const customerBalance = customerBalances.get(customer.id) ?? 0;

                  return (
                    <Link
                      key={customer.id}
                      href={`/customers/${customer.id}`}
                      className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand/30 hover:bg-brand-soft/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">
                            {customer.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {customer.phone || "بدون هاتف"}
                            {customer.country ? ` · ${customer.country}` : ""}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-sm font-extrabold text-brand-dark">
                          {formatMoney(customerBalance)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "statement" ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card id="collect">
              <CardHeader>
                <CardTitle>تحصيل من العهدة</CardTitle>
                <Badge tone="brand">كاش</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <ActionForm
                  action={createPaymentAction}
                  submitLabel="تسجيل التحصيل"
                  pendingLabel="جارٍ التسجيل..."
                >
                  <input type="hidden" name="kind" value="custody" />
                  <input type="hidden" name="custodyId" value={custody.id} />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/custodies/${custody.id}?tab=statement`}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="المبلغ (جنيه)" htmlFor="collect-amount">
                      <Input
                        id="collect-amount"
                        name="amount"
                        inputMode="decimal"
                        required
                        placeholder="0"
                      />
                    </Field>
                    <Field label="التاريخ" htmlFor="collect-date">
                      <Input
                        id="collect-date"
                        name="occurredOn"
                        type="date"
                        required
                        defaultValue={todayISO()}
                      />
                    </Field>
                    <Field
                      label="ملاحظات"
                      htmlFor="collect-note"
                      className="sm:col-span-2"
                    >
                      <Input
                        id="collect-note"
                        name="note"
                        placeholder="اختياري"
                      />
                    </Field>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>استحقاق على العهدة</CardTitle>
                <Badge tone="gold">يدوي</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <ActionForm
                  action={createChargeAction}
                  submitLabel="إضافة الاستحقاق"
                  pendingLabel="جارٍ الإضافة..."
                  variant="secondary"
                >
                  <input type="hidden" name="scope" value="custody" />
                  <input type="hidden" name="custodyId" value={custody.id} />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/custodies/${custody.id}?tab=statement`}
                  />
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
                        placeholder="مثال: فرق أسعار، تكلفة شحن"
                      />
                    </Field>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>كشف حساب العهدة</CardTitle>
              <Badge tone="brand">{formatMoney(balance)}</Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>التاريخ</TableHeaderCell>
                    <TableHeaderCell>البيان</TableHeaderCell>
                    <TableHeaderCell>مدين</TableHeaderCell>
                    <TableHeaderCell>دائن</TableHeaderCell>
                    <TableHeaderCell>الرصيد</TableHeaderCell>
                    <TableHeaderCell> </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statementRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted">
                        {formatDate(row.date)}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-ink">{row.title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted">
                          {row.detail}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-danger">
                        {row.effect > 0 ? formatMoney(row.effect) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-success">
                        {row.effect < 0 ? formatMoney(-row.effect) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-bold text-ink">
                        {formatMoney(row.balance)}
                      </TableCell>
                      <TableCell>
                        {row.kind === "delivery" || row.kind === "return" ? (
                          <form action={deleteCustodyItemAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={row.id.replace(/^item-/, "")}
                            />
                            <ConfirmSubmitButton
                              message={
                                row.kind === "return"
                                  ? "حذف المرتجع؟ هيتشال من العهدة ومن المخزن كمان."
                                  : "حذف التوريد؟ رصيد العهدة هيتعدّل."
                              }
                            >
                              حذف
                            </ConfirmSubmitButton>
                          </form>
                        ) : row.kind === "charge" ? (
                          <form action={deleteChargeAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={row.id.replace(/^charge-/, "")}
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={`/custodies/${custody.id}?tab=statement`}
                            />
                            <ConfirmSubmitButton message="حذف الاستحقاق؟ رصيد العهدة هيتعدّل.">
                              حذف
                            </ConfirmSubmitButton>
                          </form>
                        ) : row.kind === "payment" ? (
                          <form action={deletePaymentAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={row.id.replace(/^payment-/, "")}
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={`/custodies/${custody.id}?tab=statement`}
                            />
                            <ConfirmSubmitButton message="حذف التحصيل؟ رصيد العهدة هيزيد تاني.">
                              حذف
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
