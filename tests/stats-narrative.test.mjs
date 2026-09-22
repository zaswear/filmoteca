import { test } from "node:test";
import assert from "node:assert/strict";
import { recordMonth, watchStreaks, dominantGenre } from "../lib/stats-narrative.ts";

test("recordMonth devuelve el mes con más sesiones", () => {
  const r = recordMonth([
    { month: "2025-01", label: "Ene 25", count: 3 },
    { month: "2025-02", label: "Feb 25", count: 9 },
    { month: "2025-03", label: "Mar 25", count: 1 },
  ]);
  assert.deepEqual(r, { label: "Feb 25", count: 9 });
});

test("recordMonth con todo a cero es null", () => {
  assert.equal(recordMonth([{ month: "2025-01", label: "Ene 25", count: 0 }]), null);
  assert.equal(recordMonth([]), null);
});

test("racha actual cuenta hacia atrás desde hoy", () => {
  const r = watchStreaks(["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"], "2026-09-22");
  assert.equal(r.current, 4);
  assert.equal(r.best, 4);
});

test("si hoy no hay visionado, la racha actual empieza ayer", () => {
  const r = watchStreaks(["2026-09-20", "2026-09-21"], "2026-09-22");
  assert.equal(r.current, 2);
  assert.equal(r.best, 2);
});

test("la mejor racha histórica puede no ser la actual", () => {
  const r = watchStreaks(
    ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-21"],
    "2026-09-22",
  );
  assert.equal(r.current, 1, "ayer vio una y hoy no, la actual es 1");
  assert.equal(r.best, 4);
});

test("sin visionados la racha actual es cero y la mejor también", () => {
  const r = watchStreaks([], "2026-09-22");
  assert.equal(r.current, 0);
  assert.equal(r.best, 0);
});

test("fechas duplicadas no alargan la racha", () => {
  const r = watchStreaks(["2026-09-21", "2026-09-21", "2026-09-21"], "2026-09-22");
  assert.equal(r.current, 1);
});

test("dominantGenre con año filtra por visionado de ese año", () => {
  const entries = [
    { genres: ["Drama", "Romance"], watchedAt: "2026-03-01T00:00:00Z" },
    { genres: ["Drama"], watchedAt: "2026-04-01T00:00:00Z" },
    { genres: ["Terror"], watchedAt: "2025-12-01T00:00:00Z" },
    { genres: ["Terror"], watchedAt: null },
    { genres: ["Terror"], watchedAt: "2024-06-01T00:00:00Z" },
  ];
  assert.deepEqual(dominantGenre(entries, 2026), { genre: "Drama", count: 2 });
  assert.deepEqual(dominantGenre(entries), { genre: "Terror", count: 3 }, "sin año cuenta también las sin fecha");
  assert.deepEqual(dominantGenre(entries, 2025), { genre: "Terror", count: 1 });
  assert.equal(dominantGenre(entries, 2023), null);
  assert.equal(dominantGenre([], 2026), null);
});
