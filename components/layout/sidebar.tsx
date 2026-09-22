"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut, Plus, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { SearchTrigger } from "./search-command";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

import { t } from "@/lib/i18n";
interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Cuatro destinos y una acción. Antes eran trece entradas, y seis de ellas
// —cartelera, pendientes, ¿qué veo?, sugerencias, lanzamientos y Top LGBT+—
// contestaban la misma pregunta desde fuentes distintas: ahora son pestañas
// dentro de Descubrir. Registrar deja de ser un sitio y pasa a ser el botón
// que hay arriba, porque es LA acción de un diario, no un lugar al que ir.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/", label: t("nav.inicio") },
      { href: "/peliculas", label: t("nav.diario") },
      { href: "/descubrir", label: t("nav.descubrir") },
      { href: "/que-ver", label: t("nav.queVeo") },
      { href: "/balance", label: t("nav.balance") },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/peliculas") return pathname === href || pathname.startsWith("/peliculas/");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className={cn(
      "flex flex-col w-[220px] shrink-0 h-full overflow-y-auto md:h-dvh border-r border-(--border) bg-(--surface)",
      "fixed md:relative z-50 md:z-auto transition-transform duration-250",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
    )}>
      {/* Wordmark + close button mobile */}
      <div className="px-5 pt-7 pb-6 flex items-center justify-between">
        <Link href="/" onClick={onClose} aria-label={t("nav.inicio")}>
          <Logo size={18} className="select-none" />
        </Link>
        <button
          onClick={onClose}
          className="md:hidden tap-target -mr-2 rounded text-text-faint hover:text-text transition-colors"
          aria-label={t("nav.cerrarMenu")}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="w-full h-px bg-(--border) mb-4" />

      {/* Buscador global */}
      <div className="px-4 pb-3">
        <SearchTrigger />
      </div>

      {/* Registrar no es una entrada del menú: es la acción del diario y tiene
          que estar a un clic desde cualquier pantalla. */}
      <div className="px-4 pb-4">
        <Link
          href="/peliculas/nueva"
          onClick={onClose}
          className="tap-target w-full gap-2 bg-(--accent) text-(--bg) font-semibold text-[14px] px-4 hover:bg-(--accent-hover) transition-colors"
        >
          <Plus size={15} aria-hidden="true" />
          {t("nav.registrar")}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-6">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.label ?? `group-${groupIdx}`}>
            {group.label && (
              <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.14em] text-text-faint font-mono">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "relative flex items-center px-3 py-2 text-[14px] transition-colors duration-150 rounded-[6px]",
                      active
                        ? "text-(--accent)"
                        : "text-text-mid hover:text-text hover:bg-(--surface-hi)"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-(--accent) rounded-full" />
                    )}
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="w-full h-px bg-(--border) mt-2" />

      {/* Ajustes y sesión */}
      <div className="px-3 pt-3">
        <Link
          href="/ajustes"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-sm text-text-faint hover:text-text hover:bg-(--surface-hi) transition-colors duration-150 w-full"
        >
          <Settings size={15} className="shrink-0" />
          {t("nav.ajustes")}
        </Link>
      </div>
      <div className="px-3 pb-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-sm text-text-faint hover:text-text hover:bg-(--surface-hi) transition-colors duration-150 w-full"
        >
          <LogOut size={15} className="shrink-0" />
          {t("nav.cerrarSesion")}
        </button>
      </div>
    </aside>
  );
}
