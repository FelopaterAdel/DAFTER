import Link from "next/link";

import { ChevronLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  children = "رجوع",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted transition-colors hover:text-brand",
        className,
      )}
    >
      <ChevronLeftIcon className="size-4 rotate-180" />
      {children}
    </Link>
  );
}
