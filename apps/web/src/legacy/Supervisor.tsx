import { apiFetch } from "../lib/api";
import { generateUUID } from "../lib/uuid";
import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Sparkles,
  BookOpen,
  Send,
  Download,
  Copy,
  ChevronRight,
  HelpCircle,
  Activity,
  Info,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Heart,
  User,
  Calendar,
  ArrowRight,
  ClipboardCheck,
  MessageCircle,
  ShieldAlert,
  ListChecks,
  Check,
  Eye,
  Plus
} from "lucide-react";
import { addAuditLog, getPatients, getSessions, updateSession, Patient, Session } from "../lib/workspace";

// Type definitions matching the backend JSON schema
interface HipoteseClinica {
  descricao: string;
  dadosFavoraveis: string;
  dadosAusentesContrarios: string;
  explicacoesAlternativas: string;
  grauSustentacao: "Hipótese inicial" | "Hipótese moderadamente sustentada" | "Hipótese consistente com os dados disponíveis";
  oQueInvestigar: string;
}

interface PerguntaSugerida {
  pergunta: string;
  objetivoClinico: string;
}

interface Intervencao {
  tipo: "Primeira escolha" | "Alternativa" | "Considerar posteriormente";
  nome: string;
  objetivo: string;
  relacaoFormulacao: string;
  aplicacaoResumida: string;
  cuidados: string;
  alternativaMaisSimples: string;
}

interface PlanoProximaSessao {
  focoPrioritario: string;
  justificativa: string;
  objetivoObservavel: string;
  aberturaSugerida: string;
  etapas: string[];
  possiveisDificuldades: string;
  planoAlternativo: string;
  encerramento: string;
}

interface TarefaEntreSessoes {
  tarefaPrincipal: string;
  objetivo: string;
  instrucaoSimples: string;
  versaoReduzida: string;
  possiveisBarreiras: string;
  formaRevisao: string;
}

interface SupervisorAnalysisJSON {
  sinteseClinica: string;
  padroesManutencao: string;
  hipotesesClinicas: HipoteseClinica[];
  informacoesInvestigar: string[];
  recursosFatoresProtetores: string;
  planoProximaSessao: PlanoProximaSessao;
  perguntasSugeridas: PerguntaSugerida[];
  intervencoes: Intervencao[];
  tarefaEntreSessoes: TarefaEntreSessoes;
  relacaoTerapeutica: string | null;
  pontosAtencao: string;
  rascunhoProntuario: string;
}

interface SupervisorProps {
  token: string;
  spreadsheetId?: string;
  userEmail?: string;
  role?: string;
}

