/**
 * El contrato de la vista del diario: qué filtros hay, cómo viajan en la URL y
 * cómo se traducen a una consulta de Prisma.
 *
 * Vive fuera del componente porque ahora lo usan los dos lados. Antes el
 * servidor mandaba **el catálogo entero** al navegador y el componente
 * filtraba, ordenaba y paginaba en memoria: 300 KB de HTML para enseñar
 * veinticuatro carteles, y subiendo con cada película registrada. Ahora el
 * servidor devuelve solo la página pedida, así que las dos partes tienen que
 * entender exactamente los mismos parámetros.
 */

export type SortKey = "createdAt" | "watchedAt" | "myRating" | "imdbRating" | "title" | "year";
export type SortOrder = "asc" | "desc";
export type ViewMode = "grid" | "list";

export interface Filters {
  search: string;
  status: string;
  genre: string;
  year: string;
  director: string;
  hasImdbReview: string;    // "all" | "yes" | "no"
  importedFromImdb: string; // "all" | "yes" | "no"
  sortKey: SortKey;
  sortOrder: SortOrder;
  view: ViewMode;
  page: number;
}

export const GRID_PAGE = 24;
export const LIST_PAGE = 50;

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "createdAt", label: "Fecha de entrada" },
  { value: "watchedAt", label: "Fecha de visionado" },
  { value: "myRating", label: "Mi puntuación" },
  { value: "imdbRating", label: "Puntuación IMDb" },
  { value: "title", label: "Título" },
  { value: "year", label: "Año" },
];

export const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "vista", label: "Vista" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "descartada", label: "Descartada" },
];

export const DEFAULTS: Filters = {
  search: "", status: "", genre: "", year: "", director: "",
  hasImdbReview: "all", importedFromImdb: "all",
  sortKey: "createdAt", sortOrder: "desc", view: "grid", page: 1,
};

const SORT_KEYS = SORT_OPTIONS.map((o) => o.value);

/** La URL es entrada de usuario: se valida todo, nunca se confía en el valor. */
export function parseFilters(sp: URLSearchParams): Filters {
  const sortKey = sp.get("sort") as SortKey | null;
  const view = sp.get("view");
  const pageRaw = parseInt(sp.get("page") ?? "1", 10);
  const tri = (v: string | null) => (v === "yes" || v === "no" ? v : "all");

  return {
    search: sp.get("q") ?? "",
    status: STATUS_OPTIONS.some((o) => o.value && o.value === sp.get("status")) ? sp.get("status")! : "",
    genre: sp.get("genre") ?? "",
    year: /^\d{4}$/.test(sp.get("year") ?? "") ? sp.get("year")! : "",
    director: sp.get("director") ?? "",
    hasImdbReview: tri(sp.get("review")),
    importedFromImdb: tri(sp.get("imported")),
    sortKey: sortKey && SORT_KEYS.includes(sortKey) ? sortKey : DEFAULTS.sortKey,
    sortOrder: sp.get("order") === "asc" ? "asc" : "desc",
    view: view === "list" ? "list" : "grid",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** Solo serializa lo que se aparta del defecto: /peliculas sigue limpia. */
export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.search) p.set("q", f.search);
  if (f.status) p.set("status", f.status);
  if (f.genre) p.set("genre", f.genre);
  if (f.year) p.set("year", f.year);
  if (f.director) p.set("director", f.director);
  if (f.hasImdbReview !== "all") p.set("review", f.hasImdbReview);
  if (f.importedFromImdb !== "all") p.set("imported", f.importedFromImdb);
  if (f.sortKey !== DEFAULTS.sortKey) p.set("sort", f.sortKey);
  if (f.sortOrder !== "desc") p.set("order", f.sortOrder);
  if (f.view !== "grid") p.set("view", f.view);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const pageSizeFor = (f: Filters) => (f.view === "grid" ? GRID_PAGE : LIST_PAGE);

type Contains = { contains: string; mode?: "insensitive" };

/**
 * El `where` de Prisma. Traduce los mismos filtros que antes se aplicaban en
 * memoria, con dos detalles que importan:
 *
 * - `genres` se guarda como JSON en una columna de texto, así que el filtro
 *   busca el valor **entrecomillado** (`"Drama"`) y no la subcadena suelta: si
 *   no, «Drama» casaría también con «Dramedia».
 * - Las descartadas se esconden por defecto, pero **no** cuando las pides
 *   expresamente. Antes se excluían en la consulta pasara lo que pasara, así
 *   que elegir «Descartada» en el filtro no devolvía ninguna.
 */
export function whereFor(f: Filters) {
  const and: Record<string, unknown>[] = [];

  if (f.status) and.push({ status: f.status });
  else and.push({ status: { not: "descartada" } });

  if (f.search) {
    const contains: Contains = { contains: f.search, mode: "insensitive" };
    and.push({ OR: [{ title: contains }, { originalTitle: contains }, { directors: contains }] });
  }
  if (f.genre) and.push({ genres: { contains: `"${f.genre}"` } });
  if (f.year) and.push({ year: parseInt(f.year, 10) });
  if (f.director) and.push({ directors: { contains: f.director, mode: "insensitive" } });
  if (f.hasImdbReview !== "all") and.push({ hasImdbReview: f.hasImdbReview === "yes" });
  if (f.importedFromImdb !== "all") and.push({ importedFromImdb: f.importedFromImdb === "yes" });

  return { AND: and };
}

/**
 * El `orderBy`. Los nulos se colocan como los colocaba el orden en memoria, que
 * trataba «sin nota» como -1 y «sin año» como 0: al final cuando se ordena de
 * mayor a menor, al principio cuando es de menor a mayor. Sin `nulls` explícito
 * Postgres los pone siempre al final y el orden ascendente cambiaba.
 *
 * El `id` desempata para que la paginación sea estable: sin él, dos películas
 * con la misma nota pueden cambiar de orden entre la página 1 y la 2 y una se
 * repite mientras otra no sale nunca.
 */
/** Las columnas que admiten nulo. Prisma solo acepta `{ sort, nulls }` en
 *  estas: pedírselo para `createdAt`, que es NOT NULL, revienta la consulta
 *  entera con «Expected SortOrder, provided Object». */
const ANULABLES = new Set<SortKey>(["watchedAt", "myRating", "imdbRating", "year"]);

export function orderByFor(f: Filters) {
  const sort = f.sortOrder;
  const nulls = sort === "asc" ? ("first" as const) : ("last" as const);
  const clave = ANULABLES.has(f.sortKey) ? { [f.sortKey]: { sort, nulls } } : { [f.sortKey]: sort };
  return [clave, { id: sort }] as never;
}
