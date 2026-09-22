"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialog } from "@/lib/use-dialog";

import { t } from "@/lib/i18n";
// Buscador global tipo paleta de comandos.
// El modal es único y global (en AppShell). Se abre con Ctrl/⌘+K, con "/" o con
// el evento "dc-open-search" que disparan los botones de disparo (sidebar/header).

/**
 * Tecla modificadora según el sistema. El atajo escucha metaKey y ctrlKey, así
 * que funciona en los dos; lo que no puede ser es anunciar ⌘ a quien no tiene
 * un Mac y no tiene esa tecla.
 *
 * useSyncExternalStore y no useState+useEffect: el servidor no sabe qué sistema
 * usas, y renderizar ⌘ en el HTML para luego cambiarlo en el cliente daría un
 * error de hidratación. Con el snapshot de servidor (false = no es Mac) React
 * hidrata coherente y reconcilia después.
 */
const sinSuscripcion = () => () => {};
const esMacCliente = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

function useTeclaModificadora() {
  const esMac = useSyncExternalStore(sinSuscripcion, esMacCliente, () => false);
  return esMac ? "⌘K" : "Ctrl K";
}

interface Row {
  id: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  status: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Localiza el substring que coincide con la consulta sobre el título original
 * (para poder pintarlo en bermellón). norm() descompone los acentos en NFD y
 * los elimina, así que el índice sobre la cadena normalizada no se puede usar
 * directo: se caminan ambas cadenas a la par.
 */
function destacar(title: string, query: string): { pre: string; match: string; post: string } | null {
  const q = norm(query);
  if (!q) return null;
  const pasada = (c: string) => c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const t = norm(title);
  const i = t.indexOf(q);
  if (i < 0) return null;
  let n = 0;
  for (let k = 0; k < title.length; k++) {
    if (n === i) {
      let end = k;
      let m = 0;
      while (end < title.length && m < q.length) {
        m += pasada(title[end]).length;
        end++;
      }
      return { pre: title.slice(0, k), match: title.slice(k, end), post: title.slice(end) };
    }
    n += pasada(title[k]).length;
    if (n > i) return null;
  }
  return null;
}

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // `loading` no necesita estado propio: es exactamente «está abierto y aún no
  // ha llegado el catálogo». Tenerlo aparte obligaba a un setState síncrono
  // dentro del efecto, que dispara un render en cascada al abrir el buscador.
  const loading = open && rows === null;

  useEffect(() => {
    if (!open || rows !== null) return;
    let cancel = false;
    fetch("/api/movies/palette")
      .then((r) => r.json())
      .then((d) => { if (!cancel) setRows(d.movies ?? []); })
      .catch(() => { if (!cancel) setRows([]); });
    return () => { cancel = true; };
  }, [open, rows]);

