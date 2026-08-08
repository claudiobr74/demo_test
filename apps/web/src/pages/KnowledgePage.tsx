import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { getStoredUser } from "../lib/auth";
import {
  QUICK_GUIDES,
  createNotebook,
  deleteNotebook,
  listNotebooks,
  updateNotebook,
  type LocalNotebook,
} from "../lib/notebooks";
import {
  getCaseMemory,
  getPatients,
  prepareSessionContext,
  type Patient,
} from "../lib/workspace";

/**
 * Mantém o item de menu "Conhecimento & NotebookLM" do React original.
 * Cadernos locais na SerenaPsi — sem Google NotebookLM / Drive.
 */
export default function KnowledgePage() {
  const orgId = getStoredUser()?.organization_id || "local";
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [memory, setMemory] = useState<Record<string, unknown>[]>([]);
  const [prep, setPrep] = useState<Record<string, unknown> | null>(null);
  const [notebooks, setNotebooks] = useState<LocalNotebook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [guideId, setGuideId] = useState(QUICK_GUIDES[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const selected = useMemo(
    () => notebooks.find((n) => n.id === selectedId) || null,
    [notebooks, selectedId],
  );
  const guide = QUICK_GUIDES.find((g) => g.id === guideId) || QUICK_GUIDES[0];

  const reloadNotebooks = () => {
    const items = listNotebooks(orgId);
    setNotebooks(items);
    if (selectedId && !items.some((n) => n.id === selectedId)) {
      setSelectedId(items[0]?.id || null);
    } else if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
    }
  };

  useEffect(() => {
    reloadNotebooks();
    void (async () => {
      try {
        const items = await getPatients();
        setPatients(items);
        if (items[0]) setPatientId(items[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar pacientes");
      }
    })();
  }, [orgId]);

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
          Cadernos clínicos locais do consultório. Sem sync com Google NotebookLM — o conhecimento
          fica na SerenaPsi e neste dispositivo.
        </p>
      </header>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Meus cadernos
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTitle.trim()) return;
              const nb = createNotebook(orgId, {
                title: newTitle,
                kind: patientId ? "paciente" : "personalizado",
                patient_id: patientId || undefined,
              });
              setNewTitle("");
              reloadNotebooks();
              setSelectedId(nb.id);
              setHint("Caderno criado localmente (sem Google).");
            }}
          >
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Novo caderno…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-800 px-3 py-2 text-white"
              title="Criar caderno"
            >
              <Plus size={16} />
            </button>
          </form>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {notebooks.map((n) => (
              <button
                key={n.id}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  selectedId === n.id ? "bg-emerald-100 text-emerald-950" : "hover:bg-emerald-50"
                }`}
                onClick={() => setSelectedId(n.id)}
              >
                <span className="truncate font-medium">{n.title}</span>
                <span className="text-[10px] uppercase text-emerald-700/70">{n.kind}</span>
              </button>
            ))}
            {notebooks.length === 0 && (
              <p className="text-xs text-emerald-800/70">Nenhum caderno ainda.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white/70 p-5">
          {selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <input
                  className="flex-1 rounded-xl border px-3 py-2 font-serif text-xl"
                  value={selected.title}
                  onChange={(e) => {
                    updateNotebook(orgId, selected.id, { title: e.target.value });
                    reloadNotebooks();
                  }}
                />
                <button
                  className="rounded-lg border border-red-200 p-2 text-red-700"
                  onClick={() => {
                    if (!window.confirm(`Excluir caderno "${selected.title}"?`)) return;
                    deleteNotebook(orgId, selected.id);
                    setSelectedId(null);
                    reloadNotebooks();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea
                className="min-h-48 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Anotações clínicas, hipóteses, materiais de estudo…"
                value={selected.notes}
                onChange={(e) => {
                  updateNotebook(orgId, selected.id, { notes: e.target.value });
                  reloadNotebooks();
                }}
              />
              <p className="text-xs text-emerald-800/60">
                Atualizado em {new Date(selected.updated_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-emerald-800/70">
              Selecione ou crie um caderno para começar. Os dados ficam neste navegador.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 space-y-3">
        <h2 className="font-serif text-xl text-emerald-900">Biblioteca clínica rápida</h2>
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={guide?.id}
          onChange={(e) => setGuideId(e.target.value)}
        >
          {QUICK_GUIDES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.category}: {g.title}
            </option>
          ))}
        </select>
        {guide && (
          <div className="space-y-2 text-sm text-emerald-900">
            <p>
              <strong>Definição:</strong> {guide.definition}
            </p>
            <p>
              <strong>Sinais:</strong> {guide.signs}
            </p>
            <p>
              <strong>Perguntas úteis:</strong> {guide.questions}
            </p>
            <p>
              <strong>Intervenções:</strong> {guide.interventions}
            </p>
            <button
              className="rounded-lg border px-3 py-1.5"
              onClick={() => {
                const nb = createNotebook(orgId, {
                  title: `Guia — ${guide.title}`,
                  kind: "biblioteca",
                  notes: `${guide.definition}\n\nSinais: ${guide.signs}\n\nPerguntas: ${guide.questions}\n\nIntervenções: ${guide.interventions}`,
                });
                reloadNotebooks();
                setSelectedId(nb.id);
                setHint("Guia copiado para um caderno local.");
              }}
            >
              Copiar para caderno local
            </button>
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <label className="text-sm font-medium text-emerald-900">
          Paciente (memória do caso)
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
