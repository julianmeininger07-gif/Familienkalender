export type FormState = {
  error?: string;
  success?: string;
  /** Einmalig angezeigter Link (Einladung, Passwort-Reset). */
  link?: string;
};

export const initialFormState: FormState = {};
