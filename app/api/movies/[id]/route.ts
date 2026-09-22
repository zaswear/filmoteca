import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MovieUpdateSchema } from "@/lib/schemas";

// El contexto es un objeto que CONTIENE params como una Promesa
type Ctx = {
  params: Promise<{ id: string }>;
};

function parseId(id: string) {
  const n = parseInt(id);
  return isNaN(n) ? null : n;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No unauthorized" }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const movie = await db.movie.findUnique({
    where: { id },
    include: {
      images:      { orderBy: { createdAt: "asc" } },
      collections: true,
    },
  });

  if (!movie) return NextResponse.json({ error: "Película no encontrada" }, { status: 404 });
  return NextResponse.json(movie);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const parsed = MovieUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { genres, directors, cast, watchedAt, collections, ...data } = parsed.data;

  const movie = await db.movie.update({
    where: { id },
    data: {
      ...data,
      ...(genres    !== undefined && { genres:    JSON.stringify(genres) }),
      ...(directors !== undefined && { directors: JSON.stringify(directors) }),
      ...(cast      !== undefined && { cast:      JSON.stringify(cast) }),
      ...(watchedAt !== undefined && { watchedAt: watchedAt ? new Date(watchedAt) : null }),
      // Reemplaza colecciones si se envían
      ...(collections !== undefined && {
        collections: {
          set: [],
          connectOrCreate: collections.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      }),
    },
    include: {
      images:      { orderBy: { createdAt: "asc" } },
      collections: true,
    },
  });

  return NextResponse.json(movie);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await db.movie.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}