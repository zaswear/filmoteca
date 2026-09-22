import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchTmdb, posterUrl } from "@/lib/tmdb";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Sin ciudad no se inventa una: se devuelven los pases de todas. Con una
    // ciudad por defecto escrita aquí, una instancia montada en otro sitio veía
    // una cartelera vacía sin explicación.
    const city = searchParams.get("city")?.trim() || null;

    // Obtenemos la fecha de hoy, estableciendo la hora a 00:00:00 para la búsqueda en DB
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscamos películas que tengan algún pase programado para hoy o el futuro,
    // y las retornamos junto a esos horarios.
    const movies = await db.cinemaMovie.findMany({
      where: {
        showtimes: {
          some: {
            ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
            date: {
              gte: today,
            }
          }
        }
      },
      include: {
        showtimes: {
          where: {
            ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
            date: {
              gte: today,
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      },
      orderBy: {
        title: 'asc'
      }
    });

    // Backfill perezoso de pósters desde TMDB (misma fuente que el resto de la app):
    // para películas sin poster, buscamos por título, guardamos en DB y lo devolvemos.
    // Best-effort: los fallos de TMDB por película no rompen la respuesta.
    const sinPoster = movies.filter((m) => !m.posterUrl);
    if (sinPoster.length > 0) {
      await Promise.allSettled(
        sinPoster.map(async (m) => {
          const results = await searchTmdb(m.title);
          const p = posterUrl(results[0]?.poster_path ?? null);
          if (p) {
            await db.cinemaMovie.update({ where: { id: m.id }, data: { posterUrl: p } });
            m.posterUrl = p;
          }
        })
      );
    }

    return NextResponse.json({ success: true, movies });
  } catch (error) {
    console.error("Error fetching cartelera:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
