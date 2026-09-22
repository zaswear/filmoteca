import { db } from "@/lib/db";
import { parseMovie } from "@/lib/types";
import { MoviesList } from "@/components/movies/movies-list";
import type { MovieItem } from "@/lib/movie-item";
import { orderByFor, pageSizeFor, parseFilters, whereFor } from "@/lib/movie-query";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diario" };

// Sin `select`, `findMany` traía también plot/review/notes por fila: páginas de
// HTML por película que el cliente nunca usa. Solo los campos de MovieItem.
const CAMPOS = {
  id: true, imdbId: true, title: true, originalTitle: true, year: true,
  durationMin: true, genres: true, directors: true, cast: true, posterUrl: true,
  imdbRating: true, imdbVotes: true, myRating: true, watchedAt: true,
  watchFormat: true, status: true, hasImdbReview: true, importedFromImdb: true,
  createdAt: true,
} as const;

/**
 * Filtrar, ordenar y paginar en la consulta, no en el navegador.
 *
 * Antes esta página traía las 311 películas no descartadas, las serializaba
 * enteras y el componente hacía el trabajo en memoria: 300 KB de HTML para
 * enseñar veinticuatro carteles, y subiendo con cada película que registras.
 * Los índices de `status`, `watchedAt`, `myRating` y `year` ya estaban puestos
 * en el schema esperando a que alguien los usara.
 *
 * Las listas de géneros y años de los desplegables sí necesitan mirar todo el
 * catálogo, pero piden solo esas dos columnas.
 */
export default async function PeliculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") sp.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) sp.set(k, v[0]);
  }

  const filters = parseFilters(sp);
  const where = whereFor(filters);
  const porPagina = pageSizeFor(filters);

  const [total, raw, facetas] = await Promise.all([
    db.movie.count({ where }),
    db.movie.findMany({
      where,
      orderBy: orderByFor(filters),
      skip: (filters.page - 1) * porPagina,
      take: porPagina,
      select: CAMPOS,
    }),
    db.movie.findMany({
      where: { status: { not: "descartada" } },
      select: { genres: true, year: true },
    }),
  ]);

  const generos = new Set<string>();
  const anios = new Set<number>();
  for (const f of facetas) {
    for (const g of JSON.parse(f.genres || "[]") as string[]) generos.add(g);
    if (f.year) anios.add(f.year);
  }

  const movies: MovieItem[] = raw.map((m) => {
    const p = parseMovie(m);
    return {
      id: p.id, imdbId: p.imdbId, title: p.title,
      originalTitle: p.originalTitle ?? null,
      year: p.year ?? null,
      durationMin: p.durationMin ?? null,
      genres: p.genres, directors: p.directors, cast: p.cast,
      posterUrl: p.posterUrl ?? null,
      imdbRating: p.imdbRating ?? null,
      imdbVotes: p.imdbVotes ?? null,
      myRating: p.myRating ?? null,
      watchedAt: p.watchedAt ? (p.watchedAt as Date).toISOString() : null,
      watchFormat: p.watchFormat ?? null,
      status: p.status,
      hasImdbReview: p.hasImdbReview,
      importedFromImdb: p.importedFromImdb,
      createdAt: (p.createdAt as Date).toISOString(),
    };
  });

  return (
    <div className="flex flex-col h-full">
      <MoviesList
        movies={movies}
        total={total}
        generos={[...generos].sort()}
        anios={[...anios].sort((a, b) => b - a)}
      />
    </div>
  );
}
