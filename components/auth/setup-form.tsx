"use client";

import { useActionState } from "react";

import { setupAction, type AuthFormState } from "@/lib/actions/auth";
import { PinInput } from "@/components/auth/pin-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initialState: AuthFormState = { error: null };

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <Field
        label="اسم المحل أو النشاط"
        htmlFor="shopName"
        hint="هيظهر في التطبيق وفي سجلّك اليومي."
      >
        <Input
          id="shopName"
          name="shopName"
          placeholder="مثال: محل الأمانة"
          autoComplete="organization"
          required
          autoFocus
        />
      </Field>

      <PinInput
        name="pin"
        label="الرمز السري"
        hint="4 أرقام بس. هتحتاجه في كل مرة تفتح دفترك."
      />

      <PinInput name="confirmPin" label="تأكيد الرمز السري" />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "بيتم تجهيز الدفتر..." : "ابدأ استخدام دفتر"}
      </Button>
    </form>
  );
}
