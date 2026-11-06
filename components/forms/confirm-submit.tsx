"use client";

import type { ReactNode } from "react";

import { buttonStyles } from "@/components/ui/button";

export function ConfirmSubmitButton({
  children,
  message,
  className,
  variant = "danger",
  size = "sm",
  title,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={buttonStyles({ variant, size, className })}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
