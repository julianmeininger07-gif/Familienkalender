"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { FormMessage, PendingContext } from "./ui";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * Formular mit Server-Action und Fehler-/Erfolgsanzeige.
 * Bei einem Fehler bleiben die Eingaben stehen (React würde sie sonst leeren),
 * nach Erfolg wird das Formular zurückgesetzt.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = true,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={className}
    >
      <PendingContext value={pending}>{children}</PendingContext>
      <FormMessage state={state} />
    </form>
  );
}
