/**
 * Lógica pura de /api/cartelera: la cartelera se guarda en caché tal cual la
 * dejó el último scrape, y en cada petición se recorta a lo que sigue vigente.
 * El recorte depende de la hora actual, así que no puede ir dentro de la caché.
 */

/** Tag de la caché de /api/cartelera; lo invalida /api/cartelera/revalidate. */
export const CARTELERA_TAG = "cartelera";

export interface PaseCartelera {
  id: number;
  cinemaName: string;
  city: string;
  startTime: string; // "HH:MM"
  date: string; // "YYYY-MM-DD"
  ticketUrl: string | null;
}

export interface PeliculaCartelera {
  id: number;
  title: string;
  url: string;
  posterUrl: string | null;
  showtimes: PaseCartelera[];
}

/** Fecha ("YYYY-MM-DD") y hora ("HH:MM") actuales en los Países Bajos. */
export function ahoraEnNL(ahora: Date = new Date()): { hoy: string; hora: string } {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ahora);
  return { hoy, hora };
}

/**
 * Quita los pases de días pasados y los de hoy cuya hora ya pasó (su
 * ticket_url de Filmladder caduca al empezar el pase), filtra por ciudad si
 * se pide y descarta las películas que se quedan sin pases.
 */
export function carteleraVigente(
  peliculas: PeliculaCartelera[],
  { hoy, hora }: { hoy: string; hora: string },
  ciudad: string | null = null,
): PeliculaCartelera[] {
  const ciudadNorm = ciudad?.toLowerCase() ?? null;
  return peliculas
    .map((p) => ({
      ...p,
      showtimes: p.showtimes.filter((st) => {
        if (ciudadNorm && st.city.toLowerCase() !== ciudadNorm) return false;
        if (st.date < hoy) return false;
        if (st.date === hoy) return st.startTime >= hora;
        return true;
      }),
    }))
    .filter((p) => p.showtimes.length > 0);
}
