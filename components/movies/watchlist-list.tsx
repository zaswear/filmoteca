"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Check, Youtube, LayoutGrid, List, X } from "lucide-react";
import { MarkWatchedModal } from "./mark-watched-modal";
import { SeatIcon } from "@/components/ui/seat-icon";
import type { MovieParsed } from "@/lib/types";
import { useDialog } from "@/lib/use-dialog";
import {
  FILTROS_INICIALES, IMDB_ALTA, ORDENES, filtrarPendientes, formatoHoras, generosDe, hayFiltros,
  type FiltrosPendientes, type OrdenPendientes,
} from "@/lib/watchlist-filters";

import { t } from "@/lib/i18n";

/**
 * Cuadrícula o lista, recordada en este dispositivo. Se lee con
 * `useSyncExternalStore` y no con un efecto que haga `setState` al montar: el
 * servidor pinta la cuadrícula y el cliente cambia a lo guardado sin un render
 * intermedio. Si el almacenamiento falla (modo privado), vale para la sesión.
 */
type Vista = "grid" | "list";
const CLAVE_VISTA = "directorscut:pendientes:vista";
const oyentesVista = new Set<() => void>();
let vistaEnMemoria: Vista = "grid";

function suscribirVista(cb: () => void) {
  oyentesVista.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    oyentesVista.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function leerVista(): Vista {
  try {
    const v = localStorage.getItem(CLAVE_VISTA);
    if (v === "grid" || v === "list") return v;
  } catch {}
  return vistaEnMemoria;
}
function guardarVista(v: Vista) {
  vistaEnMemoria = v;
  try { localStorage.setItem(CLAVE_VISTA, v); } catch {}
  oyentesVista.forEach((cb) => cb());
}

/** El tope del deslizador, redondeado a 10 hacia arriba, significa «sin límite». */
const MIN_DESLIZADOR = 60;
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
  // En la cuadrícula no cabe el tráiler desplegado bajo la ficha: va en modal.
  const [trailerModal, setTrailerModal] = useState<PendienteItem | null>(null);
  const [filtros, setFiltros] = useState<FiltrosPendientes>(FILTROS_INICIALES);
  const vista = useSyncExternalStore(suscribirVista, leerVista, () => "grid" as Vista);

  const generos = useMemo(() => generosDe(movies), [movies]);
  const maxDeslizador = useMemo(() => {
    const max = Math.max(0, ...movies.map((m) => m.durationMin ?? 0));
    return Math.max(MIN_DESLIZADOR + 10, Math.ceil(max / 10) * 10);
  }, [movies]);
  const visibles = useMemo(() => filtrarPendientes(movies, filtros), [movies, filtros]);
  const filtrando = hayFiltros(filtros);

  const toggleGenero = (g: string) =>
    setFiltros((f) => ({
      ...f,
      generos: f.generos.includes(g) ? f.generos.filter((x) => x !== g) : [...f.generos, g],
    }));

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
              <p className="text-[11px] uppercase tracking-widest text-text-faint mt-0.5">{t("watch.titulo")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Películas */}
      {movies.length === 0 ? (
        <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-xl">
          <Film size={32} className="mx-auto text-text-faint mb-3 opacity-60" />
          <p className="text-text-mid text-sm font-medium">{t("watch.vacio")}</p>
          <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">{t("watch.vacioAyuda")}</p>
        </div>
      ) : (
        <>
        {/* Barra de filtros. Sticky: con 80 pendientes, cambiar de orden a mitad
            de scroll no debería obligar a subir. */}
        <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 space-y-3 bg-(--bg)/95 backdrop-blur border-b border-(--border)">
          {generos.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="pt-1 text-[11px] uppercase tracking-widest text-text-faint shrink-0">{t("watch.fGenero")}</span>
              <div className="flex flex-wrap gap-1.5">
                {generos.map((g) => {
                  const on = filtros.generos.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleGenero(g)}
                      className={`h-7 px-3 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                        on
                          ? "bg-text text-bg border-text"
                          : "bg-(--surface) border-(--border) text-text-mid hover:border-(--border-hi) hover:text-text"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {/* «Tengo X minutos»: la pregunta de verdad un viernes por la noche. */}
            <label className="flex items-center gap-2.5 text-sm">
              <span className="text-[11px] uppercase tracking-widest text-text-faint">{t("watch.fTengo")}</span>
              <input
                type="range"
                min={MIN_DESLIZADOR}
                max={maxDeslizador}
                step={5}
                value={filtros.maxMin ?? maxDeslizador}
                aria-label={t("watch.fDuracion")}
                aria-valuetext={filtros.maxMin === null ? t("watch.fSinLimite") : formatoHoras(filtros.maxMin)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFiltros((f) => ({ ...f, maxMin: v >= maxDeslizador ? null : v }));
                }}
                className="w-32 sm:w-40 accent-(--accent) cursor-pointer"
              />
              <output className="font-mono text-sm min-w-[4.5rem] text-text">
                {filtros.maxMin === null ? t("watch.fSinLimite") : formatoHoras(filtros.maxMin)}
              </output>
            </label>

            <button
              type="button"
              aria-pressed={filtros.imdbAlta}
              onClick={() => setFiltros((f) => ({ ...f, imdbAlta: !f.imdbAlta }))}
              className={`h-7 px-3 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                filtros.imdbAlta
                  ? "bg-text text-bg border-text"
                  : "bg-(--surface) border-(--border) text-text-mid hover:border-(--border-hi) hover:text-text"
              }`}
            >
              {t("watch.fImdbAlta", { n: IMDB_ALTA })}
            </button>

            <label className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-text-faint">{t("watch.fOrden")}</span>
              <select
                value={filtros.orden}
                onChange={(e) => setFiltros((f) => ({ ...f, orden: e.target.value as OrdenPendientes }))}
                className="h-8 px-2 rounded-[6px] border border-(--border) bg-(--surface) text-sm text-text cursor-pointer"
              >
                {ORDENES.map((o) => (
                  <option key={o} value={o}>{t(`watch.orden.${o}`)}</option>
                ))}
              </select>
            </label>

            <div role="group" aria-label={t("watch.vista")} className="ml-auto inline-flex rounded-[6px] border border-(--border) overflow-hidden">
              {([["grid", LayoutGrid, "watch.vistaCuadricula"], ["list", List, "watch.vistaLista"]] as const).map(([v, Icono, clave]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vista === v}
                  onClick={() => guardarVista(v)}
                  className={`flex items-center gap-1.5 h-8 px-3 text-xs font-medium transition-colors cursor-pointer ${
                    vista === v ? "bg-text text-bg" : "bg-(--surface) text-text-mid hover:text-text"
                  }`}
                >
                  <Icono size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{t(clave)}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="flex items-center gap-3 text-xs text-text-faint" aria-live="polite">
            <span>
              {t("watch.resultado", { n: visibles.length, total: movies.length })}
              {filtros.maxMin !== null && <> · {t("watch.caben", { d: formatoHoras(filtros.maxMin) })}</>}
            </span>
            {filtrando && (
              <button
                type="button"
                onClick={() => setFiltros((f) => ({ ...FILTROS_INICIALES, orden: f.orden }))}
                className="inline-flex items-center gap-1 text-(--accent) hover:underline cursor-pointer"
              >
                <X size={12} aria-hidden="true" />{t("watch.quitarFiltros")}
              </button>
            )}
          </p>
        </div>

        {visibles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-(--border) rounded-xl">
            <p className="text-text-mid text-sm">{t("watch.sinResultados")}</p>
            <button
              type="button"
              onClick={() => setFiltros((f) => ({ ...FILTROS_INICIALES, orden: f.orden }))}
              className="mt-3 text-sm text-(--accent) hover:underline cursor-pointer"
            >
              {t("watch.quitarFiltros")}
            </button>
          </div>
        ) : vista === "grid" ? (
          // Cuadrícula de carteles: el póster es lo que se reconoce de un
          // vistazo. Las acciones van encima del cartel, al pasar el ratón; en
          // pantallas táctiles, donde no hay hover, se ven siempre.
          <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6">
            {visibles.map((m) => (
              <li key={m.id} className="group min-w-0">
                <div className="relative aspect-2/3 rounded-[6px] overflow-hidden bg-(--surface-hi) border border-(--border) shadow-(--shadow-card) transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-(--shadow-poster)">
                  <Link href={`/peliculas/${m.id}`} className="absolute inset-0" aria-label={m.title}>
                    {m.posterUrl ? (
                      <Image
                        src={m.posterUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 160px, (min-width: 640px) 25vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-text-faint">
                        <Film size={20} />
                      </span>
                    )}
                  </Link>
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-linear-to-t from-black/80 to-transparent pt-8 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
                    {m.trailerKey && (
                      <button
                        type="button"
                        onClick={() => setTrailerModal(m)}
                        aria-label={t("watch.trailerDe", { t: m.title })}
                        className="flex items-center justify-center w-8 h-8 rounded-[5px] bg-white/15 border border-white/25 text-white hover:bg-white/30 transition-colors cursor-pointer"
                      >
                        <Youtube size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveMovie(m)}
                      aria-label={`Marcar ${m.title} como vista`}
                      className="flex-1 flex items-center justify-center gap-1 h-8 rounded-[5px] bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-(--accent) hover:border-(--accent) transition-colors cursor-pointer"
                    >
                      <Check size={13} />
                      <span className="hidden sm:inline">{t("marcar.vista")}</span>
                    </button>
                  </div>
                </div>
                <Link
                  href={`/peliculas/${m.id}`}
                  className="mt-2 block font-display font-semibold italic text-[13px] sm:text-sm leading-tight text-text hover:text-(--accent) transition-colors line-clamp-2"
                >
                  {m.title}
                </Link>
                <p className="text-[11px] text-text-faint truncate mt-0.5">
                  {m.year && <span className="font-mono">{m.year}</span>}
                  {m.year && m.durationMin && <span className="mx-1">·</span>}
                  {m.durationMin && <span className="font-mono">{m.durationMin}′</span>}
                </p>
              </li>
            ))}
          </ul>
        ) : (
        // Filas densas, no fichas. Esta lista no es para leer sobre las
        // películas —para eso está la ficha completa— sino para repasar el
        // backlog y marcar vistas. Con 64 pendientes, una ficha por película
        // eran 47 pantallas de scroll en móvil.
        // Dos columnas en pantalla ancha: una fila compacta deja medio viewport
        // vacío a 1440px, y con 64 pendientes eso son pantallas de scroll de más.
        <div className="grid grid-cols-1 xl:grid-cols-2 xl:gap-x-10 border-t border-(--border)">
          {visibles.map((m) => (
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
                    <span className="hidden sm:inline">{t("marcar.vista")}</span>
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
        </>
      )}

      {/* Modal Mark Watched */}
      {activeMovie && (
        <MarkWatchedModal
          movie={activeMovie}
          onClose={() => setActiveMovie(null)}
          onSuccess={() => handleMarkWatchedSuccess(activeMovie.id)}
        />
      )}

      {trailerModal?.trailerKey && (
        <TrailerModal movie={trailerModal} onClose={() => setTrailerModal(null)} />
      )}
    </div>
  );
}

function TrailerModal({ movie, onClose }: { movie: PendienteItem; onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--backdrop) p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("watch.trailerDe", { t: movie.title })}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-xl overflow-hidden bg-(--surface-hi) border border-(--border) shadow-(--shadow-modal)"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--border)">
          <p className="font-display font-semibold italic text-lg text-text truncate">{movie.title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("watch.cerrar")}
            className="flex items-center justify-center w-9 h-9 rounded-[6px] text-text-faint hover:text-text hover:bg-(--surface) transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${movie.trailerKey}?autoplay=1`}
            title={t("watch.trailerDe", { t: movie.title })}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
