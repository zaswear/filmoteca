import { db } from "@/lib/db";
import { dominantGenre, recordMonth, watchStreaks } from "@/lib/stats-narrative";
import { StatsCharts } from "./stats-charts";

export interface StatsData {
  summary: {
    total:          number;   // sin descartadas: lo mismo que enseña /peliculas
    discarded:      number;
    watched:        number;
    avgMyRating:    number | null;
    avgImdbRating:  number | null;
    totalWithRating: number;
  };
  byGenre:     { genre: string; count: number }[];
  byMonth:     { month: string; label: string; count: number }[];
  byDirector:  { director: string; count: number }[];
  histogram:   { label: string; count: number }[];
  byYear:      { year: number; count: number }[];
  byDecade:    { label: string; count: number }[];
  /**
   * Las «joyas ocultas», ya calculadas. Antes viajaban al navegador las 490
   * películas crudas —con sus géneros y directores en JSON— solo para sacar
   * estas seis líneas, y eran la mayor parte del peso de /balance.
   */
  gems: { directors: Joya[]; genres: Joya[] };
  watchDates:  string[];
  // Tarjetas narrativas; cada campo es `null` cuando no hay datos que contar,
  // y el cliente no pinta la tarjeta.
  recordMonth:   { label: string; count: number } | null;
  streaks:       { current: number; best: number } | null;
  houseDirector: { director: string; count: number } | null;
  genreThisYear: { genre: string; count: number } | null;
  genreGlobal:   { genre: string; count: number } | null;
  currentYear:   number;
}

export interface Joya {
  name: string;
  average: number;
  count: number;
}

/** Puntuado alto con muy pocas películas: lo que te gusta y casi no ves. */
function joyas(
  cuentas: Record<string, { ratings: number[]; count: number }>,
  maxPeliculas: number,
): Joya[] {
  return Object.entries(cuentas)
    .map(([name, { ratings, count }]) => ({
      name,
      average: Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10,
      count,
    }))
    .filter((x) => x.count > 0 && x.count <= maxPeliculas && x.average >= 8)
    .sort((a, b) => b.average - a.average || a.count - b.count)
    .slice(0, 3);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function buildMonthSeries(entries: { key: string; label: string }[], counts: Record<string, number>) {
  return entries.map(({ key, label }) => ({ month: key, label, count: counts[key] ?? 0 }));
}

function last24Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    result.push({ key, label });
  }
  return result;
}

/**
 * Las gráficas del diario. Vivían en `/stats`, una entrada propia del menú
 * junto a «Balance mensual»; las dos eran mirar atrás con números y estaban
 * partidas sin motivo, así que ahora las dos comparten la pantalla /balance.
 */
export async function StatsSection() {
  const movies = await db.movie.findMany();

  // ── Summary ──
  const watched       = movies.filter((m) => m.status === "vista");
  const myRatings     = movies.map((m) => m.myRating).filter((r): r is number => r !== null);
  const imdbRatings   = movies.map((m) => m.imdbRating).filter((r): r is number => r !== null);

  // ── Géneros ──
  const genreCounts: Record<string, number> = {};
  for (const m of movies) {
    const genres: string[] = JSON.parse(m.genres || "[]");
    for (const g of genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }
  const byGenre = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // ── Por mes (últimos 24 meses) ──
  const monthCounts: Record<string, number> = {};
  for (const m of movies) {
    if (!m.watchedAt) continue;
    const d = new Date(m.watchedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const byMonth = buildMonthSeries(last24Months(), monthCounts);

  // ── Por año ──
  const yearCounts: Record<number, number> = {};
  for (const m of movies) {
    if (!m.watchedAt) continue;
    const y = new Date(m.watchedAt).getFullYear();
    yearCounts[y] = (yearCounts[y] ?? 0) + 1;
  }
  const byYear = Object.entries(yearCounts)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);

  // ── Por década ──
  const decadeCounts: Record<string, number> = {};
  for (const m of movies) {
    if (!m.year) continue;
    const decade = `${Math.floor(m.year / 10) * 10}s`;
    decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
  }
  const byDecade = Object.entries(decadeCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ── Directores ──
  const directorCounts: Record<string, number> = {};
  for (const m of movies) {
    const directors: string[] = JSON.parse(m.directors || "[]");
    for (const d of directors) directorCounts[d] = (directorCounts[d] ?? 0) + 1;
  }
  const byDirector = Object.entries(directorCounts)
    .map(([director, count]) => ({ director, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Histograma mis notas ──
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    count: 0,
  }));
  for (const r of myRatings) {
    const idx = r === 10 ? 9 : Math.min(9, Math.max(0, Math.floor(r) - 1));
    histogram[idx].count++;
  }

  // /peliculas excluye las descartadas, así que enseñar aquí el total crudo de
  // la tabla (447) chocaba con las 289 de allí sin explicar la diferencia.
  const discarded = movies.filter((m) => m.status === "descartada");

  // ── Joyas ocultas ──
  const porDirector: Record<string, { ratings: number[]; count: number }> = {};
  const porGenero: Record<string, { ratings: number[]; count: number }> = {};
  for (const m of movies) {
    if (m.myRating == null) continue;
    const nota = m.myRating;
    const meter = (mapa: Record<string, { ratings: number[]; count: number }>, clave: string) => {
      if (!mapa[clave]) mapa[clave] = { ratings: [], count: 0 };
      mapa[clave].ratings.push(nota);
      mapa[clave].count += 1;
    };
    for (const d of JSON.parse(m.directors || "[]") as string[]) meter(porDirector, d);
    for (const g of JSON.parse(m.genres || "[]") as string[]) meter(porGenero, g);
  }
  const gems = { directors: joyas(porDirector, 2), genres: joyas(porGenero, 3) };

  const watchDates = movies
    .filter((m) => m.status === "vista" && m.watchedAt)
    .map((m) => m.watchedAt!.toISOString().slice(0, 10));

  const data: StatsData = {
    summary: {
      total:           movies.length - discarded.length,
      discarded:       discarded.length,
      watched:         watched.length,
      avgMyRating:     avg(myRatings),
      avgImdbRating:   avg(imdbRatings),
      totalWithRating: myRatings.length,
    },
    byGenre,
    byMonth,
    byDirector,
    histogram,
    byYear,
    byDecade,
    gems,
    watchDates,
    // ── Tarjetas narrativas ──
    recordMonth: recordMonth(byMonth),
    streaks: watchDates.length
      ? watchStreaks(watchDates, new Date().toISOString().slice(0, 10))
      : null,
    houseDirector: byDirector[0] ?? null,
    genreThisYear: dominantGenre(
      watched.map((m) => ({ genres: JSON.parse(m.genres || "[]") as string[], watchedAt: m.watchedAt })),
      new Date().getFullYear(),
    ),
    genreGlobal: byGenre[0] ?? null,
    currentYear: new Date().getFullYear(),
  };

  return <StatsCharts data={data} />;
}
