import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { LedgerIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span className="grid size-14 place-items-center rounded-3xl bg-brand text-white shadow-lift">
        <LedgerIcon className="size-7" />
      </span>
      <p className="mt-6 text-xs font-bold tracking-wide text-gold">
        صفحة 404
      </p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">
        الصفحة دي مش موجودة في دفترك
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-7 text-muted">
        يمكن الرابط قديم أو اتكتب غلط. ارجع للوحة التحكم وكمل شغلك من هناك.
      </p>
      <Link href="/" className={buttonStyles({ size: "lg", className: "mt-6" })}>
        ارجع للرئيسية
      </Link>
    </div>
  );
}
