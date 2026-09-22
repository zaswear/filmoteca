import { ShoppingBag } from "lucide-react";
import { db } from "@/lib/db";
import { BlurayPurchaseList } from "@/components/movies/bluray-purchase-list";

import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export const metadata = { title: t("compras.titulo") };

interface MubisItem {
  title: string;
  link: string;
  pubDate: string;
  rssThumbnail: string | null;
}

function parseMubisRss(xmlText: string): MubisItem[] {
  const items: MubisItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                       itemContent.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : "";

    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";

    const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/i);
    let rssThumbnail: string | null = null;

    if (descMatch) {
      const descContent = descMatch[1];
      const imgRegex = /src=(?:"|'|&quot;)([^"'\s&]+)(?:"|'|&quot;)/i;
      const imgMatch = descContent.match(imgRegex);
      if (imgMatch) {
        let src = imgMatch[1];
        if (src.startsWith("/")) {
          src = `https://www.mubis.es${src}`;
        }
        rssThumbnail = src;
      }
    }

    if (title) {
      items.push({
        title,
        link,
        pubDate,
        rssThumbnail,
      });
    }
  }

  return items;
}

export default async function ComprasBlurayPage() {
  let feedItems: MubisItem[] = [];
  try {
    const res = await fetch("https://www.mubis.es/mubis.xml", {
      next: { revalidate: 3600 }, // cached for 1 hour
    });
    if (res.ok) {
      const text = await res.text();
      feedItems = parseMubisRss(text);
    }
  } catch (error) {
    console.error("Error al obtener el RSS de Mubis:", error);
  }

  // Load saved shopping list items from the DB
  const savedItems = await db.blurayPurchase.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto space-y-8">
      {/* Cabecera */}
      <div className="border-b border-(--border) pb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-[38px] italic leading-none text-text flex items-center gap-3">{t("compras.encabezado")}<ShoppingBag size={28} className="text-(--accent) animate-pulse" />
          </h1>
          <p className="text-xs text-text-faint font-mono mt-2 uppercase tracking-widest">{t("compras.subtitulo")}</p>
        </div>
      </div>

      {/* Listado de compras */}
      <BlurayPurchaseList initialFeedItems={feedItems} initialSavedItems={savedItems} />
    </div>
  );
}
