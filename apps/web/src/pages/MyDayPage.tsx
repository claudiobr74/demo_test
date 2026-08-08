import { useEffect, useState } from "react";
import { completeTask, getToday, setAppointmentStatus, startSession } from "../lib/workspace";

type Props = { onOpenSession: (sessionId: string) => void };

export default function MyDayPage({ onOpenSession }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getToday());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar Meu Dia");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="text-emerald-800/70">Carregando o seu dia…</p>;
  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-700">{error}</p>
        <button className="rounded-lg border px-3 py-2" onClick={() => void load()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const next = data?.next_appointment as Record<string, unknown> | undefined;
  const tasks = (data?.tasks as Record<string, unknown>[]) || [];
  const incomplete = (data?.incomplete_sessions as Record<string, unknown>[]) || [];
  const appointments = data?.appointments as Record<string, unknown[]> | undefined;
  const flat = ["confirmed", "awaiting_confirmation", "scheduled"]
    .flatMap((k) => (appointments?.[k] as Record<string, unknown>[]) || []);

  return (
    <div className="animate-fade-in space-y-8">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Meu dia</h1>
        <p className="mt-1 text-emerald-800/80">
          {(data?.primary_question as string) || "O que preciso fazer agora?"}
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Próximo atendimento
        </h2>
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-medium">{String(next.patient_display_name || "")}</div>
              <div className="text-sm text-emerald-800/70">
                {formatTime(String(next.starts_at || ""))}
              </div>
            </div>
            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
              onClick={async () => {
                const session = await startSession(
                  String(next.patient_id),
                  String(next.id),
                );
                onOpenSession(session.id);
              }}
            >
              Iniciar sessão
            </button>
          </div>
        ) : (
          <p className="text-sm text-emerald-800/70">Nenhum atendimento restante hoje.</p>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Agenda de hoje
        </h2>
        <div className="space-y-3">
          {flat.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhum atendimento listado.</p>
          )}
          {flat.map((a) => (
            <div
              key={String(a.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 px-3 py-3"
            >
              <div>
                <div className="font-medium">{String(a.patient_display_name || "")}</div>
                <div className="text-xs text-emerald-800/70">
                  {formatTime(String(a.starts_at || ""))} · {String(a.status || "")}
                </div>
              </div>
              <div className="flex gap-2">
                {a.status === "awaiting_confirmation" && (
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    onClick={async () => {
                      await setAppointmentStatus(String(a.id), "confirmed");
                      await load();
                    }}
                  >
                    Confirmar
                  </button>
                )}
                <button
                  className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white"
                  onClick={async () => {
                    const session = await startSession(String(a.patient_id), String(a.id));
                    onOpenSession(session.id);
                  }}
                >
                  Sessão
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Registros incompletos
        </h2>
        {incomplete.length === 0 ? (
          <p className="text-sm text-emerald-800/70">Tudo em dia nos registros.</p>
        ) : (
          incomplete.map((s) => (
            <button
              key={String(s.id)}
              className="mb-2 block w-full rounded-xl border px-3 py-3 text-left hover:bg-emerald-50"
              onClick={() => onOpenSession(String(s.id))}
            >
              {String(s.patient_display_name || "")} — {String(s.primary_action || "Continuar")}
            </button>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Tarefas
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-emerald-800/70">Nenhuma tarefa aberta.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={String(t.id)}
              className="mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-3"
            >
              <div className="text-sm font-medium">{String(t.title || "")}</div>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  await completeTask(String(t.id));
                  await load();
                }}
              >
                Concluir
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
