import { db } from "@/lib/db";
import type { TasteProfile } from "@/lib/what-to-watch";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const parse = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/**
 * Construye el perfil de gusto a partir de tus vistas puntuadas: afinidad por
 * género (nota media normalizada 0..1) y por director (nota media 0..10).
 */
export async function buildTasteProfile(): Promise<TasteProfile> {
  const rated = await db.movie.findMany({
    where: { status: "vista", myRating: { not: null } },
    select: { myRating: true, genres: true, directors: true },
  });

  const gAcc: Record<string, { sum: number; n: number }> = {};
  const dAcc: Record<string, { sum: number; n: number }> = {};

  for (const m of rated) {
    const r = m.myRating!;
    for (const g of parse(m.genres)) {
      const k = norm(g);
      (gAcc[k] ??= { sum: 0, n: 0 });
      gAcc[k].sum += r; gAcc[k].n++;
    }
    for (const d of parse(m.directors)) {
      (dAcc[d] ??= { sum: 0, n: 0 });
      dAcc[d].sum += r; dAcc[d].n++;
    }
  }

  const genres: TasteProfile["genres"] = {};
  for (const [k, v] of Object.entries(gAcc)) genres[k] = v.sum / v.n / 10;

  const directors: TasteProfile["directors"] = {};
  for (const [k, v] of Object.entries(dAcc)) {
    directors[k] = { avg: Math.round((v.sum / v.n) * 10) / 10, count: v.n };
  }

  return { genres, directors };
}
