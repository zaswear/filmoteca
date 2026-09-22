"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ArrowUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MovieItem } from "@/lib/movie-item";
import { MOVIE_STATUS_LABELS, type MovieStatus } from "@/lib/types";
import { SeatIcon } from "@/components/ui/seat-icon";


// El contrato de filtros, su ida y vuelta a la URL y la traducción a consulta
// viven en lib/movie-query.ts: ahora los comparten este componente y la página
// de servidor, que es quien filtra, ordena y pagina.
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  pageSizeFor,
  parseFilters,
  toQuery,
  type Filters,
  type SortKey,
  type ViewMode,
} from "@/lib/movie-query";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Clave de día local (YYYY-MM-DD) para agrupar visionados del mismo día. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Días con 2+ visionados → cuántas películas se vieron ese día. */
function countMarathonDays(movies: MovieItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  movies.forEach((m) => {
    if (m.status !== "vista" || !m.watchedAt) return;
    const key = localDayKey(m.watchedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

/** Visión del conteo sobre la página que recibe el componente
 *  (filtrada y paginada fuera): lo que no se ve, no cuenta. */
function marathonCountFor(m: MovieItem, days: Map<string, number>): number | null {
  if (m.status !== "vista" || !m.watchedAt) return null;
  const count = days.get(localDayKey(m.watchedAt));
  return count && count >= 2 ? count : null;
}
// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  /** Solo la página pedida, ya filtrada y ordenada por la consulta. */
  movies: MovieItem[];
  /** Cuántas hay en total con estos filtros, para la paginación. */
  total: number;
  /** Opciones de los desplegables, sacadas de todo el catálogo. */
  generos: string[];
  anios: number[];
}

export function MoviesList({ movies, total, generos, anios }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();
  const filters    = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);

  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // El input de búsqueda escribe en la URL con debounce, así que necesita su
  // propio borrador para no ir a tirones mientras escribes. Se resincroniza
  // cuando la URL cambia por fuera (atrás, enlace pegado, recarga) con el patrón
  // de React para ajustar estado durante el render, sin useEffect.
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [urlSearch, setUrlSearch] = useState(filters.search);
  if (urlSearch !== filters.search) {
    setUrlSearch(filters.search);
    setSearchDraft(filters.search);
  }

  // replace y no push: cada tecla o cambio de filtro no merece una entrada en el
  // historial. Al abrir una ficha, Next hace push, así que el atrás vuelve aquí
  // con el último estado ya reflejado en la URL.
  const apply = useCallback((next: Filters) => {
    const qs = toQuery(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Las opciones de los desplegables llegan del servidor: derivarlas de
  // `movies` daría solo los géneros y años de la página que estás viendo.
  const genres = generos;
  const years = anios;

  const set = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    apply({ ...filters, [key]: val, page: 1 });
  }, [filters, apply]);

  // Pagination must NOT reset page back to 1 (unlike `set`, which is for filters).
  const goToPage = useCallback((p: number) => {
    apply({ ...filters, page: p });
  }, [filters, apply]);

  function onSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearchDraft(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => set("search", v), 180);
  }

  // Ni filtrado ni corte en memoria: `movies` ES la página. El conteo de
  // maratón usa solo esa página visible: lo que no se ve, no cuenta.
  const marathonDays = useMemo(() => countMarathonDays(movies), [movies]);
  const pageSize  = pageSizeFor(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page      = Math.min(filters.page, pageCount);
  const paginated = movies;

  const hasActiveFilters =
    filters.status || filters.genre || filters.year || filters.director ||
    filters.hasImdbReview !== "all" || filters.importedFromImdb !== "all";

  function clearFilters() {
    apply({
      ...filters,
      status: "", genre: "", year: "", director: "",
      hasImdbReview: "all", importedFromImdb: "all", page: 1,
    });
  }

  // ── Shared Select style ──
  const selectCls = "bg-(--surface) border border-(--border) rounded-[6px] px-2.5 py-1.5 text-sm text-text focus:outline-hidden focus:border-(--border-focus) transition-colors";
  const inputCls  = "bg-(--surface) border border-(--border) rounded-[6px] px-3 py-1.5 text-sm text-text placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus) transition-colors";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      <nav aria-label="Accesos al diario" className="flex flex-wrap gap-2 px-3 sm:px-6 py-3 text-sm">
        <Link className="tap-target px-3 rounded border border-border" href="/peliculas?status=vista&sort=watchedAt">Últimas vistas</Link>
        <Link className="tap-target px-3 rounded border border-border" href="/watchlist">Pendientes</Link>
        <Link className="tap-target px-3 rounded border border-border" href="/balance">Balance</Link>
      </nav>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-3 border-b border-(--border) shrink-0 shrink-blur-header">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="font-display font-semibold italic text-[26px] leading-none text-text hidden sm:block">
            Diario
          </h1>

          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              aria-label="Buscar en mi diario"
              type="search"
              value={searchDraft}
              onChange={onSearch}
              placeholder="Buscar título, director…"
              className={cn(inputCls, "pl-8 w-full")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filters toggle */}
          <button
            aria-label="Filtros"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[6px] border transition-colors",
              showFilters || hasActiveFilters
                ? "border-(--border-focus) text-(--accent) bg-(--accent-dim)"
                : "border-(--border) text-text-mid hover:text-text hover:border-(--border-hi)"
            )}
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && (
              <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-(--accent)" />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="hidden sm:flex items-center gap-1 text-xs text-text-faint hover:text-(--error) transition-colors"
            >
              <X size={11} /> Limpiar
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {/* Sort */}
            <select
              value={filters.sortKey}
              onChange={(e) => set("sortKey", e.target.value as SortKey)}
              className={cn(selectCls, "hidden sm:block")}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Sort direction */}
            <button
              onClick={() => set("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc")}
              className="hidden sm:inline-flex tap-target rounded-[6px] border border-(--border) text-text-mid hover:text-text hover:border-(--border-hi) transition-colors"
              title={filters.sortOrder === "asc" ? "Ascendente" : "Descendente"}
              aria-label={filters.sortOrder === "asc" ? "Orden ascendente, cambiar a descendente" : "Orden descendente, cambiar a ascendente"}
            >
              <ArrowUpDown size={14} aria-hidden="true" className={filters.sortOrder === "asc" ? "" : "rotate-180"} />
            </button>

            {/* View toggle */}
            <div className="flex border border-(--border) rounded-[6px] overflow-hidden">
              {(["grid", "list"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => set("view", v)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-medium transition-colors",
                    filters.view === v
                      ? "bg-(--accent) text-bg"
                      : "text-text-mid hover:text-text hover:bg-(--surface-hi)"
                  )}
                >
                  {v === "grid" ? "⊞" : "☰"}
                </button>
              ))}
            </div>

            <Link
              href="/peliculas/nueva"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors"
            >
              <Plus size={14} /> <span className="hidden sm:inline">Nueva</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Advanced Filters ── */}
      <details className="accordion-filters" open={showFilters}>
        <summary className="hidden">Filtros Avanzados</summary>
        <div className="accordion-content">
          <div className="accordion-inner">
            <div className="flex flex-wrap gap-3 px-3 sm:px-6 py-3 border-b border-(--border) bg-(--surface) shrink-0">
              <select value={filters.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <select value={filters.genre} onChange={(e) => set("genre", e.target.value)} className={selectCls}>
                <option value="">Todos los géneros</option>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>

              <select value={filters.year} onChange={(e) => set("year", e.target.value)} className={selectCls}>
                <option value="">Todos los años</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>

              <input
                type="text"
                value={filters.director}
                onChange={(e) => set("director", e.target.value)}
                placeholder="Director…"
                className={cn(inputCls, "w-40")}
              />

              <select value={filters.hasImdbReview} onChange={(e) => set("hasImdbReview", e.target.value)} className={selectCls}>
                <option value="all">Crítica IMDb: todas</option>
                <option value="yes">Con crítica IMDb</option>
                <option value="no">Sin crítica IMDb</option>
              </select>

              <select value={filters.importedFromImdb} onChange={(e) => set("importedFromImdb", e.target.value)} className={selectCls}>
                <option value="all">Origen: todas</option>
                <option value="yes">Importadas de IMDb</option>
                <option value="no">Añadidas manualmente</option>
              </select>

              {/* Ordenar (solo móvil) */}
              <div className="flex items-center gap-2 sm:hidden w-full pt-2.5 border-t border-(--border) mt-1">
                <span className="text-[11px] uppercase tracking-widest text-text-faint shrink-0">Ordenar:</span>
                <select
                  value={filters.sortKey}
                  onChange={(e) => set("sortKey", e.target.value as SortKey)}
                  className={cn(selectCls, "flex-1 min-w-0")}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => set("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc")}
                  className="flex p-2.5 rounded-[6px] border border-(--border) text-text-mid hover:text-text bg-(--surface) transition-colors shrink-0"
                  title={filters.sortOrder === "asc" ? "Ascendente" : "Descendente"}
                >
                  <ArrowUpDown size={14} className={filters.sortOrder === "asc" ? "" : "rotate-180"} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* ── Results count ── */}
      <div className="px-3 sm:px-6 py-2 shrink-0">
        <p className="text-xs text-text-faint font-mono">
          {total} resultado{total !== 1 ? "s" : ""}
          {movies.length !== total && ` de ${movies.length}`}
        </p>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-text-faint text-sm">Sin resultados para los filtros actuales.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-(--accent) text-sm hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : filters.view === "grid" ? (
          <GridView movies={paginated} showScores={filters.sortKey === "myRating"} marathonDays={marathonDays} />
        ) : (
          <ListView movies={paginated} marathonDays={marathonDays} />
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="tap-target rounded-[6px] border border-(--border) text-text-mid hover:text-text disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="text-text-faint text-sm px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    className={cn(
                      "w-8 h-8 text-sm rounded-[6px] transition-colors font-mono",
                      p === page
                        ? "bg-(--accent) text-bg"
                        : "border border-(--border) text-text-mid hover:text-text hover:border-(--border-hi)"
                    )}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount}
              aria-label="Página siguiente"
              className="tap-target rounded-[6px] border border-(--border) text-text-mid hover:text-text disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grid view ───────────────────────────────────────────────────────────────

