"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Clock, Sparkles, Check, Loader2, ChevronLeft, ChevronRight, Play, Image as ImageIcon, EyeOff, RefreshCw } from "lucide-react";

// Nº de ticket decorativo, fijado una vez al importar (antes Math.random en render).
const TICKET_NO = Math.floor(Math.random() * 9000 + 1000);

interface Suggestion {
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

interface SugerenciasListProps {
  initialSuggestions: Suggestion[];
}

// Animación de carga: un ticket de cine que se imprime desde la máquina y se rompe.
function TicketLoader() {
  return (
    <div className="space-y-8">
      <style dangerouslySetInnerHTML={{ __html: `
        .tk-stage{position:relative;width:100%;max-width:32rem;margin:0 auto;height:300px;
          display:flex;flex-direction:column;align-items:center;
          background:#090909;border:6px solid #1f1f1f;border-radius:.75rem;
          box-shadow:0 25px 60px rgba(0,0,0,.85);overflow:hidden;padding-top:18px;}
        .tk-machine{position:relative;width:240px;height:118px;z-index:2;
          background:linear-gradient(#23201a,#15120d);border:3px solid #3a342a;border-radius:10px;
          box-shadow:0 6px 16px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.05);}
        .tk-machine::before{content:'TICKETS';position:absolute;top:14px;left:0;right:0;text-align:center;
          font-family:var(--font-bebas),Impact,sans-serif;letter-spacing:.45em;color:#cda85a;font-size:16px;}
        .tk-slot{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:200px;height:9px;
          background:#000;border-radius:5px;box-shadow:inset 0 2px 4px rgba(0,0,0,.95),0 1px 0 rgba(255,255,255,.06);}
        .tk-ticket{position:absolute;top:32px;left:50%;width:196px;margin-left:-98px;z-index:1;
          animation:tk-print 2.8s cubic-bezier(.2,.85,.25,1) infinite;}
        .tk-half{background:#f3ecdb;color:#1a1410;font-family:var(--font-bebas),Impact,sans-serif;
          display:flex;align-items:center;justify-content:space-between;padding:9px 12px;letter-spacing:.12em;}
        .tk-top{border-radius:6px 6px 0 0;font-size:18px;}
        .tk-top b{color:#cc2323;letter-spacing:.22em;}
        .tk-perf{border-top:2px dashed #c4b99c;background:#f3ecdb;height:0;}
        .tk-bottom{border-radius:0 0 6px 6px;font-size:13px;color:#5b5040;transform-origin:top center;
          animation:tk-tear 2.8s cubic-bezier(.45,0,.55,1) infinite;}
        @keyframes tk-print{
          0%{transform:translateY(0);}                 /* oculto tras la máquina */
          6%{transform:translateY(14px);}9%{transform:translateY(8px);}    /* tirón de impresora */
          16%{transform:translateY(34px);}19%{transform:translateY(28px);}
          45%{transform:translateY(108px);opacity:1;}  /* ticket impreso y fuera */
          55%{transform:translateY(108px);opacity:1;}
          93%{transform:translateY(108px);opacity:1;}
          99%{transform:translateY(108px);opacity:0;}  /* fundido para reiniciar sin salto */
          100%{transform:translateY(0);opacity:0;}
        }
        @keyframes tk-tear{
          0%,55%{transform:translate(0,0) rotate(0);opacity:1;}
          67%{transform:translate(9px,8px) rotate(6deg);opacity:1;}
          88%{transform:translate(46px,86px) rotate(26deg);opacity:0;}
          100%{transform:translate(46px,86px) rotate(26deg);opacity:0;}
        }
        @media (prefers-reduced-motion: reduce){
          .tk-ticket,.tk-bottom{animation-duration:.001ms;animation-iteration-count:1;}
        }
        .tk-caption{margin-top:auto;margin-bottom:16px;font-family:var(--font-bebas),Impact,sans-serif;
          letter-spacing:.28em;color:#cda85a;font-size:14px;z-index:3;}
      `}} />
      <div className="tk-stage" role="status" aria-live="polite" aria-label="Generando sugerencias">
        <div className="tk-machine"><div className="tk-slot" /></div>
        <div className="tk-ticket">
          <div className="tk-half tk-top"><span>ADMIT ONE</span><b>D·C</b></div>
          <div className="tk-perf" />
          <div className="tk-half tk-bottom"><span>DIRECTOR&apos;S CUT</span><span>Nº {TICKET_NO}</span></div>
        </div>
        <div className="tk-caption">IMPRIMIENDO NUEVAS SUGERENCIAS…</div>
      </div>
    </div>
  );
}

export function SugerenciasList({ initialSuggestions }: SugerenciasListProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showTrailer, setShowTrailer] = useState<boolean>(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);


