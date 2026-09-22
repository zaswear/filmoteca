"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { SearchCommand, SearchTrigger } from "./search-command";
import { Logo } from "./logo";
import { LiveRegion } from "@/components/ui/live-region";
import { RainbowGradient } from "@/components/ui/rainbow-gradient";
import { Menu, Home, Film, Compass, BarChart3, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { APP_AUTHOR } from "@/lib/branding";
/** sessionStorage y no localStorage: la posición de scroll caduca con la
 *  pestaña. Volver mañana a la 4ª pantalla de Películas no tendría sentido. */
const scrollKey = (path: string) => `dc-scroll:${path}`;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const volviendoAtras = useRef(false);

  // Cierra el sidebar al navegar
  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Bloquea el scroll del body cuando el sidebar está abierto en mobile
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Restauración del scroll ────────────────────────────────────────────────
  // El scroll no vive en el documento sino en <main> (overflow-y:auto), así que
  // la restauración nativa del navegador no sirve: restaura window.scrollY, que
  // aquí siempre es 0. Next ya deja el scroll arriba al navegar hacia delante;
  // lo que faltaba era recuperarlo al volver atrás. Sin esto, en móvil bajabas
  // 4 pantallas en Películas (6,5 en la watchlist), abrías una ficha y volvías
  // al principio de la lista.
  useEffect(() => {
    const marcar = () => { volviendoAtras.current = true; };
    window.addEventListener("popstate", marcar);
    return () => window.removeEventListener("popstate", marcar);
  }, []);

  // Guarda la posición mientras scrolleas.
  //
  // El margen inicial no es paranoia: al pasar de una página larga a una corta
  // (de la watchlist a una ficha, p. ej.) el navegador recorta scrollTop a la
  // altura del contenido nuevo y eso dispara un evento `scroll`. Sin el margen
  // se guardaba ese recorte como si fuera tu posición, y al ir hacia delante la
  // ficha aparecía scrolleada a media página.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    let listo = false;
    const arranque = setTimeout(() => { listo = true; }, 400);
    const onScroll = () => {
      if (!listo) return;
      clearTimeout(t);
      t = setTimeout(() => {
        try { sessionStorage.setItem(scrollKey(pathname), String(el.scrollTop)); } catch { /* modo privado */ }
      }, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(t); clearTimeout(arranque);
    };
  }, [pathname]);

  // Recupera la posición, pero SOLO al volver atrás: entrar de nuevo por el
  // menú debe llevarte arriba, como en cualquier web.
  useEffect(() => {
    if (!volviendoAtras.current) return;
    volviendoAtras.current = false;
    const el = mainRef.current;
    if (!el) return;
    let guardado: string | null = null;
    try { guardado = sessionStorage.getItem(scrollKey(pathname)); } catch { /* modo privado */ }
    const y = guardado ? parseInt(guardado, 10) || 0 : 0;
    // Se asigna siempre, también el 0. En popstate Next no toca el scroll —da
    // por hecho que lo restaura el navegador, que aquí no puede porque el
    // scroll no está en el documento— así que al ir hacia delante a una página
    // más corta te quedabas con el scroll recortado de la anterior, a media
    // ficha. Sin posición guardada, arriba.
    // Dos frames: uno para que Next pinte, otro para que el layout tenga ya su
    // altura final y el scrollTop no se recorte.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = y; }));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">

      {/* Buscador global Ctrl/⌘+K (modal único) */}
      <SearchCommand />

      {/* Región de anuncios única para lectores de pantalla. Los componentes
          no la importan: llaman a anunciar() desde donde estén. */}
      <LiveRegion />

      {/* Gradiente LGBT global único */}
      <RainbowGradient id="rainbow-gradient" />

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-(--backdrop) md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={open} onClose={() => setOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header mobile — solo visible en pantallas < md */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="tap-target -ml-1.5 rounded-md text-text-mid hover:text-text hover:bg-surface-hi transition-colors"
            aria-label="Abrir menú"
            aria-expanded={open}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <Link href="/" aria-label="Inicio" className="leading-none">
            <Logo size={16} />
          </Link>
          <SearchTrigger compact className="ml-auto" />
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto min-w-0 flex flex-col justify-between pb-16 md:pb-0">
          <div className="flex-1">
            {children}
          </div>
          {APP_AUTHOR.trim() && (
            <footer className="py-6 border-t border-border text-center text-xs text-text-faint font-mono">
              Hecho con ❤️ por {APP_AUTHOR}
            </footer>
          )}
        </main>

        {/* Mobile bottom dock navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-surface border-t border-border flex items-center justify-around md:hidden">
          {[
            { href: "/", icon: Home, label: "Inicio" },
            { href: "/peliculas", icon: Film, label: "Diario" },
            { href: "/peliculas/nueva", icon: Plus, label: "Registrar" },
            { href: "/descubrir", icon: Compass, label: "Descubrir" },
            { href: "/balance", icon: BarChart3, label: "Balance" }
          ].map((item) => {
            const active =
              item.href === "/" ? pathname === "/"
              : item.href === "/peliculas" ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-16 h-full text-center transition-colors",
                  active ? "text-(--accent)" : "text-text-mid"
                )}
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