  useEffect(() => {
    const openEvt = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping())) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("dc-open-search", openEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dc-open-search", openEvt);
    };
  }, []);

  // El foco inicial lo coloca useDialog (el input es el primer enfocable del
  // diálogo). Aquí solo queda limpiar el estado al cerrar, y se hace ajustando
  // el estado durante el render —comparando con el valor anterior— en vez de
  // en un efecto: el mismo patrón que usa el stagger de la lista más abajo.
  const [abiertoAntes, setAbiertoAntes] = useState(open);
  if (abiertoAntes !== open) {
    setAbiertoAntes(open);
    if (!open) { setQuery(""); setActive(0); }
  }

  const results = useMemo(() => {
    const q = norm(query);
    if (!rows) return [];
    if (!q) return rows.slice(0, 8);
    return rows
      .map((r) => {
        // Se busca tanto por título como por título original: las importadas
        // desde IMDb traen el título localizado del CSV, y el usuario puede
        // recordar la película por cualquiera de las dos variantes.
        const titulo = norm(r.title);
        const i = titulo.indexOf(q);
        if (i >= 0) return { r, score: i === 0 ? 0 : titulo.startsWith(q) ? 1 : 2 + i };
        if (r.originalTitle) {
          const original = norm(r.originalTitle);
          const j = original.indexOf(q);
          // El match por original nunca gana al de título: solo ordena entre sí.
          if (j >= 0) return { r, score: 3 + (j === 0 ? 0 : original.startsWith(q) ? 1 : 1 + j) };
        }
        return null;
      })
      .filter((x): x is { r: Row; score: number } => x !== null)
      .sort((a, b) => a.score - b.score || a.r.title.localeCompare(b.r.title))
      .slice(0, 8)
      .map((x) => x.r);
  }, [rows, query]);

  // Teclear vuelve a poner el cursor en el primer resultado, también durante
  // el render y no en un efecto.
  const [consultaAntes, setConsultaAntes] = useState(query);
  if (consultaAntes !== query) {
    setConsultaAntes(query);
    setActive(0);
  }

  // Stagger de la lista: cada fila recibe un delay la primera vez que se ve y
  // lo conserva después, así teclear no reinicia animaciones de filas que ya
  // estaban. Ajuste de estado durante el render (mismo patrón que el borrador
  // de búsqueda de movies-list), no en un efecto.
  const [delays, setDelays] = useState<Map<number, number>>(new Map());
  if (results.some((r) => !delays.has(r.id))) {
    const next = new Map(delays);
    results.forEach((r) => {
      if (!next.has(r.id)) next.set(r.id, Math.min(next.size, 11) * 30);
    });
    setDelays(next);
  }

  const go = useCallback((row: Row) => {
    setOpen(false);
    router.push(`/peliculas/${row.id}`);
  }, [router]);

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const cerrar = useCallback(() => setOpen(false), []);
  // enabled: el componente existe también cerrado (devuelve null más abajo),
  // así que el hook tiene que activarse cuando open pasa a true, no al montar.
  const dialogRef = useDialog<HTMLDivElement>(cerrar, { enabled: open });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("buscador.abrir")}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-(--border-hi) bg-(--surface) shadow-[var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-2 border-b border-(--border) px-4 py-3">
          <Search size={18} className="text-text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("buscador.placeholder")}
            aria-label={t("buscador.etiqueta")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
          {loading && <Loader2 size={16} className="animate-spin text-text-faint" aria-hidden="true" />}
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {!loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-faint">
              {query.trim() ? t("buscador.sinResultados") : t("buscador.coleccionVacia")}
            </p>
          )}
          {results.map((r, i) => {
            const hl = destacar(r.title, query);
            // Si el match fue por título original, se resalta él en su línea.
            const hlOriginal =
              r.originalTitle && norm(r.originalTitle) !== norm(r.title)
                ? destacar(r.originalTitle, query)
                : null;
            const yearMatch = r.year != null && norm(String(r.year)).includes(norm(query)) && query.trim() !== "";
            return (
            <button
              key={r.id}
              data-idx={i}
              onMouseMove={() => setActive(i)}
              onClick={() => go(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors animate-grid-in",
                i === active ? "bg-(--surface-hi)" : "hover:bg-(--surface-hi)/60"
              )}
              style={{ animationDelay: `${delays.get(r.id) ?? 0}ms` }}
            >
              {/* La miniatura se pinta a 40x56 pero el origen es un póster de
                  TMDB en w500: sin el optimizador se descargaban ~40 KB por
                  fila para mostrar un sello. sizes fijo porque el tamaño no
                  depende del viewport. */}
              {r.posterUrl ? (
                <Image
                  src={r.posterUrl}
                  alt=""
                  width={40}
                  height={56}
                  sizes="40px"
                  className="h-14 w-10 shrink-0 rounded bg-bg object-cover"
                />
              ) : (
                <div className="h-14 w-10 shrink-0 rounded bg-bg" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {hl ? (
                    <>
                      {hl.pre}
                      <span className="text-(--accent) font-semibold">{hl.match}</span>
                      {hl.post}
                    </>
                  ) : (
                    r.title
                  )}
                </p>
                <p className={cn("font-mono text-xs", yearMatch ? "text-(--accent) font-semibold" : "text-text-faint")}>
                  {r.year ?? "—"}
                </p>
                {hlOriginal && (
                  <p className="truncate text-xs text-text-faint">
                    {hlOriginal.pre}
                    <span className="text-(--accent) font-semibold">{hlOriginal.match}</span>
                    {hlOriginal.post}
                  </p>
                )}
              </div>
              {i === active && <CornerDownLeft size={14} className="shrink-0 text-text-faint" aria-hidden="true" />}
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Botón que abre el buscador global. Reutilizable en sidebar y header. */
export function SearchTrigger({ className, compact = false }: { className?: string; compact?: boolean }) {
  const tecla = useTeclaModificadora();
  const open = () => window.dispatchEvent(new Event("dc-open-search"));
  if (compact) {
    return (
      <button onClick={open} aria-label={`Buscar (${tecla})`} title={`Buscar · ${tecla} o /`} className={cn("tap-target rounded-md text-text-mid hover:text-text hover:bg-(--surface-hi) transition-colors", className)}>
        <Search size={18} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      onClick={open}
      aria-label={t("buscador.buscarPeliculas")}
      title={`Buscar · ${tecla} o /`}
      className={cn(
        "flex w-full items-center gap-2 rounded-[6px] border border-(--border) bg-(--surface-hi)/40 px-3 py-2 text-sm text-text-faint transition-colors hover:border-(--border-hi) hover:text-text-mid",
        className
      )}
    >
      <Search size={15} aria-hidden="true" />
      <span className="flex-1 text-left">{t("buscador.corto")}</span>
      <kbd className="rounded border border-(--border) px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap">{tecla}</kbd>
    </button>
  );
}
