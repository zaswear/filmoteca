/**
 * Lógica pura de scripts/backfill-posters.mjs: dada la respuesta de
 * `GET /find/{imdb_id}?external_source=imdb_id` de TMDB, extrae las rutas de
 * póster y fondo del primer resultado de movie_results.
 */

export interface TmdbPosterPaths {
  posterPath:   string | null;
  backdropPath: string | null;
}

/**
 * Devuelve las rutas del primer movie_result, o null si no hay resultados.
 * Las rutas llegan tal cual (p. ej. "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg");
 * la URL completa se compone con posterUrl() de lib/tmdb.ts.
 */
export function extractPosterPaths(data: unknown): TmdbPosterPaths | null {
  const m = (data as {
    movie_results?: { poster_path?: string | null; backdrop_path?: string | null }[];
  } | null)?.movie_results?.[0];
  if (!m) return null;
  return {
    posterPath:   m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null,
  };
}
