import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { searchTmdb, posterUrl } from "@/lib/tmdb";
import { ahoraEnNL, carteleraVigente, CARTELERA_TAG, type PeliculaCartelera } from "@/lib/cartelera-vigente";

export const dynamic = 'force-dynamic';

// La cartelera solo cambia cuando corre el scraper (3 veces por semana), así
// que no hace falta ir a la DB en cada visita: se lee una vez, se guarda en la
// Data Cache y el workflow la invalida al terminar. El día de margen es solo
// una red por si esa invalidación fallara.
//
// Dentro de la caché va todo lo que dejó el scrape, sin filtrar por fecha ni
// ciudad: el recorte depende de la hora actual y se hace en cada petición.
const leerCartelera = unstable_cache(
  async (): Promise<PeliculaCartelera[]> => {
    const movies = await db.cinemaMovie.findMany({
      where: { showtimes: { some: {} } },
      include: { showtimes: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
      orderBy: { title: "asc" },
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

    return movies.map((m) => ({
      id: m.id,
      title: m.title,
      url: m.url,
      posterUrl: m.posterUrl,
      showtimes: m.showtimes.map((st) => ({
        id: st.id,
        cinemaName: st.cinemaName,
        city: st.city,
        startTime: st.startTime,
        // `date` es @db.Date: llega a medianoche UTC, así que el prefijo ISO
        // es exactamente el día guardado por el scraper.
        date: st.date.toISOString().slice(0, 10),
        ticketUrl: st.ticketUrl,
      })),
    }));
  },
  ["cartelera-v1"],
  { tags: [CARTELERA_TAG], revalidate: 60 * 60 * 24 },
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Sin ciudad no se inventa una: se devuelven los pases de todas. Con una
    // ciudad por defecto escrita aquí, una instancia montada en otro sitio veía
    // una cartelera vacía sin explicación.
    const city = searchParams.get("city")?.trim() || null;

    const movies = carteleraVigente(await leerCartelera(), ahoraEnNL(), city);
    return NextResponse.json({ success: true, movies });
  } catch (error) {
    console.error("Error fetching cartelera:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
