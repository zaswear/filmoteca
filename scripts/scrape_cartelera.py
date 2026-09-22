#!/usr/bin/env python3
"""
Extrae la cartelera de Springhaver y la guarda en la base de datos (cinema_movies, cinema_showtimes).
"""

import os
import sys
import re
from datetime import date
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import psycopg2

def load_env():
    # El archivo .env está en la raíz del proyecto, un nivel arriba de la carpeta scripts
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()
DB_URL = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")

URL = "https://www.springhaver.nl/agenda/"

def scraping_definitief():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        html_contenido = page.content()
        browser.close()
        
    soup = BeautifulSoup(html_contenido, 'html.parser')
    enlaces = soup.find_all('a')
    cartelera = {}
    
    for link in enlaces:
        href = link.get('href', '')
        texto = link.get_text(" ", strip=True)
        
        if href and '/films/' in href.lower() and len(texto) > 3:
            url_completa = href if href.startswith('http') else f"https://springhaver.nl{href}"
            hora_match = re.search(r'\d{2}:\d{2}', texto)
            hora = hora_match.group(0) if hora_match else ""
            
            texto_limpio = re.sub(r'\d{2}-\d{2}(-\d{4})?', '', texto)
            if hora:
                texto_limpio = texto_limpio.replace(hora, '')
                
            patrones_molestos = [
                r'Kijkwijzer\s?\d*', r'Alle leeftijden', r'Première', 
                r'Exclusief', r'Hoogtepunt', r'De Volkskrant', r'Trouw', 
                r'Verwacht', r'Summer Film Festival Special'
            ]
            for patron in patrones_molestos:
                texto_limpio = re.sub(patron, '', texto_limpio, flags=re.IGNORECASE)
            
            titulo_final = " ".join(texto_limpio.split()).strip()
            
            if len(titulo_final) > 2:
                if titulo_final not in cartelera:
                    cartelera[titulo_final] = {"url": url_completa, "horarios": set()}
                if hora:
                    cartelera[titulo_final]["horarios"].add(hora)
    return cartelera

def main():
    if not DB_URL:
        print("ERROR: DATABASE_URL_UNPOOLED o DATABASE_URL no encontrada en .env")
        sys.exit(1)
        
    print("Iniciando scraping de cartelera...")
    cartelera = scraping_definitief()
    
    if not cartelera:
        print("No se encontraron películas en la cartelera.")
        sys.exit(0)
        
    print(f"Scraping completado. {len(cartelera)} películas encontradas.")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        today = date.today()
        
        # Eliminar horarios de hoy para evitar duplicados / datos viejos
        cur.execute("DELETE FROM cinema_showtimes WHERE date = %s", (today,))
        
        for title, info in cartelera.items():
            # Upsert movie
            cur.execute("""
                INSERT INTO cinema_movies (title, url, created_at) 
                VALUES (%s, %s, NOW()) 
                ON CONFLICT (title) DO UPDATE SET url = EXCLUDED.url
                RETURNING id
            """, (title, info["url"]))
            
            movie_id = cur.fetchone()[0]
            
            # Insert showtimes
            for hora in info["horarios"]:
                cur.execute("""
                    INSERT INTO cinema_showtimes (movie_id, start_time, date)
                    VALUES (%s, %s, %s)
                """, (movie_id, hora, today))
                
        conn.commit()
        print("Base de datos actualizada con éxito.")
        
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"Error actualizando la base de datos: {e}")
        sys.exit(1)
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()
