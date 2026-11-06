"use client";

import { useActionState } from "react";

import { loginAction, type AuthFormState } from "@/lib/actions/auth";
import { PinInput } from "@/components/auth/pin-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const initialState: AuthFormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <PinInput
        name="pin"
        label="الرمز السري"
        autoFocus
        hint="الإدخال هيتقفل 5 دقائق بعد 5 محاولات خاطئة."
      />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "بيتم الدخول..." : "افتح دفترك"}
      </Button>
    </form>
  );
}
