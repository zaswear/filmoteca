"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Loader2, Calendar, Film, Star, BookOpen, Check } from "lucide-react";
import { RatingInput } from "@/components/ui/rating-input";
import { DraftNotice } from "@/components/ui/draft-notice";
import { useFormDraft } from "@/lib/use-form-draft";
import { z } from "zod";
import { WATCH_FORMATS } from "@/lib/schemas";
import { WATCH_FORMAT_LABELS, type MovieParsed } from "@/lib/types";
import { useDialog } from "@/lib/use-dialog";
import { anunciar } from "@/components/ui/live-region";

import { t } from "@/lib/i18n";
interface MarkWatchedModalProps {
  // El modal no enseña la sinopsis, así que no la pide: así la watchlist puede
  // traer sus 74 pendientes sin ella.
  movie: Omit<MovieParsed, "plot">;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkWatchedModal({ movie, onClose, onSuccess }: MarkWatchedModalProps) {
  const local = new Date();
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  const draft = useFormDraft(`dc-watched:${movie.id}`, {
    myRating: movie.myRating ?? null,
    watchedAt: movie.watchedAt ? new Date(movie.watchedAt).toISOString().slice(0, 10) : local.toISOString().slice(0, 10),
    watchFormat: movie.watchFormat ?? "", review: movie.review ?? "", notes: movie.notes ?? "",
  }, (raw) => {
    const parsed = z.object({ myRating: z.number().min(0).max(10).nullable(), watchedAt: z.string(), watchFormat: z.string(), review: z.string(), notes: z.string() }).safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
  const { myRating, watchedAt, watchFormat, review, notes } = draft.value;
  function setField<K extends keyof typeof draft.value>(key: K, value: typeof draft.value[K]) {
    draft.update((previous) => ({ ...previous, [key]: value }));
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sello de confirmación: al guardar, la estampación cubre el diálogo un
  // instante antes de cerrarlo (el timeout se guarda para poder cancelarlo).
  const [stamped, setStamped] = useState(false);
  const stampTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Escape, trampa de foco, foco inicial y devolución del foco al disparador.
  // El listener de Escape suelto que había aquí resolvía solo lo primero: se
  // podía tabular fuera del diálogo hacia la página de detrás.
  function close() {
    if (saving || stamped) return;
    if (!draft.message || window.confirm(t("marcar.confirmCerrar"))) onClose();
  }
  useEffect(() => () => clearTimeout(stampTimer.current), []);
  const dialogRef = useDialog<HTMLDivElement>(close);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !draft.ready || draft.pending) return;
    setSaving(true);
    setError(null);

    const payload = {
      status: "vista",
      myRating,
      watchedAt: watchedAt ? new Date(watchedAt).toISOString() : null,
      watchFormat: watchFormat || null,
      review: review || null,
      notes: notes || null,
    };

    try {
      const res = await fetch(`/api/movies/${movie.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("marcar.errorActualizar"));
      }

      draft.saved();
      anunciar(`${movie.title} marcada como vista`);
      setStamped(true);
      stampTimer.current = setTimeout(onSuccess, 650);
    } catch (err) {
      console.error(err);
      const mensaje = err instanceof Error ? err.message : t("marcar.errorVisionado");
      setError(mensaje);
      // assertive: es un error y el usuario está esperando el resultado de una
      // acción que acaba de lanzar; interrumpir aquí es lo correcto.
      anunciar(mensaje, "assertive");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--backdrop) p-4 animate-fade-in"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-watched-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-(--surface) border border-(--border) rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Sello de confirmación: cubre el diálogo mientras se cierra */}
        {stamped && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-(--surface)/85">
            <span className="animate-stamp flex items-center gap-2.5 border-[3px] border-(--accent) rounded-xl bg-(--surface-hi) px-7 py-3.5 font-display text-2xl tracking-wide text-(--accent) uppercase">
              <Check size={26} aria-hidden="true" />{t("marcar.vista")}</span>
            <span className="font-mono text-xs text-text-mid uppercase tracking-widest">{movie.title}</span>
          </div>
        )}
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
          <h3 id="mark-watched-title" className="font-display font-medium text-lg italic text-text flex items-center gap-2">
            <Film size={18} className="text-(--accent)" aria-hidden="true" />{t("marcar.registrar")}</h3>
          <button
            type="button"
            onClick={close}
            aria-label={t("comun.cerrar")}
            className="tap-target -mr-2 rounded text-text-faint hover:text-text transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
              {error}
            </div>
          )}

          {/* Info película */}
          <div className="flex gap-4 p-3 rounded-lg bg-(--surface-hi) border border-(--border)">
            {movie.posterUrl ? (
              <Image
                src={movie.posterUrl}
                alt={movie.title}
                width={48}
                height={72}
                sizes="48px"
                className="w-12 h-18 object-cover rounded shadow-md shrink-0"
              />
            ) : (
              <div className="w-12 h-18 bg-bg flex items-center justify-center rounded text-[8px] italic text-text-faint border border-border">{t("form.sinPoster")}</div>
            )}
            <div className="min-w-0 flex flex-col justify-center">
              <h4 className="font-display font-semibold italic text-base text-text leading-snug truncate">
                {movie.title}
              </h4>
              <p className="text-xs text-text-faint font-mono mt-0.5">
                {movie.year ? `${movie.year}` : t("marcar.sinAnio")}
                {movie.durationMin ? ` · ${movie.durationMin} min` : ""}
              </p>
            </div>
          </div>

          <DraftNotice pending={!!draft.pending} message={draft.message} restore={draft.restore} discard={draft.discard} />
          <fieldset inert={saving || !draft.ready || !!draft.pending} disabled={saving || !draft.ready || !!draft.pending}>
          {/* Campos */}
          <div className="space-y-4">
            {/* Puntuación */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-text-faint mb-1.5 flex items-center gap-1.5">
                <Star size={12} className="text-(--accent)" />{t("form.miPuntuacion")}</label>
              <RatingInput value={myRating} onChange={(value) => setField("myRating", value)} />
            </div>

            {/* Fecha y Formato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mw-date" className="block text-[11px] uppercase tracking-widest text-text-faint mb-1.5 flex items-center gap-1.5">
                  <Calendar size={12} aria-hidden="true" />{t("form.fechaVisionado")}</label>
                <input
                  id="mw-date"
                  type="date"
                  required
                  value={watchedAt}
                  onChange={(e) => setField("watchedAt", e.target.value)}
                  className="w-full bg-(--surface) border border-(--border) rounded-[6px] px-3 py-2 text-[15px] text-text focus:outline-hidden focus:border-(--border-focus) transition-colors"
                />
              </div>

              <div>
                <label htmlFor="mw-format" className="block text-[11px] uppercase tracking-widest text-text-faint mb-1.5 flex items-center gap-1.5">
                  <Film size={12} aria-hidden="true" />{t("form.formato")}</label>
                <select
                  id="mw-format"
                  value={watchFormat}
                  onChange={(e) => setField("watchFormat", e.target.value)}
                  className="w-full bg-(--surface) border border-(--border) rounded-[6px] px-3 py-2 text-[15px] text-text focus:outline-hidden focus:border-(--border-focus) transition-colors"
                >
                  <option value="">— Sin especificar —</option>
                  {WATCH_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {WATCH_FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notas libres */}
            <div>
              <label htmlFor="mw-notes" className="block text-[11px] uppercase tracking-widest text-text-faint mb-1.5 flex items-center gap-1.5">
                <BookOpen size={12} aria-hidden="true" />{t("marcar.notasPrivadas")}</label>
              <textarea
                id="mw-notes"
                value={notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
                placeholder={t("marcar.notasAyuda")}
                className="w-full bg-(--surface) border border-(--border) rounded-[6px] px-3 py-2 text-[15px] text-text placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus) transition-colors resize-none"
              />
            </div>
          </div>

          </fieldset>
          {/* Footer acciones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--border)">
            <button
              type="button"
              disabled={saving || !draft.ready || !!draft.pending}
              onClick={close}
              className="px-4 py-2 text-sm text-text-mid hover:text-text rounded-[6px] hover:bg-(--surface-hi) transition-colors"
            >{t("comun.cancelar")}</button>
            <button
              type="submit"
              disabled={saving || !draft.ready || !!draft.pending}
              className="flex items-center gap-2 px-5 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />{t("comun.guardando")}</>
              ) : (
                "Marcar como Vista"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
