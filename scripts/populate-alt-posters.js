const { PrismaClient } = require("../lib/generated/prisma");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run") || /^(1|true)$/i.test(process.env.DRY_RUN || "");

// Carga robusta manual del archivo .env
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    env.split(/\r?\n/).forEach((line) => {
      // Ignora comentarios y líneas vacías
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
    console.log("Environment variables loaded from .env");
  } else {
    console.warn("Warning: .env file not found at " + envPath);
  }
}

// Función auxiliar para esperar
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  loadEnv();

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    console.error("Error: TMDB_ACCESS_TOKEN no encontrado en el archivo .env");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  
  try {
    console.log("Obteniendo películas desde la base de datos...");
    const movies = await prisma.movie.findMany({
      include: {
        images: {
          where: { type: "poster_alt" }
        }
      }
    });

    console.log(`Se encontraron ${movies.length} películas en la base de datos.`);

    let processedCount = 0;
    let importedCount = 0;

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      console.log(`\n[${i + 1}/${movies.length}] Procesando: ${movie.title} (${movie.year})`);

      if (movie.images.length > 0) {
        console.log(`  -> Omitido: Ya cuenta con ${movie.images.length} pósteres alternativos.`);
        continue;
      }

      if (!movie.imdbId || !movie.imdbId.startsWith("tt")) {
        console.log(`  -> Omitido: ID de IMDb inválido o no disponible (${movie.imdbId}).`);
        continue;
      }

      console.log(`  -> Buscando ID de TMDB para ${movie.imdbId}...`);
      try {
        const findUrl = `https://api.themoviedb.org/3/find/${movie.imdbId}?external_source=imdb_id`;
        const findRes = await fetch(findUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!findRes.ok) {
          console.error(`  -> Error al consultar TMDB Find API: ${findRes.status} ${findRes.statusText}`);
          await sleep(200);
          continue;
        }

        const findData = await findRes.json();
        const tmdbMovie = findData.movie_results?.[0];

        if (!tmdbMovie) {
          console.log(`  -> No se encontró película en TMDB para el ID IMDb ${movie.imdbId}`);
          await sleep(200);
          continue;
        }

        const tmdbId = tmdbMovie.id;
        console.log(`  -> ID TMDB Encontrado: ${tmdbId}. Solicitando imágenes...`);

        const imagesUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?include_image_language=en,es,null`;
        const imagesRes = await fetch(imagesUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!imagesRes.ok) {
          console.error(`  -> Error al consultar imágenes en TMDB: ${imagesRes.status} ${imagesRes.statusText}`);
          await sleep(200);
          continue;
        }

        const imagesData = await imagesRes.json();
        const posters = imagesData.posters || [];

        if (posters.length === 0) {
          console.log(`  -> No se encontraron pósteres en TMDB para esta película.`);
          await sleep(200);
          continue;
        }

        // Extraer el pathname del póster principal actual para excluirlo de los alternativos
        let mainPosterPath = "";
        if (movie.posterUrl) {
          const match = movie.posterUrl.match(/\/t\/p\/w\d+(\/.*)$/);
          if (match) mainPosterPath = match[1];
        }

        // Filtrar el póster principal actual
        const altPosters = posters.filter(p => p.file_path !== mainPosterPath);
        
        if (altPosters.length === 0) {
          console.log(`  -> No hay pósteres alternativos (solo el póster principal está disponible).`);
          await sleep(200);
          continue;
        }

        // Tomar como máximo 3 pósteres alternativos
        const limit = Math.min(altPosters.length, 3);
        console.log(`  -> Se encontraron ${altPosters.length} pósteres. Importando los mejores ${limit}...`);

        for (let j = 0; j < limit; j++) {
          const poster = altPosters[j];
          const imgUrl = `https://image.tmdb.org/t/p/w500${poster.file_path}`;

          if (DRY_RUN) {
            console.log(`     [dry-run] crearía póster ${imgUrl}`);
          } else {
            await prisma.image.create({
              data: {
                movieId: movie.id,
                publicId: "",
                url: imgUrl,
                width: poster.width,
                height: poster.height,
                type: "poster_alt"
              }
            });
          }
          console.log(`     [+] Póster guardado: ${imgUrl} (${poster.width}x${poster.height})`);
          importedCount++;
        }
        processedCount++;

      } catch (err) {
        console.error(`  -> Error de procesamiento para ${movie.title}:`, err.message);
      }

      // Retraso de cortesía para respetar límites de tasa de la API
      await sleep(150);
    }

    console.log(`\nProcesamiento finalizado.`);
    console.log(`Películas actualizadas: ${processedCount}`);
    console.log(`Pósteres alternativos guardados: ${importedCount}`);

  } catch (err) {
    console.error("Error crítico de ejecución:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
