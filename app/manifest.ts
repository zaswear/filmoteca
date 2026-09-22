import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";

/**
 * El manifiesto era un fichero estático en `public/`, y por eso llevaba el
 * nombre escrito a mano: `public/` lo sirve Vercel desde el sistema de ficheros
 * y nunca ve una variable de entorno. Como ruta generada sí ve `branding.ts`,
 * así que la app instalada se llama igual que la del navegador.
 *
 * Next lo sirve en `/manifest.webmanifest` e inyecta el `<link>` él solo: por
 * eso `metadata.manifest` ya no hace falta en el layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    theme_color: "#EDE8DE",
    background_color: "#EDE8DE",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
