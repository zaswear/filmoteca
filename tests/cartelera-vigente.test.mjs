import { test } from "node:test";
import assert from "node:assert/strict";
import { ahoraEnNL, carteleraVigente } from "../lib/cartelera-vigente.ts";

// /api/cartelera sirve la cartelera desde caché (se refresca con cada scrape) y
// la recorta en cada petición a lo que sigue vigente. Esta es esa lógica.

const pase = (id, date, startTime, city = "Utrecht") => ({
  id, date, startTime, city, cinemaName: "Louis Hartlooper", ticketUrl: null,
});
const peli = (id, showtimes) => ({ id, title: `Peli ${id}`, url: "", posterUrl: null, showtimes });

const AHORA = { hoy: "2026-09-27", hora: "16:30" };

test("quita los pases de días anteriores", () => {
  const r = carteleraVigente([peli(1, [pase(1, "2026-09-26", "20:00"), pase(2, "2026-09-28", "20:00")])], AHORA);
  assert.deepEqual(r[0].showtimes.map((s) => s.id), [2]);
});

test("de hoy solo quedan los pases que aún no han empezado", () => {
  const r = carteleraVigente([peli(1, [
    pase(1, "2026-09-27", "14:00"),
    pase(2, "2026-09-27", "16:30"),
    pase(3, "2026-09-27", "21:15"),
  ])], AHORA);
  assert.deepEqual(r[0].showtimes.map((s) => s.id), [2, 3]);
});

test("descarta la película que se queda sin pases", () => {
  const r = carteleraVigente([peli(1, [pase(1, "2026-09-27", "10:00")]), peli(2, [pase(2, "2026-09-29", "18:00")])], AHORA);
  assert.deepEqual(r.map((p) => p.id), [2]);
});

test("filtra por ciudad sin distinguir mayúsculas", () => {
  const r = carteleraVigente([peli(1, [pase(1, "2026-09-28", "18:00", "Utrecht"), pase(2, "2026-09-28", "18:00", "Amsterdam")])], AHORA, "utrecht");
  assert.deepEqual(r[0].showtimes.map((s) => s.id), [1]);
});

test("sin ciudad devuelve todas", () => {
  const r = carteleraVigente([peli(1, [pase(1, "2026-09-28", "18:00", "Utrecht"), pase(2, "2026-09-28", "18:00", "Amsterdam")])], AHORA);
  assert.equal(r[0].showtimes.length, 2);
});

test("ahoraEnNL usa la hora de Ámsterdam, no la del servidor", () => {
  // 23:30 UTC del 27 = 01:30 del 28 en verano (CEST, UTC+2).
  assert.deepEqual(ahoraEnNL(new Date("2026-09-27T23:30:00Z")), { hoy: "2026-09-28", hora: "01:30" });
});
