/**
 * Género canónico: español.
 *
 * Las tres fuentes escriben en la misma columna `genres` y no coinciden:
 *   - TMDB se pide con language=es-ES  -> "Acción", "Suspense"
 *   - OMDb no tiene localización       -> "Action", "Thriller"
 *   - El CSV de IMDb                   -> "Action", "Thriller"
 *
 * Resultado antes de esto: 35 géneros distintos para ~20 reales, con 14 pares
 * partidos. El filtro de /peliculas mentía (filtrar "Thriller" daba 29 y
 * escondía 32 en "Suspense"), las estadísticas partían los recuentos y el
 * perfil de gusto de "¿Qué veo?" trataba "Action" y "Acción" como dos géneros.
 *
 * Manda el idioma de la interfaz (`NEXT_PUBLIC_APP_LOCALE`): en una instancia
 * en inglés, "Acción" importada de un CSV viejo se normaliza a "Action", y al
 * revés. Sin esto, cambiar de idioma partiría en dos los recuentos de las
 * estadísticas y el perfil de gusto de «¿Qué veo?».
 */
import { LOCALE } from "./i18n.ts";

/** Inglés (OMDb / IMDb) → español (TMDB es-ES). Solo lo que difiere. */
const EN_ES: Record<string, string> = {
  action: "Acción",
  adventure: "Aventura",
  animation: "Animación",
  biography: "Biografía",      // existe en IMDb, no en TMDB
  comedy: "Comedia",
  crime: "Crimen",
  documentary: "Documental",
  family: "Familia",
  fantasy: "Fantasía",
  "film-noir": "Cine negro",   // idem
  history: "Historia",
  horror: "Terror",
  music: "Música",
  musical: "Musical",
  mystery: "Misterio",
  "sci-fi": "Ciencia ficción",
  "science fiction": "Ciencia ficción",
  short: "Cortometraje",
  sport: "Deporte",
  thriller: "Suspense",
  "tv movie": "Película de TV",
  war: "Bélica",
  // Iguales en ambos idiomas, se listan para que quede explícito que no faltan:
  drama: "Drama",
  romance: "Romance",
  western: "Western",
};

/** Formas ya canónicas: se aceptan tal cual (clave en minúsculas → forma final). */
const YA_ES = new Set(Object.values(EN_ES).map((g) => g.toLowerCase()));

/**
 * Devuelve el género en su forma canónica. Si no se reconoce, lo deja como
 * viene: mejor un género desconocido intacto que perderlo por el camino.
 */
/** Español → inglés, la vuelta de `EN_ES`, para las instancias en inglés. */
const ES_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_ES).map(([en, es]) => [es.toLowerCase(), en.charAt(0).toUpperCase() + en.slice(1)]),
);

export function canonicalGenre(raw: string): string {
  const g = raw.trim();
  if (!g) return "";
  const k = g.toLowerCase();

  if (LOCALE === "en") {
    const en = ES_EN[k];
    if (en) return en;
    // Ya viene en inglés: solo normaliza la mayúscula inicial.
    return g.charAt(0).toUpperCase() + g.slice(1);
  }

  const es = EN_ES[k];
  if (es) return es;

  // Ya está en español: normaliza solo las mayúsculas a la forma canónica.
  if (YA_ES.has(k)) {
    return Object.values(EN_ES).find((v) => v.toLowerCase() === k) ?? g;
  }

  return g;
}

/** Canoniza una lista y quita duplicados que aparezcan al fusionar idiomas
 *  (p. ej. una película con ["Action", "Acción"] queda en ["Acción"]). */
export function canonicalGenres(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const g = canonicalGenre(raw);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}
