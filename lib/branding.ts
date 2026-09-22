/**
 * La marca, en un solo sitio.
 *
 * Esta app se despliega en dos sitios: la instancia personal («Director's Cut»)
 * y el repositorio público, donde cada quien monta la suya. El nombre, el
 * subtítulo y la URL canónica son lo ÚNICO que cambia entre una y otra, así que
 * viven aquí y no repartidos por el layout, el logo y el exportador de postales.
 *
 * Se leen de `NEXT_PUBLIC_*` porque el logo y la postal son componentes de
 * cliente: una variable sin ese prefijo no llega al navegador y el nombre
 * saldría vacío en la interfaz aunque el `<title>` fuese correcto.
 *
 * Los valores por defecto son los de la instancia personal. Una instancia nueva
 * no necesita tocar código: basta con las tres variables en su `.env`.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Filmoteca";

export const APP_TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE?.trim() || "Film diary";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

/**
 * La firma del pie. Vacía (`NEXT_PUBLIC_APP_AUTHOR=""`) quita el pie entero:
 * una instancia ajena no tiene por qué arrastrar la firma de otro.
 */
export const APP_AUTHOR =
  process.env.NEXT_PUBLIC_APP_AUTHOR ?? "";

/**
 * Bugsnag, opcional. La clave de navegador no es un secreto —viaja en el HTML—
 * pero sí identifica UN proyecto concreto: dejarla escrita en el código manda
 * los errores de cualquier instancia al panel de otra persona. Sin variable, no
 * se carga el script.
 */
export const BUGSNAG_API_KEY = process.env.NEXT_PUBLIC_BUGSNAG_API_KEY?.trim() || "";

/**
 * Las ciudades del filtro de cartelera.
 *
 * Estaban escritas en el componente, con cuatro ciudades holandesas: una
 * instancia montada en otro sitio veía un filtro que no le servía de nada. La
 * primera es la que sale seleccionada. Lista vacía = sin filtro de ciudad.
 *
 * Los pases los siembra un proceso propio en la tabla `cinema_showtimes`; esto
 * solo decide qué ciudades se ofrecen para filtrar.
 */
export const CINEMA_CITIES: string[] = (process.env.NEXT_PUBLIC_CINEMA_CITIES ?? "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);
