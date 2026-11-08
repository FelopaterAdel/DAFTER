import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type Tone = "brand" | "gold" | "danger" | "info";

const tones: Record<Tone, { icon: string; value: string }> = {
  brand: { icon: "bg-brand-soft text-brand-dark", value: "text-brand-dark" },
  gold: { icon: "bg-gold-soft text-gold", value: "text-ink" },
  danger: { icon: "bg-danger-soft text-danger", value: "text-danger" },
  info: { icon: "bg-info-soft text-info", value: "text-ink" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: Tone;
}) {
  const palette = tones[tone];

  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">{label}</p>
          <p
            className={cn(
              "mt-1.5 break-words text-lg font-extrabold leading-tight tracking-tight tabular-nums sm:mt-2 sm:text-xl lg:text-2xl",
              palette.value,
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-[11px] leading-5 text-muted">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl sm:size-10",
            palette.icon,
          )}
        >
          <Icon className="size-4 sm:size-5" />
        </span>
      </div>
    </div>
  );
}
