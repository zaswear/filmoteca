export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const image = await db.image.findUnique({ where: { id } });
  if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  // Borra de Cloudinary si hay credenciales configuradas
  const hasCredentials =
    process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

  if (hasCredentials) {
    try {
      await cloudinary.uploader.destroy(image.publicId);
    } catch (err) {
      console.error("Cloudinary delete error:", err);
      // Continuamos igualmente para borrar de la DB
    }
  }

  await db.image.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}