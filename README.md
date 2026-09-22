# Filmoteca

Un diario de cine que es tuyo. Apuntas lo que ves, le pones nota, escribes lo que
te pareció — y los datos se quedan en tu base de datos, no en la de nadie más.

Es de **una sola persona por instancia**: no hay registro, ni muro social, ni
perfiles públicos. Montas la tuya, entras con tu usuario y ya.

> Sin capturas todavía. Si montas una instancia y quieres aportar una, abre un issue.

## Qué hace

- **Registrar visionados.** Una película puede verse varias veces; cada visionado
  guarda su fecha, su formato (cine, Blu-ray, streaming…) y su nota.
- **Reseñas** en HTML, con un editor propio.
- **Importar tu historial de IMDb.** Exportas tus ratings desde IMDb, sueltas el
  CSV en `export_imdb/` y eliges desde la web cuáles importar. Cada una se
  enriquece con OMDb antes de guardarse.
- **Ficha automática** desde TMDB y OMDb: sinopsis, reparto, duración, nota y
  votos de IMDb, póster y tráiler.
- **Qué ver**, un buscador en lenguaje natural: «algo corto de los 90 que no haya
  visto». Es la única parte con IA, y es opcional.
- **Estadísticas** — barras y mapa de calor dibujados en CSS, sin librería de
  gráficos.
- **Descubrir**: cartelera, próximos Blu-ray y listas temáticas.
- **Postal exportable** de una película, con su nota y su reseña, para compartir.
- **PWA**: se instala en el móvil y la carcasa funciona sin conexión.

## Antes de empezar

Necesitas tres cosas, todas con plan gratuito:

| | Para qué | Dónde |
|---|---|---|
| **PostgreSQL** | Tus datos | [Neon](https://neon.tech) va bien, pero sirve cualquiera |
| **TMDB** | Fichas y pósters | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) — el token *bearer v4* |
| **OMDb** | Nota y votos de IMDb | [omdbapi.com/apikey](https://www.omdbapi.com/apikey.aspx) — 1.000 peticiones/día |

Opcionales: **Cloudinary** (solo si quieres subir tus propias fotos; sin ella se
usan los pósters de TMDB) y una **clave de Anthropic** (solo para el buscador en
lenguaje natural).

Node 20 o superior.

## Instalación

```bash
git clone https://github.com/zaswear/filmoteca.git
cd filmoteca
npm install

cp .env.example .env        # rellena DATABASE_URL, TMDB y OMDb
npm run db:deploy           # crea las tablas
npm run admin:password -- 'tu contraseña'
npm run dev
```

Abre <http://localhost:3000>. Te pedirá el usuario de `ADMIN_USER` y la
contraseña que acabas de poner.

### Sobre la contraseña

No vive en una variable de entorno: vive en la base, hasheada con scrypt. Eso
significa que se cambia **sin volver a desplegar**, y que el reset funciona
cuando no puedes entrar a la web — que es justo cuando hace falta:

```bash
npm run admin:password -- 'contraseña nueva'
```

Al cambiarla se invalidan las sesiones abiertas. Si no hay fila de credencial ni
`ADMIN_PASSWORD_HASH`, el login **falla cerrado**: no entra nadie.

## Desplegar

Funciona en cualquier sitio que corra Next.js. En Vercel: importas el repo, pegas
las variables de `.env.example` y listo — el `build` ya lanza `prisma generate`.

En un VPS:

```bash
npm ci && npm run build
npm start                   # o detrás de pm2 / systemd
```

Pon `NEXTAUTH_URL` y `NEXT_PUBLIC_APP_URL` a tu dominio real, y genera un
`NEXTAUTH_SECRET` nuevo con `openssl rand -hex 32`.

La app se sirve con `robots: noindex, nofollow`. Es un diario personal, no una
web pública: si quieres que Google lo indexe, cámbialo en `app/layout.tsx`.

## Ponerle tu nombre

Cuatro variables, ningún fichero que tocar:

```env
NEXT_PUBLIC_APP_NAME="Mi cine"
NEXT_PUBLIC_APP_TAGLINE="Lo que veo"
NEXT_PUBLIC_APP_URL="https://micine.ejemplo"
NEXT_PUBLIC_APP_AUTHOR=""     # vacío = sin pie de página
```

Next las hornea en el bundle al construir: después de cambiarlas hace falta un
rebuild, no basta con reiniciar. Salen en el título, el logo, el manifiesto de la
PWA y la postal exportable, todo desde [`lib/branding.ts`](lib/branding.ts).

El icono del billete es un SVG en [`components/layout/logo.tsx`](components/layout/logo.tsx),
sin dependencias. Cámbialo si quieres otra cosa.

## Stack

| Capa | Qué |
|---|---|
| Framework | Next.js 16 · App Router · React 19 · TypeScript |
| Base de datos | PostgreSQL · Prisma 5 |
| Acceso | NextAuth 4 · JWT · credencial scrypt en la base |
| Estilos | Tailwind 4 · OKLCH |
| Tipografía | Archivo Black · Archivo · Newsreader |
| Gráficos | Ninguna librería — CSS |
| Datos | TMDB · OMDb |
| Imágenes | Cloudinary (opcional) |

## Comandos

```bash
npm run dev            # desarrollo
npm run build          # build de producción
npm start              # servir el build

npm run lint           # ESLint (--max-warnings=0)
npm run typecheck      # tsc --noEmit
npm test               # tests con node --test

npm run db:deploy      # aplica las migraciones (base vacía)
npm run db:migrate     # crea una migración nueva tras tocar el schema
npm run db:generate    # regenera el cliente Prisma
npm run db:studio      # Prisma Studio
npm run admin:password -- 'contraseña'
```

**No uses `prisma db push` contra una base con datos.** Sincroniza el esquema a
la brava y puede vaciar tablas enteras — pasó, y por eso no hay script para él.

## Estructura

```
app/
  (app)/          páginas con sesión: películas, watchlist, qué ver, stats…
  api/            rutas de servidor: TMDB, OMDb, imágenes, importación
  login/
components/       interfaz (movies/, layout/, stats/, ui/)
lib/
  branding.ts     el nombre de tu instancia
  tmdb.ts omdb.ts wrappers de las dos APIs
  csv.ts          parser de las exportaciones de IMDb
  auth.ts         NextAuth + credencial
prisma/           schema y migraciones
scripts/          utilidades sueltas (importadores, backfills)
export_imdb/      tus CSV de IMDb — gitignored
```

## Contribuir

Issues y PRs, bienvenidos. Antes de abrir un PR: `npm run lint`,
`npm run typecheck` y `npm test` en verde.

Ten en cuenta que esto nació como una app personal y sigue siéndolo: el objetivo
no es convertirla en multiusuario. Si tu idea empieza por «y si varios
usuarios…», probablemente quieras otro proyecto.

## Licencia

MIT — ver [LICENSE](LICENSE).
