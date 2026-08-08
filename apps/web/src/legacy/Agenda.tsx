import React, { useState, useEffect } from "react";
import { generateUUID } from "../lib/uuid";
import {
  Calendar,
  Clock,
  Video,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Mail,
  User,
  CalendarDays,
  Sparkles,
  Link,
  RefreshCw
} from "lucide-react";
import {
  Patient,
  Session,
  getPatients,
  getSessions,
  getAdministrativePatients,
  getAdministrativeAppointments,
  createCalendarEvent,
  deleteCalendarEvent,
  deleteSession,
  updateCalendarEvent,
  sendGmailConfirmation,
  addSession
} from "../lib/workspace";
import { googleFetch as fetch } from "../lib/googleFetch";

interface AgendaProps {
  token: string;
  spreadsheetId: string;
  role?: string;
}

export const GOOGLE_CALENDAR_COLORS = [
  { id: "", name: "Padrão (Verde Serena)", hex: "#047857", desc: "Cor padrão da clínica" },
  { id: "1", name: "Supervisão / Interconsulta", hex: "#a4bdfc", desc: "Supervisões e discussões de caso" },
  { id: "2", name: "Desenvolvimento Infantil / Lúdico", hex: "#7ae7bf", desc: "Atendimentos infantis e lúdicos" },
  { id: "3", name: "Terapia Familiar / Casal", hex: "#dbadff", desc: "Sessões conjuntas, casais e famílias" },
  { id: "4", name: "Casos de Alta Complexidade / Risco", hex: "#ff887c", desc: "Casos graves, crises agudas ou risco" },
  { id: "5", name: "Financeiro Pendente / Acordo", hex: "#fbd75b", desc: "Pendências ou controle financeiro" },
  { id: "6", name: "Primeira Consulta / Triagem", hex: "#ffb878", desc: "Novos pacientes, anamnese e triagem" },
  { id: "7", name: "Paciente de Convênio / Social", hex: "#46d6db", desc: "Atendimentos via convênios ou tarifa social" },
  { id: "8", name: "Outros Assuntos / Bloqueio", hex: "#e1e1e1", desc: "Compromissos pessoais, administrativo ou folga" },
  { id: "9", name: "Avaliação Psicológica / Testes", hex: "#5484ed", desc: "Sessões de aplicação de testes e laudos" },
  { id: "10", name: "Sessão Concluída / Paga", hex: "#51b749", desc: "Atendimentos faturados ou acertados" },
  { id: "11", name: "Questões Emocionais / Urgência", hex: "#dc2127", desc: "Casos urgentes ou pautas delicadas" }
];

// Helper to calculate YIQ contrast (returns dark text or light text depending on background brightness)
export function getContrastYIQ(hexcolor: string): string {
  let hex = hexcolor.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 150) ? "#0f172a" : "#ffffff"; // 150 for slightly safer dark text on pastel
}

// Helper to darken a hex color by a percentage
export function darkenColor(hexcolor: string, percent: number): string {
  let hex = hexcolor.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent / 100))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent / 100))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent / 100))));

  const rHex = r.toString(16).padStart(2, "0");
  const gHex = g.toString(16).padStart(2, "0");
  const bHex = b.toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

