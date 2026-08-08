import { useEffect, useState } from "react";
import ConfirmationQueuePanel from "../components/ConfirmationQueuePanel";
import {
  completeTask,
  createCharge,
  createTask,
  enqueueConfirmation,
  getToday,
  prepareConfirmationCopy,
  prepareSessionContext,
  setAppointmentStatus,
  startSession,
} from "../lib/workspace";

type Props = {
  onOpenSession: (sessionId: string) => void;
  onPreparePatient?: (patientId: string) => void;
  onNavigateDeepLink?: (link: string) => void;
  clinicalAccess?: boolean;
};

export default function MyDayPage({
  onOpenSession,
  onPreparePatient,
  onNavigateDeepLink,
  clinicalAccess = true,
}: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [queueKey, setQueueKey] = useState(0);

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

      {hint && (
        <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{hint}</p>
      )}

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
            <div className="flex flex-wrap gap-2">
              {clinicalAccess ? (
                <>
                  <button
                    className="rounded-xl border px-3 py-2 text-sm"
                    onClick={async () => {
                      const ctx = await prepareSessionContext(String(next.patient_id));
                      setPrep(ctx);
                      setHint(
                        `Preparação: ${String(
                          (ctx.suggested_focus as string) ||
                            (ctx.last_session_summary as { focus?: string } | undefined)?.focus ||
                            "contexto carregado",
                        )}`,
                      );
                      onPreparePatient?.(String(next.patient_id));
                    }}
                  >
                    Preparar
                  </button>
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
                </>
              ) : (
                <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
                  Sessão clínica restrita ao perfil clínico
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-800/70">Nenhum atendimento restante hoje.</p>
        )}
      </section>

      {prep && (
        <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Preparação da sessão
          </h2>
          <p className="text-sm text-emerald-900">
            Foco sugerido:{" "}
            <strong>
              {(prep.suggested_focus as string) ||
                (prep.last_session_summary as { focus?: string } | undefined)?.focus ||
                "—"}
            </strong>
          </p>
          {Array.isArray(prep.active_goals) && prep.active_goals.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {(prep.active_goals as { title?: string }[]).map((g, i) => (
                <li key={i}>{g.title || "Meta"}</li>
              ))}
            </ul>
          )}
          {Boolean(onPreparePatient && next?.patient_id) && (
            <button
              className="mt-3 rounded-lg border px-3 py-1.5 text-sm"
              onClick={() => onPreparePatient?.(String(next?.patient_id))}
            >
              Abrir Supervisor IA
            </button>
          )}
        </section>
      )}

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
              <div className="flex flex-wrap gap-2">
                {(a.status === "awaiting_confirmation" || a.status === "scheduled") && (
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    onClick={async () => {
                      await setAppointmentStatus(String(a.id), "confirmed");
                      setHint("Atendimento confirmado.");
                      await load();
                    }}
                  >
                    Confirmar
                  </button>
                )}
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={async () => {
                    const text = await prepareConfirmationCopy(String(a.id));
                    await navigator.clipboard.writeText(text);
                    setHint("Mensagem de confirmação copiada (sem Gmail).");
                  }}
                >
                  Copiar mensagem
                </button>
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={async () => {
                    await enqueueConfirmation(String(a.id));
                    setQueueKey((k) => k + 1);
                    setHint("Confirmação enfileirada (stub multi-canal).");
                  }}
                >
                  Enfileirar
                </button>
                {clinicalAccess && (
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    onClick={async () => {
                      const ctx = await prepareSessionContext(String(a.patient_id));
                      setPrep(ctx);
                      setHint(`Preparação para ${String(a.patient_display_name || "paciente")}.`);
                    }}
                  >
                    Preparar
                  </button>
                )}
                <button
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
                  onClick={async () => {
                    const name = String(a.patient_display_name || "paciente");
                    if (
                      !window.confirm(
                        `Registrar falta para ${name}? Isso marca no-show e gera cobrança por falta.`,
                      )
                    ) {
                      return;
                    }
                    await setAppointmentStatus(String(a.id), "no_show");
                    const feeRaw = String(a.session_fee ?? "").trim();
                    const fee = Number(feeRaw.replace(",", "."));
                    if (feeRaw && Number.isFinite(fee) && fee > 0) {
                      try {
                        await createCharge({
                          patient_id: String(a.patient_id),
                          amount: feeRaw,
                          description: `Cobrança por falta — ${name}`,
                          origin: "no_show",
                        });
                        setHint(`Falta registrada. Cobrança de R$ ${feeRaw} gerada.`);
                      } catch {
                        setHint("Falta registrada. Não foi possível gerar a cobrança.");
                      }
                    } else {
                      setHint(
                        "Falta registrada. Paciente sem taxa de sessão — cobrança não gerada.",
                      );
                    }
                    await load();
                  }}
                >
                  Falta
                </button>
                {clinicalAccess ? (
                  <button
                    className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white"
                    onClick={async () => {
                      const session = await startSession(String(a.patient_id), String(a.id));
                      onOpenSession(session.id);
                    }}
                  >
                    Sessão
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {clinicalAccess && (
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
      )}

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Tarefas
        </h2>
        <form
          className="mb-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newTask.trim()) return;
            await createTask({ title: newTask.trim(), kind: "admin" });
            setNewTask("");
            await load();
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Nova tarefa rápida…"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="submit">
            Adicionar
          </button>
        </form>
        {tasks.length === 0 ? (
          <p className="text-sm text-emerald-800/70">Nenhuma tarefa aberta.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={String(t.id)}
              className="mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{String(t.title || "")}</div>
                {Boolean(t.deep_link) && (
                  <button
                    className="mt-1 text-xs text-emerald-700 underline"
                    onClick={() => onNavigateDeepLink?.(String(t.deep_link))}
                  >
                    Abrir origem
                  </button>
                )}
              </div>
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

      <ConfirmationQueuePanel refreshKey={queueKey} />
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
