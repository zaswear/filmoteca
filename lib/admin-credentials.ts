/**
 * Verificación y cambio de la credencial de administrador (provider de
 * credenciales de NextAuth). Copia gemela en
 * enelultimoepisodio/lib/admin-credentials.ts: las dos apps ya compartían el auth.ts
 * palabra por palabra, y `packages/utils` no tiene tipos de Node, que aquí
 * hacen falta.
 *
 * Historia, porque explica la forma del módulo:
 *
 *   1. Se comparaba `credentials.password === process.env.ADMIN_PASSWORD`: la
 *      contraseña en claro en el panel de Vercel, `===` sobre cadenas (no es de
 *      tiempo constante) y ningún límite de intentos.
 *   2. Se pasó a un hash scrypt en ADMIN_PASSWORD_HASH. Arregló lo anterior,
 *      pero dejó la credencial en DOS sitios que se desincronizan: el `.env`
 *      local y el panel de Vercel. Fue exactamente lo que pasó: a
 *      enelultimoepisodio nunca se le puso la variable, `verificarAdmin` falla
 *      cerrado y el login dejó de aceptar la contraseña de siempre sin que
 *      nadie la hubiera cambiado.
 *   3. Ahora la credencial vive en la base de datos (tabla `admin_credential`,
 *      una sola fila). Una sola fuente de verdad, se cambia sin redeploy, y el
 *      reset de emergencia es `npm run admin:password`, que escribe en la base.
 *
 * ADMIN_USER + ADMIN_PASSWORD_HASH siguen leyéndose, pero SOLO como arranque:
 * mientras no exista la fila, para poder entrar en una instalación nueva. En
 * cuanto hay fila, manda la fila.
 *
 * Sin dependencias nuevas: scrypt y timingSafeEqual vienen en Node.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

/** Parámetros recomendados por OWASP para scrypt interactivo. */
const N = 16384, r = 8, p = 1, KEYLEN = 32;

/** Mínimo de la contraseña nueva. Las viejas más cortas siguen entrando. */
export const MIN_PASSWORD = 12;

export interface IntentoLogin {
  usuario?: string | null;
  password?: string | null;
  /** Para el límite de intentos. En Vercel: cabecera x-forwarded-for. */
  ip?: string | null;
}

/* ── Límite de intentos ─────────────────────────────────────────────────────
   En memoria, así que sólo cubre la instancia caliente: en serverless no es una
   barrera perfecta, pero convierte la fuerza bruta cómoda en una cara. Si algún
   día hace falta algo serio, el sitio de este contador es Upstash o Edge Config.
   ------------------------------------------------------------------------- */
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 8;
const intentos = new Map<string, { n: number; hasta: number }>();

function bloqueado(clave: string): boolean {
  const e = intentos.get(clave);
  if (!e) return false;
  if (Date.now() > e.hasta) {
    intentos.delete(clave);
    return false;
  }
  return e.n >= MAX_INTENTOS;
}

function apuntarFallo(clave: string): void {
  const e = intentos.get(clave);
  if (!e || Date.now() > e.hasta) {
    intentos.set(clave, { n: 1, hasta: Date.now() + VENTANA_MS });
  } else {
    e.n += 1;
  }
}

