/**
 * Pone fecha de visionado a las películas vistas que no la tienen, usando el
 * **estreno en España** según TMDb.
 *
 *   node --env-file=.env scripts/backfill-watched-dates.mjs            (ensayo)
 *   node --env-file=.env scripts/backfill-watched-dates.mjs --apply    (escribe)
 *
 * Por qué hace falta: 77 de las 240 vistas venían de la importación de IMDb sin
 * fecha. Sin ella no entran en el balance mensual, no pueden ser «lo último que
 * viste» y no se ordenan por fecha de visionado: un tercio del diario quedaba
 * fuera de todo lo que depende del tiempo.
 *
 * Qué NO es: la fecha real en que las viste. Es una aproximación deliberada —la
 * pediste así— que las coloca en el mes de su estreno. Sirve para ordenar y
 * para que dejen de ser invisibles, no para decir «esta noche vi esto».
 *
 * De dónde sale: IMDb no tiene API pública, así que la fuente es TMDb, que es
 * la que ya usa la app. Se prefiere el estreno en cines en España (tipo 3);
 * si no hay, la fecha española más antigua; si tampoco, el estreno global.
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../lib/generated/prisma/index.js";

const db = new PrismaClient();
const APLICAR = process.argv.includes("--apply");
const TMDB = "https://api.themoviedb.org/3";
const ESPERA = 120; // ms entre películas, por no castigar a TMDb
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TIPO_CINE = 3;
const HOY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

function token() {
  const t = process.env.TMDB_ACCESS_TOKEN;
  if (!t) {
    console.error("Falta TMDB_ACCESS_TOKEN");
    process.exit(1);
  }
  return t;
}

const pedir = async (ruta) => {
  const res = await fetch(`${TMDB}${ruta}`, { headers: { Authorization: `Bearer ${token()}` } });
  return res.ok ? res.json() : null;
};

/** @returns {Promise<{fecha: string, origen: string} | null>} */
async function estrenoEnEspana(imdbId) {
  if (!imdbId?.startsWith("tt")) return null;

  const encontrada = await pedir(`/find/${imdbId}?external_source=imdb_id`);
  const peli = encontrada?.movie_results?.[0];
  if (!peli) return null;

  const fechas = await pedir(`/movie/${peli.id}/release_dates`);
  const es = fechas?.results?.find((r) => r.iso_3166_1 === "ES")?.release_dates ?? [];

  const enCines = es.find((r) => r.type === TIPO_CINE);
  if (enCines) return { fecha: enCines.release_date.slice(0, 10), origen: "cines ES" };

  const primera = es
    .map((r) => r.release_date.slice(0, 10))
    .sort()[0];
  if (primera) return { fecha: primera, origen: "ES (otra ventana)" };

  if (peli.release_date) return { fecha: peli.release_date, origen: "estreno global" };
  return null;
}

async function main() {
  const peliculas = await db.movie.findMany({
    where: { AND: [{ status: "vista" }, { watchedAt: null }] },
    select: { id: true, title: true, imdbId: true, year: true },
    orderBy: { title: "asc" },
  });

  console.log(
    `${peliculas.length} película(s) vistas sin fecha de visionado.` +
      (APLICAR ? " Escribiendo.\n" : " ENSAYO: no se escribe nada. Añade --apply.\n"),
  );

  let puestas = 0;
  const sinFecha = [];
  // Las 77 estaban a null, así que deshacer es devolverlas a null. Se apunta
  // cuáles se han tocado para que se pueda, en vez de tener que adivinarlo.
  const tocadas = [];

  for (const p of peliculas) {
    const hallada = await estrenoEnEspana(p.imdbId).catch(() => null);
    if (!hallada) {
      sinFecha.push(p);
      console.log(`  ·  ${p.title} (${p.year ?? "—"}) — sin fecha en TMDb`);
      await sleep(ESPERA);
      continue;
    }

    // Si el estreno en España aún no ha llegado y la película ya está marcada
    // como vista, la viste antes (festival, pase de prensa, fuera de España):
    // ponerle la fecha del estreno la dejaría vista en el futuro. Tope en hoy.
    let fecha = new Date(`${hallada.fecha}T00:00:00Z`);
    let origen = hallada.origen;
    if (fecha > HOY) {
      fecha = HOY;
      origen = `${hallada.origen}, aún sin estrenar → hoy`;
    }

    if (APLICAR) {
      await db.movie.update({ where: { id: p.id }, data: { watchedAt: fecha } });
    }
    const iso = fecha.toISOString().slice(0, 10);
    tocadas.push({ id: p.id, title: p.title, watchedAt: iso });
    puestas += 1;
    console.log(`  ✓  ${p.title} (${p.year ?? "—"}) → ${iso}  [${origen}]`);
    await sleep(ESPERA);
  }

  if (APLICAR && tocadas.length) {
    const destino = new URL("./.backfill-watched-dates.json", import.meta.url);
    writeFileSync(destino, JSON.stringify({ at: new Date().toISOString(), antes: null, tocadas }, null, 2));
    console.log(`\nRegistro para deshacer: scripts/.backfill-watched-dates.json`);
  }

  console.log(
    `\n${puestas} con fecha${APLICAR ? " guardada" : " que se guardaría"}, ${sinFecha.length} sin ella.`,
  );
  if (sinFecha.length) {
    console.log("Sin fecha, hay que ponerlas a mano:");
    for (const p of sinFecha) console.log(`  - ${p.title} (${p.year ?? "—"}) ${p.imdbId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
