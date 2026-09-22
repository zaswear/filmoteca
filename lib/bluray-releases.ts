import { getOmdbById } from "./omdb";
import { searchTmdb, getTmdbById, posterUrl as tmdbPoster } from "./tmdb";

import {
    type FeedItem,
    extractAudio,
    extractReleaseDate,
    extractTitle,
    extractTitlePageUrl,
    extractYear,
    parseFeed,
} from "./bluray-parse";

const FEED_URL = "https://www.mubis.es/mubis.xml";

export interface BlurayRelease {
    title: string;
    link: string;
    posterUrl: string | null;
    releaseDate: string;
    imdbId: string;
    imdbRating: number;
    audio: string;
}


async function getText(url: string): Promise<string | null> {
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieDiary/1.0)" },
        next: { revalidate: 21600 },
    });
    return response.ok ? response.text() : null;
}

async function enrichItem(item: FeedItem, today: Date): Promise<BlurayRelease | null> {
    const releaseDate = extractReleaseDate(item.description);
    const titlePageUrl = extractTitlePageUrl(item.description);
    if (!releaseDate || !titlePageUrl) return null;

    // Ventana de la sección: los últimos 6 meses y todo lo anunciado a futuro.
    const ventana = new Date(today);
    ventana.setMonth(ventana.getMonth() - 6);
    if (releaseDate < ventana) return null;

    const titlePage = await getText(titlePageUrl);
    if (!titlePage) return null;

    const audio = extractAudio(titlePage);
    const title = extractTitle(titlePage);
    if (!audio || !title) return null;

    // La búsqueda va por TMDb, no por OMDb: mubis da el título en español y OMDb
    // solo indexa el original/inglés, así que `?s=El Club de los Poetas Muertos`
    // devuelve «Movie not found!» y la página se quedaba siempre vacía. TMDb sí
    // busca en es-ES; de ahí sacamos el imdbId y con él pedimos la nota a OMDb.
    const year = extractYear(titlePage);
    const candidato =
        (year ? (await searchTmdb(title, year))[0] : undefined) ??
        (await searchTmdb(title))[0];
    if (!candidato) return null;

    const ficha = await getTmdbById(candidato.id);
    if (!ficha?.imdb_id) return null;

    const movie = await getOmdbById(ficha.imdb_id);
    const rating = movie ? Number.parseFloat(movie.imdbRating) : Number.NaN;
    if (!movie || !Number.isFinite(rating) || rating < 7.5) return null;

    return {
        title,
        link: titlePageUrl,
        // La imagen del feed de mubis falla a menudo (src truncado en &,
        // lazy-loading), y por eso las tarjetas se quedaban con el placeholder.
        // El flujo ya trae la ficha de TMDb: su póster es fiable y el dominio
        // image.tmdb.org ya está en remotePatterns. La de mubis queda de apoyo.
        posterUrl: tmdbPoster(ficha.poster_path, "w342") ?? item.posterUrl,
        releaseDate: releaseDate.toISOString(),
        imdbId: movie.imdbID,
        imdbRating: rating,
        audio,
    };
}

export async function getBlurayReleases(): Promise<BlurayRelease[]> {
    const xml = await getText(FEED_URL);
    if (!xml) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const releases = await Promise.all(
        parseFeed(xml).map((item) => enrichItem(item, today).catch(() => null)),
    );

    const hoy = today.toISOString();

    return releases
        .filter((release): release is BlurayRelease => release !== null)
        .sort((a, b) => {
            // Primero lo anunciado (lo más próximo primero) y después lo ya
            // publicado (lo más reciente primero).
            const aFutura = a.releaseDate >= hoy;
            const bFutura = b.releaseDate >= hoy;
            if (aFutura !== bFutura) return aFutura ? -1 : 1;
            return aFutura
                ? a.releaseDate.localeCompare(b.releaseDate)
                : b.releaseDate.localeCompare(a.releaseDate);
        });
}
