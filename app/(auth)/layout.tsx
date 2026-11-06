import { connection } from "next/server";

import { LedgerIcon } from "@/components/ui/icons";

// Auth pages read cookies and the settings row, so they are request-time UI.
export const instant = false;

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-28 -top-28 size-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-brand/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-3xl bg-brand text-white shadow-lift">
            <LedgerIcon className="size-7" />
          </span>
          <p className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
            دفتر
          </p>
          <p className="mt-1.5 text-sm text-muted">
            كل عهدة، كل زبون، وكل جنيه… في مكانه.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
          {children}
        </div>

        <p className="mt-5 text-center text-[11px] font-medium text-muted">
          دفتر · إدارة العهد والتحصيل
        </p>
      </div>
    </div>
  );
}
