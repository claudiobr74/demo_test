import React, { useState, useEffect } from "react";
import { generateUUID } from "../lib/uuid";
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Plus,
  Play,
  Video,
  Send,
  XCircle,
  TrendingUp,
  Copy,
  ExternalLink,
  Check
} from "lucide-react";
import {
  Patient,
  Session,
  FinancialRecord,
  Task,
  DocRecord,
  MeetSpace,
  getPatients,
  getSessions,
  getAdministrativePatients,
  getAdministrativeAppointments,
  getAdministrativeDocs,
  getFinancials,
  getTasks,
  getDocs,
  addTask,
  updateTask,
  sendGmailConfirmation,
  addFinancial,
  updateFinancial,
  updateSession,
  createGoogleMeetSpace
} from "../lib/workspace";
import { getFinancialDataApi, saveCobrancaApi } from "../lib/financeApi";
import { Cobranca } from "./finance/FinanceTypes";
import { googleFetch as fetch } from "../lib/googleFetch";
import { 
  getEventColorClasses, 
  GOOGLE_CALENDAR_COLORS,
  darkenColor
} from "./Agenda";
import { LogoIcon } from "./Logo";

interface MyDayProps {
  token: string;
  spreadsheetId: string;
  onStartSession: (patientId: string, sessionId?: string) => void;
  onNavigateToTab: (tabId: string) => void;
  profileName: string;
  profileCrp: string;
  profileSubtitle: string;
  profileQuote: string;
  profileGreetingPrefix: string;
  profileClinicName: string;
  userPermissions?: any;
  role?: string;
}

