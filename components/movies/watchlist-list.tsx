"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Check, Youtube } from "lucide-react";
import { MarkWatchedModal } from "./mark-watched-modal";
import { SeatIcon } from "@/components/ui/seat-icon";
import type { MovieParsed } from "@/lib/types";

/**
 * Una pendiente **sin la sinopsis**, que es el texto largo de verdad y no se
 * pinta en ningún sitio de esta lista. `review` y `notes` sí viajan: el modal
 * de «marcar como vista» los precarga en su formulario, y sin ellos guardaría
 * encima borrando lo que hubiera escrito.
 */
export type PendienteItem = Omit<MovieParsed, "plot">;

interface WatchlistListProps {
  initialMovies: PendienteItem[];
}

export function WatchlistList({ initialMovies }: WatchlistListProps) {
  const [movies, setMovies] = useState<PendienteItem[]>(initialMovies);
  const [activeMovie, setActiveMovie] = useState<PendienteItem | null>(null);
  const [expandedTrailers, setExpandedTrailers] = useState<Record<number, boolean>>({});
  // Tráilers ya abiertos alguna vez: el iframe se monta al primer open y se
  // queda en el DOM (recogido a 0fr) para poder animar también el cierre.
  const [seenTrailers, setSeenTrailers] = useState<number[]>([]);

  // Calcular métricas dinámicamente basadas en el estado actual de pendientes
  const totalCount = movies.length;

  function handleMarkWatchedSuccess(movieId: number) {
    // Eliminar la película de la lista local
    setMovies((prev) => prev.filter((m) => m.id !== movieId));
    setActiveMovie(null);
  }

  const toggleTrailer = (movieId: number) => {
    setExpandedTrailers((prev) => ({
      ...prev,
      [movieId]: !prev[movieId],
    }));
    setSeenTrailers((prev) => (prev.includes(movieId) ? prev : [...prev, movieId]));
  };

  return (
    <div className="space-y-8">
      {/* Resumen Métricas */}
      {totalCount > 0 && (
        <div className="max-w-sm">
          <div className="bg-(--surface) border border-(--border) rounded-xl px-6 py-4 flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-(--accent-dim) text-(--accent) rounded-full">
              <SeatIcon size={20} />
            </div>
            <div>
              <p className="font-mono text-2xl font-bold">{totalCount}</p>
              <p className="text-[11px] uppercase tracking-widest text-text-faint mt-0.5">
                Películas por ver
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Películas */}
      {movies.length === 0 ? (
        <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-xl">
          <Film size={32} className="mx-auto text-text-faint mb-3 opacity-60" />
          <p className="text-text-mid text-sm font-medium">No tienes ninguna película en tu lista de pendientes.</p>
          <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">
            Añade o importa nuevas películas para planificar tus visionados aquí.
          </p>
        </div>
      ) : (
        // Filas densas, no fichas. Esta lista no es para leer sobre las
        // películas —para eso está la ficha completa— sino para repasar el
        // backlog y marcar vistas. Con 64 pendientes, una ficha por película
        // eran 47 pantallas de scroll en móvil.
        // Dos columnas en pantalla ancha: una fila compacta deja medio viewport
        // vacío a 1440px, y con 64 pendientes eso son pantallas de scroll de más.
        <div className="grid grid-cols-1 xl:grid-cols-2 xl:gap-x-10 border-t border-(--border)">
          {movies.map((m) => (
            <div key={m.id} className="border-b border-(--border)">
              <div className="flex items-center gap-3 sm:gap-4 py-3 px-1 hover:bg-(--surface) transition-colors">
                {/* Póster — miniatura: identifica de un vistazo, no decora */}
                <Link href={`/peliculas/${m.id}`} className="relative w-11 sm:w-12 aspect-2/3 rounded overflow-hidden bg-(--surface-hi) shrink-0 border border-(--border)">
                  {m.posterUrl ? (
                    <Image
                      src={m.posterUrl}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-text-faint">
                      <Film size={14} />
                    </span>
                  )}
                </Link>

                {/* Título + dirección */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/peliculas/${m.id}`}
                    className="font-display font-semibold italic text-base sm:text-lg text-text hover:text-(--accent) transition-colors leading-tight block truncate"
                    title={m.originalTitle && m.originalTitle !== m.title ? `${m.title} · ${m.originalTitle}` : m.title}
                  >
                    {m.title}
                  </Link>
                  {/* Una sola línea de metadatos, no una columna aparte: así la
                      duración sigue visible en móvil, que es donde más falta
                      hace para decidir. Números en mono (ver CONCEPT.md). */}
                  <p className="text-[11px] text-text-faint truncate mt-0.5">
                    {m.year && <span className="font-mono">{m.year}</span>}
                    {m.year && m.durationMin && <span className="mx-1.5">·</span>}
                    {m.durationMin && <span className="font-mono">{m.durationMin}′</span>}
                    {(m.year || m.durationMin) && m.directors.length > 0 && <span className="mx-1.5">·</span>}
                    {m.directors.length > 0 && <span>{m.directors.join(", ")}</span>}
                  </p>
                </div>

                {/* Acciones — 36px de alto para que se toquen bien en móvil */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {m.trailerKey && (
                    <button
                      onClick={() => toggleTrailer(m.id)}
                      aria-label={expandedTrailers[m.id] ? `Ocultar tráiler de ${m.title}` : `Ver tráiler de ${m.title}`}
                      className={`flex items-center justify-center w-9 h-9 rounded-[6px] border transition-colors cursor-pointer ${
                        expandedTrailers[m.id]
                          ? "border-(--border-focus) text-(--accent) bg-(--accent-dim)"
                          : "border-(--border) text-text-faint hover:text-text hover:border-(--border-hi)"
                      }`}
                    >
                      <Youtube size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setActiveMovie(m)}
                    aria-label={`Marcar ${m.title} como vista`}
                    className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-(--accent) hover:bg-(--accent-hover) text-bg text-xs font-semibold rounded-[6px] transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                    <span className="hidden sm:inline">Vista</span>
                  </button>
                </div>
              </div>

              {/* Tráiler expandible — grid-template-rows 0fr→1fr (mismo patrón
                  que el acordeón de filtros); el reduced-motion global corta
                  la transición. Se mantiene: ver el tráiler es media razón
                  para entrar aquí antes de decidir. */}
              {m.trailerKey && (
                <div className="trailer-expand" data-open={!!expandedTrailers[m.id]}>
                  <div className="trailer-expand-inner">
                    {seenTrailers.includes(m.id) && (
                      <div className="pb-4 px-1">
                        <div className="aspect-video w-full rounded-lg overflow-hidden border border-(--border) bg-black shadow-(--shadow-raised)">
                          <iframe
                            src={`https://www.youtube.com/embed/${m.trailerKey}`}
                            title={`${m.title} Tráiler`}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Mark Watched */}
      {activeMovie && (
        <MarkWatchedModal
          movie={activeMovie}
          onClose={() => setActiveMovie(null)}
          onSuccess={() => handleMarkWatchedSuccess(activeMovie.id)}
        />
      )}
    </div>
  );
}
