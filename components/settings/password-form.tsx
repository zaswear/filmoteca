"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { t } from "@/lib/i18n";
const MIN_PASSWORD = 12;

/**
 * Cambio de contraseña. Pide la actual además de la sesión abierta.
 *
 * Al guardar se cierran TODAS las sesiones, la de esta pestaña incluida: es el
 * objetivo cuando cambias la contraseña porque crees que alguien entró. Por eso
 * al terminar se sale a /login en vez de fingir que sigues dentro.
 */
export function PasswordForm() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nueva !== repetida) {
      setError(t("pass.noCoinciden"));
      return;
    }
    if (nueva.length < MIN_PASSWORD) {
      setError(`La contraseña nueva necesita ${MIN_PASSWORD} caracteres o más.`);
      return;
    }

    setGuardando(true);
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva }),
    }).catch(() => null);
    setGuardando(false);

    if (!res || !res.ok) {
      const cuerpo = res ? await res.json().catch(() => null) : null;
      setError(cuerpo?.error ?? t("pass.error"));
      return;
    }

    setHecho(true);
    setActual("");
    setNueva("");
    setRepetida("");
    // La sesión actual ya no vale: el token lleva la marca de la contraseña
    // anterior. Salir explícitamente evita el limbo de navegar con una sesión
    // que el servidor va a rechazar en la siguiente petición.
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
  }

  if (hecho) {
    return (
      <p role="status" className="font-mono text-text-mid">{t("pass.cambiada")}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-5">
      <Campo
        id="password-actual"
        label={t("pass.actual")}
        autoComplete="current-password"
        value={actual}
        onChange={setActual}
      />
      <Campo
        id="password-nueva"
        label={t("pass.nueva")}
        autoComplete="new-password"
        value={nueva}
        onChange={setNueva}
        hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
      />
      <Campo
        id="password-repetida"
        label={t("pass.repetir")}
        autoComplete="new-password"
        value={repetida}
        onChange={setRepetida}
      />
      {error && <p className="text-[13px] text-(--error)">{error}</p>}
      <button
        type="submit"
        disabled={guardando}
        className="tap-target w-full rounded-[6px] bg-(--accent) py-2.5 text-[14px] font-medium tracking-wide text-bg transition-colors duration-150 hover:bg-(--accent-hover) disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardando ? t("comun.guardando") : t("pass.cambiar")}
      </button>
    </form>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint"
      >
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        placeholder="••••••••"
        className="w-full rounded-[6px] border border-(--border) bg-(--bg)/50 px-4 py-2.5 text-[15px] text-text transition-colors duration-150 placeholder:text-text-faint focus:border-(--border-focus) focus:outline-hidden"
      />
      {hint && <p className="text-[12px] text-text-faint">{hint}</p>}
    </div>
  );
}
