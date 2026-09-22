import { z } from "zod";

// ─── Constantes como tuplas para z.enum ──────────────────────────────────────

export const WATCH_FORMATS = [
  "cine", "streaming", "bluray", "dvd", "digital", "otro",
] as const;

export const MOVIE_STATUSES = [
  "vista", "pendiente", "en_progreso", "descartada",
] as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const MovieCreateSchema = z.object({
  // OMDb
  imdbId:        z.string().regex(/^tt\d+$/, "Formato IMDb ID inválido"),
  title:         z.string().min(1).max(500),
  originalTitle: z.string().max(500).nullish(),
  year:          z.number().int().min(1880).max(2100).nullish(),
  durationMin:   z.number().int().positive().nullish(),
  genres:        z.array(z.string()).default([]),
  directors:     z.array(z.string()).default([]),
  cast:          z.array(z.string()).default([]),
  plot:          z.string().nullish(),
  posterUrl:     z.string().nullish(),
  imdbRating:    z.number().min(0).max(10).nullish(),
  imdbVotes:     z.number().int().nonnegative().nullish(),
  country:       z.string().nullish(),
  language:      z.string().nullish(),
  rated:         z.string().nullish(),
  trailerKey:    z.string().max(200).nullish(),

  // Personal
  myRating:      z.number().min(0).max(10).nullish(),
  watchedAt:     z.string().nullish(),
  watchFormat:   z.enum(WATCH_FORMATS).nullish(),
  review:        z.string().nullish(),
  hasImdbReview: z.boolean().default(false),
  notes:         z.string().nullish(),
  status:        z.enum(MOVIE_STATUSES).default("pendiente"),
  importedFromImdb: z.boolean().default(false),
  collections:   z.array(z.string()).default([]),
});

export const MovieUpdateSchema = MovieCreateSchema.partial();

export type MovieCreateInput = z.infer<typeof MovieCreateSchema>;
export type MovieUpdateInput = z.infer<typeof MovieUpdateSchema>;
