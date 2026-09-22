"use client";

import { useEffect, useRef } from "react";

/**
 * Comportamiento de teclado y foco de un diálogo modal.
 *
 * `aria-modal="true"` describe el diálogo pero no hace nada: el navegador no
 * atrapa el foco por tenerlo. Sin esto, un usuario de teclado tabula desde
 * dentro del modal hacia la página de detrás —que sigue ahí, visible bajo el
 * backdrop— y se queda operando controles que cree cerrados.
 *
 * Cubre las cuatro piezas que hay que resolver a mano:
 *   1. Foco inicial dentro del diálogo al abrirse.
 *   2. Tab y Shift+Tab circulan solo entre sus elementos enfocables.
 *   3. Escape cierra.
 *   4. Al cerrar, el foco vuelve al elemento que lo abrió.
 *
 * La (4) es la que más se olvida y la que más molesta: sin ella el foco cae al
 * <body> y hay que tabular desde el principio de la página para seguir.
 *
 * Uso, cuando el padre monta y desmonta el diálogo:
 *   const ref = useDialog<HTMLDivElement>(onClose);
 *   <div ref={ref} role="dialog" aria-modal="true"> … </div>
 *
 * Uso, cuando el diálogo vive en un componente que también existe cerrado
 * (patrón `if (!open) return null`): hay que pasar `enabled`, porque en el
 * primer render la ref todavía es null y el efecto no tendría a qué engancharse.
 *   const ref = useDialog<HTMLDivElement>(onClose, { enabled: open });
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialog<T extends HTMLElement>(
  onClose: () => void,
  opts: { lockScroll?: boolean; enabled?: boolean } = {}
) {
  const ref = useRef<T>(null);
  const { lockScroll = true, enabled = true } = opts;

  // onClose suele llegar como función nueva en cada render del padre. Si fuera
  // dependencia del efecto, el diálogo se remontaría el listener en cada
  // pulsación de tecla del formulario y el foco inicial se recolocaría solo.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    // Quién tenía el foco antes de abrir, para devolvérselo al cerrar.
    const previo = document.activeElement as HTMLElement | null;

    const enfocables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Foco inicial: el primer control real del diálogo. Si no hay ninguno, el
    // contenedor —de ahí el tabIndex=-1 que se le pone aquí, para que pueda
    // recibirlo sin entrar en el orden de tabulación.
    const primero = enfocables()[0];
    if (primero) {
      primero.focus();
    } else {
      node.tabIndex = -1;
      node.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;

      const items = enfocables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const primero = items[0];
      const ultimo = items[items.length - 1];
      const activo = document.activeElement;

      // El foco puede estar fuera del diálogo si algo lo movió por su cuenta;
      // en ese caso se recupera en vez de dejarlo escapar.
      if (!node.contains(activo)) {
        e.preventDefault();
        primero.focus();
        return;
      }

      if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    // capture: el diálogo tiene que ver Escape antes que cualquier handler de
    // la página de debajo, que si no cerraría las dos cosas a la vez.
    document.addEventListener("keydown", onKey, true);

    const overflowPrevio = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (lockScroll) document.body.style.overflow = overflowPrevio;
      // isConnected: si el disparador se desmontó con el diálogo (una fila de
      // lista que desaparece al guardar, p. ej.) devolver el foco ahí no haría
      // nada útil y lo perderíamos igual.
      if (previo?.isConnected) previo.focus();
    };
  }, [lockScroll, enabled]);

  return ref;
}
