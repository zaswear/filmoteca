import { canonicalGenres } from "./genres";

import { TMDB_LANGUAGE, LOCALE } from "./i18n.ts";
const BASE  = "https://api.themoviedb.org/3";
const IMG   = "https://image.tmdb.org/t/p";

function token() {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) throw new Error("TMDB_ACCESS_TOKEN no configurado");
  return t;
}

function headers() {
  return { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TmdbSearchResult {
  id:             number;
  title:          string;
  original_title: string;
  release_date:   string;
  poster_path:    string | null;
  vote_average:   number;
  vote_count:     number;
}

interface TmdbCrew   { job: string; name: string; }
interface TmdbCast   { name: string; order: number; }
interface TmdbGenre  { id: number; name: string; }
interface TmdbVideo  { key: string; site: string; type: string; }

export interface TmdbMovie {
  id:               number;
  imdb_id:          string | null;
  title:            string;
  original_title:   string;
  overview:         string | null;
  release_date:     string | null;
  runtime:          number | null;
  genres:           TmdbGenre[];
  poster_path:      string | null;
  vote_average:     number;
  vote_count:       number;
  origin_country:   string[];
  original_language: string;
  credits?: { crew: TmdbCrew[]; cast: TmdbCast[] };
  videos?:  { results: TmdbVideo[] };
}

// ─── Poster URL ───────────────────────────────────────────────────────────────

export function posterUrl(path: string | null, size = "w500"): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function searchTmdb(
  query: string,
  year?: string
): Promise<TmdbSearchResult[]> {
  const params = new URLSearchParams({ query, language: TMDB_LANGUAGE, include_adult: "false" });
  if (year) params.set("year", year);
  const res = await fetch(`${BASE}/search/movie?${params}`, {
    headers: headers(),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as TmdbSearchResult[];
}

export async function getTmdbById(tmdbId: number): Promise<TmdbMovie | null> {
  const res = await fetch(
    `${BASE}/movie/${tmdbId}?language=${TMDB_LANGUAGE}&append_to_response=credits,videos&include_video_language=${LOCALE},en,null`,
    { headers: headers(), next: { revalidate: 86400 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  return res.json();
}

// ─── Parseo ───────────────────────────────────────────────────────────────────

export function parseTmdbMovie(m: TmdbMovie) {
  const directors = (m.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => c.name);

  const cast = (m.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.name);

  const trailer = (m.videos?.results ?? [])
    .find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ?? null;

  const year = m.release_date ? parseInt(m.release_date.slice(0, 4)) : null;

  return {
    imdbId:      m.imdb_id ?? `tmdb-${m.id}`,
    title:       m.title,
    originalTitle: m.original_title !== m.title ? m.original_title : null,
    year,
    durationMin: m.runtime ?? null,
    genres:      canonicalGenres(m.genres?.map((g) => g.name) ?? []),
    directors,
    cast,
    plot:        m.overview || null,
    posterUrl:   posterUrl(m.poster_path, "w500"),
    imdbRating:  m.vote_average > 0 ? Math.round(m.vote_average * 10) / 10 : null,
    imdbVotes:   m.vote_count > 0 ? m.vote_count : null,
    country:     m.origin_country?.[0] ?? null,
    language:    m.original_language ?? null,
    rated:       null,
    trailer,
  };
}

export async function getTmdbMovieByImdbId(imdbId: string): Promise<TmdbMovie | null> {
  try {
    const params = new URLSearchParams({ external_source: "imdb_id", language: TMDB_LANGUAGE });
    const res = await fetch(`${BASE}/find/${imdbId}?${params}`, {
      headers: headers(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const movie = data.movie_results?.[0];
    if (!movie) return null;
    return getTmdbById(movie.id);
  } catch (error) {
    console.error("Error fetching TMDB movie by IMDb ID:", error);
    return null;
  }
}

