/** First value of a repeated query param (`?a=1&a=2` → `1`). */
export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Re-serialises the current `searchParams` so a link (CSV export, "back to the
 * report") keeps every active filter without the page having to know which
 * params it understands.
 */
export function searchQueryString(
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
