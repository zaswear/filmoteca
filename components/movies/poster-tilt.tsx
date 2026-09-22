"use client";

import { useEffect, useRef } from "react";

/**
 * Tilt sutil del póster de la ficha siguiendo el puntero: rotateX/rotateY
 * máximos de ±6° con perspective(800px). Solo transform; el retorno al salir
 * lleva la transición del sistema. Solo desktop (pointer: fine) y solo si el
 * usuario no ha pedido movimiento reducido. Se escribe el transform directo
 * sobre el DOM: no hay estado de React que re-renderice en cada movimiento.
 */
export function PosterTilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current =
      window.matchMedia("(pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!enabledRef.current || !el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transition = "transform 0.08s ease-out";
    el.style.transform = `perspective(800px) rotateX(${(-py * 12).toFixed(2)}deg) rotateY(${(px * 12).toFixed(2)}deg)`;
  }

  function onLeave() {
    const el = ref.current;
    if (!enabledRef.current || !el) return;
    el.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {children}
    </div>
  );
}
