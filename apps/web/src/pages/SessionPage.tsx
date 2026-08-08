import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";

type Props = { sessionId: string; onClose: () => void };

export default function SessionPage({ sessionId, onClose }: Props) {
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [focus, setFocus] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<Record<string, unknown>>(`/api/v1/sessions/${sessionId}`);
        setSession(data);
        setFocus(String(data.focus || ""));
        setObservations(String(data.observations || ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao abrir sessão");
      }
    })();
  }, [sessionId]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-700">{error}</p>
        <button className="mt-3 rounded-lg border px-3 py-2" onClick={onClose}>
          Voltar
        </button>
      </div>
    );
  }

  if (!session) return <p className="p-6">Abrindo sessão…</p>;

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-emerald-950">Sessão ativa</h1>
          <p className="text-emerald-800/80">{String(session.patient_display_name || "")}</p>
        </div>
        <button className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>
          Fechar
        </button>
      </header>

      <label className="block text-sm">
        Foco
        <textarea
          className="mt-1 w-full rounded-xl border px-3 py-2"
          rows={3}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Observações
        <textarea
          className="mt-1 w-full rounded-xl border px-3 py-2"
          rows={6}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
        />
      </label>

      {saved && <p className="text-sm text-emerald-800">{saved}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-white"
          onClick={async () => {
            await apiJson(`/api/v1/sessions/${sessionId}/autosave`, {
              method: "PATCH",
              body: JSON.stringify({
                focus,
                observations,
                version: session.version,
              }),
            });
            setSaved("Rascunho salvo.");
          }}
        >
          Salvar rascunho
        </button>
        <button
          className="rounded-xl border px-4 py-2"
          onClick={async () => {
            await apiJson(`/api/v1/sessions/${sessionId}/close`, {
              method: "POST",
              body: JSON.stringify({ finalize_record: true }),
            });
            onClose();
          }}
        >
          Encerrar e registrar
        </button>
      </div>
    </div>
  );
}
