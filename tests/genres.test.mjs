import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalGenre, canonicalGenres } from "../lib/genres.ts";

// OMDb devuelve los géneros en inglés y TMDb en español. Sin canonizar,
// «Action» y «Acción» conviven como dos géneros distintos y los filtros del
// diario y las gráficas del balance parten los datos en dos.
test("el mismo género en inglés y en español cae en el mismo sitio", () => {
  assert.equal(canonicalGenre("Action"), canonicalGenre("Acción"));
  assert.equal(canonicalGenre("Sci-Fi"), canonicalGenre("Ciencia ficción"));
  assert.equal(canonicalGenre("Thriller"), canonicalGenre("Suspense"));
});

test("no le afectan mayúsculas ni espacios de más", () => {
  assert.equal(canonicalGenre("  drama  "), canonicalGenre("Drama"));
  assert.equal(canonicalGenre("TERROR"), canonicalGenre("Terror"));
});

test("un género desconocido no se pierde", () => {
  assert.equal(canonicalGenre("Neorrealismo"), "Neorrealismo");
});

test("canonicalGenres quita duplicados y vacíos", () => {
  const r = canonicalGenres(["Action", "Acción", "", "  ", "Drama"]);
  assert.equal(r.length, 2, `esperaba 2 géneros, salieron ${JSON.stringify(r)}`);
  assert.ok(r.includes("Drama"));
});
