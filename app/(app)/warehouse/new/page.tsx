import type { Metadata } from "next";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createProductAction } from "@/lib/actions/warehouse";
import { requireAuth } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "منتج جديد",
};

export const instant = false;

export default async function NewProductPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/warehouse">المخزن</BackLink>

      <PageHeader
        eyebrow="منتج جديد"
        title="أضف صنف للمخزن"
        description="الاسم والوحدة والتكلفة، وبعدها تقدر تسجّل الحركات والكميات."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={createProductAction}
            submitLabel="حفظ الصنف"
            pendingLabel="جارٍ الحفظ..."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="اسم الصنف"
                htmlFor="name"
                hint="لازم يكون مختلف عن باقي الأصناف."
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                  placeholder="مثال: زيت عافية 1 لتر"
                />
              </Field>

              <Field label="الوحدة" htmlFor="unit" hint="اختياري">
                <Input
                  id="unit"
                  name="unit"
                  placeholder="كرتونة، كيس، قطعة"
                />
              </Field>

              <Field
                label="حد التنبيه"
                htmlFor="lowStockThreshold"
                hint="لو الكمية وصلت له، هيظهر تنبيه. سيبه صفر لتجاهل التنبيه."
              >
                <Input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  inputMode="numeric"
                  defaultValue="0"
                />
              </Field>

              <Field
                label="سعر التكلفة (جنيه)"
                htmlFor="costPrice"
                hint="بيتحسب بيه قيمة المخزن."
              >
                <Input
                  id="costPrice"
                  name="costPrice"
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              <Field label="سعر البيع (جنيه)" htmlFor="salePrice" hint="اختياري">
                <Input
                  id="salePrice"
                  name="salePrice"
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="أي تفاصيل عن الصنف"
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
