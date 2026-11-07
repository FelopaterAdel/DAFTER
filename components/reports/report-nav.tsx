import Link from "next/link";

import { cn } from "@/lib/utils";

export type ReportKey =
  | "overview"
  | "collections"
  | "custody-debts"
  | "customer-debts"
  | "warehouse";

const items: Array<{ key: ReportKey; href: string; label: string }> = [
  { key: "overview", href: "/reports", label: "نظرة عامة" },
  { key: "collections", href: "/reports/collections", label: "التحصيل" },
  { key: "custody-debts", href: "/reports/custody-debts", label: "مديونيات العهد" },
  {
    key: "customer-debts",
    href: "/reports/customer-debts",
    label: "مديونيات الزبائن",
  },
  { key: "warehouse", href: "/reports/warehouse", label: "المخزن" },
];

export function ReportNav({ active }: { active: ReportKey }) {
  return (
    <nav
      aria-label="التقارير"
      className="mb-5 flex gap-2 overflow-x-auto pb-1 print:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors",
            active === item.key
              ? "border-brand bg-brand text-white shadow-sm"
              : "border-line bg-surface text-muted hover:border-brand/30 hover:text-brand-dark",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
