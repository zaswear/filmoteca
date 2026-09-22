#!/usr/bin/env node
/**
 * Genera el valor de ADMIN_PASSWORD_HASH a partir de una contraseña.
 *
 *   node scripts/hash-admin-password.mjs 'mi contraseña'
 *
 * Imprime DOS formas del mismo hash, porque no se escriben igual en los dos
 * sitios:
 *
 *   - En un `.env` local hay que escapar los `$`. Next.js expande `$VAR` al
 *     leer el fichero y el hash va lleno de `$`, así que pegarlo tal cual lo
 *     destroza en silencio: `scrypt$16384$8$1$…` se queda en `scrypt6384` y el
 *     login deja de entrar sin decir por qué. Las comillas simples TAMPOCO
 *     protegen (comprobado con @next/env 16.2), solo `\$`.
 *   - En Vercel, o en cualquier variable de entorno del sistema, el valor se
 *     toma literal: va sin escapar.
 *
 * Y borra ADMIN_PASSWORD, la que estaba en claro: ya no se lee.
 *
 * Formato: scrypt$<N>$<r>$<p>$<salt-base64>$<hash-base64>
 * Los parámetros son los recomendados por OWASP para scrypt interactivo.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const N = 16384, r = 8, p = 1, KEYLEN = 32;

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/hash-admin-password.mjs 'tu contraseña'");
  process.exit(1);
}
if (password.length < 12) {
  console.error("La contraseña debería tener al menos 12 caracteres.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p, maxmem: 256 * 1024 * 1024 });

const valor = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;

console.log("\n# Para el .env local (los $ van escapados; Next.js los expandiría):");
console.log(`ADMIN_PASSWORD_HASH="${valor.replace(/\$/g, "\\$")}"`);
console.log("\n# Para Vercel (valor literal, sin escapar):");
console.log(valor);
console.log();
