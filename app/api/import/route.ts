import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTmdbMovieByImdbId, parseTmdbMovie } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

// Ejecuta fn sobre items con como mucho `limit` llamadas en vuelo. TMDB admite
// bastante concurrencia, pero sin pool una importación de 500 películas lanza
// 500 peticiones a la vez y empiezan a saltar 429.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

// Importación masiva desde las exportaciones de IMDb (ver components/movies/import-table.tsx).
// Cada fila trae el imdbId, los datos personales (puntuación/fecha/crítica) y un
// objeto `fallback` con los datos básicos del CSV por si hacen falta.
const ImportRowSchema = z.object({
  imdbId:        z.string().regex(/^tt\d+$/, "Formato IMDb ID inválido"),
  myRating:      z.number().min(0).max(10),
  watchedAt:     z.string(),
  hasImdbReview: z.boolean(),
  fallback: z.object({
    title:         z.string(),
    originalTitle: z.string(),
    year:          z.number(),
    imdbRating:    z.number(),
    runtimeMins:   z.number(),
    genres:        z.array(z.string()),
    directors:     z.array(z.string()),
    imdbVotes:     z.number(),
  }),
});

const ImportBodySchema = z.object({
  movies: z.array(ImportRowSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ImportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { movies } = parsed.data;
  const errors: { imdbId: string; error: string }[] = [];

  // Deduplica contra la base de datos de una sola vez: las que ya existen cuentan como saltadas.
  const existing = await db.movie.findMany({
    where:   { imdbId: { in: movies.map((m) => m.imdbId) } },
    select:  { imdbId: true },
  });
  const existingIds = new Set(existing.map((m) => m.imdbId));

  const pending = movies.filter((m) => !existingIds.has(m.imdbId));
  const skipped = movies.length - pending.length;

  // Cada fila se enriquece con TMDB (find por imdbId): el CSV no trae carátula
  // ni sinopsis, y TMDB sí. Si la API falla o no tiene la película, se importa
  // igual con los datos del CSV y los campos extras a null; la fila no se pierde.
  const rows = await mapPool(pending, 5, async (m) => {
    const { fallback } = m;
    const watchedAt = m.watchedAt || null;
    const vista = !!(watchedAt || m.myRating > 0);

    let extra: ReturnType<typeof parseTmdbMovie> | null = null;
    try {
      const tmdb = await getTmdbMovieByImdbId(m.imdbId);
      if (tmdb) extra = parseTmdbMovie(tmdb);
    } catch {
      // Sin enriquecer: la importación no debe tumbar la fila entera.
    }

    // El CSV usa 0 como "sin dato": se convierte a null para no guardar ceros.
    // Los datos del CSV mandan sobre TMDB; TMDB solo rellena lo que falta.
    // Ojo: los ratings de TMDB no se copian a imdbRating/imdbVotes, son
    // votaciones distintas y mezclarlas corrompería la media de IMDb.
    return {
      imdbId:        m.imdbId,
      title:         fallback.title || m.imdbId,
      originalTitle: fallback.originalTitle || extra?.originalTitle || null,
      year:          fallback.year >= 1880 ? fallback.year : extra?.year ?? null,
      durationMin:   fallback.runtimeMins > 0 ? fallback.runtimeMins : extra?.durationMin ?? null,
      genres:        JSON.stringify(fallback.genres.length ? fallback.genres : extra?.genres ?? []),
      directors:     JSON.stringify(fallback.directors.length ? fallback.directors : extra?.directors ?? []),
      cast:          JSON.stringify(extra?.cast ?? []),
      plot:          extra?.plot ?? null,
      posterUrl:     extra?.posterUrl ?? null,
      country:       extra?.country ?? null,
      language:      extra?.language ?? null,
      trailerKey:    extra?.trailer ?? null,
      imdbRating:    fallback.imdbRating > 0 ? fallback.imdbRating : null,
      imdbVotes:     fallback.imdbVotes > 0 ? fallback.imdbVotes : null,
      myRating:      m.myRating > 0 ? m.myRating : null,
      watchedAt:     watchedAt ? new Date(watchedAt) : null,
      hasImdbReview: m.hasImdbReview,
      status:        vista ? "vista" : "pendiente",
      importedFromImdb: true,
    };
  });

  try {
    const result = await db.movie.createMany({ data: rows });
    return NextResponse.json({ imported: result.count, skipped, errors });
  } catch (err) {
    console.error("Error importando películas:", err);
    return NextResponse.json({ error: "Error al importar las películas" }, { status: 500 });
  }
}
