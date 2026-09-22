import { cn } from "@/lib/utils";

/**
 * Hueco de póster mientras llega la imagen: mismo ratio 2/3 que el cartel
 * real para que el montaje no salte al sustituirlo. El brillo del shimmer
 * barre el hueco con translateX (transform) y el reduced-motion global lo
 * frena a un parpadeo mínimo.
 */
export function PosterSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("poster-skeleton aspect-2/3", className)}
    />
  );
}