/**
 * El muro. La nota NO se incrusta en el cartel salvo que estés ordenando por
 * ella: si no, compite con la imagen, que es lo que te hace reconocer la
 * película. El resto del tiempo va en pequeño bajo el título, junto al año.
 */
function GridView({ movies, showScores, marathonDays }: { movies: MovieItem[]; showScores: boolean; marathonDays: Map<string, number> }) {
  // Stagger solo en la carga inicial: cada tarjeta recibe su delay la primera
  // vez que se ve y lo conserva, así filtrar (que no re-monta las tarjetas)
  // no re-anima nada y cambiar de página mantiene la escalera para las nuevas.
  // Ajuste de estado durante el render, igual que el borrador de búsqueda de
  // este mismo archivo — no en un efecto.
  const [delays, setDelays] = useState<Map<number, number>>(new Map());
  if (movies.some((m) => !delays.has(m.id))) {
    const next = new Map(delays);
    movies.forEach((m) => {
      if (!next.has(m.id)) next.set(m.id, Math.min(next.size, 11) * 35);
    });
    setDelays(next);
  }
  const staggerDelay = (id: number) => delays.get(id) ?? 0;

  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
      {movies.map((m) => (
        <Link key={m.id} href={`/peliculas/${m.id}`} className="group block animate-grid-in" style={{ animationDelay: `${staggerDelay(m.id)}ms` }}>
          <div
            className="relative aspect-2/3 overflow-hidden bg-(--surface) mb-2.5 poster-glow-hover"
            style={{ viewTransitionName: `dc-poster-${m.id}` }}
          >
            {m.posterUrl ? (
              <Image
                src={m.posterUrl}
                alt={m.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 14vw"
                className="object-cover animate-poster-in"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-surface-hi border border-border/40">
                <span className="text-center font-display text-xs italic text-text-mid leading-tight max-w-[90%] wrap-break-word px-1">
                  {m.title}
                </span>
              </div>
            )}

            {showScores && m.myRating != null && (
              <div className="absolute left-0 bottom-0 z-20 min-w-10 h-10 px-2 bg-(--accent) text-(--bg) font-display text-[17px] flex items-center justify-center">
                {String(m.myRating).replace(".", ",")}
              </div>
            )}

            {m.status && m.status !== "vista" && (
              <div className="absolute bottom-1.5 left-1.5 z-20">
                <span className={cn("badge-status text-[9px] px-1.5 py-0.5 inline-flex items-center gap-1", `badge-status--${m.status}`)}>
                  {m.status === "pendiente" && <SeatIcon size={9} />}
                  {MOVIE_STATUS_LABELS[m.status as MovieStatus]}
                </span>
              </div>
            )}

          </div>

          <p className="font-display text-[14px] leading-tight text-text truncate-2 group-hover:text-(--accent) transition-colors">
            {m.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {m.year && <span className="text-sm text-text-mid font-mono">{m.year}</span>}
            {/* O en el cartel o aquí, nunca las dos: al ordenar por nota se
                incrusta arriba y este hueco se queda con el año solo. */}
            {!showScores && m.myRating != null && (
              <span className="text-sm font-mono text-(--accent)">{String(m.myRating).replace(".", ",")}</span>
            )}
            <MarathonChip movie={m} days={marathonDays} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────

function ListView({ movies, marathonDays }: { movies: MovieItem[]; marathonDays: Map<string, number> }) {
  return (
    <div className="border border-(--border) rounded-md overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-(--border) bg-(--surface)">
            <th className="w-10" />
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium">Película</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-16">Año</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium hidden md:table-cell">Director</th>
            <th className="px-3 py-2.5 text-center text-[11px] uppercase tracking-widest text-text-faint font-medium w-20">Mi nota</th>
            <th className="px-3 py-2.5 text-center text-[11px] uppercase tracking-widest text-text-faint font-medium w-20 hidden sm:table-cell">IMDb</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-32 hidden lg:table-cell">Vista el</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-28 hidden xl:table-cell">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border)">
          {movies.map((m) => (
            <tr key={m.id} className="hover:bg-(--surface-hi) transition-colors">
              {/* Thumbnail */}
              <td className="pl-3 py-2">
                <Link href={`/peliculas/${m.id}`}>
                  <div className="w-8 aspect-2/3 rounded overflow-hidden bg-(--surface-hi) shrink-0">
                    {m.posterUrl && (
                      <Image src={m.posterUrl} alt={m.title} width={32} height={48} className="object-cover w-full h-full" />
                    )}
                  </div>
                </Link>
              </td>

              {/* Title */}
              <td className="px-3 py-2">
                <Link href={`/peliculas/${m.id}`} className="group">
                  <p
                    className="font-display italic text-text group-hover:text-(--accent) transition-colors truncate max-w-[260px]"
                    style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: "15px", fontWeight: 600 }}
                  >
                    {m.title}
                  </p>
                </Link>
              </td>

              {/* Year */}
              <td className="px-3 py-2 font-mono text-text-faint text-xs">{m.year ?? "—"}</td>

              {/* Director */}
              <td className="px-3 py-2 text-text-mid text-xs truncate max-w-[160px] hidden md:table-cell">
                {m.directors.slice(0, 2).join(", ") || "—"}
              </td>

              {/* My rating */}
              <td className="px-3 py-2 text-center">
                {m.myRating != null
                  ? <span className="font-mono text-(--accent) font-bold">{m.myRating}</span>
                  : <span className="text-text-faint">—</span>}
              </td>

              {/* IMDb rating */}
              <td className="px-3 py-2 text-center font-mono text-text-faint text-xs hidden sm:table-cell">
                {m.imdbRating ?? "—"}
              </td>

              {/* Watched at */}
              <td className="px-3 py-2 text-xs text-text-faint hidden lg:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  {fmtDate(m.watchedAt)}
                  <MarathonChip movie={m} days={marathonDays} />
                </span>
              </td>

              {/* Status */}
              <td className="px-3 py-2 hidden xl:table-cell">
                <span className={cn("badge-status inline-flex items-center gap-1.5", `badge-status--${m.status}`)}>
                  {(m.status === "pendiente" || m.status === "vista") && (
                    <SeatIcon occupied={m.status === "vista"} size={11} />
                  )}
                  {MOVIE_STATUS_LABELS[m.status as MovieStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Badge de maratón ────────────────────────────────────────────────────────

/**
 * Chip discreto junto a la fecha de visionado cuando ese día se vieron 2+
 * películas. Solo aplica a vistas con watchedAt; en cualquier otro caso no
 * renderiza nada.
 */
function MarathonChip({ movie, days }: { movie: MovieItem; days: Map<string, number> }) {
  const count = marathonCountFor(movie, days);
  if (count == null) return null;
  return <MarathonBadge count={count} />;
}

function MarathonBadge({ count }: { count: number }) {
  const label = count === 2 ? "Doble sesión" : count === 3 ? "Triple sesión" : `Maratón ×${count}`;
  return (
    <span
      title={`${count} películas vistas el mismo día`}
      className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.14em] text-(--accent)"
    >
      {label}
    </span>
  );
}
