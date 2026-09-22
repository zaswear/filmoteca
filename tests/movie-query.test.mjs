import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, orderByFor, parseFilters, toQuery, whereFor, pageSizeFor } from "../lib/movie-query.ts";

const f = (extra) => ({ ...DEFAULTS, ...extra });
const cond = (w, clave) => w.AND.find((c) => clave in c);

test("la URL vale como entrada de usuario: se valida todo", () => {
  const p = parseFilters(new URLSearchParams("status=inventado&year=99&sort=robar&page=-3&view=raro"));
  assert.equal(p.status, "", "un estado que no existe se ignora");
  assert.equal(p.year, "", "un año que no tiene cuatro cifras se ignora");
  assert.equal(p.sortKey, DEFAULTS.sortKey, "una clave de orden desconocida cae en la de por defecto");
  assert.equal(p.page, 1, "una página negativa vuelve a la primera");
  assert.equal(p.view, "grid");
});

test("ida y vuelta por la URL sin perder nada", () => {
  const original = f({ search: "cregger", genre: "Terror", year: "2026", sortKey: "myRating", sortOrder: "asc", view: "list", page: 3 });
  assert.deepEqual(parseFilters(new URLSearchParams(toQuery(original))), original);
});

test("toQuery no escribe lo que ya es el defecto", () => {
  assert.equal(toQuery(DEFAULTS), "", "/peliculas se queda limpia");
});

test("las descartadas se esconden salvo que las pidas", () => {
  assert.deepEqual(cond(whereFor(f()), "status"), { status: { not: "descartada" } });
  assert.deepEqual(cond(whereFor(f({ status: "descartada" })), "status"), { status: "descartada" });
});

test("el género se busca entrecomillado, no como subcadena", () => {
  // Si no, «Drama» casaría con «Dramedia» dentro del JSON de la columna.
  assert.deepEqual(cond(whereFor(f({ genre: "Drama" })), "genres"), { genres: { contains: '"Drama"' } });
});

test("la búsqueda mira título, título original y director", () => {
  const or = whereFor(f({ search: "wes" })).AND.find((c) => "OR" in c).OR;
  assert.deepEqual(or.map((c) => Object.keys(c)[0]), ["title", "originalTitle", "directors"]);
  assert.equal(or[0].title.mode, "insensitive");
});

test("los triestado solo filtran cuando no son «all»", () => {
  assert.equal(cond(whereFor(f()), "hasImdbReview"), undefined);
  assert.deepEqual(cond(whereFor(f({ hasImdbReview: "no" })), "hasImdbReview"), { hasImdbReview: false });
});

// Prisma solo acepta `{ sort, nulls }` en columnas anulables: pedírselo para
// createdAt reventaba la consulta entera y la página salía en blanco.
test("orderBy solo pide `nulls` donde la columna lo admite", () => {
  assert.deepEqual(orderByFor(f({ sortKey: "createdAt" }))[0], { createdAt: "desc" });
  assert.deepEqual(orderByFor(f({ sortKey: "title", sortOrder: "asc" }))[0], { title: "asc" });
  assert.deepEqual(orderByFor(f({ sortKey: "myRating" }))[0], { myRating: { sort: "desc", nulls: "last" } });
  assert.deepEqual(orderByFor(f({ sortKey: "year", sortOrder: "asc" }))[0], { year: { sort: "asc", nulls: "first" } });
});

test("el orden desempata por id para que la paginación sea estable", () => {
  assert.deepEqual(orderByFor(f({ sortKey: "myRating" }))[1], { id: "desc" });
});

test("el tamaño de página depende de la vista", () => {
  assert.equal(pageSizeFor(f()), 24);
  assert.equal(pageSizeFor(f({ view: "list" })), 50);
});
