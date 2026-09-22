/**
 * Migración de una vez: canoniza a español la columna `genres` de todas las
 * películas. Ver lib/genres.ts para el porqué y el mapa.
 *
 * Antes: 35 géneros distintos para ~20 reales, con 14 pares partidos entre
 * inglés y español ("Thriller" 29 / "Suspense" 32). Eso rompía el filtro de
 * /peliculas, partía los recuentos de /stats y duplicaba géneros en el perfil
 * de gusto de "¿Qué veo?".
 *
 * Por defecto NO escribe: hay que pasar --write explícitamente.
 *
 *   npx tsx scripts/normalize-genres.ts            # dry-run, solo informa
 *   npx tsx scripts/normalize-genres.ts --write    # aplica los cambios
 */
import { PrismaClient } from "../lib/generated/prisma/index.js";
import { canonicalGenres } from "../lib/genres";

const db = new PrismaClient();
const WRITE = process.argv.includes("--write");

async function main() {
  const movies = await db.movie.findMany({ select: { id: true, title: true, genres: true } });

  const cambios: { id: number; title: string; antes: string[]; despues: string[] }[] = [];
  const antesSet = new Set<string>();
  const despuesSet = new Set<string>();

  for (const m of movies) {
    let antes: string[];
    try {
      antes = JSON.parse(m.genres || "[]");
    } catch {
      console.warn(`  ⚠ ${m.title}: genres no es JSON válido, se salta`);
      continue;
    }
    if (!Array.isArray(antes)) continue;

    const despues = canonicalGenres(antes);
    antes.forEach((g) => antesSet.add(g));
    despues.forEach((g) => despuesSet.add(g));

    if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      cambios.push({ id: m.id, title: m.title, antes, despues });
    }
  }

  console.log(`películas: ${movies.length}`);
  console.log(`géneros distintos: ${antesSet.size} → ${despuesSet.size}`);
  console.log(`filas a cambiar: ${cambios.length}\n`);

  for (const c of cambios.slice(0, 12)) {
    console.log(`  ${c.title.slice(0, 38).padEnd(38)} ${c.antes.join(", ")}`);
    console.log(`  ${"".padEnd(38)} → ${c.despues.join(", ")}`);
  }
  if (cambios.length > 12) console.log(`  … y ${cambios.length - 12} más`);

  if (!WRITE) {
    console.log("\nDRY-RUN: no se ha escrito nada. Repite con --write para aplicar.");
    return;
  }

  let n = 0;
  for (const c of cambios) {
    await db.movie.update({ where: { id: c.id }, data: { genres: JSON.stringify(c.despues) } });
    n++;
  }
  console.log(`\n✓ ${n} películas actualizadas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
