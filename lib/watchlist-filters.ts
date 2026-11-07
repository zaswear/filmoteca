/**
 * Filtros y orden de la lista de pendientes.
 *
 * Aquí sí se filtra en el navegador, al revés que en `/peliculas`: la página ya
 * manda todas las pendientes (unas 80) porque las pinta todas, así que pedirle
 * al servidor una versión filtrada costaría una vuelta por cada clic para
 * devolver un subconjunto de lo que ya está en memoria.
 *
 * Funciones puras y sin React para poder probarlas con `node --test`.
 */

export type OrdenPendientes = "recientes" | "antiguas" | "imdb" | "cortas" | "anio";

export const ORDENES: OrdenPendientes[] = ["recientes", "antiguas", "imdb", "cortas", "anio"];

/** Umbral del atajo «nota alta». */
export const IMDB_ALTA = 7.5;

export interface FiltrosPendientes {
  /** Vacío = todos. Con varios, basta con que la película tenga uno (O, no Y). */
  generos: string[];
  /** Minutos disponibles; `null` = sin límite. */
  maxMin: number | null;
  imdbAlta: boolean;
  orden: OrdenPendientes;
}

export const FILTROS_INICIALES: FiltrosPendientes = {
  generos: [],
  maxMin: null,
  imdbAlta: false,
  orden: "recientes",
};

interface Filtrable {
  id: number;
  genres: string[];
  durationMin: number | null;
  imdbRating: number | null;
  year: number | null;
  createdAt: Date | string;
}

export function hayFiltros(f: FiltrosPendientes): boolean {
  return f.generos.length > 0 || f.maxMin !== null || f.imdbAlta;
}

/** Géneros presentes en la lista, del más frecuente al menos. */
export function generosDe(movies: Pick<Filtrable, "genres">[]): string[] {
  const cuenta = new Map<string, number>();
  for (const m of movies) for (const g of m.genres) cuenta.set(g, (cuenta.get(g) ?? 0) + 1);
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([g]) => g);
}

const ms = (d: Date | string) => new Date(d).getTime();

/** Compara dejando los `null` al final, sea cual sea el sentido. */
function nullsAlFinal(a: number | null, b: number | null, sentido: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * sentido;
}

const COMPARADORES: Record<OrdenPendientes, (a: Filtrable, b: Filtrable) => number> = {
  recientes: (a, b) => ms(b.createdAt) - ms(a.createdAt),
  antiguas: (a, b) => ms(a.createdAt) - ms(b.createdAt),
  imdb: (a, b) => nullsAlFinal(a.imdbRating, b.imdbRating, -1),
  cortas: (a, b) => nullsAlFinal(a.durationMin, b.durationMin, 1),
  anio: (a, b) => nullsAlFinal(a.year, b.year, -1),
};

export function filtrarPendientes<T extends Filtrable>(movies: T[], f: FiltrosPendientes): T[] {
  const generos = new Set(f.generos);
  const comparar = COMPARADORES[f.orden];
  return movies
    .filter((m) => generos.size === 0 || m.genres.some((g) => generos.has(g)))
    // Con un límite puesto, las que no tienen duración no entran: no se puede
    // prometer que quepan.
    .filter((m) => f.maxMin === null || (m.durationMin !== null && m.durationMin <= f.maxMin))
    .filter((m) => !f.imdbAlta || (m.imdbRating !== null && m.imdbRating >= IMDB_ALTA))
    // Desempate por id: con notas o duraciones repetidas el orden no baila
    // entre renders.
    .sort((a, b) => comparar(a, b) || b.id - a.id);
}

/** 105 → «1 h 45». */
export function formatoHoras(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}′`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
