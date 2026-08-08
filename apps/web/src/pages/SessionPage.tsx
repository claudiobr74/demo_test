import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarPlus,
  CheckCircle2,
  Save,
} from "lucide-react";
import {
  autosaveSession,
  closeSession,
  createAppointment,
  deferSessionClosure,
  getSession,
  prepareSessionContext,
  runSupervisor,
  type SessionRecord,
} from "../lib/workspace";

type Props = { sessionId: string; onClose: () => void };
type Tab = "notas" | "supervisor" | "encerrar";
type SaveState = "Salvo" | "Salvando…" | "Erro" | "—";

export default function SessionPage({ sessionId, onClose }: Props) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [tab, setTab] = useState<Tab>("notas");
  const [focus, setFocus] = useState("");
  const [observations, setObservations] = useState("");
  const [interventions, setInterventions] = useState("");
  const [agreements, setAgreements] = useState("");
  const [planning, setPlanning] = useState("");
  const [hypotheses, setHypotheses] = useState("");
  const [version, setVersion] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("—");
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("14:00");
  const [closing, setClosing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(1);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getSession(sessionId);
        setSession(data);
        setFocus(data.focus || "");
        setObservations(data.observations || "");
        setInterventions(data.interventions || "");
        setAgreements(data.agreements || "");
        setPlanning(data.planning || "");
        setHypotheses(data.hypotheses || "");
        setVersion(data.version || 1);
        versionRef.current = data.version || 1;
        setSaveState("Salvo");
        const context = await prepareSessionContext(data.patient_id);
        setPrep(context);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao abrir sessão");
      }
    })();
  }, [sessionId]);

  const queueAutosave = (patch: Record<string, string>) => {
    setSaveState("Salvando…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await autosaveSession(sessionId, {
          ...patch,
          version: versionRef.current,
        });
        versionRef.current = res.version;
        setVersion(res.version);
        setSaveState("Salvo");
      } catch {
        setSaveState("Erro");
      }
    }, 700);
  };

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

  if (!session) return <p className="p-8 text-emerald-800/70">Abrindo sessão…</p>;

  return (
    <div className="animate-fade-in min-h-screen bg-gradient-to-b from-emerald-50 to-transparent">
      <header className="sticky top-0 z-10 border-b border-emerald-200/80 bg-[#faf9f6]/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-emerald-200 bg-white p-2"
              onClick={onClose}
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-serif text-xl text-emerald-950 md:text-2xl">Sessão ativa</h1>
              <p className="text-sm text-emerald-800/75">{session.patient_display_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-800/80">
            <Save size={14} />
            {saveState}
            <span className="rounded-full bg-emerald-100 px-2 py-0.5">v{version}</span>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl gap-2">
          {(
            [
              ["notas", "Notas clínicas"],
              ["supervisor", "Supervisor IA"],
              ["encerrar", "Encerrar"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-xl px-3 py-1.5 text-sm ${
                tab === id
                  ? "bg-emerald-800 text-white"
                  : "border border-emerald-200 bg-white text-emerald-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-8">
        {tab === "notas" && (
          <>
            {prep && (
              <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm">
                <h2 className="mb-2 font-semibold text-emerald-800">Contexto para esta sessão</h2>
                <p className="text-emerald-900/80">
                  {(prep.last_session_summary as { focus?: string } | undefined)?.focus ||
                    (prep.suggested_focus as string) ||
                    "Sem foco anterior registrado."}
                </p>
              </section>
            )}
            <Field
              label="Foco"
              value={focus}
              rows={2}
              onChange={(v) => {
                setFocus(v);
                queueAutosave({
                  focus: v,
                  observations,
                  interventions,
                  agreements,
                  planning,
                  hypotheses,
                });
              }}
            />
            <Field
              label="Observações / resumo"
              value={observations}
              rows={6}
              onChange={(v) => {
                setObservations(v);
                queueAutosave({
                  focus,
                  observations: v,
                  interventions,
                  agreements,
                  planning,
                  hypotheses,
                });
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Intervenções"
                value={interventions}
                rows={4}
                onChange={(v) => {
                  setInterventions(v);
                  queueAutosave({
                    focus,
                    observations,
                    interventions: v,
                    agreements,
                    planning,
                    hypotheses,
                  });
                }}
              />
              <Field
                label="Hipóteses (rascunho)"
                value={hypotheses}
                rows={4}
                onChange={(v) => {
                  setHypotheses(v);
                  queueAutosave({
                    focus,
                    observations,
                    interventions,
                    agreements,
                    planning,
                    hypotheses: v,
                  });
                }}
              />
              <Field
                label="Combinados"
                value={agreements}
                rows={3}
                onChange={(v) => {
                  setAgreements(v);
                  queueAutosave({
                    focus,
                    observations,
                    interventions,
                    agreements: v,
                    planning,
                    hypotheses,
                  });
                }}
              />
              <Field
                label="Planejamento / próximo foco"
                value={planning}
                rows={3}
                onChange={(v) => {
                  setPlanning(v);
                  queueAutosave({
                    focus,
                    observations,
                    interventions,
                    agreements,
                    planning: v,
                    hypotheses,
                  });
                }}
              />
            </div>
          </>
        )}

        {tab === "supervisor" && (
          <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white/70 p-5">
            <div className="flex items-center gap-2 text-emerald-900">
              <BrainCircuit size={18} />
              <h2 className="font-serif text-xl">Sugestões do Supervisor</h2>
            </div>
            <p className="text-sm text-emerald-800/80">
              A IA sugere; você revisa e decide. Nada entra no prontuário sem o seu aceite.
            </p>
            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                try {
                  setAiResult(
                    await runSupervisor({
                      mode: "post_session_debrief",
                      patient_id: session.patient_id,
                    }),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Falha no Supervisor");
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              {aiLoading ? "Consultando…" : "Pedir debriefing"}
            </button>
            {aiResult && (
              <div className="space-y-3 text-sm">
                <p>
                  {(aiResult.summary as { message?: string } | undefined)?.message ||
                    String(aiResult.epistemology_note || "")}
                </p>
                <ul className="list-disc pl-5">
                  {((aiResult.suggested_focus as string[]) || []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <ul className="list-disc pl-5">
                  {((aiResult.questions as string[]) || []).map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === "encerrar" && (
          <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white/70 p-5">
            <h2 className="font-serif text-xl text-emerald-950">Encerramento guiado</h2>
            <p className="text-sm text-emerald-800/80">
              Finalize o registro clínico, adie se precisar, ou já marque o próximo atendimento —
              sem Google Calendar.
            </p>

            <div className="grid gap-3 rounded-xl border border-emerald-100 p-4 md:grid-cols-3">
              <label className="text-sm md:col-span-1">
                Data
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Horário
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                />
              </label>
              <button
                className="mt-auto flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm"
                onClick={async () => {
                  if (!schedDate) return;
                  const [hh, mm] = schedTime.split(":").map(Number);
                  const [y, m, d] = schedDate.split("-").map(Number);
                  const starts = new Date(y, m - 1, d, hh, mm);
                  await createAppointment({
                    patient_id: session.patient_id,
                    starts_at: starts.toISOString(),
                    duration_minutes: 50,
                  });
                  setHint("Próximo atendimento agendado na API (sem Google Calendar).");
                }}
              >
                <CalendarPlus size={16} /> Agendar retorno
              </button>
            </div>

            {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border px-4 py-2 text-sm"
                disabled={closing}
                onClick={async () => {
                  setClosing(true);
                  try {
                    await deferSessionClosure(sessionId);
                    onClose();
                  } finally {
                    setClosing(false);
                  }
                }}
              >
                Adiar fechamento
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={closing}
                onClick={async () => {
                  setClosing(true);
                  try {
                    await autosaveSession(sessionId, {
                      focus,
                      observations,
                      interventions,
                      agreements,
                      planning,
                      hypotheses,
                      version: versionRef.current,
                    });
                    await closeSession(sessionId, true);
                    onClose();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Falha ao encerrar");
                  } finally {
                    setClosing(false);
                  }
                }}
              >
                <CheckCircle2 size={16} /> Encerrar e registrar
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-emerald-900">{label}</span>
      <textarea
        className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white/80 px-3 py-2"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
