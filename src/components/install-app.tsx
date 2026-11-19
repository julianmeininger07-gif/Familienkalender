"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Hinweis bzw. Knopf, um den Kalender als App auf den Home-Bildschirm zu legen. */
export function InstallApp() {
  const [mode, setMode] = useState<"hidden" | "installed" | "ios" | "prompt" | "manual">("hidden");
  const [promptEvent, setPromptEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return setMode("installed");
    setMode(/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "manual");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;
  if (mode === "installed") return <p className="text-sm text-gray-700">✓ Der Kalender läuft als App auf diesem Gerät.</p>;
  if (mode === "prompt" && promptEvent)
    return (
      <button
        type="button"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        onClick={async () => {
          await promptEvent.prompt();
          const { outcome } = await promptEvent.userChoice;
          if (outcome === "accepted") setMode("installed");
          setPromptEvent(null);
        }}
      >
        Als App installieren
      </button>
    );
  if (mode === "ios")
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
        <li>
          Diese Seite in <strong>Safari</strong> öffnen.
        </li>
        <li>
          Unten auf <strong>Teilen</strong> (Viereck mit Pfeil nach oben) tippen.
        </li>
        <li>
          <strong>Zum Home-Bildschirm</strong> wählen und bestätigen.
        </li>
        <li>Den Kalender ab jetzt über das neue Symbol öffnen.</li>
      </ol>
    );
  return (
    <p className="text-sm text-gray-700">
      Im Browser-Menü (⋮) <strong>App installieren</strong> bzw. <strong>Zum Startbildschirm hinzufügen</strong> wählen. Am
      Computer geht das in Chrome und Edge über das Symbol rechts in der Adressleiste.
    </p>
  );
}
