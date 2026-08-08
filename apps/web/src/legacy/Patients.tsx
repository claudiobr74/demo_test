import React, { useState, useEffect } from "react";
import { generateUUID } from "../lib/uuid";
import { apiFetch } from "../lib/api";
import {
  Users,
  Search,
  Plus,
  UserPlus,
  Phone,
  Mail,
  UserCheck,
  Video,
  FileText,
  DollarSign,
  History,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Lock,
  CalendarDays,
  Edit,
  Camera,
  Upload,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  FileSignature
} from "lucide-react";
import {
  Patient,
  PatientConsent,
  ConsentType,
  Session,
  FinancialRecord,
  DocRecord,
  getPatients,
  getSessions,
  getAdministrativePatients,
  getAdministrativeAppointments,
  getFinancials,
  getDocs,
  addPatient,
  updatePatient,
  createFolder,
  addFinancial
} from "../lib/workspace";
import { getPatientPackages, setupPatientPackage, PatientPackage } from "../lib/packages";

const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Save as image/jpeg with 0.7 compression to keep file size well under Google Sheets limits (50k characters per cell)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem para redimensionamento."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
};

interface PatientsProps {
  token: string;
  spreadsheetId: string;
  patientsFolderId: string; // the Drive folder ID for "Pacientes"
  onStartSession: (patientId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  userPermissions?: any;
  role?: string;
}

export default function Patients({
  role,
  token,
  spreadsheetId,
  patientsFolderId,
  onStartSession,
  onNavigateToTab,
  userPermissions
}: PatientsProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and view selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration Form State
  const [nomePreferencial, setNomePreferencial] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [responsaveis, setResponsaveis] = useState("");
  const [valorPadrao, setValorPadrao] = useState<number | "">(150);
  const [modalidade, setModalidade] = useState<"Online" | "Presencial" | "Mista">("Online");
  const [consentimentos, setConsentimentos] = useState("Sim");
  const [situacao, setSituacao] = useState<"Ativo" | "Inativo" | "Concluído">("Ativo");
  const [fotoUrl, setFotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initial Financial Setup State
  const [billingModel, setBillingModel] = useState<"consulta" | "pacote">("consulta");
  
  // Single Appointment Setup (Consulta Avulsa)
  const [createInitialCharge, setCreateInitialCharge] = useState(true);
  const [initialChargeStatus, setInitialChargeStatus] = useState<"Pago" | "Pendente">("Pago");
  const [initialChargePaymentMethod, setInitialChargePaymentMethod] = useState<"Pix" | "Cartão" | "Dinheiro" | "Transferência" | "Cortesia">("Pix");
  const [initialChargeDueDate, setInitialChargeDueDate] = useState(new Date().toISOString().split("T")[0]);

  // Package Setup (Pacote)
  const [packageSessions, setPackageSessions] = useState(4);
  const [packageTotalValue, setPackageTotalValue] = useState(600);
  const [packageIsRecurring, setPackageIsRecurring] = useState(true);
  const [packagePaymentMethod, setPackagePaymentMethod] = useState<"Pix" | "Cartão" | "Dinheiro" | "Transferência" | "Pacote">("Pix");
  const [packagePaymentStatus, setPackagePaymentStatus] = useState<"Pago" | "Pendente">("Pago");
  const [packageVencimentoDia, setPackageVencimentoDia] = useState(10);

  // Auto-calculate package value when valorPadrao or packageSessions changes
  useEffect(() => {
    setPackageTotalValue(Number(valorPadrao) * Number(packageSessions));
  }, [valorPadrao, packageSessions]);

  // Editing Patient Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editNomePreferencial, setEditNomePreferencial] = useState("");
  const [editNomeCompleto, setEditNomeCompleto] = useState("");
  const [editContatoTelefone, setEditContatoTelefone] = useState("");
  const [editContatoEmail, setEditContatoEmail] = useState("");
  const [editResponsaveis, setEditResponsaveis] = useState("");
  const [editValorPadrao, setEditValorPadrao] = useState<number | "">(150);
  const [editModalidade, setEditModalidade] = useState<"Online" | "Presencial" | "Mista">("Online");
  const [editConsentimentos, setEditConsentimentos] = useState("Sim");
  const [editSituacao, setEditSituacao] = useState<"Ativo" | "Inativo" | "Concluído">("Ativo");
  const [editFotoUrl, setEditFotoUrl] = useState("");
  const [updating, setUpdating] = useState(false);

  // LGPD Patient Deletion State
  const [lgpdModalOpen, setLgpdModalOpen] = useState(false);
  const [targetDeletePatient, setTargetDeletePatient] = useState<Patient | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [deletionReport, setDeletionReport] = useState<any>(null);

  // Consent Management State (P0.10)
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentPatient, setConsentPatient] = useState<Patient | null>(null);
  const [patientConsents, setPatientConsents] = useState<PatientConsent[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);

  // Consent form state
  const [regConsentType, setRegConsentType] = useState<ConsentType>("prontuario_digital");
  const [regConsentVersion, setRegConsentVersion] = useState("1.0");
  const [regConsentStatus, setRegConsentStatus] = useState<"ativo" | "revogado" | "recusado">("ativo");
  const [regConsentMethod, setRegConsentMethod] = useState<"aceite_digital" | "assinatura_fisica" | "registro_manual_secretaria" | "termo_impresso">("aceite_digital");

  const CONSENT_TYPES_MAP: { [key in ConsentType]: { label: string; desc: string; icon: string } } = {
    prontuario_digital: {
      label: "Prontuário Digital & Registros Clínicos",
      desc: "Armazenamento do prontuário em meio digital com criptografia e controle de acesso.",
      icon: "📋"
    },
    gravacao_audio: {
      label: "Gravação de Áudio das Sessões",
      desc: "Captação de voz e gravações das sessões para auxílio no registro do prontuário.",
      icon: "🎙️"
    },
    transcricao_ia: {
      label: "Transcrição Automática por IA",
      desc: "Conversão automatizada de áudio em texto para rascunho de evolução clínica.",
      icon: "📝"
    },
    processamento_ia: {
      label: "Processamento por IA / Evolução Assistida",
      desc: "Análise descritiva da sessão e supervisão clínica assistida por inteligência artificial.",
      icon: "🧠"
    },
    notebooklm: {
      label: "Conhecimento & NotebookLM",
      desc: "Exportação de síntese anonimizada do caso para apoio no Google NotebookLM.",
      icon: "📘"
    },
    comunicacao_digital: {
      label: "Comunicação Digital e Lembretes",
      desc: "Envio de lembretes e confirmações de consulta via WhatsApp/E-mail.",
      icon: "💬"
    }
  };

  const handleOpenConsentModal = async (p: Patient) => {
    setConsentPatient(p);
    setConsentModalOpen(true);
    setLoadingConsents(true);
    try {
      const res = await apiFetch(`/api/patient/${p.id}/consents`);
      if (res.ok) {
        const data = await res.json();
        setPatientConsents(data.consents || []);
      }
    } catch (err) {
      console.error("Erro ao carregar consentimentos:", err);
    } finally {
      setLoadingConsents(false);
    }
  };

  const handleRegisterConsent = async (typeToRegister?: ConsentType, statusToRegister?: "ativo" | "revogado" | "recusado") => {
    if (!consentPatient) return;
    setSubmittingConsent(true);

    const targetType = typeToRegister || regConsentType;
    const targetStatus = statusToRegister || regConsentStatus;

    try {
      const res = await apiFetch(`/api/patient/${consentPatient.id}/consents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: targetType,
          version: regConsentVersion || "1.0",
          status: targetStatus,
          method: regConsentMethod
        })
      });

      if (res.ok) {
        const cRes = await apiFetch(`/api/patient/${consentPatient.id}/consents`);
        if (cRes.ok) {
          const cData = await cRes.json();
          setPatientConsents(cData.consents || []);
        }
        loadData();
      } else {
        const errData = await res.json();
        alert(`Erro ao registrar consentimento: ${errData.error || "Tente novamente."}`);
      }
    } catch (err: any) {
      console.error("Erro ao registrar consentimento:", err);
      alert("Erro de conexão ao registrar consentimento.");
    } finally {
      setSubmittingConsent(false);
    }
  };

  const handleRevokeConsent = async (consentType: ConsentType) => {
    if (!consentPatient) return;
    if (!confirm(`Deseja revogar o consentimento para '${CONSENT_TYPES_MAP[consentType]?.label || consentType}'? Esta ação bloqueará imediatamente as funcionalidades que dependem deste consentimento.`)) return;

    setSubmittingConsent(true);
    try {
      const res = await apiFetch(`/api/patient/${consentPatient.id}/consents/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentType })
      });

