import { PosterSkeleton } from "@/components/ui/poster-skeleton";

export default function Loading() {
  return (
    <div className="px-3 sm:px-6 py-6">
      <div
        className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5"
        role="status"
        aria-label="Cargando…"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <PosterSkeleton key={i} className="rounded-md" />
        ))}
      </div>
    </div>
  );
}
