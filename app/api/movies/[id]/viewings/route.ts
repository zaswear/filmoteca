import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Revisionados de una película: volver a ver algo que ya está en el diario.
 *
 * El primer visionado sigue viviendo en `Movie.watchedAt` / `Movie.myRating`,
 * que es lo que lee media aplicación. Aquí se apuntan los siguientes, así que
 * las veces que has visto algo son 1 + los revisionados.
 */
const NuevoRevisionado = z.object({
  watchedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida"),
  myRating: z.number().min(0).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const idValido = (raw: string) => /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw));

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getServerSession(authOptions))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const parsed = NuevoRevisionado.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisionado inválido" }, { status: 400 });
  }

  const pelicula = await db.movie.findUnique({ where: { id: Number(id) }, select: { id: true } });
  if (!pelicula) return NextResponse.json({ error: "Película no encontrada" }, { status: 404 });

  const viewing = await db.viewing.create({
    data: {
      movieId: pelicula.id,
      watchedAt: new Date(parsed.data.watchedAt),
      myRating: parsed.data.myRating ?? null,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json({ ok: true, viewing }, { status: 201 });
}
