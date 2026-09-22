// Generación de sugerencias de películas EN RUNTIME (versión rápida de
// scripts/generate-suggestions.js): menos llamadas, en paralelo y sin sleeps,
// para caber en el timeout de la función serverless. Devuelve el array (no
// escribe ficheros: el FS de Vercel es de solo lectura).

const BASE = "https://api.themoviedb.org/3";

function tmdbHeaders() {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) throw new Error("TMDB_ACCESS_TOKEN no configurado");
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

async function tmdb(endpoint: string, params: Record<string, string>) {
  const url = `${BASE}/${endpoint}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: tmdbHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${endpoint}`);
  return res.json();
}

export interface Suggestion {
  tmdbId: number;
  imdbId: string;
  title: string;
  year: number | null;
  rating: number;
  plot: string | null;
  posterUrl: string | null;
  genres: string[];
  trailerKey: string | null;
}

// Países cuyo cine se excluye de las sugerencias (misma política que el script).
const EXCLUDED_COUNTRIES = new Set([
  "IN", "TR", "CN", "HK", "TW", "TH", "VN", "ID", "PH", "SG", "MY", "PK", "BD", "NP",
  "LK", "IR", "IQ", "AF", "AM", "AZ", "BH", "BT", "BN", "KH", "CY", "GE", "JO", "KZ",
  "KP", "KW", "KG", "LA", "LB", "MO", "MV", "MN", "MM", "OM", "PS", "QA", "SA", "SY",
  "TJ", "TL", "TM", "AE", "UZ", "YE",
]);

// Ejecuta `fn` sobre `items` con concurrencia limitada (sin agotar la API ni el timeout).
async function mapPool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

const rndPage = () => String(1 + Math.floor(Math.random() * 20));

export async function generateSuggestions(
  opts: { exclude?: Set<string>; limit?: number } = {},
): Promise<Suggestion[]> {
  const exclude = opts.exclude ?? new Set<string>();
  const target = opts.limit ?? 15;

  // 1. Listas base en paralelo. Más fuentes + páginas muy aleatorias para tener un
  //    pool amplio del que sigan quedando candidatas tras excluir tu colección
  //    (y que cada recarga traiga pelis distintas).
  const lists: { path: string; params: Record<string, string> }[] = [
    { path: "movie/popular", params: { page: rndPage(), language: "es-ES" } },
    { path: "movie/popular", params: { page: rndPage(), language: "es-ES" } },
    { path: "movie/top_rated", params: { page: rndPage(), language: "es-ES" } },
    { path: "movie/top_rated", params: { page: rndPage(), language: "es-ES" } },
    { path: "discover/movie", params: { page: rndPage(), language: "es-ES", sort_by: "vote_average.desc", "vote_count.gte": "300", "primary_release_date.gte": "2000-01-01" } },
    { path: "discover/movie", params: { page: rndPage(), language: "es-ES", sort_by: "popularity.desc", "vote_count.gte": "200" } },
  ];
  const pages = await Promise.all(
    lists.map((l) => tmdb(l.path, l.params).catch(() => ({ results: [] }))),
  );

  const candidates = new Map<number, Omit<Suggestion, "imdbId" | "genres" | "trailerKey">>();
  for (const data of pages) {
    for (const m of data.results || []) {
      const year = m.release_date ? parseInt(m.release_date.slice(0, 4)) : null;
      if (!year || year < 2000) continue;
      if (m.vote_average < 5.0) continue;
      candidates.set(m.id, {
        tmdbId: m.id,
        title: m.title,
        year,
        rating: Math.round(m.vote_average * 10) / 10,
        plot: m.overview || null,
        posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      });
    }
  }

  // 2. Detalles (imdbId, país, géneros, tráiler) en paralelo, acotado
  const shuffled = [...candidates.values()].sort(() => Math.random() - 0.5).slice(0, 40);

  const detailed = await mapPool(shuffled, 8, async (c): Promise<Suggestion | null> => {
    try {
      const d = await tmdb(`movie/${c.tmdbId}`, {
        language: "es-ES",
        append_to_response: "external_ids,videos",
      });
      const imdbId = d.imdb_id || d.external_ids?.imdb_id;
      if (!imdbId || exclude.has(imdbId)) return null;

      const countries = new Set<string>();
      (d.origin_country || []).forEach((x: string) => countries.add(x));
      (d.production_countries || []).forEach((x: { iso_3166_1?: string }) => x.iso_3166_1 && countries.add(x.iso_3166_1));
      for (const co of countries) {
        if (EXCLUDED_COUNTRIES.has(co)) return null;
        if ((co === "JP" || co === "KR") && (d.vote_count || 0) < 500) return null;
      }

      const videos: { type: string; site: string; iso_639_1: string; key: string }[] = d.videos?.results || [];
      const tr =
        videos.find((v) => v.type === "Trailer" && v.site === "YouTube" && v.iso_639_1 === "es") ||
        videos.find((v) => v.type === "Trailer" && v.site === "YouTube") ||
        videos.find((v) => v.site === "YouTube");

      return {
        tmdbId: c.tmdbId,
        imdbId,
        title: c.title,
        year: c.year,
        rating: c.rating,
        plot: d.overview || c.plot,
        posterUrl: c.posterUrl,
        genres: (d.genres || []).map((g: { name: string }) => g.name),
        trailerKey: tr ? tr.key : null,
      };
    } catch {
      return null;
    }
  });

  return detailed.filter((s): s is Suggestion => s !== null).slice(0, target);
}
