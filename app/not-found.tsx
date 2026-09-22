import Link from "next/link";

import { t } from "@/lib/i18n";
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[80px] leading-none text-text-faint font-bold">404</p>
      <h1 className="font-display font-semibold italic text-[32px] text-text mt-4 mb-2">{t("404.titulo")}</h1>
      <p className="text-sm text-text-faint mb-8">{t("404.texto")}</p>
      <Link
        href="/peliculas"
        className="px-5 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors"
      >{t("404.ir")}</Link>
    </div>
  );
}
