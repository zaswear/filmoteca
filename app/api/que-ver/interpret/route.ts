import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { GENRE_VOCAB, expandGenres, type WatchFilters } from "@/lib/what-to-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Traduce una frase libre ("algo como Interstellar pero más ligero") a filtros
// de recomendación usando Claude. Opcional: solo activo si hay ANTHROPIC_API_KEY.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "IA no configurada" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, 400).trim() : "";
  if (!text) return NextResponse.json({ error: "texto vacío" }, { status: 400 });

  const client = new Anthropic();

  const schema = {
    type: "object",
    properties: {
      moodGenres: { type: "array", items: { type: "string", enum: GENRE_VOCAB } },
      maxRuntime: { type: ["integer", "null"] },
      minYear: { type: ["integer", "null"] },
      maxYear: { type: ["integer", "null"] },
      minRating: { type: ["number", "null"] },
      visualTone: { type: ["string", "null"], enum: ["neón", "pastel", "noir", "oscuro", "cálido", "frío", "blanco y negro", null] },
      note: { type: "string" },
    },
    required: ["moodGenres", "maxRuntime", "minYear", "maxYear", "minRating", "visualTone", "note"],
    additionalProperties: false,
  } as const;

  try {
    const params = {
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system:
        "Eres un asistente de recomendación de cine. Traduce lo que le apetece ver al usuario a filtros. " +
        "Devuelve géneros SOLO del vocabulario permitido (los que mejor capten el tono). " +
        "maxRuntime en minutos si pide algo corto/ligero, o null. minYear/maxYear si menciona época (o null). " +
        "minRating (0-10) si quiere algo muy bien valorado, o null. " +
        "visualTone: un tono visual si el usuario menciona estética (ej. 'neón', 'noir', 'pastel', 'oscuro'), o null. " +
        "Si cita una película de referencia, infiere sus géneros y tono visual. " +
        "note: una frase breve en español explicando el enfoque elegido.",
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: text }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await client.messages.create(params as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = resp.content.find((b: any) => b.type === "text") as { text: string } | undefined;
    const parsed = JSON.parse(block?.text ?? "{}");

    const filters: WatchFilters = {
      moodGenres: expandGenres(Array.isArray(parsed.moodGenres) ? parsed.moodGenres : []),
      maxRuntime: parsed.maxRuntime ?? undefined,
      minYear: parsed.minYear ?? undefined,
      maxYear: parsed.maxYear ?? undefined,
      minRating: parsed.minRating ?? undefined,
      visualTone: parsed.visualTone ?? undefined,
      note: typeof parsed.note === "string" ? parsed.note : undefined,
    };
    return NextResponse.json(filters);
  } catch (err) {
    console.error("interpret error:", err);
    return NextResponse.json({ error: "Error interpretando" }, { status: 500 });
  }
}
