const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Converts Arabic-Indic (٠١٢…) and Eastern Arabic (۰۱۲…) digits to Latin digits.
 * Keeps every other character unchanged.
 */
export function normalizeDigits(input: string) {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(digit);
    if (arabicIndex !== -1) return String(arabicIndex);

    return String(EASTERN_ARABIC_DIGITS.indexOf(digit));
  });
}

export function collapseWhitespace(input: string) {
  return input.trim().replace(/\s+/g, " ");
}
