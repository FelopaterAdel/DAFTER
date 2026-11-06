import { normalizeDigits } from "@/lib/text";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer piastres as `EGP 1,234.50` (Latin digits, always). */
export function formatMoney(cents: number) {
  return `EGP ${formatter.format(cents / 100)}`;
}

/** Formats integer piastres without the currency prefix. */
export function formatAmount(cents: number) {
  return formatter.format(cents / 100);
}

/**
 * Parses a human-entered amount into integer piastres.
 * Accepts Arabic digits, thousands separators and a decimal point.
 * Returns `null` for empty, negative, or malformed input.
 */
export function parseMoneyToCents(value: string): number | null {
  const cleaned = normalizeDigits(value)
    .replace(/[,\s]/g, "")
    .replace(/ج\.م|جنيه|EGP/gi, "");

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const cents = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}
