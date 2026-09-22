import fs from "fs";
import path from "path";
import { Heart } from "lucide-react";
import { db } from "@/lib/db";
import { LgbtList } from "@/components/movies/lgbt-list";
import { RainbowGradient } from "@/components/ui/rainbow-gradient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Top LGBT+ Películas" };

export default async function LgbtPage() {
  // 1. Obtener todas las películas de la base de datos con su estado para marcar vistas/pendientes
  const movies = await db.movie.findMany({
    select: { imdbId: true, status: true }
  });
  
  const dbMoviesMap = movies.reduce((acc, curr) => {
    acc[curr.imdbId] = curr.status;
    return acc;
  }, {} as Record<string, string>);

  // 2. Leer el top LGBT+ generado desde lgbt-top.json
  let lgbtMovies = [];
  try {
    const filePath = path.join(process.cwd(), "data", "lgbt-top.json");
    if (fs.existsSync(filePath)) {
      lgbtMovies = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (err) {
    console.error("Error al leer lgbt-top.json:", err);
  }

  // Filtrar películas ya registradas (vista/pendiente) e ignoradas (descartada):
  // las ignoradas desaparecen del top y dejan su hueco a las que entren nuevas.
  const filteredLgbtMovies = lgbtMovies.filter(
    (m: { imdbId: string }) =>
      dbMoviesMap[m.imdbId] !== "pendiente" &&
      dbMoviesMap[m.imdbId] !== "vista" &&
      dbMoviesMap[m.imdbId] !== "descartada"
  );

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-8">
      {/* Cabecera */}
      <div className="border-b border-(--border) pb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[22px] leading-none text-text flex items-center gap-3">
            Cine LGBT+ 
            <div className="relative inline-block w-7 h-7">
              <Heart size={28} className="absolute text-transparent select-none animate-pulse" style={{ stroke: "url(#rainbow-header)", fill: "url(#rainbow-header)" }} />
              <RainbowGradient id="rainbow-header" diagonal />
            </div>
          </h2>
          <p className="text-xs text-text-faint font-mono mt-2 uppercase tracking-widest">
            Las películas de temática gay y queer mejor valoradas del año
          </p>
        </div>
      </div>

      {/* Listado LGBT+ */}
      <LgbtList initialMovies={filteredLgbtMovies} initialDbStatus={dbMoviesMap} />
    </div>
  );
}
