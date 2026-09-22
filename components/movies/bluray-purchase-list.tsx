"use client";

import { useState } from "react";
import Image from "next/image";
import { ShoppingBag, Plus, Trash2, Loader2, ExternalLink, Calendar } from "lucide-react";

import { DATE_LOCALE, t } from "@/lib/i18n";
interface MubisItem {
  title: string;
  link: string;
  pubDate: string;
  rssThumbnail: string | null;
}

interface BlurayPurchase {
  id: number;
  title: string;
  posterUrl: string | null;
  link: string | null;
  createdAt: Date | string;
}

interface BlurayPurchaseListProps {
  initialFeedItems: MubisItem[];
  initialSavedItems: BlurayPurchase[];
}

export function BlurayPurchaseList({
  initialFeedItems,
  initialSavedItems,
}: BlurayPurchaseListProps) {
  const [feedItems] = useState<MubisItem[]>(initialFeedItems);
  const [savedItems, setSavedItems] = useState<BlurayPurchase[]>(initialSavedItems);
  const [activeTab, setActiveTab] = useState<"novedades" | "lista">("novedades");
  const [addingLink, setAddingLink] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(item: MubisItem) {
    setAddingLink(item.link);
    setError(null);
    try {
      const res = await fetch("/api/compras-bluray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          link: item.link,
          rssThumbnail: item.rssThumbnail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("bluray.errorAnadir"));
      }

      const newItem = await res.json();
      setSavedItems((prev) => [newItem, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("bluray.errorGuardar"));
    } finally {
      setAddingLink(null);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/compras-bluray?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("bluray.errorEliminar"));
      }

      setSavedItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("bluray.errorEliminarPeli"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 text-xs bg-(--error-dim) border border-(--error) text-(--error) rounded-md">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-(--border) gap-6 mb-6">
        <button
          onClick={() => setActiveTab("novedades")}
          className={`pb-3 text-sm font-semibold tracking-wide uppercase border-b-2 transition-colors relative ${
            activeTab === "novedades"
              ? "border-(--accent) text-text"
              : "border-transparent text-text-faint hover:text-text-mid"
          }`}
        >
          {t("bluray.novedades")} ({feedItems.length})
        </button>
        <button
          onClick={() => setActiveTab("lista")}
          className={`pb-3 text-sm font-semibold tracking-wide uppercase border-b-2 transition-colors relative ${
            activeTab === "lista"
              ? "border-(--accent) text-text"
              : "border-transparent text-text-faint hover:text-text-mid"
          }`}
        >
          Mi Lista de Compras ({savedItems.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "novedades" ? (
        feedItems.length === 0 ? (
          <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-xl">
            <ShoppingBag size={32} className="mx-auto text-text-faint mb-3 opacity-60 animate-pulse" />
            <p className="text-text-mid text-sm font-medium">{t("bluray.sinNovedades")}</p>
            <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">{t("bluray.errorMubis")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {feedItems.map((item) => {
              const isSaved = savedItems.some((s) => s.link === item.link);
              const isAdding = addingLink === item.link;

              return (
                <div
                  key={item.link}
                  className="flex gap-5 p-5 rounded-xl border border-(--border) bg-(--surface) shadow-(--shadow-card) hover:border-(--border-hi) hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow,border-color] duration-300"
                >
                  {/* Póster */}
                  <div className="w-28 sm:w-32 aspect-2/3 relative rounded-lg overflow-hidden bg-bg/50 border border-(--border) shadow-(--shadow-poster) shrink-0">
                    {item.rssThumbnail ? (
                      <Image
                        src={item.rssThumbnail}
                        alt={item.title}
                        width={200}
                        height={300}
                        sizes="128px"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-hi text-text-faint">
                        <ShoppingBag size={24} className="opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-text-faint uppercase tracking-wider block">
                        {item.pubDate
                          ? new Date(item.pubDate).toLocaleDateString(DATE_LOCALE, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                      <h3
                        className="font-display font-semibold italic text-lg text-text leading-snug mt-1 line-clamp-3"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-(--border)">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-text-mid hover:text-text transition-colors"
                      >{t("bluray.verMubis")}<ExternalLink size={10} />
                      </a>

                      {isSaved ? (
                        <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded">{t("bluray.enLista")}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => handleAdd(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-(--accent) hover:bg-(--accent-hover) text-bg rounded transition-colors"
                        >
                          {isAdding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <>
                              <Plus size={12} />{t("bluray.anadir")}</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : savedItems.length === 0 ? (
        <div className="text-center py-20 bg-(--surface) border border-(--border) rounded-xl">
          <ShoppingBag size={32} className="mx-auto text-text-faint mb-3 opacity-60" />
          <p className="text-text-mid text-sm font-medium">{t("bluray.listaVacia")}</p>
          <p className="text-xs text-text-faint mt-1 px-4 max-w-sm mx-auto">
            {t("bluray.listaVaciaAyuda")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {savedItems.map((item) => {
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col bg-(--surface) border border-(--border) rounded-xl overflow-hidden shadow-xs hover:border-text-mid/30 transition-colors duration-200"
              >
                {/* Poster Container */}
                <div className="aspect-2/3 w-full bg-bg relative overflow-hidden shrink-0">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      width={400}
                      height={600}
                      sizes="(max-width: 640px) 45vw, 220px"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center italic text-text-faint bg-surface-hi">
                      <ShoppingBag size={32} className="mb-2 text-text-faint/30" />
                      <span className="text-[10px] font-medium leading-tight">{item.title}</span>
                    </div>
                  )}

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(item.id)}
                      className="p-2.5 rounded-full bg-(--error) hover:bg-error/80 text-white shadow-sm transition-[transform,background-color] duration-150 transform scale-90 group-hover:scale-100"
                      title={t("bluray.eliminar")}
                    >
                      {isDeleting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full bg-surface hover:bg-border text-text shadow-sm transition-[transform,background-color] duration-150 transform scale-90 group-hover:scale-100"
                        title={t("bluray.verArticulo")}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Title & Info */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <h4
                    className="font-display font-medium text-sm text-text leading-snug line-clamp-2"
                    title={item.title}
                  >
                    {item.title}
                  </h4>

                  {item.createdAt && (
                    <div className="flex items-center gap-1 text-[10px] text-text-faint font-mono mt-2 pt-2 border-t border-(--border)">
                      <Calendar size={10} />
                      <span>
                        {new Date(item.createdAt).toLocaleDateString(DATE_LOCALE)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
