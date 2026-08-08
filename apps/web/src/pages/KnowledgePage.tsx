import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  getCaseMemory,
  getPatients,
  prepareSessionContext,
  type Patient,
} from "../lib/workspace";

/**
 * Mantém o item de menu "Conhecimento & NotebookLM" do React original.
 * Conteúdo interno da SerenaPsi — sem Google NotebookLM / Drive.
 */
export default function KnowledgePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [memory, setMemory] = useState<Record<string, unknown>[]>([]);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const items = await getPatients();
        setPatients(items);
        if (items[0]) setPatientId(items[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar pacientes");
      }
    })();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    void (async () => {
      try {
        const [m, context] = await Promise.all([
          getCaseMemory(patientId),
          prepareSessionContext(patientId),
        ]);
        setMemory(m);
        setPrep(context);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar conhecimento");
      }
    })();
  }, [patientId]);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <div className="flex items-center gap-2 text-emerald-900">
          <BookOpen size={22} />
          <h1 className="font-serif text-3xl text-emerald-950">Conhecimento & NotebookLM</h1>
        </div>
        <p className="mt-1 text-emerald-800/80">
          Cadernos clínicos do consultório. Sem exportação para Google NotebookLM — o conhecimento
          fica na SerenaPsi (memória do caso, formulação e preparação de sessão).
        </p>
      </header>

      {error && <p className="text-red-700">{error}</p>}

      <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <label className="text-sm font-medium text-emerald-900">
          Paciente
          <select
            className="mt-1 block w-full max-w-md rounded-xl border px-3 py-2"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {prep && (
        <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5">
          <h2 className="font-serif text-xl text-emerald-900">Contexto clínico</h2>
          <p className="mt-2 text-sm text-emerald-800/85">
            Foco sugerido:{" "}
            <strong>
              {(prep.suggested_focus as string) ||
                (prep.last_session_summary as { focus?: string } | undefined)?.focus ||
                "—"}
            </strong>
          </p>
          {Array.isArray(prep.active_goals) && prep.active_goals.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm">
              {(prep.active_goals as { title?: string }[]).map((g, i) => (
                <li key={i}>{g.title || "Meta"}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5">
        <h2 className="mb-3 font-serif text-xl text-emerald-900">Memória do caso</h2>
        <div className="space-y-2">
          {memory.map((m) => (
            <div key={String(m.id)} className="rounded-xl border px-3 py-2 text-sm">
              <div className="text-xs font-semibold uppercase text-emerald-700">
                {String(m.kind)}
              </div>
              <div>{String(m.content)}</div>
            </div>
          ))}
          {memory.length === 0 && (
            <p className="text-sm text-emerald-800/70">
              Nenhuma memória ainda. Registre no hub do paciente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
