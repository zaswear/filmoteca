import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchOmdb } from "@/lib/omdb";
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
    const results = await searchOmdb(parsed.data.q, parsed.data.year);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error OMDb";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
