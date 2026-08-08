import { useEffect, useState } from "react";
import {
  acceptHypothesis,
  addCaseMemory,
  getPatients,
  runSupervisor,
  upsertFormulationDraft,
  type Patient,
} from "../lib/workspace";

type Props = { initialPatientId?: string };

export default function SupervisorPage({ initialPatientId }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(initialPatientId || "");
  const [mode, setMode] = useState("prepare_session");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const items = await getPatients();
      setPatients(items);
      if (initialPatientId && items.some((p) => p.id === initialPatientId)) {
        setPatientId(initialPatientId);
      } else if (!patientId && items[0]) {
        setPatientId(items[0].id);
      }
    })();
  }, [initialPatientId]);

  const focuses = ((result?.suggested_focus as string[]) || []).filter(Boolean);
  const questions = ((result?.questions as string[]) || []).filter(Boolean);
  const imported = (result?.imported_hypotheses as { id?: string; statement?: string }[]) || [];
  const rawHyps = (result?.hypotheses as { id?: string; statement?: string }[]) || [];
  const hypotheses = (imported.length ? imported : rawHyps).filter(
    (h): h is { id?: string; statement: string } => Boolean(h.statement),
  );

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Supervisor IA</h1>
        <p className="mt-1 text-emerald-800/80">
          A IA sugere; você decide. Provedores passam pelo Serena AI Gateway (sem Google Workspace).
        </p>
      </header>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <select
          className="rounded-xl border px-3 py-2"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border px-3 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="prepare_session">Preparar sessão</option>
          <option value="case_formulation">Formulação</option>
          <option value="post_session_debrief">Debriefing</option>
          <option value="longitudinal_review">Longitudinal</option>
          <option value="treatment_planning">Planejamento</option>
        </select>
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-white disabled:opacity-50"
          disabled={!patientId || loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            setHint(null);
            try {
              setResult(
                await runSupervisor({
                  mode,
                  patient_id: patientId,
                  import_hypotheses: mode === "case_formulation",
                }),
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "Falha no Supervisor");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Analisando…" : "Rodar Supervisor"}
        </button>
      </div>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      {result && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white/70 p-5">
          <p className="text-sm">
            {(result.summary as { message?: string } | undefined)?.message ||
              (result.epistemology_note as string) ||
              "Sugestão gerada."}
          </p>

          <div>
            <h3 className="mb-1 text-sm font-semibold text-emerald-800">Foco sugerido</h3>
            <ul className="space-y-2 text-sm">
              {focuses.map((f) => (
                <li key={f} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <span>{f}</span>
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={async () => {
                      await addCaseMemory(patientId, {
                        kind: "observation",
                        content: `Foco sugerido (aceito): ${f}`,
                        provenance: [{ resource_type: "ai_suggestion", note: mode }],
                      });
                      await upsertFormulationDraft(patientId, {
                        body: { therapeutic_focus: f },
                      });
                      setHint("Foco aceito na memória do caso e no rascunho de formulação.");
                    }}
                  >
                    Aceitar
                  </button>
                </li>
              ))}
              {focuses.length === 0 && <li className="text-emerald-800/70">Nenhum foco listado.</li>}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold text-emerald-800">Perguntas</h3>
            <ul className="space-y-2 text-sm">
              {questions.map((q) => (
                <li key={q} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <span>{q}</span>
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={async () => {
                      await addCaseMemory(patientId, {
                        kind: "observation",
                        content: `Pergunta útil (aceita): ${q}`,
                        provenance: [{ resource_type: "ai_suggestion", note: mode }],
                      });
                      setHint("Pergunta salva na memória do caso.");
                    }}
                  >
                    Aceitar
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {hypotheses.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-emerald-800">Hipóteses</h3>
              <ul className="space-y-2 text-sm">
                {hypotheses.map((h) => (
                  <li
                    key={h.id || h.statement}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                  >
                    <span>{h.statement}</span>
                    <button
                      className="rounded-lg border px-2 py-1 text-xs"
                      onClick={async () => {
                        if (h.id) {
                          await acceptHypothesis(h.id);
                          setHint("Hipótese clínica aceita no hub do paciente.");
                        } else if (h.statement) {
                          await addCaseMemory(patientId, {
                            kind: "hypothesis",
                            content: h.statement,
                            provenance: [{ resource_type: "ai_suggestion", note: mode }],
                          });
                          setHint("Hipótese registrada como sugestão (revisão profissional).");
                        }
                      }}
                    >
                      Aceitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-emerald-800/70">
            Nada entra no prontuário oficial sem o seu aceite. Offline assist disponível se o LLM
            estiver indisponível.
          </p>
        </div>
      )}
    </div>
  );
}
