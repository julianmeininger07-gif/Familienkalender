"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/actions/push";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** Push-Benachrichtigungen für dieses Gerät ein- und ausschalten. */
export function PushSettings({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone kann Push nur als installierte App (Home-Bildschirm).
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      await savePushSubscription(sub.toJSON());
      setState("on");
      setMsg("Benachrichtigungen sind für dieses Gerät eingeschaltet.");
    } catch (e) {
      setMsg(`Hat nicht geklappt: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Benachrichtigungen für dieses Gerät ausgeschaltet.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestPush();
      setMsg(sent ? `Test-Nachricht an ${sent} Gerät(e) geschickt.` : "Kein Gerät angemeldet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {state === "loading" && <p className="text-gray-500">Prüfe …</p>}
      {state === "unsupported" && <p className="text-gray-600">Dieser Browser kann leider keine Push-Nachrichten empfangen.</p>}
      {state === "ios-install" && (
        <div className="rounded-lg bg-ferien-soft p-3">
          <p className="font-semibold">Auf dem iPhone geht Push nur als App:</p>
          <ol className="mt-1 list-decimal pl-5 text-gray-700">
            <li>Unten in Safari auf „Teilen“ tippen (Quadrat mit Pfeil).</li>
            <li>„Zum Home-Bildschirm“ wählen.</li>
            <li>Die App vom Home-Bildschirm öffnen und hier Benachrichtigungen einschalten.</li>
          </ol>
        </div>
      )}
      {state === "denied" && (
        <p className="text-gray-700">
          Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser- bzw. Handy-Einstellungen und lade die Seite neu.
        </p>
      )}
      {state === "off" && (
        <button type="button" disabled={busy} onClick={enable} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          🔔 Benachrichtigungen einschalten
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-green-50 px-3 py-2 text-green-900">🔔 Auf diesem Gerät eingeschaltet</span>
          <button type="button" disabled={busy} onClick={test} className="rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-50">
            Test-Nachricht
          </button>
          <button type="button" disabled={busy} onClick={disable} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-600 disabled:opacity-50">
            Ausschalten
          </button>
        </div>
      )}
      {msg && <p className="text-gray-700">{msg}</p>}
      <p className="text-xs text-gray-500">
        Du bekommst Nachrichten für deine Erinnerungen, wenn dich jemand zu einem Termin einlädt und wenn jemand auf deine Einladung antwortet.
        Jedes Gerät (Handy, Computer) muss einzeln eingeschaltet werden.
      </p>
    </div>
  );
}
