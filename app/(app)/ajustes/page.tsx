import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { readImdbCsvs } from "@/lib/csv";
import { ImportTable } from "@/components/movies/import-table";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { PasswordForm } from "@/components/settings/password-form";

import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export const metadata = { title: t("ajustes.titulo") };

/**
 * Lo que se usa una vez al año y no merece un sitio en el menú: importar el
 * historial, la lista de compras y la sesión. Antes «Importar» era una entrada
 * más de la barra lateral, al lado de «Películas».
 */
export default async function AjustesPage() {
  const csvRows = readImdbCsvs();
  const existing = await db.movie.findMany({
    where: { imdbId: { in: csvRows.map((r) => r.imdbId) } },
    select: { imdbId: true },
  });
  const existingIds = new Set(existing.map((m) => m.imdbId));
  const rows = csvRows.map((r) => ({ ...r, exists: existingIds.has(r.imdbId) }));
  const purchases = await db.blurayPurchase.count();
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-[38px] text-text leading-none">{t("ajustes.titulo")}</h1>
        <p className="font-mono text-text-mid text-lg">
          {t("ajustes.subtitulo")}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">
          {t("ajustes.importarImdb")}
        </h2>
        {rows.length === 0 ? (
          <div className="border border-(--border) bg-surface p-6 space-y-2">
            <p className="text-text-mid">
              {t("ajustes.sinCsv")} <code className="font-mono text-text">/export_imdb</code>.
            </p>
            <p className="text-text-faint text-sm">
              {t("ajustes.sinCsvAyuda")}
            </p>
          </div>
        ) : (
          <ImportTable rows={rows} />
        )}
        <p className="text-text-faint text-sm max-w-prose">
          {t("ajustes.justwatch")} <code className="font-mono">import_justwatch_csv.py</code>,{" "}
          {t("ajustes.justwatchAyuda")}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">{t("ajustes.otros")}</h2>
        <div className="border-t border-(--text)">
          <Link
            href="/compras-bluray"
            className="flex items-center gap-4 py-4 border-b border-(--border) hover:bg-surface transition-colors"
          >
            <span className="w-56 font-display text-[19px] text-text">{t("ajustes.comprasBluray")}</span>
            <span className="flex-1 font-mono text-text-mid">
              {t("ajustes.comprasTexto")} · {purchases} {purchases === 1 ? t("ajustes.apuntada") : t("ajustes.apuntadas")}
            </span>
            <span aria-hidden="true" className="text-text-faint">›</span>
          </Link>
          <div className="flex items-center gap-4 py-4 border-b border-(--border)">
            <span className="w-56 font-display text-[19px] text-text">{t("ajustes.fuentesDescubrir")}</span>
            <span className="flex-1 font-mono text-text-mid">
              {t("ajustes.fuentesDescubrirTexto")}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">{t("ajustes.cuenta")}</h2>
        {session ? (
          <PasswordForm />
        ) : (
          <p className="font-mono text-text-mid">
            <Link href="/login" className="text-(--accent) hover:underline">{t("ajustes.entra")}</Link>{" "}
            {t("ajustes.entraTexto")}
          </p>
        )}
        <p className="text-text-faint text-sm max-w-prose">
          {t("ajustes.resetTexto")}{" "}
          <code className="font-mono text-text">npm run admin:password -- &apos;contraseña nueva&apos;</code>.
          {t("ajustes.resetAyuda")}
        </p>
      </section>

      <SignOutButton className="tap-target px-5 border border-(--border) text-(--accent) font-semibold text-sm hover:border-(--accent) transition-colors" />
    </div>
  );
}
