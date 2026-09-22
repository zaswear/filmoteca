const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run") || /^(1|true)$/i.test(process.env.DRY_RUN || "");

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
        value = value.replace(/(^['"]|['"]$)/g, "").trim();
        process.env[key] = value;
      }
    });
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

async function generateAiSummary(title, year, originalPlot, apiKey) {
  if (!apiKey) return originalPlot;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Escribe un resumen global corto y atractivo en español de la película '${title}' (${year}). El argumento original en inglés es: "${originalPlot || 'No disponible'}". El resumen debe ser descriptivo, en tono de sinopsis cinematográfica formal, y no debe exceder las 80 palabras. Evita spoilers y ve directo a la trama.`;
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    if (!res.ok) {
      console.warn(`  -> Gemini API respondió con error: ${res.status}`);
      return originalPlot;
    }
    
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.log(`  -> Resumen de IA generado para ${title}`);
      return text.trim();
    }
    return originalPlot;
  } catch (err) {
    console.warn(`  -> Error al generar resumen con IA para ${title}:`, err.message);
    return originalPlot;
  }
}

async function main() {
  loadEnv();

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    console.error("Error: TMDB_ACCESS_TOKEN no encontrado en el archivo .env");
    process.exit(1);
  }

  try {
    const currentYear = new Date().getFullYear();
    console.log(`Obteniendo películas LGBT+ de ${currentYear} mejor valoradas...`);

    let results = [];

    // 1. Descubrir películas LGBT+ del año actual
    const paramsCurrent = {
      language: "es-ES",
      primary_release_year: currentYear.toString(),
      with_keywords: "158718|363345|250606|264386",
      sort_by: "vote_average.desc",
      "vote_count.gte": "5",
      page: "1"
    };

    const dataCurrent = await fetchTMDB("discover/movie", token, paramsCurrent);
    results = results.concat(dataCurrent.results || []);
    console.log(`Encontradas ${results.length} candidatas preliminares para el año ${currentYear}.`);

    // Fallback: Si hay menos de 10, traer también del año anterior para completar
    if (results.length < 10) {
      const prevYear = currentYear - 1;
      console.log(`Pocas películas en ${currentYear} (${results.length}). Buscando también de ${prevYear}...`);
      const paramsPrev = {
        ...paramsCurrent,
        primary_release_year: prevYear.toString()
      };
      const dataPrev = await fetchTMDB("discover/movie", token, paramsPrev);
      const prevResults = dataPrev.results || [];
      results = results.concat(prevResults);
      console.log(`Añadidas ${prevResults.length} candidatas preliminares de ${prevYear}.`);
    }

    const uniqueCandidates = results.map(m => ({
      tmdbId: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.slice(0, 4)) : currentYear,
      rating: Math.round(m.vote_average * 10) / 10,
      plot: m.overview || null,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null
    }));

    // 2. Obtener detalles de cada película
    const suggestions = [];
    const limit = Math.min(uniqueCandidates.length, 25);

    console.log(`Obteniendo detalles de las mejores ${limit} películas...`);
    for (let i = 0; i < limit; i++) {
      const candidate = uniqueCandidates[i];
      console.log(`[${i + 1}/${limit}] Cargando detalles para: ${candidate.title}`);

      try {
        const details = await fetchTMDB(`movie/${candidate.tmdbId}`, token, {
          language: "es-ES",
          append_to_response: "external_ids,videos",
          include_video_language: "es,en,null"
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

        // Filtro de exclusión de países de Asia y Turquía
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

        // Buscar tráiler de YouTube
        const videos = details.videos?.results || [];
        const trailer = 
          videos.find(v => v.type === "Trailer" && v.site === "YouTube" && v.iso_639_1 === "es") ||
          videos.find(v => v.type === "Trailer" && v.site === "YouTube") ||
          videos.find(v => v.site === "YouTube");
        const trailerKey = trailer ? trailer.key : null;

        const aiPlot = await generateAiSummary(
          candidate.title,
          candidate.year,
          details.overview || candidate.plot,
          process.env.GEMINI_API_KEY
        );

        suggestions.push({
          tmdbId: candidate.tmdbId,
          imdbId: imdbId,
          title: candidate.title,
          year: candidate.year,
          rating: candidate.rating,
          plot: aiPlot,
          posterUrl: candidate.posterUrl,
          genres: details.genres?.map(g => g.name) || [],
          trailerKey: trailerKey
        });

      } catch (err) {
        console.error(`  -> Error al consultar detalles de ${candidate.title}:`, err.message);
      }

      await sleep(150);
    }

    // 3. Escribir el archivo
    const outputDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const outputPath = path.join(outputDir, "lgbt-top.json");
    if (DRY_RUN) {
      console.log(`[dry-run] no se escribe ${outputPath} (${suggestions.length} entradas generadas)`);
    } else {
      fs.writeFileSync(outputPath, JSON.stringify(suggestions, null, 2), "utf8");
    }

    console.log(`\n¡Top LGBT+ generado con éxito!`);
    console.log(`Se escribieron ${suggestions.length} películas en ${outputPath}`);

  } catch (err) {
    console.error("Error crítico durante la generación del top LGBT+:", err);
  }
}

main();
