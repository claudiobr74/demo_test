import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  acceptCaseMemory,
  addCaseMemory,
  decideConsent,
  getCaseMemory,
  getClinicalRecords,
  getPatient,
  getPatientConsents,
  prepareSessionContext,
  requestConsent,
  startSession,
  type Patient,
} from "../lib/workspace";

type Props = {
  patientId: string;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
};

export default function PatientHubPage({ patientId, onClose, onOpenSession }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memory, setMemory] = useState<Record<string, unknown>[]>([]);
  const [consents, setConsents] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("observation");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, m, c, r, context] = await Promise.all([
        getPatient(patientId),
        getCaseMemory(patientId),
        getPatientConsents(patientId),
        getClinicalRecords(patientId),
        prepareSessionContext(patientId),
      ]);
      setPatient(p);
      setMemory(m);
      setConsents(c);
      setRecords(r);
      setPrep(context);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir paciente");
    }
  };

  useEffect(() => {
    void load();
  }, [patientId]);

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

  if (!patient) return <p className="p-8">Carregando paciente…</p>;

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
            </p>
          </div>
        </div>
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
          onClick={async () => {
            const session = await startSession(patientId);
            onOpenSession(session.id);
          }}
        >
          Iniciar sessão
        </button>
      </header>

      {prep && (
        <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-emerald-800">Preparar próxima sessão</h2>
          <p className="text-emerald-900/80">
            {(prep.suggested_focus as string) ||
              (prep.last_session_summary as { focus?: string } | undefined)?.focus ||
              (prep.supervisor_action as string) ||
              "Contexto disponível na API."}
          </p>
        </section>
      )}

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
        <button
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={async () => {
            await requestConsent(patientId, "ai_processing");
            await load();
          }}
        >
          Solicitar consentimento de IA
        </button>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Prontuário recente
        </h2>
        {records.slice(0, 5).map((r) => (
          <div key={String(r.id)} className="mb-2 rounded-xl border px-3 py-2 text-sm">
            <div className="text-xs text-emerald-700">
              {String(r.recorded_at || "").replace("T", " · ").split(".")[0]}
            </div>
            <div>{String(r.focus || "Sem foco")}</div>
          </div>
        ))}
        {records.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhum registro clínico ainda.</p>
        )}
      </section>
    </div>
  );
}
