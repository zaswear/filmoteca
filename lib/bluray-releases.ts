import { db } from "./db";

// La sección lee la tabla bluray_releases, que llena cada semana
// scripts/sync-bluray.mjs a partir del calendario mensual de mubis. Antes esta
// función pedía el RSS de noticias de mubis en cada render y lo enriquecía al
// vuelo: 25 artículos, unas dos semanas, y la sección salía con dos películas.

export interface BlurayRelease {
    title: string;
    link: string;
    posterUrl: string | null;
    releaseDate: string;
    imdbId: string;
    imdbRating: number;
    audio: string;
}

const NOTA_MINIMA = 7.5;
const MESES_ATRAS = 6;

export async function getBlurayReleases(): Promise<BlurayRelease[]> {
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const desde = new Date(hoy);
    desde.setUTCMonth(desde.getUTCMonth() - MESES_ATRAS);

    let filas;
    try {
        filas = await db.blurayRelease.findMany({
            where: {
                releaseDate: { gte: desde },
                castellano: true,
                imdbRating: { gte: NOTA_MINIMA },
                imdbId: { not: null },
            },
        });
    } catch (error) {
        // P2021: la tabla aún no existe porque el script no ha corrido nunca
        // (la crea él). La sección sale vacía en vez de romper la página.
        if ((error as { code?: string }).code === "P2021") return [];
        throw error;
    }

    const hoyIso = hoy.toISOString();
    const releases: BlurayRelease[] = filas.map((f) => ({
        title: f.title,
        link: f.mubisUrl,
        // El póster de TMDb es fiable; la carátula de mubis queda de apoyo.
        posterUrl: f.posterUrl ?? f.mubisPosterUrl,
        releaseDate: f.releaseDate.toISOString(),
        imdbId: f.imdbId as string,
        imdbRating: f.imdbRating as number,
        audio: f.audio ?? "",
    }));

    releases.sort((a, b) => {
        // Primero lo anunciado (lo más próximo primero) y después lo ya
        // publicado (lo más reciente primero).
        const aFutura = a.releaseDate >= hoyIso;
        const bFutura = b.releaseDate >= hoyIso;
        if (aFutura !== bFutura) return aFutura ? -1 : 1;
        return aFutura
            ? a.releaseDate.localeCompare(b.releaseDate)
            : b.releaseDate.localeCompare(a.releaseDate);
    });

    // Una película con varias ediciones (Blu-ray, UHD, metálica…) sale una vez:
    // la tarjeta muestra la película, no la edición. Se queda la primera tras
    // ordenar, que es la más próxima o la más reciente.
    const vistas = new Set<string>();
    return releases.filter((r) => {
        if (vistas.has(r.imdbId)) return false;
        vistas.add(r.imdbId);
        return true;
    });
}
