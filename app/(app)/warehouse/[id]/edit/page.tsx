import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { updateProductAction } from "@/lib/actions/warehouse";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { centsToInput } from "@/lib/money";

export const metadata: Metadata = {
  title: "تعديل الصنف",
};

export const instant = false;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();

  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href={`/warehouse/${product.id}`}>{product.name}</BackLink>

      <PageHeader
        eyebrow="تعديل الصنف"
        title={product.name}
        description="عدّل بيانات الصنف والأسعار وحد التنبيه."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={updateProductAction}
            submitLabel="حفظ التعديلات"
            pendingLabel="جارٍ الحفظ..."
          >
            <input type="hidden" name="id" value={product.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="اسم الصنف"
                htmlFor="name"
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={product.name}
                  autoFocus
                />
              </Field>

              <Field label="الوحدة" htmlFor="unit" hint="اختياري">
                <Input id="unit" name="unit" defaultValue={product.unit ?? ""} />
              </Field>

              <Field
                label="حد التنبيه"
                htmlFor="lowStockThreshold"
                hint="صفر = بدون تنبيه."
              >
                <Input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  inputMode="numeric"
                  defaultValue={String(product.lowStockThreshold)}
                />
              </Field>

              <Field label="سعر التكلفة (جنيه)" htmlFor="costPrice">
                <Input
                  id="costPrice"
                  name="costPrice"
                  inputMode="decimal"
                  defaultValue={centsToInput(product.costPriceCents)}
                />
              </Field>

              <Field label="سعر البيع (جنيه)" htmlFor="salePrice" hint="اختياري">
                <Input
                  id="salePrice"
                  name="salePrice"
                  inputMode="decimal"
                  defaultValue={
                    product.salePriceCents === null
                      ? ""
                      : centsToInput(product.salePriceCents)
                  }
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  defaultValue={product.note ?? ""}
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