  const handleNext = useCallback(() => {
    if (suggestions.length <= 1) return;
    setShowTrailer(false);
    setCurrentIndex((prev) => (prev + 1) % suggestions.length);
  }, [suggestions.length]);

  const handlePrev = useCallback(() => {
    if (suggestions.length <= 1) return;
    setShowTrailer(false);
    setCurrentIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
  }, [suggestions.length]);

  // Navegación por teclado (Flechas izquierda y derecha)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (suggestions.length <= 1) return;

      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [suggestions.length, handleNext, handlePrev]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sugerencias/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron generar sugerencias");
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setCurrentIndex(0);
      setShowTrailer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al recargar sugerencias");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddToWatchlist(s: Suggestion) {
    setAddingId(s.imdbId);
    setError(null);
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId: s.imdbId,
          title: s.title,
          year: s.year,
          plot: s.plot,
          posterUrl: s.posterUrl,
          genres: s.genres,
          trailerKey: s.trailerKey,
          status: "pendiente",
          directors: [],
          cast: [],
          collections: []
        })
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) throw new Error("Ya está en tu diario");
        throw new Error(data.error || "No se pudo añadir a pendientes");
      }

      setSuccessId(s.imdbId);
      
      // Esperar antes de removerlo de la lista para mostrar la animación de éxito
      setTimeout(() => {
        setSuggestions((prev) => {
          const nextList = prev.filter((item) => item.imdbId !== s.imdbId);
          // Ajustar currentIndex para no quedar fuera de rango
          setCurrentIndex((prevIndex) => {
            if (nextList.length === 0) return 0;
            if (prevIndex >= nextList.length) {
              return nextList.length - 1;
            }
            return prevIndex;
          });
          return nextList;
        });
        setSuccessId(null);
        setShowTrailer(false);
      }, 1000);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al procesar la solicitud");
    } finally {
      setAddingId(null);
    }
  }

  async function handleIgnore(s: Suggestion) {
    setIgnoringId(s.imdbId);
    setError(null);
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId: s.imdbId,
          title: s.title,
          year: s.year,
          plot: s.plot,
          posterUrl: s.posterUrl,
          genres: s.genres,
          trailerKey: s.trailerKey,
          status: "descartada",
          directors: [],
          cast: [],
          collections: []
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo ignorar la película");
      }

      setSuccessId(s.imdbId);
      
      // Esperar antes de removerlo de la lista
      setTimeout(() => {
        setSuggestions((prev) => {
          const nextList = prev.filter((item) => item.imdbId !== s.imdbId);
          setCurrentIndex((prevIndex) => {
            if (nextList.length === 0) return 0;
            if (prevIndex >= nextList.length) {
              return nextList.length - 1;
            }
            return prevIndex;
          });
          return nextList;
        });
        setSuccessId(null);
        setShowTrailer(false);
      }, 800);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al descartar la película");
    } finally {
      setIgnoringId(null);
    }
  }

  const hasMovies = suggestions.length > 0;
  const current = hasMovies ? suggestions[currentIndex] : null;

  // Mientras se generan nuevas sugerencias, mostramos la animación de tickets
  if (refreshing) return <TicketLoader />;

  const refreshButton = (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 rounded-md border border-(--border) bg-(--surface) px-4 py-2 text-sm font-semibold text-text-mid transition-colors hover:border-[#cc2323] hover:text-(--text) disabled:opacity-50"
      >
        <RefreshCw size={15} />
        Recargar sugerencias
      </button>
    </div>
  );

  // Si no hay películas (Estás al día), renderizamos la marquesina vacía y el mensaje
  if (!current) {
    return (
      <div className="space-y-8">
        {/* Inyección de estilos de la marquesina */}
        <style dangerouslySetInnerHTML={{ __html: `

          .font-marquee {
            font-family: var(--font-bebas), 'Impact', sans-serif;
          }
          
          @keyframes marquee-blink-yellow {
            0%, 100% { background-color: #fbbf24; box-shadow: 0 0 10px #fbbf24, 0 0 20px #fbbf24; }
            50% { background-color: #78350f; box-shadow: none; }
          }
          @keyframes marquee-blink-blue {
            0%, 100% { background-color: #60a5fa; box-shadow: 0 0 10px #60a5fa, 0 0 20px #60a5fa; }
            50% { background-color: #1e3a8a; box-shadow: none; }
          }
          
          .animate-bulb-yellow {
            animation: marquee-blink-yellow 1.2s infinite;
          }
          .animate-bulb-blue {
            animation: marquee-blink-blue 1.2s infinite;
          }
        `}} />

        {/* Marquesina de Cine Vacía */}
        <div className="relative p-6 bg-[#090909] border-[6px] border-[#1f1f1f] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden w-full max-w-4xl mx-auto ring-4 ring-[#0d0d0d]">
          {/* Luces superiores */}
          <div className="absolute top-1.5 left-4 right-4 flex justify-between pointer-events-none">
            {[...Array(19)].map((_, i) => (
              <div
                key={`top-${i}`}
                className={`w-2.5 h-2.5 rounded-full ${i % 2 === 0 ? "animate-bulb-yellow" : "animate-bulb-blue"}`}
              />
            ))}
          </div>

          {/* Luces inferiores */}
          <div className="absolute bottom-1.5 left-4 right-4 flex justify-between pointer-events-none">
            {[...Array(19)].map((_, i) => (
              <div
                key={`bottom-${i}`}
                className={`w-2.5 h-2.5 rounded-full ${i % 2 === 0 ? "animate-bulb-blue" : "animate-bulb-yellow"}`}
              />
            ))}
          </div>

          {/* Tablero retro */}
          <div className="bg-[#fcfaf5] rounded p-6 shadow-inner text-center relative flex flex-col justify-center min-h-[160px] border-4 border-neutral-900 overflow-hidden">
            <div className="text-neutral-800 text-xs sm:text-sm font-black tracking-[0.25em] font-marquee select-none mb-1">
              ¿HAS VISTO ESTA?
            </div>
            <div className="py-1 flex items-center justify-center min-h-[70px]">
              <h1 className="font-marquee text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase text-[#cc2323] tracking-widest leading-none select-none drop-shadow-[0_2px_1.5px_rgba(0,0,0,0.25)]">
                ¡ESTÁS AL DÍA!
              </h1>
            </div>
            <div className="text-neutral-600 text-[10px] sm:text-xs font-bold tracking-[0.18em] font-marquee select-none mt-2">
              DIRECTOR&apos;S CUT  •  NUEVAS RECOMENDACIONES CADA DOMINGO  •  SHOWTIME
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
            {error}
          </div>
        )}

        <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-md">
          <Sparkles size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-mid text-sm font-medium">¡Estás al día!</p>
          <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">
            Has visto o añadido a pendientes todas las sugerencias actuales. Pulsa recargar para imprimir nuevas, o espera al workflow semanal.
          </p>
          <div className="mt-5">{refreshButton}</div>
        </div>
      </div>
    );
  }

  // A partir de aquí, "current" es garantizado de tipo Suggestion (no null)
  const isAdding = addingId === current.imdbId;
  const isIgnoring = ignoringId === current.imdbId;
  const isSuccess = successId === current.imdbId;

  // Variables para la marquesina activa
  const marqueeTopText = "¿HAS VISTO ESTA?";
  const marqueeTitle = current.title;
  const marqueeBottomText = `4K DOLBY SYSTEM  •  ${current.year}  •  ${current.genres.slice(0, 2).join(" / ").toUpperCase()}  •  18:30H  22:00H`;

  return (
    <div className="space-y-8">
      {refreshButton}
      {error && (
        <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
          {error}
        </div>
      )}
      {/* Inyección de estilos de la marquesina */}
      <style dangerouslySetInnerHTML={{ __html: `

        .font-marquee {
          font-family: var(--font-bebas), 'Impact', sans-serif;
        }
        
        @keyframes marquee-blink-yellow {
          0%, 100% { background-color: #fbbf24; box-shadow: 0 0 10px #fbbf24, 0 0 20px #fbbf24; }
          50% { background-color: #78350f; box-shadow: none; }
        }
        @keyframes marquee-blink-blue {
          0%, 100% { background-color: #60a5fa; box-shadow: 0 0 10px #60a5fa, 0 0 20px #60a5fa; }
          50% { background-color: #1e3a8a; box-shadow: none; }
        }
        
        .animate-bulb-yellow {
          animation: marquee-blink-yellow 1.2s infinite;
        }
        .animate-bulb-blue {
          animation: marquee-blink-blue 1.2s infinite;
        }
        
        @keyframes marquee-text-entry {
          0% { opacity: 0; transform: scale(0.96) translateY(4px); filter: blur(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: none; }
        }
        
        .animate-marquee-text {
          animation: marquee-text-entry 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Marquesina de Cine Clásica */}
      <div className="relative p-6 bg-[#090909] border-[6px] border-[#1f1f1f] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden w-full max-w-4xl mx-auto ring-4 ring-[#0d0d0d]">
        
        {/* Luces superiores */}
        <div className="absolute top-1.5 left-4 right-4 flex justify-between pointer-events-none">
          {[...Array(19)].map((_, i) => (
            <div
              key={`top-${i}`}
              style={{ animationDelay: `${i * 0.08}s` }}
              className={`w-2.5 h-2.5 rounded-full ${
                i % 2 === 0 ? "animate-bulb-yellow" : "animate-bulb-blue"
              }`}
            />
          ))}
        </div>

        {/* Luces inferiores */}
        <div className="absolute bottom-1.5 left-4 right-4 flex justify-between pointer-events-none">
          {[...Array(19)].map((_, i) => (
            <div
              key={`bottom-${i}`}
              style={{ animationDelay: `${(i + 1) * 0.08}s` }}
              className={`w-2.5 h-2.5 rounded-full ${
                i % 2 === 0 ? "animate-bulb-blue" : "animate-bulb-yellow"
              }`}
            />
          ))}
        </div>

        {/* Luces izquierdas */}
        <div className="absolute left-1.5 top-6 bottom-6 flex flex-col justify-between pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={`left-${i}`}
              style={{ animationDelay: `${i * 0.12}s` }}
              className={`w-2.5 h-2.5 rounded-full ${
                i % 2 === 0 ? "animate-bulb-yellow" : "animate-bulb-blue"
              }`}
            />
          ))}
        </div>

        {/* Luces derechas */}
        <div className="absolute right-1.5 top-6 bottom-6 flex flex-col justify-between pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={`right-${i}`}
              style={{ animationDelay: `${(i + 1) * 0.12}s` }}
              className={`w-2.5 h-2.5 rounded-full ${
                i % 2 === 0 ? "animate-bulb-blue" : "animate-bulb-yellow"
              }`}
            />
          ))}
        </div>

        {/* Tablero retro iluminado */}
        <div className="bg-[#fcfaf5] rounded p-6 shadow-inner text-center relative flex flex-col justify-center min-h-[160px] border-4 border-neutral-900 overflow-hidden">
          
          {/* Líneas/rieles de inserción de letras */}
          <div className="absolute inset-0 flex flex-col justify-between py-5 pointer-events-none opacity-[0.06]">
            <div className="h-px bg-black w-full" />
            <div className="h-px bg-black w-full" />
            <div className="h-px bg-black w-full" />
            <div className="h-px bg-black w-full" />
          </div>

          {/* Fila superior: Título de sección */}
          <div className="text-neutral-800 text-xs sm:text-sm font-black tracking-[0.25em] font-marquee select-none mb-1">
            {marqueeTopText}
          </div>

          {/* Fila central: Título dinámico de la película */}
          <div 
            key={current.imdbId} 
            className="animate-marquee-text py-1 flex items-center justify-center min-h-[70px]"
          >
            <h1 className="font-marquee text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase text-[#cc2323] tracking-widest leading-none select-none drop-shadow-[0_2px_1.5px_rgba(0,0,0,0.25)]">
              {marqueeTitle}
            </h1>
          </div>

          {/* Fila inferior: Metadatos simulated */}
          <div className="text-neutral-600 text-[10px] sm:text-xs font-bold tracking-[0.18em] font-marquee select-none mt-2">
            {marqueeBottomText}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
          {error}
        </div>
      )}

      {/* Contenido principal (ficha y controles) */}
      <div className="space-y-6">
        {/* Barra de Navegación superior */}
        <div className="flex items-center justify-between bg-surface-hi/40 border border-border p-3 rounded-lg">
          <button
            onClick={handlePrev}
            disabled={suggestions.length <= 1}
            className="p-2 text-text-mid hover:text-text bg-surface hover:bg-border border border-border rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Sugerencia anterior"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="font-mono text-xs text-text-mid">
            Ficha <span className="text-text font-bold">{currentIndex + 1}</span> de <span className="text-text font-bold">{suggestions.length}</span>
          </div>

          <button
            onClick={handleNext}
            disabled={suggestions.length <= 1}
            className="p-2 text-text-mid hover:text-text bg-surface hover:bg-border border border-border rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Siguiente sugerencia"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Ficha principal de la sugerencia */}
        <div
          className={`bg-surface border border-border rounded-xl p-6 md:p-8 shadow-raised flex flex-col md:flex-row gap-8 items-start relative transition-[transform,box-shadow,border-color,opacity] duration-300 ${
            isSuccess ? "opacity-40 scale-[0.99] border-success" : ""
          }`}
        >
          {/* Sección de Póster / Reproductor de Tráiler */}
          <div className="w-full md:w-80 lg:w-[360px] aspect-2/3 rounded-lg overflow-hidden bg-bg border border-border-hi shadow-poster relative shrink-0 group">
            {showTrailer && current.trailerKey ? (
              <div className="w-full h-full bg-black relative animate-fade-in">
                <iframe
                  src={`https://www.youtube.com/embed/${current.trailerKey}`}
                  title={`${current.title} Trailer`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <button
                  onClick={() => setShowTrailer(false)}
                  className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs font-mono bg-bg/85 hover:bg-bg text-text border border-border rounded shadow-sm backdrop-blur-xs transition-colors"
                >
                  Ver Póster
                </button>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {current.posterUrl ? (
                  <Image
                    src={current.posterUrl}
                    alt={current.title}
                    width={500}
                    height={750}
                    sizes="(max-width: 768px) 90vw, 400px"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center italic text-text-faint bg-surface-hi">
                    <Film size={48} className="mb-2 text-text-faint/40" />
                    <span className="text-sm font-medium">{current.title}</span>
                  </div>
                )}
                
                {/* Play button overlay para reproducir trailer rápidamente */}
                {current.trailerKey && (
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      onClick={() => setShowTrailer(true)}
                      className="p-5 rounded-full bg-accent hover:bg-accent-hover text-bg shadow-raised transform scale-90 group-hover:scale-100 transition-[transform,background-color] duration-300"
                      aria-label="Reproducir Tráiler"
                    >
                      <Play size={28} className="fill-bg ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detalles e Información de la Película */}
          <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-text-faint">{current.year}</span>
                  <span className="px-2.5 py-0.5 font-mono text-xs font-semibold bg-accent-dim text-accent rounded border border-accent/10">
                    ★ {current.rating.toFixed(1)} <span className="text-[10px] opacity-70">TMDB</span>
                  </span>
                </div>
                
                <h2 className="font-display font-semibold italic text-3xl md:text-4xl lg:text-5xl text-text leading-tight tracking-tight">
                  {current.title}
                </h2>

                {current.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {current.genres.map((g) => (
                      <span key={g} className="px-2.5 py-0.5 font-mono text-[10px] text-accent border border-accent/20 rounded-full bg-accent-dim/30 uppercase tracking-wider">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {current.plot ? (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-mono text-text-faint uppercase tracking-wider block">Sinopsis</span>
                  <p className="text-base text-text-mid leading-relaxed font-sans max-w-2xl">
                    {current.plot}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-faint italic font-sans pt-2">
                  Sinopsis no disponible en español.
                </p>
              )}
            </div>

            {/* Botones de acción */}
            <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {/* Botón Guardar a Pendientes */}
                <button
                  type="button"
                  disabled={isAdding || isIgnoring || isSuccess}
                  onClick={() => handleAddToWatchlist(current)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded transition-colors ${
                    isSuccess && addingId === current.imdbId
                      ? "bg-success text-white"
                      : "bg-surface-hi hover:bg-border border border-border text-text hover:text-white"
                  }`}
                >
                  {isAdding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isSuccess && addingId === current.imdbId ? (
                    <span className="inline-flex items-center gap-1 animate-stamp">
                      <Check size={16} /> Guardada
                    </span>
                  ) : (
                    <>
                      <Clock size={16} /> Añadir a Pendientes
                    </>
                  )}
                </button>

                {/* Botón Registrar Vista */}
                <Link
                  href={`/peliculas/nueva?imdbId=${current.imdbId}`}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover text-bg rounded transition-colors"
                >
                  <Film size={16} /> Registrar Vista
                </Link>

                {/* Botón Ignorar */}
                <button
                  type="button"
                  disabled={isAdding || isIgnoring || isSuccess}
                  onClick={() => handleIgnore(current)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded border border-border text-text-faint hover:text-error hover:border-error/30 bg-transparent transition-colors"
                  title="Ignorar esta película (no volverá a aparecer)"
                >
                  {isIgnoring ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <EyeOff size={16} /> No me interesa
                    </>
                  )}
                </button>
              </div>

              {/* Alternar tráiler si tiene clave */}
              {current.trailerKey && (
                <button
                  onClick={() => setShowTrailer(!showTrailer)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-mono border border-border hover:border-text-mid rounded transition-colors text-text-mid hover:text-text"
                >
                  {showTrailer ? (
                    <>
                      <ImageIcon size={14} /> Mostrar Ficha/Póster
                    </>
                  ) : (
                    <>
                      <Play size={14} className="fill-current" /> Reproducir Tráiler
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
