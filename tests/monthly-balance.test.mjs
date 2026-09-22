import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyBalance } from "../lib/monthly-balance.ts";

const base = {
  id: 1, title: "A", status: "vista",
  watchedAt: "2026-09-01T00:00:00Z", myRating: 0, durationMin: 90,
};

test("cuenta solo las vistas del mes pedido", () => {
  const r = monthlyBalance([
    base,
    { ...base, id: 2, myRating: 8, durationMin: null },
    { ...base, id: 3, myRating: null, watchedAt: "2026-09-30T23:59:59Z" },
    { ...base, id: 4, status: "pendiente" },
    { ...base, id: 5, watchedAt: null },
    { ...base, id: 6, watchedAt: "2026-10-01T00:00:00Z" },
  ], "2026-09");

  assert.equal(r.movies.length, 3, "pendientes, sin fecha y de otro mes quedan fuera");
  assert.equal(r.average, 4, "la media ignora las que no tienen nota");
  assert.equal(r.ratedCount, 2);
  assert.equal(r.minutes, 180, "los minutos ignoran las que no tienen duración");
  assert.equal(r.durationsCount, 2);
  assert.equal(r.undated, 1);
  assert.deepEqual(r.favorites.map((m) => m.id), [2]);
});

test("un cero cuenta como nota, no como ausencia", () => {
  const r = monthlyBalance([base], "2026-09");
  assert.equal(r.ratedCount, 1);
  assert.equal(r.average, 0);
});

test("mes vacío", () => {
  const r = monthlyBalance([], "2026-09");
  assert.equal(r.average, null);
  assert.deepEqual(r.favorites, []);
  assert.equal(r.minutes, 0);
});

// Un revisionado entra en el balance como una entrada más: la página le pone un
// id negativo para no chocar con el de la película y lo mete en la misma lista.
// Lo que importa aquí es que cuente dos veces y con su propia nota.
test("volver a ver algo cuenta otra vez, con la nota de esa vez", () => {
  const primera = { ...base, id: 1, myRating: 6 };
  const revisionado = { ...base, id: -1, myRating: 10, watchedAt: "2026-09-20T00:00:00Z" };
  const r = monthlyBalance([primera, revisionado], "2026-09");

  assert.equal(r.movies.length, 2, "la misma película vista dos veces son dos visionados");
  assert.equal(r.average, 8, "la media usa la nota de cada visionado, no la de la película");
  assert.equal(r.minutes, 180, "el tiempo de cine también se cuenta dos veces");
  assert.deepEqual(r.favorites.map((m) => m.id), [-1]);
});
