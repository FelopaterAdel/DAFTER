import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const cairo = localFont({
  src: "./fonts/Cairo-Variable.ttf",
  weight: "200 1000",
  style: "normal",
  variable: "--font-cairo",
  display: "swap",
  fallback: ["Segoe UI", "Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "دفتر — إدارة العهد والتحصيل",
    template: "%s — دفتر",
  },
  description:
    "دفتر بسيط لإدارة العهد والبضاعة والزبائن والتحصيل اليومي ومخزنك الخاص.",
  applicationName: "دفتر",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f3ea",
  width: "device-width",
  initialScale: 1,
};

// Daftar is a private, request-time app (PIN session + local database), so
// navigations are allowed to block while the server renders fresh data.
export const instant = false;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={cairo.variable}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
