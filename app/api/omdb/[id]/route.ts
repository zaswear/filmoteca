import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOmdbById, parseOmdbMovie } from "@/lib/omdb";
import { z } from "zod";

const idSchema = z.string().regex(/^tt\d+$/, "ID de IMDb inválido (formato: tt1234567)");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const parsed = idSchema.safeParse(idParam);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const movie = await getOmdbById(parsed.data);
    if (!movie) {
      return NextResponse.json({ error: "Película no encontrada en OMDb" }, { status: 404 });
    }
    return NextResponse.json({
      raw:    movie,
      parsed: parseOmdbMovie(movie),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error OMDb";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
