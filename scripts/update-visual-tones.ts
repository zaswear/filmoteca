import { PrismaClient } from '../lib/generated/prisma/index.js';

const db = new PrismaClient();

const TONES = ["neón", "pastel", "noir", "oscuro", "cálido", "frío", "blanco y negro"];

async function main() {
  const movies = await db.movie.findMany({
    where: {
      posterUrl: { not: null },
      visualTone: null,
      status: { not: "descartada" }
    },
    select: { id: true, title: true, posterUrl: true }
  });

  console.log(`Encontradas ${movies.length} películas sin tono visual.`);

  for (const m of movies) {
    if (!m.posterUrl) continue;
    
    try {
      console.log(`Analizando ${m.title}...`);
      
      let imageUrl = m.posterUrl;
      if (imageUrl.startsWith("/")) {
        imageUrl = `https://www.themoviedb.org/t/p/w600_and_h900_bestv2${imageUrl}`;
      }
      
      const res = await fetch(imageUrl);
      if (!res.ok) {
        console.warn(`  No se pudo descargar la imagen (${res.status})`);
        continue;
      }
      
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = res.headers.get("content-type") || "image/jpeg";

      const prompt = `Analiza este póster de cine y clasifica su estética o tono visual cromático EXACTAMENTE en UNA de las siguientes categorías, sin añadir puntuación ni texto extra:
${TONES.map(t => `- ${t}`).join("\n")}

Si la imagen es muy vibrante con luces rosas/azules/moradas, es 'neón'. Si los colores son suaves, 'pastel'. Si tiene fuertes contrastes de sombras, 'noir'. Si predominan los tonos sepia/naranja, 'cálido'. Si predominan azules/verdes, 'frío'. Si es escala de grises, 'blanco y negro'. Si es muy oscura en general, 'oscuro'.

Responde SOLO con la categoría exacta elegida.`;

      const apiKey = process.env.GEMINI_API_KEY;
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } }
            ]
          }]
        })
      });

      const apiData = await apiRes.json();
      const text = apiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toLowerCase()?.replace(".", "") || "";
      
      if (TONES.includes(text)) {
        await db.movie.update({
          where: { id: m.id },
          data: { visualTone: text }
        });
        console.log(`  -> ${text}`);
      } else {
        console.log(`  -> Categoría inválida devuelta: "${text}"`);
      }
      
      // Delay to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (err: any) {
      console.error(`  Error:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
