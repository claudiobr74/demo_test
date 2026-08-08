import { apiFetch } from "../lib/api";
import { generateUUID } from "../lib/uuid";
import React, { useState, useEffect, useRef } from "react";
import {
  BrainCircuit,
  Save,
  CheckCircle,
  FileCheck,
  Calendar,
  DollarSign,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  BookOpen,
  ChevronRight,
  Printer,
  Video,
  Copy,
  Check,
  HelpCircle,
  Mic,
  MicOff,
  Loader2,
  Square,
  X
} from "lucide-react";
import {
  Patient,
  Session,
  FinancialRecord,
  DocRecord,
  addSession,
  updateSession,
  getSessions,
  addFinancial,
  createCalendarEvent,
  generateDocumentFromTemplate,
  addDocRecord,
  addAuditLog,
  createGoogleMeetSpace
} from "../lib/workspace";
import { decrementSessionBalance, getPatientPackages, PatientPackage } from "../lib/packages";
import { saveCobrancaApi } from "../lib/financeApi";
import { Cobranca } from "./finance/FinanceTypes";
import { googleFetch as fetch } from "../lib/googleFetch";

// Module-level cache to prevent duplicate session creations due to React concurrent or double-rendering in StrictMode
const pendingSessions: Record<string, Session> = {};

interface ActiveSessionProps {
  token: string;
  spreadsheetId: string;
  modelsFolderId: string;
  docsFolderId: string;
  patientId: string; // if starting session for patient
  sessionId?: string; // if resuming draft
  userEmail: string;
  role: string;
  onClose: () => void;
}

