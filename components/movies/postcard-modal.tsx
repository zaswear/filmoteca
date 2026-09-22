"use client";

import { useState, useRef } from "react";
import NextImage from "next/image"; // aliased: el export a canvas usa `new Image()` (DOM)
import { X, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { useDialog } from "@/lib/use-dialog";

import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { t } from "@/lib/i18n";
interface PostcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: {
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    directors?: string | string[] | null;
    myRating?: number | null;
    review?: string | null;
    posterUrl?: string | null;
    durationMin?: number | null;
  };
}

export function PostcardModal({ isOpen, onClose, movie }: PostcardModalProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // enabled: el componente se renderiza también cerrado (return null debajo).
  const dialogRef = useDialog<HTMLDivElement>(onClose, { enabled: isOpen });

  if (!isOpen) return null;

  // Formatear directores
  let directorsStr = "";
  if (movie.directors) {
    try {
      const parsed = typeof movie.directors === "string" ? JSON.parse(movie.directors) : movie.directors;
      directorsStr = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
    } catch {
      directorsStr = String(movie.directors);
    }
  }

  // Limpiar HTML de la crítica
  const cleanReview = movie.review ? movie.review.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

  const handleDownload = async () => {
    setExporting(true);
    setError(null);

    const canvas = canvasRef.current;
    if (!canvas) {
      setError(t("postal.errorLienzo"));
      setExporting(false);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError(t("postal.errorContexto"));
      setExporting(false);
      return;
    }

    try {
      // 1. Fondo de postal física (color crema/hueso texturizado suave)
      ctx.fillStyle = "#fbf9f4";
      ctx.fillRect(0, 0, 1200, 800);

      // Dibujar un borde elegante fino
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 1140, 740);

      // Dibujar línea separadora vertical punteada clásica de postal
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(500, 60);
      ctx.lineTo(500, 740);
      ctx.stroke();
      ctx.setLineDash([]); // Resetear line dash

      // 2. Cargar y dibujar el póster a la izquierda
      if (movie.posterUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(t("postal.errorPoster")));
          img.src = movie.posterUrl!;
        });

        // Dibujar sombra suave detrás del póster
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(75, 105, 360, 540);

        // Dibujar el póster
        ctx.drawImage(img, 70, 100, 360, 540);
        
        // Borde blanco estilo foto polaroid o cuadro
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 8;
        ctx.strokeRect(70, 100, 360, 540);
      } else {
        // Marcador de posición sin póster
        ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
        ctx.fillRect(70, 100, 360, 540);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 2;
        ctx.strokeRect(70, 100, 360, 540);

        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.font = "italic 24px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(t("form.sinPoster"), 250, 370);
      }

      // 3. Pintar información textual a la derecha
      ctx.fillStyle = "#1e1e1e"; // Charcoal ink
      ctx.textAlign = "left";

      // Título de la película (Serif elegante)
      ctx.font = "italic bold 40px Georgia, serif";
      const titleY = 130;
      // Dibujar texto del título y envolver si es muy largo
      wrapCanvasText(ctx, movie.title, 540, titleY, 580, 50, 2);

      // Línea de metadatos (Año, Director, Duración)
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.font = "16px 'Space Mono', monospace";
      let meta = "";
      if (movie.year) meta += `${movie.year}  |  `;
      if (movie.durationMin) meta += `${movie.durationMin} min  |  `;
      if (directorsStr) meta += `Dir: ${directorsStr}`;
      if (meta.endsWith("  |  ")) meta = meta.slice(0, -5);
      
      ctx.fillText(meta, 540, titleY + 80);

      // 4. Mi Valoración (diseño de recuadro elegante)
      if (movie.myRating != null) {
        ctx.fillStyle = "#d97706"; // Ámbar
        ctx.font = "bold 22px 'Space Mono', monospace";
        ctx.fillText(`★ ${movie.myRating.toFixed(1)} / 10`, 540, titleY + 130);
      }

      // 5. Crítica ( Georgia Serif )
      ctx.fillStyle = "#2d2d2d";
      ctx.font = "italic 20px Georgia, serif";
      const reviewStartY = titleY + 190;
      
      if (cleanReview) {
        wrapCanvasText(ctx, `"${cleanReview}"`, 540, reviewStartY, 580, 32, 11);
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillText(t("postal.sinCritica"), 540, reviewStartY);
      }

      // 6. Sello Postal Retro (arriba a la derecha)
      drawStamp(ctx, 1050, 60);

      // 7. Pie de firma de la postal
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.font = "italic 16px Georgia, serif";
      ctx.fillText(`${APP_NAME} — ${APP_TAGLINE}`, 540, 720);

      // Exportar y descargar
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `postcard-${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      setError(t("postal.errorExportar"));
    } finally {
      setExporting(false);
    }
  };

  // Helper para envolver texto
  function wrapCanvasText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
  ) {
    const words = text.split(" ");
    let line = "";
    let linesCount = 0;
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        if (linesCount + 1 >= maxLines) {
          context.fillText(line.trim() + "...", x, currentY);
          return;
        }
        context.fillText(line, x, currentY);
        line = words[n] + " ";
        currentY += lineHeight;
        linesCount++;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
  }

  // Dibujar un sello postal retro ficticio
  function drawStamp(context: CanvasRenderingContext2D, x: number, y: number) {
    const w = 80;
    const h = 100;

    // Cuerpo del sello
    context.fillStyle = "#eae3d2";
    context.fillRect(x, y, w, h);
    context.strokeStyle = "#8c826e";
    context.lineWidth = 1;
    context.strokeRect(x, y, w, h);

    // Bordes perforados del sello
    context.fillStyle = "#fbf9f4"; // Color del fondo de la postal
    const radius = 4;
    const gap = 12;

    // Perforar horizontal (arriba y abajo)
    for (let px = x + 8; px < x + w; px += gap) {
      context.beginPath();
      context.arc(px, y, radius, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(px, y + h, radius, 0, Math.PI * 2);
      context.fill();
    }

    // Perforar vertical (izquierda y derecha)
    for (let py = y + 8; py < y + h; py += gap) {
      context.beginPath();
      context.arc(x, py, radius, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(x + w, py, radius, 0, Math.PI * 2);
      context.fill();
    }

    // Dibujo del matasellos (líneas curvas)
    context.strokeStyle = "rgba(74, 58, 48, 0.4)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x - 10, y + h / 2, 40, -Math.PI / 4, Math.PI / 4);
    context.stroke();

    context.beginPath();
    context.arc(x - 20, y + h / 2, 40, -Math.PI / 4, Math.PI / 4);
    context.stroke();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--backdrop) p-4">
      {/* Canvas invisible usado para la exportación */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        className="hidden"
      />

      {/* Contenedor del Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="postcard-title"
        className="relative w-full max-w-4xl bg-(--surface) border border-(--border) rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
          <h3 id="postcard-title" className="font-display font-medium text-lg italic text-text flex items-center gap-2">
            <ImageIcon size={18} className="text-(--accent)" aria-hidden="true" />{t("postal.exportar")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("comun.cerrar")}
            className="tap-target -mr-2 rounded text-text-faint hover:text-text transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Vista Previa Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-bg/50">
          <p className="text-xs text-text-faint font-mono mb-4 text-center">
            {t("postal.vistaPrevia")}
          </p>

          {/* Postal Mockup HTML */}
          <div className="w-full max-w-2xl aspect-3/2 bg-[#fbf9f4] border border-black/10 rounded shadow-md p-6 flex text-[#1e1e1e] relative select-none">
            {/* Sello */}
            <div className="absolute top-4 right-4 w-12 h-16 border border-[#8c826e] bg-[#eae3d2] rounded-[1px] flex flex-col items-center justify-center p-1">
              <span className="text-[6px] text-[#8c826e] font-mono tracking-tighter">POSTAGE</span>
              <div className="w-6 h-6 rounded-full border border-dashed border-[#8c826e]/40 mt-1 flex items-center justify-center">
                <span className="text-[8px] text-[#8c826e]/80">★</span>
              </div>
            </div>

            {/* Parte Izquierda: Póster */}
            <div className="w-[38%] shrink-0 flex items-center justify-center pr-4 border-r border-dashed border-black/10">
              {movie.posterUrl ? (
                <div className="relative w-full aspect-2/3 rounded overflow-hidden shadow-xs border-2 border-white bg-white">
                  <NextImage src={movie.posterUrl} alt={movie.title} width={400} height={600} sizes="(max-width: 640px) 90vw, 400px" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-2/3 bg-black/5 border border-black/10 rounded flex items-center justify-center text-xs italic text-black/40">{t("form.sinPoster")}</div>
              )}
            </div>

            {/* Parte Derecha: Detalles */}
            <div className="flex-1 pl-6 flex flex-col justify-between pt-2">
              <div className="space-y-3">
                <h4 className="font-serif italic font-bold text-xl leading-snug line-clamp-2">
                  {movie.title}
                </h4>

                <p className="font-mono text-[9px] text-black/50 leading-relaxed uppercase tracking-wider">
                  {movie.year ? `${movie.year}` : ""}
                  {movie.durationMin ? `  •  ${movie.durationMin} MIN` : ""}
                  {directorsStr ? `  •  DIR: ${directorsStr}` : ""}
                </p>

                {movie.myRating != null && (
                  <p className="font-mono font-bold text-xs text-[#d97706]">
                    ★ {movie.myRating.toFixed(1)} / 10
                  </p>
                )}

                <p className="font-serif italic text-xs text-black/80 leading-relaxed line-clamp-6 pr-10">
                  {cleanReview ? `"${cleanReview}"` : t("postal.sinCritica")}
                </p>
              </div>

              <div className="text-[9px] font-serif italic text-black/40 border-t border-black/5 pt-2 mt-2">
                {APP_NAME} — {APP_TAGLINE}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-(--error) mt-4 font-mono">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-(--border)">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-mid hover:text-text rounded-[6px] hover:bg-(--surface-hi) transition-colors"
          >{t("comun.cerrar")}</button>
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generando...
              </>
            ) : (
              <>
                <Download size={14} /> Descargar Imagen (PNG)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
