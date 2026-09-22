// Agregaciones puras para las tarjetas narrativas de /balance (mes récord,
// rachas de visionado, género dominante). Sin dependencias para poder
// probarlas con node:test, igual que lib/monthly-balance.ts.

export interface MonthDatum {
  month: string;
  label: string;
  count: number;
}

export interface GenreEntry {
  genres: string[];
  watchedAt: Date | string | null;
}

/** Mes con más sesiones de la serie mensual. `null` si no hay ninguna. */
export function recordMonth(byMonth: MonthDatum[]): { label: string; count: number } | null {
  let best: MonthDatum | null = null;
  for (const m of byMonth) {
    if (m.count > 0 && (!best || m.count > best.count)) best = m;
  }
  return best ? { label: best.label, count: best.count } : null;
}

// ─── Rachas ───────────────────────────────────────────────────────────────────
// Las fechas van en ISO "YYYY-MM-DD" (UTC, como produce `toISOString().slice`),
// así que la aritmética de días se hace en UTC para no depender del huso.

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Rachas de días consecutivos con al menos una película vista.
 * La actual cuenta hacia atrás desde `today`; si hoy no hay visionado, desde
 * ayer (una racha no muere hasta que pasa un día entero sin cine).
 */
export function watchStreaks(dates: string[], today: string): { current: number; best: number } {
  const days = new Set(dates);

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  let anchor = today;
  if (!days.has(anchor)) anchor = addDays(today, -1);
  let current = 0;
  while (days.has(addDays(anchor, -current))) current++;

  return { current, best };
}

/** Género con más películas. Con `year`, solo cuenta las vistas ese año. */
export function dominantGenre(entries: GenreEntry[], year?: number): { genre: string; count: number } | null {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (year !== undefined) {
      if (!e.watchedAt) continue;
      if (new Date(e.watchedAt).getFullYear() !== year) continue;
    }
    for (const g of e.genres) counts[g] = (counts[g] ?? 0) + 1;
  }
  let top: { genre: string; count: number } | null = null;
  for (const [genre, count] of Object.entries(counts)) {
    if (!top || count > top.count) top = { genre, count };
  }
  return top;
}
