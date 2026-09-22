"""Tests de la lógica pura del pipeline de importación (scripts/import_lib.py).

Ejecutar desde la raíz de la app:
    python3 -m unittest discover -s tests_py -p "test_*.py" -t .
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from import_lib import clean, parse_omdb  # noqa: E402


def omdb_response(**overrides):
    """Respuesta mínima válida de OMDb, sobreescribible por campo."""
    base = {
        "imdbID": "tt0133093",
        "Title": "The Matrix",
        "Year": "1999",
        "Runtime": "136 min",
        "Genre": "Action, Sci-Fi",
        "Director": "Lana Wachowski, Lilly Wachowski",
        "Actors": "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving, Joe Pantoliano, Marcus Chong",
        "Plot": "A computer hacker learns about the true nature of reality.",
        "Poster": "https://example.com/poster.jpg",
        "imdbRating": "8.7",
        "imdbVotes": "1,982,475",
        "Country": "United States, Australia",
        "Language": "English",
        "Rated": "R",
    }
    base.update(overrides)
    return base


class TestClean(unittest.TestCase):
    def test_none_y_vacios(self):
        self.assertIsNone(clean(None))
        self.assertIsNone(clean(""))
        self.assertIsNone(clean("N/A"))

    def test_valores_validos(self):
        self.assertEqual(clean("USA"), "USA")
        self.assertEqual(clean("0"), "0")


class TestParseOmdb(unittest.TestCase):
    def test_mapeo_completo(self):
        m = parse_omdb(omdb_response(), 8.0)
        self.assertEqual(m["imdb_id"], "tt0133093")
        self.assertEqual(m["title"], "The Matrix")
        self.assertEqual(m["year"], 1999)
        self.assertEqual(m["duration_min"], 136)
        self.assertEqual(json.loads(m["genres"]), ["Action", "Sci-Fi"])
        self.assertEqual(json.loads(m["directors"]), ["Lana Wachowski", "Lilly Wachowski"])
        self.assertEqual(m["imdb_rating"], 8.7)
        self.assertEqual(m["imdb_votes"], 1982475)
        self.assertEqual(m["my_rating"], 8.0)
        self.assertEqual(m["status"], "vista")
        self.assertFalse(m["imported_from_imdb"])
        self.assertFalse(m["has_imdb_review"])

    def test_cast_corta_a_5_y_descarta_n_a(self):
        m = parse_omdb(omdb_response(Actors="A, B, N/A, C, D, E, F"), 5.0)
        self.assertEqual(json.loads(m["cast"]), ["A", "B", "C", "D", "E"])

    def test_vacios_y_n_a_quedan_en_none(self):
        m = parse_omdb(omdb_response(Plot="N/A", Poster="N/A", Country="N/A",
                                     Language="N/A", Rated="N/A", imdbRating="N/A",
                                     imdbVotes="N/A"), 5.0)
        for k in ("plot", "poster_url", "country", "language", "rated",
                  "imdb_rating", "imdb_votes"):
            self.assertIsNone(m[k], f"{k} debería ser None")

    def test_year_no_numerico_queda_en_none(self):
        m = parse_omdb(omdb_response(Year="1999–2003"), 5.0)
        self.assertIsNone(m["year"])

    def test_runtime_sin_digitos_queda_en_none(self):
        m = parse_omdb(omdb_response(Runtime="N/A"), 5.0)
        self.assertIsNone(m["duration_min"])

    def test_votes_mal_formados_no_rompen(self):
        m = parse_omdb(omdb_response(imdbVotes="abc"), 5.0)
        self.assertIsNone(m["imdb_votes"])

    def test_listas_vacias_cuando_no_hay_dato(self):
        m = parse_omdb(omdb_response(Genre="N/A", Director="", Actors="N/A"), 5.0)
        self.assertEqual(json.loads(m["genres"]), [])
        self.assertEqual(json.loads(m["directors"]), [])
        self.assertEqual(json.loads(m["cast"]), [])


if __name__ == "__main__":
    unittest.main()
