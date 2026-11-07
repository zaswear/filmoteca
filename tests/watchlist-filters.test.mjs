import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FILTROS_INICIALES, filtrarPendientes, generosDe, hayFiltros, formatoHoras,
} from "../lib/watchlist-filters.ts";

const peli = (id, o = {}) => ({
  id, genres: [], durationMin: 100, imdbRating: 7, year: 2025,
  createdAt: new Date(2026, 0, id), ...o,
});
const ids = (arr) => arr.map((m) => m.id);
const con = (o) => ({ ...FILTROS_INICIALES, ...o });

test("sin filtros devuelve todas, de la más reciente a la más antigua", () => {
  const lista = [peli(1), peli(3), peli(2)];
  assert.deepEqual(ids(filtrarPendientes(lista, FILTROS_INICIALES)), [3, 2, 1]);
  assert.equal(hayFiltros(FILTROS_INICIALES), false);
});

test("varios géneros se combinan con O", () => {
  const lista = [peli(1, { genres: ["Drama"] }), peli(2, { genres: ["Terror"] }), peli(3, { genres: ["Comedia"] })];
  assert.deepEqual(ids(filtrarPendientes(lista, con({ generos: ["Drama", "Terror"] }))), [2, 1]);
});

test("con límite de minutos, las que no tienen duración se quedan fuera", () => {
  const lista = [peli(1, { durationMin: 95 }), peli(2, { durationMin: 140 }), peli(3, { durationMin: null })];
  assert.deepEqual(ids(filtrarPendientes(lista, con({ maxMin: 100 }))), [1]);
  assert.deepEqual(ids(filtrarPendientes(lista, con({ maxMin: null }))), [3, 2, 1]);
});

test("nota alta exige IMDb >= 7.5 y descarta las que no tienen nota", () => {
  const lista = [peli(1, { imdbRating: 7.5 }), peli(2, { imdbRating: 7.4 }), peli(3, { imdbRating: null })];
  assert.deepEqual(ids(filtrarPendientes(lista, con({ imdbAlta: true }))), [1]);
});

test("ordenar por nota y por duración deja los nulos al final", () => {
  const lista = [peli(1, { imdbRating: null, durationMin: null }), peli(2, { imdbRating: 6, durationMin: 150 }), peli(3, { imdbRating: 8, durationMin: 90 })];
  assert.deepEqual(ids(filtrarPendientes(lista, con({ orden: "imdb" }))), [3, 2, 1]);
  assert.deepEqual(ids(filtrarPendientes(lista, con({ orden: "cortas" }))), [3, 2, 1]);
});

test("más tiempo en la lista invierte el orden de alta", () => {
  const lista = [peli(2), peli(1), peli(3)];
  assert.deepEqual(ids(filtrarPendientes(lista, con({ orden: "antiguas" }))), [1, 2, 3]);
});

test("generosDe ordena por frecuencia", () => {
  const lista = [peli(1, { genres: ["Drama", "Terror"] }), peli(2, { genres: ["Drama"] }), peli(3, { genres: ["Comedia"] })];
  assert.deepEqual(generosDe(lista), ["Drama", "Comedia", "Terror"]);
});

test("formatoHoras", () => {
  assert.equal(formatoHoras(105), "1 h 45");
  assert.equal(formatoHoras(120), "2 h 00");
  assert.equal(formatoHoras(50), "50′");
});
