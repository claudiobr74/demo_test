import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarPlus,
  CheckCircle2,
  FileCheck,
  Mic,
  MicOff,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import ReceiptModal from "../components/ReceiptModal";
import {
  applySessionTranscription,
  autosaveSession,
  checkConsent,
  closeSession,
  createAppointment,
  deferSessionClosure,
  getSession,
  prepareSessionContext,
  proposeSessionTranscription,
  registerPayment,
  runSupervisor,
  type CfpProposal,
  type SessionRecord,
} from "../lib/workspace";

type Props = { sessionId: string; onClose: () => void };
type Tab = "notas" | "supervisor" | "encerrar";
type SaveState = "Salvo" | "Salvando…" | "Erro" | "—";

type PendingCharge = {
  id: string;
  amount: string;
  description?: string | null;
  patientName: string;
};

function formatRecTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function SessionPage({ sessionId, onClose }: Props) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [tab, setTab] = useState<Tab>("notas");
  const [focus, setFocus] = useState("");
  const [observations, setObservations] = useState("");
  const [events, setEvents] = useState("");
  const [interventions, setInterventions] = useState("");
  const [tasks, setTasks] = useState("");
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
  const [payMethod, setPayMethod] = useState("pix");
  const [pendingCharge, setPendingCharge] = useState<PendingCharge | null>(null);
  const [receipt, setReceipt] = useState<{
    patientName: string;
    amount: string;
    description?: string | null;
    method: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showCfpPreview, setShowCfpPreview] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [cfpDraft, setCfpDraft] = useState<CfpProposal | null>(null);
  const [pasteTranscript, setPasteTranscript] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const draftPatch = (overrides: Record<string, string> = {}) => ({
    focus,
    observations,
    events,
    interventions,
    tasks,
    agreements,
    planning,
    hypotheses,
    ...overrides,
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await getSession(sessionId);
        setSession(data);
        setFocus(data.focus || "");
        setObservations(data.observations || "");
        setEvents(data.events || "");
        setInterventions(data.interventions || "");
        setTasks(data.tasks || "");
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
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
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

  const processAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);
    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("Falha ao ler áudio"));
        reader.readAsDataURL(audioBlob);
      });
      const res = await proposeSessionTranscription(sessionId, {
        audio_base64: base64Audio,
        mime_type: audioBlob.type || "audio/webm",
        transcript_text: pasteTranscript.trim() || undefined,
      });
      versionRef.current = res.version;
      setVersion(res.version);
      setTranscriptText(res.transcript || "");
      setCfpDraft(res.proposal);
      setShowCfpPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao transcrever o áudio");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (!session?.patient_id) {
      setError("Paciente não identificado para verificação de consentimento.");
      return;
    }
    try {
      const check = await checkConsent(session.patient_id, "transcription");
      if (!check.allowed) {
        setError(
          `Gravação bloqueada (LGPD): consentimento de gravação/transcrição não aceito` +
            (check.reason ? ` — ${check.reason}` : "") +
            ". Aceite o termo no hub do paciente antes de gravar.",
        );
        return;
      }
    } catch {
      setError(
        "Gravação bloqueada (LGPD): falha ao consultar consentimento. Ação bloqueada por proteção.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);
      setError(null);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await processAudio(audioBlob);
      };
      recorder.start();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setError(
        "Não foi possível acessar o microfone. Verifique a permissão no navegador.",
      );
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const proposeFromPaste = async () => {
    if (!session?.patient_id) return;
    if (!pasteTranscript.trim()) {
      setError("Cole a transcrição ou grave o áudio da sessão.");
      return;
    }
    setIsTranscribing(true);
    setError(null);
    try {
      const check = await checkConsent(session.patient_id, "transcription");
      if (!check.allowed) {
        setError(
          "Transcrição bloqueada (LGPD): aceite o consentimento de gravação/transcrição no hub do paciente.",
        );
        return;
      }
      const res = await proposeSessionTranscription(sessionId, {
        transcript_text: pasteTranscript.trim(),
      });
      versionRef.current = res.version;
      setVersion(res.version);
      setTranscriptText(res.transcript || pasteTranscript);
      setCfpDraft(res.proposal);
      setShowCfpPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar proposta CFP");
    } finally {
      setIsTranscribing(false);
    }
  };

  const applyCfpDraft = async () => {
    if (!cfpDraft) return;
    setError(null);
    try {
      const res = await applySessionTranscription(sessionId, {
        focus: cfpDraft.focus || "",
        evolution: cfpDraft.evolution || "",
        relevant_observations: cfpDraft.relevant_observations || "",
        interventions: cfpDraft.interventions || "",
        tasks: cfpDraft.tasks || "",
        planning: cfpDraft.planning || "",
        agreements: cfpDraft.agreements || "",
        store_transcript: true,
        version: versionRef.current,
      });
      setFocus(res.focus || cfpDraft.focus || "");
      setObservations(res.observations || cfpDraft.evolution || "");
      setEvents(res.events || cfpDraft.relevant_observations || "");
      setInterventions(res.interventions || cfpDraft.interventions || "");
      setTasks(res.tasks || cfpDraft.tasks || "");
      setPlanning(res.planning || cfpDraft.planning || "");
      setAgreements(res.agreements || cfpDraft.agreements || "");
      versionRef.current = res.version || versionRef.current + 1;
      setVersion(versionRef.current);
      setSaveState("Salvo");
      setShowCfpPreview(false);
      setHint(
        "Proposta CFP aplicada nas notas da sessão. O prontuário oficial só é criado no encerramento.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao aplicar proposta");
    }
  };

  if (error && !session) {
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
      {receipt && (
        <ReceiptModal
          patientName={receipt.patientName}
          amount={receipt.amount}
          description={receipt.description}
          method={receipt.method}
          onClose={() => {
            setReceipt(null);
            onClose();
          }}
        />
      )}

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
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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

            <section className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-emerald-900">
                    Gravação e proposta CFP
                  </h2>
                  <p className="mt-1 text-sm text-emerald-800/75">
                    Grava → transcreve → estrutura no modelo de prontuário do CFP.
                    Nada entra no prontuário oficial sem o seu aceite no encerramento.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={isTranscribing}
                      onClick={() => void startRecording()}
                    >
                      <Mic size={16} /> Gravar sessão
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm text-white"
                      onClick={stopRecording}
                    >
                      <MicOff size={16} /> Parar {formatRecTime(recordingSeconds)}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-xl border border-emerald-200 px-3 py-2 text-sm disabled:opacity-50"
                    disabled={isTranscribing || isRecording}
                    onClick={() => void proposeFromPaste()}
                  >
                    {isTranscribing ? "Processando…" : "Gerar proposta CFP"}
                  </button>
                </div>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-emerald-900">
                  Transcrição (opcional — cole se não gravar)
                </span>
                <textarea
                  className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white/80 px-3 py-2"
                  rows={3}
                  value={pasteTranscript}
                  onChange={(e) => setPasteTranscript(e.target.value)}
                  placeholder="Cole trechos da fala ou anotações brutas para estruturar no modelo CFP…"
                />
              </label>
              {hint && tab === "notas" && (
                <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>
              )}
            </section>

            <Field
              label="Foco"
              value={focus}
              rows={2}
              onChange={(v) => {
                setFocus(v);
                queueAutosave(draftPatch({ focus: v }));
              }}
            />
            <Field
              label="Evolução / observações (modelo CFP)"
              value={observations}
              rows={6}
              onChange={(v) => {
                setObservations(v);
                queueAutosave(draftPatch({ observations: v }));
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Observações relevantes"
                value={events}
                rows={3}
                onChange={(v) => {
                  setEvents(v);
                  queueAutosave(draftPatch({ events: v }));
                }}
              />
              <Field
                label="Intervenções"
                value={interventions}
                rows={3}
                onChange={(v) => {
                  setInterventions(v);
                  queueAutosave(draftPatch({ interventions: v }));
                }}
              />
              <Field
                label="Tarefas terapêuticas"
                value={tasks}
                rows={3}
                onChange={(v) => {
                  setTasks(v);
                  queueAutosave(draftPatch({ tasks: v }));
                }}
              />
              <Field
                label="Planejamento / próximo foco"
                value={planning}
                rows={3}
                onChange={(v) => {
                  setPlanning(v);
                  queueAutosave(draftPatch({ planning: v }));
                }}
              />
              <Field
                label="Combinados"
                value={agreements}
                rows={3}
                onChange={(v) => {
                  setAgreements(v);
                  queueAutosave(draftPatch({ agreements: v }));
                }}
              />
              <Field
                label="Hipóteses (rascunho da sessão)"
                value={hypotheses}
                rows={3}
                onChange={(v) => {
                  setHypotheses(v);
                  queueAutosave(draftPatch({ hypotheses: v }));
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
                <div>
                  <h3 className="mb-1 font-semibold text-emerald-800">Foco sugerido</h3>
                  <ul className="space-y-2">
                    {((aiResult.suggested_focus as string[]) || []).map((f) => (
                      <li
                        key={f}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      >
                        <span>{f}</span>
                        <button
                          className="rounded-lg border px-2 py-1 text-xs"
                          onClick={() => {
                            const next = focus ? `${focus}\n${f}` : f;
                            setFocus(next);
                            queueAutosave(draftPatch({ focus: next }));
                            setHint("Foco aceito nas notas da sessão.");
                          }}
                        >
                          Aceitar nas notas
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-emerald-800">Perguntas</h3>
                  <ul className="space-y-2">
                    {((aiResult.questions as string[]) || []).map((q) => (
                      <li
                        key={q}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      >
                        <span>{q}</span>
                        <button
                          className="rounded-lg border px-2 py-1 text-xs"
                          onClick={() => {
                            const next = planning
                              ? `${planning}\n• ${q}`
                              : `• ${q}`;
                            setPlanning(next);
                            queueAutosave(draftPatch({ planning: next }));
                            setHint("Pergunta aceita no planejamento.");
                          }}
                        >
                          Aceitar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "encerrar" && (
          <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white/70 p-5">
            <h2 className="font-serif text-xl text-emerald-950">Encerramento guiado</h2>
            <p className="text-sm text-emerald-800/80">
              Finalize o registro clínico, cobradiça/pacote e retorno — sem Google Calendar/Docs.
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

            {pendingCharge ? (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h3 className="font-semibold text-amber-950">Cobrança da sessão</h3>
                <p className="text-sm">
                  {pendingCharge.description || "Sessão"} · R$ {pendingCharge.amount}
                </p>
                <label className="block text-sm">
                  Forma de pagamento
                  <select
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="card">Cartão</option>
                    <option value="transfer">Transferência</option>
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
                    onClick={async () => {
                      await registerPayment({
                        charge_id: pendingCharge.id,
                        amount: pendingCharge.amount,
                        method: payMethod,
                      });
                      setReceipt({
                        patientName: pendingCharge.patientName,
                        amount: pendingCharge.amount,
                        description: pendingCharge.description,
                        method: payMethod,
                      });
                      setPendingCharge(null);
                    }}
                  >
                    Registrar pagamento e emitir recibo
                  </button>
                  <button
                    className="rounded-xl border px-4 py-2 text-sm"
                    onClick={onClose}
                  >
                    Deixar pendente e sair
                  </button>
                </div>
              </div>
            ) : (
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
                    setError(null);
                    try {
                      await autosaveSession(sessionId, {
                        ...draftPatch(),
                        version: versionRef.current,
                      });
                      const result = await closeSession(sessionId, true);
                      if (result.package) {
                        setHint(
                          `Sessão debitada do pacote (${result.package.used_sessions}/${result.package.total_sessions}; restam ${result.package.remaining_sessions}).`,
                        );
                        setTimeout(() => onClose(), 1200);
                      } else if (result.charge && result.charge.status !== "paid") {
                        setPendingCharge({
                          id: result.charge.id,
                          amount: result.charge.amount,
                          description: result.charge.description,
                          patientName:
                            result.charge.patient_display_name ||
                            session.patient_display_name ||
                            "Paciente",
                        });
                        setHint("Registro clínico finalizado. Confirme o recebimento.");
                      } else {
                        onClose();
                      }
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
            )}
          </section>
        )}
      </main>

      {showCfpPreview && cfpDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-50 pb-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-emerald-950">
                    Evolução estruturada (modelo CFP)
                  </h3>
                  <p className="text-sm text-emerald-700/80">
                    Sugestão revisável — não finaliza o prontuário. Aceite apenas preenche o
                    rascunho da sessão.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setShowCfpPreview(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Transcrição
                </span>
                <div className="h-[360px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700">
                  {transcriptText || "Nenhuma fala clara identificada."}
                </div>
              </div>
              <div className="space-y-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Proposta clínica (CFP)
                </span>
                <CfpEdit
                  label="Foco"
                  value={cfpDraft.focus || ""}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, focus: v })}
                />
                <CfpEdit
                  label="Evolução"
                  value={cfpDraft.evolution || ""}
                  rows={4}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, evolution: v })}
                />
                <CfpEdit
                  label="Observações relevantes"
                  value={cfpDraft.relevant_observations || ""}
                  onChange={(v) =>
                    setCfpDraft({ ...cfpDraft, relevant_observations: v })
                  }
                />
                <CfpEdit
                  label="Intervenções"
                  value={cfpDraft.interventions || ""}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, interventions: v })}
                />
                <CfpEdit
                  label="Tarefas"
                  value={cfpDraft.tasks || ""}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, tasks: v })}
                />
                <CfpEdit
                  label="Planejamento"
                  value={cfpDraft.planning || ""}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, planning: v })}
                />
                <CfpEdit
                  label="Combinados"
                  value={cfpDraft.agreements || ""}
                  onChange={(v) => setCfpDraft({ ...cfpDraft, agreements: v })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-emerald-50 pt-4 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-2xl border border-emerald-100 py-3 text-sm font-semibold text-emerald-800"
                onClick={() => setShowCfpPreview(false)}
              >
                Descartar
              </button>
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-sm font-semibold text-white"
                onClick={() => void applyCfpDraft()}
              >
                <FileCheck size={16} /> Aplicar nas notas da sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CfpEdit({
  label,
  value,
  rows = 2,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[10px] font-bold uppercase text-emerald-900">{label}</span>
      <textarea
        className="mt-1 w-full rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
