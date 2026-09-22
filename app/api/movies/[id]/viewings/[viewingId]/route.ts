import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const idValido = (raw: string) => /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw));

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; viewingId: string }> },
) {
  if (!(await getServerSession(authOptions))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, viewingId } = await params;
  if (!idValido(id) || !idValido(viewingId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // El movieId entra en el `where` a propósito: así no se puede borrar el
  // revisionado de otra película adivinando su id.
  const { count } = await db.viewing.deleteMany({
    where: { id: Number(viewingId), movieId: Number(id) },
  });
  if (!count) return NextResponse.json({ error: "Revisionado no encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
