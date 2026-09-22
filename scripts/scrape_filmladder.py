#!/usr/bin/env python3
"""
Extrae la cartelera de Filmladder y la guarda en la base (cinema_movies,
cinema_showtimes).

OJO: Filmladder.nl solo cubre los PAÍSES BAJOS, así que este scraper sirve tal
cual únicamente para ciudades holandesas. Es un ejemplo de cómo alimentar las
dos tablas; para otro país hace falta otra fuente que escriba en el mismo
esquema. Las ciudades salen de CINEMA_CITIES (variable de entorno), no de una
lista escrita aquí.
"""

import os
import sys
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import execute_values

def load_env():
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

CITIES = [
    c.strip().lower().replace(" ", "-")
    for c in os.environ.get("CINEMA_CITIES", "").split(",")
    if c.strip()
]

def scrape_city(city):
    url = f"https://www.filmladder.nl/{city}/bioscopen"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"Error cargando {city}: {resp.status_code}")
        return []
        
    soup = BeautifulSoup(resp.text, 'html.parser')
    movies = []
    
    links = soup.find_all('a')
    for link in links:
        cls = link.get('class', [])
        if 'movie-link' in cls and 'text-link' in cls:
            title = link.get('title')
            movie_url = link.get('href')
            if movie_url and not movie_url.startswith('http'):
                movie_url = 'https://www.filmladder.nl' + movie_url
            
            poster_url = None
            prev = link.find_previous_sibling('a')
            if prev and 'with-trailer' in prev.get('class', []):
                img = prev.find('img')
                if img:
                    poster_url = img.get('data-src') or img.get('src')
            
            showtimes = []
            
            # The showtimes are inside the next sibling div.week-frame
            # But wait, the <a> is inside an <h4>!
            h4 = link.find_parent('h4')
            if h4:
                week_frame = h4.find_next_sibling('div', class_='week-frame')
                if week_frame:
                    for start_div in week_frame.find_all('div', itemprop='startDate'):
                        ticket_a = start_div.find('a', class_='ticket')
                        if ticket_a:
                            time_str = ticket_a.text.strip()
                            time_str = re.sub(r'[^0-9:]', '', time_str)
                            
                            ticket_url = ticket_a.get('href')
                            if ticket_url and not ticket_url.startswith('http'):
                                ticket_url = 'https://www.filmladder.nl' + ticket_url
                            
                            t_title = ticket_a.get('title', '')
                            match = re.search(r'in (.+?)\. Van', t_title)
                            cinema = match.group(1) if match else "Unknown"
                            
                            dt_str = start_div.get('content')
                            date_str = dt_str.split('T')[0] if dt_str else None
                            
                            if time_str and date_str:
                                showtimes.append({
                                    "time": time_str,
                                    "date": date_str,
                                    "cinema": cinema,
                                    "ticket_url": ticket_url
                                })
            
            if showtimes:
                movies.append({
                    "title": title,
                    "url": movie_url,
                    "poster_url": poster_url,
                    "showtimes": showtimes,
                    "city": city.replace('-', ' ').title()
                })
                
    return movies

def main():
    if not DB_URL:
        print("ERROR: DATABASE_URL no encontrada.")
        sys.exit(1)
        
    print("Iniciando scraping de Filmladder...")
    
    all_movies = {} # url -> movie_data
    
    for city in CITIES:
        print(f"Scrapeando {city}...")
        movies = scrape_city(city)
        for m in movies:
            key = m['title']
            if key not in all_movies:
                all_movies[key] = {
                    "title": m['title'],
                    "url": m['url'],
                    "poster_url": m['poster_url'],
                    "showtimes": []
                }
            for s in m['showtimes']:
                all_movies[key]['showtimes'].append({
                    "city": m['city'],
                    "cinema": s['cinema'],
                    "date": s['date'],
                    "time": s['time'],
                    "ticket_url": s['ticket_url']
                })
                
    print(f"Total películas únicas encontradas: {len(all_movies)}")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Eliminar las sesiones futuras para reemplazarlas
        cur.execute("DELETE FROM cinema_showtimes")
        
        for title, info in all_movies.items():
            # Insert movie or update poster_url
            cur.execute("""
                INSERT INTO cinema_movies (title, url, poster_url, created_at) 
                VALUES (%s, %s, %s, NOW()) 
                ON CONFLICT (title) DO UPDATE SET url = EXCLUDED.url, poster_url = EXCLUDED.poster_url
                RETURNING id
            """, (title, info["url"], info["poster_url"]))
            
            movie_id = cur.fetchone()[0]
            
            # Insert showtimes
            showtime_data = [
                (movie_id, s['cinema'], s['city'], s['time'], s['date'], s['ticket_url'])
                for s in info['showtimes']
            ]
            
            execute_values(
                cur,
                "INSERT INTO cinema_showtimes (movie_id, cinema_name, city, start_time, date, ticket_url) VALUES %s",
                showtime_data
            )
                
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
