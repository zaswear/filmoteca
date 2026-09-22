import Link from "next/link";
import Image from "next/image";
import { Plus, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { parseMovie } from "@/lib/types";
import { WatchlistList } from "@/components/movies/watchlist-list";
import { BackLink } from "@/components/ui/back-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pendientes" };

const fmtRelease = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default async function WatchlistPage() {
  // Sin `select` venía también la sinopsis de cada pendiente: 433 KB de HTML
  // para 74 películas, casi todo texto que esta lista no pinta. `review` y
  // `notes` sí se piden, que los precarga el modal de «marcar como vista».
  const raw = await db.movie.findMany({
    where: { status: "pendiente" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, imdbId: true, title: true, originalTitle: true, year: true,
      durationMin: true, genres: true, directors: true, cast: true,
      posterUrl: true, imdbRating: true, imdbVotes: true, myRating: true,
      watchedAt: true, watchFormat: true, status: true, hasImdbReview: true,
      importedFromImdb: true, createdAt: true, updatedAt: true,
      releaseDate: true, country: true, language: true, rated: true,
      trailerKey: true, visualTone: true, review: true, notes: true,
    },
  });

  const all = raw.map((m) => parseMovie(m));
  // Server component: se renderiza una vez por request, Date.now() es estable aquí.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  // Estrenos futuros: aún no se pueden ver → sección propia, ordenada por fecha.
  const upcoming = all
    .filter((m) => m.releaseDate && new Date(m.releaseDate).getTime() > now)
    .sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime());
  const upcomingIds = new Set(upcoming.map((m) => m.id));
  const movies = all.filter((m) => !upcomingIds.has(m.id));

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-(--border) pb-6">
        <div>
          <div className="mb-3">
            <BackLink />
          </div>
          <h1 className="font-display font-semibold text-[38px] italic leading-none text-text">
            Lista de pendientes
          </h1>
          <p className="text-xs text-text-faint font-mono mt-2">
            Películas marcadas para ver en el futuro
          </p>
        </div>
        <Link
          href="/peliculas/nueva"
          className="flex items-center gap-1.5 px-4 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors"
        >
          <Plus size={14} /> Nueva película
        </Link>
      </div>

      {/* Próximamente: estrenos aún no disponibles */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[22px] italic text-text">
            <CalendarClock size={18} className="text-(--accent)" aria-hidden="true" /> Próximamente
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/peliculas/${m.id}`}
                  className="flex items-center gap-3 rounded-[8px] border border-(--border) bg-(--surface) p-2.5 transition-colors hover:border-(--border-hi)"
                >
                  <div className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded bg-bg">
                    {m.posterUrl && <Image src={m.posterUrl} alt="" fill sizes="44px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold italic text-[15px] leading-tight text-text">{m.title}</p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-(--accent-dim) px-2 py-0.5 font-mono text-[10px] text-(--accent)">
                      <CalendarClock size={11} aria-hidden="true" /> se estrena el {fmtRelease(new Date(m.releaseDate!))}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Listado de pendientes interactivo */}
      <WatchlistList initialMovies={movies} />
    </div>
  );
}
