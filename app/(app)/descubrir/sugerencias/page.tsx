import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { SugerenciasList } from "@/components/movies/sugerencias-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sugerencias de Películas" };

export default async function SugerenciasPage() {
  // 1. Obtener todas las películas ya registradas en la DB (tanto vistas como pendientes)
  const movies = await db.movie.findMany({
    select: { imdbId: true }
  });
  const existingImdbIds = new Set(movies.map((m) => m.imdbId));

  // 2. Leer las sugerencias actuales de suggestions.json
  let allSuggestions = [];
  try {
    const filePath = path.join(process.cwd(), "data", "suggestions.json");
    if (fs.existsSync(filePath)) {
      allSuggestions = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (err) {
    console.error("Error al leer sugerencias.json:", err);
  }

  // 3. Filtrar las sugerencias que ya existen en la DB del usuario
  const filteredSuggestions = allSuggestions.filter(
    (s: { imdbId?: string }) => s.imdbId && !existingImdbIds.has(s.imdbId)
  );

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-8">
      {/* Catálogo de sugerencias */}
      <SugerenciasList initialSuggestions={filteredSuggestions} />
    </div>
  );
}
