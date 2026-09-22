"use client";
export function DraftNotice({ pending, message, restore, discard }: { pending: boolean; message: string; restore: () => void; discard: () => void }) {
  return <div className="space-y-3 mb-4">
    {pending && <div role="status" className="p-4 border border-border rounded space-y-2">
      <p>Hay un borrador sin guardar. Restaurarlo sustituye los campos de este formulario.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={restore} className="min-h-11 px-3 rounded bg-accent text-bg">Restaurar borrador</button>
        <button type="button" onClick={discard} className="min-h-11 px-3 rounded border border-border">Descartar borrador</button>
      </div>
    </div>}
    {message && <p role="status" className="text-sm text-text-mid">{message}</p>}
  </div>;
}
