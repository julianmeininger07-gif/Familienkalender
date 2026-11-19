"use client";

import { createContext, use, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-gray-900 ${props.className ?? ""}`}
    />
  );
}

/** Wird von ActionForm gesetzt, solange die Server-Action läuft. */
export const PendingContext = createContext(false);

type Variant = "primary" | "secondary" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gray-900 text-white hover:bg-gray-700",
  secondary: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const status = useFormStatus();
  const pending = use(PendingContext) || status.pending;
  return (
    <button
      type="submit"
      disabled={pending}
      className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {pending ? "Bitte warten …" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <div className="space-y-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
        <p>{state.success}</p>
        {state.link && <ShareLink link={state.link} />}
      </div>
    );
  }
  return null;
}

/** Link anzeigen, kopieren oder per WhatsApp/Teilen-Menü weitergeben. */
export function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="space-y-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded border border-green-300 bg-white px-2 py-1 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-green-400 bg-white px-3 py-1 text-xs font-semibold"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Kopiert ✓" : "Link kopieren"}
        </button>
        <a
          className="rounded-lg border border-green-400 bg-white px-3 py-1 text-xs font-semibold"
          href={`https://wa.me/?text=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noreferrer"
        >
          Per WhatsApp senden
        </a>
        {canShare && (
          <button
            type="button"
            className="rounded-lg border border-green-400 bg-white px-3 py-1 text-xs font-semibold"
            onClick={() => navigator.share({ url: link, title: "Familienkalender" }).catch(() => {})}
          >
            Teilen …
          </button>
        )}
      </div>
    </div>
  );
}
