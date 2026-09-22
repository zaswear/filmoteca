import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSuggestions } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // la generación hace varias llamadas a TMDB

/**
 * POST /api/sugerencias/refresh
 * Genera nuevas sugerencias al vuelo desde TMDB, excluyendo las películas que
 * ya están en la base de datos, y las devuelve (no persiste ningún fichero).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const existing = await db.movie.findMany({ select: { imdbId: true } });
    const exclude = new Set(existing.map((m) => m.imdbId));
    const suggestions = await generateSuggestions({ exclude, limit: 15 });
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[sugerencias/refresh]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudieron generar sugerencias" },
      { status: 500 },
    );
  }
}
