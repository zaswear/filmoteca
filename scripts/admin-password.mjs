#!/usr/bin/env node
/**
 * Cambia (o crea) la contraseña de administrador en la base de datos.
 *
 *   npm run admin:password -- 'contraseña nueva'
 *   npm run admin:password -- --usuario zas 'contraseña nueva'
 *
 * Es el reset de emergencia: el que funciona cuando NO puedes entrar a la web,
 * que es justo cuando hace falta. Escribe en la base, así que surte efecto al
 * instante en producción, sin tocar variables de entorno ni redesplegar.
 *
 * Crea la tabla si no existe, con SQL aditivo (CREATE TABLE IF NOT EXISTS).
 * Nada de `prisma db push`: aquí un push vació la base entera el 2026-09-22
 * (493 películas), y por eso el script de db:push está desactivado a propósito.
 *
 * Al cambiar la contraseña se invalidan las sesiones abiertas (el callback jwt
 * compara la marca del token con la de la fila), con hasta un minuto de retardo
 * por la caché de lectura.
 */
import { createRequire } from "node:module";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carga manual del .env, sin dependencias. Copia gemela en enelultimoepisodio, así
 * que el script es el mismo fichero en las dos apps.
 *
 * Ojo con las comillas: los valores se desentrecomillan, igual que hace el
 * cargador de Next. Y el `connect_timeout` se ensancha porque el compute free
 * de Neon se apaga solo y Prisma corta a los 5 s, que parece una base caída
 * cuando solo estaba fría.
 */
function cargarEnv() {
  const envPath = path.join(aqui, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const linea of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!linea.trim() || linea.trim().startsWith("#")) continue;
    const m = linea.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const valor = (m[2] || "").trim().replace(/^['"]|['"]$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

function ensancharTimeouts(segundos = 30) {
  for (const clave of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
    const raw = process.env[clave];
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", String(segundos));
      }
      process.env[clave] = url.toString();
    } catch {
      // Una URL que no parsea es problema de quien la configuró: que falle más
      // adelante con su propio mensaje en vez de romper aquí.
    }
  }
}

cargarEnv();
ensancharTimeouts();

const scryptAsync = promisify(scrypt);
const N = 16384, r = 8, p = 1, KEYLEN = 32;
const MIN_PASSWORD = 12;

const args = process.argv.slice(2);
let usuario = null;
const sueltos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--usuario" || args[i] === "-u") usuario = args[++i];
  else sueltos.push(args[i]);
}
const password = sueltos[0];

if (!password) {
  console.error(`Uso: npm run admin:password -- [--usuario <usuario>] 'contraseña nueva'`);
  process.exit(1);
}
if (password.length < MIN_PASSWORD) {
  console.error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL_UNPOOLED (o DATABASE_URL) en el entorno o en .env");
  process.exit(1);
}

const { PrismaClient } = require(path.join(aqui, "..", "lib", "generated", "prisma"));
const db = new PrismaClient({ datasourceUrl: url });

try {
  // El schema Postgres lo fija la connection string (?schema=…); el nombre sin
  // cualificar va al search_path, igual que las consultas de Prisma.
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "admin_credential" (
      "id" INTEGER PRIMARY KEY DEFAULT 1,
      "username" TEXT NOT NULL,
      "password_hash" TEXT NOT NULL,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const actual = await db.adminCredential.findUnique({ where: { id: 1 } });
  const nombre = usuario ?? actual?.username ?? process.env.ADMIN_USER;
  if (!nombre) {
    console.error(
      "No hay usuario: no existe la fila y ADMIN_USER no está definido.\n" +
        "Pásalo a mano: npm run admin:password -- --usuario <usuario> 'contraseña'",
    );
    process.exit(1);
  }

  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p, maxmem: 256 * 1024 * 1024 });
  const valor = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;

  await db.adminCredential.upsert({
    where: { id: 1 },
    update: { username: nombre, passwordHash: valor },
    create: { id: 1, username: nombre, passwordHash: valor },
  });

  console.log(
    `\n✅ Contraseña actualizada para «${nombre}».\n` +
      (actual ? "" : "   (fila creada: hasta ahora la credencial venía del entorno)\n") +
      "   Surte efecto ya, en local y en producción: es la misma base.\n" +
      "   Las sesiones abiertas se cierran en menos de un minuto.\n",
  );
} finally {
  await db.$disconnect();
}
