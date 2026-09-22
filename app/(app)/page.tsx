import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarClock, Plus } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

const DIA = 24 * 60 * 60 * 1000;

function haceCuanto(fecha: Date | null): string {
  if (!fecha) return "sin fecha";
  const dias = Math.round((Date.now() - fecha.getTime()) / DIA);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

const nota = (n: number) => n.toString().replace(".", ",");

const fmtEstreno = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

/**
 * El diario no tenía inicio: `/` redirigía al listado de 490 películas. Esta
 * pantalla contesta «¿y ahora qué?»: lo último que viste, tres pendientes que
 * podrías ver esta noche, y el atajo a que la app elija por ti.
 */
/** Las cifras y el atajo a «elige por mí». Viven aparte porque tienen que
 *  aparecer también cuando no hay ninguna película con fecha de visionado:
 *  antes colgaban del bloque de la última vista y un diario recién empezado se
 *  quedaba sin resumen, sin acción y sin encabezado. */
function Resumen({ cifras, className }: { cifras: { k: string; v: string }[]; className?: string }) {
  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <dl className="flex border-t border-(--text)">
        {cifras.map((c) => (
          <div key={c.k} className="flex-1 py-4 pr-3 border-r border-(--border) last:border-r-0">
            <dd className="font-display text-[26px] sm:text-[32px] text-text leading-none">{c.v}</dd>
            <dt className="font-mono text-base text-text-mid mt-1">{c.k}</dt>
          </div>
        ))}
      </dl>
      <Link
        href="/que-ver"
        className="flex items-center justify-between gap-4 min-h-[60px] px-5 bg-(--text) text-(--bg) hover:opacity-90 transition-opacity"
      >
        <span className="font-display text-[17px]">No sé qué ver — elige por mí</span>
        <ArrowRight size={21} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function InicioPage() {
  // Server component: se renderiza una vez por request, Date.now() es estable aquí.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const hace7 = new Date(now - 7 * DIA);
  const en14 = new Date(now + 14 * DIA);
  const [ultima, pendientes, vistas, conNota, totalPendientes, descartadas, estrenos] =
    await Promise.all([
    db.movie.findFirst({
      where: { status: "vista", watchedAt: { not: null } },
      orderBy: [{ watchedAt: "desc" }, { id: "desc" }],
    }),
    db.movie.findMany({
      where: {
        status: "pendiente",
        OR: [{ releaseDate: null }, { releaseDate: { lte: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, posterUrl: true, directors: true, durationMin: true },
    }),
    db.movie.count({ where: { status: "vista" } }),
    db.movie.aggregate({ _avg: { myRating: true }, _count: { myRating: true } }),
    db.movie.count({ where: { status: "pendiente" } }),
    db.movie.count({ where: { status: "descartada" } }),
    db.movie.findMany({
      where: {
        status: "pendiente",
        releaseDate: { not: null, gte: hace7, lte: en14 },
      },
      orderBy: { releaseDate: "asc" },
      select: { id: true, title: true, posterUrl: true, releaseDate: true },
    }),
  ]);

  const media = conNota._avg.myRating;
  const cifras = [
    { k: "Vistas", v: String(vistas) },
    { k: "Nota media", v: media === null ? "—" : nota(Math.round(media * 10) / 10) },
    { k: "Pendientes", v: String(totalPendientes) },
    { k: "Descartadas", v: String(descartadas) },
  ];

  const director = (raw: string | null) => {
    if (!raw) return null;
    try {
      const lista: string[] = JSON.parse(raw);
      return lista[0] ?? null;
    } catch {
      return null;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-12">

      {ultima ? (
        <section className="space-y-4">
          <h1 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">
            Lo último que viste · {haceCuanto(ultima.watchedAt)}
          </h1>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <Link href={`/peliculas/${ultima.id}`} className="relative block w-[220px] sm:w-[300px] shrink-0">
              {ultima.posterUrl ? (
                <Image
                  src={ultima.posterUrl}
                  alt={`Cartel de ${ultima.title}`}
                  width={300}
                  height={450}
                  className="w-full h-auto object-cover"
                  priority
                />
              ) : (
                <span className="flex items-end p-4 w-full aspect-[2/3] bg-(--text) font-display text-[22px] text-(--bg)">
                  {ultima.title}
                </span>
              )}
              {ultima.myRating !== null && (
                <span className="absolute left-0 bottom-0 w-14 h-14 sm:w-[60px] sm:h-[60px] bg-(--accent) text-(--bg) font-display text-[24px] flex items-center justify-center">
                  {nota(ultima.myRating)}
                </span>
              )}
            </Link>

            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <Link href={`/peliculas/${ultima.id}`}>
                <h2 className="font-display text-[40px] sm:text-[58px] leading-[0.98] text-text">{ultima.title}</h2>
              </Link>
              <p className="font-mono text-lg text-text-mid">
                {[director(ultima.directors), ultima.year, ultima.durationMin && `${ultima.durationMin} min`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {ultima.notes && (
                <p className="font-mono text-xl leading-relaxed text-text max-w-[46ch]">{ultima.notes}</p>
              )}

              <Resumen cifras={cifras} className="mt-auto pt-4" />
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-[40px] sm:text-[52px] leading-[0.98] text-text">
              Tu diario está en blanco
            </h1>
            <p className="font-mono text-xl text-text-mid max-w-[52ch]">
              {vistas > 0
                ? "Tienes películas vistas, pero ninguna con fecha de visionado, así que no hay una «última». Al registrar la fecha aparecerán aquí."
                : "Registra la primera película que hayas visto y esta pantalla empezará a contarte por dónde vas."}
            </p>
          </div>
          <Resumen cifras={cifras} />
        </section>
      )}

      {estrenos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline gap-4">
            <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">
              Esta semana
            </h2>
            <span className="flex-1 h-px bg-(--border)" />
            <Link href="/watchlist" className="text-sm font-semibold text-accent">
              Próximos estrenos
            </Link>
          </div>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {estrenos.map((m) => {
              const disponible = m.releaseDate !== null && m.releaseDate.getTime() <= now;
              return (
                <li key={m.id} className="w-56 shrink-0">
                  <Link
                    href={`/peliculas/${m.id}`}
                    className="flex items-center gap-3 rounded-[8px] border border-(--border) bg-(--surface) p-2.5 transition-colors hover:border-(--border-hi)"
                  >
                    <div className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded bg-bg">
                      {m.posterUrl && (
                        <Image src={m.posterUrl} alt="" fill sizes="44px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold italic text-[15px] leading-tight text-text">
                        {m.title}
                      </p>
                      {m.releaseDate && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-(--accent-dim) px-2 py-0.5 font-mono text-[10px] text-(--accent)">
                          <CalendarClock size={11} aria-hidden="true" />
                          {disponible ? "Ya disponible" : `Sale el ${fmtEstreno(m.releaseDate)}`}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">
            Esta noche puedes ver
          </h2>
          <span className="flex-1 h-px bg-(--border)" />
          <Link href="/watchlist" className="text-sm font-semibold text-accent">
            Las {totalPendientes} pendientes
          </Link>
        </div>

        {pendientes.length === 0 ? (
          <p className="text-text-mid">
            No tienes pendientes disponibles.{" "}
            <Link href="/descubrir/cartelera" className="text-accent underline">Busca algo en Descubrir.</Link>
          </p>
        ) : (
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {pendientes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/peliculas/${p.id}`}
                  className="group flex flex-col gap-3 rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
                >
                  {p.posterUrl ? (
                    <span className="block overflow-hidden rounded-[4px] shadow-(--shadow-poster) transition-transform duration-200 ease-out group-hover:-translate-y-1 group-active:translate-y-0">
                      <Image
                        src={p.posterUrl}
                        alt={`Cartel de ${p.title}`}
                        width={300}
                        height={450}
                        className="w-full h-auto object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04] group-active:scale-100"
                      />
                    </span>
                  ) : (
                    <span className="flex items-end p-3 w-full aspect-[2/3] bg-(--text) font-display text-base text-(--bg) rounded-[4px] transition-transform duration-200 ease-out group-hover:-translate-y-1 group-active:translate-y-0">
                      {p.title}
                    </span>
                  )}
                  <span className="font-display text-[19px] leading-tight text-text transition-colors duration-150 group-hover:text-(--accent)">
                    {p.title}
                  </span>
                  <span className="font-mono text-base text-text-mid">
                    {[director(p.directors), p.durationMin && `${p.durationMin} min`].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/peliculas/nueva"
        className="inline-flex tap-target gap-2 px-5 bg-(--accent) text-(--bg) font-semibold"
      >
        <Plus size={16} aria-hidden="true" />
        Registrar una película
      </Link>
    </div>
  );
}
