import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { PosterWall } from "./poster-wall";
import { Logo } from "@/components/layout/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

async function getPosters(): Promise<string[]> {
  try {
    const rows = await db.movie.findMany({
      where: { posterUrl: { not: null } },
      select: { posterUrl: true },
      orderBy: { watchedAt: "desc" },
      take: 72,
    });
    const posters = rows.map((r) => r.posterUrl!).filter(Boolean);
    // Barajado Fisher-Yates para que el muro cambie en cada carga
    for (let i = posters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posters[i], posters[j]] = [posters[j], posters[i]];
    }
    return posters.slice(0, 48);
  } catch {
    // Si la BD no responde, el login degrada a fondo oscuro liso
    return [];
  }
}

export default async function LoginPage() {
  // Ya autenticado: el login no tiene nada que ofrecer, al diario directo.
  const session = await getServerSession(authOptions);
  if (session) redirect("/peliculas");

  const posters = await getPosters();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      {/* Fondo cinematográfico */}
      <PosterWall posters={posters} />
      <div className="login-vignette" aria-hidden="true" />
      <div className="login-spot" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />

      {/* Primer plano */}
      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px] bg-(--surface-overlay) border border-(--border-hi) rounded-2xl px-7 py-10 shadow-(--shadow-modal)">
          <div className="flex justify-center mb-10">
            <h1 className="leading-none">
              <Logo variant="ticket" size={54} />
            </h1>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
