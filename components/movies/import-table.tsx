"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckSquare, Square, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CsvRow } from "@/lib/csv";

interface Row extends CsvRow {
  exists:        boolean;
  hasImdbReview: boolean;
  selected:      boolean;
}

interface Props {
  rows: (CsvRow & { exists: boolean })[];
}

interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   { imdbId: string; error: string }[];
}

export function ImportTable({ rows: initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((r) => ({
      ...r,
      hasImdbReview: false,
      selected:      !r.exists,
    }))
  );
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [error,    setError]    = useState("");

  const newRows      = rows.filter((r) => !r.exists);
  const selectedRows = rows.filter((r) => r.selected && !r.exists);

  function toggleSelected(imdbId: string) {
    setRows((prev) =>
      prev.map((r) => r.imdbId === imdbId && !r.exists ? { ...r, selected: !r.selected } : r)
    );
  }

  function selectAll(v: boolean) {
    setRows((prev) => prev.map((r) => r.exists ? r : { ...r, selected: v }));
  }

  async function handleImport() {
    if (!selectedRows.length) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          movies: selectedRows.map((r) => ({
            imdbId:        r.imdbId,
            myRating:      r.myRating,
            watchedAt:     r.watchedAt,
            hasImdbReview: r.hasImdbReview,
            fallback: {
              title:         r.title,
              originalTitle: r.originalTitle,
              year:          r.year,
              imdbRating:    r.imdbRating,
              runtimeMins:   r.runtimeMins,
              genres:        r.genres,
              directors:     r.directors,
              imdbVotes:     r.imdbVotes,
            },
          })),
        }),
      });

      const data: ImportResult = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error al importar");
      setResult(data);

      // Marca las importadas como existentes
      if (data.imported > 0) {
        setRows((prev) =>
          prev.map((r) =>
            r.selected && !r.exists ? { ...r, exists: true, selected: false } : r
          )
        );
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const progress = rows.length > 0 ? Math.round((rows.filter((r) => r.exists).length / rows.length) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-mid">
            <span className="font-mono text-text">{rows.filter((r) => r.exists).length}</span> de <span className="font-mono text-text">{rows.length}</span> películas cargadas desde el archivo
          </span>
          <span className="font-mono text-text-faint text-xs">{progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-(--surface-hi) rounded-full overflow-hidden">
          <div
            /* transition-[width] y no transition-all: lo único que cambia es
               el ancho, y `all` hacía que el navegador vigilara el resto de
               propiedades durante los 500 ms de cada paso de la importación. */
            className="h-full bg-(--accent) rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-text-mid">
          <span><span className="font-mono text-text">{newRows.length}</span> nuevas</span>
          <span><span className="font-mono text-text-faint">{rows.filter((r) => r.exists).length}</span> ya importadas</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectAll(true)}
            className="text-xs text-text-faint hover:text-text transition-colors px-2 py-1 rounded hover:bg-(--surface-hi)"
          >
            Seleccionar todo
          </button>
          <button
            onClick={() => selectAll(false)}
            className="text-xs text-text-faint hover:text-text transition-colors px-2 py-1 rounded hover:bg-(--surface-hi)"
          >
            Ninguna
          </button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={cn(
          "flex items-start gap-3 p-4 rounded-md border text-sm",
          result.errors.length
            ? "border-(--warning) bg-(--surface-hi) text-text"
            : "border-(--success) bg-(--green-dim) text-text"
        )}>
          <CheckCircle size={16} className="text-(--success) shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {result.imported} películas importadas, {result.skipped} ya existían.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1 text-text-mid space-y-0.5">
                {result.errors.map((e) => (
                  <li key={e.imdbId} className="flex items-center gap-1.5 text-xs">
                    <AlertCircle size={11} className="text-(--error)" />
                    {e.imdbId}: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-(--error) flex items-center gap-1.5">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md overflow-hidden border border-(--border)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-(--border) bg-(--surface)">
                <th className="w-12 px-3 py-3" />
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium">Título</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-16">Año</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-24">Puntuación IMDb</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-text-faint font-medium w-28">Mi Puntuación (1-10)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border)">
              {rows.map((row) => (
                <tr
                  key={row.imdbId}
                  className={cn(
                    "transition-colors",
                    row.exists
                      ? "opacity-40"
                      : row.selected
                        ? "bg-(--accent-dim)"
                        : "hover:bg-(--surface-hi)",
                    row.selected && !row.exists && "ring-1 ring-inset ring-(--accent)"
                  )}
                >
                  {/* Select checkbox */}
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => toggleSelected(row.imdbId)}
                      disabled={row.exists}
                      className="text-text-faint hover:text-text disabled:cursor-default transition-colors"
                      aria-label={row.selected ? "Deseleccionar" : "Seleccionar"}
                    >
                      {row.selected && !row.exists
                        ? <CheckSquare size={16} className="text-(--accent)" />
                        : <Square size={16} />}
                    </button>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-3">
                    <p className="font-display font-semibold italic text-text truncate max-w-[280px]"
                       style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: "15px", fontStyle: "normal" }}>
                      {row.title}
                    </p>
                    {row.originalTitle && row.originalTitle !== row.title && (
                      <p className="text-xs text-text-faint truncate max-w-[280px]">{row.originalTitle}</p>
                    )}
                  </td>

                  {/* Year */}
                  <td className="px-3 py-3 font-mono text-text-mid">
                    {row.year || "—"}
                  </td>

                  {/* IMDb rating */}
                  <td className="px-3 py-3 font-mono text-text-mid">
                    {row.imdbRating > 0 ? row.imdbRating : "—"}
                  </td>

                  {/* My rating */}
                  <td className="px-3 py-3">
                    {row.myRating > 0 && (
                      <span className="font-mono text-(--accent) font-bold">{row.myRating}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={() => router.push("/admin/import")}
          className="px-4 py-2 text-sm text-text-mid border border-(--border) rounded-[6px] hover:text-text hover:border-(--border-hi) transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleImport}
          disabled={loading || selectedRows.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading
            ? "Importando…"
            : `Importar seleccionadas`}
        </button>
      </div>
    </div>
  );
}
