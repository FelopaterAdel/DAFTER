import { isValidISODate } from "./dates";
import { parseMoneyToCents } from "./money";
import { normalizeDigits } from "./text";

export function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value.length > 0 ? value : null;
}

/** Parses an amount into piastres. Returns `null` for empty or malformed input. */
export function readMoney(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) return null;

  return parseMoneyToCents(raw);
}

/** Parses a positive whole number (quantities). */
export function readPositiveInt(formData: FormData, key: string) {
  const raw = normalizeDigits(readString(formData, key)).replace(/[,\s]/g, "");
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;

  return value;
}

/** Parses a non-negative whole number (stock adjustments). */
export function readNonNegativeInt(formData: FormData, key: string) {
  const raw = normalizeDigits(readString(formData, key)).replace(/[,\s]/g, "");
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) return null;

  return value;
}

/** Parses a signed whole number (stock adjustments). Zero is allowed. */
export function readSignedInt(formData: FormData, key: string) {
  const raw = normalizeDigits(readString(formData, key)).replace(/[,\s]/g, "");
  if (!/^-?\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return null;

  return value;
}

export function readDate(formData: FormData, key: string) {
  const raw = readString(formData, key);
  return isValidISODate(raw) ? raw : null;
}

export const messages = {
  required: "املأ الحقل المطلوب.",
  invalidAmount: "اكتب مبلغ صحيح أكبر من صفر.",
  invalidQuantity: "اكتب كمية صحيحة أكبر من صفر.",
  invalidDate: "اختار تاريخ صحيح.",
};
