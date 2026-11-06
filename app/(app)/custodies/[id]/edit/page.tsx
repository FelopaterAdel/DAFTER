import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { updateCustodyAction } from "@/lib/actions/custodies";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { centsToInput } from "@/lib/money";

export const metadata: Metadata = {
  title: "تعديل العهدة",
};

export const instant = false;

export default async function EditCustodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();

  const { id } = await params;
  const custody = await db.custody.findUnique({ where: { id } });
  if (!custody) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href={`/custodies/${custody.id}`}>{custody.name}</BackLink>

      <PageHeader
        eyebrow="تعديل العهدة"
        title={custody.name}
        description="عدّل بيانات العهدة أو رصيدها الافتتاحي."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={updateCustodyAction}
            submitLabel="حفظ التعديلات"
            pendingLabel="جارٍ الحفظ..."
          >
            <input type="hidden" name="id" value={custody.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="اسم العهدة"
                htmlFor="name"
                hint="لازم يفضل مختلف عن باقي العهد."
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={custody.name}
                  autoFocus
                />
              </Field>

              <Field label="رقم الهاتف" htmlFor="phone" hint="اختياري">
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  defaultValue={custody.phone ?? ""}
                />
              </Field>

              <Field
                label="الرصيد الافتتاحي (جنيه)"
                htmlFor="openingBalance"
                hint="تغييره هيعدّل الرصيد الحالي."
              >
                <Input
                  id="openingBalance"
                  name="openingBalance"
                  inputMode="decimal"
                  defaultValue={centsToInput(custody.openingBalanceCents)}
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  defaultValue={custody.note ?? ""}
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
