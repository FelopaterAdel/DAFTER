import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import { PrintHeader } from "@/components/reports/print-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BriefcaseIcon, PlusIcon, UsersIcon } from "@/components/ui/icons";
import { Field, Input } from "@/components/ui/input";
import { setOpeningBalanceAction } from "@/lib/actions/opening-balances";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { centsToInput, formatMoney } from "@/lib/money";
import {
  getCustodyBalanceMap,
  getCustomerBalanceMap,
} from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "أرصدة افتتاحية",
};

export const instant = false;

export default async function OpeningBalancesPage() {
  const setting = await requireAuth();

  const [custodies, customers, custodyBalances, customerBalances] =
    await Promise.all([
      db.custody.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          openingBalanceCents: true,
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      db.customer.findMany({
        select: {
          id: true,
          name: true,
          custodyId: true,
          custody: { select: { name: true } },
          openingBalanceCents: true,
        },
        orderBy: { name: "asc" },
      }),
      getCustodyBalanceMap(),
      getCustomerBalanceMap(),
    ]);

  return (
    <>
      <PrintHeader
        shopName={setting.shopName}
        title="الأرصدة الافتتاحية"
        period={`${custodies.length} عهدة · ${customers.length} زبون`}
      />

      <PageHeader
        eyebrow="أرصدة افتتاحية"
        title="أرصدة البداية"
        description="سجّل أرصدة العهد والزبائن زي ما في الدفتر الورقي — الرصيد الافتتاحي بيتحسب في كل رصيد وتقرير."
        actions={
          <>
            <Link
              href="/custodies/new"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <PlusIcon className="size-4" />
              عهدة جديدة
            </Link>
            <Link
              href="/customers/new"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <PlusIcon className="size-4" />
              زبون جديد
            </Link>
            <PrintButton label="طباعة" />
          </>
        }
      />

      <div className="mb-5 rounded-2xl border border-gold/25 bg-gold-soft/50 px-4 py-3 text-sm leading-7 text-ink">
        <span className="font-bold text-gold">إزاي تستخدمها: </span>
        افتح الدفتر الورقي، واكتب الرصيد الافتتاحي لكل عهدة وزبون. الرصيد الحالي
        اللي جنبه هو الحساب المحسوب دلوقتي — غيّر الافتتاحي بس لو فاتك سجل من
        أول الطريق.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أرصدة العهد</CardTitle>
            <Badge tone="brand">{custodies.length} عهدة</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {custodies.length === 0 ? (
              <EmptyState
                icon={BriefcaseIcon}
                title="مفيش عهد لسه"
                description="أضف أول عهدة، وبعدها تقدر تكتب رصيدها الافتتاحي من هنا."
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="px-2 py-2 text-start font-semibold">
                        العهدة
                      </th>
                      <th className="px-2 py-2 text-start font-semibold">
                        الرصيد الحالي
                      </th>
                      <th className="px-2 py-2 text-start font-semibold print:hidden">
                        الافتتاحي
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {custodies.map((custody) => (
                      <tr
                        key={custody.id}
                        className="border-b border-line/60 last:border-0"
                      >
                        <td className="px-2 py-3">
                          <Link
                            href={`/custodies/${custody.id}`}
                            className="font-bold text-ink hover:text-brand"
                          >
                            {custody.name}
                          </Link>
                          {!custody.isActive ? (
                            <span className="ms-2 text-[11px] text-muted">
                              (موقوفة)
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-extrabold text-brand-dark">
                          {formatMoney(custodyBalances.get(custody.id) ?? 0)}
                        </td>
                        <td className="px-2 py-3 print:hidden">
                          <ActionForm
                            action={setOpeningBalanceAction}
                            submitLabel="حفظ"
                            pendingLabel="..."
                            variant="secondary"
                            size="sm"
                            footerClassName="mt-2"
                            submitClassName="w-full sm:w-auto"
                          >
                            <input
                              type="hidden"
                              name="scope"
                              value="custody"
                            />
                            <input type="hidden" name="id" value={custody.id} />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value="/opening-balances"
                            />
                            <Field
                              label="الرصيد الافتتاحي (جنيه)"
                              htmlFor={`opening-${custody.id}`}
                            >
                              <Input
                                id={`opening-${custody.id}`}
                                name="openingBalance"
                                inputMode="decimal"
                                required
                                defaultValue={centsToInput(
                                  custody.openingBalanceCents,
                                )}
                                placeholder="0"
                              />
                            </Field>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أرصدة الزبائن</CardTitle>
            <Badge tone="gold">{customers.length} زبون</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {customers.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="مفيش زبائن لسه"
                description="أضف زبائن العهد والزبائن المباشرين، واكتب أرصدتهم الافتتاحية."
                action={
                  <Link
                    href="/customers/new"
                    className={buttonStyles({ size: "sm" })}
                  >
                    <PlusIcon className="size-4" />
                    أضف زبون
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="px-2 py-2 text-start font-semibold">
                        الزبون
                      </th>
                      <th className="px-2 py-2 text-start font-semibold">
                        الرصيد الحالي
                      </th>
                      <th className="px-2 py-2 text-start font-semibold print:hidden">
                        الافتتاحي
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-line/60 last:border-0"
                      >
                        <td className="px-2 py-3">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-bold text-ink hover:text-brand"
                          >
                            {customer.name}
                          </Link>
                          <span className="block text-[11px] text-muted">
                            {customer.custody
                              ? `عهدة: ${customer.custody.name}`
                              : "زبون مباشر"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-extrabold text-brand-dark">
                          {formatMoney(customerBalances.get(customer.id) ?? 0)}
                        </td>
                        <td className="px-2 py-3 print:hidden">
                          <ActionForm
                            action={setOpeningBalanceAction}
                            submitLabel="حفظ"
                            pendingLabel="..."
                            variant="secondary"
                            size="sm"
                            footerClassName="mt-2"
                            submitClassName="w-full sm:w-auto"
                          >
                            <input
                              type="hidden"
                              name="scope"
                              value="customer"
                            />
                            <input
                              type="hidden"
                              name="id"
                              value={customer.id}
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value="/opening-balances"
                            />
                            <Field
                              label="الرصيد الافتتاحي (جنيه)"
                              htmlFor={`opening-${customer.id}`}
                            >
                              <Input
                                id={`opening-${customer.id}`}
                                name="openingBalance"
                                inputMode="decimal"
                                required
                                defaultValue={centsToInput(
                                  customer.openingBalanceCents,
                                )}
                                placeholder="0"
                              />
                            </Field>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
