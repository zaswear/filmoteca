import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchTmdb, posterUrl } from "@/lib/tmdb";
import { z } from "zod";

const schema = z.object({
  q:    z.string().min(1).max(200),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    q:    searchParams.get("q"),
    year: searchParams.get("year") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetro 'q' requerido" }, { status: 400 });
  }

  try {
    const results = await searchTmdb(parsed.data.q, parsed.data.year);
    // Normaliza al mismo formato que OmdbSearchResult para compatibilidad
    const normalized = results.map((r) => ({
      imdbID:  String(r.id),          // usamos tmdb id temporalmente
      tmdbId:  r.id,
      Title:   r.title,
      Year:    r.release_date?.slice(0, 4) ?? "",
      Poster:  posterUrl(r.poster_path) ?? "N/A",
      Type:    "movie",
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error TMDB";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
