"use client";

import { useEffect, useState } from "react";

/**
 * Región de anuncios única para toda la app.
 *
 * La app hace bastante trabajo asíncrono —guardar una ficha, importar un CSV,
 * marcar como vista, pedir sugerencias— y hasta ahora el resultado solo se
 * comunicaba visualmente. Para quien usa lector de pantalla, pulsar "Guardar"
 * y no oír nada es indistinguible de que el botón no haya funcionado.
 *
 * Va montada una sola vez en AppShell. Los componentes no la importan: llaman
 * a `anunciar()`, que despacha un evento. Así un componente de servidor o un
 * handler suelto puede anunciar sin necesidad de contexto ni de props.
 *
 *   import { anunciar } from "@/components/ui/live-region";
 *   anunciar("Película guardada");
 *   anunciar("Error al guardar", "assertive");
 */
const EVENTO = "dc-announce";

type Urgencia = "polite" | "assertive";

export function anunciar(mensaje: string, urgencia: Urgencia = "polite") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENTO, { detail: { mensaje, urgencia } })
  );
}

export function LiveRegion() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  useEffect(() => {
    const onAnuncio = (e: Event) => {
      const { mensaje, urgencia } = (e as CustomEvent<{
        mensaje: string;
        urgencia: Urgencia;
      }>).detail;

      const set = urgencia === "assertive" ? setAssertive : setPolite;

      // Se limpia antes de escribir: si el mensaje nuevo es idéntico al que ya
      // había, el DOM no cambia y el lector de pantalla no vuelve a leerlo.
      // Importar dos CSV seguidos con el mismo resultado se anunciaría una vez.
      set("");
      const t = setTimeout(() => set(mensaje), 60);
      return () => clearTimeout(t);
    };

    window.addEventListener(EVENTO, onAnuncio);
    return () => window.removeEventListener(EVENTO, onAnuncio);
  }, []);

  return (
    <>
      {/* Dos regiones y no una: la urgencia se declara en el marcado, no se
          puede cambiar sobre la marcha de forma fiable. "polite" espera a que
          el lector termine lo que esté diciendo; "assertive" interrumpe, y se
          reserva para errores. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </>
  );
}
