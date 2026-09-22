import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MovieCreateSchema, MOVIE_STATUSES } from "@/lib/schemas";
import { getTmdbMovieByImdbId, parseTmdbMovie } from "@/lib/tmdb";

// La URL es entrada de usuario: valores fuera de la whitelist se ignoran
// (orden por defecto / sin filtro de estado), nunca llegan crudos a Prisma.
const SORTABLE_FIELDS = ["title", "year", "watchedAt", "myRating", "imdbRating", "createdAt"] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const rawStatus = searchParams.get("status");
  const rawOrderBy = searchParams.get("orderBy") ?? "createdAt";
  const status  = rawStatus && (MOVIE_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : undefined;
  const orderBy = (SORTABLE_FIELDS as readonly string[]).includes(rawOrderBy) ? rawOrderBy : "createdAt";
  const order   = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "24")));
  const skip    = (page - 1) * limit;

  const where = {
    ...(status ? { status } : { status: { not: "descartada" } }),
  };

  const [movies, total] = await Promise.all([
    db.movie.findMany({
      where,
      orderBy: { [orderBy]: order },
      take: limit,
      skip,
      include: { _count: { select: { images: true } } },
    }),
    db.movie.count({ where }),
  ]);

  return NextResponse.json({ movies, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = MovieCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { genres, directors, cast, watchedAt, collections, ...data } = parsed.data;

  // Comprueba deduplicación
  const existing = await db.movie.findUnique({ where: { imdbId: data.imdbId } });
  if (existing) {
    return NextResponse.json(
      { error: "Esta película ya está en tu base de datos", id: existing.id },
      { status: 409 }
    );
  }

  let finalTrailerKey = data.trailerKey;
  let finalDirectors = directors;
  let finalCast = cast;
  let finalPlot = data.plot;
  let finalDurationMin = data.durationMin;

  if (!finalTrailerKey || finalDirectors.length === 0 || finalCast.length === 0 || !finalPlot || !finalDurationMin) {
    try {
      const tmdbMovie = await getTmdbMovieByImdbId(data.imdbId);
      if (tmdbMovie) {
        const parsedTmdb = parseTmdbMovie(tmdbMovie);
        if (!finalTrailerKey && parsedTmdb.trailer) {
          finalTrailerKey = parsedTmdb.trailer;
        }
        if (finalDirectors.length === 0 && parsedTmdb.directors?.length > 0) {
          finalDirectors = parsedTmdb.directors;
        }
        if (finalCast.length === 0 && parsedTmdb.cast?.length > 0) {
          finalCast = parsedTmdb.cast;
        }
        if (!finalPlot && parsedTmdb.plot) {
          finalPlot = parsedTmdb.plot;
        }
        if (!finalDurationMin && parsedTmdb.durationMin) {
          finalDurationMin = parsedTmdb.durationMin;
        }
      }
    } catch (err) {
      console.error("Error auto-enriching movie from TMDB:", err);
    }
  }

  const movie = await db.movie.create({
    data: {
      ...data,
      trailerKey: finalTrailerKey || null,
      plot: finalPlot,
      durationMin: finalDurationMin,
      genres:    JSON.stringify(genres),
      directors: JSON.stringify(finalDirectors),
      cast:      JSON.stringify(finalCast),
      watchedAt: watchedAt ? new Date(watchedAt) : null,
      collections: {
        connectOrCreate: collections.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
    include: { images: true, collections: true },
  });

  return NextResponse.json(movie, { status: 201 });
}
