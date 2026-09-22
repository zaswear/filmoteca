import Link from "next/link";
import { DescubrirTabs } from "@/components/layout/descubrir-tabs";

import { t } from "@/lib/i18n";
/**
 * Descubrir reúne las cuatro fuentes que antes eran cuatro entradas del menú
 * —cartelera, sugerencias, lanzamientos Blu-ray y Top LGBT+— porque todas
 * contestan la misma pregunta y en todas haces lo mismo: mandar a pendientes o
 * descartar. Una fuente nueva es una pestaña, no una entrada del menú.
 */
export default function DescubrirLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="px-4 sm:px-8 pt-6 sm:pt-8 pb-0 max-w-[1400px] w-full mx-auto">
        <div className="flex items-end gap-4 flex-wrap">
          <h1 className="font-display text-[38px] text-text leading-none">{t("nav.descubrir")}</h1>
          <p className="font-mono text-text-mid text-lg pb-1">{t("descubrir.subtitulo")}</p>
          <Link
            href="/watchlist"
            className="ml-auto tap-target px-4 border border-(--border) text-sm font-semibold text-text hover:border-(--border-hi) transition-colors"
          >{t("descubrir.verPendientes")}</Link>
        </div>
        <DescubrirTabs />
      </header>
      {children}
    </div>
  );
}
