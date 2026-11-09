export type FormState = {
  error: string | null;
  success?: string | null;
};

export const initialFormState: FormState = { error: null, success: null };

/**
 * Keeps a post-action redirect on this site: it must be a local path
 * (`/goods`), never `//other-host`.
 */
export function safeRedirectPath(raw: string, fallback: string) {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
