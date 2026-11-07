"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  BoxIcon,
  BriefcaseIcon,
  ChartIcon,
  HomeIcon,
  LedgerIcon,
  LogoutIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";

const primaryItems = [
  { href: "/", label: "الرئيسية", icon: HomeIcon },
  { href: "/custodies", label: "العهد", icon: BriefcaseIcon },
  { href: "/customers", label: "الزبائن", icon: UsersIcon },
  { href: "/collections", label: "التحصيل", icon: WalletIcon },
  { href: "/warehouse", label: "المخزن", icon: BoxIcon },
  { href: "/reports", label: "التقارير", icon: ChartIcon },
];

const settingsItem = {
  href: "/settings",
  label: "الإعدادات",
  icon: SettingsIcon,
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-2xl">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm">
        <LedgerIcon className="size-6" />
      </span>
      <span className="leading-tight">
        <span className="block text-xl font-extrabold tracking-tight text-ink">
          دفتر
        </span>
        <span className="block text-[11px] font-medium text-muted">
          العهد والتحصيل
        </span>
      </span>
    </Link>
  );
}

export function DesktopSidebar({
  shopName,
  logout,
}: {
  shopName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-l border-line/80 bg-surface/75 px-4 py-6 backdrop-blur lg:flex print:hidden">
      <div className="px-2">
        <Brand />
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="التنقل الرئيسي">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-brand-soft/70 hover:text-brand-dark",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="my-3 h-px bg-line/80" />

        <Link
          href={settingsItem.href}
          aria-current={
            isActive(pathname, settingsItem.href) ? "page" : undefined
          }
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
            isActive(pathname, settingsItem.href)
              ? "bg-brand text-white shadow-sm"
              : "text-muted hover:bg-brand-soft/70 hover:text-brand-dark",
          )}
        >
          <settingsItem.icon className="size-5 shrink-0" />
          {settingsItem.label}
        </Link>
      </nav>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand-dark">
            {shopName.trim().charAt(0) || "د"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{shopName}</p>
            <p className="text-[11px] text-muted">صاحب الدفتر</p>
          </div>
        </div>

        <form action={logout} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogoutIcon className="size-4" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileHeader({
  shopName,
  logout,
}: {
  shopName: string;
  logout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Brand />
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="الإعدادات"
            className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <SettingsIcon className="size-5" />
          </Link>
          <form action={logout}>
            <button
              type="submit"
              aria-label={`تسجيل خروج ${shopName}`}
              className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <LogoutIcon className="size-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="التنقل السفلي"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/95 px-2 pt-1.5 backdrop-blur lg:hidden print:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-6">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 text-[11px] font-semibold transition-colors",
                active
                  ? "text-brand-dark"
                  : "text-muted hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-10 place-items-center rounded-xl transition-colors",
                  active ? "bg-brand-soft text-brand-dark" : "text-muted",
                )}
              >
                <Icon className="size-[21px]" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
