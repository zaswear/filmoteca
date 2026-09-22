import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTitle, extractYear, extractReleaseDate, extractAudio, extractTitlePageUrl, parseFeed,
} from "../lib/bluray-parse.ts";

// El <h1> de mubis es el nombre de la EDICIÓN, no el de la película. Si no se
// limpia, la búsqueda en TMDb no encuentra nada y la página sale vacía: fue el
// fallo real que tuvo la sección durante meses.
test("extractTitle quita formato y edición del titular de mubis", () => {
  const h1 = (t) => `<h1 class="x">${t}</h1>`;
  assert.equal(extractTitle(h1("El Club de los Poetas Muertos - Edición Metálica Ultra HD Blu-ray")), "El Club de los Poetas Muertos");
  assert.equal(extractTitle(h1("Desayuno en Plutón Blu-ray")), "Desayuno en Plutón");
  assert.equal(extractTitle(h1("Aniquilación Blu-ray + DVD")), "Aniquilación");
  assert.equal(extractTitle(h1("Avatar en Ultra HD Blu-ray 3D")), "Avatar");
  assert.equal(extractTitle(h1("Dobermann — Steelbook Blu-ray")), "Dobermann");
  assert.equal(extractTitle("<p>sin titular</p>"), null);
});

// Sin el año, buscar «Aniquilación» devuelve primero una película de 2026 en
// vez de la de 2018.
test("extractYear lee el año de la ficha", () => {
  assert.equal(extractYear("<div><strong>Año:</strong> 1989</div>"), "1989");
  assert.equal(extractYear("<div><strong>Ano:</strong>2018</div>"), "2018");
  assert.equal(extractYear("<div>sin año</div>"), null);
});

test("extractReleaseDate entiende la fecha en castellano", () => {
  const d = extractReleaseDate("<p>Sale el <b>13 de octubre de 2026</b></p>");
  assert.equal(d?.getFullYear(), 2026);
  assert.equal(d?.getMonth(), 9);
  assert.equal(d?.getDate(), 13);
  assert.equal(extractReleaseDate("<p>el 13 de brumario de 2026</p>"), null, "mes inventado");
  assert.equal(extractReleaseDate("<p>sin fecha</p>"), null);
});

test("extractAudio solo acepta castellano", () => {
  const tabla = (a) => `<table><tr><th>Audio</th><td>${a}</td></tr></table>`;
  assert.match(extractAudio(tabla("Inglés - Atmos Castellano - DD 5.1")) ?? "", /Castellano/);
  assert.equal(extractAudio(tabla("Inglés - Atmos, Español latino - DD 5.1")), null, "el latino no cuenta");
  assert.equal(extractAudio("<table></table>"), null);
});

test("extractTitlePageUrl absolutiza el enlace de la ficha", () => {
  assert.equal(
    extractTitlePageUrl('<a href="/titulos/dobermann-blu-ray">x</a>'),
    "https://www.mubis.es/titulos/dobermann-blu-ray",
  );
  assert.equal(extractTitlePageUrl("<a href=\"/otros/cosa\">x</a>"), null);
});

test("parseFeed saca enlace, descripción e imagen de cada item", () => {
  const xml = `<rss><channel>
    <item><link> https://www.mubis.es/a </link><description>&lt;img src="/media/a.jpg" /&gt;hola</description></item>
    <item><link>https://www.mubis.es/b</link><description>sin imagen</description></item>
    <item><link>https://www.mubis.es/c</link></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 2, "un item sin descripción no entra");
  assert.equal(items[0].link, "https://www.mubis.es/a");
  assert.equal(items[0].posterUrl, "https://www.mubis.es/media/a.jpg");
  assert.equal(items[1].posterUrl, null);
});
