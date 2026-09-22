/**
 * La marca: una entrada de cine.
 *
 * El nombre NO va dentro del dibujo en la interfaz. Metido dentro obliga a que
 * la entrada sea larga, y al reducirla a la altura de una barra lateral el
 * nombre baja a unos 8 px y el contorno se lo come. Así que el bloqueo de la
 * interfaz son dos piezas: el icono del resguardo, que es lo único que un
 * dibujo hace bien a 25 px, y el nombre como **texto de la página** en
 * Archivo Black —la misma familia que los titulares—, que nunca se empasta, se
 * puede seleccionar y crece con el diseño sin tocar el SVG.
 *
 * La entrada impresa completa (`ticket`) se reserva para donde hay sitio de
 * verdad: la pantalla de entrada.
 *
 * Los colores van fijos y no heredan de `currentColor`: la entrada es papel
 * crema con tinta encima, así que tiene que leerse igual sobre el papel de la
 * app, sobre una superficie clara y sobre el negro de un botón.
 */

import { APP_NAME } from "@/lib/branding";

const PAPEL = "#F6F3EC";
const TINTA = "#15120E";
const CODIGO = "#D8431F";

/** El resguardo: entrada apaisada, trazo fino y el código en cinco bloques. */
function Resguardo({ height, className }: { height: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 38 28"
      width={(height * 38) / 28}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5,2.5 H33 a2.5,2.5 0 0 1 2.5,2.5 V10 a4,4 0 0 0 0,8 V23 a2.5,2.5 0 0 1 -2.5,2.5 H5 a2.5,2.5 0 0 1 -2.5,-2.5 V18 a4,4 0 0 0 0,-8 V5 a2.5,2.5 0 0 1 2.5,-2.5 Z"
        fill={PAPEL}
        stroke={TINTA}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <g fill={CODIGO}>
        <path d="M7,7 h8 v8 h-8 z M10,10 v2 h2 v-2 z" fillRule="evenodd" />
        <rect x="19" y="7" width="4" height="4" />
        <rect x="7" y="18" width="4" height="3" />
        <rect x="14" y="14" width="4" height="7" />
        <rect x="21" y="14" width="4" height="7" />
        <rect x="28" y="7" width="3" height="14" />
      </g>
    </svg>
  );
}

interface Props {
  /**
   * `lockup` (por defecto): icono + nombre en texto.
   * `mark`: solo el resguardo.
   * `ticket`: la entrada impresa con el nombre dentro, para superficies grandes.
   */
  variant?: "lockup" | "mark" | "ticket";
  /** Tamaño del nombre en px. El icono se escala con él. */
  size?: number;
  className?: string;
}

export function Logo({ variant = "lockup", size = 21, className }: Props) {
  const titulo = APP_NAME;

  if (variant === "mark") {
    return (
      <span role="img" aria-label={titulo} className={className}>
        <Resguardo height={size} />
      </span>
    );
  }

  if (variant === "ticket") {
    return (
      <svg
        role="img"
        aria-label={titulo}
        viewBox="0 0 226 46"
        width={(size * 226) / 46}
        height={size}
        className={className}
      >
        <path
          d="M10,2.5 H182 a3.5,3.5 0 0 0 7,0 H216 a7.5,7.5 0 0 1 7.5,7.5 V36 a7.5,7.5 0 0 1 -7.5,7.5 H189 a3.5,3.5 0 0 0 -7,0 H10 a7.5,7.5 0 0 1 -7.5,-7.5 V29 a6,6 0 0 0 0,-12 V10 a7.5,7.5 0 0 1 7.5,-7.5 Z"
          fill={PAPEL}
          stroke={TINTA}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <text
          x="103"
          y="31"
          textAnchor="middle"
          fontFamily="var(--font-archivo-black), 'Arial Black', sans-serif"
          fontSize="22"
          fill={TINTA}
        >
          {titulo}
        </text>
        <g fill={CODIGO}>
          <path d="M195,11 h9 v9 h-9 z M198,14 v3 h3 v-3 z" fillRule="evenodd" />
          <rect x="208" y="11" width="6" height="6" />
          <rect x="195" y="24" width="6" height="6" />
          <rect x="204" y="24" width="10" height="6" />
        </g>
      </svg>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: Math.round(size * 0.42) }}
    >
      <Resguardo height={Math.round(size * 1.2)} />
      <span
        className="font-display text-text whitespace-nowrap"
        style={{ fontSize: size, lineHeight: 1, letterSpacing: "-0.025em" }}
      >
        {titulo}
      </span>
    </span>
  );
}
