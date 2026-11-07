"use client";

import { buttonStyles } from "@/components/ui/button";
import { PrintIcon } from "@/components/ui/icons";

/** Opens the browser print dialog — that is also how a PDF gets saved. */
export function PrintButton({
  label = "طباعة",
  variant = "secondary",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "gold";
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonStyles({ variant, size: "sm", className: "print:hidden" })}
    >
      <PrintIcon className="size-4" />
      {label}
    </button>
  );
}
