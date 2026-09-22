// Rellena Movie.releaseDate (estreno exacto TMDB) para las películas de la
// watchlist, de modo que la watchlist pueda marcar los estrenos "próximamente".
//
//   node --experimental-strip-types --env-file=.env scripts/backfill-release-dates.mjs          (solo pendientes sin fecha)
//   node --experimental-strip-types --env-file=.env scripts/backfill-release-dates.mjs --all    (todas sin fecha)
import { PrismaClient } from "../lib/generated/prisma/index.js";
import { isImdbId, extractReleaseDate } from "../lib/tmdb-release-date.ts";

const db = new PrismaClient();
const ALL = process.argv.includes("--all");
const TMDB = "https://api.themoviedb.org/3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function token() {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) { console.error("Falta TMDB_ACCESS_TOKEN"); process.exit(1); }
  return t;
}

async function findReleaseDate(imdbId) {
  if (!isImdbId(imdbId)) return null;
  const url = `${TMDB}/find/${imdbId}?external_source=imdb_id`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return extractReleaseDate(data); // "YYYY-MM-DD" | null
}

async function main() {
  const movies = await db.movie.findMany({
    where: { releaseDate: null, ...(ALL ? {} : { status: "pendiente" }) },
    select: { id: true, title: true, imdbId: true },
  });
  console.log(`${movies.length} película(s) sin releaseDate${ALL ? "" : " (pendientes)"}…\n`);

  let set = 0;
  for (const m of movies) {
    try {
      const rd = await findReleaseDate(m.imdbId);
      if (rd) {
        await db.movie.update({ where: { id: m.id }, data: { releaseDate: new Date(rd) } });
        set++;
        console.log(`  ✓ ${m.title} → ${rd}`);
      } else {
        console.log(`  · ${m.title}: sin fecha en TMDB`);
      }
    } catch (e) {
      console.error(`  ✗ ${m.title}: ${e.message}`);
    }
    await sleep(120);
  }
  console.log(`\nActualizadas ${set}/${movies.length}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
