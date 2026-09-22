"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { MarkWatchedModal } from "./mark-watched-modal";
import type { MovieParsed } from "@/lib/types";

import { t } from "@/lib/i18n";
export function MarkWatchedButton({ movie }: { movie: MovieParsed }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("marcar.boton")}
        className="tap-target gap-1.5 px-2 sm:px-3 text-sm text-text-mid hover:text-text hover:bg-(--surface-hi) transition-colors"
      >
        <Check size={17} aria-hidden="true" />
        <span className="hidden sm:inline">{t("marcar.boton")}</span>
        <span className="sr-only sm:hidden">{t("marcar.boton")}</span>
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
