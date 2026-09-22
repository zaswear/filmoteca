"use client";

import { useEffect } from "react";
import Link from "next/link";

import { t } from "@/lib/i18n";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[40dvh] px-6 text-center">
      <h2 className="font-display font-semibold italic text-[28px] text-text mb-2">{t("error.titulo")}</h2>
      <p className="text-sm text-text-faint mb-6 max-w-sm">{t("error.texto")}</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors"
        >{t("error.reintentar")}</button>
        <Link
          href="/peliculas"
          className="px-4 py-2 border border-(--border) text-text-mid hover:text-text text-sm rounded-[6px] transition-colors"
        >{t("error.volver")}</Link>
      </div>
    </div>
  );
}
