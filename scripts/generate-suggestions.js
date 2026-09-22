const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run") || /^(1|true)$/i.test(process.env.DRY_RUN || "");

// Carga robusta manual del archivo .env
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
    console.log("Environment variables loaded from .env");
  } else {
    console.warn("Warning: .env file not found at " + envPath);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTMDB(endpoint, token, params = {}) {
  const urlParams = new URLSearchParams(params);
  const url = `https://api.themoviedb.org/3/${endpoint}?${urlParams}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`TMDB API error ${res.status} ${res.statusText} on ${endpoint}`);
  }
  return res.json();
}

async function main() {
  loadEnv();

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    console.error("Error: TMDB_ACCESS_TOKEN no encontrado en el archivo .env");
    process.exit(1);
  }

  try {
    console.log("Obteniendo películas sugeridas desde TMDB...");

    // 1. Obtener películas populares y mejor valoradas usando páginas aleatorias y discover
    const movieCandidates = new Map();
    const rndPage = (max = 20) => String(1 + Math.floor(Math.random() * max));

    const endpoints = [
      // Populares de páginas aleatorias (para tener variedad cada semana)
      { path: "movie/popular", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/popular", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/popular", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/popular", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/popular", params: { page: rndPage(15), language: "es-ES" } },
      // Mejor valoradas de páginas aleatorias
      { path: "movie/top_rated", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/top_rated", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/top_rated", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/top_rated", params: { page: rndPage(15), language: "es-ES" } },
      { path: "movie/top_rated", params: { page: rndPage(15), language: "es-ES" } },
      // Descubrimientos populares (con al menos 200 votos)
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "popularity.desc", "vote_count.gte": "200" } },
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "popularity.desc", "vote_count.gte": "200" } },
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "popularity.desc", "vote_count.gte": "200" } },
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "popularity.desc", "vote_count.gte": "200" } },
      // Descubrimientos altamente valorados desde el año 2000 (con al menos 300 votos)
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "vote_average.desc", "vote_count.gte": "300", "primary_release_date.gte": "2000-01-01" } },
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "vote_average.desc", "vote_count.gte": "300", "primary_release_date.gte": "2000-01-01" } },
      { path: "discover/movie", params: { page: rndPage(20), language: "es-ES", sort_by: "vote_average.desc", "vote_count.gte": "300", "primary_release_date.gte": "2000-01-01" } }
    ];

    for (const ep of endpoints) {
      console.log(`  -> Consultando endpoint ${ep.path} (pág: ${ep.params.page})...`);
      try {
        const data = await fetchTMDB(ep.path, token, ep.params);
        const results = data.results || [];
        
        for (const m of results) {
          // Excluir clásicas (anteriores al año 2000)
          const year = m.release_date ? parseInt(m.release_date.slice(0, 4)) : null;
          if (!year || year < 2000) continue;

          // Filtro de calificación mínima de 5.0
          if (m.vote_average < 5.0) continue;

          movieCandidates.set(m.id, {
            tmdbId: m.id,
            title: m.title,
            year,
            rating: Math.round(m.vote_average * 10) / 10,
            plot: m.overview || null,
            posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            genres: [] // se rellenará en los detalles
          });
        }
      } catch (err) {
        console.error(`  -> Error al consultar endpoint ${ep.path}:`, err.message);
      }
      await sleep(150);
    }

    const uniqueCandidates = Array.from(movieCandidates.values())
      .sort(() => Math.random() - 0.5);
    console.log(`Encontradas ${uniqueCandidates.length} películas candidatas (año >= 2000, nota >= 5.0).`);

    // 2. Obtener detalles de cada película para conseguir el imdbId y géneros
    const suggestions = [];
    const limit = Math.min(uniqueCandidates.length, 150); // Límite de 150 sugerencias

    console.log(`Obteniendo detalles de las mejores ${limit} películas...`);
    for (let i = 0; i < limit; i++) {
      const candidate = uniqueCandidates[i];
      console.log(`[${i + 1}/${limit}] Cargando detalles para: ${candidate.title}`);

      try {
        const details = await fetchTMDB(`movie/${candidate.tmdbId}`, token, {
          language: "es-ES",
          append_to_response: "external_ids,videos"
        });

        const imdbId = details.imdb_id || details.external_ids?.imdb_id;
        if (!imdbId) {
          console.log(`  -> Omitido: No tiene ID de IMDb.`);
          continue;
        }

        // Obtener códigos de país de origen y producción
        const countries = new Set();
        if (details.origin_country) {
          details.origin_country.forEach(c => countries.add(c));
        }
        if (details.production_countries) {
          details.production_countries.forEach(c => {
            if (c.iso_3166_1) countries.add(c.iso_3166_1);
          });
        }

        // Determinar si es de la India, Turquía u otros países de Asia (excluyendo Japón y Corea del Sur)
        const EXCLUDED_COUNTRIES = new Set([
          "IN", "TR", "CN", "HK", "TW", "TH", "VN", "ID", "PH", "SG", "MY", "PK", "BD", "NP", 
          "LK", "IR", "IQ", "AF", "AM", "AZ", "BH", "BT", "BN", "KH", "CY", "GE", "JO", "KZ", 
          "KP", "KW", "KG", "LA", "LB", "MO", "MV", "MN", "MM", "OM", "PS", "QA", "SA", "SY", 
          "TJ", "TL", "TM", "AE", "UZ", "YE"
        ]);

        let shouldSkip = false;
        let skipReason = "";

        for (const country of countries) {
          if (EXCLUDED_COUNTRIES.has(country)) {
            shouldSkip = true;
            skipReason = `País excluido (${country})`;
            break;
          }
          if (country === "JP" || country === "KR") {
            // Permitir Japón y Corea del Sur solo si son famosas (ej. mínimo 500 votos en TMDB)
            const minVotes = 500;
            const voteCount = details.vote_count || 0;
            if (voteCount < minVotes) {
              shouldSkip = true;
              skipReason = `Película de ${country === "JP" ? "Japón" : "Corea"} poco famosa (${voteCount} votos, mínimo ${minVotes})`;
              break;
            }
          }
        }

        if (shouldSkip) {
          console.log(`  -> Omitido: ${skipReason} - ${candidate.title}`);
          continue;
        }

        // Buscar el tráiler de YouTube
        const videos = details.videos?.results || [];
        const trailer = 
          videos.find(v => v.type === "Trailer" && v.site === "YouTube" && v.iso_639_1 === "es") ||
          videos.find(v => v.type === "Trailer" && v.site === "YouTube") ||
          videos.find(v => v.site === "YouTube");
        const trailerKey = trailer ? trailer.key : null;

        suggestions.push({
          tmdbId: candidate.tmdbId,
          imdbId: imdbId,
          title: candidate.title,
          year: candidate.year,
          rating: candidate.rating,
          plot: details.overview || candidate.plot,
          posterUrl: candidate.posterUrl,
          genres: details.genres?.map(g => g.name) || [],
          trailerKey: trailerKey
        });

      } catch (err) {
        console.error(`  -> Error al consultar detalles de ${candidate.title}:`, err.message);
      }

      await sleep(150);
    }

    // 3. Escribir el archivo suggestions.json
    const outputDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const outputPath = path.join(outputDir, "suggestions.json");
    if (DRY_RUN) {
      console.log(`[dry-run] no se escribe ${outputPath} (${suggestions.length} sugerencias generadas)`);
    } else {
      fs.writeFileSync(outputPath, JSON.stringify(suggestions, null, 2), "utf8");
    }

    console.log(`\n¡Sugerencias actualizadas con éxito!`);
    console.log(`Se escribieron ${suggestions.length} sugerencias en ${outputPath}`);

  } catch (err) {
    console.error("Error crítico durante la generación de sugerencias:", err);
  }
}

main();
