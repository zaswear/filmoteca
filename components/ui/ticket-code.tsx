/**
 * El código del resguardo de la marca: el dibujo en bermellón que cierra la
 * entrada del logo «full». Extraído a componente propio porque también
 * decora el talón de la entrada de la ficha de película (misma dirección de
 * arte: la ficha ES una entrada de cine).
 *
 * Las coordenadas de los paths son las del grupo original del logo
 * (translate(190,15.75) scale(0.75) en un viewBox de 226×54): se conservan
 * tal cual para que el dibujo no se altere al reutilizarlo.
 */

export const CODIGO_RESGUARDO = "#D8431F";

interface TicketCodeProps {
  /** Lado del código en px: el dibujo es cuadrado. */
  size?: number;
  color?: string;
  /** Transformación SVG (p. ej. posicionarlo dentro de otro SVG, como hace el logo). */
  transform?: string;
  className?: string;
}

export function TicketCode({ size = 24, color = CODIGO_RESGUARDO, transform, className }: TicketCodeProps) {
  return (
    <svg
      viewBox="0 0 30 30"
      width={size}
      height={size}
      transform={transform}
      className={className}
      aria-hidden="true"
    >
      <g fill={color}>
        <path d="M0,0 h11 v11 h-11 z M3,3 v5 h5 v-5 z" fillRule="evenodd" />
        <path d="M19,0 h11 v11 h-11 z M22,3 v5 h5 v-5 z" fillRule="evenodd" />
        <path d="M0,19 h11 v11 h-11 z M3,22 v5 h5 v-5 z" fillRule="evenodd" />
        <rect x="14" y="0" width="3" height="6" />
        <rect x="14" y="9" width="3" height="8" />
        <rect x="19" y="14" width="3" height="3" />
        <rect x="26" y="14" width="4" height="3" />
        <rect x="14" y="21" width="3" height="9" />
        <rect x="19" y="19" width="3" height="3" />
        <rect x="24" y="19" width="6" height="3" />
        <rect x="19" y="25" width="5" height="5" />
        <rect x="27" y="25" width="3" height="5" />
      </g>
    </svg>
  );
}
