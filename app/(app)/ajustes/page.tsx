import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { readImdbCsvs } from "@/lib/csv";
import { ImportTable } from "@/components/movies/import-table";
import { SignOutButton } from "@/components/ui/sign-out-button";
import { PasswordForm } from "@/components/settings/password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

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
        <h1 className="font-display text-[38px] text-text leading-none">Ajustes</h1>
        <p className="font-mono text-text-mid text-lg">
          Lo que se usa una vez al año y no merece un sitio en el menú.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">
          Importar historial de IMDb
        </h2>
        {rows.length === 0 ? (
          <div className="border border-(--border) bg-surface p-6 space-y-2">
            <p className="text-text-mid">
              No hay ningún CSV en <code className="font-mono text-text">/export_imdb</code>.
            </p>
            <p className="text-text-faint text-sm">
              Exporta tus listas desde IMDb, deja los archivos en esa carpeta y recarga esta
              página. Se leen del disco del servidor, no se suben por el navegador.
            </p>
          </div>
        ) : (
          <ImportTable rows={rows} />
        )}
        <p className="text-text-faint text-sm max-w-prose">
          La watchlist de JustWatch se importa con <code className="font-mono">import_justwatch_csv.py</code>,
          un script local: no hay endpoint para hacerlo desde aquí.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">Otros</h2>
        <div className="border-t border-(--text)">
          <Link
            href="/compras-bluray"
            className="flex items-center gap-4 py-4 border-b border-(--border) hover:bg-surface transition-colors"
          >
            <span className="w-56 font-display text-[19px] text-text">Compras Blu-ray</span>
            <span className="flex-1 font-mono text-text-mid">
              Tu lista de ediciones por comprar · {purchases} {purchases === 1 ? "apuntada" : "apuntadas"}
            </span>
            <span aria-hidden="true" className="text-text-faint">›</span>
          </Link>
          <div className="flex items-center gap-4 py-4 border-b border-(--border)">
            <span className="w-56 font-display text-[19px] text-text">Fuentes de Descubrir</span>
            <span className="flex-1 font-mono text-text-mid">
              Cartelera de Utrecht, sugerencias, mubis y Top LGBT+
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-text-mid font-semibold">Cuenta</h2>
        {session ? (
          <PasswordForm />
        ) : (
          <p className="font-mono text-text-mid">
            <Link href="/login" className="text-(--accent) hover:underline">Entra</Link> para
            cambiar la contraseña.
          </p>
        )}
        <p className="text-text-faint text-sm max-w-prose">
          Si no puedes entrar, el reset va por la terminal:{" "}
          <code className="font-mono text-text">npm run admin:password -- &apos;contraseña nueva&apos;</code>.
          Escribe en la base de datos, así que vale igual para producción y no hace falta
          redesplegar.
        </p>
      </section>

      <SignOutButton className="tap-target px-5 border border-(--border) text-(--accent) font-semibold text-sm hover:border-(--accent) transition-colors" />
    </div>
  );
}
