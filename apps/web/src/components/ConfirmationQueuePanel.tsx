import { useEffect, useState } from "react";
import { getConfirmationQueue, type ConfirmationQueueItem } from "../lib/workspace";

type Props = {
  refreshKey?: number;
  title?: string;
};

/** Inbox da fila de confirmação (stub multi-canal — sem Gmail). */
export default function ConfirmationQueuePanel({
  refreshKey = 0,
  title = "Fila de confirmações",
}: Props) {
  const [items, setItems] = useState<ConfirmationQueueItem[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setItems(await getConfirmationQueue());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar fila");
      }
    })();
  }, [refreshKey]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{title}</h2>
      <p className="text-xs text-emerald-800/70">
        Mensagens enfileiradas para envio pelo canal preferido — sem Gmail/Google.
      </p>
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-emerald-800/70">Nenhuma confirmação na fila.</p>
      ) : (
        items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title || "Confirmação"}</div>
              <div className="text-xs text-emerald-800/70">
                {item.channel || "whatsapp"} · {item.status || "queued"}
                {item.created_at
                  ? ` · ${new Date(item.created_at).toLocaleString("pt-BR")}`
                  : ""}
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-emerald-900/80">
                {item.body}
              </p>
            </div>
            <button
              className="rounded-lg border px-3 py-1.5 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(item.body || "");
                setHint("Mensagem copiada para envio manual.");
              }}
            >
              Copiar
            </button>
          </div>
        ))
      )}
    </section>
  );
}
