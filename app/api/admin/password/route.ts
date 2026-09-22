import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cambiarPassword, MIN_PASSWORD } from "@/lib/admin-credentials";

/**
 * Cambia la contraseña desde la web. Pide la actual además de la sesión: una
 * sesión robada no debe poder dejarte fuera de tu propia cuenta.
 *
 * El reset cuando NO puedes entrar no pasa por aquí, pasa por
 * `npm run admin:password`, que escribe directamente en la base.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const actual = typeof body?.actual === "string" ? body.actual : "";
  const nueva = typeof body?.nueva === "string" ? body.nueva : "";
  if (!actual || !nueva) {
    return NextResponse.json({ error: "Faltan la contraseña actual y la nueva" }, { status: 400 });
  }

  let resultado;
  try {
    resultado = await cambiarPassword(actual, nueva);
  } catch (err) {
    console.error("[admin] error al cambiar la contraseña:", err);
    return NextResponse.json({ error: "No se pudo guardar la contraseña" }, { status: 500 });
  }

  if (resultado.ok) return NextResponse.json({ ok: true });

  const mensajes: Record<string, { texto: string; status: number }> = {
    "actual-incorrecta": { texto: "La contraseña actual no es correcta", status: 400 },
    corta: { texto: `La contraseña nueva necesita ${MIN_PASSWORD} caracteres o más`, status: 400 },
    repetida: { texto: "La contraseña nueva es la misma que la actual", status: 400 },
    "sin-credencial": {
      texto: "No hay credencial configurada. Usa npm run admin:password",
      status: 500,
    },
  };
  const { texto, status } = mensajes[resultado.motivo];
  return NextResponse.json({ error: texto }, { status });
}
