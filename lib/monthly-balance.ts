export interface JournalEntry {
  id: number; title: string; status: string; watchedAt: Date | string | null;
  myRating: number | null; durationMin: number | null;
}
export function monthlyBalance<T extends JournalEntry>(entries: T[], month: string) {
  const movies = entries.filter((entry) => entry.status === "vista" && entry.watchedAt && new Date(entry.watchedAt).toISOString().slice(0, 7) === month);
  const rated = movies.filter((entry) => entry.myRating !== null);
  const durations = movies.filter((entry) => entry.durationMin !== null);
  const average = rated.length ? rated.reduce((sum, entry) => sum + entry.myRating!, 0) / rated.length : null;
  const best = rated.length ? Math.max(...rated.map((entry) => entry.myRating!)) : null;
  return { movies, average, ratedCount: rated.length,
    minutes: durations.reduce((sum, entry) => sum + entry.durationMin!, 0), durationsCount: durations.length,
    favorites: rated.filter((entry) => entry.myRating === best),
    undated: entries.filter((entry) => entry.status === "vista" && !entry.watchedAt).length };
}
