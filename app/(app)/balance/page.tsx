import Link from "next/link";
import { db } from "@/lib/db";
import { monthlyBalance } from "@/lib/monthly-balance";
import { JournalPoster } from "@/components/movies/journal-poster";
import { StatsSection } from "@/components/stats/stats-section";
export const dynamic = "force-dynamic";
export const metadata = { title: "Balance" };
export default async function BalancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const month = mes && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
  const [vistas, revisionados] = await Promise.all([
    db.movie.findMany({ where: { status: "vista" }, orderBy: [{ watchedAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, status: true, watchedAt: true, myRating: true, durationMin: true, posterUrl: true } }),
    // Los revisionados del mes cuentan como visionado: si vuelves a ver algo en
    // octubre, octubre lo tiene. Van con su propia fecha y su propia nota, que
    // puede no ser la que le pusiste la primera vez.
    db.viewing.findMany({
      where: { watchedAt: { gte: new Date(`${month}-01T00:00:00Z`), lt: new Date(new Date(`${month}-01T00:00:00Z`).setUTCMonth(new Date(`${month}-01T00:00:00Z`).getUTCMonth() + 1)) } },
      orderBy: { watchedAt: "desc" },
      select: { id: true, watchedAt: true, myRating: true, movie: { select: { id: true, title: true, durationMin: true, posterUrl: true } } },
    }),
  ]);

  // Un revisionado entra en el balance como una entrada más, con un id
  // negativo para no chocar con el de una película.
  const entries = [
    ...vistas,
    ...revisionados.map((v) => ({
      id: -v.id,
      title: v.movie.title,
      status: "vista",
      watchedAt: v.watchedAt,
      myRating: v.myRating,
      durationMin: v.movie.durationMin,
      posterUrl: v.movie.posterUrl,
    })),
  ];
  const balance = monthlyBalance(entries, month);
  const label = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-8">
    <header className="space-y-3">
      <Link href="/peliculas?status=vista&sort=watchedAt" className="text-accent text-sm">← Volver al diario</Link>
      <h1 className="font-display text-4xl">Balance</h1>
      <p className="font-mono text-text-mid text-lg">Estadísticas y balance mensual, juntos: las dos son mirar atrás.</p>
      <form className="flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-sm">Mes de visionado<input type="month" name="mes" defaultValue={month} key={month} min="1900-01" max="2099-12" required className="min-h-11 bg-surface border border-border rounded px-3" /></label>
        <button className="min-h-11 px-4 bg-accent text-bg rounded">Ver balance</button>
      </form>
    </header>
    <section aria-label={label} className="space-y-4">
      <h2 className="font-display text-3xl">{label}</h2>
      {balance.movies.length ? <>
        <p className="text-text-mid leading-relaxed max-w-prose">
          {balance.movies.length} películas vistas. {balance.average === null ? "Todavía sin puntuaciones." : `Nota media: ${balance.average.toFixed(1)} de 10, sobre ${balance.ratedCount} películas puntuadas.`}
          {balance.durationsCount > 0 && ` ${balance.minutes} minutos de cine con duración conocida (${balance.durationsCount} de ${balance.movies.length}).`}
        </p>
        {balance.favorites.length > 0 && <p className="text-accent">Tu mejor nota: {balance.favorites.map((entry) => entry.title).join(" · ")} ({balance.favorites[0].myRating}/10)</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {balance.movies.map((entry) => <div key={entry.id}><JournalPoster movie={entry} /><p className="text-sm text-text-mid">{entry.watchedAt?.toISOString().slice(0, 10)}</p></div>)}
        </div>
      </> : <p className="text-text-mid">No hay películas vistas con fecha en este mes. <Link className="text-accent underline" href="/peliculas/nueva">Registrar una película</Link></p>}
    </section>
    <p className="text-sm text-text-mid max-w-prose">Calculado con la fecha de visionado guardada, no con la fecha de importación. {balance.undated} películas vistas sin fecha quedan fuera del balance. Cada película tiene un único registro; no se cuentan revisionados separados.</p>
    <section aria-label="Estadísticas del diario" className="pt-4 border-t border-(--border) space-y-6">
      <h2 className="font-display text-3xl">Todo el diario</h2>
      <StatsSection />
    </section>
  </div>;
}
