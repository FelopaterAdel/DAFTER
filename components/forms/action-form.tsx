"use client";

import { useActionState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type ServerAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  submitClassName,
  variant = "primary",
  size = "md",
  footer,
}: {
  action: ServerAction;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
  className?: string;
  submitClassName?: string;
  variant?: "primary" | "secondary" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className={cn("print:hidden", className)}>
      {children}

      {state.error ? (
        <Alert className="mt-4">{state.error}</Alert>
      ) : null}

      {state.success ? (
        <Alert tone="success" role="status" className="mt-4">
          {state.success}
        </Alert>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant={variant}
          size={size}
          disabled={pending}
          className={submitClassName}
        >
          {pending ? (pendingLabel ?? "جارٍ الحفظ...") : submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}

export function InlineActionForm({
  action,
  children,
  className,
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className={cn("space-y-3 print:hidden", className)}>
      {children}
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" role="status">
          {state.success}
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ"}
        </Button>
      </div>
    </form>
  );
}
