import { formatDate, todayISO } from "@/lib/dates";

/**
 * Header that only exists on paper: shop name, what is being printed, the
 * period it covers, and when it was printed. Screen keeps the normal PageHeader.
 */
export function PrintHeader({
  shopName,
  title,
  period,
}: {
  shopName: string;
  title: string;
  period?: string;
}) {
  return (
    <div className="mb-4 hidden border-b border-black/40 pb-2 print:block">
      <p className="text-base font-extrabold">
        {shopName} — {title}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
        {period ? <span>الفترة: {period}</span> : null}
        <span>تاريخ الطباعة: {formatDate(todayISO())}</span>
      </p>
    </div>
  );
}
