/**
 * IA para los scripts sueltos: Ollama local primero, Gemini solo como respaldo.
 *
 * Ollama es el de Windows (:11435, gemma3:4b), el mismo que usa
 * scripts/ollama-local del monorepo. Para que WSL lo vea en 127.0.0.1 hace falta
 * `networkingMode=mirrored` en el .wslconfig; sin eso la conexión falla y se pasa
 * al respaldo.
 *
 * Gemini entra solo si Ollama no responde Y hay GEMINI_API_KEY. Sin cuenta de
 * facturación esa clave va por el nivel gratuito: puede dar 429, nunca cobra.
 * Si no hay ninguno de los dos, devuelve null y el script sigue sin IA.
 *
 *   OLLAMA_URL    (por defecto http://127.0.0.1:11435)
 *   OLLAMA_MODEL  (por defecto gemma3:4b; acepta imágenes)
 */

const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11435").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const GEMINI_MODEL = "gemini-2.5-flash";

// Se comprueba una vez por proceso: si Ollama no está, no se paga un timeout por película.
let ollamaVivo;

async function ollamaDisponible() {
  if (ollamaVivo === undefined) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
      ollamaVivo = r.ok;
    } catch {
      ollamaVivo = false;
    }
    console.log(
      ollamaVivo
        ? `IA: Ollama local (${OLLAMA_MODEL} en ${OLLAMA_URL})`
        : `IA: Ollama no responde en ${OLLAMA_URL}; ${process.env.GEMINI_API_KEY ? "respaldo Gemini" : "sin IA"}`
    );
  }
  return ollamaVivo;
}

async function conOllama(prompt, imagen) {
  const r = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      ...(imagen ? { images: [imagen.base64] } : {}),
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`);
  const data = await r.json();
  return data.response?.trim() ?? "";
}

async function conGemini(prompt, imagen, apiKey) {
  const parts = [{ text: prompt }];
  if (imagen) parts.push({ inline_data: { mime_type: imagen.mimeType, data: imagen.base64 } });
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  if (!r.ok) throw new Error(`Gemini respondió ${r.status}`);
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

/**
 * @param {string} prompt
 * @param {{ imagen?: { base64: string, mimeType: string } }} [opciones]
 * @returns {Promise<string | null>} texto generado (puede ser ""), o null si no hay IA disponible
 */
export async function generarTexto(prompt, { imagen } = {}) {
  if (await ollamaDisponible()) return conOllama(prompt, imagen);
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) return conGemini(prompt, imagen, apiKey);
  return null;
}
