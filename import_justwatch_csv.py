#!/usr/bin/env python3
"""
Importa títulos del likelist.csv de JustWatch a la base (PostgreSQL).

Uso:
  python3 import_justwatch_csv.py [--csv /ruta/al/likelist.csv] [--dry-run] [--rating 5]

Requiere:
  pip install requests psycopg2-binary python-dotenv
"""

import os
import sys
import time
import argparse
import urllib.parse
import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
from import_lib import clean, parse_omdb  # noqa: E402

# ─── Cargar .env ─────────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()

OMDB_KEY   = os.environ.get("OMDB_API_KEY", "8f096d5c")
DB_URL     = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")

# ─── DB helpers ──────────────────────────────────────────────────────────────

def get_conn():
    try:
        import psycopg2
        return psycopg2.connect(DB_URL)
    except ImportError:
        print("ERROR: instala psycopg2-binary → pip install psycopg2-binary")
        sys.exit(1)

def movie_exists(cur, imdb_id: str) -> bool:
    cur.execute("SELECT 1 FROM movies WHERE imdb_id = %s", (imdb_id,))
    return cur.fetchone() is not None

def insert_movie(cur, m: dict):
    cur.execute("""
        INSERT INTO movies (
            imdb_id, title, original_title, year, duration_min,
            genres, directors, cast, plot, poster_url,
            imdb_rating, imdb_votes, country, language, rated,
            my_rating, status, imported_from_imdb,
            has_imdb_review, created_at, updated_at
        ) VALUES (
            %(imdb_id)s, %(title)s, %(original_title)s, %(year)s, %(duration_min)s,
            %(genres)s, %(directors)s, %(cast)s, %(plot)s, %(poster_url)s,
            %(imdb_rating)s, %(imdb_votes)s, %(country)s, %(language)s, %(rated)s,
            %(my_rating)s, %(status)s, %(imported_from_imdb)s,
            %(has_imdb_review)s, NOW(), NOW()
        )
    """, m)

# ─── OMDb helpers ─────────────────────────────────────────────────────────────

def omdb_search(title: str):
    r = requests.get("https://www.omdbapi.com/", params={
        "apikey": OMDB_KEY, "s": title, "type": "movie"
    }, timeout=10)
    d = r.json()
    return d.get("Search", []) if d.get("Response") == "True" else []

def omdb_get(imdb_id: str):
    r = requests.get("https://www.omdbapi.com/", params={
        "apikey": OMDB_KEY, "i": imdb_id, "plot": "full"
    }, timeout=10)
    d = r.json()
    return d if d.get("Response") == "True" else None

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",     required=True,
                        help="CSV a importar (ver import_data/ejemplo.csv para el formato)")
    parser.add_argument("--rating",  type=float, default=5.0, help="Puntuación por defecto (default: 5.0)")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra lo que haría, no inserta")
    parser.add_argument("--delay",   type=float, default=0.3, help="Pausa entre llamadas OMDb (s)")
    args = parser.parse_args()

    if not DB_URL:
        print("ERROR: DATABASE_URL_UNPOOLED o DATABASE_URL no encontrada en .env")
        sys.exit(1)

    # Leer títulos
    with open(args.csv, encoding="utf-8") as f:
        titles = [l.strip() for l in f if l.strip()]
    print(f"→ {len(titles)} títulos en el CSV")

    conn = None if args.dry_run else get_conn()
    cur  = None if args.dry_run else conn.cursor()

    ok = skip = fail = 0
    failed_titles = []

    for i, title in enumerate(titles, 1):
        print(f"\n[{i}/{len(titles)}] {title}", end=" ... ", flush=True)

        # Buscar en OMDb
        results = omdb_search(title)
        if not results:
            print("❌ no encontrado en OMDb")
            fail += 1
            failed_titles.append(title)
            time.sleep(args.delay)
            continue

        # Tomar el primer resultado
        best = results[0]
        imdb_id = best["imdbID"]

        # Comprobar duplicado
        if not args.dry_run and movie_exists(cur, imdb_id):
            print(f"⏭  ya existe ({imdb_id})")
            skip += 1
            time.sleep(args.delay)
            continue

        # Obtener metadatos completos
        detail = omdb_get(imdb_id)
        if not detail:
            print(f"❌ error obteniendo detalles de {imdb_id}")
            fail += 1
            failed_titles.append(title)
            time.sleep(args.delay)
            continue

        movie = parse_omdb(detail, args.rating)
        print(f"✓  {detail['Title']} ({detail.get('Year','?')}) [{imdb_id}]")

        if not args.dry_run:
            try:
                insert_movie(cur, movie)
                conn.commit()
                ok += 1
            except Exception as e:
                conn.rollback()
                print(f"   ⚠ Error al insertar: {e}")
                fail += 1
                failed_titles.append(title)
        else:
            ok += 1  # dry-run: contamos como éxito

        time.sleep(args.delay)

    # Resumen
    print(f"\n{'='*50}")
    print(f"✓ Insertadas:   {ok}")
    print(f"⏭ Ya existían: {skip}")
    print(f"❌ Fallidas:    {fail}")
    if failed_titles:
        print("\nTítulos que no se pudieron importar:")
        for t in failed_titles:
            print(f"  - {t}")

    if conn:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
