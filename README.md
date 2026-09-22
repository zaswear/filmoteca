# Filmoteca

**English** · [Español](README.es.md)

A film diary that's yours. You log what you watch, rate it, write what you
thought — and the data stays in your own database, not in someone else's.

It's **one person per instance**: no sign-up, no social feed, no public
profiles. You deploy your own, you sign in, that's it.

> No screenshots yet. If you run an instance and want to contribute one, open an
> issue.

## What it does

- **Log viewings.** A film can be watched more than once; each viewing keeps its
  own date, format (cinema, Blu-ray, streaming…) and rating.
- **Reviews** in rich text, with a built-in editor.
- **Import your IMDb history.** Export your ratings from IMDb, drop the CSV in
  `export_imdb/` and pick from the web which ones to import. Each one is
  enriched from OMDb before it's saved.
- **Automatic details** from TMDB and OMDb: plot, cast, runtime, IMDb rating and
  votes, poster and trailer.
- **What to watch**, a natural-language picker: "something short from the 90s I
  haven't seen". It's the only part that uses AI, and it's optional.
- **Statistics** — bars and a heatmap drawn in CSS, no charting library.
- **Discover**: what's in cinemas, upcoming Blu-rays and themed lists.
- **An exportable postcard** of a film, with its rating and review, to share.
- **PWA**: installs on your phone, and the shell works offline.

## Before you start

You need three things, all with a free tier:

| | What for | Where |
|---|---|---|
| **PostgreSQL** | Your data | [Neon](https://neon.tech) works well, but any will do |
| **TMDB** | Details and posters | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) — the *v4 bearer* token |
| **OMDb** | IMDb rating and votes | [omdbapi.com/apikey](https://www.omdbapi.com/apikey.aspx) — 1,000 requests/day |

Optional: **Cloudinary** (only if you want to upload your own photos; without it
TMDB posters are used) and an **Anthropic key** (only for the natural-language
picker).

Node 20 or newer.

## Install

```bash
git clone https://github.com/zaswear/filmoteca.git
cd filmoteca
npm install

cp .env.example .env        # fill in DATABASE_URL, TMDB and OMDb
npm run db:deploy           # create the tables
npm run admin:password -- 'your password'
npm run dev
```

Open <http://localhost:3000>. It'll ask for the username from `ADMIN_USER` and
the password you just set.

### About the password

It doesn't live in an environment variable: it lives in the database, hashed
with scrypt. That means you change it **without redeploying**, and the reset
works when you can't get into the web — which is exactly when you need it:

```bash
npm run admin:password -- 'new password'
```

Changing it invalidates open sessions. With no credential row and no
`ADMIN_PASSWORD_HASH`, login **fails closed**: nobody gets in.

## Deploy

It runs anywhere Next.js runs. On Vercel: import the repo, paste the variables
from `.env.example`, done — `build` already runs `prisma generate`.

On a VPS:

```bash
npm ci && npm run build
npm start                   # or behind pm2 / systemd
```

Point `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` at your real domain, and generate
a fresh `NEXTAUTH_SECRET` with `openssl rand -hex 32`.

The app is served with `robots: noindex, nofollow`. It's a personal diary, not a
public site: if you want Google to index it, change it in `app/layout.tsx`.

## Language

The interface ships in **English and Spanish**. You pick at deploy time, not at
runtime:

```env
NEXT_PUBLIC_APP_LOCALE="en"    # "es" is the default
```

It switches the whole interface, the language requested from TMDB (plots and
titles), date formatting and the decimal separator. Next bakes it into the
bundle at build time, so changing it needs a rebuild.

There's no language switcher in the app, on purpose: an instance belongs to one
person, who picks their language once. A switcher would force `[locale]` route
segments and negotiation middleware for a change nobody makes twice.

The dictionaries live in [`lib/locales/`](lib/locales/), 400 keys each. English
is typed against Spanish, so **a missing key is a compile error**, not an empty
string in production. To add a language: copy `es.ts`, translate it, and add it
to the map in [`lib/i18n.ts`](lib/i18n.ts).

## Making it yours

Four variables, no files to touch:

```env
NEXT_PUBLIC_APP_NAME="My cinema"
NEXT_PUBLIC_APP_TAGLINE="What I watch"
NEXT_PUBLIC_APP_URL="https://mycinema.example"
NEXT_PUBLIC_APP_AUTHOR=""     # empty = no footer
```

Plus the cities for the "In cinemas" filter, which is empty otherwise:

```env
NEXT_PUBLIC_CINEMA_CITIES="London,Manchester,Bristol"
```

Next bakes these into the bundle at build time: changing them needs a rebuild,
not a restart. They show up in the title, the logo, the PWA manifest and the
exportable postcard, all from [`lib/branding.ts`](lib/branding.ts).

The ticket icon is an SVG in
[`components/layout/logo.tsx`](components/layout/logo.tsx), no dependencies.
Swap it for something else if you like.

## Stack

| Layer | What |
|---|---|
| Framework | Next.js 16 · App Router · React 19 · TypeScript |
| Database | PostgreSQL · Prisma 5 |
| Auth | NextAuth 4 · JWT · scrypt credential in the database |
| Styling | Tailwind 4 · OKLCH |
| Type | Archivo Black · Archivo · Newsreader |
| Charts | No library — CSS |
| Data | TMDB · OMDb |
| Images | Cloudinary (optional) |

## Commands

```bash
npm run dev            # development
npm run build          # production build
npm start              # serve the build

npm run lint           # ESLint (--max-warnings=0)
npm run typecheck      # tsc --noEmit
npm test               # tests with node --test

npm run db:deploy      # apply migrations (empty database)
npm run db:migrate     # create a new migration after changing the schema
npm run db:generate    # regenerate the Prisma client
npm run db:studio      # Prisma Studio
npm run admin:password -- 'password'
```

**Don't run `prisma db push` against a database with data in it.** It syncs the
schema bluntly and can empty whole tables — it happened, which is why there's no
script for it.

## Layout

```
app/
  (app)/          signed-in pages: films, watchlist, what to watch, stats…
  api/            server routes: TMDB, OMDb, images, import
  login/
components/       interface (movies/, layout/, stats/, ui/)
lib/
  branding.ts     your instance's name
  i18n.ts         t() and the locale
  locales/        es.ts · en.ts dictionaries
  tmdb.ts omdb.ts wrappers for both APIs
  csv.ts          parser for IMDb exports
  auth.ts         NextAuth + credential
prisma/           schema and migrations
scripts/          one-off utilities (importers, backfills)
export_imdb/      your IMDb CSVs — gitignored
```

## Contributing

Issues and PRs welcome. Before opening a PR: `npm run lint`, `npm run typecheck`
and `npm test` green.

Bear in mind this started as a personal app and still is one: the goal isn't to
turn it multi-user. If your idea starts with "what if several users…", you
probably want a different project.

## Licence

MIT — see [LICENSE](LICENSE).
