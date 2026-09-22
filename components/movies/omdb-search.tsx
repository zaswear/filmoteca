"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Search, Loader2 } from "lucide-react";
import type { MovieCreateInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Source = "omdb" | "tmdb";

interface SearchResult {
  imdbID: string;   // para omdb: tt..., para tmdb: número como string
  tmdbId?: number;
  Title:  string;
  Year:   string;
  Poster: string;
  Type:   string;
}

interface Props {
  onLoadingChange?: (loading: boolean) => void;
  onSelect: (data: Partial<MovieCreateInput>) => void;
}

export function OmdbSearch({ onSelect, onLoadingChange }: Props) {
  const [source,   setSource]  = useState<Source>("tmdb");
  const [query,    setQuery]   = useState("");
  const [year,     setYear]    = useState("");
  const [results,  setResults] = useState<SearchResult[]>([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Persiste la preferencia de fuente
  useEffect(() => {
    const timer = setTimeout(() => {
      try { const saved = localStorage.getItem("dc-search-source");
        if (saved === "omdb" || saved === "tmdb") setSource(saved);
      } catch { /* Optional preference. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function changeSource(s: Source) {
    setSource(s);
    try { localStorage.setItem("dc-search-source", s); } catch { /* Optional preference. */ }
    setResults([]);
    setError("");
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    onLoadingChange?.(true);
    setError("");
    setResults([]);

    try {
      if (source === "omdb") {
        // IMDb ID directo
        if (/^tt\d+$/.test(q)) {
          const res  = await fetch(`/api/omdb/${q}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          onSelect(data.parsed as Partial<MovieCreateInput>);
          setQuery("");
          return;
        }
        const params = new URLSearchParams({ q });
        if (/^\d{4}$/.test(year.trim())) params.set("year", year.trim());
        const res  = await fetch(`/api/omdb/search?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!Array.isArray(data) || data.length === 0) {
          setError(year ? `Sin resultados para "${q}" (${year}). Prueba sin año.` : "Sin resultados.");
        } else {
          setResults(data);
        }
      } else {
        // TMDB
        const params = new URLSearchParams({ q });
        if (/^\d{4}$/.test(year.trim())) params.set("year", year.trim());
        const res  = await fetch(`/api/tmdb/search?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!Array.isArray(data) || data.length === 0) {
          setError("Sin resultados en TMDB.");
        } else {
          setResults(data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de búsqueda");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  async function selectResult(result: SearchResult) {
    setLoading(true);
    onLoadingChange?.(true);
    setResults([]);
    try {
      let parsed: Partial<MovieCreateInput>;
      if (source === "omdb") {
        const res  = await fetch(`/api/omdb/${result.imdbID}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        parsed = data.parsed;
      } else {
        const tmdbId = result.tmdbId ?? parseInt(result.imdbID);
        const res    = await fetch(`/api/tmdb/${tmdbId}`);
        const data   = await res.json();
        if (!res.ok) throw new Error(data.error);
        parsed = data.parsed;
      }
      onSelect(parsed);
      setQuery("");
      setYear("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar película");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  const inputCls = "bg-(--surface) border border-(--border) rounded-[6px] text-[15px] text-text placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus) transition-colors";

  return (
    <div className="space-y-3">
      {/* Selector de fuente */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-text-faint">Fuente:</span>
        <div className="flex border border-(--border) rounded-[6px] overflow-hidden">
          {(["tmdb", "omdb"] as Source[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSource(s)}
              className={cn(
                "min-h-11 px-3 py-1.5 text-xs font-medium transition-colors",
                source === s
                  ? "bg-(--accent) text-bg"
                  : "text-text-mid hover:text-text hover:bg-(--surface-hi)"
              )}
            >
              {s === "tmdb" ? "TMDB" : "OMDb"}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-text-faint">
          {source === "tmdb" ? "Sin límite diario · mejor calidad" : "1.000 req/día"}
        </span>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            aria-label="Buscar película"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            placeholder={source === "omdb" ? "Título o IMDb ID (tt…)" : "Título de la película"}
            className={`${inputCls} w-full pl-9 pr-4 py-2.5`}
          />
        </div>
        <input
          type="text"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Año"
          aria-label="Año de estreno"
          inputMode="numeric"
          maxLength={4}
          className={`${inputCls} w-20 px-3 py-2.5 font-mono text-center`}
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-(--accent) text-bg text-sm font-medium rounded-[6px] hover:bg-(--accent-hover) transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Buscar"}
        </button>
      </div>

      {error && <p className="text-sm text-(--error)">{error}</p>}

      {/* Resultados */}
      {results.length > 0 && (
        <ul className="border border-(--border) rounded-[6px] overflow-hidden divide-y divide-(--border) bg-(--surface)">
          {results.map((r) => (
            <li key={`${r.imdbID}-${r.tmdbId}`}>
              <button
                type="button"
                onClick={() => selectResult(r)}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-(--surface-hi) transition-colors text-left"
              >
                {r.Poster && r.Poster !== "N/A" ? (
                  <Image src={r.Poster} alt={r.Title} width={32} height={48} className="object-cover rounded shrink-0" />
                ) : (
                  <div className="w-8 h-12 bg-(--surface-hi) rounded shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-display italic text-[15px] font-semibold text-text truncate">{r.Title}</p>
                  <p className="text-xs text-text-faint font-mono">{r.Year}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
