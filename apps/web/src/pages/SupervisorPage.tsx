import { useEffect, useState } from "react";
import { getPatients, runSupervisor, type Patient } from "../lib/workspace";

export default function SupervisorPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [mode, setMode] = useState("prepare_session");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const items = await getPatients();
      setPatients(items);
      if (items[0]) setPatientId(items[0].id);
    })();
  }, []);

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
            try {
              setResult(await runSupervisor({ mode, patient_id: patientId }));
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

      {result && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white/70 p-5">
          <p className="text-sm">
            {(result.summary as { message?: string } | undefined)?.message ||
              (result.epistemology_note as string) ||
              "Sugestão gerada."}
          </p>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-emerald-800">Foco sugerido</h3>
            <ul className="list-disc pl-5 text-sm">
              {((result.suggested_focus as string[]) || []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-emerald-800">Perguntas</h3>
            <ul className="list-disc pl-5 text-sm">
              {((result.questions as string[]) || []).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-emerald-800/70">
            Offline assist disponível se o LLM estiver indisponível.
          </p>
        </div>
      )}
    </div>
  );
}
