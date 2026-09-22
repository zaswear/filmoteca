// "¿Qué veo?" — motor de recomendación por ánimo + historial. Puro (sin DB):
// lo usan tanto la página (servidor) como el cliente para re-barajar al instante.
import type { MovieQueVer } from "@/lib/types";

// ─── Perfil de gusto (derivado del historial) ────────────────────────────────
export interface TasteProfile {
  genres: Record<string, number>; // clave normalizada → afinidad 0..1
  directors: Record<string, { avg: number; count: number }>; // nombre → nota media
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ─── Ánimos ──────────────────────────────────────────────────────────────────
// Cada ánimo mapea a un conjunto de géneros (es/en, normalizados) + filtros duros.
export interface Mood {
  key: string;
  label: string;
  genres: string[];
  minRating?: number;
}

export const MOODS: Mood[] = [
  { key: "reir", label: "Ligero / reír", genres: ["comedia", "comedy", "familia", "family", "musica", "music", "animacion", "animation"] },
  { key: "intenso", label: "Tensión", genres: ["suspense", "thriller", "terror", "horror", "crimen", "crime", "misterio", "mystery", "belica", "war"] },
  { key: "llorar", label: "Para emocionarse", genres: ["drama", "romance", "biografia", "biography", "historia", "history"] },
  { key: "palomitas", label: "Palomitas", genres: ["accion", "action", "aventura", "adventure", "ciencia ficcion", "sci-fi", "fantasia", "fantasy"] },
  { key: "mente", label: "Mente", genres: ["misterio", "mystery", "suspense", "thriller", "ciencia ficcion", "sci-fi"], minRating: 7 },
];

// Filtros libres (los que puede devolver también la interpretación por IA).
export interface WatchFilters {
  moodGenres?: string[]; // géneros normalizados a favorecer
  minRating?: number;
  maxRuntime?: number; // minutos (noche corta)
  minYear?: number;
  maxYear?: number;
  visualTone?: string; // tono visual inferido de la IA (neón, pastel, etc.)
  note?: string; // frase de la IA, si aplica
}

export interface Pick {
  movie: MovieQueVer;
  score: number;
  reasons: string[];
}

const clampGenres = (m: MovieQueVer) => (m.genres ?? []).map(norm);

/** Puntúa el pool según ánimo/filtros y perfil de gusto. Devuelve ordenado desc. */
export function recommend(
  pool: MovieQueVer[],
  filters: WatchFilters,
  taste: TasteProfile,
  seed = Math.random()
): Pick[] {
  const moodSet = new Set((filters.moodGenres ?? []).map(norm));
  const rnd = mulberry32(Math.floor(seed * 1e9));

  const scored = pool
    .filter((m) => {
      if (filters.maxRuntime && m.durationMin && m.durationMin > filters.maxRuntime) return false;
      if (filters.minYear && (m.year ?? 0) < filters.minYear) return false;
      if (filters.maxYear && (m.year ?? 9999) > filters.maxYear) return false;
      if (filters.minRating && (m.imdbRating ?? 0) < filters.minRating) return false;
      // Si el filtro exige un tono visual y la peli lo tiene, deben coincidir.
      // (Si la peli no tiene tono visual extraído, no la filtramos para no vaciar la lista).
      if (filters.visualTone && m.visualTone && norm(m.visualTone) !== norm(filters.visualTone)) return false;
      return true;
    })
    .map((m) => {
      const g = clampGenres(m);
      const imdb = (m.imdbRating ?? 5) / 10;

      // Solape con el ánimo.
      const moodHits = moodSet.size ? g.filter((x) => moodSet.has(x)).length : 0;
      const moodOverlap = moodSet.size ? moodHits / Math.max(1, g.length) : 0.5;

      // Bonus si el tono visual coincide.
      const visualBonus = (filters.visualTone && m.visualTone && norm(m.visualTone) === norm(filters.visualTone)) ? 0.2 : 0;

      // Afinidad de gusto (géneros + mejor director).
      const gAff = g.length ? g.map((x) => taste.genres[x] ?? 0.5).reduce((a, b) => a + b, 0) / g.length : 0.5;
      let dirAff = 0;
      let bestDir: { name: string; avg: number } | null = null;
      for (const d of m.directors ?? []) {
        const t = taste.directors[d];
        if (t && t.avg / 10 > dirAff) { dirAff = t.avg / 10; bestDir = { name: d, avg: t.avg }; }
      }
      const tasteAff = Math.max(gAff, dirAff * 0.9);

      const progresoBoost = m.status === "en_progreso" ? 0.15 : 0;
      const score = 0.35 * imdb + 0.3 * moodOverlap + 0.25 * tasteAff + 0.1 * rnd() + progresoBoost + visualBonus;

      // Razones (las 3 que más pesan).
      const reasons: string[] = [];
      if (m.status === "en_progreso") reasons.push("La tienes empezada");
      if (filters.visualTone && m.visualTone && norm(m.visualTone) === norm(filters.visualTone)) {
        reasons.push(`Visualmente ${m.visualTone}`);
      }
      if (moodSet.size && moodHits) {
        const hit = g.find((x) => moodSet.has(x));
        reasons.push(`Encaja con lo que buscas${hit ? ` (${cap(hit)})` : ""}`);
      }
      if (filters.maxRuntime && m.durationMin) reasons.push(`Dura ${m.durationMin} min · noche corta`);
      if (bestDir && bestDir.avg >= 8) reasons.push(`Dirige ${bestDir.name}, que puntúas ${bestDir.avg}`);
      else if ((m.imdbRating ?? 0) >= 7.5) reasons.push(`Nota IMDb ${m.imdbRating}`);
      if (reasons.length === 0 && gAff > 0.6 && g[0]) reasons.push(`Te suele gustar el ${cap(g[0])}`);

      return { movie: m, score, reasons: reasons.slice(0, 3) };
    });

  return scored.sort((a, b) => b.score - a.score);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Vocabulario de géneros (para la interpretación por IA) ──────────────────
// Token canónico → variantes es/en que aparecen en la base (normalizadas).
const GENRE_CLUSTERS: Record<string, string[]> = {
  drama: ["drama"],
  romance: ["romance"],
  accion: ["accion", "action"],
  aventura: ["aventura", "adventure"],
  comedia: ["comedia", "comedy"],
  suspense: ["suspense", "thriller"],
  "ciencia ficcion": ["ciencia ficcion", "sci-fi"],
  animacion: ["animacion", "animation"],
  terror: ["terror", "horror"],
  fantasia: ["fantasia", "fantasy"],
  misterio: ["misterio", "mystery"],
  familia: ["familia", "family"],
  crimen: ["crimen", "crime"],
  historia: ["historia", "history"],
  musica: ["musica", "music"],
  belica: ["belica", "war"],
  documental: ["documental", "documentary"],
  western: ["western"],
  biografia: ["biografia", "biography"],
};

/** Lista de tokens canónicos que la IA puede devolver (enum del schema). */
export const GENRE_VOCAB = Object.keys(GENRE_CLUSTERS);

/** Expande tokens canónicos a todas sus variantes es/en (para el matching). */
export function expandGenres(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    const k = norm(t);
    for (const v of GENRE_CLUSTERS[k] ?? [k]) out.add(v);
  }
  return [...out];
}

// PRNG determinista sembrable (para que "otra" re-baraje de forma estable por seed).
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
