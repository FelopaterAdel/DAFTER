import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "danger" | "info" | "success" | "warning";

const tones: Record<Tone, string> = {
  danger: "border-danger/20 bg-danger-soft/70 text-danger",
  info: "border-info/20 bg-info-soft/70 text-info",
  success: "border-success/20 bg-success-soft/70 text-success",
  warning: "border-gold/25 bg-gold-soft/70 text-gold",
};

export function Alert({
  tone = "danger",
  children,
  className,
  role = "alert",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={cn(
        "rounded-xl border px-3.5 py-3 text-sm font-medium leading-6",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
