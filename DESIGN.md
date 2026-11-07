---
version: alpha
name: Director's Cut
description: "Diario de cine personal. Sistema «Filmoteca»: papel hueso, bermellón de entrada de cine, marquesina sobre prosa."
colors:
  primary: "oklch(52% 0.190 32)"
  primary-hover: "oklch(45% 0.180 32)"
  papel: "oklch(92.5% 0.014 85)"
  papel-ficha: "oklch(96% 0.010 85)"
  papel-alto: "oklch(98.5% 0.006 85)"
  borde: "oklch(85% 0.020 80)"
  borde-alto: "oklch(72% 0.025 75)"
  tinta: "oklch(20% 0.012 60)"
  tinta-media: "oklch(42% 0.016 75)"
  tinta-tenue: "oklch(55% 0.015 75)"
  exito: "oklch(42% 0.090 160)"
  aviso: "oklch(48% 0.110 75)"
  error: "oklch(47% 0.180 28)"
  info: "oklch(45% 0.120 250)"
typography:
  marquesina:
    fontFamily: "Archivo Black, Arial Black, sans-serif"
    fontSize: "52px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  titular:
    fontFamily: "Archivo Black, Arial Black, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  seccion:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.35
  cuerpo:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  interfaz:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  prosa:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  ficha:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  tap: "44px"
  sm: "8px"
  md: "12px"
  lg: "24px"
components:
  boton-principal:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.papel}"
    typography: "{typography.interfaz}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  boton-principal-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.papel}"
  boton-secundario:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.tinta-media}"
    rounded: "{rounded.sm}"
    padding: "8px"
  tarjeta:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
    padding: "24px"
  modal:
    backgroundColor: "{colors.papel-alto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
  cartel:
    backgroundColor: "{colors.papel-alto}"
    rounded: "{rounded.xl}"
    width: "360px"
  cita-critica:
    textColor: "{colors.tinta-media}"
    typography: "{typography.prosa}"
  aviso-error:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
    padding: "12px"
  aviso-exito:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.exito}"
    rounded: "{rounded.md}"
    padding: "12px"
  aviso-info:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.info}"
    rounded: "{rounded.md}"
    padding: "12px"
  aviso-pendiente:
    backgroundColor: "{colors.papel-ficha}"
    textColor: "{colors.aviso}"
    rounded: "{rounded.md}"
    padding: "12px"
  fondo-pagina:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.cuerpo}"
  cabecera:
    textColor: "{colors.tinta}"
    typography: "{typography.marquesina}"
  titulo-pelicula:
    textColor: "{colors.tinta}"
    typography: "{typography.titular}"
---

# Design System: Director's Cut

Los valores de este fichero son un espejo de `app/globals.css` (`:root` y `@theme`), que es
la fuente de verdad. Si cambias un token allí, cámbialo aquí; si discrepan, gana el CSS.

## Overview

**Sistema «Filmoteca» (2026-09-21).** Un diario de cine de una sola persona, no una red
social. La interfaz es una ficha de filmoteca: papel hueso, tinta casi negra, y un único color
que actúa, el bermellón de una entrada de cine. Sirve al contenido —carteles, notas, recuerdos—
y no compite con él.

Anti-referencias: Letterboxd (social, hecho para la aprobación), IMDb (volcado de datos sin
voz), Netflix (interfaz de consumo) y cualquier panel SaaS gris azulado con Inter.

`design_concept/CONCEPT.md` describe el sistema anterior, oscuro y con acento ámbar. Está
superado: no lo uses como referencia de color.

## Colors

- **Bermellón (`primary`):** el único color de interacción. Botón principal, foco
  (`--border-focus`), capitular de la crítica y realce de cartel al pasar el ratón. Si algo es
  bermellón, se puede pulsar o es la marca.
- **Papel (`papel`, `papel-ficha`, `papel-alto`):** tres tonos de hueso para fondo, tarjeta y
  superficie elevada. Nunca blanco puro: los carteles no deben flotar sobre un folio.
- **Tinta (`tinta`, `tinta-media`, `tinta-tenue`):** texto principal, secundario y desactivado.
- **Semánticos (`exito`, `aviso`, `error`, `info`):** oscurecidos para que lean sobre papel.
  Sus fondos de aviso usan las tintas al 12 % (`--error-dim`, `--green-dim`), igual que
  `--accent-dim`.

`color-scheme: light`, a propósito: con `dark`, los `select`, los selectores de fecha y las
barras de scroll salían negros sobre el papel.

## Typography

Tres familias con papeles separados, cargadas con `next/font` en `app/layout.tsx`:

- **Archivo Black** (marquesina): titulares y título de película. Tiene un solo peso y no
  tiene cursiva; `.font-display` neutraliza el `font-semibold italic` heredado para que el
  navegador no sintetice una negrita falsa.
- **Archivo** (interfaz): cuerpo, botones, formularios. 15 px de base.
- **Newsreader** (prosa y letra de ficha): críticas, encabezados de sección en cursiva y la
  letra pequeña de archivo. **La utilidad `font-mono` apunta a Newsreader**, no a una
  monoespaciada; se conservó el nombre porque la usan unos cuarenta sitios.

Escala de Tailwind redefinida en `@theme`: 11 · 13 · 15 · 18 · 22 · 28 · 38 · 52 px.

## Layout

- Superficie mínima de pulsación de 44×44 px (WCAG 2.2, 2.5.8) con la utilidad `tap-target`.
  El icono puede seguir midiendo 18 px; lo que crece es el área que responde al dedo.
- La prosa de crítica se limita a 68 caracteres de ancho (`.prose-review`).
- Navegación de cuatro destinos y una acción: Inicio · Diario · Descubrir · ¿Qué veo? ·
  Balance, más **Registrar**. Una fuente nueva es una pestaña de `/descubrir`, nunca una
  entrada del menú.

## Elevation & Depth

Sombras cálidas y ligeras (tinta `oklch(20% 0.01 60)` con poca opacidad), porque sobre papel
pesan mucho más que sobre negro: `shadow-card` (10 %), `shadow-raised` (14 %),
`shadow-poster` (20 %) y `shadow-modal` (26 %). El cartel es el único elemento con sombra
marcada; el resto se separa con bordes.

## Shapes

Radios de 4 a 16 px. Botones a 6 px, tarjetas, modales y carteles a 12 px. Los carteles son
siempre 2:3 (`aspect-2/3`).

## Components

- **Botón principal:** fondo bermellón, texto en color papel, 13 px y peso 500, radio de 6 px.
  Uno por vista.
- **Confirmar borrados:** `components/ui/inline-confirm.tsx`, nunca `window.confirm`. El foco
  va a **Cancelar**.
- **Nota:** admite decimales (6,5, 7,9…). `RatingInput` combina deslizador con paso de 0,1,
  botones y campo numérico. No redondear.
- **Crítica:** capitular de Newsreader en bermellón en el primer párrafo y citas con un filete
  bermellón de 2 px a la izquierda.

## Do's and Don'ts

### Do:
- Sacar todo color, radio y sombra de los tokens de `app/globals.css`.
- Mantener un solo color de acción.
- Respetar los 44 px de superficie táctil.

### Don't:
- Volver al tema oscuro ni al ámbar de `CONCEPT.md`.
- Usar blanco puro de fondo, o Inter u otra sans genérica.
- Meter la nota dentro del cartel salvo al ordenar por «Mi puntuación».
- Añadir entradas al menú para fuentes nuevas.
