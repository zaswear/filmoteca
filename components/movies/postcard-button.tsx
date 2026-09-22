"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { PostcardModal } from "./postcard-modal";

interface PostcardButtonProps {
  movie: {
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    directors?: string[] | string | null;
    myRating?: number | null;
    review?: string | null;
    posterUrl?: string | null;
    durationMin?: number | null;
  };
}

export function PostcardButton({ movie }: PostcardButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="tap-target gap-1.5 px-2 sm:px-3 text-sm text-text-mid hover:text-text hover:bg-(--surface-hi) transition-colors"
        title="Crear una postal de esta película"
      >
        <ImageIcon size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Postal</span>
        <span className="sr-only sm:hidden">Crear postal</span>
      </button>
      <PostcardModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        movie={movie}
      />
    </>
  );
}
