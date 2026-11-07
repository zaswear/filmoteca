// Cabeceras de seguridad (auditoría 2026-11-07). Sin `script-src`: Next mete
// scripts en línea y exigiría nonces. Lo que sí se fija: que otro dominio no
// pueda enmarcar la web (clickjacking), nosniff, Referer sin la ruta hacia
// fuera y sin permisos de cámara, micro ni ubicación.
const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
  },
  // Next dispara la View Transitions API en las navegaciones del App Router:
  // el cartel mantiene la continuidad diario↔ficha (ver dc-poster-* en los
  // componentes) y el resto del documento hace cross-fade (globals.css).
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "ia.media-imdb.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "image.tmdb.org" },
      // Mubis es una web, no un CDN de imágenes: acotamos a /media para no
      // exponer el optimizador a cualquier ruta del dominio.
      { protocol: "https", hostname: "www.mubis.es", pathname: "/media/**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800,
  },
};

export default nextConfig;
