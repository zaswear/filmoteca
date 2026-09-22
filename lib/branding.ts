/**
 * La marca, en un solo sitio.
 *
 * El nombre, el subtítulo y la URL canónica de TU instancia. Cámbialos con las
 * variables de entorno y no toques código: el layout, el logo, el manifiesto de
 * la PWA y la postal exportable leen todos de aquí.
 *
 * Son `NEXT_PUBLIC_*` porque el logo y la postal son componentes de cliente:
 * una variable sin ese prefijo no llega al navegador y el nombre saldría vacío
 * en la interfaz aunque el `<title>` fuese correcto. Next las hornea en el
 * bundle al construir, así que un cambio necesita rebuild, no solo reiniciar.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Filmoteca";

export const APP_TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE?.trim() || "Diario de cine";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

/**
 * La firma del pie. Vacía (por defecto) quita el pie entero: una instancia
 * ajena no tiene por qué arrastrar la firma de otro.
 */
export const APP_AUTHOR = process.env.NEXT_PUBLIC_APP_AUTHOR ?? "";

/**
 * Bugsnag, opcional. La clave de navegador no es un secreto —viaja en el HTML—
 * pero sí identifica UN proyecto concreto: dejarla escrita en el código mandaría
 * los errores de cualquier instancia al panel de otra persona. Sin variable, no
 * se carga el script.
 */
export const BUGSNAG_API_KEY = process.env.NEXT_PUBLIC_BUGSNAG_API_KEY?.trim() || "";
