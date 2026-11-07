"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, ChevronDown, Film, MapPin } from "lucide-react";
import { PosterSkeleton } from "@/components/ui/poster-skeleton";

import { t } from "@/lib/i18n";
import { CINEMA_CITIES } from "@/lib/branding";
interface Showtime {
  id: number;
  cinemaName: string;
  city: string;
  startTime: string;
  date: string;
  ticketUrl: string | null;
}

interface CinemaMovie {
  id: number;
  title: string;
  url: string;
  posterUrl: string | null;
  showtimes: Showtime[];
}



export default function CarteleraPage() {
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [selectedCity, setSelectedCity] = useState(CINEMA_CITIES[0] ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCartelera = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/cartelera?city=${encodeURIComponent(selectedCity)}`);
        if (!response.ok) throw new Error(t("cartelera.error"));
        const data = await response.json();
        if (data.success) {
          setMovies(data.movies);
        } else {
          throw new Error(data.error || t("form.errorDesconocido"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchCartelera();
  }, [selectedCity]);

  const groupShowtimes = (showtimes: Showtime[]) => {
    const grouped: Record<string, Showtime[]> = {};
    showtimes.forEach((st) => {
      if (!grouped[st.cinemaName]) grouped[st.cinemaName] = [];
      grouped[st.cinemaName].push(st);
    });
    return grouped;
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl animate-fade-in">
      {/* Cabecera compacta */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[22px] text-text flex items-center gap-2">
          <Film className="w-6 h-6 text-accent" />{t("cartelera.titulo")}</h2>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 overflow-x-auto hide-scrollbar">
          {CINEMA_CITIES.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              aria-pressed={selectedCity === city}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCity === city
                  ? "bg-accent text-white"
                  : "text-text-mid hover:text-text hover:bg-surface-hi"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 sm:gap-y-8"
          role="status"
          aria-label={t("cartelera.cargando")}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <PosterSkeleton key={i} className="rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error text-error p-4 rounded-lg">
          <p className="flex items-center gap-2">
            <span className="font-bold">{t("cartelera.errorPrefijo")}</span> {error}
          </p>
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl border border-border">
          <CalendarDays className="w-14 h-14 text-text-faint mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text mb-1">No hay películas en {selectedCity}</h2>
          <p className="text-text-mid text-sm">{t("cartelera.errorAyuda")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 sm:gap-y-8">
          {movies.map((movie) => {
            const grouped = groupShowtimes(movie.showtimes);

            return (
              <article key={movie.id} className="group flex flex-col">
                {/* Póster protagonista — cartel completo (ratio 2:3) */}
                <a
                  href={movie.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer"
                  aria-label={movie.title}
                >
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={movie.title}
                      width={500}
                      height={750}
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
                      className="w-full aspect-[2/3] object-cover rounded-xl bg-surface-hi ring-1 ring-border shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:ring-accent/60"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] rounded-xl bg-surface-hi ring-1 ring-border grid place-items-center text-text-faint">
                      <Film size={32} />
                    </div>
                  )}
                </a>

                {/* Título */}
                <a
                  href={movie.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 font-display font-semibold text-sm leading-snug text-text hover:text-accent transition-colors line-clamp-2 cursor-pointer"
                >
                  {movie.title}
                </a>

                {/* Horas por cine, plegadas: abiertas tapaban la rejilla de pósters */}
                <details className="group/horas mt-1.5">
                  <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1 min-h-[32px] text-xs font-medium text-text-mid hover:text-accent transition-colors cursor-pointer select-none">
                    <ChevronDown size={14} className="transition-transform group-open/horas:rotate-180" aria-hidden />
                    {t("cartelera.horarios", { n: movie.showtimes.length })}
                  </summary>
                  <div className="mt-1 space-y-1.5">
                    {Object.entries(grouped).map(([cinema, times]) => (
                      <div key={cinema}>
                        <span className="text-[10px] uppercase tracking-wide text-text-faint inline-flex items-center gap-1">
                          <MapPin size={10} />
                          {cinema}
                        </span>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {times.map((st) => (
                            <a
                              key={st.id}
                              href={st.ticketUrl || movie.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 rounded text-xs font-mono text-text-mid bg-surface-hi hover:bg-accent hover:text-white border border-border hover:border-accent transition-colors cursor-pointer"
                              title={t("cartelera.comprar")}
                            >
                              {st.startTime}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
