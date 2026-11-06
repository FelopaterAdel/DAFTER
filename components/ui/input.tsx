import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

const controlClassName =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-[0_1px_0_rgb(27_36_32/0.02)] transition-colors placeholder:text-muted/65 hover:border-brand/25 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClassName, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClassName, "resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClassName, "h-11", className)} {...props} />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="mt-1.5 text-xs leading-5 text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