export const getEventColorClasses = (colorId?: string, isToday?: boolean, primaryCalendarColor: string = "#047857") => {
  const colorObj = GOOGLE_CALENDAR_COLORS.find(c => c.id === (colorId || ""));
  const baseHex = colorObj ? colorObj.hex : primaryCalendarColor;

  // Derive beautiful semantic palettes dynamically using the exact hex!
  const darkText = darkenColor(baseHex, 60);       // Safe high-contrast text color
  const mediumText = darkenColor(baseHex, 45);     // Sub-text color
  
  // Make backgrounds softer, more elegant, and closer to layout (low opacity subtle pastel tint)
  const subtleBg = `${baseHex}0c`;                 // ~5% opacity background for an extremely clean pastel tint
  const borderHex = `${baseHex}25`;                // ~15% opacity for beautiful subtle border
  
  // Today's special high visibility states:
  const cardBg = isToday ? `${baseHex}18` : subtleBg; // ~9% vs ~5% background
  const cardBorder = isToday ? `${baseHex}50` : borderHex; // ~30% vs ~15% border border

  return {
    hex: baseHex,
    cardStyle: {
      backgroundColor: cardBg,
      borderColor: cardBorder,
      borderLeftWidth: "5px",
      borderLeftStyle: "solid" as const,
      borderLeftColor: baseHex,
    },
    dateBgStyle: {
      backgroundColor: baseHex,
      color: getContrastYIQ(baseHex),
    },
    badgeStyle: {
      backgroundColor: `${baseHex}25`,
      color: darkText,
    },
    textStyle: {
      color: darkText,
    },
    secondaryTextStyle: {
      color: mediumText,
    },
    iconStyle: {
      color: baseHex,
    },
    buttonStyle: {
      borderColor: `${baseHex}40`,
      backgroundColor: `${baseHex}15`,
      color: darkText,
    },
    buttonHoverStyle: {
      backgroundColor: `${baseHex}30`,
    },
    dotStyle: {
      backgroundColor: baseHex,
    }
  };
};

