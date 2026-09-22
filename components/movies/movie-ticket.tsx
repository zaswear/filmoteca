import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { MOVIE_STATUS_LABELS, WATCH_FORMAT_LABELS, type MovieParsed } from "@/lib/types";
import { PosterTilt } from "@/components/movies/poster-tilt";
import { TicketCode } from "@/components/ui/ticket-code";

/**
 * La cabecera de la ficha es una entrada de cine: mismo motivo que la marca
 * (logo «full»). El cuerpo lleva los datos impresos como campos de la
 * entrada; el talón, separado por la línea de corte discontinua del logo,
 * lleva el código del resguardo reutilizado y el número de entrada. El cartel
 * sigue siendo protagonista: conserva su viewTransitionName (continuidad con
 * el diario) y el tilt del puntero, con un ancho fijo por breakpoint para que
 * la entrada se quede siempre con el resto del ancho.
 */
export function MovieTicket({ movie, id }: { movie: MovieParsed; id: number }) {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-10 mb-12">

      {/* Cartel — ancho fijo por breakpoint. No se mide la altura de la
          entrada para calcularlo: al ser hermanos de un flex row, cartel más
          ancho = entrada más estrecha = entrada más alta = cartel más ancho,
          y el ResizeObserver realimentaba hasta dejar la entrada en una
          columna ilegible. */}
      <div className="relative shrink-0 self-start w-[240px] sm:w-[280px] md:w-[260px] lg:w-[300px] max-w-full mx-auto md:mx-0 aspect-2/3">
        {movie.posterUrl ? (
          <PosterTilt className="h-full w-full">
            <div
              className="relative h-full w-full rounded-md overflow-hidden poster-glow-hover shadow-(--shadow-poster)"
              style={{ viewTransitionName: `dc-poster-${id}` }}
            >
              <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 768px) 280px, 300px" priority className="object-cover animate-poster-in" />
            </div>
          </PosterTilt>
        ) : (
          <div className="h-full w-full rounded-md bg-(--surface) border border-(--border) flex items-center justify-center p-4">
            <span className="font-display text-center italic text-text-faint text-lg leading-tight">
              {movie.title}
            </span>
          </div>
        )}
      </div>

      {/* Entrada */}
      <section className="ticket flex-1 min-w-0" aria-label={`Entrada de ${movie.title}`}>
        <div className="flex flex-col sm:flex-row">

          {/* Cuerpo: los datos impresos como campos de la entrada */}
          <div className="flex-1 min-w-0 px-5 pt-4 pb-5 sm:px-7 sm:pt-5 sm:pb-7">
            {/* Microimpresión de archivo, como la parte superior de un ticket */}
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint pb-2.5 mb-4 border-b border-(--border) flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span>Director&rsquo;s Cut · Diario cinematográfico</span>
              <span>Entrada nº {String(id).padStart(4, "0")}</span>
            </p>

            {/* Título — la marquesina de la entrada */}
            <h1 className="font-display text-[34px] sm:text-[44px] leading-[1.02] text-text mb-1.5">
              {movie.title}
            </h1>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-text-faint text-sm mb-4">{movie.originalTitle}</p>
            )}

            {/* Campos impresos: año · duración · género, como el metadata del resto de la app */}
            {(movie.year || movie.durationMin) && (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-mid mb-1.5">
                {movie.year && <span>{movie.year}</span>}
                {movie.year && movie.durationMin && <span className="text-text-faint"> · </span>}
                {movie.durationMin && <span>{movie.durationMin} min</span>}
              </p>
            )}
            {movie.genres.length > 0 && (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-mid mb-1.5">
                {movie.genres.join(" · ")}
              </p>
            )}
            {!movie.year && !movie.durationMin && movie.genres.length === 0 && (
              <p className="font-mono text-[11px] text-text-faint mb-1.5">Ficha sin datos de catalogación</p>
            )}
            {movie.directors.length > 0 && (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text mb-5">
                Dir. {movie.directors.join(", ")}
              </p>
            )}

            {/* Notas: la mía grande, la de IMDb como sello «★ IMDb 7,7» en bermellón */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-5">
              {movie.myRating != null && (
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[38px] leading-none text-(--accent)">
                    {String(movie.myRating).replace(".", ",")}
                  </span>
                  <span className="text-[13px] text-text-faint">/ 10</span>
                </div>
              )}
              {movie.imdbRating != null && (
                <span className="font-mono text-sm font-semibold text-(--accent)">
                  ★ IMDb {String(movie.imdbRating).replace(".", ",")}
                </span>
              )}
            </div>

            {/* Estado / etiquetas */}
            <div className="flex flex-wrap gap-2 mb-6">
              {movie.status && (
                <span className={`badge-status badge-status--${movie.status}`}>
                  {MOVIE_STATUS_LABELS[movie.status]}
                </span>
              )}
              {movie.hasImdbReview && (
                <span className="text-[11px] px-2.5 py-1 rounded-sm bg-(--surface-hi) text-text-mid">
                  Crítica en IMDb
                </span>
              )}
            </div>

            {/* Detalle de la entrada */}
            <dl className="space-y-2.5 text-sm border-t border-dashed border-(--border) pt-5">
              {movie.cast.length > 0 && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">Reparto</dt>
                  <dd className="text-text-mid">{movie.cast.slice(0, 5).join(", ")}{movie.cast.length > 5 ? "…" : ""}</dd>
                </div>
              )}
              {movie.country && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">País</dt>
                  <dd className="text-text-mid">{movie.country}</dd>
                </div>
              )}
              {movie.language && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">Idioma</dt>
                  <dd className="text-text-mid">{movie.language}</dd>
                </div>
              )}
              {movie.rated && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">Clasificación</dt>
                  <dd className="font-mono text-text-mid">{movie.rated}</dd>
                </div>
              )}
              {movie.watchedAt && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">Vista el</dt>
                  <dd className="font-mono text-text">
                    {new Date(movie.watchedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    {movie.watchFormat && (
                      <span className="ml-2.5 inline-flex items-center">
                        <span className={`watch-badge watch-badge-${movie.watchFormat}`}>
                          {WATCH_FORMAT_LABELS[movie.watchFormat]}
                        </span>
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {movie.imdbId && (
                <div className="flex gap-3">
                  <dt className="text-text-faint w-24 shrink-0 text-[11px] uppercase tracking-wider font-medium">IMDb</dt>
                  <dd>
                    <a
                      href={`https://www.imdb.com/title/${movie.imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-(--accent) hover:underline flex items-center gap-1"
                    >
                      {movie.imdbId} <ExternalLink size={11} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Talón: código del resguardo (el QR de la marca) y número de serie */}
          <div className="ticket-stub flex flex-row sm:flex-col items-center justify-center gap-4 sm:gap-3 px-5 py-4 sm:py-7 sm:px-6 border-t sm:border-t-0 sm:border-l">
            <TicketCode size={58} />
            <div className="sm:text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">
                Nº {String(id).padStart(4, "0")}
              </p>
              {movie.imdbId && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">
                  {movie.imdbId}
                </p>
              )}
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-(--accent) mt-1">
                Admite una entrada
              </p>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
