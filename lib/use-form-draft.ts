"use client";
import { useEffect, useRef, useState } from "react";

/** Persist on each user change, including empty reviews: mobile may skip unload. */
export function useFormDraft<T>(key: string, initial: T, validate: (raw: unknown) => T | null, legacyKey?: string) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState<T | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const current = useRef(initial);
  const dirty = useRef(false);
  const validator = useRef(validate);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const candidate = validator.current(JSON.parse(raw));
          if (candidate && JSON.stringify(candidate) !== JSON.stringify(initial)) setPending(candidate);
          else if (!candidate) setMessage("El borrador no se puede leer. No se ha eliminado.");
        } else if (legacyKey) {
          const review = localStorage.getItem(legacyKey);
          if (review) setPending({ ...initial, review });
        }
      } catch { setMessage("No se puede acceder al borrador local. Mantén la página abierta hasta guardar."); }
      setReady(true);
    }, 0);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => { clearTimeout(timer); window.removeEventListener("beforeunload", warn); };
    // The initial snapshot belongs to this mounted form, not later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, legacyKey]);
  function update(next: T | ((previous: T) => T)) {
    const result = typeof next === "function" ? (next as (previous: T) => T)(current.current) : next;
    current.current = result; dirty.current = true; setValue(result);
    try { localStorage.setItem(key, JSON.stringify(result)); setMessage("Borrador guardado en este dispositivo. Falta guardar los cambios."); }
    catch { setMessage("No se pudo guardar el borrador. No cierres esta página hasta guardar los cambios."); }
  }
  function restore() { if (pending) update(pending); setPending(null); }
  function discard() {
    try { localStorage.removeItem(key); if (legacyKey) localStorage.removeItem(legacyKey); }
    catch { setMessage("No se pudo eliminar el borrador local."); }
    setPending(null);
  }
  function saved() {
    dirty.current = false;
    try { localStorage.removeItem(key); if (legacyKey) localStorage.removeItem(legacyKey); }
    catch { /* Server save succeeded; storage cleanup must not report failure. */ }
  }
  return { value, update, pending, ready, message, restore, discard, saved };
}
