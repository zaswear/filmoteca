const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

const DRY_RUN = process.argv.includes("--dry-run") || /^(1|true)$/i.test(process.env.DRY_RUN || "");
const db = new PrismaClient();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    env.split(/\r?\n/).forEach((line) => {
      if (line.trim().startsWith("#") || !line.trim()) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/\\n/gm, "\n");
        }
        value = value.replace(/(^['"]|['"]$)/g, "").trim();
        process.env[key] = value;
      }
    });
  }
}

async function main() {
  loadEnv();
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    console.error("TMDB_ACCESS_TOKEN not found in environment");
    process.exit(1);
  }

  // Find all movies that are missing a trailerKey OR have empty directors OR have empty cast
  const allMovies = await db.movie.findMany();
  
  const toEnrich = allMovies.filter(m => {
    const directorsArr = JSON.parse(m.directors || "[]");
    const castArr = JSON.parse(m.cast || "[]");
    return !m.trailerKey || directorsArr.length === 0 || castArr.length === 0;
  });

  console.log(`Found ${allMovies.length} movies in total.`);
  console.log(`Found ${toEnrich.length} movies needing enrichment.`);

  for (let i = 0; i < toEnrich.length; i++) {
    const movie = toEnrich[i];
    console.log(`[${i + 1}/${toEnrich.length}] Enriching "${movie.title}" (ID: ${movie.id}, IMDb: ${movie.imdbId})...`);

    try {
      // 1. Find on TMDB
      const findUrl = `https://api.themoviedb.org/3/find/${movie.imdbId}?external_source=imdb_id&language=es-ES`;
      const findRes = await fetch(findUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!findRes.ok) {
        console.error(`  Failed to find on TMDB (Status: ${findRes.status})`);
        await sleep(500);
        continue;
      }
      const findData = await findRes.json();
      const tmdbMovieResult = findData.movie_results?.[0];
      if (!tmdbMovieResult) {
        console.warn(`  No TMDB results found for IMDb ID ${movie.imdbId}`);
        await sleep(500);
        continue;
      }

      // 2. Fetch full details (videos & credits)
      const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbMovieResult.id}?language=es-ES&append_to_response=credits,videos&include_video_language=es,en,null`;
      const detailRes = await fetch(detailUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!detailRes.ok) {
        console.error(`  Failed to fetch details for TMDB ID ${tmdbMovieResult.id} (Status: ${detailRes.status})`);
        await sleep(500);
        continue;
      }
      const detail = await detailRes.json();

      // Extract trailer
      const trailer = (detail.videos?.results ?? [])
        .find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ?? null;

      // Extract directors
      const directors = (detail.credits?.crew ?? [])
        .filter((c) => c.job === "Director")
        .map((c) => c.name);

      // Extract cast
      const cast = (detail.credits?.cast ?? [])
        .sort((a, b) => a.order - b.order)
        .slice(0, 5)
        .map((c) => c.name);

      // Prepare updates
      const updates = {};
      
      const currentDirectors = JSON.parse(movie.directors || "[]");
      const currentCast = JSON.parse(movie.cast || "[]");

      if (!movie.trailerKey && trailer) {
        updates.trailerKey = trailer;
        console.log(`  -> Added trailerKey: ${trailer}`);
      }
      if (currentDirectors.length === 0 && directors.length > 0) {
        updates.directors = JSON.stringify(directors);
        console.log(`  -> Added directors: ${directors.join(", ")}`);
      }
      if (currentCast.length === 0 && cast.length > 0) {
        updates.cast = JSON.stringify(cast);
        console.log(`  -> Added cast: ${cast.join(", ")}`);
      }
      
      // Fallbacks for duration, plot, and poster if missing
      if (!movie.durationMin && detail.runtime) {
        updates.durationMin = detail.runtime;
        console.log(`  -> Added durationMin: ${detail.runtime}`);
      }
      if (!movie.plot && detail.overview) {
        updates.plot = detail.overview;
        console.log(`  -> Added plot (synopsis)`);
      }

      if (Object.keys(updates).length > 0) {
        if (DRY_RUN) {
          console.log(`  [dry-run] actualizaría ${Object.keys(updates).join(", ")}`);
        } else {
          await db.movie.update({
            where: { id: movie.id },
            data: updates
          });
          console.log(`  Successfully updated database.`);
        }
      } else {
        console.log(`  No new information could be enriched.`);
      }

    } catch (err) {
      console.error(`  Error enriching movie ${movie.title}:`, err);
    }

    await sleep(500);
  }

  console.log("Enrichment complete.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
