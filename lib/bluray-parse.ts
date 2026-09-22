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

export function extractAudio(html: string): string | null {
    const match = html.match(/<th[^>]*>\s*Audio\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!match) return null;

    const audio = stripTags(match[1]);
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

export function extractTitle(html: string): string | null {
    const rawTitle = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    if (!rawTitle) return null;

    const limpio = stripTags(rawTitle)
        .replace(SUFIJO_FORMATO, "")
        .replace(SUFIJO_EDICION, "")
        .trim();

    return limpio || null;
}

