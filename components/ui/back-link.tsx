import Link from "next/link";
import { t } from "@/lib/i18n";

/** Enlace de vuelta al diario, mismo patrón que la ficha de película
 *  («← Películas»). Las secciones sin salida explícita lo montan arriba. */
export function BackLink({ href = "/peliculas" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="text-sm text-text-faint hover:text-text transition-colors"
    >
      ← {t("ficha.peliculas")}
    </Link>
  );
}
