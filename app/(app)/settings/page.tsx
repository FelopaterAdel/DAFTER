import type { Metadata } from "next";

import type { ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { RestoreForm } from "@/components/settings/restore-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DatabaseIcon,
  LockIcon,
  LogoutIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { Field, Input } from "@/components/ui/input";
import { changePinAction, logoutAction } from "@/lib/actions/auth";
import { requireAuth } from "@/lib/auth/dal";
import { formatDate, todayISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "الإعدادات",
};

// Settings reads the session and the database on every request.
export const instant = false;

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/70 py-3 last:border-0 last:pb-0 first:pt-0">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center gap-2 text-sm font-bold text-ink">
        {value}
        {badge}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  const setting = await requireAuth();

  return (
    <>
      <PageHeader
        eyebrow="الإعدادات"
        title="إعدادات دفترك"
        description="بيانات النشاط، الأمان، والنسخ الاحتياطي."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>بيانات النشاط</CardTitle>
            <Badge tone="success">مفعّل</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <InfoRow label="اسم المحل" value={setting.shopName} />
            <InfoRow label="العملة" value="EGP — الجنيه المصري" />
            <InfoRow
              label="الرمز السري"
              value="••••"
              badge={<LockIcon className="size-3.5 text-muted" />}
            />
            <InfoRow
              label="آخر تغيير للرمز"
              value={
                setting.pinChangedAt
                  ? formatDate(todayISO(setting.pinChangedAt))
                  : "لسه ما اتغيرش"
              }
            />
            <InfoRow
              label="بداية الدفتر"
              value={formatDate(todayISO(setting.createdAt))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الأمان</CardTitle>
            <Badge tone="brand">
              <ShieldIcon className="me-1 size-3.5" />
              محمي
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-sm leading-7 text-muted">
            <div className="space-y-2">
              <p>
                الدخول محمي برمز سري من 4 أرقام، والجلسة بتفضل شغالة لمدة 30 يوم
                على نفس الجهاز.
              </p>
              <p>
                بعد 5 محاولات خاطئة، الدخول بيتقفل مؤقتًا لمدة 5 دقائق.
              </p>
              <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-xs leading-6 text-ink">
                لما تغيّر الرمز، الأجهزة التانية هتخرج من الحساب وتحتاج تدخل
                بالرمز الجديد.
              </p>
            </div>

            <div className="border-t border-line/70 pt-4">
              <p className="mb-3 text-sm font-bold text-ink">
                تغيير الرمز السري
              </p>

              <ActionForm
                action={changePinAction}
                submitLabel="حفظ الرمز الجديد"
                pendingLabel="جارٍ الحفظ..."
                submitClassName="w-full sm:w-auto"
              >
                <div className="grid gap-3">
                  <Field
                    label="الرمز الحالي"
                    htmlFor="currentPin"
                    hint="4 أرقام"
                  >
                    <Input
                      id="currentPin"
                      name="currentPin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      maxLength={4}
                      dir="ltr"
                      required
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="الرمز الجديد" htmlFor="newPin" hint="4 أرقام">
                      <Input
                        id="newPin"
                        name="newPin"
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={4}
                        dir="ltr"
                        required
                      />
                    </Field>

                    <Field
                      label="تأكيد الرمز الجديد"
                      htmlFor="confirmPin"
                      hint="أعد كتابة الرمز الجديد"
                    >
                      <Input
                        id="confirmPin"
                        name="confirmPin"
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={4}
                        dir="ltr"
                        required
                      />
                    </Field>
                  </div>
                </div>
              </ActionForm>
            </div>
          </CardContent>
          <CardFooter>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary">
                <LogoutIcon className="size-4" />
                تسجيل الخروج
              </Button>
            </form>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>النسخ الاحتياطي</CardTitle>
            <Badge tone="success">متاح</Badge>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted">
                  <DatabaseIcon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">
                    نزّل نسخة من بياناتك
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-6 text-muted">
                    النسخة بتتحفظ كملف SQLite واحد، وتقدر ترجعها من هنا في أي
                    وقت. الاحتفاظ بنسخة على جهاز أو سحابة تانية بيحميك من ضياع
                    الجهاز نفسه.
                  </p>
                </div>
              </div>

              <a
                href="/api/backup"
                className={buttonStyles({ variant: "secondary" })}
              >
                <DatabaseIcon className="size-4" />
                تحميل نسخة
              </a>
            </div>

            <div className="border-t border-line/70 pt-5">
              <RestoreForm />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
