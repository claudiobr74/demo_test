import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";
import { getDocuments, type DocItem } from "../lib/workspace";

export default function DocumentsPage() {
  const [items, setItems] = useState<DocItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = async () => {
    try {
      setItems(await getDocuments());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro em documentos");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Documentos</h1>
        <p className="mt-1 text-emerald-800/80">
          Modelos e exportação na API — sem Google Docs/Drive.
        </p>
      </header>
      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}
      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.id} className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
            <div className="font-medium">{d.title}</div>
            <div className="mb-3 text-xs text-emerald-800/70">
              {d.doc_type} · {d.status}
            </div>
            <p className="mb-3 line-clamp-3 text-sm whitespace-pre-wrap">{d.body}</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(d.body || "");
                  setHint("Texto copiado.");
                }}
              >
                Copiar
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  const exp = await apiJson<{ content: string; print_hint?: string }>(
                    `/api/v1/documents/${d.id}/export?format=html`,
                  );
                  await navigator.clipboard.writeText(exp.content);
                  setHint(exp.print_hint || "HTML copiado para impressão/PDF.");
                }}
              >
                Exportar HTML
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-emerald-800/70">
            Nenhum documento ainda. Gere a partir dos modelos pela API/Flutter hub se necessário.
          </p>
        )}
      </div>
    </div>
  );
}
