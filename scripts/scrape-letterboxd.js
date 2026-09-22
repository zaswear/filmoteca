#!/usr/bin/env node
/**
 * Scrapea la watchlist o el diario de Letterboxd y exporta los títulos
 * en el mismo formato CSV que acepta import_justwatch_csv.py.
 *
 * Uso (--user es obligatorio: es TU usuario de Letterboxd):
 *   node scripts/scrape-letterboxd.js --user <usuario>
 *   node scripts/scrape-letterboxd.js --user <usuario> --list watchlist
 *   node scripts/scrape-letterboxd.js --user <usuario> --list films  (películas vistas)
 *   node scripts/scrape-letterboxd.js --user <usuario> --list diary   (diario de visionados)
 *
 * Salida: import_data/letterboxd-<list>.csv (compatible con import_justwatch_csv.py)
 *
 * Requiere: agent-browser instalado globalmente
 */

const { spawnSync }  = require("child_process");
const fs             = require("fs");
const path           = require("path");

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag, def) => {
  const i = args.findIndex(a => a.startsWith(flag + "=") || a === flag);
  if (i === -1) return def;
  return args[i].includes("=") ? args[i].split("=")[1] : args[i + 1] ?? def;
};

// Sin valor por defecto a propósito: un usuario por defecto haría que un
// despiste raspara el diario de otra persona en vez del tuyo.
const USERNAME = get("--user");
if (!USERNAME) {
  console.error("Falta --user <usuario de Letterboxd>.");
  process.exit(1);
}
const LIST     = get("--list", "watchlist"); // watchlist | films | diary
const OUTPUT   = path.join(__dirname, "..", "import_data", `letterboxd-${LIST}.csv`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function ab(args) {
  const r = spawnSync("agent-browser", args, { encoding: "utf-8", timeout: 20000 });
  return (r.stdout || "").trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Scrapers por tipo de lista ────────────────────────────────────────────────

const EXTRACT_SCRIPTS = {
  watchlist: `
    JSON.stringify(
      [...document.querySelectorAll('.poster-container, li.poster-container')].map(el => {
        const img   = el.querySelector('[data-film-name]') || el.querySelector('div[data-film-slug]');
        const name  = img?.dataset?.filmName || img?.getAttribute('alt') || el.querySelector('img')?.alt;
        const year  = img?.dataset?.filmYear || el.querySelector('[data-film-year]')?.dataset?.filmYear;
        const slug  = img?.dataset?.filmSlug || el.querySelector('[data-film-slug]')?.dataset?.filmSlug;
        return { name, year, slug };
      }).filter(m => m.name)
    )
  `,
  films: `
    JSON.stringify(
      [...document.querySelectorAll('.poster-container')].map(el => {
        const img  = el.querySelector('[data-film-name], img[alt]');
        const name = img?.dataset?.filmName || img?.alt;
        const year = img?.dataset?.filmYear;
        const slug = img?.dataset?.filmSlug || el.querySelector('[data-film-slug]')?.dataset?.filmSlug;
        const rating = el.querySelector('.rated')?.className?.match(/rated-(\d+)/)?.[1];
        return { name, year, slug, rating: rating ? parseInt(rating) / 2 : null };
      }).filter(m => m.name)
    )
  `,
  diary: `
    JSON.stringify(
      [...document.querySelectorAll('tr.diary-entry-row')].map(row => {
        const name    = row.querySelector('.td-film-details h3')?.textContent?.trim();
        const year    = row.querySelector('.td-released .number')?.textContent?.trim();
        const dateEl  = row.querySelector('.td-calendar-date a');
        const date    = dateEl?.href?.match(/\/(\d{4}\/\d{2}\/\d{2})\//)?.[1]?.replace(/\//g, '-');
        const ratingEl = row.querySelector('.td-rating .rating');
        const rating  = ratingEl?.className?.match(/rated-(\d+)/)?.[1];
        return { name, year, date, rating: rating ? parseInt(rating) / 2 : null };
      }).filter(m => m.name)
    )
  `,
};

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const listMap = {
    watchlist: `https://letterboxd.com/${USERNAME}/watchlist/`,
    films:     `https://letterboxd.com/${USERNAME}/films/`,
    diary:     `https://letterboxd.com/${USERNAME}/films/diary/`,
  };

  const url    = listMap[LIST];
  const script = EXTRACT_SCRIPTS[LIST];

  if (!url) {
    console.error(`Lista desconocida: ${LIST}. Usa: watchlist | films | diary`);
    process.exit(1);
  }

  console.log(`Abriendo ${url} ...`);
  ab(["close", "--all"]);
  await sleep(500);
  ab(["open", url]);
  await sleep(3000);

  const allMovies = [];
  let page = 1;

  while (true) {
    console.log(`  Página ${page}...`);

    const evalResult = spawnSync("agent-browser", ["eval", script], {
      encoding: "utf-8",
      timeout: 15000,
    });
    const stdout = (evalResult.stdout || "").trim();

    let movies = [];
    try {
      const parsed = JSON.parse(stdout);
      movies = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Puede que agent-browser envuelva la respuesta en un objeto
      try {
        const wrapper = JSON.parse(stdout);
        if (wrapper.result) movies = JSON.parse(wrapper.result);
      } catch {
        console.warn("  No se pudo parsear la respuesta de la página.");
      }
    }

    if (movies.length === 0) {
      console.log("  Sin resultados — fin de la lista.");
      break;
    }

    allMovies.push(...movies);
    console.log(`  → ${movies.length} películas (total: ${allMovies.length})`);

    // Siguiente página
    const nextResult = spawnSync("agent-browser", ["click", "a.next"], {
      encoding: "utf-8",
      timeout: 8000,
    });
    if (nextResult.status !== 0 || (nextResult.stdout || "").toLowerCase().includes("error")) {
      break;
    }
    await sleep(2500);
    page++;
  }

  ab(["close"]);

  if (allMovies.length === 0) {
    console.log("No se encontraron películas. ¿El perfil es privado?");
    process.exit(0);
  }

  // ── CSV output ────────────────────────────────────────────────────────────
  // Formato compatible con import_justwatch_csv.py: una película por línea
  // (título sin comillas, compatible con el CSV simple que ya usa el proyecto)
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const lines = allMovies.map(m => {
    const parts = [m.name];
    if (m.year)   parts.push(m.year);
    if (m.rating) parts.push(`rating:${m.rating}`);
    if (m.date)   parts.push(`date:${m.date}`);
    return parts.join("\t");
  });

  fs.writeFileSync(OUTPUT, lines.join("\n") + "\n");
  console.log(`\n✓ ${allMovies.length} películas guardadas en ${OUTPUT}`);
  console.log(`\nPara importarlas:`);
  console.log(`  python3 import_justwatch_csv.py --csv ${OUTPUT}`);
  console.log(`  python3 import_justwatch_csv.py --csv ${OUTPUT} --dry-run`);
})();
