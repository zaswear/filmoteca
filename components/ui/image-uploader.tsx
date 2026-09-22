"use client";

import { useRef, useState, useCallback } from "react";
import { uploadImage } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import type { Image as DBImage } from "@/lib/generated/prisma";

import { t } from "@/lib/i18n";
interface Props {
  movieId:  number;
  type?:    "gallery" | "poster_alt";
  onUpload: (image: DBImage) => void;
  className?: string;
}

interface FileState {
  id:       string;
  file:     File;
  preview:  string;
  progress: number;
  status:   "pending" | "uploading" | "done" | "error";
  error?:   string;
}

export function ImageUploader({ movieId, type = "gallery", onUpload, className }: Props) {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles]   = useState<FileState[]>([]);

  const updateFile = useCallback((id: string, patch: Partial<FileState>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;

    const id: string    = crypto.randomUUID();
    const preview: string = URL.createObjectURL(file);
    setFiles((prev) => [...prev, { id, file, preview, progress: 0, status: "uploading" }]);

    try {
      // 1. Sube a Cloudinary
      const result = await uploadImage(file, (pct) =>
        updateFile(id, { progress: pct })
      );

      // 2. Guarda en DB
      const res = await fetch("/api/images", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          movieId,
          publicId: result.public_id,
          url:      result.secure_url,
          width:    result.width,
          height:   result.height,
          type,
        }),
      });

      if (!res.ok) throw new Error(t("subir.errorBd"));
      const dbImage: DBImage = await res.json();

      updateFile(id, { status: "done", progress: 100 });
      onUpload(dbImage);
    } catch (err) {
      updateFile(id, {
        status: "error",
        error:  err instanceof Error ? err.message : t("subir.error"),
      });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(processFile);
    e.target.value = "";
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "border-2 border-dashed rounded-md px-6 py-8 text-center cursor-pointer transition-colors duration-150 select-none",
          dragging
            ? "border-(--border-focus) bg-(--accent-dim)"
            : "border-(--border) hover:border-(--border-hi)"
        )}
      >
        <p className="text-sm text-text-faint">
          Arrastra imágenes aquí o{" "}
          <span className="text-(--accent) font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-text-faint mt-1">{t("subir.formatos")}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onSelect}
      />

      {/* Preview de archivos en progreso */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              {/* Miniatura. <img> a propósito y no next/image: f.preview es un
                  blob: URL de un archivo que todavía está en el cliente y no
                  existe en ningún origen remoto. El optimizador no puede
                  procesarlo — no hay nada que pedir al servidor. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.preview}
                alt={f.file.name}
                className="w-12 h-12 object-cover rounded shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-mid truncate">{f.file.name}</p>

                {f.status === "uploading" && (
                  <div className="mt-1 h-1 bg-(--surface-hi) rounded-full overflow-hidden">
                    <div
                      /* transition-width y no transition-all: width es
                         propiedad de layout, y con `all` el navegador vigila
                         además todo lo demás. Aquí solo cambia el ancho. */
                      className="h-full bg-(--accent) transition-[width] duration-150"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}

                {f.status === "done" && (
                  <p className="text-xs text-(--success) mt-0.5">{t("subir.ok")}</p>
                )}

                {f.status === "error" && (
                  <p className="text-xs text-(--error) mt-0.5">{f.error}</p>
                )}
              </div>

              {f.status === "uploading" && (
                <span className="text-xs text-text-faint font-mono shrink-0">
                  {f.progress}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
