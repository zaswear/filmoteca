import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[80px] leading-none text-text-faint font-bold">404</p>
      <h1 className="font-display font-semibold italic text-[32px] text-text mt-4 mb-2">
        Página no encontrada
      </h1>
      <p className="text-sm text-text-faint mb-8">
        La página que buscas no existe o fue eliminada.
      </p>
      <Link
        href="/peliculas"
        className="px-5 py-2 bg-(--accent) hover:bg-(--accent-hover) text-bg text-sm font-medium rounded-[6px] transition-colors"
      >
        Ir a mis películas
      </Link>
    </div>
  );
}
