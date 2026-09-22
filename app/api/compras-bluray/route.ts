import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchTmdb, posterUrl } from "@/lib/tmdb";

function cleanMubisTitle(title: string): string {
  let clean = title
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const prefixRegex = /^(?:Lanzamiento|Reservas|Anuncio|Detalles|Carátula[s]?|Edición|Steelbook|Crítica|Opiniones|Tráiler|Trailer|Avance|Presentación|Oferta|Próximo lanzamiento):?(?:\s+(?:de\s+la\s+edición\s+(?:coleccionista|especial|metálica)\s+de|de\s+la\s+edición\s+de|de\s+la\s+película\s+de|de\s+la\s+película|de\s+la\s+serie|de|del|especial\s+de|coleccionista\s+de))?\s+/i;
  clean = clean.replace(prefixRegex, "");

  clean = clean.replace(/\s+-\s*(?:dirigida|dirigido)\s+por\s+.*?(?=\s+-|$)/i, "");
  clean = clean.replace(/\s+-\s*de\s+.*?(?=\s+-|$)/i, "");

  const suffixRegex = /\s+en\s+(?:Ultra\s+HD\s+)?Blu-ray(?:\s+\+\s+DVD)?(?:\s+3D)?/i;
  clean = clean.replace(suffixRegex, "");
  clean = clean.replace(/\s+en\s+DVD/i, "");
  clean = clean.replace(/\s+en\s+4K/i, "");
  clean = clean.replace(/\s+en\s+UHD/i, "");

  clean = clean.replace(/\s+-\s*(?:Edición\s+(?:Especial|Coleccionista|Limitada|Metálica)|Steelbook|Digipak|Coleccionista|Sencilla)/i, "");
  clean = clean.replace(/\s*\([^)]*(?:Blu-ray|Steelbook|Edición)[^)]*\)/i, "");

  clean = clean.replace(/\s+/g, " ").trim();
  return clean || title;
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const list = await db.blurayPurchase.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : "") || "Error al obtener la lista de compras" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, link, rssThumbnail } = body;
    if (!title) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }

    const cleanedTitle = cleanMubisTitle(title);

    // Duplication check: match link or cleaned title
    const existing = await db.blurayPurchase.findFirst({
      where: {
        OR: [
          { title: cleanedTitle },
          ...(link ? [{ link }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Esta película ya está en tu lista de compras" },
        { status: 409 }
      );
    }

    let posterUrlResult: string | null = null;

    try {
      const tmdbResults = await searchTmdb(cleanedTitle);
      if (tmdbResults && tmdbResults.length > 0) {
        const first = tmdbResults[0];
        if (first.poster_path) {
          posterUrlResult = posterUrl(first.poster_path, "w500");
        }
      }
    } catch (err) {
      console.error("Error searching TMDB for poster:", err);
    }

    // Fallback to rssThumbnail if TMDB didn't return a poster
    if (!posterUrlResult && rssThumbnail) {
      posterUrlResult = rssThumbnail;
    }

    const item = await db.blurayPurchase.create({
      data: {
        title: cleanedTitle,
        link: link || null,
        posterUrl: posterUrlResult,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : "") || "Error al añadir a la lista" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const idStr = searchParams.get("id");
    if (!idStr) {
      return NextResponse.json({ error: "ID obligatorio" }, { status: 400 });
    }
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await db.blurayPurchase.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : "") || "Error al eliminar de la lista" },
      { status: 500 }
    );
  }
}
