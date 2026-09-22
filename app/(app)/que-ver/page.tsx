import { db } from "@/lib/db";
import { MOVIE_QUE_VER_SELECT, parseMovie } from "@/lib/types";
import { buildTasteProfile } from "@/lib/taste-profile";
import { QueVerClient } from "./que-ver-client";
import { BackLink } from "@/components/ui/back-link";

import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export const metadata = { title: t("queVer.titulo") };

export default async function QueVerPage() {
  // select ligero: el cliente solo usa estos campos, no la sinopsis/crítica.
  const [raw, taste] = await Promise.all([
    db.movie.findMany({
      where: { status: { in: ["pendiente", "en_progreso"] } },
      select: MOVIE_QUE_VER_SELECT,
    }),
    buildTasteProfile(),
  ]);
  const pool = raw.map((m) => parseMovie(m));

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <BackLink />
      </div>
      <QueVerClient pool={pool} taste={taste} aiEnabled={!!process.env.ANTHROPIC_API_KEY} />
    </div>
  );
}
