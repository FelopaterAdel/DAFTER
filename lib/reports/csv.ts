/**
 * CSV output shared by every report export.
 *
 * - Excel only honours UTF-8 when the file starts with a BOM, and Arabic is
 *   unreadable without it, so the BOM is always prefixed.
 * - CRLF keeps Excel and LibreOffice happy.
 * - Money is written as a plain decimal string (`1234.50`) so spreadsheets
 *   read it as a number: no `EGP` prefix and no thousands separators.
 */

const BOM = "\uFEFF";
const EOL = "\r\n";

export function csvAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function escapeField(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeField).join(","));
  return BOM + lines.join(EOL) + EOL;
}
