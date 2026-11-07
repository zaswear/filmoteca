// Sincroniza la tabla bluray_releases con el calendario mensual de mubis.
//
//   node --experimental-strip-types scripts/sync-bluray.mjs
//
// Lo lanza cada semana .github/workflows/directorscut-weekly-tasks.yml; la
// página /descubrir/bluray solo lee la tabla. Antes la página pedía el RSS de
// noticias de mubis en cada render: 25 artículos, unas dos semanas, y la
// sección salía con dos películas (ver lib/bluray-parse.ts).
//
// Es incremental: una edición ya comprobada no se vuelve a pedir salvo que
// (a) mubis aún no hubiera publicado su audio, o (b) tenga castellano y su
// nota de IMDb tenga más de 30 días. Así la primera pasada (~600 fichas) cabe
// en el cupo diario de OMDb y las siguientes solo piden lo nuevo.

import prismaPkg from "../lib/generated/prisma/index.js";
import {
    extractAudio,
    extractAudioText,
    extractYear,
    monthListingUrl,
    monthsAround,
    parseMonthListing,
} from "../lib/bluray-parse.ts";

const { PrismaClient } = prismaPkg;

try {
    process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
    // En el workflow las variables llegan por entorno.
}

const MESES_ATRAS = 6;
const MESES_ADELANTE = 4;
// OMDb gratuito: 1.000 peticiones al día. Se deja margen para la web.
const MAX_OMDB = 700;
const PAUSA_MS = 400;
const DIA = 24 * 60 * 60 * 1000;

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const OMDB_KEY = process.env.OMDB_API_KEY;
if (!TMDB_TOKEN || !OMDB_KEY) {
    console.error("ERROR: faltan TMDB_ACCESS_TOKEN u OMDB_API_KEY.");
    process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieDiary/1.0)" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} en ${url}`);
    return res.text();
}

async function tmdb(path, params = {}) {
    const qs = new URLSearchParams({ language: "es-ES", ...params });
    const res = await fetch(`https://api.themoviedb.org/3/${path}?${qs}`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`);
    return res.json();
}

let llamadasOmdb = 0;
async function omdbRating(imdbId) {
    llamadasOmdb++;
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
    if (!res.ok) throw new Error(`OMDb ${res.status}`);
    const data = await res.json();
    if (data.Response === "False") {
        // Con el cupo agotado OMDb contesta 200 + «Request limit reached!».
        if (/limit/i.test(data.Error ?? "")) throw new Error(`OMDb: ${data.Error}`);
        return null;
    }
    const nota = Number.parseFloat(data.imdbRating);
    return Number.isFinite(nota) ? nota : null;
}

/** mubis da el título en español: se busca en TMDb (es-ES), con el año de la
 *  ficha para desempatar, y de ahí sale el imdb_id para pedir la nota. */
async function fichaImdb(title, year) {
    const buscar = async (y) =>
        (await tmdb("search/movie", { query: title, include_adult: "false", ...(y ? { year: y } : {}) }))?.results?.[0];
    const candidato = (year ? await buscar(year) : undefined) ?? (await buscar());
    if (!candidato) return null;
    const ficha = await tmdb(`movie/${candidato.id}`);
    if (!ficha?.imdb_id) return null;
    return {
        imdbId: ficha.imdb_id,
        posterUrl: ficha.poster_path ? `https://image.tmdb.org/t/p/w342${ficha.poster_path}` : null,
    };
}

