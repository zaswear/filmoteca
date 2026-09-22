import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseMovie } from "@/lib/types";
import { MovieForm } from "@/components/movies/movie-form";
import type { MovieCreateInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie  = await db.movie.findUnique({ where: { id: parseInt(id) } });
  return { title: movie ? `Editar · ${movie.title}` : "Editar" };
}

export default async function EditMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) notFound();

  const raw = await db.movie.findUnique({
    where: { id },
    include: {
      images:      { orderBy: { createdAt: "asc" } },
      collections: true,
    },
  });
  if (!raw) notFound();

  const movie = parseMovie(raw);

  const initial: Partial<MovieCreateInput> = {
    imdbId:          movie.imdbId,
    title:           movie.title,
    originalTitle:   movie.originalTitle ?? null,
    year:            movie.year ?? null,
    durationMin:     movie.durationMin ?? null,
    genres:          movie.genres,
    directors:       movie.directors,
    cast:            movie.cast,
    plot:            movie.plot ?? null,
    posterUrl:       movie.posterUrl ?? null,
    imdbRating:      movie.imdbRating ?? null,
    imdbVotes:       movie.imdbVotes ?? null,
    country:         movie.country ?? null,
    language:        movie.language ?? null,
    rated:           movie.rated ?? null,
    myRating:        movie.myRating ?? null,
    watchedAt:       movie.watchedAt ? (movie.watchedAt as Date).toISOString() : null,
    watchFormat:     movie.watchFormat ?? null,
    review:          movie.review ?? null,
    hasImdbReview:   movie.hasImdbReview,
    notes:           movie.notes ?? null,
    status:          movie.status,
    importedFromImdb: movie.importedFromImdb,
    collections:     raw.collections.map(({ name }) => name),
  };

  return (
    <div>
      <MovieForm
        mode="edit"
        movieId={id}
        initial={initial}
        initialImages={raw.images}
      />
    </div>
  );
}
