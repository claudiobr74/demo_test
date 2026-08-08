import { useEffect, useState } from "react";
import {
  getConfirmationQueue,
  markConfirmationStatus,
  type ConfirmationQueueItem,
} from "../lib/workspace";

type Props = {
  refreshKey?: number;
  title?: string;
};

const CLOSED = new Set(["dismissed", "patient_confirmed"]);

/** Inbox operacional da fila de confirmação — cópia/envio manual (sem Gmail). */
export default function ConfirmationQueuePanel({
  refreshKey = 0,
  title = "Fila de confirmações",
}: Props) {
  const [items, setItems] = useState<ConfirmationQueueItem[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setItems(await getConfirmationQueue());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar fila");
    }
  };

  useEffect(() => {
    void load();
  }, [refreshKey]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;

  const open = items.filter((i) => !CLOSED.has(String(i.status || "")));
  const shown = (open.length ? open : items).slice(0, 8);

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{title}</h2>
      <p className="text-xs text-emerald-800/70">
        Fluxo real: copiar → enviar no WhatsApp/SMS → marcar enviado → paciente confirmou. Sem
        Gmail/Google.
      </p>
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}
      {shown.length === 0 ? (
        <p className="text-sm text-emerald-800/70">Nenhuma confirmação na fila.</p>
      ) : (
        shown.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title || "Confirmação"}</div>
              <div className="text-xs text-emerald-800/70">
                {item.channel || "whatsapp"} · {item.status || "queued"}
                {item.delivery ? ` · ${item.delivery}` : ""}
                {item.created_at
                  ? ` · ${new Date(item.created_at).toLocaleString("pt-BR")}`
                  : ""}
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-emerald-900/80">
                {item.body}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(item.body || "");
                  await markConfirmationStatus(item.id, "copied");
                  setHint("Mensagem copiada. Cole no WhatsApp/SMS e marque como enviada.");
                  await load();
                }}
              >
                Copiar
              </button>
              <button
                className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs text-white"
                onClick={async () => {
                  await markConfirmationStatus(item.id, "sent");
                  setHint("Marcado como enviado. Quando a paciente responder, confirme abaixo.");
                  await load();
                }}
              >
                Marcar enviado
              </button>
              {(item.status === "sent" || item.status === "copied" || item.appointment_id) && (
                <button
                  className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs text-emerald-900"
                  onClick={async () => {
                    await markConfirmationStatus(item.id, "patient_confirmed");
                    setHint("Atendimento marcado como confirmado pela paciente.");
                    await load();
                  }}
                >
                  Paciente confirmou
                </button>
              )}
              <button
                className="rounded-lg border px-3 py-1.5 text-xs text-emerald-800/80"
                onClick={async () => {
                  await markConfirmationStatus(item.id, "dismissed");
                  setHint("Item dispensado da fila ativa.");
                  await load();
                }}
              >
                Dispensar
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
