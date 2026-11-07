import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CARTELERA_TAG } from "@/lib/cartelera-vigente";

export const dynamic = 'force-dynamic';

// Lo llama el workflow directorscut-cartelera.yml al terminar el scrape, para
// que la cartelera en caché se renueve ya y no al caducar su día de margen.
// No hay sesión (va fuera del login en proxy.ts): lo protege CRON_SECRET.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }

  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secret}`);
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // { expire: 0 }: caducidad inmediata, que es lo que pide un webhook. Con
  // "max" la primera visita tras el scrape aún vería la cartelera anterior.
  revalidateTag(CARTELERA_TAG, { expire: 0 });
  return NextResponse.json({ success: true, revalidated: CARTELERA_TAG });
}
