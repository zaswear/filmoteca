import Image from "next/image";
import { Disc3, ExternalLink, Star } from "lucide-react";
import { getBlurayReleases } from "@/lib/bluray-releases";

export const metadata = { title: "Lanzamientos Blu-ray" };
export const revalidate = 21600;

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default async function LanzamientosBlurayPage() {
    const releases = await getBlurayReleases();

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
            <header className="border-b border-(--border) pb-6">
                <div className="flex items-center gap-3">
                    <Disc3 size={28} className="text-(--accent)" aria-hidden="true" />
                    <h2 className="font-display text-[22px] leading-none text-text">
                        Lanzamientos Blu-ray
                    </h2>
                </div>
                <p className="mt-3 max-w-2xl text-xs uppercase tracking-widest text-text-faint font-mono">
                    Ediciones de los últimos 6 meses y anunciadas, con audio castellano y nota IMDb de 7,5 o más
                </p>
            </header>

            {releases.length === 0 ? (
                <div className="border border-(--border) bg-(--surface) px-6 py-20 text-center">
                    <Disc3 size={34} className="mx-auto mb-3 text-text-faint opacity-60" aria-hidden="true" />
                    <p className="text-sm font-medium text-text-mid">No hay lanzamientos que cumplan los filtros.</p>
                    <p className="mx-auto mt-2 max-w-md text-xs text-text-faint">
                        La lista se actualiza cada seis horas a partir de las fichas de Mubis y las notas de IMDb.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {releases.map((release) => (
                        <article
                            key={release.link}
                            className="flex gap-5 border border-(--border) bg-(--surface) p-5 shadow-(--shadow-card) transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-(--border-hi) hover:shadow-lg"
                        >
                            <div className="relative aspect-2/3 w-28 shrink-0 overflow-hidden bg-bg sm:w-32">
                                {release.posterUrl ? (
                                    <Image
                                        src={release.posterUrl}
                                        alt={`Carátula de ${release.title}`}
                                        fill
                                        sizes="128px"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-text-faint">
                                        <Disc3 size={26} aria-hidden="true" />
                                    </div>
                                )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
                                <div>
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                                        Sale el {formatDate(release.releaseDate)}
                                    </p>
                                    <h2 className="mt-2 line-clamp-3 font-display text-xl font-semibold italic leading-snug text-text">
                                        {release.title}
                                    </h2>
                                </div>

                                <div className="space-y-3 border-t border-(--border) pt-3">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-mid">
                                        <span className="inline-flex items-center gap-1.5 text-(--accent)">
                                            <Star size={13} fill="currentColor" aria-hidden="true" />
                                            IMDb {release.imdbRating.toFixed(1)}
                                        </span>
                                        <span title={release.audio}>Audio castellano confirmado</span>
                                    </div>
                                    <a
                                        href={release.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-mono text-text-mid transition-colors hover:text-text"
                                    >
                                        Ver edición en Mubis <ExternalLink size={10} aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
