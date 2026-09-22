"use client";

import { useState, useEffect, useId, cloneElement } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, AlertTriangle, Film, ArrowRight } from "lucide-react";
import { OmdbSearch } from "./omdb-search";
import { RatingInput } from "@/components/ui/rating-input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { ImageGallery } from "@/components/ui/image-gallery";
import { useFormDraft } from "@/lib/use-form-draft";
import { DraftNotice } from "@/components/ui/draft-notice";
import { z } from "zod";
import { MovieCreateSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  WATCH_FORMATS,
  MOVIE_STATUSES,
  type MovieCreateInput,
} from "@/lib/schemas";
import { WATCH_FORMAT_LABELS, MOVIE_STATUS_LABELS } from "@/lib/types";
import type { Image as DBImage } from "@/lib/generated/prisma";

interface Props {
  mode:        "create" | "edit";
  movieId?:    number;
  initial?:    Partial<MovieCreateInput>;
  initialImages?: DBImage[];
  successUrl?: string;   // URL personalizada tras guardar (ej. wizard de importación)
}

type FormState = MovieCreateInput & { imdbId: string };

const EMPTY: FormState = {
  imdbId: "", title: "", originalTitle: null, year: null, durationMin: null,
  genres: [], directors: [], cast: [], plot: null, posterUrl: null,
  imdbRating: null, imdbVotes: null, country: null, language: null, rated: null,
  myRating: null, watchedAt: null, watchFormat: null,
  review: null, hasImdbReview: false, notes: null,
  status: "pendiente", importedFromImdb: false,
  collections: [],
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  return <div className={cn("group", className)}>
    <label htmlFor={id} className="block text-[11px] uppercase tracking-[0.14em] text-text-mid mb-1.5">{label}</label>
    {cloneElement(children as React.ReactElement<{ id?: string }>, { id })}
  </div>;
}

const fieldBase =
  "w-full bg-(--surface) border border-(--border) rounded-md px-3.5 py-2.5 text-[15px] text-text placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus) focus:bg-(--surface-hi) transition-[color,background-color,border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_var(--accent-dim)]";

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "resize-none leading-relaxed", className)} {...props} />;
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "cursor-pointer", className)} {...props} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 mb-6">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
      <span className="font-display font-semibold italic text-[22px] leading-none text-text">{children}</span>
      <span aria-hidden className="flex-1 h-px bg-(--border)" />
    </h3>
  );
}

// Bloque con revelado escalonado al montar (motion via CSS, respeta reduced-motion)
function Reel({ i = 0, children, className }: { i?: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("reel-in", className)} style={{ animationDelay: `${i * 20}ms` }}>
      {children}
    </div>
  );
}

