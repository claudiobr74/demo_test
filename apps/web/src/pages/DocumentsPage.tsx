import { useEffect, useMemo, useState } from "react";
import {
  AUTO_DOCUMENT_VARS,
  DOCUMENT_VAR_LABELS,
  createDocument,
  downloadDocumentPdf,
  exportDocument,
  finalizeDocument,
  getDocumentTemplates,
  getDocuments,
  getPatients,
  getProfile,
  updateDocument,
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
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [profileDefaults, setProfileDefaults] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId],
  );

  const formVars = useMemo(() => {
    const keys = selectedTemplate?.variables || [];
    return keys.filter((k) => !AUTO_DOCUMENT_VARS.has(k));
  }, [selectedTemplate]);

  const load = async () => {
    try {
      const [docs, tpls, pats, profile] = await Promise.all([
        getDocuments(),
        getDocumentTemplates(),
        getPatients(),
        getProfile().catch(() => null),
      ]);
      setItems(docs);
      setTemplates(tpls);
      setPatients(pats);
      if (!patientId && pats[0]) setPatientId(pats[0].id);
      if (!templateId && tpls[0]) setTemplateId(tpls[0].id);
      if (profile) {
        const user = profile.user || {};
        const org = profile.organization || {};
        setProfileDefaults({
          crp: String(user.professional_registration || ""),
          clinic_name: String(org.name || ""),
          duration: "50",
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro em documentos");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedTemplate) {
      setVarValues({});
      return;
    }
    const next: Record<string, string> = {};
    for (const key of selectedTemplate.variables || []) {
      if (AUTO_DOCUMENT_VARS.has(key)) continue;
      next[key] = varValues[key] || profileDefaults[key] || "";
    }
    // sensible defaults per type
    if (selectedTemplate.doc_type === "sick_leave" && !next.days) next.days = "1";
    setVarValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when template changes
  }, [templateId, selectedTemplate?.id, profileDefaults.crp, profileDefaults.clinic_name]);

  const startEdit = (d: DocItem) => {
    setEditingId(d.id);
    setEditTitle(d.title);
    setEditBody(d.body || "");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Documentos</h1>
        <p className="mt-1 text-emerald-800/80">
          Modelos com variáveis, rascunhos editáveis e PDF — sem Google Docs/Drive.
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
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!patientId || !templateId) return;
            for (const key of formVars) {
              if (key === "cid") continue; // optional
              if (!(varValues[key] || "").trim()) {
                setError(`Preencha: ${DOCUMENT_VAR_LABELS[key] || key}`);
                return;
              }
            }
            setError(null);
            const created = await createDocument({
              patient_id: patientId,
              template_id: templateId,
              variables: varValues,
            });
            const leftover = (created.body || "").match(/\{\{[a-zA-Z0-9_]+\}\}/g);
            setHint(
              leftover?.length
                ? "Rascunho gerado — revise placeholders restantes no editor."
                : "Rascunho gerado a partir do modelo.",
            );
            await load();
            startEdit(created);
          }}
        >
          <label className="block text-sm">
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

          {formVars.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {formVars.map((key) => (
                <label key={key} className="block text-sm">
                  {DOCUMENT_VAR_LABELS[key] || key}
                  {key === "cid" ? (
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={varValues[key] || ""}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Somente se autorizado"
                    />
                  ) : key === "reason" || key === "summary" ? (
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={3}
                      value={varValues[key] || ""}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={varValues[key] || ""}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <p className="text-xs text-emerald-800/70">
              Nome, data, profissional, CRP e clínica são preenchidos automaticamente.
            </p>
          )}

          <button className="rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
            Gerar rascunho
          </button>
        </form>
      </section>

      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.id} className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
            {editingId === d.id ? (
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border px-3 py-2 font-medium"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <textarea
                  className="min-h-48 w-full rounded-xl border px-3 py-2 text-sm"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white"
                    onClick={async () => {
                      await updateDocument(d.id, { title: editTitle, body: editBody });
                      setEditingId(null);
                      setHint("Rascunho salvo.");
                      await load();
                    }}
                  >
                    Salvar rascunho
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="font-medium">{d.title}</div>
                <div className="mb-3 text-xs text-emerald-800/70">
                  {d.doc_type} · {d.status === "finalized" ? "Finalizado" : "Rascunho"}
                </div>
                <p className="mb-3 line-clamp-4 whitespace-pre-wrap text-sm">{d.body}</p>
                <div className="flex flex-wrap gap-2">
                  {d.status !== "finalized" && (
                    <button
                      className="rounded-lg border px-3 py-1.5 text-sm"
                      onClick={() => startEdit(d)}
                    >
                      Editar
                    </button>
                  )}
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
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(exp.content);
                        win.document.close();
                        setHint("HTML aberto — use Imprimir se quiser.");
                      } else {
                        await navigator.clipboard.writeText(exp.content);
                        setHint(exp.print_hint || "HTML copiado.");
                      }
                    }}
                  >
                    Abrir HTML
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    onClick={async () => {
                      const { filename } = await downloadDocumentPdf(d.id);
                      setHint(`PDF baixado: ${filename}`);
                    }}
                  >
                    Baixar PDF
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
              </>
            )}
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
