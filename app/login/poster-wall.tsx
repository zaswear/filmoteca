// Muro decorativo de pósters para el fondo del login.
// Server component sin estado: recibe URLs ya barajadas y las reparte en columnas
// que se desplazan en direcciones alternas (animación CSS en globals.css).

import Image from "next/image";

const COLS = 6;

// Ancho real de la columna en el CSS (.login-wall-col). El muro va desenfocado
// a blur(3px) y al 42% de brillo, así que no necesita más resolución: pedir el
// w500 de TMDB para pintarlo a 150 px era descargar 6 columnas de pósters a
// tamaño completo en la primera pantalla de la app, la única que ve alguien
// que todavía no ha entrado.
const ANCHO_COL = 150;

export function PosterWall({ posters }: { posters: string[] }) {
  if (posters.length === 0) return null;

  // Reparte los pósters en columnas tipo "mosaico".
  const columns: string[][] = Array.from({ length: COLS }, () => []);
  posters.forEach((src, i) => columns[i % COLS].push(src));

  return (
    <div className="login-wall" aria-hidden="true">
      {columns.map((col, i) => (
        <div
          key={i}
          className={`login-wall-col${i % 2 ? " login-wall-col--rev" : ""}`}
          // Duraciones ligeramente distintas por columna → desfase orgánico
          style={{ animationDuration: `${52 + i * 7}s` }}
        >
          {/* Se duplica el set para que el translateY(-50%) sea un loop continuo */}
          {[...col, ...col].map((src, j) => (
            <Image
              key={j}
              src={src}
              alt=""
              width={ANCHO_COL}
              height={Math.round(ANCHO_COL * 1.5)} /* aspect-ratio 2/3 del CSS */
              sizes={`${ANCHO_COL}px`}
              /* Fondo decorativo desenfocado: nada de esto es LCP, y todos los
                 pósters entran además con la animación de deriva. Que espere
                 todo a la fase lazy y se priorice la tarjeta de login. */
              loading="lazy"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
