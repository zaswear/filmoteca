"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Clock, Loader2, Play, EyeOff, Heart, Eye, Youtube, Check } from "lucide-react";

import { t } from "@/lib/i18n";
interface LgbtMovie {
  tmdbId: number;
  imdbId: string;
  title: string;
  year: number;
  rating: number;
  plot: string | null;
  posterUrl: string | null;
  genres: string[];
  trailerKey: string | null;
}

interface LgbtListProps {
  initialMovies: LgbtMovie[];
  initialDbStatus: Record<string, string>;
}

export function LgbtList({ initialMovies, initialDbStatus }: LgbtListProps) {
  const [movies] = useState<LgbtMovie[]>(initialMovies);
  const [dbStatus, setDbStatus] = useState<Record<string, string>>(initialDbStatus);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  // Sello de confirmación: se estampa sobre la tarjeta antes de que salga de la lista.
  const [stampedId, setStampedId] = useState<string | null>(null);
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);
  // Tráilers ya abiertos alguna vez: el iframe se monta al primer open y se
  // queda en el DOM (recogido a 0fr) para poder animar también el cierre.
  const [seenTrailers, setSeenTrailers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleTrailer(id: string) {
    setActiveTrailerId((prev) => (prev === id ? null : id));
    setSeenTrailers((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function handleAdd(m: LgbtMovie, status: "pendiente" | "descartada") {
    if (status === "pendiente") setAddingId(m.imdbId);
    else setIgnoringId(m.imdbId);

    setError(null);
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId: m.imdbId,
          title: m.title,
          year: m.year,
          plot: m.plot,
          posterUrl: m.posterUrl,
          genres: m.genres,
          trailerKey: m.trailerKey,
          status,
          directors: [],
          cast: [],
          collections: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("lgbt.errorRegistrar"));
      }

      // Al añadir a pendientes, la tarjeta se queda un instante más con el
      // sello estampado encima antes de salir de la lista.
      if (status === "pendiente") {
        setStampedId(m.imdbId);
        window.setTimeout(() => {
          setDbStatus((prev) => ({ ...prev, [m.imdbId]: status }));
          setStampedId(null);
        }, 650);
      } else {
        setDbStatus((prev) => ({ ...prev, [m.imdbId]: status }));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("sug.errorSolicitud"));
    } finally {
      setAddingId(null);
      setIgnoringId(null);
    }
  }

  if (movies.length === 0) {
    return (
      <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-xl">
        <Heart size={32} className="mx-auto text-text-faint mb-3 animate-pulse" />
        <p className="text-text-mid text-sm font-medium">{t("lgbt.vacio")}</p>
        <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">{t("lgbt.vacioAyuda")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        .lgbt-card { position: relative; }
        .lgbt-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 1px;
          background: linear-gradient(135deg, #ff3366, #ff9933, #33cc66, #3399ff, #9933ff);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
        }
        .lgbt-card:hover::before { opacity: 0.85; }
      `}} />

      {error && (
        <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
          {error}
        </div>
      )}

      {/* Grid de películas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {movies
          .filter((m) =>
            dbStatus[m.imdbId] !== "pendiente" &&
            dbStatus[m.imdbId] !== "vista" &&
            dbStatus[m.imdbId] !== "descartada"
          )
          .map((m) => {
            const currentStatus = dbStatus[m.imdbId];
            const isAdding = addingId === m.imdbId;
            const isIgnoring = ignoringId === m.imdbId;
            const isTrailerOpen = activeTrailerId === m.imdbId;

            return (
              <div
                key={m.imdbId}
                className="lgbt-card flex flex-col bg-(--surface) border border-(--border) rounded-xl p-5 shadow-(--shadow-card) transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {stampedId === m.imdbId && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-(--surface)/70">
                    <span className="animate-stamp flex items-center gap-2 border-2 border-(--accent) rounded-lg bg-(--surface-hi) px-5 py-2 font-display text-lg tracking-wide text-(--accent) uppercase">
                      <Check size={20} aria-hidden="true" />{t("lgbt.enPendientes")}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Póster */}
                  <div className="relative w-40 md:w-44 aspect-2/3 rounded-lg overflow-hidden bg-bg border border-(--border-hi) shadow-(--shadow-poster) shrink-0 mx-auto sm:mx-0 group">
                    {m.posterUrl ? (
                      <Image
                        src={m.posterUrl}
                        alt={m.title}
                        width={400}
                        height={600}
                        sizes="(max-width: 768px) 160px, 176px"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center italic text-text-faint bg-(--surface-hi)">
                        <Film size={32} className="mb-1 text-text-faint/30" />
                        <span className="text-[10px] font-medium leading-tight">{m.title}</span>
                      </div>
                    )}

                    {m.trailerKey && (
                      <button
                        onClick={() => toggleTrailer(m.imdbId)}
                        className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                        aria-label={t("sug.trailer")}
                      >
                        <span className="p-3.5 rounded-full bg-(--accent) hover:bg-(--accent-hover) text-bg shadow-(--shadow-raised) transform scale-90 group-hover:scale-100 transition-[transform,background-color] duration-300">
                          <Play size={18} className="fill-bg ml-0.5" />
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Información */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-text-faint">{m.year}</span>
                        <span className="px-2 py-0.5 font-mono text-[10px] font-semibold bg-(--accent-dim) text-(--accent) rounded border border-(--accent)/10">
                          ★ {m.rating.toFixed(1)}
                        </span>
                      </div>

                      <h3 className="font-display font-semibold italic text-xl md:text-2xl text-text leading-tight tracking-tight mt-1 line-clamp-2">
                        {m.title}
                      </h3>

                      {m.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.genres.slice(0, 3).map((g) => (
                            <span key={g} className="px-2 py-0.5 font-mono text-[9px] text-(--accent) border border-(--accent)/20 rounded bg-(--accent-dim)/20 uppercase tracking-wider">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.plot && (
                        <p className="text-xs text-text-mid leading-relaxed mt-3 line-clamp-3">
                          {m.plot}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="mt-4 pt-3 border-t border-(--border) flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {currentStatus === "vista" && (
                          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-success bg-success/10 border border-success/20 rounded">
                            <Eye size={12} />{t("marcar.vista")}</span>
                        )}
                        {currentStatus === "pendiente" && (
                          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-warning bg-warning/10 border border-warning/20 rounded">
                            <Clock size={12} />{t("lgbt.enWatchlist")}</span>
                        )}

                        {!currentStatus && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isAdding || isIgnoring}
                              onClick={() => handleAdd(m, "pendiente")}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-(--surface-hi) hover:bg-(--border) border border-(--border) text-text transition-colors cursor-pointer"
                            >
                              {isAdding ? <Loader2 size={12} className="animate-spin" /> : <><Clock size={12} />{t("lgbt.watchlist")}</>}
                            </button>

                            <Link
                              href={`/peliculas/nueva?imdbId=${m.imdbId}`}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-(--accent) hover:bg-(--accent-hover) text-bg rounded transition-colors"
                            >
                              <Film size={12} />{t("marcar.vista")}</Link>

                            <button
                              type="button"
                              disabled={isAdding || isIgnoring}
                              onClick={() => handleAdd(m, "descartada")}
                              className="p-1.5 text-text-faint hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 rounded transition-colors cursor-pointer"
                              title={t("lgbt.ignorar")}
                            >
                              {isIgnoring ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
                            </button>
                          </div>
                        )}

                        {currentStatus === "pendiente" && (
                          <Link
                            href={`/peliculas/nueva?imdbId=${m.imdbId}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-(--accent) hover:bg-(--accent-hover) text-bg rounded transition-colors"
                          >
                            <Film size={11} />{t("sug.registrarVista")}</Link>
                        )}
                      </div>

                      {m.trailerKey && (
                        <button
                          onClick={() => toggleTrailer(m.imdbId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-(--border-hi) hover:bg-(--surface-hi) rounded transition-colors text-text-mid hover:text-text shrink-0 cursor-pointer"
                        >
                          <Youtube size={13} className="text-red-500 fill-red-500/10" />
                          {isTrailerOpen ? t("lgbt.ocultarTrailer") : t("lgbt.verTrailer")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tráiler expandible — grid-template-rows 0fr→1fr (mismo patrón
                    que el acordeón de filtros); el reduced-motion global corta
                    la transición. */}
                {m.trailerKey && (
                  <div className="trailer-expand" data-open={isTrailerOpen}>
                    <div className="trailer-expand-inner">
                      {seenTrailers.includes(m.imdbId) && (
                        <div className="w-full mt-5 pt-5 border-t border-dashed border-(--border)">
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
            );
          })}
      </div>
    </div>
  );
}
