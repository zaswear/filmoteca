const { PrismaClient } = require("../lib/generated/prisma");
const fs = require("fs");
const path = require("path");

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
        collections: true
      }
    });

    console.log(`Se encontraron ${movies.length} películas en la base de datos.`);

    let processedCount = 0;
    let linkedCount = 0;

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      console.log(`\n[${i + 1}/${movies.length}] Procesando: ${movie.title} (${movie.year})`);

      if (movie.collections.length > 0) {
        console.log(`  -> Omitido: Ya está asociado a las sagas: ${movie.collections.map(c => c.name).join(", ")}`);
        continue;
      }

      if (!movie.imdbId || !movie.imdbId.startsWith("tt")) {
        console.log(`  -> Omitido: ID de IMDb inválido o no disponible (${movie.imdbId}).`);
        continue;
      }

      console.log(`  -> Buscando ID de TMDB para ${movie.imdbId}...`);
      try {
        const findUrl = `https://api.themoviedb.org/3/find/${movie.imdbId}?external_source=imdb_id&language=es-ES`;
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
        const tmdbMovieSummary = findData.movie_results?.[0];

        if (!tmdbMovieSummary) {
          console.log(`  -> No se encontró película en TMDB para el ID IMDb ${movie.imdbId}`);
          await sleep(200);
          continue;
        }

        const tmdbId = tmdbMovieSummary.id;
        console.log(`  -> ID TMDB Encontrado: ${tmdbId}. Solicitando detalles de película...`);

        const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?language=es-ES`;
        const detailsRes = await fetch(detailsUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!detailsRes.ok) {
          console.error(`  -> Error al consultar detalles en TMDB: ${detailsRes.status} ${detailsRes.statusText}`);
          await sleep(200);
          continue;
        }

        const detailsData = await detailsRes.json();
        const collectionInfo = detailsData.belongs_to_collection;

        if (!collectionInfo) {
          console.log(`  -> No pertenece a ninguna saga oficial de TMDB.`);
          processedCount++;
          await sleep(150);
          continue;
        }

        const collectionName = collectionInfo.name;
        console.log(`  -> ¡Pertenece a la saga!: "${collectionName}". Guardando asociación en DB...`);

        // Vincular a la colección
        await prisma.movie.update({
          where: { id: movie.id },
          data: {
            collections: {
              connectOrCreate: {
                where: { name: collectionName },
                create: { name: collectionName }
              }
            }
          }
        });

        console.log(`     [+] Película vinculada exitosamente a la saga "${collectionName}"`);
        linkedCount++;
        processedCount++;

      } catch (err) {
        console.error(`  -> Error de procesamiento para ${movie.title}:`, err.message);
      }

      // Retraso de cortesía para respetar límites de tasa de la API
      await sleep(150);
    }

    console.log(`\nProcesamiento finalizado.`);
    console.log(`Películas procesadas: ${processedCount}`);
    console.log(`Películas vinculadas a nuevas sagas: ${linkedCount}`);

  } catch (err) {
    console.error("Error crítico de ejecución:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
