import Link from "next/link";
import Image from "next/image";
import { t } from "@/lib/i18n";
export function JournalPoster({ movie }: { movie: { id: number; title: string; posterUrl: string | null; myRating: number | null } }) {
  return <Link href={`/peliculas/${movie.id}`} className="block group min-w-0">
    <div className="relative aspect-2/3 bg-surface-hi rounded overflow-hidden">
      {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.title} fill sizes="(max-width: 640px) 45vw, 180px" className="object-cover transition-transform duration-150 group-hover:scale-[1.02]" /> : <span className="block p-3">{movie.title}</span>}
    </div>
    <h3 className="font-display text-xl mt-2">{movie.title}</h3>
    <p className="text-sm text-text-mid">{movie.myRating === null ? t("poster.sinNota") : `${movie.myRating}/10`}</p>
  </Link>;
}
