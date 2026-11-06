import { connection } from "next/server";

import { DesktopSidebar, MobileBottomNav, MobileHeader } from "@/components/layout/nav";
import { logoutAction } from "@/lib/actions/auth";
import { requireAuth } from "@/lib/auth/dal";

// The whole app is request-time UI: it reads the session cookie and the database.
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Make the request-time boundary explicit so time reads (session expiry,
  // "today") never run during prerendering.
  await connection();

  const setting = await requireAuth();

  return (
    <>
      <div className="min-h-dvh lg:grid lg:grid-cols-[276px_minmax(0,1fr)]">
        <DesktopSidebar shopName={setting.shopName} logout={logoutAction} />

        <div className="flex min-h-dvh min-w-0 flex-col">
          <MobileHeader shopName={setting.shopName} logout={logoutAction} />

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-10">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav />
    </>
  );
}