/** Compara dos cadenas en tiempo constante (longitudes distintas → false). */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Formato: scrypt$<N>$<r>$<p>$<salt-base64>$<hash-base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function coincideHash(password: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = partes;
  const nGuardado = Number(nRaw), rGuardado = Number(rRaw), pGuardado = Number(pRaw);
  if (![nGuardado, rGuardado, pGuardado].every(Number.isInteger)) return false;

  const salt = Buffer.from(saltB64, "base64");
  const esperado = Buffer.from(hashB64, "base64");
  const calculado = await scryptAsync(password, salt, esperado.length, {
    N: nGuardado, r: rGuardado, p: pGuardado, maxmem: 256 * 1024 * 1024,
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/* ── Lectura de la credencial ───────────────────────────────────────────────
   Cacheada 60 s: la comprobación de sesión (callback jwt) mira si la
   contraseña ha cambiado en CADA petición, y eso sin caché es una consulta por
   petición. El precio es que un cambio de contraseña tarda hasta un minuto en
   echar las sesiones abiertas de las OTRAS instancias serverless; la que
   atiende el cambio se entera al momento, porque invalida su propia caché.
   ------------------------------------------------------------------------- */
interface Credencial {
  usuario: string;
  hash: string;
  /** Milisegundos. 0 = credencial de arranque, la del entorno. */
  cambiadaEn: number;
}

const CACHE_MS = 60 * 1000;
let cache: { valor: Credencial | null; hasta: number } | null = null;

function invalidarCache(): void {
  cache = null;
}

function credencialDelEntorno(): Credencial | null {
  const usuario = process.env.ADMIN_USER;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!usuario || !hash) return null;
  return { usuario, hash, cambiadaEn: 0 };
}

/**
 * Devuelve la credencial vigente, o null si no hay ninguna configurada.
 *
 * Si la base no responde, LANZA en vez de caer al entorno. Es deliberado: la
 * copia del entorno puede ser la contraseña antigua, y usarla de red de
 * seguridad convertiría cada caída de la base en una ventana para la
 * credencial que ya se había retirado. Sin base no se entra.
 */
async function leerCredencial(): Promise<Credencial | null> {
  if (cache && Date.now() < cache.hasta) return cache.valor;

  let fila: { username: string; passwordHash: string; updatedAt: Date } | null = null;
  try {
    fila = await db.adminCredential.findUnique({
      where: { id: 1 },
      select: { username: true, passwordHash: true, updatedAt: true },
    });
  } catch (err) {
    // La tabla todavía no existe (P2021) es el caso de una instalación nueva,
    // antes de correr `npm run admin:password`: ahí sí vale el entorno.
    const codigo = (err as { code?: string } | null)?.code;
    if (codigo !== "P2021") throw err;
  }

  const valor: Credencial | null = fila
    ? { usuario: fila.username, hash: fila.passwordHash, cambiadaEn: fila.updatedAt.getTime() }
    : credencialDelEntorno();

  cache = { valor, hasta: Date.now() + CACHE_MS };
  return valor;
}

/**
 * Marca de tiempo del último cambio de contraseña, para invalidar las sesiones
 * abiertas (el token guarda la que había al entrar). 0 = credencial de arranque.
 */
export async function credencialCambiadaEn(): Promise<number> {
  return (await leerCredencial())?.cambiadaEn ?? 0;
}

/**
 * Devuelve el usuario si las credenciales son válidas, o null.
 * Falla cerrado: sin credencial configurada no entra nadie.
 */
export async function verificarAdmin(
  intento: IntentoLogin,
): Promise<{ id: string; name: string; pwdAt: number } | null> {
  let credencial: Credencial | null;
  try {
    credencial = await leerCredencial();
  } catch (err) {
    console.error("[auth] no se pudo leer la credencial de la base:", err);
    return null;
  }

  if (!credencial) {
    console.error(
      "[auth] no hay credencial: ni fila en admin_credential ni ADMIN_USER + " +
        "ADMIN_PASSWORD_HASH en el entorno. El login está deshabilitado. " +
        "Créala con: npm run admin:password -- 'tu contraseña'",
    );
    return null;
  }

  const clave = intento.ip || "sin-ip";
  if (bloqueado(clave)) {
    console.warn(`[auth] demasiados intentos desde ${clave}`);
    return null;
  }

  const usuario = intento.usuario ?? "";
  const password = intento.password ?? "";
  // Se comprueban las dos cosas siempre (sin cortocircuito) para no revelar por
  // el tiempo de respuesta si el usuario existe.
  const usuarioOk = igualSeguro(usuario, credencial.usuario);
  const passwordOk = password ? await coincideHash(password, credencial.hash) : false;

  if (usuarioOk && passwordOk) {
    intentos.delete(clave);
    return { id: "1", name: credencial.usuario, pwdAt: credencial.cambiadaEn };
  }

  apuntarFallo(clave);
  return null;
}

export type ResultadoCambio =
  | { ok: true }
  | { ok: false; motivo: "sin-credencial" | "actual-incorrecta" | "corta" | "repetida" };

/**
 * Cambia la contraseña comprobando antes la actual. El usuario no se toca.
 * Escribe la fila (upsert) y deja la caché limpia, para que la propia instancia
 * que atiende el cambio eche ya las sesiones viejas.
 */
export async function cambiarPassword(
  actual: string,
  nueva: string,
): Promise<ResultadoCambio> {
  const credencial = await leerCredencial();
  if (!credencial) return { ok: false, motivo: "sin-credencial" };
  if (!(await coincideHash(actual, credencial.hash))) {
    return { ok: false, motivo: "actual-incorrecta" };
  }
  if (nueva.length < MIN_PASSWORD) return { ok: false, motivo: "corta" };
  if (nueva === actual) return { ok: false, motivo: "repetida" };

  const hash = await hashPassword(nueva);
  await db.adminCredential.upsert({
    where: { id: 1 },
    update: { passwordHash: hash },
    create: { id: 1, username: credencial.usuario, passwordHash: hash },
  });
  invalidarCache();
  return { ok: true };
}
