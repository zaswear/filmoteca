"""Lógica pura del pipeline de importación (sin I/O ni red).

Extraída de import_justwatch_csv.py para poder testearla con unittest:
mapea la respuesta de OMDb al dict que se inserta en la tabla `movies`.
"""

import json
import re


def clean(v):
    return None if not v or v == "N/A" else v


def parse_omdb(d: dict, my_rating: float) -> dict:
    def arr(v):
        return json.dumps([x.strip() for x in v.split(",") if x.strip()] if clean(v) else [])

    votes = None
    if clean(d.get("imdbVotes")):
        try:
            votes = int(d["imdbVotes"].replace(",", ""))
        except ValueError:
            pass

    return {
        "imdb_id":          d["imdbID"],
        "title":            d["Title"],
        "original_title":   None,
        "year":             int(d["Year"]) if d.get("Year", "N/A").isdigit() else None,
        "duration_min":     int(re.sub(r"\D", "", d.get("Runtime", ""))) if re.sub(r"\D", "", d.get("Runtime", "")) else None,
        "genres":           arr(d.get("Genre", "")),
        "directors":        arr(d.get("Director", "")),
        "cast":             json.dumps([a.strip() for a in d.get("Actors", "").split(",") if a.strip() and a.strip() != "N/A"][:5]),
        "plot":             clean(d.get("Plot")),
        "poster_url":       clean(d.get("Poster")),
        "imdb_rating":      float(d["imdbRating"]) if clean(d.get("imdbRating")) else None,
        "imdb_votes":       votes,
        "country":          clean(d.get("Country")),
        "language":         clean(d.get("Language")),
        "rated":            clean(d.get("Rated")),
        "my_rating":        my_rating,
        "status":           "vista",
        "imported_from_imdb": False,
        "has_imdb_review":  False,
    }
