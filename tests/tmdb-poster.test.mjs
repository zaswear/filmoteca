import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPosterPaths } from "../lib/tmdb-poster.ts";

// backfill-posters.mjs consulta TMDB /find?external_source=imdb_id y guarda el
// póster del primer movie_result. Esta función es toda la lógica pura del script.

test("extractPosterPaths devuelve póster y fondo del primer resultado", () => {
  const data = {
    movie_results: [
      { poster_path: "/a.jpg", backdrop_path: "/b.jpg" },
      { poster_path: "/otra.jpg", backdrop_path: null },
    ],
  };
  assert.deepEqual(extractPosterPaths(data), { posterPath: "/a.jpg", backdropPath: "/b.jpg" });
});

test("extractPosterPaths trata póster ausente como null, no rompe", () => {
  assert.deepEqual(
    extractPosterPaths({ movie_results: [{ poster_path: null, backdrop_path: "/b.jpg" }] }),
    { posterPath: null, backdropPath: "/b.jpg" }
  );
  assert.deepEqual(
    extractPosterPaths({ movie_results: [{}] }),
    { posterPath: null, backdropPath: null }
  );
});

test("extractPosterPaths con respuestas degeneradas devuelve null", () => {
  assert.equal(extractPosterPaths({ movie_results: [] }), null);
  assert.equal(extractPosterPaths({ movie_results: null }), null);
  assert.equal(extractPosterPaths({}), null);
  assert.equal(extractPosterPaths(null), null);
});
