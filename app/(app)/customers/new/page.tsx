import type { Metadata } from "next";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createCustomerAction } from "@/lib/actions/customers";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "زبون جديد",
};

export const instant = false;

type SearchParams = Promise<{ custodyId?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuth();

  const params = await searchParams;
  const custodyId = first(params.custodyId);

  const custodies = await db.custody.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/customers">كل الزبائن</BackLink>

      <PageHeader
        eyebrow="زبون جديد"
        title="أضف زبون"
        description="اختار إذا كان تابع لعهدة، أو زبون مباشر ليه بلد ومنطقة."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={createCustomerAction}
            submitLabel="حفظ الزبون"
            pendingLabel="جارٍ الحفظ..."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="اسم الزبون"
                htmlFor="name"
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                  placeholder="اسم الزبون"
                />
              </Field>

              <Field
                label="نوع الزبون"
                htmlFor="custodyId"
                hint="سيب الاختيار على «مباشر» لو مش تابع لعهدة."
                className="sm:col-span-2"
              >
                <Select
                  id="custodyId"
                  name="custodyId"
                  defaultValue={custodyId}
                >
                  <option value="">زبون مباشر (من غير عهدة)</option>
                  {custodies.map((custody) => (
                    <option key={custody.id} value={custody.id}>
                      تابع لعهدة: {custody.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="رقم الهاتف" htmlFor="phone" hint="اختياري">
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  placeholder="01xxxxxxxxx"
                />
              </Field>

              <Field
                label="البلد / المنطقة"
                htmlFor="country"
                hint="مطلوب للزبون المباشر."
              >
                <Input
                  id="country"
                  name="country"
                  placeholder="مثال: الجيزة، أسيوط، الإسكندرية"
                />
              </Field>

              <Field
                label="المبلغ المستحق (جنيه)"
                htmlFor="initialAmount"
                hint="اختياري — هيتسجل كاستحقاق على الزبون."
              >
                <Input
                  id="initialAmount"
                  name="initialAmount"
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              <Field label="تاريخ الاستحقاق" htmlFor="occurredOn">
                <Input
                  id="occurredOn"
                  name="occurredOn"
                  type="date"
                  defaultValue={todayISO()}
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="أي تفاصيل عن الزبون أو التعامل"
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
