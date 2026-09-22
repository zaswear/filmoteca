import { canonicalGenres } from "./genres";

const OMDB_BASE = "https://www.omdbapi.com";

function apiKey() {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error("OMDB_API_KEY no configurada");
  return key;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface OmdbSearchResult {
  imdbID: string;
  Title:  string;
  Year:   string;
  Poster: string;
  Type:   string;
}

export interface OmdbMovie {
  imdbID:     string;
  Title:      string;
  Year:       string;
  Runtime:    string;
  Genre:      string;
  Director:   string;
  Actors:     string;
  Plot:       string;
  Poster:     string;
  imdbRating: string;
  imdbVotes:  string;
  Country:    string;
  Language:   string;
  Rated:      string;
  Response:   string;
  Error?:     string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

/** Busca películas por título, con año opcional. Resultados cacheados 24 h. */
export async function searchOmdb(query: string, year?: string): Promise<OmdbSearchResult[]> {
  const params = new URLSearchParams({
    apikey: apiKey(),
    s:      query,
    type:   "movie",
    ...(year ? { y: year } : {}),
  });
  const url = `${OMDB_BASE}/?${params}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`OMDb error ${res.status}`);
  const data = await res.json();
  if (data.Response === "False") return [];
  return (data.Search ?? []) as OmdbSearchResult[];
}

/** Obtiene ficha completa por IMDb ID. Cacheada 24 h. */
export async function getOmdbById(imdbId: string): Promise<OmdbMovie | null> {
  const url = `${OMDB_BASE}/?apikey=${apiKey()}&i=${imdbId}&plot=full`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`OMDb error ${res.status}`);
  const data: OmdbMovie = await res.json();
  if (data.Response === "False") return null;
  return data;
}

// ─── Parseo ──────────────────────────────────────────────────────────────────

function clean(value: string | undefined): string | null {
  return !value || value === "N/A" ? null : value;
}

/**
 * Convierte un OmdbMovie a los campos que guardamos en DB.
 * Arrays devueltos como string[] listos para JSON.stringify().
 */
export function parseOmdbMovie(m: OmdbMovie) {
  return {
    imdbId:       m.imdbID,
    title:        m.Title,
    year:         parseInt(m.Year) || null,
    durationMin:  parseInt(m.Runtime) || null,
    // OMDb no localiza: llegan en inglés. Se canonizan a español para que no
    // convivan "Action" y "Acción" como dos géneros distintos.
    genres:       clean(m.Genre)    ? canonicalGenres(m.Genre.split(", ")) : [] as string[],
    directors:    clean(m.Director) ? m.Director.split(", ") : [] as string[],
    cast:         clean(m.Actors)   ? m.Actors.split(", ").slice(0, 5) : [] as string[],
    plot:         clean(m.Plot),
    posterUrl:    clean(m.Poster),
    imdbRating:   clean(m.imdbRating) ? parseFloat(m.imdbRating) : null,
    imdbVotes:    clean(m.imdbVotes)  ? parseInt(m.imdbVotes.replace(/,/g, "")) : null,
    country:      clean(m.Country),
    language:     clean(m.Language),
    rated:        clean(m.Rated),
  };
}
