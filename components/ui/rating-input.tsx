"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

import { t } from "@/lib/i18n";
interface Props {
  value?:    number | null;
  onChange?: (v: number | null) => void;
  className?: string;
}

const REDONDOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const enTexto = (n: number) => String(n).replace(".", ",");

/**
 * La nota admite decimales de 0,1 en 0,1 y hay que conservarlo: en el diario
 * conviven 6,5, 7,1, 7,5, 7,9 y 8,5, así que un selector de diez botones
 * enteros perdería datos. El deslizador da el decimal, los botones redondos
 * dan la velocidad, y el número grande es el que de verdad lees.
 */
export function RatingInput({ value, onChange, className }: Props) {
  const [raw, setRaw] = useState(value != null ? String(value) : "");

  const [previous, setPrevious] = useState(value);
  if (previous !== value) { setPrevious(value); setRaw(value == null ? "" : String(value)); }

  function aplicar(n: number | null) {
    setRaw(n == null ? "" : String(n));
    onChange?.(n);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const s = e.target.value;
    setRaw(s);
    if (s === "" || s === "-") { onChange?.(null); return; }
    const n = parseFloat(s);
    if (!isNaN(n) && n >= 0 && n <= 10) onChange?.(Math.round(n * 10) / 10);
  }

  const actual = value ?? null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-4">
        <span className="flex items-baseline gap-0.5 min-w-[92px]">
          <span className="font-display text-[46px] leading-none text-(--accent)">
            {actual == null ? "—" : enTexto(actual)}
          </span>
          <span className="font-display text-lg text-text-faint">/10</span>
        </span>

        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={actual ?? 0}
          onChange={(e) => aplicar(Math.round(parseFloat(e.target.value) * 10) / 10)}
          aria-label={t("nota.slider")}
          className="flex-1 min-h-11 accent-(--accent)"
        />

        <input
          aria-label={t("nota.campo")}
          inputMode="decimal"
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={raw}
          onChange={handleChange}
          placeholder="—"
          className="w-20 bg-(--surface) border border-(--border) min-h-11 px-3 py-2 text-[16px] font-mono text-(--accent) placeholder:text-text-faint focus:outline-hidden focus:border-(--border-focus) transition-colors"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {REDONDOS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => aplicar(actual === n ? null : n)}
            aria-pressed={actual === n}
            className={cn(
              "tap-target px-0 w-11 text-[15px] font-semibold border transition-colors",
              actual === n
                ? "bg-(--accent) text-(--bg) border-(--accent)"
                : "border-(--border) text-text-mid hover:text-text hover:border-(--border-hi)",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
