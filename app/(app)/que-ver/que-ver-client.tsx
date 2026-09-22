"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Dices, Sparkles, Loader2, Clock, Play } from "lucide-react";
import type { MovieQueVer } from "@/lib/types";
import { MOODS, recommend, type TasteProfile, type WatchFilters, type Pick } from "@/lib/what-to-watch";
import { cn } from "@/lib/utils";

import { t } from "@/lib/i18n";
export function QueVerClient({
  pool,
  taste,
  aiEnabled,
}: {
  pool: MovieQueVer[];
  taste: TasteProfile;
  aiEnabled: boolean;
}) {
  const [moodKey, setMoodKey] = useState<string | null>(null);
  const [corta, setCorta] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [aiFilters, setAiFilters] = useState<WatchFilters | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [ran, setRan] = useState(false);

  // Filtros efectivos: la interpretación por IA tiene prioridad si existe.
  const filters: WatchFilters = useMemo(() => {
    if (aiFilters) return { ...aiFilters, maxRuntime: corta ? 100 : aiFilters.maxRuntime };
    const mood = MOODS.find((m) => m.key === moodKey);
    return {
      moodGenres: mood?.genres,
      minRating: mood?.minRating,
      maxRuntime: corta ? 100 : undefined,
    };
  }, [aiFilters, moodKey, corta]);

  const picks: Pick[] = useMemo(
    () => (ran ? recommend(pool, filters, taste, seededRandom(seed)) : []),
    [ran, pool, filters, taste, seed]
  );

  const hero = picks[0];
  const alts = picks.slice(1, 4);

  function recomendar() {
    setSeed((s) => s + 1);
    setRan(true);
  }

  async function interpret() {
    const text = freeText.trim();
    if (!text) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/que-ver/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as WatchFilters;
      setAiFilters(data);
      setAiNote(data.note ?? null);
      setMoodKey(null);
      setSeed((s) => s + 1);
      setRan(true);
    } catch {
      setAiNote(t("queVer.errorInterpretar"));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="border-b border-(--border) pb-6">
        <h1 className="font-display font-semibold text-[38px] italic leading-none text-text flex items-center gap-2">
          <Dices size={30} className="text-(--accent)" aria-hidden="true" />{t("queVer.titulo")}</h1>
        <p className="text-xs text-text-faint font-mono mt-2">{t("queVer.subtitulo")}</p>
      </div>

      {pool.length === 0 ? (
        <p className="text-sm text-text-faint bg-(--surface) border border-(--border) rounded-md px-4 py-6 text-center italic">{t("queVer.sinPendientes")}</p>
      ) : (
        <>
          {/* Texto libre (IA) */}
          {aiEnabled && (
            <div>
              <label htmlFor="qv-text" className="block text-[11px] uppercase tracking-widest text-text-faint mb-1.5">{t("queVer.dime")}</label>
              <div className="flex gap-2">
                <input
                  id="qv-text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && interpret()}
                  placeholder={t("queVer.placeholder")}
                  className="flex-1 bg-(--surface) border border-(--border) rounded-[6px] px-3 py-2 text-[15px] text-text placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus)"
                />
                <button
                  onClick={interpret}
                  disabled={aiBusy || !freeText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-(--surface-hi) border border-(--border) rounded-[6px] text-sm text-text hover:border-(--accent) transition-colors disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className="text-(--accent)" />}
                  Interpretar
                </button>
              </div>
            </div>
          )}

          {/* Ánimos */}
          <div className="space-y-3">
            <span className="block text-[11px] uppercase tracking-widest text-text-faint">{t("queVer.elegirAnimo")}</span>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setMoodKey(m.key === moodKey ? null : m.key); setAiFilters(null); setAiNote(null); }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    moodKey === m.key && !aiFilters
                      ? "border-(--accent) bg-(--accent-dim) text-(--accent)"
                      : "border-(--border) text-text-mid hover:border-(--border-hi) hover:text-text"
                  )}
                >
                  {m.label}
                </button>
              ))}
              <button
                onClick={() => setCorta((c) => !c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  corta
                    ? "border-(--accent) bg-(--accent-dim) text-(--accent)"
                    : "border-(--border) text-text-mid hover:border-(--border-hi) hover:text-text"
                )}
              >
                <Clock size={13} />{t("queVer.nocheCorta")}</button>
            </div>
          </div>

          {aiNote && <p className="text-xs text-(--accent) font-mono">✦ {aiNote}</p>}

          {/* Acción */}
          <button
            onClick={recomendar}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-semibold rounded-[6px] transition-colors"
          >
            <Dices size={16} /> {ran ? t("queVer.otra") : t("queVer.recomiendame")}
          </button>

          {/* Resultado */}
          {ran && !hero && (
            <p className="text-sm text-text-faint italic">{t("queVer.sinEncaje")}</p>
          )}

          {hero && (
            <div className="space-y-6">
              <HeroPick pick={hero} />
              {alts.length > 0 && (
                <div>
                  <span className="block text-[11px] uppercase tracking-widest text-text-faint mb-3">{t("queVer.otrasOpciones")}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {alts.map((p) => (
                      <Link
                        key={p.movie.id}
                        href={`/peliculas/${p.movie.id}`}
                        className="flex items-center gap-3 rounded-[8px] border border-(--border) bg-(--surface) p-2.5 transition-colors hover:border-(--border-hi)"
                      >
                        <div className="relative aspect-2/3 w-10 shrink-0 overflow-hidden rounded bg-bg">
                          {p.movie.posterUrl && <Image src={p.movie.posterUrl} alt="" fill sizes="40px" className="object-cover" />}
                        </div>
                        <p className="truncate font-display font-semibold italic text-sm text-text">{p.movie.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HeroPick({ pick }: { pick: Pick }) {
  const m = pick.movie;
  return (
    <div className="flex flex-col sm:flex-row gap-5 rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5">
      <div className="relative aspect-2/3 w-32 sm:w-40 shrink-0 overflow-hidden rounded-md bg-bg shadow-poster">
        {m.posterUrl && <Image src={m.posterUrl} alt={m.title} fill sizes="160px" className="object-cover" priority />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <h2 className="font-display font-semibold italic text-2xl leading-tight text-text">{m.title}</h2>
        <p className="text-xs text-text-faint font-mono mt-1">
          {m.year ?? "—"}{m.durationMin ? ` · ${m.durationMin} min` : ""}{m.imdbRating ? ` · IMDb ${m.imdbRating}` : ""}
        </p>
        {pick.reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {pick.reasons.map((r, i) => (
              <li key={i} className="text-sm text-text-mid flex items-start gap-2">
                <span className="text-(--accent) mt-0.5">›</span> {r}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/peliculas/${m.id}`}
          className="mt-auto self-start inline-flex items-center gap-1.5 px-4 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-semibold rounded-[6px] transition-colors"
        >
          <Play size={14} className="fill-current" />{t("queVer.verFicha")}</Link>
      </div>
    </div>
  );
}

// Mapea un entero de "otra" a un seed 0..1 estable.
function seededRandom(n: number): number {
  const x = Math.sin(n * 99991 + 1) * 10000;
  return x - Math.floor(x);
}
