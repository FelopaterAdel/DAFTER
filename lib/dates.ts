const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local business date as `YYYY-MM-DD` (not UTC, to avoid off-by-one days). */
export function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isValidISODate(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

/** Displays `YYYY-MM-DD` as `DD/MM/YYYY` with Latin digits. */
export function formatDate(value: string) {
  if (!isValidISODate(value)) return value;

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function currentYear() {
  return new Date().getFullYear();
}
