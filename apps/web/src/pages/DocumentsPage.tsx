import { useEffect, useState } from "react";
import {
  createDocument,
  exportDocument,
  finalizeDocument,
  getDocumentTemplates,
  getDocuments,
  getPatients,
  type DocItem,
  type DocTemplate,
  type Patient,
} from "../lib/workspace";

export default function DocumentsPage() {
  const [items, setItems] = useState<DocItem[]>([]);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = async () => {
    try {
      const [docs, tpls, pats] = await Promise.all([
        getDocuments(),
        getDocumentTemplates(),
        getPatients(),
      ]);
      setItems(docs);
      setTemplates(tpls);
      setPatients(pats);
      if (!patientId && pats[0]) setPatientId(pats[0].id);
      if (!templateId && tpls[0]) setTemplateId(tpls[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro em documentos");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Documentos</h1>
        <p className="mt-1 text-emerald-800/80">
          Modelos e exportação na API — sem Google Docs/Drive.
        </p>
      </header>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Modelos
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-xl border px-3 py-1.5 text-sm ${
                templateId === t.id ? "border-emerald-700 bg-emerald-50" : ""
              }`}
            >
              {t.name}
            </button>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-emerald-800/70">Carregando modelos…</p>
          )}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!patientId || !templateId) return;
            await createDocument({ patient_id: patientId, template_id: templateId });
            setHint("Rascunho gerado a partir do modelo.");
            await load();
          }}
        >
          <label className="text-sm">
            Paciente
            <select
              className="mt-1 block rounded-xl border px-3 py-2"
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
          <button className="rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
            Gerar rascunho
          </button>
        </form>
      </section>

      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.id} className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
            <div className="font-medium">{d.title}</div>
            <div className="mb-3 text-xs text-emerald-800/70">
              {d.doc_type} · {d.status === "finalized" ? "Finalizado" : "Rascunho"}
            </div>
            <p className="mb-3 line-clamp-4 whitespace-pre-wrap text-sm">{d.body}</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(d.body || "");
                  setHint("Texto copiado.");
                }}
              >
                Copiar
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  const exp = await exportDocument(d.id, "txt");
                  await navigator.clipboard.writeText(exp.content);
                  setHint(`TXT copiado (${exp.filename || "documento"}).`);
                }}
              >
                Exportar TXT
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={async () => {
                  const exp = await exportDocument(d.id, "html");
                  await navigator.clipboard.writeText(exp.content);
                  setHint(exp.print_hint || "HTML copiado.");
                }}
              >
                Exportar HTML / PDF
              </button>
              {d.status !== "finalized" && (
                <button
                  className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white"
                  onClick={async () => {
                    await finalizeDocument(d.id);
                    setHint("Documento finalizado.");
                    await load();
                  }}
                >
                  Finalizar
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-emerald-800/70">
            Nenhum documento ainda. Escolha um modelo acima.
          </p>
        )}
      </div>
    </div>
  );
}
