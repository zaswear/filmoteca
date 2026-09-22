/**
 * Idioma de la instancia.
 *
 * Filmoteca es de una persona por instalación, así que el idioma se elige una
 * vez al desplegar y no cambia en caliente: `NEXT_PUBLIC_APP_LOCALE=en|es`. Eso
 * evita segmentos `[locale]` en las rutas, middleware de negociación y un
 * selector que nadie usaría dos veces, y hace que `t()` funcione igual en
 * componentes de servidor y de cliente sin proveedor ni contexto.
 *
 * Es `NEXT_PUBLIC_` porque media interfaz es cliente. Next la hornea al
 * construir: cambiar de idioma pide rebuild, no reiniciar.
 *
 * El diccionario inglés está tipado contra el español, así que **olvidar una
 * clave es un error de compilación**, no una cadena vacía en producción.
 *
 * Los diccionarios viven en `lib/locales/` y no en `lib/i18n/`: con una carpeta,
 * `import "./i18n"` es un import de directorio, que el bundler de Next resuelve
 * pero el resolvedor ESM de Node no — y los tests corren con Node a pelo.
 */
import { es } from "./locales/es.ts";
import { en } from "./locales/en.ts";

export type Locale = "es" | "en";
export type Clave = keyof typeof es;

export const LOCALE: Locale = process.env.NEXT_PUBLIC_APP_LOCALE === "en" ? "en" : "es";

const DICCIONARIO = LOCALE === "en" ? en : es;

/**
 * `t("peliculas.vacio")` o, con interpolación, `t("stats.total", { n: 42 })`,
 * que sustituye `{n}` en la cadena.
 */
export function t(clave: Clave, vars?: Record<string, string | number>): string {
  const texto = DICCIONARIO[clave];
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (coincidencia, nombre) =>
    nombre in vars ? String(vars[nombre]) : coincidencia,
  );
}

/** El idioma que se le pide a TMDB. Sus sinopsis y títulos salen en este. */
export const TMDB_LANGUAGE = LOCALE === "en" ? "en-US" : "es-ES";

/** Para `toLocaleDateString` e `Intl`. */
export const DATE_LOCALE = LOCALE === "en" ? "en-GB" : "es-ES";

/** Fecha larga: «14 de marzo de 2026» / «14 March 2026». */
export function fechaLarga(valor: string | Date): string {
  return new Date(valor).toLocaleDateString(DATE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Fecha corta: «14 mar 2026» / «14 Mar 2026». */
export function fechaCorta(valor: string | Date): string {
  return new Date(valor).toLocaleDateString(DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
