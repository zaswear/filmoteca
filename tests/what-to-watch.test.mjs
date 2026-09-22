import { test } from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../lib/what-to-watch.ts";

const peli = (extra) => ({
  id: 1, title: "X", genres: ["Drama"], directors: [],
  imdbRating: 7, durationMin: 100, year: 2020, status: "pendiente", ...extra,
});
const GUSTO = { genres: {}, directors: {} };

// La semilla se pasa por parámetro justo para esto: sin ella el resultado
// lleva un 10 % de azar y no se podría comprobar nada.
const elegir = (pool, filtros = {}, gusto = GUSTO) => recommend(pool, filtros, gusto, 0.42);

test("respeta el tiempo disponible", () => {
  const r = elegir([peli({ id: 1, durationMin: 200 }), peli({ id: 2, durationMin: 90 })], { maxRuntime: 120 });
  assert.deepEqual(r.map((p) => p.movie.id), [2]);
});

test("respeta el mínimo de nota IMDb y la horquilla de años", () => {
  const pool = [peli({ id: 1, imdbRating: 5 }), peli({ id: 2, imdbRating: 8 }), peli({ id: 3, imdbRating: 6, year: 1970 })];
  assert.deepEqual(elegir(pool, { minRating: 7 }).map((p) => p.movie.id), [2]);
  assert.deepEqual(elegir(pool, { minYear: 2000, maxYear: 2025 }).map((p) => p.movie.id).sort(), [1, 2]);
});

test("una película sin tono visual no se descarta por el filtro de tono", () => {
  const pool = [peli({ id: 1, visualTone: null }), peli({ id: 2, visualTone: "neón" }), peli({ id: 3, visualTone: "pastel" })];
  const ids = elegir(pool, { visualTone: "neón" }).map((p) => p.movie.id).sort();
  assert.deepEqual(ids, [1, 2], "la de tono distinto sale; la que no tiene tono se queda");
});

test("el ánimo sube la que comparte género y lo dice", () => {
  const pool = [peli({ id: 1, genres: ["Comedia"] }), peli({ id: 2, genres: ["Terror"] })];
  const r = elegir(pool, { moodGenres: ["terror"] });
  assert.equal(r[0].movie.id, 2);
  assert.ok(r[0].score > r[1].score);
});

test("una empezada gana a una idéntica sin empezar, y lo explica", () => {
  const r = elegir([peli({ id: 1 }), peli({ id: 2, status: "en_progreso" })]);
  assert.equal(r[0].movie.id, 2);
  assert.ok(r[0].reasons.includes("La tienes empezada"));
});

test("con la misma semilla devuelve lo mismo", () => {
  const pool = [peli({ id: 1 }), peli({ id: 2, imdbRating: 9 }), peli({ id: 3, imdbRating: 6 })];
  assert.deepEqual(
    recommend(pool, {}, GUSTO, 0.7).map((p) => p.movie.id),
    recommend(pool, {}, GUSTO, 0.7).map((p) => p.movie.id),
  );
});

test("pool vacío no revienta", () => {
  assert.deepEqual(elegir([]), []);
});
