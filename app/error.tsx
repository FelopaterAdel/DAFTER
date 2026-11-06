"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { AlertIcon, LedgerIcon } from "@/components/ui/icons";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span className="grid size-14 place-items-center rounded-3xl bg-danger-soft text-danger">
        <AlertIcon className="size-7" />
      </span>
      <p className="mt-6 text-xs font-bold tracking-wide text-danger">
        حصلت مشكلة
      </p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">
        لم نستطع عرض هذة الصفحة   
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-7 text-muted">
        جرّب تحدّث الصفحة أو ترجع للرئيسية. لو المشكلة استمرت، اقفل التطبيق وافتحه
        تاني.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} size="lg">
          حاول تاني
        </Button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-muted"
        >
          <LedgerIcon className="me-2 size-4" />
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
