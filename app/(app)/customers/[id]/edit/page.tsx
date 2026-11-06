import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { updateCustomerAction } from "@/lib/actions/customers";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "تعديل الزبون",
};

export const instant = false;

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();

  const { id } = await params;
  const [customer, custodies] = await Promise.all([
    db.customer.findUnique({ where: { id } }),
    db.custody.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href={`/customers/${customer.id}`}>{customer.name}</BackLink>

      <PageHeader
        eyebrow="تعديل الزبون"
        title={customer.name}
        description="عدّل بيانات الزبون أو نوعه. الرصيد والحركات مش هيتأثروا."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={updateCustomerAction}
            submitLabel="حفظ التعديلات"
            pendingLabel="جارٍ الحفظ..."
          >
            <input type="hidden" name="id" value={customer.id} />

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
                  defaultValue={customer.name}
                  autoFocus
                />
              </Field>

              <Field
                label="نوع الزبون"
                htmlFor="custodyId"
                hint="تغيير النوع مش بينقل الحركات القديمة."
                className="sm:col-span-2"
              >
                <Select
                  id="custodyId"
                  name="custodyId"
                  defaultValue={customer.custodyId ?? ""}
                >
                  <option value="">زبون مباشر (من غير عهدة)</option>
                  {custodies.map((custody) => (
                    <option key={custody.id} value={custody.id}>
                      تابع لعهدة: {custody.name}
                      {custody.isActive ? "" : " (موقوفة)"}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="رقم الهاتف" htmlFor="phone" hint="اختياري">
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  defaultValue={customer.phone ?? ""}
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
                  defaultValue={customer.country ?? ""}
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  defaultValue={customer.note ?? ""}
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
