import type { Metadata } from "next";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createCustodyAction } from "@/lib/actions/custodies";
import { requireAuth } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "عهدة جديدة",
};

export const instant = false;

export default async function NewCustodyPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/custodies">كل العهد</BackLink>

      <PageHeader
        eyebrow="عهدة جديدة"
        title="افتح عهدة لسيلر"
        description="اسم العهدة والبلد وبس، وبعدها تقدر تضيف البضاعة والزبائن."
      />

      <Card>
        <CardContent>
          <ActionForm
            action={createCustodyAction}
            submitLabel="حفظ العهدة"
            pendingLabel="جارٍ إنشاء العهدة..."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="اسم العهدة"
                htmlFor="name"
                hint="مثال: عهدة أحمد، عهدة المحل الجديد."
                className="sm:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                  placeholder="اسم السيلر أو العهدة"
                />
              </Field>

              <Field label="رقم الهاتف" htmlFor="phone" hint="اختياري">
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  placeholder="01xxxxxxxxx"
                />
              </Field>

              <Field label="البلد / المنطقة" htmlFor="country" hint="اختياري">
                <Input
                  id="country"
                  name="country"
                  placeholder="مثال: الجيزة، أسيوط، الإسكندرية"
                />
              </Field>

              <Field label="ملاحظات" htmlFor="note" className="sm:col-span-2">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="أي تفاصيل تحب تفتكرها عن العهدة"
                />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
