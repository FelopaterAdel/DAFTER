"use client";

import Link from "next/link";
import { useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon, WalletIcon } from "@/components/ui/icons";
import { Field, Input, Select } from "@/components/ui/input";
import { createPaymentAction } from "@/lib/actions/payments";

type CollectionKind = "custody" | "direct";

export function CollectionForm({
  custodies,
  customers,
  redirectTo,
  defaultDate,
}: {
  custodies: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string; country: string | null }>;
  redirectTo: string;
  defaultDate: string;
}) {
  const [kind, setKind] = useState<CollectionKind>(
    custodies.length > 0 ? "custody" : "direct",
  );

  const kindHint =
    kind === "custody"
      ? "التحصيل من العهدة بيقلل رصيدها ويتحسب ضمن كاش اليوم."
      : "الدفعة من الزبون المباشر بتقلل رصيدها ويتحسب ضمن كاش اليوم.";

  return (
    <div className="space-y-4">
      <Field label="نوع التحصيل" htmlFor="collection-kind" hint={kindHint}>
        <Select
          id="collection-kind"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value === "direct" ? "direct" : "custody")
          }
        >
          <option value="custody">تحصيل من عهدة</option>
          <option value="direct">دفعة من زبون مباشر</option>
        </Select>
      </Field>

      {kind === "custody" && custodies.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="مفيش عهد نشطة"
          description="أضف عهدة الأول عشان تسجّل تحصيلها."
          action={
            <Link
              href="/custodies/new"
              className={buttonStyles({ size: "sm" })}
            >
              <PlusIcon className="size-4" />
              عهدة جديدة
            </Link>
          }
        />
      ) : kind === "direct" && customers.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="مفيش زبائن مباشرين"
          description="أضف زبون مباشر ببلد أو منطقة عشان تسجّل دفعاته."
          action={
            <Link
              href="/customers/new"
              className={buttonStyles({ size: "sm" })}
            >
              <PlusIcon className="size-4" />
              زبون جديد
            </Link>
          }
        />
      ) : (
        <ActionForm
          action={createPaymentAction}
          submitLabel={
            kind === "custody" ? "تسجيل التحصيل" : "تسجيل الدفعة"
          }
          pendingLabel="جارٍ التسجيل..."
          variant={kind === "custody" ? "primary" : "gold"}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "custody" ? (
              <Field
                label="العهدة"
                htmlFor="collection-custody"
                className="sm:col-span-2"
              >
                <Select
                  id="collection-custody"
                  name="custodyId"
                  required
                  defaultValue=""
                >
                  <option value="">اختار العهدة…</option>
                  {custodies.map((custody) => (
                    <option key={custody.id} value={custody.id}>
                      {custody.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label="الزبون"
                htmlFor="collection-customer"
                className="sm:col-span-2"
              >
                <Select
                  id="collection-customer"
                  name="customerId"
                  required
                  defaultValue=""
                >
                  <option value="">اختار الزبون…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.country ? ` — ${customer.country}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="المبلغ (جنيه)" htmlFor="collection-amount">
              <Input
                id="collection-amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder="0"
              />
            </Field>
            <Field label="التاريخ" htmlFor="collection-date">
              <Input
                id="collection-date"
                name="occurredOn"
                type="date"
                required
                defaultValue={defaultDate}
              />
            </Field>
            <Field
              label="ملاحظات"
              htmlFor="collection-note"
              className="sm:col-span-2"
            >
              <Input
                id="collection-note"
                name="note"
                placeholder="اختياري"
              />
            </Field>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
