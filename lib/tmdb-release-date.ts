/**
 * Lógica pura de scripts/backfill-release-dates.mjs: extraída aquí para
 * testearla con node:test. Dada la respuesta de
 * `GET /find/{imdb_id}?external_source=imdb_id` de TMDb, saca la fecha de
 * estreno (si la hay).
 */

/** TMDb solo acepta ids de IMDb (`tt…`) como external_id; lo demás ni se pregunta. */
export function isImdbId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith("tt");
}

/**
 * Devuelve la fecha de estreno "YYYY-MM-DD" del primer resultado de
 * movie_results, o null si no hay resultados o el campo viene vacío
 * (TMDb lo devuelve como "" para películas anunciadas sin fecha).
 */
export function extractReleaseDate(data: unknown): string | null {
  const m = (data as { movie_results?: { release_date?: string }[] } | null)
    ?.movie_results?.[0];
  return m && m.release_date ? m.release_date : null;
}
