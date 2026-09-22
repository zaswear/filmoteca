export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  movieId:  z.number().int().positive(),
  publicId: z.string().min(1),
  url:      z.string().url(),
  width:    z.number().int().positive().optional(),
  height:   z.number().int().positive().optional(),
  type:     z.enum(["gallery", "poster_alt"]).default("gallery"),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { movieId, publicId, url, width, height, type } = parsed.data;

  // Verifica que la película existe
  const movie = await db.movie.findUnique({ where: { id: movieId } });
  if (!movie) return NextResponse.json({ error: "Película no encontrada" }, { status: 404 });

  const image = await db.image.create({
    data: { movieId, publicId, url, width, height, type },
  });

  return NextResponse.json(image, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const movieId = parseInt(searchParams.get("movieId") ?? "");
  if (isNaN(movieId)) {
    return NextResponse.json({ error: "movieId requerido" }, { status: 400 });
  }

  const images = await db.image.findMany({
    where:   { movieId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(images);
}