function necesitaComprobar(fila, ahora) {
    if (!fila.checkedAt) return true;
    const edad = ahora - fila.checkedAt.getTime();
    if (!fila.audio) return edad > 6 * DIA;
    if (fila.castellano) return edad > 30 * DIA;
    return false;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        // Aditivo e idempotente: en esta base no se hace `db push` (ver el
        // aviso de prisma/schema.prisma). Es el SQL que genera ese modelo.
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "bluray_releases" (
                "id" SERIAL NOT NULL,
                "mubis_url" TEXT NOT NULL,
                "title" TEXT NOT NULL,
                "release_date" DATE NOT NULL,
                "mubis_poster_url" TEXT,
                "audio" TEXT,
                "castellano" BOOLEAN NOT NULL DEFAULT false,
                "imdb_id" TEXT,
                "imdb_rating" DOUBLE PRECISION,
                "poster_url" TEXT,
                "checked_at" TIMESTAMP(3),
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "bluray_releases_pkey" PRIMARY KEY ("id")
            )`);
        await prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "bluray_releases_mubis_url_key" ON "bluray_releases"("mubis_url")`,
        );
        await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "bluray_releases_release_date_idx" ON "bluray_releases"("release_date")`,
        );

        // 1. Calendario: altas y cambios de fecha (los anuncios se mueven).
        const hoy = new Date();
        let enCalendario = 0;
        for (const { year, month } of monthsAround(hoy, MESES_ATRAS, MESES_ADELANTE)) {
            const html = await getText(monthListingUrl(year, month));
            const items = html ? parseMonthListing(html, year, month) : [];
            console.log(`${month}-${year}: ${items.length} películas`);
            enCalendario += items.length;
            for (const it of items) {
                await prisma.blurayRelease.upsert({
                    where: { mubisUrl: it.link },
                    create: {
                        mubisUrl: it.link,
                        title: it.title,
                        releaseDate: new Date(`${it.releaseDate}T00:00:00Z`),
                        mubisPosterUrl: it.posterUrl,
                    },
                    update: {
                        title: it.title,
                        releaseDate: new Date(`${it.releaseDate}T00:00:00Z`),
                        mubisPosterUrl: it.posterUrl,
                    },
                });
            }
            await sleep(PAUSA_MS);
        }
        // Cero en diez meses es que ha cambiado el HTML de mubis, no que no
        // salga nada: se falla para que el workflow lo enseñe en rojo.
        if (enCalendario === 0) throw new Error("El calendario de mubis no devolvió ninguna película.");

        // 2. Fichas: audio y, si hay castellano, nota de IMDb.
        const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - MESES_ATRAS, 1));
        const filas = await prisma.blurayRelease.findMany({
            where: { releaseDate: { gte: desde } },
            orderBy: { releaseDate: "desc" },
        });
        const pendientes = filas.filter((f) => necesitaComprobar(f, hoy.getTime()));
        console.log(`${filas.length} ediciones en ventana, ${pendientes.length} por comprobar.`);

        let comprobadas = 0;
        let errores = 0;
        for (const fila of pendientes) {
            if (llamadasOmdb >= MAX_OMDB) {
                console.log(`Tope de ${MAX_OMDB} llamadas a OMDb: el resto, la semana que viene.`);
                break;
            }
            try {
                const html = await getText(fila.mubisUrl);
                const datos = { checkedAt: new Date() };
                if (html) {
                    datos.audio = extractAudioText(html);
                    datos.castellano = extractAudio(html) !== null;
                    if (datos.castellano) {
                        const ficha = await fichaImdb(fila.title, extractYear(html));
                        if (ficha) {
                            datos.imdbId = ficha.imdbId;
                            datos.posterUrl = ficha.posterUrl;
                            datos.imdbRating = await omdbRating(ficha.imdbId);
                        }
                    }
                }
                await prisma.blurayRelease.update({ where: { id: fila.id }, data: datos });
                comprobadas++;
            } catch (error) {
                errores++;
                console.warn(`  ✗ ${fila.title}: ${error.message}`);
                // Cupo de OMDb agotado: seguir solo acumularía errores.
                if (/limit/i.test(error.message)) break;
            }
            await sleep(PAUSA_MS);
        }

        const visibles = await prisma.blurayRelease.count({
            where: { releaseDate: { gte: desde }, castellano: true, imdbRating: { gte: 7.5 } },
        });
        console.log(`Comprobadas ${comprobadas}, errores ${errores}, OMDb ${llamadasOmdb}. Visibles en la web: ${visibles}.`);
        if (pendientes.length > 0 && comprobadas === 0) throw new Error("No se pudo comprobar ninguna ficha.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
});