export default function Supervisor({ token, spreadsheetId, userEmail, role }: SupervisorProps) {
  // Core clinical states
  const [patientProfile, setPatientProfile] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [parsedAnalysis, setParsedAnalysis] = useState<SupervisorAnalysisJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; details?: string } | null>(null);

  // Workflow states
  const [objective, setObjective] = useState<"preparar" | "duvida" | "formular">("preparar");
  const [mandatoryDoubt, setMandatoryDoubt] = useState("");
  const [optionalDoubt, setOptionalDoubt] = useState("");
  const [sessionRange, setSessionRange] = useState<"ultimas-3" | "todas" | "escolher">("ultimas-3");
  const [approachCustomization, setApproachCustomization] = useState<
    "integrativa" | "priorizar-tcc" | "priorizar-esquema" | "impasse" | "adesao-tarefas" | "relacao-terapeutica"
  >("integrativa");

  // Panel toggles
  const [showCustomization, setShowCustomization] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Draft save states
  const [draftProntuarioText, setDraftProntuarioText] = useState("");
  const [saveTargetSessionId, setSaveTargetSessionId] = useState("");
  const [savingProntuario, setSavingProntuario] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Dynamic patient/session storage
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Diagnostic states
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  const getPatientName = (pId: string) => {
    const patient = patients.find(p => p.id === pId);
    return patient ? patient.nome_preferencial : "Paciente";
  };

  // Initial load
  useEffect(() => {
    if (spreadsheetId && token) {
      setLoadingData(true);
      Promise.all([
        getPatients(spreadsheetId, token),
        getSessions(spreadsheetId, token)
      ])
        .then(([patientsData, sessionsData]) => {
          setPatients(patientsData || []);
          setSessions(sessionsData || []);
        })
        .catch(err => {
          console.error("Erro ao carregar dados no Supervisor IA:", err);
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [spreadsheetId, token]);

  // Sync selectedSessionIds automatically based on sessionRange selection
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedSessionIds([]);
      return;
    }

    const patientSessions = sessions
      .filter(s => s.paciente_id === selectedPatientId)
      .sort((a, b) => b.data_hora.localeCompare(a.data_hora)); // Latest first chronologically

    if (sessionRange === "ultimas-3") {
      const latest3 = patientSessions.slice(0, 3).map(s => s.id);
      setSelectedSessionIds(latest3);
    } else if (sessionRange === "todas") {
      const all = patientSessions.map(s => s.id);
      setSelectedSessionIds(all);
    } else if (sessionRange === "escolher") {
      // Keep selected ones or fallback to latest if empty
      if (selectedSessionIds.length === 0 && patientSessions.length > 0) {
        setSelectedSessionIds([patientSessions[0].id]);
      }
    }
  }, [selectedPatientId, sessionRange, sessions]);

  // Set default saveTargetSessionId when selectedSessionIds syncs
  useEffect(() => {
    if (selectedSessionIds.length > 0) {
      // Sort to find the latest session from selected IDs
      const latestSelected = sessions
        .filter(s => selectedSessionIds.includes(s.id))
        .sort((a, b) => b.data_hora.localeCompare(a.data_hora))[0];
      if (latestSelected) {
        setSaveTargetSessionId(latestSelected.id);
      }
    } else if (selectedPatientId) {
      const latestOverall = sessions
        .filter(s => s.paciente_id === selectedPatientId)
        .sort((a, b) => b.data_hora.localeCompare(a.data_hora))[0];
      if (latestOverall) {
        setSaveTargetSessionId(latestOverall.id);
      }
    } else {
      setSaveTargetSessionId("");
    }
  }, [selectedSessionIds, selectedPatientId, sessions]);

  // Reactive compile of clinical case notes to send to backend
  useEffect(() => {
    if (!selectedPatientId) {
      setPatientProfile("");
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    const parts = [];
    parts.push(`--- PERFIL INTEGRAL DO PACIENTE: ${patient.nome_preferencial} ---`);
    parts.push(`Situação: ${patient.situacao || "Ativo"}`);
    parts.push(`Modalidade: ${patient.modalidade || "Online"}`);
    
    const pAny = patient as any;
    if (pAny.queixa_principal) parts.push(`Queixa Principal:\n${pAny.queixa_principal}`);
    if (pAny.historico) parts.push(`Histórico Clínico:\n${pAny.historico}`);
    if (pAny.objetivos) parts.push(`Objetivos Terapêuticos:\n${pAny.objetivos}`);
    if (pAny.esquemas_identificados) parts.push(`Esquemas Identificados:\n${pAny.esquemas_identificados}`);
    if (pAny.crencas_centrais) parts.push(`Crenças Centrais:\n${pAny.crencas_centrais}`);
    if (pAny.anotacoes_gerais) parts.push(`Anotações Gerais:\n${pAny.anotacoes_gerais}`);

    if (selectedSessionIds.length > 0) {
      parts.push(`\n--- ANOTAÇÕES DAS SESSÕES CONSIDERADAS (${selectedSessionIds.length}) ---`);
      
      const sortedSelectedSessions = sessions
        .filter(s => selectedSessionIds.includes(s.id))
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora)); // Chronological sort for analysis

      sortedSelectedSessions.forEach((sObj, index) => {
        const dateStr = new Date(sObj.data_hora).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
        parts.push(`[Atendimento nº ${index + 1} em ${dateStr} - Status: ${sObj.status}]`);
        if (sObj.foco) parts.push(`Foco da Sessão: ${sObj.foco}`);
        if (sObj.resumo) parts.push(`Notas de Evolução / Relato Clínico:\n${sObj.resumo}`);
        if (sObj.combinados_anterior) parts.push(`Combinados anteriores:\n${sObj.combinados_anterior}`);
        if (sObj.combinados_atual) parts.push(`Tarefas para casa / Combinados atuais:\n${sObj.combinados_atual}`);
        if (sObj.foco_sugerido) parts.push(`Plano/Foco sugerido:\n${sObj.foco_sugerido}`);
        if (sObj.supervisor_ia_sugestoes) parts.push(`Direcionamentos/Formulação IA anterior:\n${sObj.supervisor_ia_sugestoes}`);
        parts.push("");
      });
    } else {
      parts.push(`\n--- NENHUMA SESSÃO SELECIONADA NO MOMENTO ---`);
    }

    setPatientProfile(parts.join("\n\n"));
  }, [selectedPatientId, selectedSessionIds, patients, sessions]);

  const handlePatientChange = (pId: string) => {
    setSelectedPatientId(pId);
    setSessionRange("ultimas-3"); // reset to default range
    setSelectedSessionIds([]);
    setAnalysisResult("");
    setParsedAnalysis(null);
    setErrorState(null);
    setSaveSuccessMsg("");
  };

  const handleFetchDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const res = await apiFetch("/api/supervisor/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      } else {
        setDiagnostics({ error: "Erro ao obter diagnóstico. Código HTTP: " + res.status });
      }
    } catch (err: any) {
      setDiagnostics({ error: "Falha de conexão: " + (err.message || err) });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleToggleDiagnostics = () => {
    const nextState = !showDiagnostics;
    setShowDiagnostics(nextState);
    if (nextState && !diagnostics) {
      handleFetchDiagnostics();
    }
  };

  // Formats or extracts parsed JSON dynamically for display
  const displayAnalysis = (rawText: string) => {
    if (!rawText) {
      setParsedAnalysis(null);
      setAnalysisResult("");
      return;
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }

    try {
      const parsed = JSON.parse(cleaned);
      // Backend returns { version: "...", analysis: { ... } } or just raw object
      const actualAnalysisObj = parsed.analysis || parsed;
      setParsedAnalysis(actualAnalysisObj);
      setDraftProntuarioText(actualAnalysisObj.rascunhoProntuario || "");
      setAnalysisResult(rawText);
    } catch (e) {
      // Treat as raw text for backward compatibility
      setParsedAnalysis(null);
      setDraftProntuarioText("");
      setAnalysisResult(rawText);
    }
  };

  // Submit request to clinical supervisor backend
  const handleConsultAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId && !patientProfile.trim()) {
      alert("Por favor, selecione um paciente ou descreva o perfil queixa.");
      return;
    }

    if (objective === "duvida" && !mandatoryDoubt.trim()) {
      alert("Por favor, descreva a sua dúvida clínica principal.");
      return;
    }

    setLoading(true);
    setAnalysisResult("");
    setParsedAnalysis(null);
    setErrorState(null);
    setSaveSuccessMsg("");

    const getApproachLabel = (app: string) => {
      switch (app) {
        case "integrativa": return "Integração entre TCC e Terapia do Esquema";
        case "priorizar-tcc": return "Priorizar TCC";
        case "priorizar-esquema": return "Priorizar Terapia do Esquema";
        case "impasse": return "Analisar impasse terapêutico";
        case "adesao-tarefas": return "Avaliar adesão às tarefas";
        case "relacao-terapeutica": return "Explorar relação terapêutica";
        default: return "Integração entre TCC e Terapia do Esquema";
      }
    };

    const getObjectiveLabel = (obj: string) => {
      switch (obj) {
        case "preparar": return "Preparar próxima sessão (padrão)";
        case "duvida": return "Discutir uma dúvida clínica específica";
        case "formular": return "Atualizar formulação do caso";
        default: return "Preparar próxima sessão";
      }
    };

    // Build the contextHistory details based on user selection
    const contextDetails = [
      `Foco de Análise: ${getApproachLabel(approachCustomization)}`,
      `Objetivo da Supervisão: ${getObjectiveLabel(objective)}`
    ];

    if (objective === "duvida") {
      contextDetails.push(`DÚVIDA CLÍNICA OBRIGATÓRIA DA PSICÓLOGA:\n${mandatoryDoubt}`);
    } else if (optionalDoubt.trim()) {
      contextDetails.push(`Dúvida Opcional da Psicóloga:\n${optionalDoubt}`);
    }

    try {
      const res = await apiFetch("/api/supervisor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicalNotes: patientProfile,
          contextHistory: contextDetails.join("\n\n"),
          patientId: selectedPatientId
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Save version and structured JSON inside state
        if (data.analysis) {
          setParsedAnalysis(data.analysis);
          setDraftProntuarioText(data.analysis.rascunhoProntuario || "");
          setAnalysisResult(JSON.stringify(data.analysis, null, 2));
        } else {
          // Fallback if structured json field missing
          displayAnalysis(data.outputText || JSON.stringify(data, null, 2));
        }

        // Audit log
        if (spreadsheetId) {
          await addAuditLog(spreadsheetId, {
            id: generateUUID(),
            data_hora: new Date().toISOString(),
            usuario_email: userEmail || "usuario@serenapsi.com",
            perfil: role || "Psicóloga",
            acao: "Supervisor IA - Supervisão Gerada",
            detalhes: `Supervisão clínica realizada com sucesso para o paciente ID ${selectedPatientId}. Objetivo: ${objective}. Abordagem: ${approachCustomization}.`
          }, token).catch(err => console.error("Erro no log de auditoria:", err));
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorState({
          message: errData.error || "Erro ao obter consultoria do supervisor clínico.",
          details: errData.details
        });

        if (spreadsheetId) {
          await addAuditLog(spreadsheetId, {
            id: generateUUID(),
            data_hora: new Date().toISOString(),
            usuario_email: userEmail || "usuario@serenapsi.com",
            perfil: role || "Psicóloga",
            acao: "Supervisor IA - Erro de Geração",
            detalhes: `Falha na consulta do Supervisor Clínico IA. Status: ${res.status}. Detalhes: ${errData.details || errData.error}`
          }, token).catch(err => console.error("Erro no log de auditoria:", err));
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorState({
        message: "Erro de conexão ao consultar o supervisor.",
        details: err.message || "Não foi possível estabelecer contato com o servidor local."
      });
    } finally {
      setLoading(false);
    }
  };

  // Confirm and write the modified clinical draft directly to selected session in Google Sheets
  const handleSaveToProntuario = async () => {
    if (!selectedPatientId) return;
    if (!saveTargetSessionId) {
      alert("Por favor, selecione uma sessão para gravar este prontuário.");
      return;
    }

    const targetSession = sessions.find(s => s.id === saveTargetSessionId);
    if (!targetSession) {
      alert("Sessão não localizada no banco de dados.");
      return;
    }

    setSavingProntuario(true);
    setSaveSuccessMsg("");

    try {
      // Append or replace notes safely. Let's append with beautiful labels to prevent losing original notes
      const originalResumo = targetSession.resumo || "";
      const appendLabel = `\n\n--- REGISTRO CLÍNICO ADICIONAL (SUPERVISOR IA) ---\nData da Análise: ${new Date().toLocaleDateString("pt-BR")}\n${draftProntuarioText}`;
      
      const updatedSession: Session = {
        ...targetSession,
        resumo: (originalResumo + appendLabel).trim(),
        // Also save the AI Suggestions so it goes into the sheet records
        supervisor_ia_sugestoes: analysisResult
      };

      await updateSession(spreadsheetId!, updatedSession, token);

      // Update locally
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setSaveSuccessMsg(`Registro clínico gravado com sucesso no Prontuário da Sessão de dia ${new Date(updatedSession.data_hora).toLocaleDateString("pt-BR")}!`);
    } catch (err: any) {
      console.error("Erro ao salvar prontuário no Workspace:", err);
      alert("Falha ao gravar prontuário no Google Sheets: " + (err.message || err));
    } finally {
      setSavingProntuario(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(analysisResult);
    alert("Dados da análise copiados para a área de transferência!");
  };

  // Text representation for considered info review modal
  const getReviewText = () => {
    return patientProfile || "Nenhum dado de paciente ou histórico carregado no momento.";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in px-4 md:px-0 pb-16">
      
      {/* Title block */}
      <div className="bg-gradient-to-br from-emerald-50/50 to-white rounded-3xl p-6 border border-emerald-100/40 text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-serif italic text-emerald-950 flex items-center justify-center space-x-2">
          <BrainCircuit size={28} className="text-emerald-700 animate-pulse" />
          <span>Supervisor Clínico de IA</span>
        </h2>
        <p className="text-xs text-emerald-700/80 max-w-lg mx-auto leading-relaxed">
          Raciocínio clínico de nível sênior em TCC e Terapia do Esquema para apoiar a reflexão diagnóstica, formulação e planejamento de sessões.
        </p>
      </div>

      {/* Main Single Column Form */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/30 space-y-6">
        <h3 className="text-lg font-serif italic text-emerald-950 flex items-center space-x-2 pb-3 border-b border-emerald-50">
          <Sparkles className="text-emerald-700" size={18} />
          <span>Nova Supervisão Clínica</span>
        </h3>

        <form onSubmit={handleConsultAi} className="space-y-6 text-xs">
          
          {/* Step 1: Patient Selection */}
          <div className="space-y-2">
            <label className="text-xs text-emerald-950 font-bold block flex items-center space-x-1.5">
              <span className="bg-emerald-100 text-emerald-800 rounded-full w-4 h-4 text-[10px] font-mono flex items-center justify-center">1</span>
              <span>Selecionar Paciente</span>
            </label>
            <select
              value={selectedPatientId}
              onChange={e => handlePatientChange(e.target.value)}
              className="w-full p-3 border border-emerald-100 rounded-xl bg-emerald-50/5 text-emerald-950 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none transition"
            >
              <option value="">-- Escolher Paciente ou Criar Livre --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome_preferencial} ({p.situacao})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Supervision Objective */}
          <div className="space-y-2">
            <label className="text-xs text-emerald-950 font-bold block flex items-center space-x-1.5">
              <span className="bg-emerald-100 text-emerald-800 rounded-full w-4 h-4 text-[10px] font-mono flex items-center justify-center">2</span>
              <span>Objetivo da Supervisão</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setObjective("preparar")}
                className={`p-3 rounded-xl border text-left transition relative cursor-pointer ${
                  objective === "preparar"
                    ? "bg-emerald-50/40 border-emerald-500 text-emerald-950 font-bold"
                    : "bg-white border-emerald-100 text-emerald-800 hover:bg-emerald-50/30"
                }`}
              >
                <div className="font-semibold text-xs">Preparar próxima sessão</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Planejamento e intervenções ideais.</div>
              </button>

              <button
                type="button"
                onClick={() => setObjective("duvida")}
                className={`p-3 rounded-xl border text-left transition relative cursor-pointer ${
                  objective === "duvida"
                    ? "bg-emerald-50/40 border-emerald-500 text-emerald-950 font-bold"
                    : "bg-white border-emerald-100 text-emerald-800 hover:bg-emerald-50/30"
                }`}
              >
                <div className="font-semibold text-xs">Discutir dúvida clínica</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Foco em dilema específico do caso.</div>
              </button>

              <button
                type="button"
                onClick={() => setObjective("formular")}
                className={`p-3 rounded-xl border text-left transition relative cursor-pointer ${
                  objective === "formular"
                    ? "bg-emerald-50/40 border-emerald-500 text-emerald-950 font-bold"
                    : "bg-white border-emerald-100 text-emerald-800 hover:bg-emerald-50/30"
                }`}
              >
                <div className="font-semibold text-xs">Atualizar formulação</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Conexão entre crenças, esquemas e queixas.</div>
              </button>
            </div>

            {objective === "duvida" && (
              <div className="pt-2 animate-fade-in space-y-1.5">
                <label className="text-[10px] text-emerald-900 font-bold block">Qual a dúvida principal sobre este caso? *</label>
                <textarea
                  required
                  rows={3}
                  value={mandatoryDoubt}
                  onChange={e => setMandatoryDoubt(e.target.value)}
                  placeholder="Ex: Como posso confrontar empaticamente o paciente sobre o atraso nas tarefas sem ativar seu esquema de rejeição?"
                  className="w-full p-3 border border-emerald-200 rounded-xl bg-white text-emerald-950 resize-none leading-relaxed focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Step 3: Session Range Selection (Only if patient is selected) */}
          {selectedPatientId && (
            <div className="space-y-3 bg-emerald-50/15 p-4 rounded-2xl border border-emerald-100/40 animate-fade-in">
              <label className="text-xs text-emerald-950 font-bold block flex items-center space-x-1.5">
                <span className="bg-emerald-100 text-emerald-800 rounded-full w-4 h-4 text-[10px] font-mono flex items-center justify-center">3</span>
                <span>Sessões Consideradas</span>
              </label>

              <div className="flex gap-2 pb-1">
                {(["ultimas-3", "todas", "escolher"] as const).map(range => {
                  const rangeLabel = range === "ultimas-3" ? "Últimas 3 sessões" : range === "todas" ? "Todas as sessões" : "Escolher sessões";
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setSessionRange(range)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition text-[10px] cursor-pointer ${
                        sessionRange === range
                          ? "bg-emerald-700 text-white border-emerald-700"
                          : "bg-white text-emerald-800 border-emerald-100 hover:bg-emerald-50"
                      }`}
                    >
                      {rangeLabel}
                    </button>
                  );
                })}
              </div>

              {/* Checkbox list of sessions if choosing manually */}
              {sessionRange === "escolher" && (
                <div className="border border-emerald-100/60 rounded-xl p-3 bg-white space-y-1.5 max-h-36 overflow-y-auto animate-fade-in">
                  {sessions.filter(s => s.paciente_id === selectedPatientId).length > 0 ? (
                    sessions
                      .filter(s => s.paciente_id === selectedPatientId)
                      .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
                      .map(s => {
                        const dateStr = new Date(s.data_hora).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        });
                        const isChecked = selectedSessionIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-start space-x-2 p-1.5 hover:bg-emerald-50/50 rounded-lg cursor-pointer transition text-[11px] text-emerald-950 select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const nextIds = isChecked
                                  ? selectedSessionIds.filter(id => id !== s.id)
                                  : [...selectedSessionIds, s.id];
                                setSelectedSessionIds(nextIds);
                              }}
                              className="mt-0.5 rounded border-emerald-200 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                            />
                            <span className="flex-1">
                              <strong>{dateStr}</strong> {s.foco ? ` - ${s.foco}` : ""} <span className="text-[9px] text-emerald-600/70 font-mono">({s.status})</span>
                            </span>
                          </label>
                        );
                      })
                  ) : (
                    <p className="text-[10px] text-emerald-600/60 italic p-1">Nenhuma sessão registrada para este paciente.</p>
                  )}
                </div>
              )}

              {/* Informative summary of selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-emerald-100/40 text-[11px] text-emerald-800">
                <span className="font-medium flex items-center gap-1">
                  <ClipboardCheck size={14} className="text-emerald-700" />
                  <span>
                    {selectedSessionIds.length === 0
                      ? "Nenhuma sessão selecionada. Serão considerados apenas os dados cadastrais."
                      : selectedSessionIds.length === 1
                      ? `Será considerada 1 sessão selecionada.`
                      : `Serão consideradas ${selectedSessionIds.length} sessões de atendimento.`}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="text-emerald-900 hover:text-emerald-950 font-bold underline transition cursor-pointer text-left shrink-0"
                >
                  Revisar informações consideradas
                </button>
              </div>
            </div>
          )}

          {/* Fallback free-form text input if no patient selected */}
          {!selectedPatientId && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-xs text-emerald-950 font-bold block">Perfil e Anotações Clínicas do Caso *</label>
              <textarea
                required
                rows={6}
                value={patientProfile}
                onChange={e => setPatientProfile(e.target.value)}
                placeholder="Ex: Paciente com sentimentos crônicos de inadequação, medo de abandono exagerado..."
                className="w-full p-3 border border-emerald-100 rounded-xl bg-emerald-50/5 text-emerald-950 resize-none leading-relaxed focus:ring-1 focus:ring-emerald-700 focus:outline-none"
              />
              <span className="text-[10px] text-emerald-600/70 block">Nota: Por privacidade, use pseudônimos ou iniciais. Nunca insira nomes reais completos ou CPFs.</span>
            </div>
          )}

          {/* Step 4: Optional Doubt (only if objective is NOT discuss specific doubt) */}
          {objective !== "duvida" && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-xs text-emerald-950 font-bold block flex items-center space-x-1.5">
                <span className="bg-emerald-100 text-emerald-800 rounded-full w-4 h-4 text-[10px] font-mono flex items-center justify-center">4</span>
                <span>Dúvida ou Foco de Atenção Opcional</span>
              </label>
              <input
                type="text"
                value={optionalDoubt}
                onChange={e => setOptionalDoubt(e.target.value)}
                placeholder="Ex: Gostaria de focar no modo esquemático Protetor Desconectado que apareceu."
                className="w-full p-3 border border-emerald-100 rounded-xl bg-emerald-50/5 text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
          )}

          {/* Customizable analysis settings (Collapsible) */}
          <div className="border border-emerald-50 rounded-2xl bg-emerald-50/5 p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowCustomization(!showCustomization)}
              className="w-full flex items-center justify-between text-emerald-900 font-bold hover:text-emerald-950 transition cursor-pointer text-left"
            >
              <span className="flex items-center gap-1.5 text-xs">
                <Activity size={15} />
                Personalizar análise ({showCustomization ? "Fechar" : "Abrir"})
              </span>
              {showCustomization ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showCustomization && (
              <div className="space-y-3 pt-2.5 border-t border-emerald-100/30 animate-fade-in">
                <label className="text-[10px] text-emerald-950 uppercase font-bold block">Abordagem de Análise Prioritária</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: "integrativa", label: "Integração entre TCC e Terapia do Esquema (Padrão)" },
                    { key: "priorizar-tcc", label: "Priorizar TCC" },
                    { key: "priorizar-esquema", label: "Priorizar Terapia do Esquema" },
                    { key: "impasse", label: "Analisar impasse terapêutico" },
                    { key: "adesao-tarefas", label: "Avaliar adesão às tarefas" },
                    { key: "relacao-terapeutica", label: "Explorar relação terapêutica" }
                  ].map(option => (
                    <label
                      key={option.key}
                      onClick={() => setApproachCustomization(option.key as any)}
                      className={`flex items-start space-x-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition ${
                        approachCustomization === option.key
                          ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold"
                          : "bg-white border-emerald-100/70 text-emerald-800 hover:bg-emerald-50/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="approach-customization"
                        checked={approachCustomization === option.key}
                        onChange={() => {}}
                        className="mt-0.5 text-emerald-700 focus:ring-emerald-600"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-serif italic text-base py-3.5 rounded-2xl shadow transition cursor-pointer flex items-center justify-center space-x-2"
          >
            <Sparkles size={18} />
            <span>{loading ? "Gerando supervisão..." : "Gerar supervisão"}</span>
          </button>

        </form>
      </div>

      {/* Loading Display */}
      {loading && (
        <div className="bg-white rounded-3xl p-8 border border-emerald-100/40 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mx-auto" />
          <div className="space-y-1">
            <h4 className="font-serif italic text-lg text-emerald-950">Análise do Supervisor IA em andamento</h4>
            <p className="text-xs text-emerald-700/80 max-w-sm mx-auto leading-relaxed">
              O modelo está formulando as hipóteses clínicas do paciente e estruturando o planejamento da próxima sessão...
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {errorState && (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-950 space-y-4 animate-fade-in">
          <div className="flex items-center space-x-2.5 text-amber-800 font-bold">
            <HelpCircle size={22} className="text-amber-600 shrink-0" />
            <span className="text-base">{errorState.message}</span>
          </div>
          {errorState.details && (
            <div className="text-xs text-amber-900/90 whitespace-pre-line leading-relaxed bg-amber-100/30 p-4 rounded-xl border border-amber-200/50 font-sans">
              {errorState.details}
            </div>
          )}
        </div>
      )}

      {/* Results Section (Structured Cards Output) */}
      {parsedAnalysis && !loading && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h3 className="text-xl font-serif italic text-emerald-950 flex items-center space-x-2">
              <Sparkles size={20} className="text-yellow-500" />
              <span>Resultado da Supervisão</span>
            </h3>
            <button
              onClick={handleCopyToClipboard}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center space-x-1 transition"
            >
              <Copy size={13} />
              <span>Copiar JSON Completo</span>
            </button>
          </div>

          {/* CARD 1: Síntese Clínica & Recursos */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">01. Síntese Clínica</span>
              <p className="text-xs text-emerald-950 leading-relaxed font-sans font-normal">
                {parsedAnalysis.sinteseClinica}
              </p>
            </div>
            
            <div className="pt-4 border-t border-emerald-50 space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1">
                <Heart size={12} className="text-red-500" />
                <span>Recursos Clínicos & Fatores Protetores</span>
              </span>
              <p className="text-xs text-emerald-950 leading-relaxed font-sans font-normal">
                {parsedAnalysis.recursosFatoresProtetores}
              </p>
            </div>
          </div>

          {/* CARD 2: Padrões de Manutenção Perpetuadores */}
          <div className="bg-emerald-50/20 rounded-3xl p-6 md:p-8 border border-emerald-100/30 space-y-2">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">02. Ciclo e Padrões de Manutenção</span>
            <p className="text-xs text-emerald-950 leading-relaxed font-sans font-normal italic">
              {parsedAnalysis.padroesManutencao}
            </p>
          </div>

          {/* CARD 3: Hipóteses Clínicas de Caso (Raciocínio Clínico Avançado) */}
          <div className="space-y-4">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">03. Hipóteses de Caso Clínico</span>
            <div className="space-y-4">
              {parsedAnalysis.hipotesesClinicas?.map((hip, idx) => {
                const getSustentacaoBadge = (level: string) => {
                  if (level.includes("consistente")) {
                    return "bg-emerald-100 text-emerald-800 border-emerald-200";
                  }
                  if (level.includes("moderadamente")) {
                    return "bg-amber-100 text-amber-800 border-amber-200";
                  }
                  return "bg-slate-100 text-slate-800 border-slate-200";
                };

                return (
                  <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-50 pb-2">
                      <span className="font-serif italic text-xs text-emerald-950 font-bold">
                        Hipótese #{idx + 1}: {hip.descricao.slice(0, 50)}{hip.descricao.length > 50 ? "..." : ""}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold font-sans ${getSustentacaoBadge(hip.grauSustentacao)}`}>
                        {hip.grauSustentacao}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-emerald-800">Descrição Detalhada</span>
                        <p className="text-emerald-950 leading-relaxed">{hip.descricao}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-emerald-800">Dados Clínicos Favoráveis</span>
                        <p className="text-emerald-950 leading-relaxed">{hip.dadosFavoraveis}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-emerald-800">Dados Ausentes ou Contrários</span>
                        <p className="text-emerald-950 leading-relaxed">{hip.dadosAusentesContrarios}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-emerald-800">Explicações Alternativas</span>
                        <p className="text-emerald-950 leading-relaxed">{hip.explicacoesAlternativas}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-emerald-50 mt-2 text-xs text-emerald-900 bg-emerald-50/10 p-2.5 rounded-xl">
                      <span className="font-bold text-[10px] block uppercase text-emerald-950 mb-0.5">O que investigar para validar:</span>
                      <p className="italic">{hip.oQueInvestigar}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 4: Lacunas & Informações a Investigar */}
          {parsedAnalysis.informacoesInvestigar && parsedAnalysis.informacoesInvestigar.length > 0 && (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-3 font-sans">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">04. Lacunas de Informação & O que Investigar</span>
              <ul className="space-y-2 text-xs text-emerald-950">
                {parsedAnalysis.informacoesInvestigar.map((inf, index) => (
                  <li key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="mt-1 text-emerald-700 font-bold">•</span>
                    <span>{inf}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CARD 5: STAR CARD - Planejamento para a Próxima Sessão */}
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-md space-y-5 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-emerald-300 tracking-wider">05. Roteiro Clínico Estruturado</span>
                <h4 className="font-serif italic text-lg text-emerald-50">Planejamento para a Próxima Sessão</h4>
              </div>
              <Calendar className="text-emerald-400" size={24} />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Foco Prioritário</span>
                <p className="text-emerald-50 mt-0.5 leading-relaxed font-medium text-sm">{parsedAnalysis.planoProximaSessao.focoPrioritario}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Justificativa Clínica</span>
                  <p className="text-emerald-100/90 mt-0.5 leading-relaxed">{parsedAnalysis.planoProximaSessao.justificativa}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Objetivo Observável</span>
                  <p className="text-emerald-100/90 mt-0.5 leading-relaxed">{parsedAnalysis.planoProximaSessao.objetivoObservavel}</p>
                </div>
              </div>

              <div className="bg-emerald-800/40 p-3.5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Abertura de Sessão Sugerida</span>
                <p className="italic text-emerald-50">"{parsedAnalysis.planoProximaSessao.aberturaSugerida}"</p>
              </div>

              {/* Steps (Até 3 etapas) */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Passo a Passo Recomendado</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-emerald-950 font-sans">
                  {parsedAnalysis.planoProximaSessao.etapas?.map((etapa, idx) => (
                    <div key={idx} className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2.5">
                      <span className="bg-emerald-800 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                      <p className="text-[11px] leading-normal font-normal text-emerald-950">{etapa}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Dificuldades Previstas</span>
                  <p className="text-emerald-100/90 mt-0.5 leading-relaxed">{parsedAnalysis.planoProximaSessao.possiveisDificuldades}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Plano Alternativo (Contingência)</span>
                  <p className="text-emerald-100/90 mt-0.5 leading-relaxed">{parsedAnalysis.planoProximaSessao.planoAlternativo}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Condução para o Encerramento</span>
                <p className="text-emerald-100/90 mt-0.5 leading-relaxed italic">{parsedAnalysis.planoProximaSessao.encerramento}</p>
              </div>
            </div>
          </div>

          {/* CARD 6: Perguntas Clínicas / Socráticas */}
          {parsedAnalysis.perguntasSugeridas && parsedAnalysis.perguntasSugeridas.length > 0 && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">06. Perguntas Reflexivas de Questionamento Socrático</span>
              <div className="space-y-2.5">
                {parsedAnalysis.perguntasSugeridas.map((per, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/30 flex items-start gap-3">
                    <MessageCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1 text-xs font-sans">
                      <p className="font-semibold text-emerald-950">"{per.pergunta}"</p>
                      <p className="text-[10px] text-emerald-700"><strong className="text-[9px] uppercase tracking-wider block mt-0.5 text-emerald-800/80">Objetivo Clínico:</strong> {per.objetivoClinico}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CARD 7: Intervenções Estratégicas */}
          {parsedAnalysis.intervencoes && parsedAnalysis.intervencoes.length > 0 && (
            <div className="space-y-4">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">07. Intervenções Clínicas Recomendadas</span>
              <div className="space-y-4">
                {parsedAnalysis.intervencoes.map((intv, idx) => {
                  const getPriorityBadge = (priority: string) => {
                    if (priority.includes("Primeira")) {
                      return "bg-emerald-100 text-emerald-800 border-emerald-200";
                    }
                    if (priority.includes("Alternativa")) {
                      return "bg-amber-100 text-amber-800 border-amber-200";
                    }
                    return "bg-slate-100 text-slate-800 border-slate-200";
                  };

                  return (
                    <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-3 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-50 pb-2">
                        <span className="font-serif italic text-xs text-emerald-950 font-bold">
                          {intv.nome}
                        </span>
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-bold font-sans ${getPriorityBadge(intv.tipo)}`}>
                          {intv.tipo}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-emerald-800">Objetivo Terapêutico</span>
                          <p className="text-emerald-950 leading-relaxed">{intv.objetivo}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-emerald-800">Relação com a Formulação</span>
                          <p className="text-emerald-950 leading-relaxed">{intv.relacaoFormulacao}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-emerald-800">Aplicação Prática</span>
                          <p className="text-emerald-950 leading-relaxed">{intv.aplicacaoResumida}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-emerald-800">Cuidados & Alertas</span>
                          <p className="text-emerald-950 leading-relaxed">{intv.cuidados}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-50 mt-1.5 text-xs text-emerald-800 bg-emerald-50/10 p-2 rounded-xl">
                        <span className="font-bold text-[9px] block uppercase text-emerald-950 mb-0.5">Versão simplificada para iniciantes:</span>
                        <p className="italic">"{intv.alternativaMaisSimples}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CARD 8: Tarefa entre Sessões */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-4 font-sans">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">08. Tarefa de Casa (Ponte Terapêutica)</span>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-emerald-800/80">Proposta de Tarefa Principal</span>
                <p className="font-semibold text-emerald-950 text-sm mt-0.5">{parsedAnalysis.tarefaEntreSessoes.tarefaPrincipal}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-800/80">Objetivo Terapêutico</span>
                  <p className="text-emerald-900 mt-0.5">{parsedAnalysis.tarefaEntreSessoes.objetivo}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-800/80">Como instruir o paciente</span>
                  <p className="text-emerald-900 mt-0.5 italic">"{parsedAnalysis.tarefaEntreSessoes.instrucaoSimples}"</p>
                </div>
              </div>

              <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/30 space-y-2 font-sans">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-800/80">Versão Reduzida (Alternativa)</span>
                    <p className="text-[11px] text-emerald-950">{parsedAnalysis.tarefaEntreSessoes.versaoReduzida}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-800/80">Possíveis Barreiras</span>
                    <p className="text-[11px] text-emerald-950">{parsedAnalysis.tarefaEntreSessoes.possiveisBarreiras}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-800/80">Forma de Revisão</span>
                    <p className="text-[11px] text-emerald-950">{parsedAnalysis.tarefaEntreSessoes.formaRevisao}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 9: Relação Terapêutica (Se houver) */}
          {parsedAnalysis.relacaoTerapeutica && (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-2 font-sans animate-fade-in">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1">
                <Heart size={12} className="text-red-500" />
                <span>09. Aliança & Relação Terapêutica</span>
              </span>
              <p className="text-xs text-emerald-950 leading-relaxed font-normal">
                {parsedAnalysis.relacaoTerapeutica}
              </p>
            </div>
          )}

          {/* CARD 10: Pontos de Atenção / Segurança */}
          <div className="bg-amber-50/30 border border-amber-200/50 rounded-3xl p-6 md:p-8 space-y-3 font-sans">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-700" />
              <span>10. Alertas Clínicos & Pontos de Atenção</span>
            </span>
            <p className="text-xs text-amber-950 leading-relaxed font-normal">
              {parsedAnalysis.pontosAtencao}
            </p>
          </div>

          {/* CARD 11: Rascunho para Prontuário (Com confirmação direta de salvamento) */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-4 font-sans">
            <div className="flex items-center space-x-2 border-b border-emerald-50 pb-2">
              <ClipboardCheck className="text-emerald-700 shrink-0" size={18} />
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-emerald-800 tracking-wider">11. Registro Clínico de Prontuário</span>
                <h4 className="font-serif italic text-base text-emerald-950">Rascunho de Registro Técnico</h4>
              </div>
            </div>

            <p className="text-[10px] text-emerald-600/80 leading-relaxed">
              O texto abaixo foi gerado tecnicamente para o prontuário do paciente. Você pode revisá-lo e editá-lo no campo abaixo antes de confirmar o registro na planilha.
            </p>

            <textarea
              rows={8}
              value={draftProntuarioText}
              onChange={e => setDraftProntuarioText(e.target.value)}
              className="w-full p-3.5 border border-emerald-100 rounded-2xl bg-emerald-50/10 text-xs text-emerald-950 resize-none font-sans leading-relaxed focus:ring-1 focus:ring-emerald-700 focus:outline-none"
            />

            {/* Confirmation Flow */}
            <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/30 space-y-3">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Confirmar e Gravar no Prontuário</span>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] text-emerald-800/80 block font-bold">Escolha a sessão para salvar:</span>
                  <select
                    value={saveTargetSessionId}
                    onChange={e => setSaveTargetSessionId(e.target.value)}
                    className="w-full p-2 border border-emerald-100 rounded-xl bg-white text-emerald-950 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                  >
                    <option value="">-- Selecione a Sessão --</option>
                    {sessions
                      .filter(s => s.paciente_id === selectedPatientId)
                      .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
                      .map(s => {
                        const sDate = new Date(s.data_hora).toLocaleDateString("pt-BR");
                        return (
                          <option key={s.id} value={s.id}>
                            Sessão de {sDate} ({s.foco || "Sem foco definido"})
                          </option>
                        );
                      })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToProntuario}
                  disabled={savingProntuario || !saveTargetSessionId}
                  className="sm:self-end bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-serif italic text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shrink-0"
                >
                  {savingProntuario ? "Gravando..." : "Confirmar e Gravar Prontuário"}
                </button>
              </div>

              {saveSuccessMsg && (
                <div className="bg-emerald-100/60 text-emerald-900 text-[11px] p-2.5 rounded-xl border border-emerald-200/50 flex items-center gap-1.5 animate-fade-in font-medium">
                  <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Legacy Fallback Text Area (If raw markdown text was returned) */}
      {analysisResult && !parsedAnalysis && !loading && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-50 pb-2">
            <h3 className="text-xl font-serif italic text-emerald-950 flex items-center space-x-2">
              <Sparkles size={18} className="text-yellow-500" />
              <span>Análise do Supervisor IA (Texto)</span>
            </h3>
            <button
              onClick={handleCopyToClipboard}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1"
            >
              <Copy size={13} />
              <span>Copiar Texto</span>
            </button>
          </div>

          <div className="bg-emerald-50/5 border border-emerald-100/40 p-5 rounded-2xl max-h-[500px] overflow-y-auto pr-2 text-xs text-emerald-950 leading-relaxed font-sans whitespace-pre-wrap">
            {analysisResult}
          </div>
        </div>
      )}

      {/* Patient Supervision Activity History (When no analysis active) */}
      {!analysisResult && !loading && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 space-y-5">
          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/40">
            <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider mb-1 font-serif italic">
              {selectedPatientId ? `Supervisões Anteriores de ${getPatientName(selectedPatientId)}` : "Atividade Recente do Supervisor IA"}
            </h4>
            <p className="text-[11px] text-emerald-700/80">
              Histórico de sugestões, condutas e planos gerados para embasamento dos atendimentos clínicos.
            </p>
          </div>

          {/* Filter list */}
          {(selectedPatientId 
            ? sessions.filter(s => s.paciente_id === selectedPatientId && s.supervisor_ia_sugestoes)
            : sessions.filter(s => s.supervisor_ia_sugestoes)
          ).length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 text-xs">
              {(selectedPatientId 
                ? sessions.filter(s => s.paciente_id === selectedPatientId && s.supervisor_ia_sugestoes)
                : sessions.filter(s => s.supervisor_ia_sugestoes)
              )
                .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
                .slice(0, 5)
                .map(s => {
                  const sDate = new Date(s.data_hora).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  });
                  const pName = getPatientName(s.paciente_id);
                  return (
                    <div key={s.id} className="bg-white p-4 rounded-2xl border border-emerald-100/70 shadow-xs flex justify-between items-center hover:border-emerald-200 transition">
                      <div className="space-y-1">
                        <span className="font-bold text-emerald-950 font-sans block">{pName}</span>
                        <span className="text-[9px] text-emerald-600 font-mono block">Atendimento em {sDate}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => displayAnalysis(s.supervisor_ia_sugestoes || "")}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                      >
                        Visualizar Análise
                      </button>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-emerald-100 rounded-2xl p-6 bg-emerald-50/10">
              <BrainCircuit size={32} className="text-emerald-300 mb-2" />
              <h5 className="font-bold text-emerald-950 text-xs">Nenhuma supervisão registrada</h5>
              <p className="text-[11px] text-emerald-600/70 max-w-xs mt-1 leading-relaxed">
                Utilize o formulário acima para realizar a sua primeira consulta teórica com o supervisor de inteligência artificial.
              </p>
            </div>
          )}
        </div>
      )}

      {/* REVIEW CONSIDERED INFORMATION MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-emerald-100/50 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-emerald-50 pb-3">
              <h4 className="font-serif italic text-base text-emerald-950 flex items-center space-x-2">
                <Info size={18} className="text-emerald-700" />
                <span>Dados que serão enviados à IA</span>
              </h4>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-emerald-700 hover:text-emerald-950 font-bold text-xs"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-xs text-emerald-950 leading-relaxed font-mono whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-3">
              {getReviewText()}
            </div>

            <div className="border-t border-emerald-50 pt-3 mt-4 text-[10px] text-emerald-600/80 leading-relaxed">
              ⚠️ <strong>IMPORTANTE:</strong> Esta visualização representa o prontuário integrado e compilado que o SerenaPsi irá encaminhar para o modelo do Gemini. Verifique se existem informações pessoais confidenciais adicionais que prefira remover antes de prosseguir.
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic settings panel */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-100/30 space-y-3">
        <button
          type="button"
          onClick={handleToggleDiagnostics}
          className="w-full flex items-center justify-between text-emerald-950 hover:text-emerald-800 transition cursor-pointer text-left"
        >
          <div className="flex items-center space-x-2">
            <Activity size={18} className="text-emerald-700 animate-pulse" />
            <span className="font-serif italic text-sm">Diagnóstico de Chaves de API</span>
          </div>
          {showDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDiagnostics && (
          <div className="pt-2 border-t border-emerald-50 space-y-3 animate-fade-in text-xs">
            {diagnosticsLoading ? (
              <div className="flex items-center space-x-2 py-4 justify-center text-emerald-800 font-medium">
                <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-700 animate-spin rounded-full" />
                <span className="text-[11px]">Consultando status...</span>
              </div>
            ) : diagnostics ? (
              diagnostics.error ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-900 text-[11px]">
                  {diagnostics.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2 font-mono text-[10px] text-slate-700">
                    <div className="flex justify-between">
                      <span>Chave Configurada:</span>
                      <span className="font-bold">{diagnostics.apiKeyConfigured ? "SIM (Ativa)" : "NÃO"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Formato Mascarado:</span>
                      <span className="font-bold text-emerald-700 select-all">{diagnostics.apiKeyMasked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prefixo:</span>
                      <span className="font-bold select-all">{diagnostics.apiKeyPrefix || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Comprimento:</span>
                      <span>{diagnostics.apiKeyLength}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SDK Library:</span>
                      <span>{diagnostics.initializationParams?.libName || "@google/genai"}</span>
                    </div>
                  </div>

                  <p className="text-[10px] opacity-95 leading-relaxed font-sans text-emerald-950 bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-100/20">
                    {diagnostics.recommendation}
                  </p>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>

      {/* Ethical warning footer */}
      <div className="text-[10px] text-emerald-600/60 leading-relaxed text-center max-w-md mx-auto pt-4">
        ⚠️ <strong>AVISO ÉTICO:</strong> Esta ferramenta constitui apoio complementar à reflexão científica e tomada de decisão diagnóstica da psicóloga, não devendo jamais substituir o parecer profissional, a supervisão humana qualificada ou as regras normativas do Conselho Federal de Psicologia.
      </div>

    </div>
  );
}
