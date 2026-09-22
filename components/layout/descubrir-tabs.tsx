"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { t } from "@/lib/i18n";
const FUENTES = [
  { href: "/descubrir/cartelera", label: t("tabs.enCines") },
  { href: "/descubrir/sugerencias", label: t("tabs.sugerencias") },
  { href: "/descubrir/bluray", label: t("tabs.bluray") },
  { href: "/descubrir/lgbt", label: t("tabs.topLgbt") },
];

export function DescubrirTabs() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // La píldora se posiciona con transform (translateX) y solo transita esa
  // propiedad; el ancho se ajusta al de la pestaña activa sin transición.
  // Se escribe directo sobre el DOM en useLayoutEffect: no hay setState en el
  // efecto y la primera pintada ya lleva la píldora colocada (sin flash).
  useLayoutEffect(() => {
    const update = () => {
      const activeIdx = FUENTES.findIndex((f) => f.href === pathname);
      const pill = pillRef.current;
      const link = activeIdx >= 0 ? linkRefs.current[activeIdx] : undefined;
      if (!pill || !link) return;
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
      pill.style.opacity = "1";
      // En móvil el nav scrollea horizontal: la pestaña activa se trae a vista
      // para que la píldora no quede fuera del viewport.
      link.scrollIntoView({ inline: "nearest", block: "nearest" });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pathname]);

  return (
    <nav
      aria-label={t("tabs.fuentes")}
      className="relative flex gap-0 mt-5 border-b border-(--text) overflow-x-auto"
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full bg-(--text) opacity-0 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform"
      />
      {FUENTES.map(({ href, label }, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative z-10 tap-target px-5 text-[15px] font-semibold whitespace-nowrap transition-colors",
              active
                ? "text-(--bg)"
                : "text-text-mid hover:bg-(--surface-hi) hover:text-text",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
