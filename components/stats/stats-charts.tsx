"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { StatsData } from "./stats-section";

import { DATE_LOCALE, t } from "@/lib/i18n";
// ─── Barras inline (sin dependencias de charting) ─────────────────────────────

type Datum = { label: string; value: number };

/** Barras verticales. Etiqueta cada `step` para no saturar en series densas. */
function VBars({ data, height = 180 }: { data: Datum[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(data.length / 12));
  return (
    <div className="bg-(--surface) border border-(--border) rounded-md p-4 sm:p-5">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group relative flex-1 min-w-0 h-full flex items-end"
            title={`${d.label}: ${d.value}`}
          >
            <div
              className="w-full rounded-t-[3px] bg-(--accent) transition-[height] duration-500 group-hover:bg-(--accent-hover)"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 min-w-0 text-center font-mono text-[9px] text-text-faint truncate">
            {i % step === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales con etiqueta y valor. */
function HBars({ data, color = "var(--accent)" }: { data: Datum[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bg-(--surface) border border-(--border) rounded-md p-4 sm:p-5 space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-20 sm:w-32 shrink-0 truncate text-right font-mono text-[11px] text-text-faint">
            {d.label}
          </span>
          <div className="flex-1 h-5 rounded-[3px] bg-(--surface-hi) overflow-hidden">
            <div
              className="h-full rounded-[3px] transition-[width] duration-500"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-[11px] text-text-mid tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-(--surface) border border-(--border) rounded-md px-4 py-4 sm:px-6 sm:py-5">
      <p className="font-mono text-[30px] sm:text-[38px] leading-none font-bold" style={{ color: "var(--accent)" }}>
        {value ?? "—"}
      </p>
      <p className="text-[11px] uppercase tracking-widest text-text-faint mt-2">{label}</p>
      {sub && <p className="text-xs text-text-faint mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display font-semibold text-[22px] italic text-text mb-4 pb-2 border-b border-(--border)">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Suscripción vacía: nada cambia nunca, solo interesa la diferencia entre el
 *  valor del servidor y el del cliente. */
const SIN_CAMBIOS = () => () => {};

export function StatsCharts({ data }: { data: StatsData }) {
  // El mapa de calor y las joyas usan `new Date()`, así que en el servidor
  // saldría una fecha distinta que en el navegador y la hidratación se
  // quejaría. `useSyncExternalStore` da exactamente ese dato —false en el
  // servidor, true en el cliente— sin poner `setState` dentro de un efecto,
  // que es lo que el lint prohíbe y lo que provocaba un render en cascada de
  // toda la pantalla de estadísticas nada más abrirla.
  const mounted = useSyncExternalStore(SIN_CAMBIOS, () => true, () => false);

  const { summary, byGenre, byDirector, histogram, byDecade } = data;

  // Datos del mapa de calor (últimos 365 días).
  const heatmapData = useMemo(() => {
    if (!mounted || !data.watchDates) return [];
    const counts: Record<string, number> = {};
    data.watchDates.forEach((dateStr) => {
      counts[dateStr] = (counts[dateStr] ?? 0) + 1;
    });
    const days = [];
    const now = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d, key, count: counts[key] || 0 });
    }
    return days;
  }, [mounted, data.watchDates]);

  // Agrupar en semanas (columnas) × día de la semana (filas).
  const weeks = useMemo(() => {
    if (heatmapData.length === 0) return [];
    const weeksArray: (typeof heatmapData[number] | null)[][] = [];
    let currentWeek: (typeof heatmapData[number] | null)[] = [];
    const startDayOfWeek = heatmapData[0].date.getDay();
    for (let i = 0; i < startDayOfWeek; i++) currentWeek.push(null);
    heatmapData.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeksArray.push(currentWeek);
    }
    return weeksArray;
  }, [heatmapData]);

  const heatmapMonths = useMemo(() => {
    if (heatmapData.length === 0 || weeks.length === 0) return [];
    const months: { label: string; weekIndex: number }[] = [];
    // Los nombres de mes los da Intl, no una lista escrita: así salen en el
    // idioma de la instancia sin un diccionario que mantener.
    const fmtMes = new Intl.DateTimeFormat(DATE_LOCALE, { month: "short" });
    const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
      fmtMes.format(new Date(Date.UTC(2020, i, 1))),
    );
    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
      const day = week.find((d) => d !== null);
      if (day) {
        const m = day.date.getMonth();
        if (m !== lastMonth) {
          months.push({ label: MONTH_NAMES[m], weekIndex: weekIdx });
          lastMonth = m;
        }
      }
    });
    return months;
  }, [heatmapData, weeks]);

  // Las joyas ocultas ya vienen calculadas del servidor: antes se derivaban
  // aquí de las 490 películas crudas, que había que mandar enteras al
  // navegador para sacar seis líneas.
  const gems = data.gems;

  return (
    <div className="space-y-12">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={summary.watched} label={t("stats.peliculasVistas")} />
        <StatCard value={summary.avgMyRating ?? "—"} label={t("stats.notaMedia")} sub={`sobre ${summary.totalWithRating}`} />
        <StatCard value={summary.avgImdbRating ?? "—"} label="Puntuación IMDb" />
      </div>

      {/* ── Hitos del diario ── */}
      {(data.recordMonth || data.streaks || data.houseDirector || data.genreThisYear || data.genreGlobal) && (
        <Section title={t("stats.hitos")}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recordMonth && (
              <StatCard
                value={data.recordMonth.count}
                label={t("stats.mesRecord")}
                sub={`${data.recordMonth.label} · ${data.recordMonth.count} ${data.recordMonth.count === 1 ? t("stats.pelicula") : t("stats.peliculas")}`}
              />
            )}
            {data.streaks && (
              <StatCard
                value={data.streaks.current}
                label={t("stats.rachaActual")}
                sub={`${data.streaks.current === 1 ? t("stats.diaSeguido") : t("stats.diasSeguidos")} con cine`}
              />
            )}
            {data.streaks && (
              <StatCard
                value={data.streaks.best}
                label={t("stats.mejorRacha")}
                sub={`${data.streaks.best === 1 ? t("stats.diaSeguido") : t("stats.diasSeguidos")} con cine`}
              />
            )}
            {data.houseDirector && (
              <StatCard
                value={data.houseDirector.count}
                label={t("stats.directorCasa")}
                sub={data.houseDirector.director}
              />
            )}
            {data.genreThisYear && (
              <StatCard
                value={data.genreThisYear.count}
                label={`Tu año en géneros · ${data.currentYear}`}
                sub={`${data.genreThisYear.genre} lidera el año`}
              />
            )}
            {data.genreGlobal && (
              <StatCard
                value={data.genreGlobal.count}
                label={t("stats.anioGeneros")}
                sub={`${data.genreGlobal.genre} en todo el diario`}
              />
            )}
          </div>
        </Section>
      )}

      {/* ── Década + Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {byDecade.length > 1 && (
          <Section title={t("stats.porDecada")}>
            <VBars data={byDecade.map((d) => ({ label: d.label, value: d.count }))} height={200} />
          </Section>
        )}

        {mounted && heatmapData.length > 0 && (
          <Section title={t("stats.actividad")}>
            <div className="bg-(--surface) border border-(--border) rounded-md p-4 sm:p-5 overflow-x-auto">
              <div className="min-w-[680px] flex flex-col">
                <svg width="700" height="120" className="text-text font-mono text-[9px]">
                  {heatmapMonths.map((m, idx) => (
                    <text key={idx} x={35 + m.weekIndex * 13} y={12} fill="var(--text-faint)">{m.label}</text>
                  ))}
                  <text x={0} y={42} fill="var(--text-faint)">{t("stats.lun")}</text>
                  <text x={0} y={68} fill="var(--text-faint)">{t("stats.mie")}</text>
                  <text x={0} y={94} fill="var(--text-faint)">{t("stats.vie")}</text>
                  {weeks.map((week, weekIdx) => (
                    <g key={weekIdx} transform={`translate(${35 + weekIdx * 13}, 20)`}>
                      {week.map((day, dayIdx) => {
                        if (!day) return null;
                        let fill = "oklch(100% 0 0 / 4%)";
                        if (day.count === 1) fill = "oklch(74% 0.13 72 / 35%)";
                        else if (day.count === 2) fill = "oklch(74% 0.13 72 / 70%)";
                        else if (day.count >= 3) fill = "var(--accent)";
                        return (
                          <rect key={dayIdx} x={0} y={dayIdx * 13} width={10} height={10} rx={1.5} fill={fill}
                            className="transition-colors duration-150 hover:stroke-white hover:stroke-[0.5px] cursor-pointer">
                            <title>{`${day.key}: ${day.count} ${day.count === 1 ? t("stats.peliculaVista") : t("stats.peliculasVistasMin")}`}</title>
                          </rect>
                        );
                      })}
                    </g>
                  ))}
                </svg>
                <div className="flex justify-end items-center gap-1.5 text-[10px] text-text-faint font-mono mt-3 pr-4">
                  <span>{t("stats.menos")}</span>
                  <span className="w-2.5 h-2.5 rounded-[1.5px]" style={{ backgroundColor: "oklch(100% 0 0 / 4%)" }} />
                  <span className="w-2.5 h-2.5 rounded-[1.5px]" style={{ backgroundColor: "oklch(74% 0.13 72 / 35%)" }} />
                  <span className="w-2.5 h-2.5 rounded-[1.5px]" style={{ backgroundColor: "oklch(74% 0.13 72 / 70%)" }} />
                  <span className="w-2.5 h-2.5 rounded-[1.5px]" style={{ backgroundColor: "var(--accent)" }} />
                  <span>{t("stats.mas")}</span>
                </div>
              </div>
            </div>
          </Section>
        )}
      </div>

      {/* ── Género + Directores ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {byGenre.length > 0 && (
          <Section title={t("stats.generosMas")}>
            <HBars data={byGenre.map((g) => ({ label: g.genre, value: g.count }))} />
          </Section>
        )}
        {byDirector.length > 0 && (
          <Section title={t("stats.topDirectores")}>
            <HBars data={byDirector.map((d) => ({ label: d.director, value: d.count }))} color="oklch(67% 0.12 155)" />
          </Section>
        )}
      </div>

      {/* ── Joyas Ocultas ── */}
      {(gems.directors.length > 0 || gems.genres.length > 0) && (
        <Section title={t("stats.joyas")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">{t("stats.joyasAyuda")}</h3>
              {gems.directors.length === 0 ? (
                <p className="text-sm text-text-faint bg-(--surface) border border-(--border) rounded px-4 py-3 italic">{t("stats.joyasVacio")}</p>
              ) : (
                <div className="space-y-3">
                  {gems.directors.map((d) => (
                    <div key={d.name} className="flex justify-between items-center bg-(--surface) border border-(--border) rounded px-4 py-3">
                      <div>
                        <p className="font-display font-medium text-base italic">{d.name}</p>
                        <p className="text-xs text-text-faint mt-0.5">{d.count} {d.count === 1 ? t("stats.peliculaVista") : t("stats.peliculasVistasMin")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-(--accent)">{d.average.toFixed(1)}</p>
                        <p className="text-[9px] uppercase tracking-widest text-text-faint">{t("stats.notaMedia")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">{t("stats.joyasGeneros")}</h3>
              {gems.genres.length === 0 ? (
                <p className="text-sm text-text-faint bg-(--surface) border border-(--border) rounded px-4 py-3 italic">{t("stats.joyasGenerosVacio")}</p>
              ) : (
                <div className="space-y-3">
                  {gems.genres.map((g) => (
                    <div key={g.name} className="flex justify-between items-center bg-(--surface) border border-(--border) rounded px-4 py-3">
                      <div>
                        <p className="font-display font-medium text-base italic">{g.name}</p>
                        <p className="text-xs text-text-faint mt-0.5">{g.count} {g.count === 1 ? t("stats.peliculaVista") : t("stats.peliculasVistasMin")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-(--accent)">{g.average.toFixed(1)}</p>
                        <p className="text-[9px] uppercase tracking-widest text-text-faint">{t("stats.notaMedia")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Histograma de notas ── */}
      {summary.totalWithRating > 0 && (
        <Section title={`Distribución de mis notas (${summary.totalWithRating} puntuadas)`}>
          <VBars data={histogram.map((h) => ({ label: h.label, value: h.count }))} height={180} />
          <div className="flex justify-between text-[10px] text-text-faint font-mono mt-1 px-1">
            <span>1 — Terrible</span>
            <span>5 — Regular</span>
            <span>10 — Obra maestra</span>
          </div>
        </Section>
      )}

      {/* ── Sesiones por mes (los byMonth que ya se calculaban en servidor) ── */}
      {data.byMonth.some((m) => m.count > 0) && (
        <Section title={t("stats.ultimos24")}>
          <VBars data={data.byMonth.map((m) => ({ label: m.label, value: m.count }))} height={180} />
        </Section>
      )}
    </div>
  );
}
