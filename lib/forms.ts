export type FormState = {
  error: string | null;
  success?: string | null;
};

export const initialFormState: FormState = { error: null, success: null };
