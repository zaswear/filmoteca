"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { RatingInput } from "@/components/ui/rating-input";

import { t, DATE_LOCALE } from "@/lib/i18n";
export interface Revisionado {
  id: number;
  watchedAt: string;
  myRating: number | null;
  notes: string | null;
}

interface Props {
  movieId: number;
  /** El primer visionado, el que vive en la propia película. */
  primero: { watchedAt: string | null; myRating: number | null };
  revisionados: Revisionado[];
}

const HOY = () => new Date().toISOString().slice(0, 10);

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "long", year: "numeric" });

const nota = (n: number) => String(n).replace(".", ",");

/**
 * El historial de visionados. El primero sale de la propia película y no se
 * edita aquí —para eso está su ficha—; los demás son revisionados y se pueden
 * añadir y borrar.
 */
export function ViewingsSection({ movieId, primero, revisionados }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [cuando, setCuando] = useState(HOY);
  const [puntuacion, setPuntuacion] = useState<number | null>(null);
  const [apunte, setApunte] = useState("");

  const veces = (primero.watchedAt ? 1 : 0) + revisionados.length;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      const res = await fetch(`/api/movies/${movieId}/viewings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchedAt: new Date(`${cuando}T00:00:00Z`).toISOString(),
          myRating: puntuacion,
          notes: apunte || null,
        }),
      });
      if (!res.ok) throw new Error(t("visionados.errorGuardar"));
      setAbierto(false);
      setPuntuacion(null);
      setApunte("");
      setCuando(HOY);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("form.errorGuardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: number) {
    setBorrando(id);
    setError("");
    try {
      const res = await fetch(`/api/movies/${movieId}/viewings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("visionados.errorBorrar"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("visionados.errorBorrarTitulo"));
    } finally {
      setBorrando(null);
    }
  }

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="section-heading">
          {veces <= 1 ? t("visionados.titulo") : `Vista ${veces} veces`}
        </h2>
        <span className="flex-1 h-px bg-(--border)" />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="tap-target gap-2 px-3 text-sm font-semibold text-text hover:text-(--accent) transition-colors"
        >
          <Plus size={15} aria-hidden="true" />{t("visionados.apuntar")}</button>
      </div>

      {error && <p role="alert" className="text-(--error) text-sm mb-3">{error}</p>}

      {abierto && (
        <form onSubmit={guardar} className="border border-(--border) bg-surface p-4 mb-5 space-y-4">
          <div className="flex flex-wrap gap-5 items-start">
            <label className="grid gap-2 text-[11px] uppercase tracking-widest text-text-mid font-semibold">{t("visionados.cuando")}<input
                type="date"
                value={cuando}
                max={HOY()}
                onChange={(e) => setCuando(e.target.value)}
                required
                className="min-h-11 w-48 bg-(--bg) border border-(--border) px-3 text-base text-text"
              />
            </label>
            <div className="grid gap-2 text-[11px] uppercase tracking-widest text-text-mid font-semibold">{t("visionados.notaEstaVez")}<RatingInput value={puntuacion} onChange={setPuntuacion} />
            </div>
          </div>
          <label className="grid gap-2 text-[11px] uppercase tracking-widest text-text-mid font-semibold">{t("visionados.apunte")}<textarea
              value={apunte}
              onChange={(e) => setApunte(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={t("visionados.apunteAyuda")}
              className="w-full bg-(--bg) border border-(--border) p-3 font-mono text-lg text-text resize-none"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="tap-target px-5 bg-(--accent) text-(--bg) font-semibold text-sm disabled:opacity-50"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : t("comun.guardar")}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="tap-target px-4 border border-(--border) text-text-mid text-sm"
            >{t("comun.cancelar")}</button>
          </div>
        </form>
      )}

      <ol className="border-t border-(--text)">
        {revisionados.map((v) => (
          <li key={v.id} className="flex items-start gap-4 py-3 border-b border-(--border)">
            <span className="font-mono text-lg text-text w-44 shrink-0">{fecha(v.watchedAt)}</span>
            <span className="w-16 shrink-0 font-display text-lg text-(--accent)">
              {v.myRating == null ? "" : nota(v.myRating)}
            </span>
            <span className="flex-1 font-mono text-lg text-text-mid">{v.notes ?? ""}</span>
            <InlineConfirm
              question={t("visionados.confirmBorrar")}
              confirmLabel={t("visionados.siBorrar")}
              onConfirm={() => borrar(v.id)}
            >
              {(pedirConfirmacion) => (
                <button
                  type="button"
                  onClick={pedirConfirmacion}
                  disabled={borrando === v.id}
                  aria-label={`Borrar el revisionado del ${fecha(v.watchedAt)}`}
                  className="tap-target px-2 text-text-faint hover:text-(--error) transition-colors disabled:opacity-50"
                >
                  {borrando === v.id
                    ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    : <Trash2 size={15} aria-hidden="true" />}
                </button>
              )}
            </InlineConfirm>
          </li>
        ))}

        {primero.watchedAt ? (
          <li className="flex items-start gap-4 py-3 border-b border-(--border)">
            <span className="font-mono text-lg text-text w-44 shrink-0">{fecha(primero.watchedAt)}</span>
            <span className="w-16 shrink-0 font-display text-lg text-(--accent)">
              {primero.myRating == null ? "" : nota(primero.myRating)}
            </span>
            <span className="flex-1 font-mono text-lg text-text-faint">
              {revisionados.length > 0 ? t("visionados.primeraVez") : ""}
            </span>
          </li>
        ) : (
          <li className="py-3 border-b border-(--border) font-mono text-lg text-text-mid">{t("visionados.sinFecha")}</li>
        )}
      </ol>
    </section>
  );
}
