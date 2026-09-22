/** Gradiente arcoíris único (defs SVG) para fill/stroke referenciados como
 *  url(#id). Un solo componente evita que las dos copias del gradiente
 *  (app-shell y lgbt) diverjan en colores. */
export function RainbowGradient({ id, diagonal = false }: { id: string; diagonal?: boolean }) {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2={diagonal ? "100%" : "0%"}>
          <stop offset="0%" stopColor="#ff3366" />
          <stop offset="25%" stopColor="#ff9933" />
          <stop offset="50%" stopColor="#33cc66" />
          <stop offset="75%" stopColor="#3399ff" />
          <stop offset="100%" stopColor="#9933ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