export default function ActiveSession({
  token,
  spreadsheetId,
  modelsFolderId,
  docsFolderId,
  patientId,
  sessionId,
  userEmail,
  role,
  onClose
}: ActiveSessionProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activePackage, setActivePackage] = useState<PatientPackage | null>(null);
  
  const [currentPatientId, setCurrentPatientId] = useState<string>(patientId);
  const [searchTerm, setSearchTerm] = useState("");

  // UI Loading and Saving states
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<"Salvo" | "Salvando..." | "Erro ao Salvar">("Salvo");
  const [activeTab, setActiveTab] = useState<"notas" | "supervisor">("notas");

  // Clinical inputs
  const [resumoText, setResumoText] = useState("");
  const [focoText, setFocoText] = useState("");
  const [combinadosAtual, setCombinadosAtual] = useState("");
  
  // Supervisor IA states
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [isConsultingAi, setIsConsultingAi] = useState(false);
  const [aiErrorState, setAiErrorState] = useState<{ message: string; details?: string } | null>(null);

  // Finalization Modal state
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeStep, setFinalizeStep] = useState<"choices" | "schedule" | "finance" | "receipt" | "done">("choices");

  // Scheduling Form
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("14:00");
  const [schedModalidade, setSchedModalidade] = useState<"Online" | "Presencial">("Online");
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedMeetLink, setSchedMeetLink] = useState("");

  // Finance Form
  const [finMethod, setFinMethod] = useState<"Pix" | "Cartão" | "Dinheiro" | "Transferência" | "Cortesia" | "Pacote">("Pix");
  const [finStatus, setFinStatus] = useState<"Pago" | "Pendente">("Pago");
  const [finValue, setFinValue] = useState(150);
  const [isPostingFinance, setIsPostingFinance] = useState(false);

  // Receipt Form
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [generatedReceiptUrl, setGeneratedReceiptUrl] = useState("");

  // Ref for debouncing auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active session Google Meet integration
  const [activeMeetUrl, setActiveMeetUrl] = useState<string | null>(null);

  // Audio recording and transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<{
    transcricao: string;
    foco: string;
    evolucao: string;
    combinados: string;
  } | null>(null);
  const [showTranscriptionPreview, setShowTranscriptionPreview] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentPatientId) {
      const url = localStorage.getItem(`meet_url_${sessionId || currentPatientId}`);
      setActiveMeetUrl(url);
    }
  }, [currentPatientId, sessionId]);

  const [isCreatingActiveMeet, setIsCreatingActiveMeet] = useState(false);
  const [copiedActiveMeet, setCopiedActiveMeet] = useState(false);

  const handleCreateActiveMeet = async () => {
    setIsCreatingActiveMeet(true);
    try {
      const space = await createGoogleMeetSpace(token);
      setActiveMeetUrl(space.meetingUri);
      localStorage.setItem(`meet_url_${sessionId || currentPatientId}`, space.meetingUri);
      
      // Update session in spreadsheet with new Meet link
      if (session) {
        const updated = {
          ...session,
          meet_link: space.meetingUri
        };
        await updateSession(spreadsheetId, updated, token);
        setSession(updated);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao criar link do Google Meet. Verifique suas permissões do Google Workspace.");
    } finally {
      setIsCreatingActiveMeet(false);
    }
  };

  const handleCopyActiveMeet = () => {
    if (activeMeetUrl) {
      navigator.clipboard.writeText(activeMeetUrl);
      setCopiedActiveMeet(true);
      setTimeout(() => setCopiedActiveMeet(false), 2000);
    }
  }  // 1. Initial Load: Retrieve Patient and Sessions to reconstruct history
  useEffect(() => {
    let active = true;

    const fetchSessionData = async () => {
      if (currentPatientId === "" || currentPatientId === "EXTERNAL") {
        // Do not auto-fetch or create a session draft if no patient has been selected yet.
        // Just fetch the list of patients to allow the user to select one!
        setLoading(true);
        try {
          const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pacientes!A2:K2000`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!active) return;
          const pRows = (await res.json()).values || [];
          const pList: Patient[] = pRows.map((row: any) => ({
            id: row[0] || "",
            nome_preferencial: row[1] || "",
            nome_completo: row[2] || "",
            contato_telefone: row[3] || "",
            contato_email: row[4] || "",
            responsaveis: row[5] || "",
            valor_padrao: Number(row[6] || 0),
            modalidade: row[7] || "Online",
            consentimentos: row[8] || "Não",
            situacao: row[9] || "Ativo",
            data_cadastro: row[10] || ""
          }));
          setPatients(pList);
        } catch (err) {
          console.error("Error loading patients for ad-hoc selection:", err);
        } finally {
          if (active) setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        // Fetch all patients and sessions
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pacientes!A2:K2000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!active) return;
        const pRows = (await res.json()).values || [];
        const pList: Patient[] = pRows.map((row: any) => ({
          id: row[0] || "",
          nome_preferencial: row[1] || "",
          nome_completo: row[2] || "",
          contato_telefone: row[3] || "",
          contato_email: row[4] || "",
          responsaveis: row[5] || "",
          valor_padrao: Number(row[6] || 0),
          modalidade: row[7] || "Online",
          consentimentos: row[8] || "Não",
          situacao: row[9] || "Ativo",
          data_cadastro: row[10] || ""
        }));
        setPatients(pList);

        // Find current patient
        let activePatient: Patient | undefined;
        if (currentPatientId === "AVULSO") {
          activePatient = {
            id: "AVULSO",
            nome_preferencial: "Paciente Avulso",
            nome_completo: "Paciente Avulso (Ad-hoc)",
            contato_telefone: "",
            contato_email: "",
            responsaveis: "",
            valor_padrao: 150,
            modalidade: "Online",
            consentimentos: "Sim",
            situacao: "Ativo",
            data_cadastro: new Date().toISOString().split("T")[0]
          };
        } else {
          activePatient = pList.find(p => p.id === currentPatientId);
        }
        
        // Fetch all sessions to find latest ones
        const allSessions = await getSessions(spreadsheetId, token);
        if (!active) return;
        let activeSession: Session | null = null;

        if (sessionId) {
          // Resume existing draft
          activeSession = allSessions.find(s => s.id === sessionId) || null;
          if (!activeSession && sessionId.startsWith("VIRT-")) {
            const eventId = sessionId.replace("VIRT-", "");
            activeSession = allSessions.find(s => s.google_event_id === eventId) || null;
            if (!activeSession) {
              // Create a brand new session draft in Sheets based on the virtual session!
              const newId = generateUUID();
              
              // Let's get the event details from Google Calendar to fetch the exact date_hora and meet_link!
              let dataHoraISO = new Date().toISOString();
              let meetLink = "";
              try {
                const calEventRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (calEventRes.ok) {
                  const calEvent = await calEventRes.json();
                  if (calEvent.start?.dateTime) {
                    dataHoraISO = new Date(calEvent.start.dateTime).toISOString();
                  } else if (calEvent.start?.date) {
                    dataHoraISO = new Date(calEvent.start.date).toISOString();
                  }
                  meetLink = calEvent.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri || "";
                }
              } catch (calErr) {
                console.error("Error fetching event details from Google Calendar:", calErr);
              }

              // Get last session of this patient to find previous agreements and focus
              const pHistory = allSessions.filter(s => s.paciente_id === currentPatientId).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
              const lastSession = pHistory.find(s => s.status === "Finalizada");

              const newSession: Session = {
                id: newId,
                paciente_id: currentPatientId,
                data_hora: dataHoraISO,
                foco: lastSession?.foco_sugerido || "Consulta agendada via central de agenda.",
                resumo: "",
                combinados_anterior: lastSession?.combinados_atual || "Nenhum histórico disponível.",
                combinados_atual: "",
                foco_sugerido: "",
                status: "Rascunho",
                meet_link: meetLink,
                google_event_id: eventId
              };

              // Put in cache and save
              pendingSessions[currentPatientId] = newSession;
              await addSession(spreadsheetId, newSession, token);
              activeSession = newSession;

              // Audit Log
              await addAuditLog(spreadsheetId, {
                id: generateUUID(),
                data_hora: new Date().toISOString(),
                usuario_email: userEmail,
                perfil: role,
                acao: "Criação de Prontuário",
                detalhes: `Iniciada nova sessão de rascunho ${newId} do Google Agenda para paciente ${currentPatientId}`
              }, token);
            }
          }
          if (activeSession) {
            if (activeSession.paciente_id === "AVULSO") {
              activePatient = {
                id: "AVULSO",
                nome_preferencial: "Paciente Avulso",
                nome_completo: "Paciente Avulso (Ad-hoc)",
                contato_telefone: "",
                contato_email: "",
                responsaveis: "",
                valor_padrao: 150,
                modalidade: "Online",
                consentimentos: "Sim",
                situacao: "Ativo",
                data_cadastro: new Date().toISOString().split("T")[0]
              };
            } else {
              activePatient = pList.find(p => p.id === activeSession?.paciente_id);
            }
          }
        } else {
          // Check if there is an active session draft today for this patient
          const todayStr = new Date().toISOString().split("T")[0];
          const draftToday = allSessions.find(s => s.paciente_id === currentPatientId && s.status === "Rascunho" && s.data_hora.startsWith(todayStr));
          
          if (draftToday) {
            activeSession = draftToday;
          } else if (pendingSessions[currentPatientId] && pendingSessions[currentPatientId].data_hora.startsWith(todayStr)) {
            // Retrieve from our safe concurrent creations cache
            activeSession = pendingSessions[currentPatientId];
          } else {
            // Create a brand new session draft
            const newId = generateUUID();
            
            // Get last session of this patient to find previous agreements and focus
            const pHistory = allSessions.filter(s => s.paciente_id === currentPatientId).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
            const lastSession = pHistory.find(s => s.status === "Finalizada");

            const newSession: Session = {
              id: newId,
              paciente_id: currentPatientId,
              data_hora: new Date().toISOString(),
              foco: lastSession?.foco_sugerido || "Investigação inicial",
              resumo: "",
              combinados_anterior: lastSession?.combinados_atual || "Nenhum combinado registrado.",
              combinados_atual: "",
              foco_sugerido: "",
              status: "Rascunho",
              supervisor_ia_sugestoes: ""
            };

            // Lock immediately by putting it in our pending cache to block any concurrent renders from triggering a duplicate write
            pendingSessions[currentPatientId] = newSession;

            await addSession(spreadsheetId, newSession, token);
            if (!active) return;
            activeSession = newSession;

            // Audit Log
            await addAuditLog(spreadsheetId, {
              id: generateUUID(),
              data_hora: new Date().toISOString(),
              usuario_email: userEmail,
              perfil: role,
              acao: "Criação de Prontuário",
              detalhes: `Iniciada nova sessão de rascunho ${newId} para paciente ${currentPatientId}`
            }, token);
          }
        }

        if (activeSession) {
          setSession(activeSession);
          setResumoText(activeSession.resumo);
          setFocoText(activeSession.foco);
          setCombinadosAtual(activeSession.combinados_atual);
          setAiSuggestions(activeSession.supervisor_ia_sugestoes || "");
          if (activeSession.meet_link) {
            setActiveMeetUrl(activeSession.meet_link);
          }
        }
        if (activePatient) {
          setPatient(activePatient);
          setFinValue(activePatient.valor_padrao);
          const pkgs = getPatientPackages();
          const pPkg = pkgs.find(p => p.patientId === activePatient.id && p.hasActivePlan && p.status === "Ativo");
          setActivePackage(pPkg || null);
        }

      } catch (err) {
        console.error("Error setting up active session:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (spreadsheetId && token) {
      fetchSessionData();
    }

    return () => {
      active = false;
    };
  }, [spreadsheetId, token, currentPatientId, sessionId]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Start audio recording
  const startRecording = async () => {
    // Check LGPD consent for audio recording (Fail-Closed & PatientId Mandatory)
    if (!patient?.id) {
      alert("⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nPaciente não identificado para verificação de consentimento de gravação de áudio.");
      return;
    }

    try {
      const checkRes = await apiFetch(`/api/patient/${patient.id}/consents/check?type=gravacao_audio`);
      if (!checkRes.ok) {
        const errJson = await checkRes.json().catch(() => ({}));
        alert(`⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nO paciente "${patient.nome_completo || patient.nome_preferencial}" não possui consentimento ativo para 'Gravação de Áudio das Sessões' ou a verificação falhou (${errJson.error || errJson.reason || "Não autorizado"}).\nPor favor, cadastre ou ative o termo no cadastro do paciente antes de gravar.`);
        return;
      }
      const checkData = await checkRes.json();
      if (!checkData.allowed) {
        alert(`⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nO paciente "${patient.nome_completo || patient.nome_preferencial}" não possui consentimento ativo para 'Gravação de Áudio das Sessões' (gravacao_audio).\nPor favor, cadastre ou ative o termo no cadastro do paciente antes de gravar.`);
        return;
      }
    } catch (err: any) {
      console.error("Erro ao checar consentimento de áudio:", err);
      alert("⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nFalha de rede/segurança ao consultar consentimento. A gravação foi bloqueada por proteção.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all audio tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await processAudio(audioBlob);
      };

      recorder.start();

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone. Por favor, verifique se deu permissão de microfone no navegador.");
    }
  };

  // Stop audio recording
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

  // Process the recorded audio chunk with Gemini
  const processAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Audio = base64data.split(",")[1];
        const mimeType = audioBlob.type;

        const res = await apiFetch("/api/audio/transcribe-and-summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            base64Audio,
            mimeType,
            patientId: patient?.id
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro ao transcrever o áudio.");
        }

        const data = await res.json();
        if (data.success && data.data) {
          setTranscriptionResult(data.data);
          setShowTranscriptionPreview(true);
        } else {
          throw new Error("Resposta inválida do servidor.");
        }
      };
    } catch (err: any) {
      console.error("Erro no processamento do áudio:", err);
      alert("Falha ao transcrever o áudio: " + (err.message || err));
    } finally {
      setIsTranscribing(false);
    }
  };

  // Apply transcription results to input fields
  const applyTranscriptionResult = () => {
    if (!transcriptionResult) return;

    if (transcriptionResult.foco) {
      setFocoText(transcriptionResult.foco);
    }
    if (transcriptionResult.evolucao) {
      setResumoText(transcriptionResult.evolucao);
    }
    if (transcriptionResult.combinados) {
      setCombinadosAtual(transcriptionResult.combinados);
    }

    triggerAutoSave(
      transcriptionResult.evolucao || "",
      transcriptionResult.foco || "",
      transcriptionResult.combinados || ""
    );

    setShowTranscriptionPreview(false);
    setTranscriptionResult(null);
  };

  // 2. Debounced continuous auto-save
  const triggerAutoSave = (updatedResumo: string, updatedFoco: string, updatedCombinados: string) => {
    if (!session) return;
    setSavingStatus("Salvando...");

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedSession: Session = {
          ...session,
          resumo: updatedResumo,
          foco: updatedFoco,
          combinados_atual: updatedCombinados,
          supervisor_ia_sugestoes: aiSuggestions
        };
        await updateSession(spreadsheetId, updatedSession, token);
        setSavingStatus("Salvo");
      } catch (e) {
        console.error("Auto-save failed:", e);
        setSavingStatus("Erro ao Salvar");
      }
    }, 1200); // 1.2s debounce
  };

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Update handlers triggering save
  const handleResumoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumoText(e.target.value);
    triggerAutoSave(e.target.value, focoText, combinadosAtual);
  };

  const handleFocoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFocoText(e.target.value);
    triggerAutoSave(resumoText, e.target.value, combinadosAtual);
  };

  const handleCombinadosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCombinadosAtual(e.target.value);
    triggerAutoSave(resumoText, focoText, e.target.value);
  };

  // 3. Supervisor IA integration via Express endpoint
  const handleConsultSupervisor = async () => {
    if (!resumoText.trim()) {
      alert("Por favor, digite algumas anotações clínicas na sessão antes de solicitar a supervisão.");
      return;
    }

    setIsConsultingAi(true);
    setAiErrorState(null);
    setActiveTab("supervisor");
    try {
      const res = await apiFetch("/api/supervisor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicalNotes: resumoText,
          contextHistory: session?.combinados_anterior || "",
          patientId: patient?.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data.analysis);
        setAiErrorState(null);
        
        // Save the AI suggestions to the session sheet draft
        if (session) {
          const updatedSession: Session = {
            ...session,
            resumo: resumoText,
            foco: focoText,
            combinados_atual: combinadosAtual,
            supervisor_ia_sugestoes: data.analysis
          };
          await updateSession(spreadsheetId, updatedSession, token);
        }

        // Save a success log in the audit history
        await addAuditLog(spreadsheetId, {
          id: generateUUID(),
          data_hora: new Date().toISOString(),
          usuario_email: userEmail,
          perfil: role,
          acao: "Supervisor IA - Sucesso",
          detalhes: `Análise teórica realizada com sucesso durante a Sessão Ativa do paciente.`
        }, token).catch(err => console.error("Erro ao gravar log de auditoria de sucesso em sessão ativa:", err));
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiErrorState({
          message: errData.error || "Erro ao consultar o Supervisor Clínico IA.",
          details: errData.details
        });

        // Determine specific label/classification for the Gemini API response status
        const errorTypeLabel = errData.errorType === "autenticacao" ? "Autenticação" 
          : errData.errorType === "limite_uso" ? "Limite de Uso / Créditos Esgotados"
          : errData.errorType === "formato_dados" ? "Formato de Dados"
          : "Desconhecido / Outro";

        // Save detailed failure log in the audit history
        await addAuditLog(spreadsheetId, {
          id: generateUUID(),
          data_hora: new Date().toISOString(),
          usuario_email: userEmail,
          perfil: role,
          acao: `Supervisor IA - Erro (${errorTypeLabel})`,
          detalhes: `Falha ao consultar Supervisor IA durante Sessão Ativa. Status HTTP: ${res.status}. Tipo do Erro: ${errorTypeLabel}. Detalhes técnicos: ${errData.details || errData.error || "Sem detalhes adicionais."}`
        }, token).catch(err => console.error("Erro ao gravar log de auditoria de falha em sessão ativa:", err));
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorState({
        message: "Erro de conexão ao consultar supervisor.",
        details: "Não foi possível estabelecer contato com o servidor para realizar a análise. Verifique sua conexão com a internet."
      });

      // Save connection failure in the audit log
      await addAuditLog(spreadsheetId, {
        id: generateUUID(),
        data_hora: new Date().toISOString(),
        usuario_email: userEmail,
        perfil: role,
        acao: "Supervisor IA - Falha de Conexão",
        detalhes: `Não foi possível alcançar o servidor de análise na Sessão Ativa. Erro: ${err.message || err}`
      }, token).catch(e => console.error("Erro ao gravar log de auditoria de falha de conexão na sessão ativa:", e));
    } finally {
      setIsConsultingAi(false);
    }
  };

  // Accept IA suggestions as clinical notes adendo
  const handleAcceptAiSuggestion = () => {
    const adendoText = `\n\n[Adendo Supervisor IA em ${new Date().toLocaleDateString("pt-BR")}]:\n${aiSuggestions}\n`;
    const newResumo = resumoText + adendoText;
    setResumoText(newResumo);
    triggerAutoSave(newResumo, focoText, combinadosAtual);
    alert("Sugestões de intervenções anexadas ao prontuário como Adendo Supervisor.");
  };

  // 4. Finalize Session steps
  const handleOpenFinalize = async () => {
    // Perform one last synchronous save before opening checkout
    if (session) {
      setSavingStatus("Salvando...");
      try {
        const finalSession: Session = {
          ...session,
          resumo: resumoText,
          foco: focoText,
          combinados_atual: combinadosAtual,
          supervisor_ia_sugestoes: aiSuggestions
        };
        await updateSession(spreadsheetId, finalSession, token);
        setSavingStatus("Salvo");
        setShowFinalizeModal(true);
        setFinalizeStep("choices");
      } catch (e) {
        alert("Erro ao salvar rascunho final. Tente novamente.");
      }
    }
  };

  // Step 2a: Schedule Next Appointment
  const handleScheduleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedDate) {
      alert("Selecione uma data válida.");
      return;
    }

    setIsScheduling(true);
    try {
      const dateStr = `${schedDate}T${schedTime}:00`;
      
      // 1. Create event on Google Calendar with Meet link
      const calRes = await createCalendarEvent({
        pacienteId: patient?.id || "",
        pacienteNome: patient?.nome_preferencial || "Paciente",
        dataHoraISO: dateStr,
        modalidade: schedModalidade
      }, token);

      setSchedMeetLink(calRes.meetLink || "");

      // 2. Insert new session draft row in Sheets for the next date
      const nextSessionId = generateUUID();
      const nextSess: Session = {
        id: nextSessionId,
        paciente_id: patient?.id || "",
        data_hora: dateStr,
        foco: focoText, // suggest current focus as starting point
        resumo: "",
        combinados_anterior: combinadosAtual, // current agreements
        combinados_atual: "",
        foco_sugerido: "",
        status: "Rascunho",
        supervisor_ia_sugestoes: "",
        meet_link: calRes.meetLink || "",
        google_event_id: calRes.eventId || ""
      };

      await addSession(spreadsheetId, nextSess, token);
      
      alert(`Próxima sessão agendada com sucesso para ${new Date(dateStr).toLocaleDateString("pt-BR")}!` + 
        (calRes.meetLink ? `\nLink do Google Meet gerado.` : ""));

      // Advance to finance billing
      setFinalizeStep("finance");
    } catch (err) {
      console.error(err);
      alert("Erro ao agendar consulta no Google Agenda.");
    } finally {
      setIsScheduling(false);
    }
  };

  // Step 2b: Financial Posting
  const handlePostFinancial = async () => {
    setIsPostingFinance(true);
    try {
      const finId = generateUUID();
      const record: FinancialRecord = {
        id: finId,
        paciente_id: patient?.id || "",
        sessao_id: session?.id || "",
        tipo: "Receita",
        valor: finMethod === "Cortesia" ? 0 : finValue,
        status: finMethod === "Cortesia" ? "Pago" : finStatus as any,
        forma_pagamento: finMethod,
        data_vencimento: new Date().toISOString().split("T")[0],
        data_pagamento: finStatus === "Pago" || finMethod === "Cortesia" ? new Date().toISOString().split("T")[0] : undefined,
        desconto: 0,
        observacoes: finMethod === "Cortesia" ? "Atendimento cortesia" : `Atendimento clínico sessão ${session?.id}`
      };

      await addFinancial(spreadsheetId, record, token);

      // Also persist to official Firestore database
      const isPaid = finStatus === "Pago" || finMethod === "Cortesia";
      const cobrancaVal = finMethod === "Cortesia" ? 0 : finValue;
      const newCob: Cobranca = {
        id: finId,
        paciente_id: patient?.id || "",
        responsavel_financeiro: "",
        origem: finMethod === "Pacote" ? "Pacote" : "Sessão Avulsa",
        periodo_sessao_id: session?.id || "",
        valor_original: cobrancaVal,
        desconto: 0,
        acrescimo: 0,
        valor_pago: isPaid ? cobrancaVal : 0,
        saldo_restante: isPaid ? 0 : cobrancaVal,
        data_vencimento: new Date().toISOString().split("T")[0],
        situacao: isPaid ? "Paga" : "Pendente",
        forma_pagamento: finMethod === "Cartão" ? "Cartão de crédito" : finMethod === "Dinheiro" ? "Dinheiro" : "Pix",
        situacao_recibo: "Não solicitado",
        situacao_nfse: "Não solicitada",
        observacoes: finMethod === "Cortesia" ? "Atendimento cortesia" : `Atendimento clínico sessão ${session?.id}`,
        createdAt: new Date().toISOString()
      };
      await saveCobrancaApi(newCob);

      alert("Fluxo financeiro registrado com sucesso!");

      if (finStatus === "Pago" && finMethod !== "Cortesia" && finMethod !== "Pacote") {
        setFinalizeStep("receipt");
      } else {
        await completeSessionFlow();
      }
    } catch (e) {
      alert("Erro ao lançar no financeiro.");
    } finally {
      setIsPostingFinance(false);
    }
  };

  // Step 2c: Doc Receipt Generation
  const handleGenerateReceipt = async () => {
    setIsGeneratingReceipt(true);
    try {
      const companyName = localStorage.getItem("serenapsi_profile_company_name") || "Virgínia Macedo Psicologia Clínica LTDA";
      const cnpj = localStorage.getItem("serenapsi_profile_cnpj") || "00.000.000/0001-00";

      // Generate using Docs template
      const replacements = {
        NOME_PACIENTE: patient?.nome_completo || "Paciente",
        VALOR_PAGO: finValue.toString(),
        DATA_PAGAMENTO: new Date().toLocaleDateString("pt-BR"),
        RAZAO_SOCIAL: companyName,
        CNPJ: cnpj
      };

      const result = await generateDocumentFromTemplate(
        "Modelo_Recibo_Pagamento",
        patient?.nome_preferencial || "Paciente",
        replacements,
        modelsFolderId,
        docsFolderId,
        token
      );

      setGeneratedReceiptUrl(result.docUrl);

      // Register the document in our Sheet list
      const docRecId = generateUUID();
      const docRec: DocRecord = {
        id: docRecId,
        paciente_id: patient?.id || "",
        tipo: "Recibo",
        titulo: `Recibo_${patient?.nome_preferencial}_R$${finValue}`,
        google_doc_id: result.docId,
        google_doc_url: result.docUrl,
        data_criacao: new Date().toISOString().split("T")[0]
      };

      await addDocRecord(spreadsheetId, docRec, token);
      alert("Recibo em PDF gerado no Google Docs com sucesso!");
      setFinalizeStep("done");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar documento recibo: " + err.message);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // Conclude everything, close and save session as "Finalizada"
  const completeSessionFlow = async () => {
    if (!session) return;
    try {
      const finalizedSession: Session = {
        ...session,
        resumo: resumoText,
        foco: focoText,
        combinados_atual: combinadosAtual,
        supervisor_ia_sugestoes: aiSuggestions,
        status: "Finalizada",
        alteracao_log: `[${new Date().toISOString()}] Atendimento finalizado por ${userEmail}`
      };

      await updateSession(spreadsheetId, finalizedSession, token);

      // Debit session from package if active
      try {
        const deduction = await decrementSessionBalance(session.paciente_id, patient?.nome_preferencial || "Paciente");
        if (deduction.success || deduction.warn) {
          if (deduction.message) {
            alert(deduction.message);
          }
        }
      } catch (pkgErr) {
        console.error("Erro ao debitar do pacote de sessões:", pkgErr);
      }

      // Audit Log
      await addAuditLog(spreadsheetId, {
        id: generateUUID(),
        data_hora: new Date().toISOString(),
        usuario_email: userEmail,
        perfil: role,
        acao: "Finalização de Atendimento",
        detalhes: `Sessão ${session.id} finalizada com sucesso para paciente ${patient?.id}`
      }, token);

      setShowFinalizeModal(false);
      onClose();
    } catch (e) {
      alert("Erro ao concluir finalização.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-emerald-950">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-4" />
        <p className="font-sans font-medium text-base">Preparando sala de atendimento...</p>
      </div>
    );
  }

  if (currentPatientId === "" || currentPatientId === "EXTERNAL") {
    const filteredPatients = patients.filter(p => 
      p.nome_preferencial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-emerald-100 shadow-sm space-y-6 animate-fade-in mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border border-emerald-100 text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-xl font-bold font-sans text-emerald-950">Atendimento Avulso</h2>
              <p className="text-xs text-emerald-600/70 mt-0.5">Vincule a um paciente cadastrado ou atenda como avulso</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar paciente cadastrado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-emerald-100 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/10 text-sm transition"
            />
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-emerald-50 border border-emerald-50 rounded-2xl bg-slate-50/50">
            {filteredPatients.length === 0 ? (
              <p className="p-6 text-center text-xs text-emerald-600/60 font-mono">Nenhum paciente cadastrado encontrado.</p>
            ) : (
              filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => setCurrentPatientId(p.id)}
                  className="w-full text-left p-4 hover:bg-emerald-50/70 transition flex items-center justify-between group"
                >
                  <div>
                    <h4 className="font-semibold text-emerald-950 text-sm group-hover:text-emerald-800 transition">{p.nome_preferencial}</h4>
                    <p className="text-xs text-emerald-600/60 mt-0.5">{p.nome_completo || "Nome completo não informado"}</p>
                  </div>
                  <ChevronRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition shrink-0" />
                </button>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-emerald-50 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setCurrentPatientId("AVULSO")}
              className="flex-1 flex items-center justify-center space-x-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition cursor-pointer text-xs"
            >
              <Sparkles size={14} />
              <span>Paciente Temporário / Avulso</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !patient) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 border border-red-100 rounded-2xl">
        Erro ao iniciar sessão: Paciente ou rascunho de sessão não localizado.
        <button onClick={onClose} className="mt-4 block mx-auto bg-emerald-800 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          Voltar para tela anterior
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in px-4 md:px-0">
      
      {/* Top Header Session bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-100/55 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl border border-emerald-100 text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <h2 className="text-xl font-bold font-sans text-emerald-950 flex items-center gap-2">
                <span>Sessão com {patient.nome_preferencial}</span>
                {activePackage && (
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border inline-block ${
                    activePackage.remainingSessions <= 1 
                      ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" 
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}>
                    Saldo: {activePackage.remainingSessions}/{activePackage.totalSessions} ses. ({activePackage.planName})
                  </span>
                )}
              </h2>
            </div>
            <p className="text-xs text-emerald-600/70 mt-0.5">Sessão {session.id} • TCC e Terapia do Esquema</p>
          </div>
        </div>

        {/* Save Status and Finalize Actions */}
        <div className="flex items-center space-x-3 flex-wrap">
          {/* Active Google Meet generation block */}
          {patient.modalidade === "Online" && (
            <div className="flex items-center space-x-2 mr-2">
              {activeMeetUrl ? (
                <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-100/50 p-1.5 rounded-xl">
                  <a
                    href={activeMeetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Video size={13} className="animate-pulse" />
                    <span>Entrar no Meet</span>
                  </a>
                  <button
                    onClick={handleCopyActiveMeet}
                    className="flex items-center space-x-1 px-2.5 py-1.5 border border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50 text-xs font-semibold rounded-lg transition cursor-pointer"
                    title="Copiar Link"
                  >
                    {copiedActiveMeet ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    <span>{copiedActiveMeet ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCreateActiveMeet}
                  disabled={isCreatingActiveMeet}
                  className="flex items-center space-x-1.5 px-3 py-2 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl bg-white hover:bg-emerald-50 transition cursor-pointer"
                >
                  {isCreatingActiveMeet ? (
                    <span className="w-3 h-3 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mr-1" />
                  ) : (
                    <Video size={13} className="text-emerald-700" />
                  )}
                  <span>Gerar Sala Google Meet</span>
                </button>
              )}
            </div>
          )}

          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center space-x-1 ${
            savingStatus === "Salvo"
              ? "bg-emerald-50 text-emerald-800"
              : savingStatus === "Salvando..."
              ? "bg-amber-50 text-amber-800 animate-pulse"
              : "bg-red-50 text-red-800"
          }`}>
            <Save size={12} />
            <span>{savingStatus}</span>
          </span>

          <button
            onClick={handleOpenFinalize}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition cursor-pointer"
            id="finalize-session-btn"
          >
            Finalizar Sessão
          </button>
        </div>
      </div>

      {/* Grid: 2 columns - left (clinical notes) / right (supervisor and previous history) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Col span 2): Active clinical typing area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
            
            {/* Session Focus input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-emerald-900 block">Foco da Sessão Atual</label>
              <input
                type="text"
                value={focoText}
                onChange={handleFocoChange}
                placeholder="Ex: Identificação de distorções cognitivas sobre autoeficácia"
                className="w-full text-sm px-4 py-3 border border-emerald-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 font-sans"
              />
            </div>

            {/* Note text-area (continuous writing) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-900 block">Evolução Clínica / Anotações da Sessão</label>
                
                {/* Audio Recording Control Badge/Button */}
                <div className="flex items-center space-x-2">
                  {isTranscribing && (
                    <span className="text-xs text-emerald-700 flex items-center space-x-1.5 animate-pulse bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      <Loader2 size={13} className="animate-spin" />
                      <span>Processando áudio com Gemini...</span>
                    </span>
                  )}

                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
                    >
                      <Square size={10} className="fill-current" />
                      <span>Parar Gravação ({formatTime(recordingSeconds)})</span>
                    </button>
                  ) : (
                    <button
                      disabled={isTranscribing}
                      onClick={startRecording}
                      className={`text-xs ${
                        isTranscribing 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                          : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-sm"
                      } font-bold px-3 py-1.5 rounded-full flex items-center space-x-1.5 transition hover:scale-105 active:scale-95 cursor-pointer`}
                    >
                      <Mic size={12} />
                      <span>Gravar Áudio (Evolução IA)</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={resumoText}
                onChange={handleResumoChange}
                rows={24}
                placeholder="Digite livremente sobre a sessão ou use o botão 'Gravar Áudio' para ditar suas anotações. O Gemini irá gerar uma evolução perfeitamente estruturada nos padrões do CFP..."
                className="w-full text-sm px-4 py-3 border border-emerald-100 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 font-sans leading-relaxed resize-none"
                id="clinical-notes-textarea"
              />
            </div>

            {/* Next session agreements */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-emerald-900 block">Combinados para a Próxima Sessão (Tarefa de casa/Ações)</label>
              <input
                type="text"
                value={combinadosAtual}
                onChange={handleCombinadosChange}
                placeholder="Ex: Registrar pensamentos disfuncionais no diário durante a semana"
                className="w-full text-sm px-4 py-3 border border-emerald-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 font-sans"
              />
            </div>

          </div>
        </div>

        {/* Right column: Pre-session overview and Supervisor IA */}
        <div className="space-y-6">
          
          {/* Quick history of last session (CBT/Esquema background context) */}
          <div className="bg-emerald-50/20 border border-emerald-100/50 p-5 rounded-2xl space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5 font-sans">
              <BookOpen size={14} />
              <span>Contexto Anterior</span>
            </h4>
            
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-emerald-800">Foco anterior sugerido:</span>
                <p className="text-emerald-950 mt-0.5">{session.foco}</p>
              </div>
              <div className="border-t border-emerald-100/40 pt-2">
                <span className="font-bold text-emerald-800">Combinados anteriores:</span>
                <p className="text-emerald-950 mt-0.5">{session.combinados_anterior}</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* --- FINALIZE SESSION FLOW MODAL --- */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-emerald-100 animate-scale-up space-y-6">
            
            {/* Modal Progress Header */}
            <div className="flex justify-between items-center border-b border-emerald-50 pb-3">
              <h3 className="font-sans font-bold text-lg text-emerald-950">
                {finalizeStep === "choices" && "Atendimento Concluído!"}
                {finalizeStep === "schedule" && "Próximo Agendamento"}
                {finalizeStep === "finance" && "Financeiro e Faturamento"}
                {finalizeStep === "receipt" && "Geração de Recibo"}
                {finalizeStep === "done" && "Tudo Concluído!"}
              </h3>
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="text-emerald-400 hover:text-emerald-800 font-semibold"
              >
                Fechar
              </button>
            </div>

            {/* Step 1: Choices */}
            {finalizeStep === "choices" && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle size={48} className="mx-auto text-emerald-600" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-950 text-base">Como deseja proceder com o encerramento?</h4>
                  <p className="text-xs text-emerald-600/70">As notas clínicas foram salvas. Escolha a ação do consultório:</p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-2">
                  <button
                    onClick={() => setFinalizeStep("schedule")}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-semibold transition text-sm cursor-pointer"
                  >
                    <span>1. Agendar Próxima Sessão</span>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={() => setFinalizeStep("finance")}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-2xl font-semibold transition border border-emerald-100 text-sm cursor-pointer"
                  >
                    <span>2. Pular para Registro Financeiro</span>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={completeSessionFlow}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-emerald-50 text-emerald-700 rounded-2xl font-medium transition border border-emerald-100 text-sm cursor-pointer"
                  >
                    <span>Apenas Finalizar (Sem cobrança/agenda)</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Schedule next */}
            {finalizeStep === "schedule" && (
              <form onSubmit={handleScheduleNext} className="space-y-4">
                <p className="text-xs text-emerald-600">Selecione o dia e horário para criar o atendimento no Google Agenda com Meet automático:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-950">Data da Consulta</label>
                    <input
                      type="date"
                      required
                      value={schedDate}
                      onChange={e => setSchedDate(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-950">Horário</label>
                    <input
                      type="time"
                      required
                      value={schedTime}
                      onChange={e => setSchedTime(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-950 font-sans">Modalidade</label>
                  <select
                    value={schedModalidade}
                    onChange={e => setSchedModalidade(e.target.value as any)}
                    className="w-full text-sm px-3 py-2.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                  >
                    <option value="Online">Online (Cria link do Google Meet automaticamente)</option>
                    <option value="Presencial">Presencial (No consultório físico)</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFinalizeStep("choices")}
                    className="flex-1 text-xs border border-emerald-100 py-2.5 rounded-xl font-semibold hover:bg-emerald-50"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isScheduling}
                    className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold shadow disabled:opacity-50 cursor-pointer"
                  >
                    {isScheduling ? "Agendando..." : "Confirmar Agendamento"}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Finance and Billing */}
            {finalizeStep === "finance" && (
              <div className="space-y-4">
                <p className="text-xs text-emerald-600">Selecione como será feito o faturamento desta consulta de hoje:</p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-emerald-950">Modalidade Cobrança</label>
                    <select
                      value={finMethod}
                      onChange={e => setFinMethod(e.target.value as any)}
                      className="w-full p-2 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão">Cartão de Crédito</option>
                      <option value="Dinheiro">Dinheiro físico</option>
                      <option value="Transferência">Ted / Doc</option>
                      <option value="Cortesia">Cortesia (Sessão Grátis)</option>
                      <option value="Pacote">Consumir Pacote</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-emerald-950">Status do Recebimento</label>
                    <select
                      value={finStatus}
                      onChange={e => setFinStatus(e.target.value as any)}
                      disabled={finMethod === "Cortesia" || finMethod === "Pacote"}
                      className="w-full p-2 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                    >
                      <option value="Pago">Já Pago (Confirmado)</option>
                      <option value="Pendente">Aguardando Pagamento</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-xs font-bold text-emerald-950">Valor da Sessão (R$)</label>
                  <input
                    type="number"
                    value={finValue}
                    onChange={e => setFinValue(Number(e.target.value))}
                    disabled={finMethod === "Cortesia" || finMethod === "Pacote"}
                    className="w-full text-sm px-3 py-2 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFinalizeStep("choices")}
                    className="flex-1 text-xs border border-emerald-100 py-2.5 rounded-xl font-semibold hover:bg-emerald-50"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handlePostFinancial}
                    disabled={isPostingFinance}
                    className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold shadow disabled:opacity-50 cursor-pointer"
                  >
                    {isPostingFinance ? "Registrando..." : "Registrar Financeiro"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Receipt */}
            {finalizeStep === "receipt" && (
              <div className="space-y-4 text-center py-4">
                <FileCheck size={44} className="mx-auto text-emerald-600" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-950 text-base">Gerar recibo para {patient.nome_preferencial}?</h4>
                  <p className="text-xs text-emerald-600/70">Isso criará uma cópia preenchida do modelo no Google Docs automáticamente.</p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={completeSessionFlow}
                    className="flex-1 text-xs border border-emerald-100 py-2.5 rounded-xl font-semibold hover:bg-emerald-50 cursor-pointer"
                  >
                    Não preciso de recibo
                  </button>
                  <button
                    onClick={handleGenerateReceipt}
                    disabled={isGeneratingReceipt}
                    className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold shadow disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingReceipt ? "Gerando..." : "Gerar Recibo"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Done! */}
            {finalizeStep === "done" && (
              <div className="space-y-6 text-center py-4">
                <CheckCircle size={48} className="mx-auto text-emerald-600 animate-bounce" />
                <div className="space-y-2">
                  <h4 className="font-bold text-emerald-950 text-lg">Excelente! Atendimento Concluído com Sucesso!</h4>
                  <p className="text-xs text-emerald-600 max-w-sm mx-auto">Prontuário fechado, Google Agenda atualizado e recibo de pagamento emitido na pasta do paciente.</p>
                </div>

                {generatedReceiptUrl && (
                  <a
                    href={generatedReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-100 text-emerald-800 hover:underline rounded-xl text-xs font-bold"
                  >
                    <Printer size={14} />
                    <span>Visualizar/Imprimir Recibo no Google Docs</span>
                  </a>
                )}

                <button
                  onClick={completeSessionFlow}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white py-3 rounded-2xl font-bold text-sm shadow cursor-pointer"
                >
                  Concluir e Voltar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- AUDIO TRANSCRIPTION & CFP EVOLUTION PREVIEW MODAL --- */}
      {showTranscriptionPreview && transcriptionResult && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl border border-emerald-100 animate-scale-up space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-emerald-50 pb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-lg text-emerald-950">Evolução Estruturada por IA (Padrão CFP)</h3>
                  <p className="text-xs text-emerald-600/70">O áudio foi processado e formatado segundo as diretrizes éticas e técnicas do CFP</p>
                </div>
              </div>
              <button
                onClick={() => setShowTranscriptionPreview(false)}
                className="p-1.5 hover:bg-emerald-50 rounded-xl text-emerald-600 font-bold transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: Original Transcription */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Transcrição do Áudio</span>
                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 h-[380px] overflow-y-auto text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                  {transcriptionResult.transcricao || "Nenhuma fala clara foi identificada para transcrição."}
                </div>
              </div>

              {/* Right column: Formatted CFP Evolution */}
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">Evolução Clínica Gerada</span>
                
                <div className="space-y-3 h-[380px] overflow-y-auto pr-1">
                  {/* Focus section */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase">Foco Sugerido:</span>
                    <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-sm font-medium text-emerald-950">
                      {transcriptionResult.foco}
                    </div>
                  </div>

                  {/* Notes section */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase">Anotações Clínicas (Padrão CFP):</span>
                    <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-950 font-mono leading-relaxed whitespace-pre-wrap">
                      {transcriptionResult.evolucao}
                    </div>
                  </div>

                  {/* Homework section */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase">Combinados / Ações:</span>
                    <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-sm text-emerald-950">
                      {transcriptionResult.combinados}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-emerald-50">
              <button
                onClick={() => setShowTranscriptionPreview(false)}
                className="flex-1 py-3 border border-emerald-100 hover:bg-emerald-50 text-emerald-800 rounded-2xl font-bold text-sm transition cursor-pointer text-center"
              >
                Descartar
              </button>
              <button
                onClick={applyTranscriptionResult}
                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow hover:shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <FileCheck size={16} />
                <span>Aplicar e Preencher Prontuário</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
