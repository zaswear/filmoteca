import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Paleta mínima de TODAS las películas (id/título/año/póster/estado) para el
// buscador global (⌘K). Sin paginación: el filtrado se hace en cliente.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const movies = await db.movie.findMany({
    where: { status: { not: "descartada" } },
    select: { id: true, title: true, originalTitle: true, year: true, posterUrl: true, status: true },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ movies });
}
