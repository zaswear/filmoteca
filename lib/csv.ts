import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { canonicalGenres } from "./genres";

export interface CsvRow {
  imdbId:        string;
  myRating:      number;
  watchedAt:     string;   // YYYY-MM-DD
  title:         string;
  originalTitle: string;
  year:          number;
  imdbRating:    number;
  runtimeMins:   number;
  genres:        string[];
  directors:     string[];
  imdbVotes:     number;
  type:          string;
}

interface RawRow {
  Const:            string;
  "Your Rating":    string;
  "Date Rated":     string;
  Title:            string;
  "Original Title": string;
  "Title Type":     string;
  "IMDb Rating":    string;
  "Runtime (mins)": string;
  Year:             string;
  Genres:           string;
  "Num Votes":      string;
  Directors:        string;
}

function parseRow(row: RawRow): CsvRow | null {
  const imdbId = row["Const"]?.trim();
  if (!imdbId || !/^tt\d+$/.test(imdbId)) return null;

  // Filtra solo películas (ignora series, documentales, etc.)
  const type = row["Title Type"]?.trim() ?? "";
  if (!["movie", "Película", "película", "tvMovie"].includes(type)) return null;

  return {
    imdbId,
    myRating:      parseFloat(row["Your Rating"])    || 0,
    watchedAt:     row["Date Rated"]?.trim()         || "",
    title:         row["Title"]?.trim()              || imdbId,
    originalTitle: row["Original Title"]?.trim()     || "",
    year:          parseInt(row["Year"])             || 0,
    imdbRating:    parseFloat(row["IMDb Rating"])    || 0,
    runtimeMins:   parseInt(row["Runtime (mins)"])   || 0,
    // El export de IMDb viene en inglés: se canoniza a español (ver lib/genres).
    genres:        row["Genres"] ? canonicalGenres(row["Genres"].split(",")) : [],
    directors:     row["Directors"] ? row["Directors"].split(",").map((d) => d.trim()).filter(Boolean) : [],
    imdbVotes:     parseInt((row["Num Votes"] ?? "").replace(/,/g, "")) || 0,
    type,
  };
}

/** Lee y parsea todos los CSV en /export_imdb. */
export function readImdbCsvs(): CsvRow[] {
  const dir = path.join(process.cwd(), "export_imdb");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".csv") && !f.includes(":"));

  const rows: CsvRow[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const { data } = Papa.parse<RawRow>(content, {
      header:        true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    for (const row of data) {
      const parsed = parseRow(row);
      if (parsed) rows.push(parsed);
    }
  }

  // Deduplica por imdbId (por si hay varios CSVs con solapamiento)
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.imdbId)) return false;
    seen.add(r.imdbId);
    return true;
  });
}
