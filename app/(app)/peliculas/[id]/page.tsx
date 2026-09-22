import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { parseMovie } from "@/lib/types";
import { ImageGallery } from "@/components/ui/image-gallery";
import { ViewingsSection } from "@/components/movies/viewings-section";
import { DeleteMovieButton } from "@/components/movies/delete-movie-button";
import { MarkWatchedButton } from "@/components/movies/mark-watched-button";
import { PostcardButton } from "@/components/movies/postcard-button";
import { MovieTicket } from "@/components/movies/movie-ticket";

import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movie  = await db.movie.findUnique({ where: { id: parseInt(id) } });
  return { title: movie?.title ?? t("ficha.pelicula") };
}

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) notFound();

  const raw = await db.movie.findUnique({
    where: { id },
    include: {
      images:   { orderBy: { createdAt: "asc" } },
      viewings: { orderBy: { watchedAt: "desc" } },
    },
  });
  if (!raw) notFound();

  const movie = parseMovie(raw);
  const gallery   = raw.images.filter((i) => i.type === "gallery");
  const posterAlts = raw.images.filter((i) => i.type === "poster_alt");

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-8">

      {/* Haz de proyector — decorativo, tras el contenido (z-index negativo) */}
      <div className="projector-beam" aria-hidden="true" />

      {/* ── Barra de acciones ──────────────────────────────────────────────
          En móvil son iconos, sin etiqueta: con texto, «Exportar Postal» y
          «← Películas» partían en dos líneas y, como cada botón medía lo que
          medía su palabra, la fila quedaba descuadrada. Los iconos son todos
          del mismo tamaño, así que se alinean solos. La etiqueta vuelve a
          partir de `sm`, donde sí cabe. */}
      <div className="flex items-center justify-between gap-2 mb-5 sm:mb-8">
        <Link
          href="/peliculas"
          className="tap-target gap-2 -ml-2 px-2 text-sm text-text-mid hover:text-text transition-colors"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="hidden sm:inline">{t("ficha.peliculas")}</span>
          <span className="sr-only sm:hidden">{t("ficha.volver")}</span>
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {(movie.status === "pendiente" || movie.status === "en_progreso") && (
            <MarkWatchedButton movie={movie} />
          )}
          <PostcardButton movie={movie} />
          <Link
            href={`/peliculas/${id}/editar`}
            title={t("ficha.editar")}
            className="tap-target gap-1.5 px-2 sm:px-3 text-sm text-text-mid hover:text-text hover:bg-(--surface-hi) transition-colors"
          >
            <Pencil size={17} aria-hidden="true" />
            <span className="hidden sm:inline">{t("ficha.editar")}</span>
            <span className="sr-only sm:hidden">{t("ficha.editar")}</span>
          </Link>
          <DeleteMovieButton movieId={id} />
        </div>
      </div>

      {/* ── Entrada de cine: cartel + ticket ── */}
      <MovieTicket movie={movie} id={id} />

      {/* ── Sinopsis ── */}
      {movie.plot && (
        <section className="mb-10">
          <h2 className="section-heading mb-3">{t("form.sinopsis")}</h2>
          <p className="text-text-mid text-[15px] leading-relaxed max-w-2xl">{movie.plot}</p>
        </section>
      )}

      {/* ── Tráiler ── */}
      {movie.trailerKey && (
        <section className="mb-10">
          <h2 className="section-heading mb-3">{t("ficha.trailer")}</h2>
          <div className="aspect-video w-full max-w-3xl rounded-lg overflow-hidden border border-(--border) shadow-raised bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${movie.trailerKey}`}
              title={`${movie.title} Tráiler`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* ── Mi crítica ── */}
      {movie.review && (
        <section className="mb-10">
          <h2 className="section-heading mb-4">{t("ficha.miCritica")}</h2>
          <div
            className="prose-review max-w-2xl"
            dangerouslySetInnerHTML={{ __html: movie.review }}
          />
        </section>
      )}

      {/* ── Notas ── */}
      {movie.notes && (
        <section className="mb-10">
          <h2 className="section-heading mb-3">{t("ficha.notas")}</h2>
          <p className="text-text-mid text-sm leading-relaxed whitespace-pre-wrap max-w-2xl">{movie.notes}</p>
        </section>
      )}

      {/* ── Visionados ── */}
      <ViewingsSection
        movieId={movie.id}
        primero={{
          watchedAt: movie.watchedAt ? (movie.watchedAt as Date).toISOString() : null,
          myRating: movie.myRating ?? null,
        }}
        revisionados={raw.viewings.map((v) => ({
          id: v.id,
          watchedAt: v.watchedAt.toISOString(),
          myRating: v.myRating,
          notes: v.notes,
        }))}
      />

      {/* ── Galería ── */}
      {gallery.length > 0 && (
        <section className="mb-10">
          <h2 className="section-heading mb-4">{t("ficha.galeria")}</h2>
          <ImageGallery images={gallery} />
        </section>
      )}

      {/* ── Pósteres alternativos ── */}
      {posterAlts.length > 0 && (
        <section className="mb-10">
          <h2 className="section-heading mb-4">{t("form.postersAlt")}</h2>
          <ImageGallery images={posterAlts} />
        </section>
      )}


    </div>
  );
}
