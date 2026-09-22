"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { anunciar } from "@/components/ui/live-region";
import { InlineConfirm } from "@/components/ui/inline-confirm";

export function DeleteMovieButton({ movieId }: { movieId: number }) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    try {
      const res = await fetch(`/api/movies/${movieId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Error al eliminar la película");
      }
      router.push("/peliculas");
      router.refresh();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error al eliminar la película";
      anunciar(mensaje, "assertive");
    } finally {
      setLoading(false);
    }
  }

  return (
    <InlineConfirm
      question="¿Eliminar esta película permanentemente?"
      confirmLabel="Sí, eliminar"
      onConfirm={handleDelete}
    >
      {(pedirConfirmacion) => (
        <button
          onClick={pedirConfirmacion}
          disabled={loading}
          title="Eliminar"
          className="tap-target gap-1.5 px-2 sm:px-3 text-sm text-text-faint hover:text-(--error) hover:bg-(--surface-hi) transition-colors disabled:opacity-50"
        >
          {loading
            ? <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            : <Trash2 size={17} aria-hidden="true" />}
          <span className="hidden sm:inline">Eliminar</span>
          <span className="sr-only sm:hidden">Eliminar</span>
        </button>
      )}
    </InlineConfirm>
  );
}