      if (res.ok) {
        const cRes = await apiFetch(`/api/patient/${consentPatient.id}/consents`);
        if (cRes.ok) {
          const cData = await cRes.json();
          setPatientConsents(cData.consents || []);
        }
        loadData();
      } else {
        const errData = await res.json();
        alert(`Erro ao revogar consentimento: ${errData.error || "Tente novamente."}`);
      }
    } catch (err: any) {
      console.error("Erro ao revogar consentimento:", err);
      alert("Erro de conexão ao revogar consentimento.");
    } finally {
      setSubmittingConsent(false);
    }
  };

  const handleOpenLgpdModal = async (p: Patient) => {
    if (role !== "psychologist_admin" && userPermissions?.isSecretary) {
      alert("Apenas a Administradora (Psicóloga responsável) tem permissão para realizar a exclusão definitiva de pacientes.");
      return;
    }
    setTargetDeletePatient(p);
    setLgpdModalOpen(true);
    setInventoryLoading(true);
    setInventoryData(null);
    setDeleteConfirmationInput("");
    setDeletionReport(null);

    try {
      const res = await apiFetch(`/api/patient/${p.id}/inventory`);
      if (res.ok) {
        const data = await res.json();
        setInventoryData(data);
      } else {
        const errData = await res.json();
        alert(`Erro ao gerar inventário do paciente: ${errData.error || "Tente novamente."}`);
      }
    } catch (err: any) {
      console.error("Erro ao obter inventário LGPD:", err);
      alert("Erro de conexão ao gerar inventário do paciente.");
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleExecutePatientDeletion = async () => {
    if (!targetDeletePatient) return;
    if (deleteConfirmationInput !== "EXCLUIR PACIENTE") {
      alert("Por favor, digite 'EXCLUIR PACIENTE' exatamente como exigido.");
      return;
    }

    setDeletingPatient(true);
    try {
      const res = await apiFetch(`/api/patient/${targetDeletePatient.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationText: deleteConfirmationInput,
          spreadsheetId,
          googleAccessToken: token
        })
      });

      const data = await res.json();
      setDeletionReport(data.report || {});
    } catch (err: any) {
      console.error("Erro ao excluir paciente LGPD:", err);
      setDeletionReport({
        removido: [],
        naoEncontrado: [],
        mantido: [],
        erros: [`Erro no servidor: ${err.message || err}`]
      });
    } finally {
      setDeletingPatient(false);
    }
  };

  const handleCloseLgpdModal = () => {
    if (deletionReport) {
      loadData();
      setSelectedPatient(null);
    }
    setLgpdModalOpen(false);
    setTargetDeletePatient(null);
    setInventoryData(null);
    setDeletionReport(null);
  };

  // Load patients and dependencies
  const loadData = async () => {
    setLoading(true);
    try {
      let pData: any[], sData: any[], fData: any[], dData: any[];
      if (role === "secretary") {
        const [adminPatients, adminAppointments, finData] = await Promise.all([
          getAdministrativePatients(),
          getAdministrativeAppointments(),
          getFinancials(spreadsheetId, token)
        ]);
        pData = adminPatients;
        sData = adminAppointments;
        fData = finData;
        dData = [];
      } else {
        [pData, sData, fData, dData] = await Promise.all([
          getPatients(spreadsheetId, token),
          getSessions(spreadsheetId, token),
          getFinancials(spreadsheetId, token),
          getDocs(spreadsheetId, token)
        ]);
      }
      setPatients(pData);
      setSessions(sData);
      setFinancials(fData);
      setDocs(dData);
    } catch (e) {
      console.error("Error loading patients view data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (spreadsheetId && token) {
      loadData();
    }
  }, [spreadsheetId, token]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredPatients = patients.filter(
    p =>
      p.nome_preferencial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add Patient Action
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomePreferencial.trim() || !nomeCompleto.trim()) {
      alert("Por favor, preencha os campos de nome.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Generate secure UUID for patient primary key
      const pId = generateUUID();

      // 2. Create pseudonimized folder in Drive named strictly after pId (PAC-XXX or UUID)
      // This is secure and LGPD compliant (no full names on Google Drive folder paths)
      let driveFolderId = "";
      if (patientsFolderId) {
        try {
          driveFolderId = await createFolder(pId, patientsFolderId, token);
        } catch (err) {
          console.error("Failed to create Google Drive folder for patient, continuing...", err);
        }
      }

      // 3. Prepare Patient Object
      const newPatient: Patient = {
        id: pId,
        nome_preferencial: nomePreferencial.trim(),
        nome_completo: nomeCompleto.trim(),
        contato_telefone: contatoTelefone.trim(),
        contato_email: contatoEmail.trim(),
        responsaveis: responsaveis.trim(),
        valor_padrao: Number(valorPadrao),
        modalidade,
        consentimentos,
        situacao,
        data_cadastro: new Date().toISOString().split("T")[0],
        foto_url: fotoUrl.trim()
      };

      await addPatient(spreadsheetId, newPatient, token);
      
      // 4. Interlink with Financials & Packages
      try {
        if (billingModel === "consulta") {
          if (createInitialCharge) {
            const fId = generateUUID();
            const initialRecord: FinancialRecord = {
              id: fId,
              paciente_id: pId,
              tipo: "Receita",
              valor: Number(valorPadrao),
              status: initialChargeStatus,
              forma_pagamento: initialChargePaymentMethod,
              data_vencimento: initialChargeDueDate,
              data_pagamento: initialChargeStatus === "Pago" ? new Date().toISOString().split("T")[0] : undefined,
              desconto: 0,
              observacoes: "Consulta Avulsa Inicial",
            };
            await addFinancial(spreadsheetId, initialRecord, token);
            
            // Update local financials list
            setFinancials(prev => [initialRecord, ...prev]);
          }
        } else if (billingModel === "pacote") {
          // A. Setup local PatientPackage
          const planName = packageIsRecurring 
            ? `Mensalidade Recorrente (${packageSessions} sessões)` 
            : `Pacote Fechado de ${packageSessions} Sessões`;

          const newPkg: PatientPackage = {
            patientId: pId,
            patientName: nomePreferencial.trim(),
            hasActivePlan: true,
            planName: planName,
            totalSessions: Number(packageSessions),
            remainingSessions: Number(packageSessions),
            isRecurring: packageIsRecurring,
            monthlyValue: Number(packageTotalValue),
            vencimentoDia: Number(packageVencimentoDia),
            status: "Ativo"
          };
          
          await setupPatientPackage(newPkg);

          // B. Generate financial record for the package
          const fId = generateUUID();
          const packageRecord: FinancialRecord = {
            id: fId,
            paciente_id: pId,
            tipo: "Receita",
            valor: Number(packageTotalValue),
            status: packagePaymentStatus,
            forma_pagamento: packagePaymentMethod,
            data_vencimento: packageIsRecurring 
              ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(packageVencimentoDia).padStart(2, "0")}`
              : new Date().toISOString().split("T")[0],
            data_pagamento: packagePaymentStatus === "Pago" ? new Date().toISOString().split("T")[0] : undefined,
            desconto: 0,
            observacoes: `Adesão: ${planName}`,
          };
          await addFinancial(spreadsheetId, packageRecord, token);
          
          // Update local financials list
          setFinancials(prev => [packageRecord, ...prev]);
        }
      } catch (finErr) {
        console.error("Failed to automatically launch financial registration:", finErr);
      }

      // Update local state
      setPatients(prev => [...prev, newPatient]);
      alert(`Paciente ${nomePreferencial} cadastrado com sucesso com o código ${pId}!`);
      
      // Reset form
      setNomePreferencial("");
      setNomeCompleto("");
      setContatoTelefone("");
      setContatoEmail("");
      setResponsaveis("");
      setValorPadrao(150);
      setModalidade("Online");
      setConsentimentos("Sim");
      setSituacao("Ativo");
      setFotoUrl("");

      setBillingModel("consulta");
      setCreateInitialCharge(true);
      setInitialChargeStatus("Pago");
      setInitialChargePaymentMethod("Pix");
      setInitialChargeDueDate(new Date().toISOString().split("T")[0]);
      setPackageSessions(4);
      setPackageTotalValue(600);
      setPackageIsRecurring(true);
      setPackagePaymentMethod("Pix");
      setPackagePaymentStatus("Pago");
      setPackageVencimentoDia(10);
      
      setIsRegistering(false);
      setSelectedPatient(newPatient); // navigate directly to detail
    } catch (err: any) {
      console.error(err);
      alert("Erro ao cadastrar paciente. Detalhe: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Update existing Patient
  const handleUpdatePatientData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!editNomePreferencial.trim() || !editNomeCompleto.trim()) {
      alert("Por favor, preencha os campos de nome.");
      return;
    }

    setUpdating(true);
    try {
      const updatedPatient: Patient = {
        ...selectedPatient,
        nome_preferencial: editNomePreferencial.trim(),
        nome_completo: editNomeCompleto.trim(),
        contato_telefone: editContatoTelefone.trim(),
        contato_email: editContatoEmail.trim(),
        responsaveis: editResponsaveis.trim(),
        valor_padrao: Number(editValorPadrao),
        modalidade: editModalidade,
        consentimentos: editConsentimentos,
        situacao: editSituacao,
        foto_url: editFotoUrl.trim()
      };

      await updatePatient(spreadsheetId, updatedPatient, token);

      // Update local states
      setPatients(prev => prev.map(p => p.id === selectedPatient.id ? updatedPatient : p));
      setSelectedPatient(updatedPatient);
      setIsEditing(false);
      alert("Cadastro do paciente atualizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao atualizar cadastro. Detalhe: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Toggle patient situation
  const handleChangeSituation = async (patient: Patient, newSit: typeof situacao) => {
    const updated = { ...patient, situacao: newSit };
    const confirmed = window.confirm(`Deseja alterar a situação de ${patient.nome_preferencial} para '${newSit}'?`);
    if (!confirmed) return;

    try {
      await updatePatient(spreadsheetId, updated, token);
      setPatients(prev => prev.map(p => p.id === patient.id ? updated : p));
      setSelectedPatient(updated);
      alert("Situação atualizada!");
    } catch (e) {
      alert("Erro ao atualizar situação.");
    }
  };

  // Filter dependent entries for selected patient
  const getPatientSessions = (pId: string) => {
    return sessions.filter(s => s.paciente_id === pId).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
  };

  const getPatientFinancials = (pId: string) => {
    return financials.filter(f => f.paciente_id === pId).sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
  };

  const getPatientDocs = (pId: string) => {
    return docs.filter(d => d.paciente_id === pId).sort((a, b) => b.data_criacao.localeCompare(a.data_criacao));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-emerald-950">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-4" />
        <p className="font-sans font-medium text-lg">Carregando lista de pacientes...</p>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  if (selectedPatient) {
    const pSessions = getPatientSessions(selectedPatient.id);
    const pFinancials = getPatientFinancials(selectedPatient.id);
    const pDocs = getPatientDocs(selectedPatient.id);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 md:px-0">
        {/* Navigation back and header action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={() => {
              setSelectedPatient(null);
              setIsEditing(false);
            }}
            className="inline-flex items-center space-x-2 text-emerald-800 hover:text-emerald-950 font-semibold cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Voltar para Lista de Pacientes</span>
          </button>
          
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                onClick={() => {
                  setEditNomePreferencial(selectedPatient.nome_preferencial);
                  setEditNomeCompleto(selectedPatient.nome_completo);
                  setEditContatoTelefone(selectedPatient.contato_telefone || "");
                  setEditContatoEmail(selectedPatient.contato_email || "");
                  setEditResponsaveis(selectedPatient.responsaveis || "");
                  setEditValorPadrao(selectedPatient.valor_padrao);
                  setEditModalidade(selectedPatient.modalidade);
                  setEditConsentimentos(selectedPatient.consentimentos || "Sim");
                  setEditSituacao(selectedPatient.situacao || "Ativo");
                  setEditFotoUrl(selectedPatient.foto_url || "");
                  setIsEditing(true);
                }}
                className="px-4 py-2.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl font-bold flex items-center justify-center space-x-2 border border-emerald-100 shadow-sm cursor-pointer text-sm font-sans"
              >
                <Edit size={14} className="text-emerald-700" />
                <span>Editar Cadastro</span>
              </button>
            )}

            {!isEditing && (
              <button
                onClick={() => handleOpenConsentModal(selectedPatient)}
                className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 rounded-xl font-bold flex items-center justify-center space-x-1.5 border border-blue-100 dark:border-blue-900/40 cursor-pointer text-xs font-sans transition shadow-sm"
                title="Gerenciar Termos de Consentimento LGPD Versionados"
              >
                <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Termos & Consentimentos LGPD</span>
              </button>
            )}

            {!isEditing && (role === "psychologist_admin" || !userPermissions?.isSecretary) && (
              <button
                onClick={() => handleOpenLgpdModal(selectedPatient)}
                className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 rounded-xl font-bold flex items-center justify-center space-x-1.5 border border-red-100 dark:border-red-900/40 cursor-pointer text-xs font-sans transition shadow-sm"
                title="Exclusão de Paciente sem Falsas Promessas (LGPD)"
              >
                <Trash2 size={14} />
                <span>Excluir (LGPD)</span>
              </button>
            )}

            <button
              onClick={() => onStartSession(selectedPatient.id)}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow cursor-pointer text-sm"
            >
              <Plus size={16} />
              <span>Iniciar Nova Sessão</span>
            </button>
          </div>
        </div>

        {/* Patient Profile Sheet */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Column 1: Info and actions (with edit mode support) */}
          <div className="md:col-span-1 space-y-6 border-b md:border-b-0 md:border-r border-emerald-100/60 pb-6 md:pb-0 md:pr-6">
            {isEditing ? (
              <form onSubmit={handleUpdatePatientData} className="space-y-4">
                <h3 className="text-lg font-serif italic text-emerald-950 flex items-center space-x-2">
                  <Edit className="text-emerald-700" size={18} />
                  <span>Editar Cadastro</span>
                </h3>

                {/* Foto Section */}
                <div className="space-y-2 bg-emerald-50/20 p-3.5 rounded-xl border border-emerald-100/30">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block flex items-center space-x-1">
                    <Camera size={12} className="text-emerald-700" />
                    <span>Foto de Perfil</span>
                  </label>
                  
                  <div className="flex items-center space-x-3">
                    {editFotoUrl ? (
                      <img
                        src={editFotoUrl}
                        alt="Prévia"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 object-cover rounded-xl border border-emerald-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-800 font-bold text-lg rounded-xl flex items-center justify-center border border-emerald-200">
                        {editNomePreferencial ? editNomePreferencial.substring(0, 2).toUpperCase() : "PA"}
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-white border border-emerald-200 rounded-lg text-[9px] text-emerald-850 hover:bg-emerald-50 cursor-pointer font-bold transition">
                        <Upload size={10} className="text-emerald-700" />
                        <span>Procurar arquivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const optimizedDataUrl = await resizeAndCompressImage(file);
                                setEditFotoUrl(optimizedDataUrl);
                              } catch (err: any) {
                                alert("Erro ao carregar e otimizar imagem: " + err.message);
                              }
                            }
                          }}
                        />
                      </label>
                      <label className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-white border border-emerald-200 rounded-lg text-[9px] text-emerald-850 hover:bg-emerald-50 cursor-pointer font-bold transition">
                        <Camera size={10} className="text-emerald-700" />
                        <span>Capturar imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const optimizedDataUrl = await resizeAndCompressImage(file);
                                setEditFotoUrl(optimizedDataUrl);
                              } catch (err: any) {
                                alert("Erro ao carregar e otimizar imagem: " + err.message);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Names */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase block">Nome Preferencial *</label>
                  <input
                    type="text"
                    required
                    value={editNomePreferencial}
                    onChange={e => setEditNomePreferencial(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase block">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={editNomeCompleto}
                    onChange={e => setEditNomeCompleto(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                  />
                </div>

                {/* Email & Phone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase block">E-mail</label>
                  <input
                    type="email"
                    value={editContatoEmail}
                    onChange={e => setEditContatoEmail(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase block">Telefone</label>
                  <input
                    type="text"
                    value={editContatoTelefone}
                    onChange={e => setEditContatoTelefone(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                  />
                </div>

                {/* Responsáveis */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-900 uppercase block">Responsáveis</label>
                  <input
                    type="text"
                    value={editResponsaveis}
                    onChange={e => setEditResponsaveis(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                  />
                </div>

                {/* Valor & Modalidade */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-900 uppercase block">Valor Sessão *</label>
                    <input
                      type="number"
                      required
                      value={editValorPadrao}
                  onChange={e => setEditValorPadrao(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-900 uppercase block">Modalidade</label>
                    <select
                      value={editModalidade}
                      onChange={e => setEditModalidade(e.target.value as any)}
                      className="w-full text-xs px-2 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans cursor-pointer"
                    >
                      <option value="Online">Online</option>
                      <option value="Presencial">Presencial</option>
                      <option value="Mista">Mista</option>
                    </select>
                  </div>
                </div>

                {/* Situation & Consentimento */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-900 uppercase block">Situação</label>
                    <select
                      value={editSituacao}
                      onChange={e => setEditSituacao(e.target.value as any)}
                      className="w-full text-xs px-2 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans cursor-pointer"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-900 uppercase block">Termos</label>
                    <select
                      value={editConsentimentos}
                      onChange={e => setEditConsentimentos(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-emerald-100 rounded-lg bg-white text-emerald-950 font-sans cursor-pointer"
                    >
                      <option value="Sim">Ok</option>
                      <option value="Não">Pendente</option>
                    </select>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-3 flex gap-2 border-t border-emerald-50">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 text-[11px] font-semibold border border-emerald-100 text-emerald-800 py-2 rounded-xl hover:bg-emerald-50 font-sans cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl shadow disabled:opacity-50 font-sans cursor-pointer"
                  >
                    {updating ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-col items-center text-center space-y-2">
                  {selectedPatient.foto_url ? (
                    <img
                      src={selectedPatient.foto_url}
                      alt={selectedPatient.nome_preferencial}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-cover rounded-2xl border border-emerald-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-800 text-3xl font-bold font-sans">
                      {selectedPatient.nome_preferencial.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-serif italic text-emerald-950">{selectedPatient.nome_preferencial}</h3>
                    <span className="text-[11px] font-mono bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                      {selectedPatient.id}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2 text-sm">
                  <div className="flex items-center space-x-2 text-emerald-900">
                    <Lock size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-500 font-sans">LGPD PSEUDONIMIZADO</span>
                  </div>
                  
                  <div className="p-3 bg-emerald-50/20 rounded-xl space-y-2 text-xs">
                    <p className="font-semibold text-emerald-800 font-sans">NOME COMPLETO (RESTRITO):</p>
                    <p className="text-emerald-950 font-sans">{selectedPatient.nome_completo}</p>
                  </div>

                  {selectedPatient.contato_telefone && (
                    <div className="flex items-center space-x-2.5 text-emerald-950 text-xs font-sans">
                      <Phone size={14} className="text-emerald-700" />
                      <span>{selectedPatient.contato_telefone}</span>
                    </div>
                  )}
                  {selectedPatient.contato_email && (
                    <div className="flex items-center space-x-2.5 text-emerald-950 text-xs font-sans">
                      <Mail size={14} className="text-emerald-700" />
                      <span className="truncate">{selectedPatient.contato_email}</span>
                    </div>
                  )}
                  {selectedPatient.responsaveis && (
                    <div className="flex flex-col space-y-0.5 text-xs font-sans">
                      <span className="text-[10px] text-emerald-600 font-semibold">RESPONSÁVEIS:</span>
                      <span className="text-emerald-950">{selectedPatient.responsaveis}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-emerald-100/60 pt-4 space-y-2">
                  <label className="text-[10px] text-emerald-600 font-bold uppercase block font-sans">Situação do Acompanhamento</label>
                  <div className="flex gap-1.5">
                    {(["Ativo", "Inativo", "Concluído"] as const).map(sit => (
                      <button
                        key={sit}
                        onClick={() => handleChangeSituation(selectedPatient, sit)}
                        className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition border cursor-pointer font-sans ${
                          selectedPatient.situacao === sit
                            ? "bg-emerald-800 text-white border-emerald-800"
                            : "bg-white text-emerald-800 border-emerald-100 hover:bg-emerald-50"
                        }`}
                      >
                        {sit}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>


          {/* Column 2 & 3: Tabs and detailed logs */}
          <div className="md:col-span-2 space-y-6">
            {/* Treatment Settings Card */}
            <div className="bg-emerald-50/20 border border-emerald-100/40 p-4 rounded-2xl grid grid-cols-3 gap-4 text-center">
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-600 font-semibold">VALOR SESSÃO</span>
                <p className="text-lg font-bold text-emerald-950">R$ {selectedPatient.valor_padrao}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-600 font-semibold">MODALIDADE</span>
                <p className="text-sm font-bold text-emerald-950 flex items-center justify-center space-x-1 mt-0.5">
                  <Video size={12} className="text-emerald-600" />
                  <span>{selectedPatient.modalidade}</span>
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-600 font-semibold">CONSENTIMENTOS</span>
                <p className="text-sm font-bold text-emerald-950 flex items-center justify-center space-x-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${selectedPatient.consentimentos === "Sim" ? "bg-emerald-600" : "bg-red-500"}`} />
                  <span>{selectedPatient.consentimentos === "Sim" ? "Assinado" : "Pendente"}</span>
                </p>
              </div>
            </div>

            {/* Modelo de Cobrança / Pacote Ativo Card */}
            {(() => {
              const patientPackages = getPatientPackages();
              const activePkg = patientPackages.find(p => p.patientId === selectedPatient.id);
              
              return (
                <div className="bg-white p-5 rounded-2xl border border-emerald-100/60 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5 font-sans uppercase tracking-wider">
                      <DollarSign size={14} className="text-emerald-700" />
                      <span>Modelo de Cobrança & Pacote Ativo</span>
                    </h5>
                    <button
                      onClick={() => onNavigateToTab("finance")}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-950 hover:underline flex items-center space-x-0.5 transition cursor-pointer font-sans"
                    >
                      <span>Gerenciar no Financeiro</span>
                      <ArrowUpRight size={10} />
                    </button>
                  </div>

                  {activePkg && activePkg.hasActivePlan ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/20 p-4 rounded-xl border border-emerald-100/20 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase font-bold text-emerald-600/80 font-sans">Plano/Pacote</span>
                        <p className="text-sm font-bold text-emerald-950">{activePkg.planName}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase font-bold text-emerald-600/80 font-sans">Saldo do Pacote</span>
                        <p className="text-sm font-bold text-emerald-950 flex items-center space-x-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            activePkg.remainingSessions > 1 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {activePkg.remainingSessions} / {activePkg.totalSessions} sessões
                          </span>
                          <span className="text-[10px] text-emerald-600 font-medium">restantes</span>
                        </p>
                      </div>
                      {activePkg.isRecurring && (
                        <div className="sm:col-span-2 pt-2.5 border-t border-emerald-100/30 flex justify-between text-[10px] text-emerald-800/80 font-medium font-sans">
                          <span>Faturamento Mensal: R$ {activePkg.monthlyValue.toFixed(2)}/mês</span>
                          <span>Vencimento: todo dia {activePkg.vencimentoDia}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#FDFBF7] p-3.5 rounded-xl border border-amber-100/40 text-left sm:flex sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs text-emerald-950 font-bold font-sans">Atendimento Avulso (Sem Pacote)</p>
                        <p className="text-[10px] text-emerald-600/70 font-sans">Sessões cobradas individualmente no valor de R$ {selectedPatient.valor_padrao.toFixed(2)}.</p>
                      </div>
                      <button
                        onClick={() => onNavigateToTab("finance")}
                        className="mt-2 sm:mt-0 text-[10px] font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg transition font-sans cursor-pointer"
                      >
                        Ativar Pacote
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Historic tabs (Clinical record) */}
            <div className="space-y-6">
              
              {/* HISTÓRICO DE SESSÕES */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-900 font-sans flex items-center space-x-2">
                  <History size={16} />
                  <span>Histórico Clínico e Evoluções</span>
                </h4>

                {role === "secretary" ? (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-6 text-center shadow-sm">
                    <span className="text-2xl block mb-2">🔒</span>
                    <p className="text-xs font-bold text-emerald-950">Acesso Restrito ao Histórico Clínico</p>
                    <p className="text-[10px] text-emerald-700/85 mt-1 leading-relaxed">Sua conta de acesso personalizado não possui autorização para visualizar evoluções ou notas de prontuário.</p>
                  </div>
                ) : pSessions.length === 0 ? (
                  <p className="text-xs text-emerald-600/60 py-4 italic border-b border-emerald-50">Nenhuma sessão registrada ainda.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {pSessions.map(session => (
                      <div key={session.id} className="bg-white p-4 rounded-xl border border-emerald-100/60 space-y-2">
                        <div className="flex items-center justify-between border-b border-emerald-50 pb-1.5">
                          <span className="text-xs font-semibold text-emerald-950">
                            Sessão em {new Date(session.data_hora).toLocaleDateString("pt-BR")} às {new Date(session.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            session.status === "Finalizada" ? "bg-emerald-800 text-white" : "bg-amber-100 text-amber-800"
                          }`}>
                            {session.status}
                          </span>
                        </div>
                        {session.foco && (
                          <p className="text-xs font-semibold text-emerald-900">
                            Foco: <span className="font-normal text-emerald-950">{session.foco}</span>
                          </p>
                        )}
                        <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                          {session.resumo || "Sem anotações gravadas nesta sessão."}
                        </p>
                        {session.combinados_atual && (
                          <p className="text-[11px] font-semibold text-emerald-800 mt-2 bg-emerald-50/50 p-2 rounded-lg">
                            Combinado para a próxima: <span className="font-normal text-emerald-950">{session.combinados_atual}</span>
                          </p>
                        )}
                        {session.alteracao_log && (
                          <div className="text-[9px] text-emerald-600/60 font-mono mt-1 border-t border-emerald-50/30 pt-1 flex items-center space-x-1">
                            <span>Auditoria: {session.alteracao_log}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DOCUMENTOS DO PACIENTE */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-900 font-sans flex items-center space-x-2">
                  <FolderOpen size={16} />
                  <span>Documentos e Contratos</span>
                </h4>

                {pDocs.length === 0 ? (
                  <p className="text-xs text-emerald-600/60 py-2 italic">Nenhum documento gerado para este paciente.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pDocs.map(doc => (
                      <a
                        key={doc.id}
                        href={doc.google_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-white hover:bg-emerald-50 rounded-xl border border-emerald-100/60 transition flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-emerald-950 truncate">{doc.titulo}</p>
                          <span className="text-[10px] text-emerald-600/70 block mt-0.5 uppercase">{doc.tipo}</span>
                        </div>
                        <FileText size={16} className="text-emerald-500 group-hover:text-emerald-700" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* FINANCEIRO DO PACIENTE */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-900 font-sans flex items-center space-x-2">
                  <DollarSign size={16} />
                  <span>Histórico de Pagamentos</span>
                </h4>

                {pFinancials.length === 0 ? (
                  <p className="text-xs text-emerald-600/60 py-2 italic">Nenhum registro de pagamento.</p>
                ) : (
                  <div className="space-y-2">
                    {pFinancials.map(rec => (
                      <div key={rec.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100/60 text-xs">
                        <div>
                          <p className="font-semibold text-emerald-950">Ref: {rec.observacoes || "Sessão clínica"}</p>
                          <span className="text-[10px] text-emerald-600/70">{new Date(rec.data_vencimento).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-emerald-950">R$ {rec.valor.toFixed(2)}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.status === "Pago" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- REGISTRATION VIEW ---
  if (isRegistering) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in px-4 md:px-0">
        <button
          onClick={() => setIsRegistering(false)}
          className="inline-flex items-center space-x-2 text-emerald-800 hover:text-emerald-950 font-semibold cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Voltar para Lista</span>
        </button>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100/40">
          <h3 className="text-2xl font-serif italic text-emerald-950 flex items-center space-x-2 mb-6">
            <UserPlus className="text-emerald-700" />
            <span>Cadastrar Novo Paciente</span>
          </h3>

          <form onSubmit={handleRegisterPatient} className="space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">Nome Preferencial / Apelido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João"
                  value={nomePreferencial}
                  onChange={e => setNomePreferencial(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950"
                />
                <span className="text-[10px] text-emerald-600/70 block">Usado nas exibições comuns e agenda.</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">Nome Completo (Sigiloso) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva Santos"
                  value={nomeCompleto}
                  onChange={e => setNomeCompleto(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">E-mail de Contato</label>
                <input
                  type="email"
                  placeholder="Ex: joao@gmail.com"
                  value={contatoEmail}
                  onChange={e => setContatoEmail(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={contatoTelefone}
                  onChange={e => setContatoTelefone(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 block">Responsáveis (Se menor de idade ou dependente)</label>
              <input
                type="text"
                placeholder="Ex: Maria da Silva (Mãe)"
                value={responsaveis}
                onChange={e => setResponsaveis(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950"
              />
            </div>

            <div className="space-y-3 bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/30">
              <label className="text-xs font-bold text-emerald-900 block flex items-center space-x-1.5">
                <Camera size={14} className="text-emerald-700" />
                <span>Foto de Perfil do Paciente</span>
              </label>
              
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0 flex flex-col items-center bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/30 min-w-[100px]">
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt="Prévia"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-cover rounded-2xl border border-emerald-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-800 font-bold text-xl rounded-2xl flex items-center justify-center border border-emerald-200 shadow-sm">
                      {nomePreferencial ? nomePreferencial.substring(0, 2).toUpperCase() : "PA"}
                    </div>
                  )}
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFotoUrl("")}
                      className="text-[10px] text-red-650 hover:underline font-bold mt-2 cursor-pointer active:scale-95 duration-150"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="flex-grow space-y-3.5 w-full">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="flex-1 flex items-center justify-center space-x-1.5 px-4 h-10 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs hover:bg-emerald-100 cursor-pointer font-bold transition active:scale-[0.97] active:opacity-90 duration-150">
                      <Upload size={14} className="text-emerald-700" />
                      <span>Procurar arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const optimizedDataUrl = await resizeAndCompressImage(file);
                              setFotoUrl(optimizedDataUrl);
                            } catch (err: any) {
                              alert("Erro ao carregar e otimizar imagem: " + err.message);
                            }
                          }
                        }}
                      />
                    </label>
                    <label className="flex-1 flex items-center justify-center space-x-1.5 px-4 h-10 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs hover:bg-emerald-100 cursor-pointer font-bold transition active:scale-[0.97] active:opacity-90 duration-150">
                      <Camera size={14} className="text-emerald-700" />
                      <span>Capturar imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const optimizedDataUrl = await resizeAndCompressImage(file);
                              setFotoUrl(optimizedDataUrl);
                            } catch (err: any) {
                              alert("Erro ao carregar e otimizar imagem: " + err.message);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">Valor Padrão Sessão *</label>
                <input
                  type="number"
                  required
                  value={valorPadrao}
                  onChange={e => setValorPadrao(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 block">Modalidade Atendimento</label>
                <select
                  value={modalidade}
                  onChange={e => setModalidade(e.target.value as any)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 h-11 cursor-pointer"
                >
                  <option value="Online">Online</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Mista">Mista</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-emerald-900 block">Termos e Consentimentos</label>
                <select
                  value={consentimentos}
                  onChange={e => setConsentimentos(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-emerald-100 rounded-xl focus:ring-1 focus:ring-emerald-700 bg-emerald-50/10 text-emerald-950 h-11 cursor-pointer"
                >
                  <option value="Sim">Assinado / Ok</option>
                  <option value="Não">Pendente</option>
                </select>
              </div>
            </div>

            {/* --- INTEGRATED BILLING MODEL & FINANCIAL SETUP --- */}
            <div className="bg-emerald-50/20 border border-emerald-100/40 p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 font-sans flex items-center space-x-1.5">
                  <DollarSign size={14} className="text-emerald-700" />
                  <span>Configuração Financeira & Cobrança Inicial</span>
                </h4>
                <p className="text-[10px] text-emerald-600/70 block mt-0.5 font-sans">
                  Escolha o modelo de atendimento e interligue a cobrança ao módulo Financeiro automaticamente.
                </p>
              </div>

              {/* Billing Model Selector Tabbed Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBillingModel("consulta")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    billingModel === "consulta"
                      ? "bg-emerald-800 text-white border-emerald-800 shadow"
                      : "bg-white text-emerald-800 border-emerald-100 hover:bg-emerald-50"
                  }`}
                >
                  Consulta Avulsa
                </button>
                <button
                  type="button"
                  onClick={() => setBillingModel("pacote")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    billingModel === "pacote"
                      ? "bg-emerald-800 text-white border-emerald-800 shadow"
                      : "bg-white text-emerald-800 border-emerald-100 hover:bg-emerald-50"
                  }`}
                >
                  Pacote de Sessões / Plano
                </button>
              </div>

              {/* Consulta Avulsa Settings */}
              {billingModel === "consulta" && (
                <div className="space-y-3.5 p-3.5 bg-white rounded-xl border border-emerald-100/40 animate-fade-in text-xs font-sans">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="createInitialCharge"
                      checked={createInitialCharge}
                      onChange={e => setCreateInitialCharge(e.target.checked)}
                      className="rounded border-emerald-300 text-emerald-800 focus:ring-emerald-400 cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="createInitialCharge" className="text-xs text-emerald-900 font-semibold cursor-pointer">
                      Lançar primeira cobrança de consulta no financeiro
                    </label>
                  </div>

                  {createInitialCharge && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-700 uppercase">Forma Pagamento</label>
                        <select
                          value={initialChargePaymentMethod}
                          onChange={e => setInitialChargePaymentMethod(e.target.value as any)}
                          className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none cursor-pointer"
                        >
                          <option value="Pix">Pix</option>
                          <option value="Cartão">Cartão</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Transferência">Transferência</option>
                          <option value="Cortesia">Cortesia</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-700 uppercase">Status do Pagamento</label>
                        <select
                          value={initialChargeStatus}
                          onChange={e => setInitialChargeStatus(e.target.value as any)}
                          className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none cursor-pointer"
                        >
                          <option value="Pago">Pago</option>
                          <option value="Pendente">Pendente</option>
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-bold text-emerald-700 uppercase">Vencimento</label>
                        <input
                          type="date"
                          value={initialChargeDueDate}
                          onChange={e => setInitialChargeDueDate(e.target.value)}
                          className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pacote Settings */}
              {billingModel === "pacote" && (
                <div className="space-y-3.5 p-3.5 bg-white rounded-xl border border-emerald-100/40 animate-fade-in text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">Nº de Sessões do Pacote</label>
                      <input
                        type="number"
                        min={1}
                        value={packageSessions}
                        onChange={e => setPackageSessions(Number(e.target.value))}
                        className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">Valor Total do Pacote (R$)</label>
                      <input
                        type="number"
                        min={0}
                        value={packageTotalValue}
                        onChange={e => setPackageTotalValue(Number(e.target.value))}
                        className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                      />
                      <span className="text-[9px] text-emerald-600/70 block mt-0.5">Calculado como Valor Sessão × Nº Sessões</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-emerald-50">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="packageIsRecurring"
                        checked={packageIsRecurring}
                        onChange={e => setPackageIsRecurring(e.target.checked)}
                        className="rounded border-emerald-300 text-emerald-800 focus:ring-emerald-400 cursor-pointer h-4 w-4"
                      />
                      <label htmlFor="packageIsRecurring" className="text-xs text-emerald-900 font-semibold cursor-pointer">
                        Faturamento Recorrente (Mensalidade)
                      </label>
                    </div>

                    {packageIsRecurring && (
                      <div className="flex items-center space-x-2">
                        <label className="text-[10px] font-bold text-emerald-700 uppercase">Vencimento:</label>
                        <select
                          value={packageVencimentoDia}
                          onChange={e => setPackageVencimentoDia(Number(e.target.value))}
                          className="border border-emerald-100 rounded-xl h-10 px-3 text-xs bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none cursor-pointer min-w-[70px]"
                        >
                          {[1, 5, 10, 15, 20, 25, 28].map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-emerald-50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">Forma Pagamento Adesão</label>
                      <select
                        value={packagePaymentMethod}
                        onChange={e => setPackagePaymentMethod(e.target.value as any)}
                        className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none cursor-pointer"
                      >
                        <option value="Pix">Pix</option>
                        <option value="Cartão">Cartão</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Transferência">Transferência</option>
                        <option value="Pacote">Pacote / Faturado</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">Status do Pagamento Adesão</label>
                      <select
                        value={packagePaymentStatus}
                        onChange={e => setPackagePaymentStatus(e.target.value as any)}
                        className="w-full text-xs border border-emerald-100 rounded-xl h-10 px-3 bg-[#FDFBF7] text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none cursor-pointer"
                      >
                        <option value="Pago">Pago</option>
                        <option value="Pendente">Pendente</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className="flex-1 text-sm font-semibold border border-emerald-100 text-emerald-800 py-3 rounded-xl hover:bg-emerald-50 active:scale-[0.97] transition duration-150 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl shadow transition duration-150 disabled:opacity-50 cursor-pointer active:scale-[0.97]"
              >
                {submitting ? "Cadastrando..." : "Confirmar Cadastro"}
              </button>
            </div>

          </form>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-4 md:px-0">
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-emerald-950 flex items-center space-x-2">
            <Users size={22} className="text-emerald-700" />
            <span>Gestão de Pacientes</span>
          </h2>
          <p className="text-xs text-emerald-600/70">Acesso rápido aos prontuários e histórico de sessões.</p>
        </div>
        
        <button
          onClick={() => setIsRegistering(true)}
          className="flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold shadow transition duration-150 cursor-pointer text-sm active:scale-[0.97] active:opacity-90"
          id="register-patient-trigger-btn"
        >
          <UserPlus size={16} />
          <span>Cadastrar Paciente</span>
        </button>
      </div>

      {/* Search Input Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/30 flex items-center space-x-3">
        <Search size={18} className="text-emerald-400" />
        <input
          type="text"
          placeholder="Pesquisar por nome preferencial, completo ou código..."
          value={searchTerm}
          onChange={handleSearch}
          className="flex-1 text-sm bg-transparent focus:outline-none text-emerald-950 placeholder-emerald-600/40"
          id="patient-search-input"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-xs text-emerald-400 hover:text-emerald-800 font-bold">
            Limpar
          </button>
        )}
      </div>

      {/* Patient Listing Grid */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-emerald-100/40">
          <Users size={36} className="mx-auto text-emerald-200 mb-2 animate-pulse" />
          <p className="text-sm text-emerald-800 font-medium">Nenhum paciente localizado.</p>
          <p className="text-xs text-emerald-600/50 mt-1">Refine a busca ou cadastre um novo paciente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredPatients.map(patient => {
            const sessionsCount = getPatientSessions(patient.id).length;
            const docList = getPatientDocs(patient.id);

            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="bg-white p-5 rounded-2xl border border-emerald-100 hover:border-emerald-300 shadow-sm hover:shadow transition-all duration-150 cursor-pointer flex justify-between items-center group"
                id={`patient-card-${patient.id}`}
              >
                <div className="min-w-0 pr-3 space-y-2.5">
                  <div className="flex items-center space-x-2">
                    {patient.foto_url ? (
                      <img
                        src={patient.foto_url}
                        alt={patient.nome_preferencial}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 object-cover rounded-lg border border-emerald-150/50 shadow-sm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center font-bold text-emerald-800 text-sm">
                        {patient.nome_preferencial.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-emerald-950 font-sans truncate group-hover:text-emerald-700 transition text-base">
                        {patient.nome_preferencial}
                      </h4>
                      <p className="text-[10px] text-emerald-600/70 font-mono tracking-wider">{patient.id} • {patient.situacao}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-emerald-900">
                    <span className="flex items-center space-x-1 font-sans">
                      <CalendarDays size={13} className="text-emerald-500" />
                      <span>{sessionsCount} sessões</span>
                    </span>
                    <span className="flex items-center space-x-1 font-sans">
                      <Video size={13} className="text-emerald-500" />
                      <span>{patient.modalidade}</span>
                    </span>
                  </div>
                </div>

                <ChevronRight size={18} className="text-emerald-300 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition" />
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL LGPD EXCLUSÃO DE PACIENTE */}
      {lgpdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-red-100 dark:border-red-900/40 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-red-50 dark:bg-red-950/40 px-6 py-5 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-700 dark:text-red-300">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-red-950 dark:text-red-100 text-base font-sans">
                    Exclusão Definitiva de Paciente (LGPD)
                  </h3>
                  <p className="text-xs text-red-700/80 dark:text-red-300/80 font-mono">
                    {targetDeletePatient?.nome_completo || targetDeletePatient?.nome_preferencial} • ID: {targetDeletePatient?.id}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseLgpdModal}
                disabled={deletingPatient}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {inventoryLoading ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Gerando inventário técnico de dados do paciente nas coleções do sistema...
                  </p>
                </div>
              ) : deletionReport ? (
                /* Report Screen */
                <div className="space-y-5">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-start space-x-3">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950 dark:text-emerald-100 text-sm">
                        Relatório Técnico do Processo de Exclusão
                      </h4>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                        Abaixo está o balanço transparente das entidades processadas para este paciente.
                      </p>
                    </div>
                  </div>

                  {/* Removidos */}
                  {deletionReport.removido?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                        Entidades Excluídas com Sucesso:
                      </span>
                      <ul className="space-y-1.5 pl-2 text-xs text-slate-700 dark:text-slate-300">
                        {deletionReport.removido.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Não Encontrados */}
                  {deletionReport.naoEncontrado?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                        Registros Não Localizados / Vazios:
                      </span>
                      <ul className="space-y-1.5 pl-2 text-xs text-slate-600 dark:text-slate-400">
                        {deletionReport.naoEncontrado.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-amber-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mantidos por Regra Técnica */}
                  {deletionReport.mantido?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400">
                        Registros Mantidos / Pseudonimizados (Por Exigência Técnica / Segurança):
                      </span>
                      <ul className="space-y-1.5 pl-2 text-xs text-slate-700 dark:text-slate-300">
                        {deletionReport.mantido.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Erros */}
                  {deletionReport.erros?.length > 0 && (
                    <div className="p-3 bg-red-100/50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-2xl space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                        Alertas / Erros Durante a Execução:
                      </span>
                      <ul className="space-y-1 pl-2 text-xs text-red-900 dark:text-red-200">
                        {deletionReport.erros.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-red-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : inventoryData ? (
                /* Inventory & Confirmation Screen */
                <div className="space-y-5">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950 dark:text-amber-100">
                        Relatório Transparente de Inventário (Sem Falsas Promessas)
                      </p>
                      <p className="mt-1 leading-relaxed">
                        Abaixo listamos com precisão quais entidades associadas a este paciente serão excluídas de forma irrecuperável e quais registros serão preservados por motivo de segurança técnica.
                      </p>
                    </div>
                  </div>

                  {/* Entidades a serem Excluídas */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-400 flex items-center space-x-1.5">
                      <Trash2 size={14} />
                      <span>O que será excluído definitivamente:</span>
                    </h4>
                    <div className="bg-red-50/50 dark:bg-red-950/20 p-3.5 rounded-2xl border border-red-100 dark:border-red-900/30">
                      <ul className="space-y-1.5 text-xs text-red-950 dark:text-red-200 font-medium">
                        {inventoryData.toDelete?.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-red-600 font-bold">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Entidades Mantidas */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400 flex items-center space-x-1.5">
                      <Info size={14} />
                      <span>O que será mantido e por quê:</span>
                    </h4>
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                      <ul className="space-y-1.5 text-xs text-blue-950 dark:text-blue-200 font-medium">
                        {inventoryData.toRetain?.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Input de Confirmação */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-bold text-red-900 dark:text-red-300 block uppercase">
                      Para confirmar a exclusão, digite "EXCLUIR PACIENTE" abaixo:
                    </label>
                    <input
                      type="text"
                      placeholder="EXCLUIR PACIENTE"
                      value={deleteConfirmationInput}
                      onChange={e => setDeleteConfirmationInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-red-200 dark:border-red-900/50 rounded-xl bg-white dark:bg-slate-950 text-red-950 dark:text-red-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Nenhum dado de inventário disponível.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-3">
              {deletionReport ? (
                <button
                  onClick={handleCloseLgpdModal}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow transition"
                >
                  Concluir e Fechar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCloseLgpdModal}
                    disabled={deletingPatient}
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold text-xs cursor-pointer transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePatientDeletion}
                    disabled={deleteConfirmationInput !== "EXCLUIR PACIENTE" || deletingPatient || inventoryLoading}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center space-x-2 transition shadow-sm"
                  >
                    <Trash2 size={14} className={deletingPatient ? "animate-spin" : ""} />
                    <span>{deletingPatient ? "Excluindo Entidades..." : "Confirmar Exclusão Definitiva"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONSENTIMENTOS VERSIONADOS (P0.10) */}
      {consentModalOpen && consentPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                  <ShieldCheck size={24} className="text-emerald-200" />
                </div>
                <div>
                  <h2 className="text-xl font-serif italic font-bold">Termos de Consentimento & Autorizações LGPD</h2>
                  <p className="text-xs text-emerald-100/80 mt-1 font-sans">
                    Paciente: <strong className="text-white">{consentPatient.nome_completo || consentPatient.nome_preferencial}</strong> • Código: {consentPatient.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConsentModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition text-emerald-100 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Notice */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl flex items-start space-x-3 text-xs text-emerald-900 dark:text-emerald-200">
                <Info size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Validação e Bloqueio em Tempo Real</p>
                  <p className="leading-relaxed">
                    A ausência ou revogação de qualquer um dos termos abaixo bloqueia automaticamente o recurso correspondente no backend (gravação de áudio, transcrição, supervisão clínica por IA e integração com o NotebookLM).
                  </p>
                </div>
              </div>

              {loadingConsents ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500 font-bold">Consultando banco de consentimentos...</p>
                </div>
              ) : (
                <>
                  {/* Grid of 6 Consent Types */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.keys(CONSENT_TYPES_MAP) as ConsentType[]).map((typeKey) => {
                      const typeInfo = CONSENT_TYPES_MAP[typeKey];
                      const activeItem = patientConsents.find(c => c.consentType === typeKey && c.status === "ativo");
                      const latestItem = patientConsents.find(c => c.consentType === typeKey);

                      return (
                        <div
                          key={typeKey}
                          className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                            activeItem
                              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                              : latestItem?.status === "revogado"
                              ? "bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-800/40"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{typeInfo.icon}</span>
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{typeInfo.label}</span>
                              </div>
                              {activeItem ? (
                                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-full font-bold text-[10px] flex items-center space-x-1 border border-emerald-200 dark:border-emerald-800">
                                  <Check size={10} />
                                  <span>ATIVO (v{activeItem.version})</span>
                                </span>
                              ) : latestItem?.status === "revogado" ? (
                                <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded-full font-bold text-[10px] flex items-center space-x-1 border border-red-200 dark:border-red-800">
                                  <X size={10} />
                                  <span>REVOGADO</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-full font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                                  SEM ACEITE
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal mb-3">
                              {typeInfo.desc}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <div>
                              {activeItem ? (
                                <span>Aceito em {new Date(activeItem.acceptedAt || activeItem.createdAt).toLocaleDateString("pt-BR")} via {activeItem.method?.replace(/_/g, " ")}</span>
                              ) : latestItem?.revokedAt ? (
                                <span>Revogado em {new Date(latestItem.revokedAt).toLocaleDateString("pt-BR")}</span>
                              ) : (
                                <span>Pendente de autorização</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {activeItem ? (
                                <button
                                  onClick={() => handleRevokeConsent(typeKey)}
                                  disabled={submittingConsent}
                                  className="px-2.5 py-1 bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-700 dark:text-red-300 rounded-lg font-bold border border-red-200 dark:border-red-800 cursor-pointer transition"
                                >
                                  Revogar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRegisterConsent(typeKey, "ativo")}
                                  disabled={submittingConsent}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold cursor-pointer transition shadow-sm"
                                >
                                  Conceder Aceite
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual / Customized Registration Form */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                      <FileSignature size={14} className="text-emerald-600" />
                      <span>Registrar Novo Termo / Atualizar Versão</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Tipo de Consentimento</label>
                        <select
                          value={regConsentType}
                          onChange={(e) => setRegConsentType(e.target.value as ConsentType)}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100"
                        >
                          {(Object.keys(CONSENT_TYPES_MAP) as ConsentType[]).map((k) => (
                            <option key={k} value={k}>{CONSENT_TYPES_MAP[k].label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Versão do Termo</label>
                        <input
                          type="text"
                          value={regConsentVersion}
                          onChange={(e) => setRegConsentVersion(e.target.value)}
                          placeholder="Ex: 1.0, 2.1"
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Status</label>
                        <select
                          value={regConsentStatus}
                          onChange={(e) => setRegConsentStatus(e.target.value as any)}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100"
                        >
                          <option value="ativo">Ativo (Concedido)</option>
                          <option value="recusado">Recusado pelo Paciente</option>
                          <option value="revogado">Revogado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Método de Coleta</label>
                        <select
                          value={regConsentMethod}
                          onChange={(e) => setRegConsentMethod(e.target.value as any)}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100"
                        >
                          <option value="aceite_digital">Aceite Digital no Sistema</option>
                          <option value="assinatura_fisica">Assinatura Física Digitalizada</option>
                          <option value="registro_manual_secretaria">Registro Manual pela Secretária</option>
                          <option value="termo_impresso">Termo Impresso Assinado</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => handleRegisterConsent()}
                        disabled={submittingConsent}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs cursor-pointer transition shadow-sm flex items-center space-x-2"
                      >
                        <Check size={14} />
                        <span>{submittingConsent ? "Salvando Registro..." : "Salvar Consentimento Versionado"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Audit Trail Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                      <History size={14} className="text-slate-500" />
                      <span>Histórico Auditável de Consentimentos ({patientConsents.length})</span>
                    </h3>

                    {patientConsents.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100">
                        Nenhum registro prévio de consentimento encruzilhado no histórico.
                      </p>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                              <th className="p-3">Tipo</th>
                              <th className="p-3">Versão</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Método</th>
                              <th className="p-3">Data/Hora</th>
                              <th className="p-3">Registrado Por</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                            {patientConsents.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-3 font-semibold">
                                  {CONSENT_TYPES_MAP[c.consentType]?.label || c.consentType}
                                </td>
                                <td className="p-3 font-mono text-[11px]">v{c.version}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    c.status === "ativo"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : c.status === "revogado"
                                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                      : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                                  }`}>
                                    {c.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-3 text-[11px] text-slate-500">
                                  {c.method?.replace(/_/g, " ")}
                                </td>
                                <td className="p-3 text-[11px]">
                                  {new Date(c.createdAt).toLocaleString("pt-BR")}
                                </td>
                                <td className="p-3 text-[11px]">
                                  {c.registeredBy || c.acceptedBy || "Sistema"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-1.5">
                <Lock size={12} className="text-emerald-600" />
                <span>Registros imutáveis protegidos pela LGPD & Conselho Federal de Psicologia.</span>
              </div>
              <button
                onClick={() => setConsentModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer transition shadow-sm"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
