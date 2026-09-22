"use client";

import { useEffect } from "react";

// Registro del service worker: fire-and-forget y solo en producción. Es
// deliberadamente no crítico — si falla, la app sigue funcionando sin PWA.
export function RegisterSW() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
