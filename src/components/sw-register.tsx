"use client";

import { useEffect } from "react";

/** Meldet den Service Worker an: nötig fürs Installieren als App, für die Offline-Seite und für Push. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
