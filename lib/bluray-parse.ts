/**
 * El parseo del feed y de las fichas de mubis, sin nada de red.
 *
 * Vive aparte de `bluray-releases.ts` por dos motivos: aquí está toda la
 * lógica que se puede equivocar —y que de hecho se equivocó: durante meses la
 * sección salía vacía porque el título no se limpiaba bien— y así se puede
 * probar sin tocar internet ni las claves de OMDb y TMDb.
 */

export const MUBIS_ORIGIN = "https://www.mubis.es";

export interface FeedItem {
    link: string;
    description: string;
    posterUrl: string | null;
}

const MONTHS: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
};

function decodeHtml(value: string): string {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value: string): string {
    return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function absoluteMubisUrl(value: string): string {
    return value.startsWith("http") ? value : `${MUBIS_ORIGIN}${value}`;
}

export function parseFeed(xml: string): FeedItem[] {
    const items: FeedItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const link = content.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
        const description = content.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
        // La descripción del feed llega escapada: el `<img>` es literalmente
        // `&lt;img …&gt;`, así que buscarlo sin decodificar antes no encuentra
        // nunca nada. Esta imagen es el respaldo de la carátula cuando TMDb no
        // tiene ninguna, y llevaba siendo siempre `null`.
        const image = decodeHtml(description).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];

        if (link && description) {
            items.push({
                link,
                description,
                posterUrl: image ? absoluteMubisUrl(image) : null,
            });
        }
    }

    return items;
}

export function extractTitlePageUrl(description: string): string | null {
    const href = description.match(/href=(?:"|'|&quot;)(\/titulos\/[^"'&]+)(?:"|'|&quot;)/i)?.[1];
    return href ? absoluteMubisUrl(decodeHtml(href)) : null;
}

export function extractReleaseDate(description: string): Date | null {
    const match = stripTags(description).match(/\b(\d{1,2}) de ([a-záéíóú]+) de (\d{4})\b/i);
    if (!match) return null;

    const month = MONTHS[match[2].toLowerCase()];
    if (month === undefined) return null;

    const date = new Date(Number(match[3]), month, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Texto de la fila «Audio» de la ficha, o null si mubis aún no lo ha publicado
 *  (pasa en los anuncios: la ficha existe antes que las especificaciones). */
export function extractAudioText(html: string): string | null {
    const match = html.match(/<th[^>]*>\s*Audio\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    const audio = match ? stripTags(match[1]) : "";
    return audio || null;
}

export function extractAudio(html: string): string | null {
    const audio = extractAudioText(html);
    if (!audio) return null;

    // «Español latino» contiene «español», así que la comprobación ingenua daba
    // por bueno un disco doblado solo en latino y la ficha anunciaba «audio
    // castellano confirmado» sin serlo. Se descartan primero esas pistas.
    const sinLatino = audio.replace(/espa[ñn]ol\s+latino/gi, "");
    return /\b(?:castellano|espa[ñn]ol)\b/i.test(sinLatino) ? audio : null;
}

/**
 * El <h1> de mubis es el nombre de la EDICIÓN, no el de la película:
 * «El Club de los Poetas Muertos - Edición Metálica Ultra HD Blu-ray».
 * Hay que quitar primero el formato y después el sufijo de edición, o la
 * búsqueda en TMDb no encuentra nada.
 */
const SUFIJO_FORMATO =
    /\s+(?:en\s+)?(?:Ultra\s+HD\s+|UHD\s+|4K\s+)?Blu-?ray(?:\s*\+\s*DVD)?(?:\s+3D)?$/i;
const SUFIJO_EDICION = /\s*[-–—]\s*(?:Edici[oó]n|Pack|Steelbook)\b.*$/i;

/** La ficha de mubis trae «<strong>Año:</strong> 1989». Sin ese año, buscar
 *  «Aniquilación» en TMDb devuelve primero una película de 2026 y no la de 2018. */
export function extractYear(html: string): string | null {
    const match = html.match(/<strong>\s*A[ñn]o:\s*<\/strong>\s*(\d{4})/i);
    return match ? match[1] : null;
}

/** Quita formato y edición: «Aniquilación - Edición Metálica Blu-ray» → «Aniquilación». */
export function cleanTitle(raw: string): string | null {
    const limpio = stripTags(raw)
        .replace(SUFIJO_FORMATO, "")
        .replace(SUFIJO_EDICION, "")
        .trim();

    return limpio || null;
}

export function extractTitle(html: string): string | null {
    const rawTitle = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    return rawTitle ? cleanTitle(rawTitle) : null;
}

// ─── Calendario mensual ──────────────────────────────────────────────────────
//
// El RSS de mubis (`mubis.xml`) es su feed de NOTICIAS: 25 artículos, unas dos
// semanas, y los resúmenes con decenas de lanzamientos no traen un título
// aprovechable. La sección salía con dos películas. El calendario
// `/novedades-en-blu-ray/todas?categoria=peliculas&periodo=M-AAAA` lista todas
// las películas del mes agrupadas por día, con histórico y anuncios.

export interface ListingItem {
    link: string;
    title: string;
    /** "YYYY-MM-DD" */
    releaseDate: string;
    posterUrl: string | null;
}

export function monthListingUrl(year: number, month: number): string {
    return `${MUBIS_ORIGIN}/novedades-en-blu-ray/todas?categoria=peliculas&periodo=${month}-${year}`;
}

const DIA_SEMANA = /^(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\s+(\d{1,2})$/i;

/**
 * Cada día va en un `<h3>Martes  6</h3>` seguido de sus tarjetas. Los demás
 * `<h3>` de la página (pie: «Contacto», «Contenidos»…) no casan con el patrón
 * de día y cortan el bloque anterior sin aportar nada.
 */
export function parseMonthListing(html: string, year: number, month: number): ListingItem[] {
    const items: ListingItem[] = [];
    const seen = new Set<string>();
    const bloques = html.split(/<h3[^>]*>/i).slice(1);

    for (const bloque of bloques) {
        const cierre = bloque.indexOf("</h3>");
        if (cierre < 0) continue;
        const dia = stripTags(bloque.slice(0, cierre)).match(DIA_SEMANA);
        if (!dia) continue;
        const releaseDate = `${year}-${String(month).padStart(2, "0")}-${dia[1].padStart(2, "0")}`;

        const tarjeta = /<a href="(\/titulos\/[^"]+)"[^>]*>\s*<img[^>]*?src="([^"]+)"[\s\S]*?<strong>\s*<a href="\1">([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = tarjeta.exec(bloque.slice(cierre))) !== null) {
            const link = absoluteMubisUrl(decodeHtml(m[1]));
            const title = cleanTitle(m[3]);
            if (!title || seen.has(link)) continue;
            seen.add(link);
            items.push({ link, title, releaseDate, posterUrl: absoluteMubisUrl(decodeHtml(m[2])) });
        }
    }

    return items;
}

/** Meses {year, month} desde `atras` meses antes de `hoy` hasta `adelante` después. */
export function monthsAround(hoy: Date, atras: number, adelante: number): { year: number; month: number }[] {
    const meses: { year: number; month: number }[] = [];
    for (let d = -atras; d <= adelante; d++) {
        const f = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + d, 1));
        meses.push({ year: f.getUTCFullYear(), month: f.getUTCMonth() + 1 });
    }
    return meses;
}

