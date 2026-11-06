import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupForm } from "@/components/auth/setup-form";
import { redirectIfAuthenticated } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "الإعداد الأول",
};

// The setup page reads the session and settings on every request.
export const instant = false;

export default async function SetupPage() {
  const setting = await redirectIfAuthenticated();

  if (setting) redirect("/login");

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold text-gold">الخطوة الأولى</p>
        <h1 className="mt-1 text-2xl font-extrabold text-ink">
          خلّينا نبدأ دفترك
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          اكتب اسم نشاطك واختار رمز سري من 4 أرقام. البيانات كلها هتتخزن على
          جهازك، والرمز هو مفتاح الدخول الوحيد.
        </p>
      </div>

      <SetupForm />
    </div>
  );
}