export function MovieForm({ mode, movieId, initial = {}, initialImages = [], successUrl }: Props) {
  const router  = useRouter();
  const legacyKey = mode === "edit" ? `review_draft_edit_${movieId}` : "review_draft_create";
  const draft = useFormDraft<FormState>(`dc-form:${mode}:${movieId ?? "new"}`, { ...EMPTY, ...initial }, (raw) => {
    const parsed = MovieCreateSchema.extend({ imdbId: z.string(), title: z.string().max(500) }).safeParse(raw);
    return parsed.success ? parsed.data : null;
  }, legacyKey);
  const form = draft.value;
  const setForm = draft.update;
  const [searching, setSearching] = useState(false);
  const [images, setImages]   = useState<DBImage[]>(initialImages);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [duplicateId, setDuplicateId] = useState<number | null>(null);


  // Pre-rellenado automático vía parámetros de URL (?imdbId=tt... o ?tmdbId=...)
  useEffect(() => {
    if (mode !== "create" || !draft.ready || draft.pending || form.imdbId) return;
    const params = new URLSearchParams(window.location.search);
    const imdbIdParam = params.get("imdbId");
    const tmdbIdParam = params.get("tmdbId");

    async function fetchPreload() {
      setSaving(true);
      setError("");
      try {
        let parsed = null;
        if (imdbIdParam && /^tt\d+$/.test(imdbIdParam)) {
          const res = await fetch(`/api/omdb/${imdbIdParam}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error cargando OMDb");
          parsed = data.parsed;
        } else if (tmdbIdParam) {
          const res = await fetch(`/api/tmdb/${tmdbIdParam}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error cargando TMDB");
          parsed = data.parsed;
        }
        if (parsed) {
          setForm((prev) => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        console.error("Error al pre-cargar película:", err);
        setError("No se pudo pre-cargar la información de la película.");
      } finally {
        setSaving(false);
      }
    }

    if (imdbIdParam || tmdbIdParam) {
      fetchPreload();
    }
  // Wait for the restore decision before preloading URL metadata.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, draft.ready, draft.pending]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onOmdbSelect(data: Partial<MovieCreateInput>) {
    // `review` sigue en el estado y se sigue enviando aunque ya no haya caja
    // para escribirlo: un borrador antiguo con crítica y sin título se
    // perdería sin avisar al elegir otra película.
    if ((form.title || form.review || form.notes) && !window.confirm("¿Cambiar de película? Se sustituirá el formulario y su borrador local.")) return;
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setForm({ ...EMPTY, status: "vista", watchedAt: local.toISOString().slice(0, 10), ...data });
    setDuplicateId(null);
    requestAnimationFrame(() => document.getElementById("personal-record")?.scrollIntoView({ block: "start" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || searching || !draft.ready || draft.pending) return;
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      genres:    form.genres.filter(Boolean),
      directors: form.directors.filter(Boolean),
      cast:      form.cast.filter(Boolean),
    };

    try {
      const url    = mode === "create" ? "/api/movies" : `/api/movies/${movieId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      // Duplicado: la película ya existe
      if (res.status === 409) {
        setDuplicateId(data.id ?? null);
        return;
      }
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Error al guardar");

      // Clear auto-saved draft on success
      draft.saved();

      const defaultUrl = mode === "create" ? `/peliculas/${data.id}` : `/peliculas/${movieId}`;
      router.push(successUrl ?? defaultUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const strTags = (arr: string[]) => arr.join(", ");
  const parseTags = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-44 md:pb-32">
      <style>{`
        @keyframes reelIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .reel-in { animation: reelIn .18s cubic-bezier(0.16,1,0.3,1) both; }
        .sprocket { background-image: repeating-linear-gradient(to bottom, var(--border-hi) 0 6px, transparent 6px 20px); }
        @media (prefers-reduced-motion: reduce) {
          .reel-in { animation: none; }
        }
      `}</style>

      {/* ── Cabecera editorial ── */}
      <Reel i={0}>
        <header className="mb-8">
          <h1 className="font-display font-semibold italic text-[34px] sm:text-[42px] leading-[1.05] text-text text-balance">
            {mode === "create" ? "Añadir película" : (form.title || "Editar película")}
          </h1>
        </header>
      </Reel>

      {draft.pending && <p className="text-text-mid mb-2">Borrador de «{draft.pending.title || "Película nueva"}»</p>}
      <DraftNotice pending={!!draft.pending} message={draft.message} restore={draft.restore} discard={draft.discard} />
      <fieldset inert={!draft.ready || !!draft.pending || saving || searching} disabled={!draft.ready || !!draft.pending || saving || searching}>
      {/* ── Búsqueda OMDb (solo create) ── */}
      {mode === "create" && (
        <Reel i={1} className="mb-10">
          <details open={!form.imdbId}>
            <summary className="min-h-11 cursor-pointer text-accent">{form.imdbId ? "Cambiar película" : "Buscar película"}</summary>
            <OmdbSearch onSelect={onOmdbSelect} onLoadingChange={setSearching} />
          </details>
        </Reel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(200px,260px)_1fr] gap-x-10 gap-y-8">

        {/* Columna póster */}
        <Reel i={2} className="hidden md:block md:sticky md:top-6 self-start space-y-4">
          <div className="relative w-full aspect-2/3 rounded-md overflow-hidden bg-(--surface) border border-(--border) shadow-(--shadow-poster)">
            {form.posterUrl ? (
              <Image
                src={form.posterUrl}
                alt={form.title}
                fill
                sizes="(max-width: 768px) 90vw, 300px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-faint">
                <Film size={26} strokeWidth={1.4} />
                <span className="text-sm">Sin póster</span>
              </div>
            )}
          </div>

        </Reel>

        {/* Columna datos */}
        <div className="space-y-12 min-w-0">
          {/* ── Mi registro ── */}
          <Reel i={4}>
            <div id="personal-record" className="scroll-mt-4">
              {form.title && <div className="flex gap-4 items-center mb-5">
                {form.posterUrl && <Image src={form.posterUrl} alt="" width={64} height={96} className="rounded object-cover md:hidden" />}
                <p className="font-display text-2xl">{form.title}{form.year ? ` (${form.year})` : ""}</p>
              </div>}
              <SectionTitle>Mi registro</SectionTitle>
            </div>
            <div className="space-y-5">

              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <Select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as MovieCreateInput["status"])}
                  >
                    {MOVIE_STATUSES.map((s) => (
                      <option key={s} value={s}>{MOVIE_STATUS_LABELS[s]}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Mi puntuación">
                  <RatingInput
                    value={form.myRating}
                    onChange={(v) => set("myRating", v)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de visionado">
                  <Input
                    type="date"
                    value={form.watchedAt ? form.watchedAt.slice(0, 10) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      set("watchedAt", v ? new Date(v).toISOString() : null);
                    }}
                  />
                </Field>
                <Field label="Formato">
                  <Select
                    value={form.watchFormat ?? ""}
                    onChange={(e) => set("watchFormat", (e.target.value || null) as MovieCreateInput["watchFormat"])}
                  >
                    <option value="">— Sin especificar —</option>
                    {WATCH_FORMATS.map((f) => (
                      <option key={f} value={f}>{WATCH_FORMAT_LABELS[f]}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <label
                htmlFor="hasImdbReview"
                className="flex items-center gap-3 p-3 rounded-md border border-(--border) bg-(--surface) cursor-pointer hover:border-(--border-hi) transition-colors"
              >
                <input
                  id="hasImdbReview"
                  type="checkbox"
                  checked={form.hasImdbReview}
                  onChange={(e) => set("hasImdbReview", e.target.checked)}
                  className="accent-(--accent) w-4 h-4"
                />
                <span className="text-sm text-text-mid">Tengo crítica publicada en IMDb</span>
              </label>

              {/* El editor enriquecido (Tiptap, cuatro dependencias y la caja
                  más compleja del formulario) se usó 3 veces en 238 películas.
                  Lo que de verdad se escribe son dos frases, así que la caja
                  es un textarea. Las críticas antiguas siguen en la base y se
                  siguen mostrando en la ficha. */}
              <Field label="Nota rápida">
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  rows={4}
                  placeholder="Dos frases bastan: qué te pareció, con quién la viste, qué te recordó…"
                />
              </Field>

              <Field label="Sagas / Colecciones">
                <Input
                  value={strTags(form.collections ?? [])}
                  onChange={(e) => set("collections", parseTags(e.target.value))}
                  placeholder="Saga de El Padrino, Trilogía de Batman de Nolan…"
                />
              </Field>

            </div>
          </Reel>

          <details className="space-y-5" open={!form.imdbId}>
            <summary className="min-h-11 cursor-pointer text-accent">Ficha técnica · revisar metadatos</summary>
            <div className="space-y-5">

          <Field label="URL del póster">
            <Input
              value={form.posterUrl ?? ""}
              onChange={(e) => set("posterUrl", e.target.value || null)}
              placeholder="https://…"
              type="url"
            />
          </Field>

              <Field label="IMDb ID *">
                <Input
                  value={form.imdbId}
                  onChange={(e) => set("imdbId", e.target.value)}
                  placeholder="tt1234567"
                  className="font-mono"
                  required
                />
              </Field>

              <Field label="Título *">
                <input
                  className={cn(fieldBase, "text-[22px] font-display italic")}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Título de la película"
                  required
                />
              </Field>

              <Field label="Título original">
                <Input
                  value={form.originalTitle ?? ""}
                  onChange={(e) => set("originalTitle", e.target.value || null)}
                  placeholder="Original title"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Año">
                  <Input
                    type="number" min={1880} max={2100}
                    value={form.year ?? ""}
                    onChange={(e) => set("year", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="2024"
                    className="font-mono"
                  />
                </Field>
                <Field label="Duración (min)">
                  <Input
                    type="number" min={1}
                    value={form.durationMin ?? ""}
                    onChange={(e) => set("durationMin", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="120"
                    className="font-mono"
                  />
                </Field>
                <Field label="Clasificación">
                  <Input
                    value={form.rated ?? ""}
                    onChange={(e) => set("rated", e.target.value || null)}
                    placeholder="R, PG-13…"
                  />
                </Field>
              </div>

              <Field label="Director(es)">
                <Input
                  value={strTags(form.directors)}
                  onChange={(e) => set("directors", parseTags(e.target.value))}
                  placeholder="Denis Villeneuve, Christopher Nolan…"
                />
              </Field>

              <Field label="Reparto (primeros 5)">
                <Input
                  value={strTags(form.cast)}
                  onChange={(e) => set("cast", parseTags(e.target.value))}
                  placeholder="Actor 1, Actor 2…"
                />
              </Field>

              <Field label="Géneros">
                <Input
                  value={strTags(form.genres)}
                  onChange={(e) => set("genres", parseTags(e.target.value))}
                  placeholder="Drama, Ciencia ficción…"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="País">
                  <Input
                    value={form.country ?? ""}
                    onChange={(e) => set("country", e.target.value || null)}
                    placeholder="United States"
                  />
                </Field>
                <Field label="Idioma">
                  <Input
                    value={form.language ?? ""}
                    onChange={(e) => set("language", e.target.value || null)}
                    placeholder="English"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Puntuación IMDb">
                  <Input
                    type="number" min={0} max={10} step={0.1}
                    value={form.imdbRating ?? ""}
                    onChange={(e) => set("imdbRating", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="8.0"
                    className="font-mono"
                  />
                </Field>
                <Field label="Votos IMDb">
                  <Input
                    type="number" min={0}
                    value={form.imdbVotes ?? ""}
                    onChange={(e) => set("imdbVotes", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="500000"
                    className="font-mono"
                  />
                </Field>
              </div>

              <Field label="Sinopsis">
                <Textarea
                  value={form.plot ?? ""}
                  onChange={(e) => set("plot", e.target.value || null)}
                  rows={4}
                  placeholder="Sinopsis oficial…"
                />
              </Field>
            </div>
          </details>

          {/* ── Imágenes (solo en modo edición) ── */}
          {mode === "edit" && movieId && (
            <Reel i={5}>
              <SectionTitle>Galería de fotos</SectionTitle>
              <ImageGallery
                images={images.filter((i) => i.type === "gallery")}
                onDelete={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
                className="mb-4"
              />
              <ImageUploader
                movieId={movieId}
                type="gallery"
                onUpload={(img) => setImages((prev) => [...prev, img])}
              />

              <div className="mt-10">
                <SectionTitle>Pósteres alternativos</SectionTitle>
                <ImageGallery
                  images={images.filter((i) => i.type === "poster_alt")}
                  onDelete={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
                  className="mb-4"
                />
                <ImageUploader
                  movieId={movieId}
                  type="poster_alt"
                  onUpload={(img) => setImages((prev) => [...prev, img])}
                />
              </div>
            </Reel>
          )}
        </div>
      </div>

      </fieldset>
      {/* ── Duplicado ── */}
      {duplicateId && (
        <div className="mt-8 flex items-start gap-3 p-4 rounded-md border border-(--warning) bg-[oklch(75%_0.12_85/10%)]">
          <AlertTriangle size={18} className="text-(--warning) shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">Esta película ya está en tu colección.</p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <a
                href={`/peliculas/${duplicateId}`}
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                Ver ficha existente <ArrowRight size={13} />
              </a>
              {successUrl && (
                <button
                  type="button"
                  onClick={() => router.push(successUrl)}
                  className="text-sm text-text-faint hover:text-text transition-colors"
                >
                  Continuar sin guardar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de acción pegajosa ── */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-(--border) bg-[oklch(10%_0.010_52/85%)] backdrop-blur-md md:bottom-0 md:left-[220px]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 sm:px-6 sm:py-3.5 sm:gap-4">
          <p className="text-sm text-(--error) break-words" role={error ? "alert" : undefined}>
            {error}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => { if (window.confirm("¿Salir de la edición? El borrador local se conserva si el dispositivo permite guardarlo.")) router.back(); }}
              className="px-4 py-2 text-sm text-text-mid border border-(--border) rounded-md hover:text-text hover:border-(--border-hi) transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || searching || !draft.ready || !!draft.pending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 bg-accent hover:bg-accent-hover text-bg text-sm font-semibold rounded-md transition-[background-color,transform] duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none sm:min-w-[180px]"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {mode === "create" ? "Guardar película" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
