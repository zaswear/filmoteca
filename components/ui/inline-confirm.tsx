"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Confirmación en el sitio, en vez de `window.confirm`.
 *
 * El diálogo nativo bloquea el hilo, no se puede estilar, y en móvil aparece
 * anclado arriba del todo, lejos del botón que lo ha provocado. Aquí el botón
 * se sustituye por la pregunta y sus dos respuestas, en su misma posición.
 *
 * El foco va a "Cancelar", no a la respuesta destructiva: quien ha activado el
 * botón con Enter podría encadenar un segundo Enter y borrar sin leer. Escape
 * también cancela. La pregunta se anuncia con role="alert" porque el cambio
 * ocurre lejos del foco anterior.
 *
 *   <InlineConfirm question="¿Eliminar esta película?" confirmLabel="Eliminar"
 *                  onConfirm={borrar}>
 *     {(pedir) => <button onClick={pedir}>Eliminar</button>}
 *   </InlineConfirm>
 */
export function InlineConfirm({
  question,
  confirmLabel = "Sí, eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  children,
}: {
  question: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  children: (pedirConfirmacion: () => void) => React.ReactNode;
}) {
  const [preguntando, setPreguntando] = useState(false);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (preguntando) cancelarRef.current?.focus();
  }, [preguntando]);

  if (!preguntando) return <>{children(() => setPreguntando(true))}</>;

  return (
    <span
      role="alert"
      aria-describedby={id}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setPreguntando(false);
        }
      }}
      className="inline-flex flex-wrap items-center gap-2 animate-fade-in"
    >
      <span id={id} className="text-sm text-text-faint">
        {question}
      </span>
      <button
        type="button"
        onClick={() => {
          setPreguntando(false);
          onConfirm();
        }}
        className="tap-target px-3 text-sm font-semibold text-(--error) hover:bg-(--surface-hi) transition-colors"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        ref={cancelarRef}
        onClick={() => setPreguntando(false)}
        className="tap-target px-3 text-sm text-text-faint hover:text-text hover:bg-(--surface-hi) transition-colors"
      >
        {cancelLabel}
      </button>
    </span>
  );
}