export default function Agenda({ token, spreadsheetId, role }: AgendaProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [primaryCalendarColor, setPrimaryCalendarColor] = useState<string>("#047857");
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editColorId, setEditColorId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Scheduling state
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("14:00");
  const [schedModalidade, setSchedModalidade] = useState<"Online" | "Presencial">("Online");
  const [schedColorId, setSchedColorId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recorrenciaSemanas, setRecorrenciaSemanas] = useState(4); // default 4 weeks
  
  const [hasConflict, setHasConflict] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Custom Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    message: string;
    isAlert?: boolean;
    resolve?: (value: boolean) => void;
  } | null>(null);

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({ isOpen: true, message, resolve });
    });
  };

  const showAlert = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({ isOpen: true, message, isAlert: true, resolve: (val) => resolve() });
    });
  };

  // Load calendar & patient lists
  const loadAgendaData = async () => {
    setLoading(true);
    try {
      let pData: any[], sData: any[];
      if (role === "secretary") {
        const [adminPatients, adminAppointments] = await Promise.all([
          getAdministrativePatients(),
          getAdministrativeAppointments()
        ]);
        pData = adminPatients;
        sData = adminAppointments;
      } else {
        [pData, sData] = await Promise.all([
          getPatients(spreadsheetId, token),
          getSessions(spreadsheetId, token)
        ]);
      }
      setPatients(pData);
      setSessions(sData);

      // Fetch official Google Calendar events to make the integration real!
      const now = new Date();
      const pastLimit = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const futureLimit = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      
      const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(pastLimit)}&timeMax=${encodeURIComponent(futureLimit)}&singleEvents=true&orderBy=startTime&maxResults=2500`;
      
      const [calRes, calListRes] = await Promise.all([
        fetch(calUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/primary`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => {
          console.error("Error calling calendarList primary endpoint:", err);
          return null;
        })
      ]);

      if (calRes.ok) {
        const calData = await calRes.json();
        setCalendarEvents(calData.items || []);
      }

      if (calListRes && calListRes.ok) {
        const calListData = await calListRes.json();
        if (calListData.backgroundColor) {
          setPrimaryCalendarColor(calListData.backgroundColor);
        }
      }
    } catch (e) {
      console.error("Error loading calendar events:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (spreadsheetId && token) {
      loadAgendaData();
    }
  }, [spreadsheetId, token]);

  // Check Schedule Conflicts
  useEffect(() => {
    if (!schedDate || !schedTime) {
      setHasConflict(false);
      return;
    }

    const proposedStart = new Date(`${schedDate}T${schedTime}:00`);
    const proposedEnd = new Date(proposedStart.getTime() + 50 * 60 * 1000); // 50 mins

    const conflict = calendarEvents.some(event => {
      if (!event.start?.dateTime) return false;
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(eventStart.getTime() + 50 * 60 * 1000);
      
      // Overlap calculation
      return proposedStart < eventEnd && proposedEnd > eventStart;
    });

    setHasConflict(conflict);
  }, [schedDate, schedTime, calendarEvents]);

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.nome_preferencial : "Paciente";
  };

  const getPatientEmail = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.contato_email : "";
  };

  // Create Appointment Action
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !schedDate || !schedTime) {
      await showAlert("Por favor, preencha todos os campos do agendamento.");
      return;
    }

    const selectedPatient = patients.find(p => p.id === selectedPatientId);
    if (!selectedPatient) return;

    if (hasConflict) {
      const proceed = await showConfirm("⚠️ Há um conflito de horário na sua agenda do Google Calendar. Deseja mesmo forçar este agendamento?");
      if (!proceed) return;
    }

    setIsScheduling(true);
    try {
      // 1. Calculate how many occurrences to generate (recurrence)
      const occurrences = isRecurring ? recorrenciaSemanas : 1;
      let startDateTime = new Date(`${schedDate}T${schedTime}:00`);

      for (let o = 0; o < occurrences; o++) {
        const currentDateISO = startDateTime.toISOString();
        
        // a) Create Event on Google Calendar
        const calRes = await createCalendarEvent({
          pacienteId: selectedPatient.id,
          pacienteNome: selectedPatient.nome_preferencial,
          dataHoraISO: currentDateISO,
          modalidade: schedModalidade,
          colorId: schedColorId || undefined
        }, token);

        // b) Register Session Draft in Sheets
        const sId = generateUUID();
        const newSession: Session = {
          id: sId,
          paciente_id: selectedPatient.id,
          data_hora: currentDateISO,
          foco: "Sessão agendada via central de agenda.",
          resumo: "",
          combinados_anterior: "Nenhum histórico disponível.",
          combinados_atual: "",
          foco_sugerido: "",
          status: "Rascunho",
          supervisor_ia_sugestoes: "",
          meet_link: calRes?.meetLink || "",
          google_event_id: calRes?.eventId || ""
        };

        await addSession(spreadsheetId, newSession, token);

        // Incremental: move 7 days forward for next recurrence
        startDateTime = new Date(startDateTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      await showAlert("Consultas agendadas com sucesso no Google Agenda!");
      
      // Ask to send Gmail notification
      if (selectedPatient.contato_email) {
        const sendNotif = await showConfirm(`Deseja enviar uma confirmação automática por e-mail para ${selectedPatient.nome_preferencial} (${selectedPatient.contato_email})?`);
        if (sendNotif) {
          const formattedDate = new Date(`${schedDate}T${schedTime}`).toLocaleDateString("pt-BR");
          const formattedTime = schedTime;
          const pName = localStorage.getItem("serenapsi_profile_name") || "Dra. Virgínia Macedo";
          const pSubtitle = localStorage.getItem("serenapsi_profile_subtitle") || "Psicóloga Clínica";
          const body = `
            <div style="font-family: sans-serif; padding: 24px; color: #111; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #064e3b; margin-top: 0;">Olá, ${selectedPatient.nome_preferencial}!</h2>
              <p>Passando para confirmar nosso agendamento de terapia:</p>
              <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <strong>Data:</strong> ${formattedDate}<br/>
                <strong>Horário:</strong> ${formattedTime}<br/>
                <strong>Formato:</strong> ${schedModalidade === "Online" ? "Sessão On-line (Google Meet)" : "Presencial (Consultório)"}
              </div>
              <p>Espero você! Caso precise remarcar, por favor me avise com pelo menos 24h de antecedência.</p>
              <p style="margin-bottom: 0;">Abraço acolhedor,<br/><strong>${pName}</strong><br/>${pSubtitle}</p>
            </div>
          `;
          await sendGmailConfirmation(selectedPatient.contato_email, `Consulta Confirmada - ${pName}`, body, token);
          await showAlert("E-mail de confirmação enviado via Gmail!");
        }
      }

      // Reset Form and Reload list
      setSelectedPatientId("");
      setSchedDate("");
      setSchedColorId("");
      setIsRecurring(false);
      loadAgendaData();
    } catch (err: any) {
      console.error(err);
      await showAlert("Erro ao efetuar agendamento: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  // Delete Calendar event
  const handleDeleteEvent = async (eventId: string, summary: string) => {
    const confirmed = await showConfirm(`Deseja realmente desmarcar e excluir a consulta: "${summary}"?`);
    if (!confirmed) return;

    try {
      await deleteCalendarEvent(eventId, token);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
      
      const sessionToDelete = sessions.find(s => s.google_event_id === eventId);
      if (sessionToDelete) {
        await deleteSession(spreadsheetId, sessionToDelete.id, token);
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      }
      await showAlert("Consulta desmarcada com sucesso.");
    } catch (e) {
      await showAlert("Erro ao excluir consulta: " + (e.message || e)); console.error(e);
    }
  };

  const startEditing = (event: any) => {
    const dateObj = new Date(event.start.dateTime || event.start.date);
    setEditingEventId(event.id);
    setEditSummary(event.summary || "");
    setEditDescription(event.description || "");
    setEditDate(dateObj.toISOString().split("T")[0]);
    setEditTime(dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    setEditColorId(event.colorId || "");
  };

  const handleUpdateEvent = async () => {
    if (!editingEventId) return;
    setIsUpdating(true);
    try {
      const startDateTime = new Date(`${editDate}T${editTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 50 * 60 * 1000); // 50 min default
      
      const updates = {
        summary: editSummary,
        description: editDescription,
        start: { dateTime: startDateTime.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDateTime.toISOString(), timeZone: "America/Sao_Paulo" },
        colorId: editColorId || null
      };

      await updateCalendarEvent(editingEventId, updates, token);
      
      // Update local state
      setCalendarEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...updates } : e));
      setEditingEventId(null);
    } catch (e) {
      console.error(e);
      await showAlert("Erro ao atualizar consulta.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter state for the synchronized calendar
  const [selectedFilterDate, setSelectedFilterDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [filterMode, setFilterMode] = useState<"today" | "custom_date" | "selected">("today");

  // Helper to format YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  // Helper to extract date part (YYYY-MM-DD) from event start
  const getEventLocalDateStr = (event: any) => {
    if (event.start?.dateTime) {
      const d = new Date(event.start.dateTime);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
    return event.start?.date || "";
  };

  // Helper to get today's local date (YYYY-MM-DD)
  const getTodayLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Auto-switch filterMode to "selected" when schedDate changes
  useEffect(() => {
    if (schedDate) {
      setFilterMode("selected");
    }
  }, [schedDate]);

  // Filter and sort events based on the filterMode
  const filteredEvents = calendarEvents.filter(event => {
    const eventDate = getEventLocalDateStr(event);
    if (!eventDate) return false;

    if (filterMode === "today") {
      return eventDate === getTodayLocalDateStr();
    } else if (filterMode === "custom_date") {
      return eventDate === selectedFilterDate;
    } else if (filterMode === "selected") {
      return eventDate === schedDate;
    }
    return false;
  }).sort((a, b) => {
    const aTime = a.start?.dateTime || a.start?.date || "";
    const bTime = b.start?.dateTime || b.start?.date || "";
    return aTime.localeCompare(bTime);
  });

  const totalUpcomingCount = calendarEvents.filter(event => {
    const start = new Date(event.start?.dateTime || event.start?.date);
    return start >= new Date(new Date().setHours(0, 0, 0, 0));
  }).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-emerald-950">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-4" />
        <p className="font-sans font-medium text-lg">Sincronizando com o Google Agenda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in px-4 md:px-0">
      
      {/* Left side: Book appointments */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
          <h3 className="text-xl font-serif italic text-emerald-950 flex items-center space-x-2">
            <Calendar className="text-emerald-700" />
            <span>Agendar Consulta</span>
          </h3>

          <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-emerald-900 block">Paciente *</label>
              <select
                required
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full text-xs p-3 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
              >
                <option value="">Selecione o paciente...</option>
                {patients.filter(p => p.situacao === "Ativo").map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome_preferencial} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-emerald-900 block">Data *</label>
                <input
                  type="date"
                  required
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="w-full p-2.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-emerald-900 block">Horário *</label>
                <input
                  type="time"
                  required
                  value={schedTime}
                  onChange={e => setSchedTime(e.target.value)}
                  className="w-full p-2.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-emerald-900 block">Modalidade</label>
              <select
                value={schedModalidade}
                onChange={e => setSchedModalidade(e.target.value as any)}
                className="w-full p-2.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
              >
                <option value="Online">On-line (Com Google Meet automático)</option>
                <option value="Presencial">Presencial (Físico no consultório)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-emerald-900 block">Marcador de Cor (Google Agenda)</label>
              <div className="relative">
                <select
                  value={schedColorId}
                  onChange={e => setSchedColorId(e.target.value)}
                  className="w-full p-2.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950 pr-10"
                >
                  {GOOGLE_CALENDAR_COLORS.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
                  <div 
                    className="w-4.5 h-4.5 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: GOOGLE_CALENDAR_COLORS.find(c => c.id === schedColorId)?.hex || primaryCalendarColor }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-emerald-600/70 italic mt-0.5 leading-tight">
                {GOOGLE_CALENDAR_COLORS.find(c => c.id === schedColorId)?.desc}
              </p>
            </div>

            {/* Schedule Conflict Alert */}
            {hasConflict && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl text-amber-900 text-[11px] leading-relaxed flex items-start space-x-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Conflito de Horário Detectado!</strong>
                  <p className="mt-0.5">Dra. Virgínia, já existe uma consulta agendada nesta mesma faixa de horário no seu Google Agenda.</p>
                </div>
              </div>
            )}

            {/* Recorrência check */}
            <div className="border-t border-emerald-50 pt-3 space-y-2">
              <label className="flex items-center space-x-2 font-bold text-emerald-900 block cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 border-emerald-300 accent-emerald-700 cursor-pointer"
                />
                <span>Criar agendamento recorrente?</span>
              </label>

              {isRecurring && (
                <div className="bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-100/50 space-y-1.5 animate-fade-in">
                  <span className="font-semibold text-emerald-800">Recorrência Semanal:</span>
                  <select
                    value={recorrenciaSemanas}
                    onChange={e => setRecorrenciaSemanas(Number(e.target.value))}
                    className="w-full p-2 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                  >
                    <option value={2}>Repetir semanalmente por 2 semanas</option>
                    <option value={4}>Repetir semanalmente por 4 semanas (1 mês)</option>
                    <option value={8}>Repetir semanalmente por 8 semanas (2 meses)</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isScheduling}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold shadow transition disabled:opacity-50 text-xs cursor-pointer"
              id="confirm-schedule-btn"
            >
              {isScheduling ? "Agendando..." : "Confirmar e Sincronizar"}
            </button>
          </form>
        </div>
      </div>

      {/* Right side (Col span 2): List of synched Calendar events */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-serif italic text-emerald-950 flex items-center space-x-2">
                <CalendarDays size={18} className="text-emerald-700" />
                <span>Compromissos Sincronizados</span>
              </h3>
              <p className="text-xs text-emerald-600/70">Consultas ativas integradas diretamente com o seu Google Calendar.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={loadAgendaData}
                disabled={loading}
                className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100/85 active:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                title="Sincronizar agenda manualmente"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span>Sincronizar</span>
              </button>
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full">
                {filteredEvents.length} {filterMode === "today" ? "HOJE" : filterMode === "custom_date" ? "NO DIA" : "SELECIONADO"}
              </span>
            </div>
          </div>

          {/* Filter Tabs/Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-emerald-50">
            {/* 1. Hoje Button */}
            <button
              type="button"
              onClick={() => setFilterMode("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                filterMode === "today"
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "bg-emerald-50/50 text-emerald-850 hover:bg-emerald-100/60"
              }`}
            >
              <span>Hoje</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filterMode === "today" ? "bg-white/20 text-white" : "bg-emerald-900/10 text-emerald-800"
              }`}>
                {calendarEvents.filter(e => getEventLocalDateStr(e) === getTodayLocalDateStr()).length}
              </span>
            </button>

            {/* 2. Custom Date Picker Tab */}
            <div
              className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-semibold transition border ${
                filterMode === "custom_date"
                  ? "bg-emerald-800 text-white border-emerald-800 shadow-sm"
                  : "bg-emerald-50/50 text-emerald-850 border-transparent hover:bg-emerald-100/60"
              }`}
            >
              <span className="cursor-pointer select-none" onClick={() => setFilterMode("custom_date")}>
                Outra data:
              </span>
              <input
                type="date"
                value={selectedFilterDate}
                onChange={(e) => {
                  setSelectedFilterDate(e.target.value);
                  setFilterMode("custom_date");
                }}
                onClick={() => setFilterMode("custom_date")}
                className={`bg-transparent border-none outline-none focus:ring-0 p-0 text-xs font-semibold cursor-pointer max-w-[110px] ${
                  filterMode === "custom_date"
                    ? "text-white [color-scheme:dark]"
                    : "text-emerald-950"
                }`}
              />
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filterMode === "custom_date" ? "bg-white/20 text-white" : "bg-emerald-900/10 text-emerald-800"
              }`}>
                {calendarEvents.filter(e => getEventLocalDateStr(e) === selectedFilterDate).length}
              </span>
            </div>

            {/* 3. SchedDate Tab */}
            {schedDate && schedDate !== getTodayLocalDateStr() && schedDate !== selectedFilterDate && (
              <button
                type="button"
                onClick={() => setFilterMode("selected")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  filterMode === "selected"
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "bg-emerald-50/50 text-emerald-850 hover:bg-emerald-100/60"
                }`}
              >
                <span>Selecionada p/ Agendar ({formatDateBR(schedDate)})</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filterMode === "selected" ? "bg-white/20 text-white" : "bg-emerald-900/10 text-emerald-850"
                }`}>
                  {calendarEvents.filter(e => getEventLocalDateStr(e) === schedDate).length}
                </span>
              </button>
            )}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-emerald-50 rounded-2xl animate-fade-in">
              <Calendar size={40} className="mx-auto text-emerald-100 mb-2" />
              <p className="text-sm text-emerald-800 font-semibold">
                {filterMode === "today"
                  ? "Nenhum compromisso agendado para hoje!"
                  : filterMode === "custom_date"
                  ? `Nenhum compromisso agendado para o dia ${formatDateBR(selectedFilterDate)}!`
                  : filterMode === "selected"
                  ? `Nenhum compromisso agendado para o dia ${formatDateBR(schedDate)}!`
                  : "Tudo livre na agenda do Google!"}
              </p>
              <p className="text-xs text-emerald-600/50 mt-1">
                {filterMode === "custom_date" || filterMode === "selected"
                  ? "Este dia está totalmente livre para agendamentos."
                  : "Sessões agendadas por aqui aparecerão nesta central sincronizada."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2">
              {filteredEvents.map((event) => {
                const date = new Date(event.start.dateTime || event.start.date);
                const isToday = date.toDateString() === new Date().toDateString();
                const meetLink = event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri;

                const isEditing = editingEventId === event.id;
                const colors = getEventColorClasses(event.colorId, isToday, primaryCalendarColor);

                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-4 p-4 rounded-xl border transition shadow-sm duration-200"
                    style={colors.cardStyle}
                  >
                    {isEditing ? (
                      <div className="space-y-3 w-full">
                        <input
                          type="text"
                          value={editSummary}
                          onChange={e => setEditSummary(e.target.value)}
                          className="w-full p-2 border border-emerald-100 rounded-lg text-sm font-semibold text-emerald-950 focus:outline-none focus:border-emerald-500"
                          placeholder="Título do Evento"
                        />
                        <div className="flex space-x-2">
                          <input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            className="flex-1 p-2 border border-emerald-100 rounded-lg text-xs"
                          />
                          <input
                            type="time"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            className="flex-1 p-2 border border-emerald-100 rounded-lg text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block text-[10px]">Marcador de Cor (Google Agenda)</label>
                          <div className="relative">
                            <select
                              value={editColorId}
                              onChange={e => setEditColorId(e.target.value)}
                              className="w-full p-2 border border-emerald-100 rounded-lg text-xs bg-white text-emerald-950 pr-10"
                            >
                              {GOOGLE_CALENDAR_COLORS.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                              <div 
                                className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: GOOGLE_CALENDAR_COLORS.find(c => c.id === editColorId)?.hex || primaryCalendarColor }}
                              />
                            </div>
                          </div>
                        </div>

                        <textarea
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          className="w-full p-2 border border-emerald-100 rounded-lg text-xs min-h-[60px] focus:outline-none focus:border-emerald-500"
                          placeholder="Descrição (opcional)"
                        />
                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            onClick={() => setEditingEventId(null)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent transition"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={handleUpdateEvent}
                            disabled={isUpdating}
                            className="p-2 text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition disabled:opacity-50 flex items-center justify-center"
                            title="Salvar"
                          >
                            <Save size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between w-full gap-4 min-w-0">
                        <div className="flex items-start space-x-4 min-w-0 flex-1">
                          <div 
                            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                            style={colors.dateBgStyle}
                          >
                            <span className="uppercase text-[9px] font-semibold leading-none opacity-90">{date.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
                            <span className="text-base font-bold leading-none mt-1">{date.getDate()}</span>
                          </div>
                          
                          <div className="space-y-1 min-w-0 flex-1">
                            <h4 className="font-bold text-sm font-sans flex flex-wrap items-center gap-1.5 min-w-0" style={colors.textStyle}>
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-sm"
                                style={{ backgroundColor: GOOGLE_CALENDAR_COLORS.find(c => c.id === event.colorId)?.hex || primaryCalendarColor }}
                                title={GOOGLE_CALENDAR_COLORS.find(c => c.id === event.colorId)?.name || "Cor padrão"}
                              />
                              <span className="break-words min-w-0" style={{ wordBreak: "break-word" }}>{event.summary || "Consulta Clínica"}</span>
                              {isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0" style={colors.badgeStyle}>Hoje</span>}
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-3 text-[11px]" style={colors.secondaryTextStyle}>
                              <span className="flex items-center space-x-0.5 shrink-0">
                                <Clock size={12} style={colors.iconStyle} />
                                <span>{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </span>
                              
                              {meetLink && (
                                <span className="flex items-center space-x-0.5 shrink-0 font-medium">
                                  <Video size={12} style={colors.iconStyle} />
                                  <span>On-line</span>
                                </span>
                              )}

                              {event.colorId && (
                                <span className="text-[10px] font-medium opacity-75">
                                  • {GOOGLE_CALENDAR_COLORS.find(c => c.id === event.colorId)?.name.split(" / ")[0]}
                                </span>
                              )}
                            </div>
                            
                            {event.description && (
                              <p className="text-[11px] mt-1 line-clamp-3" style={colors.secondaryTextStyle}>
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-start shrink-0">
                          {meetLink && (
                            <a
                              href={meetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg text-xs font-bold transition flex items-center space-x-1 border shadow-sm cursor-pointer"
                              style={colors.buttonStyle}
                            >
                              <Link size={12} />
                              <span className="hidden sm:inline">Meet</span>
                            </a>
                          )}
                          
                          <button
                            onClick={() => startEditing(event)}
                            className="p-2 rounded-lg border border-transparent transition cursor-pointer"
                            style={{ color: colors.hex }}
                            title="Editar consulta"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteEvent(event.id, event.summary)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition"
                            title="Desmarcar consulta"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Custom Dialog */}
      {dialogState?.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {dialogState.isAlert ? "Aviso" : "Confirmação"}
            </h3>
            <p className="text-slate-600 mb-6">{dialogState.message}</p>
            <div className="flex justify-end gap-3">
              {!dialogState.isAlert && (
                <button
                  onClick={() => {
                    dialogState.resolve?.(false);
                    setDialogState(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  dialogState.resolve?.(true);
                  setDialogState(null);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
