"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { t } from "@/lib/i18n";
export function LoginForm() {
  const router      = useRouter();
  const params      = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError(t("login.error"));
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Usuario */}
      <div className="space-y-1.5">
        <label
          htmlFor="username"
          className="block text-[11px] uppercase tracking-[0.12em] text-text-faint font-mono"
        >{t("login.usuario")}</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          placeholder={t("login.usuario")}
          className="w-full bg-(--bg)/50 border border-(--border) rounded-[6px] px-4 py-2.5 text-[15px] text-text placeholder:text-text-faint transition-colors duration-150 focus:outline-hidden focus:border-(--border-focus)"
        />
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-[11px] uppercase tracking-[0.12em] text-text-faint font-mono"
        >
          {t("login.password")}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full bg-(--bg)/50 border border-(--border) rounded-[6px] px-4 py-2.5 text-[15px] text-text placeholder:text-text-faint transition-colors duration-150 focus:outline-hidden focus:border-(--border-focus)"
        />
      </div>

      {/* Error */}
      {error && <p className="text-[13px] text-(--error)">{error}</p>}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-[6px] py-2.5 text-[14px] font-medium tracking-wide bg-(--accent) hover:bg-(--accent-hover) text-bg cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t("login.entrando") : t("login.entrar")}
      </button>
    </form>
  );
}
