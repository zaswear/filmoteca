import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTmdbById, parseTmdbMovie } from "@/lib/tmdb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const tmdbId  = parseInt(id);
  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: "ID TMDB inválido" }, { status: 400 });
  }

  try {
    const movie = await getTmdbById(tmdbId);
    if (!movie) {
      return NextResponse.json({ error: "Película no encontrada en TMDB" }, { status: 404 });
    }
    return NextResponse.json({ raw: movie, parsed: parseTmdbMovie(movie) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error TMDB";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