export default function MyDay({
  role,
  token,
  spreadsheetId,
  onStartSession,
  onNavigateToTab,
  profileName,
  profileCrp,
  profileSubtitle,
  profileQuote,
  profileGreetingPrefix,
  profileClinicName,
  userPermissions
}: MyDayProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick task input
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"Alta" | "Média" | "Baixa">("Média");
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Load all daily data
  const loadDailyData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const futureLimit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(pastLimit)}&timeMax=${encodeURIComponent(futureLimit)}&singleEvents=true&orderBy=startTime&maxResults=2500`;

      let pData: any[], sData: any[], fData: any[], tData: any[], dData: any[], calRes: any;

      if (role === "secretary") {
        const [adminPatients, adminApps, finData, taskData, adminDocs, calendarRes] = await Promise.all([
          getAdministrativePatients(),
          getAdministrativeAppointments(),
          getFinancials(spreadsheetId, token),
          getTasks(spreadsheetId, token),
          getAdministrativeDocs(),
          fetch(calUrl, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .catch(err => {
              console.error("Error fetching calendar events for MyDay:", err);
              return null;
            })
        ]);
        pData = adminPatients;
        sData = adminApps;
        fData = finData;
        tData = taskData;
        dData = adminDocs;
        calRes = calendarRes;
      } else {
        [pData, sData, fData, tData, dData, calRes] = await Promise.all([
          getPatients(spreadsheetId, token),
          getSessions(spreadsheetId, token),
          getFinancials(spreadsheetId, token),
          getTasks(spreadsheetId, token),
          getDocs(spreadsheetId, token),
          fetch(calUrl, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .catch(err => {
              console.error("Error fetching calendar events for MyDay:", err);
              return null;
            })
        ]);
      }
      setPatients(pData);
      let validSessions = sData;
      if (calRes && calRes.items) {
        const activeCalEventIds = new Set(
          calRes.items
            .filter((e: any) => e.colorId !== "11") // 11 is red/cancelled
            .map((e: any) => e.id)
        );
        validSessions = sData.filter((s: any) => {
          if (!s.google_event_id) return true;
          const sTime = new Date(s.data_hora).getTime();
          const pastLimitTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
          const futureLimitTime = now.getTime() + 15 * 24 * 60 * 60 * 1000;
          
          if (sTime >= pastLimitTime && sTime <= futureLimitTime) {
            // Event should be in calendar, if not, it was deleted
            if (!activeCalEventIds.has(s.google_event_id)) {
              return false; // hide deleted or red sessions
            }
          }
          return true;
        });
      }
      setSessions(validSessions);
      setFinancials(fData);
      setTasks(tData);
      setDocs(dData);
      if (calRes && calRes.items) {
        setCalendarEvents(calRes.items);
      }
    } catch (e) {
      console.error("Error loading daily dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (spreadsheetId && token) {
      loadDailyData();
    }
  }, [spreadsheetId, token]);

  // Helpers to fetch patient name
  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.nome_preferencial : "Paciente";
  };

  const getPatientEmail = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.contato_email : "";
  };

  const getPatientValue = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.valor_padrao : 0;
  };

  // Google Meet state & handlers
  interface SavedMeetSpace {
    id: string;
    title: string;
    name: string;      // e.g. "spaces/abc-defg-hij"
    meetingUri: string; // e.g. "https://meet.google.com/abc-defg-hij"
    createdTime: string;
  }

  const [meetSpaces, setMeetSpaces] = useState<SavedMeetSpace[]>(() => {
    const saved = localStorage.getItem("serenapsi_meet_rooms");
    return saved ? JSON.parse(saved) : [];
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isGeneratingMeet, setIsGeneratingMeet] = useState(false);
  const [newMeetTitle, setNewMeetTitle] = useState("");

  useEffect(() => {
    localStorage.setItem("serenapsi_meet_rooms", JSON.stringify(meetSpaces));
  }, [meetSpaces]);

  const handleCreateMeetRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingMeet(true);
    try {
      const roomTitle = newMeetTitle.trim() || `Atendimento ${new Date().toLocaleDateString("pt-BR")}`;
      const data = await createGoogleMeetSpace(token);
      const newRoom: SavedMeetSpace = {
        id: generateUUID(),
        title: roomTitle,
        name: data.name,
        meetingUri: data.meetingUri,
        createdTime: new Date().toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setMeetSpaces(prev => [newRoom, ...prev]);
      setNewMeetTitle("");
    } catch (err) {
      console.error("Error creating Meet space:", err);
      alert("Erro ao criar sala do Google Meet. Verifique suas permissões do Google Workspace.");
    } finally {
      setIsGeneratingMeet(false);
    }
  };

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteMeetSpace = (id: string) => {
    setMeetSpaces(prev => prev.filter(r => r.id !== id));
  };

  // Filter today's sessions
  const getLocalDateStr = (dateInput: Date) => {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, "0");
    const day = String(dateInput.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getSessionLocalDateStr = (sessionDateStr: string) => {
    if (!sessionDateStr) return "";
    let dateStr = sessionDateStr;
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && dateStr.split("-").length >= 3 && dateStr.includes("T")) {
      dateStr = dateStr + "Z";
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return getLocalDateStr(d);
  };

  const getEventLocalDateStr = (event: any) => {
    if (event.start?.dateTime) {
      const d = new Date(event.start.dateTime);
      if (!isNaN(d.getTime())) {
        return getLocalDateStr(d);
      }
    }
    return event.start?.date || "";
  };

  const findPatientForEvent = (event: any) => {
    const summary = event.summary || "";
    const description = event.description || "";
    if (!summary && !description) return null;
    
    const textToSearch = (summary + " " + description).toLowerCase();
    
    // First, try to match by exact ID if it contains a patient ID (e.g., PAC-001)
    const matchId = textToSearch.match(/pac-\d+/);
    if (matchId) {
      const p = patients.find(pat => pat.id.toLowerCase() === matchId[0]);
      if (p) return p;
    }

    // Try to match by preferential name
    for (const p of patients) {
      const prefName = p.nome_preferencial.toLowerCase();
      if (prefName.length > 2 && textToSearch.includes(prefName)) {
        return p;
      }
      // Also try matching first name just in case
      const firstName = prefName.split(" ")[0];
      if (firstName.length > 2 && summary.toLowerCase().includes(firstName)) {
        return p;
      }
    }
    // Match by full name
    for (const p of patients) {
      const fullName = p.nome_completo.toLowerCase();
      if (fullName.length > 2 && textToSearch.includes(fullName)) {
        return p;
      }
    }
    return null;
  };

  const todayStr = getLocalDateStr(new Date());

  // 1. Get today's sessions from Sheets
  const todaySheetSessions = sessions.filter(s => {
    return getSessionLocalDateStr(s.data_hora) === todayStr;
  });

  // 2. Get today's events from Google Calendar
  const todayCalendarEvents = calendarEvents.filter(e => {
    const isToday = getEventLocalDateStr(e) === todayStr;
    if (!isToday) return false;

    // Ignore cancelled/red events
    const colorId = e.colorId || "";
    return colorId !== "11";
  });

  // 3. Merge Sheets and Calendar events, preventing duplicates
  const virtualSessions: Session[] = [];
  for (const event of todayCalendarEvents) {
    const matchedPatient = findPatientForEvent(event);
    const eventTime = event.start?.dateTime ? new Date(event.start.dateTime).getTime() : 0;
    
    const alreadyHasSession = todaySheetSessions.some(s => {
      if (s.google_event_id === event.id) return true;
      if (matchedPatient && s.paciente_id === matchedPatient.id) {
        const sTime = new Date(s.data_hora).getTime();
        // Same day and within 2 hours
        if (Math.abs(sTime - eventTime) < 2 * 60 * 60 * 1000) {
          return true;
        }
      }
      return false;
    });

    if (!alreadyHasSession) {
      const dataHora = event.start?.dateTime || new Date().toISOString();
      const meetLink = event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri || "";
      
      virtualSessions.push({
        id: `VIRT-${event.id}`,
        paciente_id: matchedPatient ? matchedPatient.id : "EXTERNAL",
        data_hora: dataHora,
        foco: event.description || "Consulta sincronizada do Google Agenda",
        resumo: event.summary || "Compromisso Externo",
        combinados_anterior: "",
        combinados_atual: "",
        foco_sugerido: "",
        status: "Rascunho",
        meet_link: meetLink,
        google_event_id: event.id
      });
    }
  }

  // Combine and sort by time
  const todaySessions = [
    ...todaySheetSessions,
    ...virtualSessions
  ].sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  const getSessionColorId = (session: Session) => {
    const event = todayCalendarEvents.find(e => e.id === session.google_event_id);
    return event?.colorId || "";
  };

  // Find next active appointment today
  const nextSession = todaySessions.find(s => s.status === "Rascunho");

  // Filter sessions to finalize (Sessões a finalizar)
  const draftSessions = sessions.filter(s => s.status === "Rascunho" && getSessionLocalDateStr(s.data_hora) < todayStr);

  // Filter pending financials (Pagamentos pendentes)
  const pendingPayments = financials.filter(f => f.status === "Pendente");

  // Priority tasks
  const pendingTasks = tasks.filter(t => t.status === "Pendente").sort((a, b) => {
    const priorityMap = { Alta: 1, Média: 2, Baixa: 3 };
    return priorityMap[a.prioridade] - priorityMap[b.prioridade];
  });

  // Handle task complete toggle
  const handleToggleTask = async (task: Task) => {
    const updated = { ...task, status: task.status === "Pendente" ? "Concluída" as const : "Pendente" as const };
    try {
      await updateTask(spreadsheetId, updated, token);
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch (e) {
      alert("Erro ao atualizar tarefa.");
    }
  };

  // Handle quick task creation
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsAddingTask(true);
    const newId = generateUUID();
    const task: Task = {
      id: newId,
      titulo: newTaskTitle.trim(),
      status: "Pendente",
      prioridade: newTaskPriority,
      data_limite: new Date().toISOString().split("T")[0]
    };
    try {
      await addTask(spreadsheetId, task, token);
      setTasks(prev => [task, ...prev]);
      setNewTaskTitle("");
    } catch (err) {
      alert("Erro ao adicionar tarefa.");
    } finally {
      setIsAddingTask(false);
    }
  };

  // Handle Gmail Confirmation
  const handleSendConfirmation = async (session: Session) => {
    const pEmail = getPatientEmail(session.paciente_id);
    const pName = getPatientName(session.paciente_id);
    if (!pEmail) {
      alert(`O paciente ${pName} não possui e-mail cadastrado.`);
      return;
    }

    const confirmed = window.confirm(`Deseja enviar uma mensagem de confirmação para o e-mail: ${pEmail}?`);
    if (!confirmed) return;

    const timeStr = new Date(session.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dateStr = new Date(session.data_hora).toLocaleDateString("pt-BR");
    
    const subject = `Confirmação de Consulta - ${profileName}`;
    const body = `
      <div style="font-family: sans-serif; padding: 24px; color: #111; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #064e3b; margin-top: 0;">Olá, ${pName}!</h2>
        <p>Gostaria de confirmar nosso próximo atendimento agendado:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <strong>Data:</strong> ${dateStr}<br/>
          <strong>Horário:</strong> ${timeStr}<br/>
          <strong>Formato:</strong> Consulta SerenaPsi
        </div>
        <p>Caso precise alterar ou desmarcar, peço a gentileza de me avisar com pelo menos 24h de antecedência.</p>
        <p style="margin-bottom: 0;">Abraço acolhedor,<br/><strong>${profileName}</strong><br/>${profileSubtitle}</p>
      </div>
    `;

    try {
      await sendGmailConfirmation(pEmail, subject, body, token);
      alert(`Confirmação enviada com sucesso para ${pName}!`);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar confirmação.");
    }
  };

  // Handle marking session absence (Registrar Falta)
  const handleMarkAbsence = async (session: Session) => {
    const pName = getPatientName(session.paciente_id);
    const confirmed = window.confirm(`Registrar falta para o paciente ${pName}? Isso cancelará esta sessão e vinculará a cobrança por falta no financeiro.`);
    if (!confirmed) return;

    try {
      // 1. Check existing charges in Firestore & Sheets to prevent duplicate charges (idempotencia)
      const firestoreData = await getFinancialDataApi();
      const existingCobrancas: Cobranca[] = firestoreData?.cobrancas || [];
      
      // Look for active charge matching this session ID
      const existingCharge = existingCobrancas.find(
        c => c.periodo_sessao_id === session.id && c.situacao !== "Cancelada" && c.situacao !== "Estornada"
      ) || financials.find(
        f => f.sessao_id === session.id && f.status !== "Cancelada"
      );

      const updatedSession: Session = {
        ...session,
        status: "Cancelada",
        alteracao_log: `[${new Date().toISOString()}] Registro de falta da sessão`
      };

      const sessionDateStr = session.data_hora 
        ? session.data_hora.substring(0, 10) 
        : new Date().toISOString().split("T")[0];

      const patientValue = getPatientValue(session.paciente_id);

      let createdNewCharge = false;

      if (!existingCharge) {
        // CREATE: Nenhuma cobrança ativa existe para esta sessão -> Criar nova cobrança de falta
        const chargeId = generateUUID();
        const newCobranca: Cobranca = {
          id: chargeId,
          paciente_id: session.paciente_id,
          responsavel_financeiro: "",
          origem: "Falta",
          periodo_sessao_id: session.id,
          valor_original: patientValue,
          desconto: 0,
          acrescimo: 0,
          valor_pago: 0,
          saldo_restante: patientValue,
          data_vencimento: sessionDateStr,
          situacao: "Pendente",
          forma_pagamento: "Pix",
          situacao_recibo: "Não solicitado",
          situacao_nfse: "Não solicitada",
          observacoes: `Cobrança por falta/ausência na sessão de ${new Date(session.data_hora).toLocaleDateString("pt-BR")}`,
          createdAt: new Date().toISOString()
        };

        const sheetRecord: FinancialRecord = {
          id: chargeId,
          paciente_id: session.paciente_id,
          sessao_id: session.id,
          tipo: "Receita",
          valor: patientValue,
          status: "Pendente",
          forma_pagamento: "Pix",
          data_vencimento: sessionDateStr,
          desconto: 0,
          observacoes: `Cobrança por falta em ${new Date(session.data_hora).toLocaleDateString("pt-BR")}`
        };

        // Persist to Firestore and Sheets
        const apiSuccess = await saveCobrancaApi(newCobranca);
        if (!apiSuccess) {
          throw new Error("Falha ao salvar a cobrança no banco de dados.");
        }

        if (spreadsheetId && token) {
          await addFinancial(spreadsheetId, sheetRecord, token);
        }

        createdNewCharge = true;
      } else {
        // UPDATE: Já existe cobrança ativa para esta sessão -> Atualiza somente se necessário
        const existingId = "id" in existingCharge ? existingCharge.id : (existingCharge as any).id;
        const updatedCobranca: Cobranca = {
          id: existingId,
          paciente_id: session.paciente_id,
          responsavel_financeiro: "",
          origem: "Falta",
          periodo_sessao_id: session.id,
          valor_original: patientValue,
          desconto: 0,
          acrescimo: 0,
          valor_pago: (existingCharge as any).valor_pago || 0,
          saldo_restante: patientValue - ((existingCharge as any).valor_pago || 0),
          data_vencimento: sessionDateStr,
          situacao: (existingCharge as any).situacao || "Pendente",
          forma_pagamento: "Pix",
          situacao_recibo: "Não solicitado",
          situacao_nfse: "Não solicitada",
          observacoes: `Cobrança por falta em ${new Date(session.data_hora).toLocaleDateString("pt-BR")}`,
          createdAt: (existingCharge as any).createdAt || new Date().toISOString()
        };

        await saveCobrancaApi(updatedCobranca);

        if (spreadsheetId && token) {
          const sheetRecord: FinancialRecord = {
            id: existingId,
            paciente_id: session.paciente_id,
            sessao_id: session.id,
            tipo: "Receita",
            valor: patientValue,
            status: "Pendente",
            forma_pagamento: "Pix",
            data_vencimento: sessionDateStr,
            desconto: 0,
            observacoes: `Cobrança por falta em ${new Date(session.data_hora).toLocaleDateString("pt-BR")}`
          };
          await updateFinancial(spreadsheetId, sheetRecord, token);
        }
      }

      // 2. Persist session cancellation status
      if (spreadsheetId && token) {
        await updateSession(spreadsheetId, updatedSession, token);
      }

      // Update UI state only on successful persistence
      setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));

      if (createdNewCharge) {
        alert("Falta registrada com sucesso e cobrança por falta gerada no financeiro.");
      } else {
        alert("Falta registrada. A cobrança existente para esta sessão foi mantida (sem duplicidade).");
      }

      await loadDailyData();
    } catch (err: any) {
      console.error("Erro ao registrar falta:", err);
      alert(`Erro ao registrar falta no servidor: ${err.message || "Tente novamente."}`);
    }
  };

  // One-click quick receive payment
  const handleQuickReceivePayment = async (record: FinancialRecord) => {
    const pName = getPatientName(record.paciente_id);
    const confirmed = window.confirm(`Marcar pagamento de R$ ${record.valor.toFixed(2)} do paciente ${pName} como PAGO integralmente via Pix?`);
    if (!confirmed) return;

    const updated: FinancialRecord = {
      ...record,
      status: "Pago",
      data_pagamento: new Date().toISOString().split("T")[0],
      forma_pagamento: "Pix"
    };

    try {
      await updateFinancial(spreadsheetId, updated, token);
      setFinancials(prev => prev.map(f => f.id === record.id ? updated : f));
      alert("Pagamento registrado com sucesso!");
    } catch (e) {
      alert("Erro ao receber pagamento.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-emerald-950">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-4" />
        <p className="font-sans font-medium text-lg">Carregando seu dia de atendimentos...</p>
        <p className="text-xs text-emerald-600/70 font-mono mt-1">Conectando ao Google Sheets de forma segura</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in px-4 md:px-0">
      {/* Friendly Header Greetings */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-emerald-100 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <LogoIcon size={64} className="rounded-2xl border border-emerald-100 shadow-sm shrink-0" />
          
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block bg-emerald-50 px-2 py-1 rounded-md w-max">
              {profileClinicName}
            </span>
            <h2 className="text-3xl font-serif italic text-emerald-900 tracking-tight pt-1">
              {profileGreetingPrefix}, {profileName}
            </h2>
            <p className="text-xs text-emerald-700/80 font-bold uppercase tracking-wider font-sans">
              {profileSubtitle} • <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{profileCrp}</span>
            </p>
            <p className="text-xs text-emerald-600/90 font-sans pt-1">
              Seja bem-vinda ao seu consultório. Hoje é{" "}
              <span className="font-semibold text-emerald-800">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              .
            </p>
            {profileQuote && (
              <p className="text-xs italic text-emerald-600/80 mt-3 bg-emerald-50/40 py-2 px-3.5 rounded-xl border border-emerald-100/30 max-w-2xl leading-relaxed">
                "{profileQuote}"
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (role === "secretary") {
              alert("Acesso restrito: Sua conta não possui permissão para iniciar ou gerenciar sessões clínicas.");
              return;
            }
            onStartSession("");
          }}
          className={`flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl font-bold transition text-xs shrink-0 self-stretch sm:self-start lg:self-center active:scale-95 active:opacity-90 duration-150 ${
            role === "secretary"
              ? "bg-emerald-800/40 text-white/50 cursor-not-allowed"
              : "bg-emerald-800 hover:bg-emerald-900 text-white shadow-md hover:shadow-lg cursor-pointer"
          }`}
          disabled={role === "secretary"}
          id="quick-start-session-btn"
        >
          <Play size={14} fill="currentColor" />
          <span>Atendimento Avulso</span>
        </button>
      </div>

      {/* Grid: Main sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 columns: Next session and today's sessions */}
        <div className="lg:col-span-2 space-y-8">
          
          {(() => {
            const nextSessionColorId = nextSession ? getSessionColorId(nextSession) : "";
            const nextSessionBaseHex = GOOGLE_CALENDAR_COLORS.find(c => c.id === nextSessionColorId)?.hex || "#047857";
            const bgHex = darkenColor(nextSessionBaseHex, 40);
            const borderHex = darkenColor(nextSessionBaseHex, 60);
            const typeName = GOOGLE_CALENDAR_COLORS.find(c => c.id === nextSessionColorId)?.name.split(" / ")[0];

            return (
              <div 
                className="text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden transition-all duration-300"
                style={{ backgroundColor: bgHex, borderColor: borderHex, borderWidth: 1 }}
              >
                {/* Ambient Background Glow */}
                <div 
                  className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-40 -mr-16 -mt-16" 
                  style={{ backgroundColor: nextSessionBaseHex }}
                />
                <div 
                  className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-20 -ml-16 -mb-16" 
                  style={{ backgroundColor: nextSessionBaseHex }}
                />
                <div className="relative z-10 space-y-4">
                  <span 
                    className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: borderHex, color: "#fff" }}
                  >
                    <Clock size={12} />
                    <span>Próximo Atendimento</span>
                  </span>
                  {nextSession ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-white break-words">
                          {nextSession.paciente_id === "EXTERNAL" 
                            ? (nextSession.resumo || "Compromisso Externo") 
                            : getPatientName(nextSession.paciente_id)}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-white/80 text-sm">
                          <span className="flex items-center space-x-1 font-semibold">
                            <Clock size={14} />
                            <span>
                              {new Date(nextSession.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                          <span className="flex items-center space-x-1 font-semibold">
                            <Video size={14} />
                            <span>Paciente Ativo</span>
                          </span>
                          {typeName && (
                            <span className="flex items-center space-x-1 opacity-90 font-medium">
                              • {typeName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (role === "secretary") {
                          alert("Acesso restrito: Sua conta não possui permissão para iniciar ou gerenciar sessões clínicas.");
                          return;
                        }
                        onStartSession(nextSession.paciente_id, nextSession.id);
                      }}
                      className={`flex-1 flex items-center justify-center space-x-3 font-bold px-6 py-4 rounded-2xl transition text-base active:scale-95 active:opacity-90 duration-150 ${
                        role === "secretary"
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white hover:bg-emerald-50 text-emerald-950 shadow-lg cursor-pointer"
                      }`}
                      disabled={role === "secretary"}
                      id="dashboard-start-active-btn"
                    >
                      <Play size={20} fill="currentColor" />
                      <span>Iniciar Atendimento</span>
                    </button>
                    
                    {nextSession.meet_link && (
                      <a
                        href={nextSession.meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center space-x-3 bg-emerald-900 hover:bg-emerald-950 text-white font-bold px-6 py-4 rounded-2xl shadow-lg transition border border-emerald-700/60 cursor-pointer text-base active:scale-95 active:opacity-95 duration-150"
                      >
                        <Video size={20} className="text-emerald-300 animate-pulse" />
                        <span>Entrar no Meet</span>
                      </a>
                    )}
                  </div>

                  {nextSession.foco && (
                    <div className="bg-emerald-900/40 backdrop-blur-sm border border-emerald-700/50 rounded-2xl p-4 text-xs text-emerald-100 w-full flex flex-col justify-center">
                      <span className="font-semibold text-emerald-300">FOCO PLANEJADO:</span>
                      <p className="line-clamp-2 mt-0.5">{nextSession.foco}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 space-y-3">
                  <h3 className="text-xl font-medium text-white">Excelente! Não há mais sessões pendentes para hoje.</h3>
                  <p className="text-sm text-emerald-200 max-w-md">Todos os atendimentos planejados de hoje já foram iniciados ou concluídos com sucesso.</p>
                  <button
                    onClick={() => onNavigateToTab("agenda")}
                    className="inline-flex items-center space-x-1.5 text-sm font-semibold text-white hover:underline mt-2"
                  >
                    <span>Ir para agenda</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          );
          })()}

          {/* Today's Agenda List */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-sans text-emerald-950 flex items-center space-x-2">
                <Calendar size={18} className="text-emerald-700" />
                <span>Atendimentos de Hoje</span>
              </h3>
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full">
                {todaySessions.length} {todaySessions.length === 1 ? "SESSÃO" : "SESSÕES"}
              </span>
            </div>

            {todaySessions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-emerald-100 rounded-2xl">
                <Calendar size={36} className="mx-auto text-emerald-200 mb-2 animate-pulse" />
                <p className="text-sm font-sans font-medium text-emerald-800">Sua agenda está livre hoje!</p>
                <p className="text-xs text-emerald-600/60 mt-1 max-w-xs mx-auto">Use esse tempo livre para revisar prontuários ou relaxar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session) => {
                  const patientName = session.paciente_id === "EXTERNAL"
                    ? (session.resumo || "Compromisso Externo")
                    : getPatientName(session.paciente_id);
                  const isDraft = session.status === "Rascunho";
                  const isFinished = session.status === "Finalizada";
                  const isCanceled = session.status === "Cancelada";
                  const timeStr = new Date(session.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  
                  const colorId = getSessionColorId(session);
                  // We only use the color classes when it's a draft or finished. If canceled, keep the red state.
                  const colors = isCanceled ? null : getEventColorClasses(colorId, true);
                  const typeName = GOOGLE_CALENDAR_COLORS.find(c => c.id === colorId)?.name.split(" / ")[0];

                  return (
                    <div
                      key={session.id}
                      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border transition w-full ${
                        isCanceled ? "bg-red-50/30 border-red-100/50" : (isFinished ? "opacity-75 grayscale" : "shadow-sm hover:shadow-md")
                      }`}
                      style={colors ? colors.cardStyle : undefined}
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div 
                          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm shrink-0 ${isCanceled ? "bg-red-100 text-red-800" : ""}`}
                          style={colors ? colors.dateBgStyle : undefined}
                        >
                          <span>{timeStr}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 
                            className={`font-bold font-sans text-base truncate ${isCanceled ? "text-red-900" : ""}`} 
                            title={patientName}
                            style={colors ? colors.textStyle : undefined}
                          >
                            {patientName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] mt-1" style={colors ? colors.secondaryTextStyle : undefined}>
                            {isFinished ? (
                              <span className="flex items-center space-x-0.5 font-semibold">
                                <CheckCircle2 size={12} style={colors ? colors.iconStyle : undefined} />
                                <span>Atendido</span>
                              </span>
                            ) : isCanceled ? (
                              <span className="flex items-center space-x-0.5 text-red-600 font-semibold">
                                <XCircle size={12} />
                                <span>Falta / Desmarcada</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-0.5 font-semibold">
                                <Clock size={12} style={colors ? colors.iconStyle : undefined} />
                                <span>Pronto</span>
                              </span>
                            )}

                            {session.meet_link && (
                              <span className="flex items-center space-x-0.5 font-medium">
                                <Video size={12} style={colors ? colors.iconStyle : undefined} />
                                <span>On-line</span>
                              </span>
                            )}

                            {typeName && (
                              <span className="font-medium opacity-75">
                                • {typeName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Quick Actions */}
                      <div className="flex flex-wrap gap-2 items-center justify-end">
                        {isDraft && (
                          <>
                            {session.meet_link && (
                              <a
                                href={session.meet_link}
                                target="_blank"
                                rel="noreferrer"
                                title="Entrar na sala do Google Meet"
                                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/60 hover:text-emerald-950 transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer active:scale-95 duration-150 active:opacity-90"
                              >
                                <Video size={14} className="text-emerald-700 animate-pulse" />
                                <span className="hidden md:inline">Google Meet</span>
                              </a>
                            )}
                            {session.paciente_id !== "EXTERNAL" && (
                              <>
                                <button
                                  onClick={() => handleSendConfirmation(session)}
                                  title="Confirmar por Gmail"
                                  className="p-2.5 rounded-xl text-emerald-700 hover:bg-emerald-50 border border-emerald-100/60 hover:text-emerald-900 transition flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 duration-150 active:opacity-90"
                                >
                                  <Send size={14} />
                                  <span className="hidden md:inline">Confirmar</span>
                                </button>
                                <button
                                  onClick={() => handleMarkAbsence(session)}
                                  title="Registrar Falta"
                                  className="p-2.5 rounded-xl text-red-600 hover:bg-red-50 border border-red-100 hover:text-red-800 transition flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 duration-150 active:opacity-90"
                                >
                                  <XCircle size={14} />
                                  <span className="hidden md:inline">Falta</span>
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                if (role === "secretary") {
                                  alert("Acesso restrito: Sua conta não possui permissão para iniciar ou gerenciar sessões clínicas.");
                                  return;
                                }
                                onStartSession(session.paciente_id, session.id);
                              }}
                              className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-1.5 text-xs shadow-sm hover:shadow transition active:scale-95 duration-150 active:opacity-90 ${
                                role === "secretary"
                                  ? "bg-emerald-700/40 text-white/50 cursor-not-allowed"
                                  : "bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                              }`}
                              disabled={role === "secretary"}
                            >
                              <Play size={12} fill="white" />
                              <span>Atender</span>
                            </button>
                          </>
                        )}
                        
                        {isFinished && (
                          <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-lg flex items-center space-x-1">
                            <CheckCircle2 size={12} />
                            <span>Código: {session.id}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Action trackers, drafts, finance, tasks */}
        <div className="space-y-8">
          
          {/* Salas de Atendimento Google Meet */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4 animate-fade-in">
            <h3 className="text-xl font-serif italic text-emerald-950 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Video size={20} className="text-emerald-700 animate-pulse" />
                <span>Salas Google Meet</span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                Integrado
              </span>
            </h3>

            <p className="text-xs text-emerald-600/70 leading-relaxed font-sans">
              Crie salas de videoconferência instantâneas do Google Meet integradas à sua conta de psicóloga de forma segura.
            </p>

            <form onSubmit={handleCreateMeetRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="Nome da sala (ex: Paciente Ana)..."
                value={newMeetTitle}
                onChange={(e) => setNewMeetTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-2.5 border border-emerald-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-emerald-50/10 text-emerald-950 font-sans"
              />
              <button
                type="submit"
                disabled={isGeneratingMeet}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center space-x-1 shrink-0"
              >
                {isGeneratingMeet ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span>Criar</span>
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {meetSpaces.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-emerald-100 rounded-2xl">
                  <Video size={24} className="mx-auto text-emerald-200 mb-1" />
                  <p className="text-xs font-medium text-emerald-850 font-sans">Nenhuma sala instantânea ativa</p>
                  <p className="text-[10px] text-emerald-600/60 mt-0.5 font-sans">Digite o nome da sala e clique em "Criar".</p>
                </div>
              ) : (
                meetSpaces.map(space => (
                  <div key={space.id} className="flex items-center justify-between p-3 bg-emerald-50/10 hover:bg-emerald-50/30 rounded-xl border border-emerald-100/20 transition group">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-bold text-emerald-950 truncate font-sans">{space.title}</p>
                      <p className="text-[9px] font-mono text-emerald-600/70 mt-0.5 truncate">{space.meetingUri}</p>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleCopyLink(space.id, space.meetingUri)}
                        title="Copiar Link"
                        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100/60 hover:text-emerald-900 transition cursor-pointer"
                      >
                        {copiedId === space.id ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      </button>
                      <a
                        href={space.meetingUri}
                        target="_blank"
                        rel="noreferrer"
                        title="Entrar na Sala"
                        className="p-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition flex items-center justify-center cursor-pointer"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => handleDeleteMeetSpace(space.id)}
                        title="Excluir"
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800 transition cursor-pointer font-bold text-sm leading-none"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sessões a finalizar */}
          {draftSessions.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 font-sans flex items-center space-x-2">
                <AlertCircle size={16} />
                <span>Sessões a Finalizar</span>
              </h3>
              <p className="text-xs text-amber-700/80">Sessões passadas salvas como rascunho. Toque para complementar notas ou fechar.</p>
              
              <div className="space-y-2">
                {draftSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      if (role === "secretary") {
                        alert("Acesso restrito: Sua conta não possui permissão para iniciar ou gerenciar sessões clínicas.");
                        return;
                      }
                      onStartSession(session.paciente_id, session.id);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                      role === "secretary"
                        ? "bg-gray-50 border-gray-100 cursor-not-allowed opacity-60"
                        : "bg-white hover:bg-amber-50 border-amber-100"
                    }`}
                    disabled={role === "secretary"}
                  >
                    <div>
                      <p className="font-semibold text-amber-950 text-sm">{getPatientName(session.paciente_id)}</p>
                      <span className="text-[10px] text-amber-700/70">{new Date(session.data_hora).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">Continuar</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pagamentos Pendentes */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
            <h3 className="text-base font-bold font-sans text-emerald-950 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <DollarSign size={18} className="text-emerald-700" />
                <span>Pendências Financeiras</span>
              </span>
              <span className="text-xs bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full">
                {pendingPayments.length}
              </span>
            </h3>

            {pendingPayments.length === 0 ? (
              <p className="text-xs text-emerald-600/60 py-4 text-center">Nenhuma pendência em aberto. Tudo em dia!</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pendingPayments.map(record => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-red-50/20 hover:bg-red-50/40 rounded-xl border border-red-100/40 transition">
                    <div>
                      <p className="text-sm font-bold text-emerald-950">{getPatientName(record.paciente_id)}</p>
                      <span className="text-[10px] font-mono text-emerald-600/70">Ref: {record.observacoes || "Sessão realizada"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-red-600">R$ {record.valor.toFixed(0)}</span>
                      <button
                        onClick={() => handleQuickReceivePayment(record)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Receber
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarefas Prioritárias */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
            <h3 className="text-base font-bold font-sans text-emerald-950 flex items-center justify-between">
              <span>Minhas Tarefas</span>
              <span className="text-xs bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                {pendingTasks.length} pendentes
              </span>
            </h3>

            {/* Quick add form */}
            <form onSubmit={handleQuickAddTask} className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Enviar laudo para Dra. Ana..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-emerald-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-emerald-50/10 text-emerald-950"
              />
              <button
                type="submit"
                disabled={isAddingTask}
                className="p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
              >
                <Plus size={16} />
              </button>
            </form>

            {pendingTasks.length === 0 ? (
              <p className="text-xs text-emerald-600/60 py-4 text-center">Tudo feito por aqui! Parabéns.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-start space-x-3 p-2 bg-emerald-50/10 hover:bg-emerald-50/30 rounded-xl transition">
                    <input
                      type="checkbox"
                      checked={task.status === "Concluída"}
                      onChange={() => handleToggleTask(task)}
                      className="mt-1 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 border-emerald-300 accent-emerald-700 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-950 leading-snug">{task.titulo}</p>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 uppercase ${
                        task.prioridade === "Alta"
                          ? "bg-red-100 text-red-800"
                          : task.prioridade === "Média"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {task.prioridade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos Recentes */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
            <h3 className="text-base font-bold font-sans text-emerald-950 flex items-center space-x-2">
              <FileText size={18} className="text-emerald-700" />
              <span>Documentos Gerados</span>
            </h3>

            {docs.length === 0 ? (
              <p className="text-xs text-emerald-600/60 py-4 text-center">Nenhum documento gerado ainda.</p>
            ) : (
              <div className="space-y-2">
                {docs.slice(0, 4).map(doc => (
                  <a
                    key={doc.id}
                    href={doc.google_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 bg-emerald-50/10 hover:bg-emerald-50/30 rounded-xl border border-emerald-100/20 transition group"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-emerald-950 truncate">{doc.titulo}</p>
                      <p className="text-[9px] text-emerald-600/70 mt-0.5 uppercase tracking-wider">{doc.tipo} • {getPatientName(doc.paciente_id)}</p>
                    </div>
                    <span className="text-[10px] text-emerald-700 group-hover:underline font-semibold font-sans flex items-center space-x-0.5 shrink-0">
                      <span>Abrir</span>
                      <span>↗</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
