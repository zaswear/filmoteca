/* Service worker minimalista.
   Shell precacheada, pósters de TMDB y estáticos de /_next/static en
   cache-first/stale-while-revalidate, navegación en network-first. */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Pósters de TMDB: cache-first (cambian poco y pesan mucho).
  if (url.hostname === "image.tmdb.org") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Estáticos de Next: stale-while-revalidate.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navegación: network-first, con la shell precacheada como red de seguridad
  // (offline muestra /login en vez de la página de error del navegador).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/login"))
      )
    );
    return;
  }
});
