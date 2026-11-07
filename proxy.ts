import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// Las rutas /api/ sin sesión devuelven 401 JSON: un fetch no puede seguir una
// redirección a /login, y recibir el HTML del login con un 307 parece éxito.
// Las páginas conservan la redirección (authorized → false → /login).
export default withAuth(
  function middleware(req) {
    if (!req.nextauth.token && req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  },
  {
    callbacks: {
      authorized({ token, req }) {
        if (req.nextUrl.pathname.startsWith("/api/")) return true; // el 401 se decide en middleware
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    // `icon.svg` y `og.png` van fuera del login: el favicon lo pide el
    // navegador antes de que haya sesión y, si pasa por aquí, contesta con un
    // 307 al login y la pestaña se queda con el icono genérico.
    // `api/cartelera/revalidate` lo llama el cron sin sesión; se protege con
    // CRON_SECRET en la propia ruta.
    "/((?!login|api/auth|api/cartelera/revalidate|_next/static|_next/image|icon\\.svg|og\\.png|favicon\\.ico).*)",
  ],
};
