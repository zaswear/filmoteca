import { test } from "node:test";
import assert from "node:assert/strict";
import { isImdbId, extractReleaseDate } from "../lib/tmdb-release-date.ts";

// backfill-release-dates.mjs consulta TMDb /find?external_source=imdb_id y
// guarda la fecha del primer movie_result. Estas dos funciones son toda la
// lógica pura de ese script.

test("isImdbId solo acepta strings que empiezan por tt", () => {
  assert.ok(isImdbId("tt0133093"));
  assert.ok(!isImdbId("nm0000206")); // id de persona, no de película
  assert.ok(!isImdbId(""));
  assert.ok(!isImdbId(null));
  assert.ok(!isImdbId(undefined));
  assert.ok(!isImdbId(123));
});

test("extractReleaseDate devuelve la fecha del primer resultado", () => {
  const data = { movie_results: [{ release_date: "2025-03-14" }, { release_date: "2020-01-01" }] };
  assert.equal(extractReleaseDate(data), "2025-03-14");
});

test("extractReleaseDate trata la fecha vacía de TMDb como sin fecha", () => {
  assert.equal(extractReleaseDate({ movie_results: [{ release_date: "" }] }), null);
});

test("extractReleaseDate con respuestas degeneradas no rompe", () => {
  assert.equal(extractReleaseDate({ movie_results: [] }), null);
  assert.equal(extractReleaseDate({ movie_results: null }), null);
  assert.equal(extractReleaseDate({}), null);
  assert.equal(extractReleaseDate(null), null);
});
