// Rellena Movie.posterUrl para las películas sin carátula (p. ej. las
// importadas desde IMDb antes de que la importación consultara TMDB).
// Una sola llamada por película: TMDB /find?external_source=imdb_id devuelve
// el poster_path directamente en movie_results.
//
//   node --experimental-strip-types --env-file=.env scripts/backfill-posters.mjs
import { PrismaClient } from "../lib/generated/prisma/index.js";
import { isImdbId } from "../lib/tmdb-release-date.ts";
import { extractPosterPaths } from "../lib/tmdb-poster.ts";

const db = new PrismaClient();
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function token() {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) { console.error("Falta TMDB_ACCESS_TOKEN"); process.exit(1); }
  return t;
}

async function findPoster(imdbId) {
  if (!isImdbId(imdbId)) return null;
  const url = `${TMDB}/find/${imdbId}?external_source=imdb_id`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) return null;
  return extractPosterPaths(await res.json()); // { posterPath, backdropPath } | null
}

async function main() {
  const movies = await db.movie.findMany({
    where:   { posterUrl: null, imdbId: { startsWith: "tt" } },
    select:  { id: true, title: true, imdbId: true },
    orderBy: { id: "asc" },
  });
  console.log(`${movies.length} película(s) sin posterUrl…\n`);

  let set = 0;
  for (const m of movies) {
    try {
      const paths = await findPoster(m.imdbId);
      if (paths?.posterPath) {
        await db.movie.update({
          where: { id: m.id },
          data:  { posterUrl: `${IMG}/w500${paths.posterPath}` },
        });
        set++;
        console.log(`  ✓ ${m.title} → ${paths.posterPath}`);
      } else {
        console.log(`  · ${m.title}: sin póster en TMDB`);
      }
    } catch (e) {
      console.error(`  ✗ ${m.title}: ${e.message}`);
    }
    await sleep(120);
  }
  console.log(`\nActualizadas ${set}/${movies.length}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
