/**
 * Versión serializable de Movie para pasar de server components a client.
 * Las Date se convierten a ISO string (Next.js serializa automáticamente,
 * pero TypeScript necesita el tipo correcto).
 */
export interface MovieItem {
  id:              number;
  imdbId:          string;
  title:           string;
  originalTitle:   string | null;
  year:            number | null;
  durationMin:     number | null;
  genres:          string[];
  directors:       string[];
  cast:            string[];
  posterUrl:       string | null;
  imdbRating:      number | null;
  imdbVotes:       number | null;
  myRating:        number | null;
  watchedAt:       string | null;  // ISO string
  watchFormat:     string | null;
  status:          string;
  hasImdbReview:   boolean;
  importedFromImdb: boolean;
  createdAt:       string;         // ISO string
}
