"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { MarkWatchedModal } from "./mark-watched-modal";
import type { MovieParsed } from "@/lib/types";

export function MarkWatchedButton({ movie }: { movie: MovieParsed }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Marcar como vista"
        className="tap-target gap-1.5 px-2 sm:px-3 text-sm text-text-mid hover:text-text hover:bg-(--surface-hi) transition-colors"
      >
        <Check size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Marcar como vista</span>
        <span className="sr-only sm:hidden">Marcar como vista</span>
      </button>
      {open && (
        <MarkWatchedModal
          movie={movie}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
