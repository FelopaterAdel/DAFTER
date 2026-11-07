import Link from "next/link";

import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
};

export function Tabs({
  items,
  className,
  ariaLabel,
}: {
  items: TabItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-card print:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
            item.active
              ? "bg-brand text-white shadow-sm"
              : "text-muted hover:bg-brand-soft/70 hover:text-brand-dark",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                item.active
                  ? "bg-white/20 text-white"
                  : "bg-surface-muted text-muted",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
