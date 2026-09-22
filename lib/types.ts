import { t } from "./i18n.ts";

// ─── Tipos de dominio ─────────────────────────────────────────────────────────

export type WatchFormat =
  | "cine"
  | "streaming"
  | "bluray"
  | "dvd"
  | "digital"
  | "otro";

export type MovieStatus =
  | "vista"
  | "pendiente"
  | "en_progreso"
  | "descartada";

export type ImageType = "gallery" | "poster_alt";

// ─── Labels para UI ───────────────────────────────────────────────────────────

// Las etiquetas se calculan al importar, no son constantes escritas: el idioma
// se fija al construir (ver lib/i18n), así que esto se resuelve una vez.
export const WATCH_FORMAT_LABELS: Record<WatchFormat, string> = {
  cine:      t("formato.cine"),
  streaming: t("formato.streaming"),
  bluray:    t("formato.bluray"),
  dvd:       t("formato.dvd"),
  digital:   t("formato.digital"),
  otro:      t("formato.otro"),
};

export const MOVIE_STATUS_LABELS: Record<MovieStatus, string> = {
  vista:       t("estado.vista"),
  pendiente:   t("estado.pendiente"),
  en_progreso: t("estado.enProgreso"),
  descartada:  t("estado.descartada"),
};

export const WATCH_FORMATS: WatchFormat[] = [
  "cine", "streaming", "bluray", "dvd", "digital", "otro",
];

export const MOVIE_STATUSES: MovieStatus[] = [
  "vista", "pendiente", "en_progreso", "descartada",
];

// ─── Tipos de película con arrays deserializados ───────────────────────────────

import type { Movie, Image, Prisma } from "./generated/prisma";

/** Movie con arrays parseados desde JSON */
export interface MovieParsed extends Omit<Movie, "genres" | "directors" | "cast"> {
  genres:    string[];
  directors: string[];
  cast:      string[];
  status:    MovieStatus;
  watchFormat: WatchFormat | null;
}

/** Movie completa con relaciones */
export interface MovieFull extends MovieParsed {
  images:     Image[];
}

/** Campos que parseMovie necesita leer; el resto los preserva tal cual. */
type MovieParsable = Pick<
  Movie,
  "genres" | "directors" | "cast" | "status" | "watchFormat"
>;

/**
 * Parsea los campos JSON de un Movie crudo de Prisma. Genérico: acepta tanto el
 * Movie completo como un `select` parcial (p. ej. el de la página "¿Qué veo?"),
 * siempre que traiga genres/directors/cast/status/watchFormat.
 */
export function parseMovie<T extends MovieParsable>(movie: T): {
  genres:      string[];
  directors:   string[];
  cast:        string[];
  status:      MovieStatus;
  watchFormat: WatchFormat | null;
} & Omit<T, "genres" | "directors" | "cast" | "status" | "watchFormat"> {
  return {
    ...movie,
    genres:      JSON.parse(movie.genres    || "[]") as string[],
    directors:   JSON.parse(movie.directors || "[]") as string[],
    cast:        JSON.parse(movie.cast      || "[]") as string[],
    status:      movie.status as MovieStatus,
    watchFormat: movie.watchFormat as WatchFormat | null,
  };
}

// ─── Versión ligera para "¿Qué veo?" ──────────────────────────────────────────
// El cliente solo lee estos campos; el `select` evita traer sinopsis/crítica
// (plot/review/notes) y el resto de columnas pesadas por cada pendiente.

export const MOVIE_QUE_VER_SELECT = {
  id: true,
  title: true,
  year: true,
  durationMin: true,
  genres: true,
  directors: true,
  cast: true,
  imdbRating: true,
  posterUrl: true,
  status: true,
  watchFormat: true,
  visualTone: true,
} as const;

export type MovieQueVerRaw = Prisma.MovieGetPayload<{
  select: typeof MOVIE_QUE_VER_SELECT;
}>;

/** MovieQueVerRaw con los arrays JSON ya parseados (lo que consume el cliente). */
export type MovieQueVer = Omit<
  MovieQueVerRaw,
  "genres" | "directors" | "cast" | "status" | "watchFormat"
> & {
  genres:      string[];
  directors:   string[];
  cast:        string[];
  status:      MovieStatus;
  watchFormat: WatchFormat | null;
};

export function parseMovieFull(
  movie: Movie & { images: Image[] }
): MovieFull {
  return {
    ...parseMovie(movie),
    images:     movie.images,
  };
}

/** Serializa arrays para guardar en Prisma */
export function serializeArrays(data: {
  genres?:    string[];
  directors?: string[];
  cast?:      string[];
}) {
  return {
    ...(data.genres    !== undefined && { genres:    JSON.stringify(data.genres) }),
    ...(data.directors !== undefined && { directors: JSON.stringify(data.directors) }),
    ...(data.cast      !== undefined && { cast:      JSON.stringify(data.cast) }),
  };
}
