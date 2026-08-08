import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  acceptCaseMemory,
  acceptHypothesis,
  addCaseMemory,
  addTreatmentGoal,
  createHypothesis,
  decideConsent,
  getCaseMemory,
  getClinicalRecord,
  getClinicalRecords,
  getCurrentFormulation,
  getCurrentTreatmentPlan,
  getHypotheses,
  getPackages,
  getPatient,
  getPatientConsents,
  prepareSessionContext,
  promoteFormulation,
  requestConsent,
  startSession,
  updateHypothesisStrength,
  updateTreatmentGoal,
  upsertFormulationDraft,
  upsertTreatmentPlan,
  type ClinicalRecordDetail,
  type ClinicalRecordSummary,
  type HypothesisItem,
  type PackageItem,
  type Patient,
} from "../lib/workspace";
import { toHash } from "../lib/navigation";

type Props = {
  patientId: string;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  onNavigateDeepLink?: (link: string) => void;
  clinicalAccess?: boolean;
  initialFocus?: "prontuario" | "formulacao" | "hub";
  initialRecordId?: string;
};

export default function PatientHubPage({
  patientId,
  onClose,
  onOpenSession,
  onNavigateDeepLink,
  clinicalAccess = true,
  initialFocus = "hub",
  initialRecordId,
}: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memory, setMemory] = useState<Record<string, unknown>[]>([]);
  const [consents, setConsents] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<ClinicalRecordSummary[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisItem[]>([]);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [formulation, setFormulation] = useState<Record<string, unknown> | null>(null);
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("observation");
  const [focusDraft, setFocusDraft] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [newHypothesis, setNewHypothesis] = useState("");
  const formulationRef = useRef<HTMLElement | null>(null);
  const recordsRef = useRef<HTMLElement | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<ClinicalRecordDetail | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const load = async () => {
    try {
      const [p, m, c, r, context, f, tp, pkgs, hyps] = await Promise.all([
        getPatient(patientId),
        getCaseMemory(patientId),
        getPatientConsents(patientId),
        getClinicalRecords(patientId),
        prepareSessionContext(patientId),
        getCurrentFormulation(patientId),
        getCurrentTreatmentPlan(patientId),
        getPackages(patientId),
        clinicalAccess ? getHypotheses(patientId) : Promise.resolve([]),
      ]);
      setPatient(p);
      setMemory(m);
      setConsents(c);
      setRecords(r);
      setPrep(context);
      setFormulation(f);
      setPlan(tp);
      setPackages(pkgs);
      setHypotheses(hyps);
      const body = (f?.body as { therapeutic_focus?: string } | undefined) || {};
      setFocusDraft(body.therapeutic_focus || "");
      setPlanSummary(String(tp?.initial_formulation_summary || ""));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir paciente");
    }
  };

  const openRecord = async (recordId: string) => {
    if (!clinicalAccess) return;
    setRecordLoading(true);
    setError(null);
    try {
      const detail = await getClinicalRecord(recordId);
      setRecordDetail(detail);
      const hash = toHash({
        type: "patient",
        patientId,
        focus: "prontuario",
        recordId,
      });
      const next = hash.startsWith("#") ? hash.slice(1) : hash;
      if (window.location.hash.replace(/^#/, "") !== next) {
        window.location.hash = next;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir prontuário");
    } finally {
      setRecordLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [patientId, clinicalAccess]);

  useEffect(() => {
    if (initialFocus === "formulacao") {
      formulationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (initialFocus === "prontuario") {
      recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialFocus, patient]);

  useEffect(() => {
    if (clinicalAccess && initialRecordId) {
      void openRecord(initialRecordId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when deep-link record changes
  }, [initialRecordId, clinicalAccess, patientId]);

  if (error && !patient) {
    return (
      <div className="p-6">
        <p className="text-red-700">{error}</p>
        <button className="mt-3 rounded-lg border px-3 py-2" onClick={onClose}>
          Voltar
        </button>
      </div>
    );
  }

  if (!patient) return <p className="p-8">Carregando paciente…</p>;

  const goals = (plan?.goals as { id: string; title: string; status: string }[]) || [];

  return (
    <div className="animate-fade-in mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button className="rounded-xl border bg-white p-2" onClick={onClose} aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-serif text-3xl text-emerald-950">{patient.display_name}</h1>
            <p className="text-sm text-emerald-800/75">
              {patient.internal_code || "—"} · hub clínico do paciente
              {(patient as Patient & { session_fee?: string }).session_fee
                ? ` · sessão R$ ${(patient as Patient & { session_fee?: string }).session_fee}`
                : ""}
            </p>
          </div>
        </div>
        {clinicalAccess ? (
          <button
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
            onClick={async () => {
              const session = await startSession(patientId);
              onOpenSession(session.id);
            }}
          >
            Iniciar sessão
          </button>
        ) : (
          <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
            Acesso clínico restrito
          </span>
        )}
      </header>

      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!clinicalAccess && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
          Perfil de secretaria: cadastro, agenda e financeiro disponíveis. Formulação, memória
          clínica e plano terapêutico ficam no perfil clínico.
        </section>
      )}

      {clinicalAccess && prep && (
        <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-emerald-800">Preparar próxima sessão</h2>
          <p className="font-medium text-emerald-950">
            {(prep.suggested_focus as string) ||
              (prep.last_session_summary as { focus?: string } | undefined)?.focus ||
              (prep.supervisor_action as string) ||
              "Contexto disponível na API."}
          </p>
          {(prep.last_session_summary as { evolution?: string } | undefined)?.evolution && (
            <p className="mt-2 whitespace-pre-wrap text-emerald-900/80">
              Última evolução:{" "}
              {(prep.last_session_summary as { evolution?: string }).evolution}
            </p>
          )}
        </section>
      )}

      {clinicalAccess && (
        <>
      <section
        ref={formulationRef}
        className="rounded-2xl border border-emerald-200 bg-white/70 p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Formulação viva
        </h2>
        <p className="text-xs text-emerald-800/70">
          Status: {String(formulation?.status || "sem rascunho")}
          {formulation?.is_official ? " · oficial" : ""}
        </p>
        <textarea
          className="w-full rounded-xl border px-3 py-2 text-sm"
          rows={3}
          placeholder="Foco terapêutico / hipótese de trabalho"
          value={focusDraft}
          onChange={(e) => setFocusDraft(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
            onClick={async () => {
              const saved = await upsertFormulationDraft(patientId, {
                body: { therapeutic_focus: focusDraft },
                version: formulation?.version as number | undefined,
              });
              setFormulation(saved as Record<string, unknown>);
              setHint("Rascunho de formulação salvo.");
              await load();
            }}
          >
            Salvar rascunho
          </button>
          {Boolean(formulation?.id) && formulation?.status === "draft" && (
            <button
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={async () => {
                await promoteFormulation(String(formulation?.id));
                setHint("Formulação promovida a oficial.");
                await load();
              }}
            >
              Promover a oficial
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Plano terapêutico
        </h2>
        <textarea
          className="w-full rounded-xl border px-3 py-2 text-sm"
          rows={2}
          placeholder="Resumo do plano / formulação inicial"
          value={planSummary}
          onChange={(e) => setPlanSummary(e.target.value)}
        />
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
          onClick={async () => {
            await upsertTreatmentPlan(patientId, {
              initial_formulation_summary: planSummary,
              priority_problems: planSummary ? [planSummary] : [],
            });
            setHint("Plano terapêutico atualizado.");
            await load();
          }}
        >
          Salvar plano
        </button>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!goalTitle.trim()) return;
            await addTreatmentGoal(patientId, goalTitle.trim());
            setGoalTitle("");
            await load();
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Nova meta terapêutica"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
          />
          <button className="rounded-xl border px-4 py-2 text-sm" type="submit">
            Meta
          </button>
        </form>
        <div className="space-y-2">
          {goals.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <span>
                {g.title} · {g.status}
              </span>
              {g.status === "active" && (
                <button
                  className="text-xs underline"
                  onClick={async () => {
                    await updateTreatmentGoal(g.id, { status: "achieved" });
                    await load();
                  }}
                >
                  Marcar alcançada
                </button>
              )}
            </div>
          ))}
          {goals.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhuma meta ativa.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Hipóteses clínicas
        </h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newHypothesis.trim()) return;
            await createHypothesis(patientId, newHypothesis.trim());
            setNewHypothesis("");
            setHint("Hipótese registrada.");
            await load();
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Nova hipótese clínica"
            value={newHypothesis}
            onChange={(e) => setNewHypothesis(e.target.value)}
          />
          <button className="rounded-xl border px-4 py-2 text-sm" type="submit">
            Adicionar
          </button>
        </form>
        <div className="space-y-2">
          {hypotheses.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <div>
                <div>{h.statement}</div>
                <div className="text-xs text-emerald-800/70">
                  {h.strength || "active"}
                  {h.pending_review ? " · pendente revisão IA" : ""}
                  {h.created_by ? ` · ${h.created_by}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {h.pending_review && (
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={async () => {
                      await acceptHypothesis(h.id);
                      setHint("Hipótese IA aceita.");
                      await load();
                    }}
                  >
                    Aceitar
                  </button>
                )}
                <button
                  className="rounded-lg border px-2 py-1 text-xs"
                  onClick={async () => {
                    await updateHypothesisStrength(h.id, "strengthened");
                    await load();
                  }}
                >
                  Fortalecer
                </button>
                <button
                  className="rounded-lg border px-2 py-1 text-xs"
                  onClick={async () => {
                    await updateHypothesisStrength(h.id, "weakened");
                    await load();
                  }}
                >
                  Enfraquecer
                </button>
                <button
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                  onClick={async () => {
                    await updateHypothesisStrength(h.id, "retired");
                    await load();
                  }}
                >
                  Aposentar
                </button>
              </div>
            </div>
          ))}
          {hypotheses.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhuma hipótese registrada.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Memória do caso
        </h2>
        <div className="mb-4 space-y-2">
          {memory.slice(0, 8).map((m) => (
            <div key={String(m.id)} className="rounded-xl border px-3 py-2 text-sm">
              <div className="text-xs font-semibold text-emerald-700">
                {String(m.kind)}
                {m.pending_review ? " · sugestão IA" : ""}
              </div>
              <div>{String(m.content)}</div>
              {Array.isArray(m.provenance) &&
                (m.provenance as { deep_link?: string; resource_type?: string }[]).map((p, i) =>
                  p.deep_link ? (
                    <button
                      key={i}
                      className="mt-1 mr-2 text-xs text-emerald-700 underline"
                      onClick={() => onNavigateDeepLink?.(String(p.deep_link))}
                    >
                      Fonte: {p.resource_type || "origem"}
                    </button>
                  ) : null,
                )}
              {m.pending_review === true && (
                <button
                  className="mt-2 text-xs underline"
                  onClick={async () => {
                    await acceptCaseMemory(String(m.id));
                    await load();
                  }}
                >
                  Aceitar sugestão
                </button>
              )}
            </div>
          ))}
          {memory.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhuma memória registrada.</p>
          )}
        </div>
        <form
          className="grid gap-2 md:grid-cols-[140px_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!content.trim()) return;
            await addCaseMemory(patientId, {
              kind,
              content: content.trim(),
              provenance: [{ resource_type: "professional_note" }],
            });
            setContent("");
            await load();
          }}
        >
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="fact">Fato</option>
            <option value="observation">Observação</option>
            <option value="hypothesis">Hipótese</option>
          </select>
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="Nova memória"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="submit">
            Salvar
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Consentimentos
        </h2>
        <div className="mb-3 space-y-2">
          {consents.map((c) => (
            <div
              key={String(c.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <div>
                {String(c.consent_type)} · {String(c.status)}
              </div>
              {c.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={async () => {
                      await decideConsent(String(c.id), "accepted");
                      await load();
                    }}
                  >
                    Aceitar
                  </button>
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={async () => {
                      await decideConsent(String(c.id), "refused");
                      await load();
                    }}
                  >
                    Recusar
                  </button>
                </div>
              )}
            </div>
          ))}
          {consents.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhum consentimento ainda.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={async () => {
              await requestConsent(patientId, "ai_processing");
              await load();
            }}
          >
            Solicitar consentimento de IA
          </button>
          <button
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={async () => {
              await requestConsent(patientId, "transcription");
              await load();
            }}
          >
            Solicitar gravação/transcrição
          </button>
        </div>
      </section>

      <section
        ref={recordsRef}
        className="rounded-2xl border border-emerald-200 bg-white/70 p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Prontuário recente
        </h2>
        <p className="mb-3 text-xs text-emerald-800/70">
          Registros finalizados no modelo CFP — somente leitura. Toque para abrir o detalhe.
        </p>
        {recordLoading && (
          <p className="mb-2 text-sm text-emerald-800/70">Abrindo registro…</p>
        )}
        {records.slice(0, 12).map((r) => (
          <button
            key={r.id}
            type="button"
            className="mb-2 block w-full rounded-xl border px-3 py-2 text-left text-sm hover:bg-emerald-50/80"
            onClick={() => void openRecord(r.id)}
          >
            <div className="text-xs text-emerald-700">
              {String(r.recorded_at || "").replace("T", " · ").split(".")[0]}
              {r.status ? ` · ${r.status}` : ""}
            </div>
            <div className="font-medium text-emerald-950">{r.focus || "Sem foco"}</div>
            {r.evolution_preview && (
              <p className="mt-1 line-clamp-2 text-xs text-emerald-900/75">
                {r.evolution_preview}
              </p>
            )}
          </button>
        ))}
        {records.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhum registro clínico ainda.</p>
        )}
      </section>
        </>
      )}

      {packages.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Pacotes
          </h2>
          {packages.map((pkg) => (
            <div key={pkg.id} className="mb-2 rounded-xl border px-3 py-2 text-sm">
              {pkg.used_sessions}/{pkg.total_sessions} usadas · restam {pkg.remaining_sessions} ·{" "}
              {pkg.status}
            </div>
          ))}
        </section>
      )}

      {recordDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/50 p-4 backdrop-blur-sm md:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-50 pb-3">
              <div>
                <h3 className="font-serif text-xl text-emerald-950">Prontuário (modelo CFP)</h3>
                <p className="text-xs text-emerald-700">
                  {String(recordDetail.recorded_at || "").replace("T", " · ").split(".")[0]}
                  {recordDetail.status ? ` · ${recordDetail.status}` : ""}
                  {" · somente leitura"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-emerald-700 hover:bg-emerald-50"
                aria-label="Fechar"
                onClick={() => {
                  setRecordDetail(null);
                  window.location.hash = `pacientes/${patientId}/prontuario`;
                }}
              >
                <X size={18} />
              </button>
            </div>
            <RecordField label="Foco" value={recordDetail.focus} />
            <RecordField label="Evolução" value={recordDetail.evolution} />
            <RecordField
              label="Observações relevantes"
              value={recordDetail.relevant_observations}
            />
            <RecordField label="Intervenções" value={recordDetail.interventions} />
            <RecordField label="Tarefas" value={recordDetail.tasks} />
            <RecordField label="Planejamento" value={recordDetail.planning} />
            {recordDetail.session_id && onNavigateDeepLink && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => onNavigateDeepLink(`/sessoes/${recordDetail.session_id}`)}
              >
                Abrir sessão de origem
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
        {label}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
