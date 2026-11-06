import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
};

// The login page reads the session and settings on every request.
export const instant = false;

export default async function LoginPage() {
  const setting = await redirectIfAuthenticated();

  if (!setting) redirect("/setup");

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold text-gold">أهلًا برجوعك</p>
        <h1 className="mt-1 text-2xl font-extrabold text-ink">
          افتح دفترك
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          اكتب الرمز السري بتاع{" "}
          <span className="font-bold text-ink">{setting.shopName}</span> عشان
          تكمل شغلك.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
