/** @type {import('next').NextConfig} */
const nextConfig = {
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
