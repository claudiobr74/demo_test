import React, { useState, useEffect } from "react";
import { generateUUID } from "../lib/uuid";
import {
  FileText,
  PlusCircle,
  FolderOpen,
  Printer,
  Sparkles,
  User,
  ArrowRight,
  Download,
  Calendar,
  Layers,
  ChevronRight,
  Check,
  Clipboard,
  X,
  ArrowLeft,
  Settings,
  Eye,
  FileCheck,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit,
  AlertTriangle
} from "lucide-react";
import {
  DocRecord,
  Patient,
  getDocs,
  getPatients,
  generateDocumentFromTemplate,
  addDocRecord,
  deleteDocRecord,
  updateDocRecord,
  getDriveFiles,
  deleteDriveFile,
  uploadAndConvertFileToGoogleDoc,
  createBlankGoogleDocTemplate
} from "../lib/workspace";

interface LocalDocContent {
  id: string;
  paciente_id: string;
  tipo: string;
  titulo: string;
  bodyText: string;
  professionalName: string;
  professionalReg: string;
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  layoutDesign: "classic" | "elegant" | "boho";
  showLogo: boolean;
  data_criacao: string;
  patientName: string;
  customLogo?: string | null;
}

const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
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
          const dataUrl = canvas.toDataURL("image/png");
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

interface DocumentsProps {
  token: string;
  spreadsheetId: string;
  modelsFolderId: string;
  docsFolderId: string;
  profileName?: string;
  profileCrp?: string;
  profileClinicName?: string;
  profileCompanyName?: string;
  profileCnpj?: string;
  onProfileUpdate?: (
    name: string,
    crp: string,
    subtitle: string,
    quote: string,
    duration: number,
    greetingPrefix: string,
    clinicName: string,
    companyName: string,
    cnpj: string,
    cpf: string,
    pix: string
  ) => void;
}

export default function Documents({
  token,
  spreadsheetId,
  modelsFolderId,
  docsFolderId,
  profileName,
  profileCrp,
  profileClinicName,
  profileCompanyName,
  profileCnpj,
  onProfileUpdate
}: DocumentsProps) {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [modelsList, setModelsList] = useState<{ id: string; name: string; webViewLink: string; createdTime: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Document Generator form state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<"local" | "gdocs">("local");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [docType, setDocType] = useState<"Contrato" | "Consentimento" | "Declaração" | "Recibo" | "Laudo">("Laudo");
  
  // Local Timbrado Document state variables
  const [localDocId, setLocalDocId] = useState<string | null>(null);
  const [localDocTitle, setLocalDocTitle] = useState("");
  const [localDocType, setLocalDocType] = useState<"Laudo" | "Relatório" | "Atestado" | "Declaração" | "Prescrição" | "Recibo" | "Encaminhamento">("Laudo");
  const [localBodyText, setLocalBodyText] = useState("");
  const [localProfessionalName, setLocalProfessionalName] = useState(() => profileName || localStorage.getItem("serenapsi_profile_name") || "Dra. Virgínia Macedo");
  const [localProfessionalReg, setLocalProfessionalReg] = useState(() => profileCrp || localStorage.getItem("serenapsi_profile_crp") || "CRP 11/04580");
  const [localClinicName, setLocalClinicName] = useState(() => profileClinicName || localStorage.getItem("serenapsi_profile_clinic_name") || "Clínica de Psicologia Virgínia Macedo");
  const [localContactEmail, setLocalContactEmail] = useState(() => localStorage.getItem("serena_prof_email") || "psivirginiamacedo@clinicavirginiamacedo.com");
  const [localContactPhone, setLocalContactPhone] = useState(() => localStorage.getItem("serena_prof_phone") || "(11) 98765-4321");
  const [localAddress, setLocalAddress] = useState(() => localStorage.getItem("serena_prof_addr") || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP");
  const [localCompanyName, setLocalCompanyName] = useState(() => profileCompanyName || localStorage.getItem("serenapsi_profile_company_name") || "Virgínia Macedo Psicologia Clínica LTDA");
  const [localCnpj, setLocalCnpj] = useState(() => profileCnpj || localStorage.getItem("serenapsi_profile_cnpj") || "00.000.000/0001-00");
  const [localLayoutDesign, setLocalLayoutDesign] = useState<"classic" | "elegant" | "boho">("classic");
  const [localShowLogo, setLocalShowLogo] = useState(true);
  const [localCustomLogo, setLocalCustomLogo] = useState<string | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [isViewingLocalDoc, setIsViewingLocalDoc] = useState(false);

  // Create New Model state variables
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [modelCreationMode, setModelCreationMode] = useState<"upload" | "blank">("upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [modelProgressMessage, setModelProgressMessage] = useState("");
  const [isModelSubmitting, setIsModelSubmitting] = useState(false);

  // Custom dialog and Toast notification state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onConfirmText?: string;
    variant?: "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const alert = (message: string) => {
    const msgLower = message.toLowerCase();
    const isError = msgLower.includes("erro") || msgLower.includes("falhou") || msgLower.includes("failed") || msgLower.includes("inválido");
    showToast(message, isError ? "error" : "success");
  };

  // Load default professional credentials from localStorage on mount and sync with props
  useEffect(() => {
    const savedName = profileName || localStorage.getItem("serenapsi_profile_name") || localStorage.getItem("serena_prof_name");
    const savedReg = profileCrp || localStorage.getItem("serenapsi_profile_crp") || localStorage.getItem("serena_prof_reg");
    const savedClinic = profileClinicName || localStorage.getItem("serenapsi_profile_clinic_name") || localStorage.getItem("serena_prof_clinic");
    const savedEmail = localStorage.getItem("serena_prof_email");
    const savedPhone = localStorage.getItem("serena_prof_phone");
    const savedAddr = localStorage.getItem("serena_prof_addr");
    const savedLogo = localStorage.getItem("serena_prof_logo");
    const savedCompany = profileCompanyName || localStorage.getItem("serenapsi_profile_company_name") || localStorage.getItem("serena_prof_company");
    const savedCnpj = profileCnpj || localStorage.getItem("serenapsi_profile_cnpj") || localStorage.getItem("serena_prof_cnpj");

    if (savedName) setLocalProfessionalName(savedName);
    if (savedReg) setLocalProfessionalReg(savedReg);
    if (savedClinic) setLocalClinicName(savedClinic);
    if (savedEmail) setLocalContactEmail(savedEmail);
    if (savedPhone) setLocalContactPhone(savedPhone);
    if (savedAddr) setLocalAddress(savedAddr);
    if (savedLogo) setLocalCustomLogo(savedLogo);
    if (savedCompany) setLocalCompanyName(savedCompany);
    if (savedCnpj) setLocalCnpj(savedCnpj);
  }, [profileName, profileCrp, profileClinicName, profileCompanyName, profileCnpj]);

  // Helper for generating default templates
  const getTemplateForType = (type: string, patientName: string, patientFee?: number) => {
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    const nameToUse = patientName || "[Nome do Paciente]";
    const feeToUse = patientFee ? `R$ ${patientFee.toFixed(2)}` : "R$ 150,00";

    switch (type) {
      case "Laudo":
        return `LAUDO PSICOLÓGICO

A pedido de ${nameToUse}, para fins de comprovação e acompanhamento de saúde mental, submeteu-se a avaliação psicológica a(o) paciente ${nameToUse}.

1. ANÁLISE DA DEMANDA:
A(O) paciente buscou atendimento clínico relatando sintomas persistentes de ansiedade, insônia inicial, oscilações frequentes de humor e impacto direto em suas atividades ocupacionais e sociais.

2. PROCEDIMENTOS TÉCNICOS:
Foram realizadas sessões semanais de psicoterapia baseadas na abordagem Cognitivo-Comportamental (TCC), entrevista clínica detalhada, análise comportamental aplicada e aplicação de escalas padronizadas de autoavaliação de ansiedade e estresse.

3. SÍNTESE DIAGNÓSTICA E CONCLUSÃO:
Com base na avaliação clínica, observou-se quadro clínico compatível com Transtorno de Ansiedade Generalizada (CID-10: F41.1), caracterizado por preocupação excessiva, tensão motora crônica e hipervigilância. Recomenda-se a continuidade do tratamento psicoterapêutico com frequência semanal e acompanhamento médico interdisciplinar.

São Paulo, ${dateStr}.`;

      case "Relatório":
        return `RELATÓRIO CLÍNICO DE ACOMPANHAMENTO

Declaro para os devidos fins de direito que a(o) paciente ${nameToUse} encontra-se sob acompanhamento psicoterápico neste consultório desde ${new Date().toLocaleDateString("pt-BR")}.

O processo terapêutico tem como foco a regulação emocional, o desenvolvimento de habilidades de enfrentamento cognitivo frente a estressores cotidianos e o fortalecimento de recursos adaptativos de resiliência. 

A(O) paciente tem demonstrado excelente adesão ao tratamento, comparecendo com regularidade e empenho às sessões semanais, apresentando evolução favorável em seu bem-estar psíquico e social.

São Paulo, ${dateStr}.`;

      case "Atestado":
        return `ATESTADO DE COMPARECIMENTO

Atesto, para os devidos fins de comprovação, que a(o) paciente ${nameToUse} compareceu à sessão de psicoterapia realizada na data de hoje, das ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${new Date(Date.now() + 50 * 60 * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (duração de 50 minutos).

Por ser expressão da verdade, firmo o presente.

São Paulo, ${dateStr}.`;

      case "Declaração":
        return `DECLARAÇÃO DE ACOMPANHAMENTO

Declaro, para os devidos fins, que a(o) paciente ${nameToUse} esteve presente neste consultório na data de hoje, atuando como acompanhante em consulta psicológica realizada neste consultório.

Por ser verdade, firmo a presente declaração.

São Paulo, ${dateStr}.`;

      case "Prescrição":
        return `ORIENTAÇÕES E RECOMENDAÇÕES TERAPÊUTICAS

Paciente: ${nameToUse}

Como parte integrante do plano terapêutico personalizado, recomenda-se a prática consistente das seguintes condutas comportamentais e cognitivas para o manejo e regulação da ansiedade:

1. Respiração Diafragmática Controlada: Realizar o ciclo respiratório (4 segundos inspirando, 2 retendo, 6 expirando) por 5 minutos, pelo menos duas vezes ao dia (manhã e noite).
2. Diário de Pensamentos Disfuncionais (RPD): Registrar a situação, o pensamento automático negativo, as emoções associadas e uma resposta racional adaptativa sempre que identificar um pico de desconforto emocional.
3. Higiene do Sono Rigorosa: Evitar telas emissoras de luz azul (smartphones, tablets, computadores) por no mínimo 60 minutos antes do horário desejado de dormir, optando por leituras analógicas ou exercícios de relaxamento guiado.

São Paulo, ${dateStr}.`;

      case "Encaminhamento":
        return `CARTA DE ENCAMINHAMENTO PROFISSIONAL

Ao(À) Dr(a). [Nome do Profissional de Destino],

Encaminho a(o) paciente ${nameToUse}, que se encontra em acompanhamento psicoterápico neste consultório de forma regular, para que seja submetido(a) a avaliação complementar sob sua especialidade técnica.

No acompanhamento clínico recente, identificaram-se demandas que necessitam de intervenção farmacológica adjuvante para melhor manejo de sintomas severos de insônia e ansiedade psicossomática, visando otimizar a evolução do processo terapêutico global.

Coloco-me à inteira disposição para compartilhamento de informações técnicas pertinentes e discussão interdisciplinar do caso, respeitando as normas de sigilo profissional.

São Paulo, ${dateStr}.`;

      case "Recibo":
        return `RECIBO DE PRESTAÇÃO DE SERVIÇOS

A empresa ${localCompanyName}, inscrita no CNPJ ${localCnpj}, declara ter recebido de ${nameToUse} a importância de ${feeToUse} referente ao pagamento de honorários profissionais por sessões de psicoterapia clínica individual prestadas durante o mês corrente.

Por ser verdade, damos plena e geral quitação do valor recebido.

São Paulo, ${dateStr}.`;

      default:
        return "";
    }
  };

  // Sync template text when selecting a new patient or doc type in local mode
  useEffect(() => {
    if (isGenerating && generationMode === "local") {
      const patient = patients.find(p => p.id === selectedPatientId);
      const name = patient ? patient.nome_completo : "";
      const fee = patient ? patient.valor_padrao : 150;
      setLocalBodyText(getTemplateForType(localDocType, name, fee));
      setLocalDocTitle(`${localDocType} - ${patient ? patient.nome_preferencial : "Paciente"}`);
    }
  }, [selectedPatientId, localDocType, isGenerating, generationMode, patients]);
  
  // Placeholders inputs
  const [valorSessao, setValorSessao] = useState(150);
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [dataConsulta, setDataConsulta] = useState(new Date().toISOString().split("T")[0]);
  const [horarioConsulta, setHorarioConsulta] = useState("14:00");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState("");

  const loadDocsData = async () => {
    setLoading(true);
    try {
      const [dData, pData, mData] = await Promise.all([
        getDocs(spreadsheetId, token).catch(err => {
          console.error("Erro ao carregar documentos da planilha:", err);
          return [] as DocRecord[];
        }),
        getPatients(spreadsheetId, token).catch(err => {
          console.error("Erro ao carregar pacientes:", err);
          return [] as Patient[];
        }),
        getDriveFiles(modelsFolderId, token).catch(err => {
          console.error("Erro ao carregar arquivos de modelos do Drive:", err);
          return [] as { id: string; name: string; webViewLink: string; createdTime: string }[];
        })
      ]);
      setDocs(dData);
      setPatients(pData);
      setModelsList(mData);
    } catch (e) {
      console.error("Error loading documents data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (spreadsheetId && token) {
      loadDocsData();
    }
  }, [spreadsheetId, token]);

  const getPatientName = (pId: string) => {
    const patient = patients.find(p => p.id === pId);
    return patient ? patient.nome_preferencial : "Paciente";
  };

  const getPatientFullName = (pId: string) => {
    const patient = patients.find(p => p.id === pId);
    return patient ? patient.nome_completo : "Paciente Completo";
  };

  const handleOpenLocalDoc = (doc: DocRecord) => {
    try {
      const jsonStr = doc.google_doc_url.substring("local-preview:".length);
      const data: LocalDocContent = JSON.parse(jsonStr);
      setLocalDocId(data.id);
      setLocalDocTitle(data.titulo);
      setLocalDocType(data.tipo as any);
      setLocalBodyText(data.bodyText);
      setLocalProfessionalName(data.professionalName);
      setLocalProfessionalReg(data.professionalReg);
      setLocalClinicName(data.clinicName);
      setLocalContactEmail(data.contactEmail);
      setLocalContactPhone(data.contactPhone);
      setLocalAddress(data.address);
      setLocalLayoutDesign(data.layoutDesign);
      setLocalShowLogo(data.showLogo !== undefined ? data.showLogo : true);
      setSelectedPatientId(data.paciente_id);
      setLocalCustomLogo(data.customLogo || null);
      setIsViewingLocalDoc(true);
    } catch (err) {
      console.error("Erro ao analisar documento local:", err);
      alert("Não foi possível carregar os detalhes do documento.");
    }
  };

  const handleDeleteDoc = (doc: DocRecord) => {
    setConfirmDialog({
      isOpen: true,
      title: "Excluir Documento",
      message: `Tem certeza que deseja excluir o documento "${doc.titulo}"? Esta ação não pode ser desfeita.`,
      onConfirmText: "Excluir",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDocRecord(spreadsheetId, doc.id, token);
          if (doc.google_doc_id !== "local") {
            try {
              await deleteDriveFile(doc.google_doc_id, token);
            } catch (e) {
              console.warn("Could not delete from Drive:", e);
            }
          }
          setDocs(prev => prev.filter(d => d.id !== doc.id));
          alert("Documento excluído com sucesso.");
        } catch (e: any) {
          alert("Erro ao excluir documento: " + e.message);
        }
      }
    });
  };

  const handleDeleteModel = (fileId: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Excluir Modelo",
      message: `Tem certeza que deseja excluir o modelo "${name}"? Esta ação não pode ser desfeita.`,
      onConfirmText: "Excluir",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDriveFile(fileId, token);
          setModelsList(prev => prev.filter(m => m.id !== fileId));
          alert("Modelo excluído com sucesso.");
        } catch (e: any) {
          alert("Erro ao excluir modelo: " + e.message);
        }
      }
    });
  };

  const handleCreateBlankModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert("Por favor, digite um nome para o modelo.");
      return;
    }

    setIsModelSubmitting(true);
    setModelProgressMessage("Criando modelo no Google Docs...");
    try {
      const docFile = await createBlankGoogleDocTemplate(newModelName, modelsFolderId, token);
      setModelsList(prev => [docFile, ...prev]);
      alert(`Modelo "${newModelName}" criado em branco com sucesso! Você pode editá-lo clicando no ícone de lápis correspondente.`);
      setIsCreatingModel(false);
      setNewModelName("");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar modelo em branco: " + err.message);
    } finally {
      setIsModelSubmitting(false);
      setModelProgressMessage("");
    }
  };

  const handleUploadModelFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Por favor, selecione um arquivo.");
      return;
    }

    setIsModelSubmitting(true);
    setModelProgressMessage("Enviando e convertendo o arquivo para o Google Docs...");
    try {
      const docFile = await uploadAndConvertFileToGoogleDoc(uploadFile, modelsFolderId, token);
      setModelsList(prev => [docFile, ...prev]);
      alert(`Arquivo "${uploadFile.name}" carregado e convertido com sucesso para modelo do Google Docs!`);
      setIsCreatingModel(false);
      setUploadFile(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar e converter o arquivo: " + err.message);
    } finally {
      setIsModelSubmitting(false);
      setModelProgressMessage("");
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === "docx" || ext === "pdf" || file.type.includes("word") || file.type.includes("pdf")) {
        setUploadFile(file);
      } else {
        alert("Apenas arquivos .docx (Word) e .pdf são aceitos para conversão automática.");
      }
    }
  };

  const handleSaveLocalDoc = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPatientId) {
      alert("Selecione um paciente.");
      return;
    }
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    setSubmitting(true);
    try {
      // Save current professional details to default localStorage for next generations using unified keys
      localStorage.setItem("serenapsi_profile_name", localProfessionalName);
      localStorage.setItem("serenapsi_profile_crp", localProfessionalReg);
      localStorage.setItem("serenapsi_profile_clinic_name", localClinicName);
      localStorage.setItem("serenapsi_profile_company_name", localCompanyName);
      localStorage.setItem("serenapsi_profile_cnpj", localCnpj);

      // Keep backup legacy keys in sync too just in case
      localStorage.setItem("serena_prof_name", localProfessionalName);
      localStorage.setItem("serena_prof_reg", localProfessionalReg);
      localStorage.setItem("serena_prof_clinic", localClinicName);
      localStorage.setItem("serena_prof_company", localCompanyName);
      localStorage.setItem("serena_prof_cnpj", localCnpj);

      localStorage.setItem("serena_prof_email", localContactEmail);
      localStorage.setItem("serena_prof_phone", localContactPhone);
      localStorage.setItem("serena_prof_addr", localAddress);
      if (localCustomLogo) {
        localStorage.setItem("serena_prof_logo", localCustomLogo);
      } else {
        localStorage.removeItem("serena_prof_logo");
      }

      // Propagate updates to App.tsx global state
      if (onProfileUpdate) {
        const subtitle = localStorage.getItem("serenapsi_profile_subtitle") || "Terapia Cognitivo-Comportamental & Terapia do Esquema";
        const quote = localStorage.getItem("serenapsi_profile_quote") || "Acolher a vulnerabilidade é o primeiro passo para resgatar a autonomia emocional.";
        const duration = Number(localStorage.getItem("serenapsi_session_duration")) || 50;
        const greetingPrefix = localStorage.getItem("serenapsi_profile_greeting_prefix") || "Bom dia";
        const cpf = localStorage.getItem("serenapsi_profile_cpf") || "000.000.000-00";
        const pix = localStorage.getItem("serenapsi_profile_pix") || "(Inserir Chave Pix Aqui)";

        onProfileUpdate(
          localProfessionalName,
          localProfessionalReg,
          subtitle,
          quote,
          duration,
          greetingPrefix,
          localClinicName,
          localCompanyName,
          localCnpj,
          cpf,
          pix
        );
      }

      const dId = localDocId || generateUUID();
      const docData: LocalDocContent = {
        id: dId,
        paciente_id: selectedPatientId,
        tipo: localDocType,
        titulo: localDocTitle || `${localDocType} - ${patient.nome_preferencial}`,
        bodyText: localBodyText,
        professionalName: localProfessionalName,
        professionalReg: localProfessionalReg,
        clinicName: localClinicName,
        contactEmail: localContactEmail,
        contactPhone: localContactPhone,
        address: localAddress,
        layoutDesign: localLayoutDesign,
        showLogo: localShowLogo,
        data_criacao: new Date().toISOString().split("T")[0],
        patientName: patient.nome_completo,
        customLogo: localCustomLogo
      };

      const serializedUrl = `local-preview:${JSON.stringify(docData)}`;

      const newRecord: DocRecord = {
        id: dId,
        paciente_id: selectedPatientId,
        tipo: localDocType,
        titulo: docData.titulo,
        google_doc_id: "local",
        google_doc_url: serializedUrl,
        data_criacao: docData.data_criacao
      };

      // Call Sheets integration to save the row
      if (localDocId && docs.some(d => d.id === localDocId)) {
        await updateDocRecord(spreadsheetId, newRecord, token);
      } else {
        await addDocRecord(spreadsheetId, newRecord, token);
      }

      // Add to local state list
      setDocs(prev => {
        const filtered = prev.filter(d => d.id !== dId); // remove duplicate if editing
        return [newRecord, ...filtered];
      });

      alert(`Documento "${docData.titulo}" salvo com sucesso no Arquivo Digital!`);
      setIsGenerating(false);
      setIsViewingLocalDoc(false);
      setLocalDocId(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar o documento no arquivo digital: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert("Selecione um paciente.");
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    setSubmitting(true);
    try {
      // 1. Map chosen type to the respective template file name in Google Drive
      let templateName = "";
      let replacements: Record<string, string> = {};

      if (docType === "Contrato") {
        templateName = "Modelo_Contrato_Prestacao_Servicos";
        replacements = {
          NOME_PACIENTE: patient.nome_completo,
          VALOR_SESSAO: valorSessao.toString(),
          DIA_VENCIMENTO: diaVencimento,
          DATA_CONTRATO: new Date().toLocaleDateString("pt-BR")
        };
      } else if (docType === "Consentimento") {
        templateName = "Modelo_Termo_Consentimento_Informado";
        replacements = {
          NOME_PACIENTE: patient.nome_completo,
          DATA_TERMO: new Date().toLocaleDateString("pt-BR")
        };
      } else if (docType === "Declaração") {
        templateName = "Modelo_Declaracao_Comparecimento";
        replacements = {
          NOME_PACIENTE: patient.nome_completo,
          DATA_CONSULTA: new Date(dataConsulta).toLocaleDateString("pt-BR"),
          HORARIO_CONSULTA: horarioConsulta,
          DATA_EMISSAO: new Date().toLocaleDateString("pt-BR")
        };
      } else {
        // Laudo / Relatório
        templateName = "Modelo_Laudo_Psicologico";
        replacements = {
          NOME_PACIENTE: patient.nome_completo,
          QUEIXA_PRINCIPAL: queixaPrincipal || "Ansiedade generalizada recorrente.",
          DIAGNOSTICO_CID: diagnostico || "F41.1 (TAG)",
          DATA_EMISSAO: new Date().toLocaleDateString("pt-BR")
        };
      }

      const docTitle = `${docType}_${patient.nome_preferencial}_${new Date().toISOString().split("T")[0]}`;

      // 2. Call Workspace generation helper
      const result = await generateDocumentFromTemplate(
        templateName,
        patient.nome_preferencial,
        replacements,
        modelsFolderId,
        docsFolderId,
        token
      );

      // 3. Register the new generated doc record in Sheets Database
      const newId = generateUUID();
      const newRecord: DocRecord = {
        id: newId,
        paciente_id: patient.id,
        tipo: docType,
        titulo: docTitle,
        google_doc_id: result.docId,
        google_doc_url: result.docUrl,
        data_criacao: new Date().toISOString().split("T")[0]
      };

      await addDocRecord(spreadsheetId, newRecord, token);
      
      setDocs(prev => [newRecord, ...prev]);
      setLastGeneratedUrl(result.docUrl);
      
      alert(`Documento "${docTitle}" preenchido e gerado com sucesso!`);
      setIsGenerating(false);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao gerar documento no Google Docs. Verifique se os modelos existem. Detalhe: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const insertValue = (val: string) => {
    setLocalBodyText(prev => prev + " " + val);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-emerald-950">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-4" />
        <p className="font-sans font-medium text-lg">Carregando central de documentos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in px-4 md:px-0">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-emerald-950 flex items-center space-x-2">
            <FileText size={22} className="text-emerald-700" />
            <span>Documentos, Laudos & Contratos</span>
          </h2>
          <p className="text-xs text-emerald-600/70">Crie contratos, termos, recibos ou laudos personalizados em um clique usando modelos do Google Docs.</p>
        </div>

        <button
          onClick={() => {
            setLastGeneratedUrl("");
            setIsGenerating(true);
            setLocalDocId(null);
            const savedLogo = localStorage.getItem("serena_prof_logo");
            setLocalCustomLogo(savedLogo || null);
          }}
          className="flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold shadow cursor-pointer text-sm"
          id="generate-doc-trigger-btn"
        >
          <PlusCircle size={16} />
          <span>Gerar Documento</span>
        </button>
      </div>

      {/* Prominent success helper for last generated */}
      {lastGeneratedUrl && (
        <div className="bg-emerald-800 text-white p-5 rounded-2xl shadow-md border border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scale-up">
          <div>
            <h4 className="font-bold text-sm">Seu documento personalizado foi criado com sucesso!</h4>
            <p className="text-xs text-emerald-200 mt-0.5">O documento está salvo com segurança na pasta do Google Drive.</p>
          </div>
          <a
            href={lastGeneratedUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-white text-emerald-950 rounded-xl text-xs font-bold shadow hover:bg-emerald-50 transition shrink-0 inline-flex items-center space-x-1"
          >
            <span>Abrir no Google Docs</span>
            <ArrowRight size={14} />
          </a>
        </div>
      )}

      {/* Grid: Templates reference and generated documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Col span 1): Available models inside Google Drive */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 font-sans flex items-center space-x-2">
                <FolderOpen size={16} />
                <span>Modelos Carregados</span>
              </h3>
              <button
                onClick={() => {
                  setNewModelName("");
                  setUploadFile(null);
                  setIsCreatingModel(true);
                }}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/50 px-2.5 py-1.5 rounded-xl transition flex items-center space-x-1 cursor-pointer"
                title="Criar ou carregar novo modelo (.docx / .pdf)"
              >
                <PlusCircle size={14} />
                <span>Novo Modelo</span>
              </button>
            </div>
            <p className="text-xs text-emerald-600/70 leading-relaxed">Estes modelos em branco residem com segurança na pasta "Modelos" do Google Drive do consultório:</p>

            <div className="space-y-2.5">
              {modelsList.length === 0 ? (
                <div className="text-xs text-center text-slate-400 py-4">Carregando modelos do Drive...</div>
              ) : (
                modelsList.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-emerald-50/10 rounded-xl border border-emerald-100/20 group overflow-hidden">
                    <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                      <FileText size={20} className="text-emerald-600 shrink-0" />
                      <div className="overflow-hidden min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-emerald-950 break-words whitespace-normal" title={m.name}>{m.name.replace("Modelo_", "").replace(/_/g, " ")}</h4>
                        <span className="text-[10px] text-emerald-600/70">{new Date(m.createdTime).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <a
                        href={m.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition border border-emerald-100/30 flex items-center justify-center"
                        title="Editar Modelo no Google Docs"
                      >
                        <Edit size={14} />
                      </a>
                      <button
                        onClick={() => handleDeleteModel(m.id, m.name)}
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer border border-rose-100/30 flex items-center justify-center"
                        title="Excluir Modelo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column (Col span 2): Generated Documents list table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/40">
            <h3 className="text-base font-bold text-emerald-950 font-sans mb-4 flex items-center space-x-2">
              <Layers size={18} className="text-emerald-700" />
              <span>Arquivo Digital de Documentos</span>
            </h3>

            {docs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-emerald-50 rounded-2xl">
                <FileText size={40} className="mx-auto text-emerald-100 mb-2" />
                <p className="text-sm text-emerald-800 font-semibold">Sem documentos gerados.</p>
                <p className="text-xs text-emerald-600/50 mt-1">Toque em "Gerar Documento" para iniciar.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-50 hover:border-emerald-100 transition bg-white"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100/50 flex items-center justify-center font-bold text-emerald-800 text-sm shrink-0">
                        <FileText size={18} />
                      </div>

                      <div>
                        <h4 className="font-bold text-emerald-950 text-sm font-sans flex items-center space-x-2">
                          <span>{doc.titulo}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase">
                            {doc.tipo}
                          </span>
                        </h4>
                        <p className="text-[11px] text-emerald-600/80 mt-0.5">
                          Paciente: <span className="font-semibold text-emerald-950">{getPatientName(doc.paciente_id)}</span> • Emitido em {new Date(doc.data_criacao).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      {doc.google_doc_url.startsWith("local-preview:") ? (
                        <button
                          onClick={() => handleOpenLocalDoc(doc)}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-sm"
                        >
                          <Printer size={12} />
                          <span>Ver / Editar</span>
                        </button>
                      ) : (
                        <a
                          href={doc.google_doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                        >
                          <span>Visualizar Docs</span>
                          <span>↗</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Excluir documento"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- GENERATOR FORM MODAL --- */}
      {isGenerating && generationMode === "gdocs" && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white md:rounded-3xl max-w-3xl w-full h-full md:h-auto md:max-h-[90vh] flex flex-col shadow-2xl border border-emerald-100 animate-scale-up">
            
            <div className="flex justify-between items-center border-b border-emerald-50 p-6 pb-4 shrink-0">
              <h3 className="font-sans font-bold text-lg md:text-xl text-emerald-950 flex items-center space-x-2">
                <Sparkles size={20} className="text-yellow-500" />
                <span>Gerar no Google Docs (Modelos)</span>
              </h3>
              <button onClick={() => setIsGenerating(false)} className="text-emerald-400 hover:text-emerald-800 font-bold p-2">Fechar</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="flex bg-emerald-50 p-1.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGenerationMode("local")}
                  className="flex-1 py-2.5 rounded-lg transition text-emerald-800 hover:bg-emerald-100"
                >
                  Editor Timbrado Clínico (Interno)
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode("gdocs")}
                  className="flex-1 py-2.5 rounded-lg transition bg-emerald-800 text-white shadow"
                >
                  Google Docs
                </button>
              </div>

              <form onSubmit={handleGenerateDoc} className="space-y-6 text-sm">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-emerald-900 block">Paciente *</label>
                    <select
                      required
                      value={selectedPatientId}
                      onChange={e => setSelectedPatientId(e.target.value)}
                      className="w-full text-sm p-3.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950"
                    >
                      <option value="">Selecione o paciente...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome_preferencial} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-emerald-900 block">Tipo do Documento *</label>
                    <select
                      required
                      value={docType}
                      onChange={e => setDocType(e.target.value as any)}
                      className="w-full text-sm p-3.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-emerald-950 animate-fade-in"
                    >
                      <option value="Contrato">Contrato de Prestação de Serviços</option>
                      <option value="Consentimento">Termo de Consentimento Informado</option>
                      <option value="Declaração">Declaração de Comparecimento</option>
                      <option value="Laudo">Relatório / Laudo Clínico</option>
                    </select>
                  </div>
                </div>

                {/* Contrato Placeholders fields */}
                {docType === "Contrato" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Valor por Sessão (R$)</label>
                      <input
                        type="number"
                        value={valorSessao}
                        onChange={e => setValorSessao(Number(e.target.value))}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Dia do Vencimento Mensal</label>
                      <input
                        type="text"
                        value={diaVencimento}
                        onChange={e => setDiaVencimento(e.target.value)}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                  </div>
                )}

                {/* Declaração Placeholders fields */}
                {docType === "Declaração" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Data da Consulta</label>
                      <input
                        type="date"
                        value={dataConsulta}
                        onChange={e => setDataConsulta(e.target.value)}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Horário</label>
                      <input
                        type="time"
                        value={horarioConsulta}
                        onChange={e => setHorarioConsulta(e.target.value)}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                  </div>
                )}

                {/* Laudo Relatorio Placeholders fields */}
                {docType === "Laudo" && (
                  <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-100 space-y-4 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Descrição de Queixas Principais</label>
                      <input
                        type="text"
                        placeholder="Ex: Episódios recorrentes de ansiedade social..."
                        value={queixaPrincipal}
                        onChange={e => setQueixaPrincipal(e.target.value)}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-950">Conclusão / Hipótese Diagnóstica (CID)</label>
                      <input
                        type="text"
                        placeholder="Ex: F41.1 - Transtorno de Ansiedade Generalizada"
                        value={diagnostico}
                        onChange={e => setDiagnostico(e.target.value)}
                        className="w-full p-3 border border-emerald-100 rounded-xl bg-white text-emerald-950"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold shadow disabled:opacity-50 transition cursor-pointer text-base"
                  >
                    {submitting ? "Alimentando modelo no Google Docs..." : "Gerar Documento Personalizado"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- FULLSCREEN INTERACTIVE TIMBRADO WORKSPACE --- */}
      {((isGenerating && generationMode === "local") || isViewingLocalDoc) && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-1 sm:p-4 overflow-y-auto">
          {/* Custom Print Style Injection */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-letterhead-area, #printable-letterhead-area * {
                visibility: visible !important;
              }
              #printable-letterhead-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 22mm 18mm !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
                box-sizing: border-box !important;
              }
              @page {
                size: A4;
                margin: 0;
              }
            }
          `}</style>

          <div className="bg-[#FAF9F5] rounded-3xl max-w-7xl w-full h-[95vh] md:h-[90vh] flex flex-col shadow-2xl border border-emerald-100/50 overflow-hidden animate-scale-up">
            {/* Top Workspace Bar */}
            <div className="bg-white border-b border-emerald-100/30 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="font-serif italic font-bold text-base text-emerald-950">
                    {isViewingLocalDoc ? "Visualizando Documento Timbrado" : "Gerador de Documentos & Laudos Timbrados"}
                  </h3>
                  <p className="text-[10px] text-emerald-600/70">
                    Editor clínico em tempo real com templates automatizados e impressão A4 integrada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isGenerating && (
                  <div className="flex bg-emerald-50 p-1 rounded-xl mr-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setGenerationMode("local")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        generationMode === "local" ? "bg-emerald-800 text-white shadow" : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Editor Timbrado
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationMode("gdocs")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        generationMode === "gdocs" ? "bg-emerald-800 text-white shadow" : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Google Docs
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsGenerating(false);
                    setIsViewingLocalDoc(false);
                    setLocalDocId(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition cursor-pointer flex items-center space-x-1"
                >
                  <X size={14} />
                  <span>Fechar Workspace</span>
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Controls Column */}
              <div className="w-full md:w-[42%] border-r border-emerald-100/20 bg-white p-5 overflow-y-auto space-y-4 text-xs flex flex-col">
                
                <div className="space-y-4">
                  
                  {/* Document metadata configurations */}
                  <div className="bg-[#FAFBF9] p-4 rounded-2xl border border-emerald-100/30 space-y-3">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Configuração do Documento</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-emerald-900 block">Paciente Associado *</label>
                        <select
                          value={selectedPatientId}
                          onChange={e => setSelectedPatientId(e.target.value)}
                          className="w-full text-xs p-2 border border-emerald-100/80 rounded-xl bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          {patients.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nome_preferencial}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-emerald-900 block">Tipo do Documento *</label>
                        <select
                          value={localDocType}
                          onChange={e => setLocalDocType(e.target.value as any)}
                          className="w-full text-xs p-2 border border-emerald-100/80 rounded-xl bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                        >
                          <option value="Laudo">Laudo Psicológico</option>
                          <option value="Relatório">Relatório Clínico</option>
                          <option value="Atestado">Atestado de Comparecimento</option>
                          <option value="Declaração">Declaração de Acompanhamento</option>
                          <option value="Prescrição">Orientações / Prescrição</option>
                          <option value="Encaminhamento">Carta de Encaminhamento</option>
                          <option value="Recibo">Recibo de Pagamento</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-emerald-900 block">Título de Arquivo do Documento *</label>
                      <input
                        type="text"
                        value={localDocTitle}
                        onChange={e => setLocalDocTitle(e.target.value)}
                        placeholder="Ex: Laudo Clínico - Ana Clara"
                        className="w-full text-xs p-2.5 border border-emerald-100/80 rounded-xl bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Letterhead Visual Design configurations */}
                  <div className="bg-[#FAFBF9] p-4 rounded-2xl border border-emerald-100/30 space-y-3">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">Design do Papel Timbrado</span>
                    
                    <div className="space-y-1.5">
                      <label className="font-bold text-emerald-900 block">Modelo de Layout</label>
                      <div className="grid grid-cols-3 gap-1.5 bg-emerald-50/30 p-1 rounded-xl">
                        {(["classic", "elegant", "boho"] as const).map(style => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setLocalLayoutDesign(style)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                              localLayoutDesign === style
                                ? "bg-emerald-800 text-white shadow-sm"
                                : "text-emerald-800 hover:bg-emerald-100/60"
                            }`}
                          >
                            {style === "classic" ? "Clássico" : style === "elegant" ? "Moderno" : "Boho"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="font-semibold text-emerald-900 cursor-pointer flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={localShowLogo}
                          onChange={e => setLocalShowLogo(e.target.checked)}
                          className="rounded border-emerald-200 text-emerald-800 focus:ring-emerald-700 cursor-pointer h-4 w-4"
                        />
                        <span>Exibir Logotipo/Símbolo no Cabeçalho</span>
                      </label>
                    </div>

                    {localShowLogo && (
                      <div className="mt-3.5 pt-3 border-t border-emerald-100/30 space-y-2 animate-fade-in">
                        <span className="font-bold text-emerald-900 block text-[11px]">Logotipo Personalizado (Dispositivo)</span>
                        
                        {localCustomLogo ? (
                          <div className="flex items-center space-x-3 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/40">
                            <div className="w-12 h-12 rounded-lg bg-white border border-emerald-100 flex items-center justify-center p-1 overflow-hidden shrink-0">
                              <img
                                src={localCustomLogo}
                                alt="Logo Preview"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-[10px] text-emerald-800 font-semibold truncate">Logotipo customizado</p>
                              <div className="flex space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById("logo-upload-input") as HTMLInputElement;
                                    if (input) input.click();
                                  }}
                                  className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold transition underline"
                                >
                                  Alterar
                                </button>
                                <span className="text-[10px] text-gray-300">•</span>
                                <button
                                  type="button"
                                  onClick={() => setLocalCustomLogo(null)}
                                  className="text-[10px] text-red-600 hover:text-red-800 font-bold transition underline"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById("logo-upload-input") as HTMLInputElement;
                              if (input) input.click();
                            }}
                            className="w-full border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-xl p-3 flex flex-col items-center justify-center space-y-1 transition cursor-pointer text-center group"
                          >
                            <Upload size={14} className="text-emerald-700 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] text-emerald-800 font-semibold">Escolher imagem do dispositivo</span>
                            <span className="text-[9px] text-emerald-600/60 font-medium">Suporta PNG/JPG de até 10MB (otimizada em tempo real)</span>
                          </button>
                        )}
                        
                        <input
                          id="logo-upload-input"
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) {
                                alert("O arquivo é muito grande. Escolha uma imagem de até 10MB.");
                                return;
                              }
                              try {
                                const optimizedDataUrl = await resizeAndCompressImage(file);
                                setLocalCustomLogo(optimizedDataUrl);
                              } catch (err: any) {
                                alert("Erro ao carregar e otimizar imagem: " + err.message);
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Document Body Text Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-emerald-950 block text-xs">Texto do Documento (Editor Livre)</label>
                      <span className="text-[10px] text-emerald-600/60">Edite livremente o conteúdo abaixo</span>
                    </div>

                    <textarea
                      value={localBodyText}
                      onChange={e => setLocalBodyText(e.target.value)}
                      rows={11}
                      className="w-full text-xs p-3.5 border border-emerald-100 rounded-2xl bg-emerald-50/5 text-emerald-950 focus:ring-1 focus:ring-emerald-700 focus:outline-none font-serif leading-relaxed"
                      placeholder="Escreva o laudo, atestado ou conteúdo clínico aqui..."
                    />

                    {/* Placeholder Insertion Utilities */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 block">Inserir Dados Rápidos:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const p = patients.find(p => p.id === selectedPatientId);
                            insertValue(p ? p.nome_completo : "[Nome Completo]");
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/50 rounded-lg font-bold text-[9px] transition cursor-pointer"
                        >
                          + Paciente Completo
                        </button>
                        <button
                          type="button"
                          onClick={() => insertValue(new Date().toLocaleDateString("pt-BR"))}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/50 rounded-lg font-bold text-[9px] transition cursor-pointer"
                        >
                          + Data de Hoje
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const p = patients.find(p => p.id === selectedPatientId);
                            insertValue(p ? `R$ ${p.valor_padrao.toFixed(2)}` : "R$ 150,00");
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/50 rounded-lg font-bold text-[9px] transition cursor-pointer"
                        >
                          + Valor Sessão
                        </button>
                        <button
                          type="button"
                          onClick={() => insertValue("São Paulo, " + new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }))}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/50 rounded-lg font-bold text-[9px] transition cursor-pointer"
                        >
                          + Cidade e Data
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Clinician's professional credentials settings */}
                  <details className="group border border-emerald-100/50 rounded-2xl bg-[#FAFBF9] overflow-hidden transition-all duration-200">
                    <summary className="list-none flex items-center justify-between p-3.5 cursor-pointer font-bold text-emerald-950 font-sans group-open:border-b group-open:border-emerald-100/30">
                      <span className="flex items-center space-x-1.5">
                        <Settings size={14} className="text-emerald-700" />
                        <span>Configurar Minhas Credenciais</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 transition-transform group-open:rotate-180">▼</span>
                    </summary>
                    <div className="p-3.5 space-y-3 bg-white">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">Nome do Profissional</label>
                          <input
                            type="text"
                            value={localProfessionalName}
                            onChange={e => setLocalProfessionalName(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">Registro (CRP / CRM)</label>
                          <input
                            type="text"
                            value={localProfessionalReg}
                            onChange={e => setLocalProfessionalReg(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-emerald-900 block">Nome da Clínica / Consultório</label>
                        <input
                          type="text"
                          value={localClinicName}
                          onChange={e => setLocalClinicName(e.target.value)}
                          className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">Razão Social (PJ)</label>
                          <input
                            type="text"
                            value={localCompanyName}
                            onChange={e => setLocalCompanyName(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">CNPJ</label>
                          <input
                            type="text"
                            value={localCnpj}
                            onChange={e => setLocalCnpj(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">E-mail Profissional</label>
                          <input
                            type="email"
                            value={localContactEmail}
                            onChange={e => setLocalContactEmail(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-900 block">Telefone Comercial</label>
                          <input
                            type="text"
                            value={localContactPhone}
                            onChange={e => setLocalContactPhone(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-emerald-900 block">Endereço Físico</label>
                        <input
                          type="text"
                          value={localAddress}
                          onChange={e => setLocalAddress(e.target.value)}
                          className="w-full text-xs p-2 border border-emerald-100 rounded-xl"
                          placeholder="Ex: Av. Paulista, 1000 - São Paulo - SP"
                        />
                      </div>
                    </div>
                  </details>

                </div>

                {/* Left Side Controls bottom panel */}
                <div className="pt-4 border-t border-emerald-50 mt-auto flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveLocalDoc()}
                      disabled={submitting}
                      className="flex-1 bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-2.5 px-4 rounded-xl shadow cursor-pointer text-center text-xs flex items-center justify-center space-x-1 transition"
                    >
                      <Check size={14} />
                      <span>{submitting ? "Salvando..." : isViewingLocalDoc ? "Salvar Alterações" : "Salvar no Arquivo"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-2.5 px-4 rounded-xl border border-emerald-100 cursor-pointer text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
                    >
                      <Printer size={14} />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(localBodyText);
                      setCopiedToClipboard(true);
                      setTimeout(() => setCopiedToClipboard(false), 2000);
                    }}
                    className="w-full py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium text-[10px] transition cursor-pointer flex items-center justify-center space-x-1"
                  >
                    {copiedToClipboard ? (
                      <>
                        <Check size={11} className="text-emerald-700" />
                        <span className="text-emerald-700 font-bold">Texto Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Clipboard size={11} />
                        <span>Copiar Texto do Documento</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right virtual A4 Live preview panel */}
              <div className="w-full md:w-[58%] bg-[#EFECE6] p-4 md:p-8 overflow-y-auto flex items-start justify-center select-text">
                <div className="overflow-x-auto w-full flex justify-center">
                  
                  {/* Virtual A4 dimensions sheet */}
                  <div
                    id="printable-letterhead-area"
                    className="w-[210mm] min-h-[297mm] bg-white p-14 md:p-16 shadow-xl border border-gray-200/50 text-black flex flex-col justify-between font-serif shrink-0 select-text relative rounded-sm"
                    style={{ minHeight: "297mm", width: "210mm" }}
                  >
                    
                    {/* Header depending on chosen layout design */}
                    <div>
                      {localLayoutDesign === "classic" && (
                        <div className="text-center space-y-2 pb-3 mb-10 border-b-4 border-double border-emerald-800/40 relative">
                          {localShowLogo && (
                            <div className="mx-auto mb-2 flex items-center justify-center">
                              {localCustomLogo ? (
                                <img
                                  src={localCustomLogo}
                                  alt="Logo"
                                  className="h-14 w-auto object-contain max-h-14"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full border border-emerald-800/30 flex items-center justify-center bg-emerald-50/50">
                                  <span className="text-emerald-800 font-serif font-extrabold text-lg">Ψ</span>
                                </div>
                              )}
                            </div>
                          )}
                          <h1 className="text-base font-bold text-emerald-950 font-serif tracking-wide">{localClinicName.toUpperCase()}</h1>
                          <div className="text-xs text-emerald-800/80 font-sans font-medium space-y-0.5">
                            <p>{localProfessionalName} • {localProfessionalReg}</p>
                          </div>
                        </div>
                      )}

                      {localLayoutDesign === "elegant" && (
                        <div className="flex justify-between items-center pb-4 mb-10 border-b border-gray-200 relative">
                          <div className="flex items-center space-x-3.5 text-left">
                            <div className="w-1 bg-emerald-700 h-12 rounded-full shrink-0" />
                            <div>
                              <h1 className="text-base font-extrabold text-emerald-950 font-sans tracking-wide leading-none">{localProfessionalName.toUpperCase()}</h1>
                              <span className="text-[10px] text-emerald-700 font-sans font-bold tracking-widest">{localProfessionalReg}</span>
                              <p className="text-[11px] text-gray-500 font-sans mt-0.5">{localClinicName}</p>
                            </div>
                          </div>
                          {localShowLogo && (
                            <div className="shrink-0 flex items-center justify-center">
                              {localCustomLogo ? (
                                <img
                                  src={localCustomLogo}
                                  alt="Logo"
                                  className="h-12 w-auto object-contain max-h-12"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-emerald-950/10 flex items-center justify-center font-bold text-emerald-950 text-base">
                                  Ψ
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {localLayoutDesign === "boho" && (
                        <div className="text-center p-4 bg-[#FAF6F0] rounded-2xl border border-amber-100/40 mb-10 relative">
                          {localShowLogo && (
                            <div className="mx-auto mb-1 flex items-center justify-center">
                              {localCustomLogo ? (
                                <img
                                  src={localCustomLogo}
                                  alt="Logo"
                                  className="h-14 w-auto object-contain max-h-14"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="text-amber-800/60 text-xl">❀</div>
                              )}
                            </div>
                          )}
                          <h1 className="text-lg font-serif italic text-amber-950 font-bold tracking-wider">{localProfessionalName}</h1>
                          <span className="text-[10px] text-amber-800/80 font-sans tracking-widest uppercase font-semibold block">{localProfessionalReg}</span>
                          <p className="text-[11px] text-amber-700/60 font-sans mt-0.5 italic">{localClinicName}</p>
                        </div>
                      )}

                      {/* Main document clinical content */}
                      <div className="mt-8 px-4 md:px-6">
                        <div className="whitespace-pre-line text-sm text-gray-800 leading-relaxed text-justify font-serif tracking-normal">
                          {localBodyText || "O conteúdo do documento aparecerá aqui..."}
                        </div>
                      </div>
                    </div>

                    {/* Signature block and metadata absolute bottom footer */}
                    <div className="mt-20">
                      
                      {/* Signature line and practitioner name */}
                      <div className="text-center mb-10">
                        <div className="w-56 h-[1px] bg-gray-400 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-gray-800 font-sans">{localProfessionalName}</p>
                        <p className="text-[10px] text-gray-500 font-sans">{localProfessionalReg} • Psicologia Clínica</p>
                      </div>

                      {/* Professional details absolute bottom */}
                      <div className="border-t border-gray-100 pt-3 text-center text-[9px] text-gray-400 font-sans space-y-0.5 leading-tight select-none">
                        <p className="font-semibold text-gray-500">{localClinicName}</p>
                        <p>{localAddress}</p>
                        <p>Contato: {localContactPhone} • {localContactEmail}</p>
                      </div>

                    </div>

                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* --- CREATE / UPLOAD MODEL MODAL --- */}
      {isCreatingModel && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-emerald-100 animate-scale-up overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-emerald-50 p-6">
              <h3 className="font-sans font-bold text-lg text-emerald-950 flex items-center space-x-2">
                <Sparkles size={18} className="text-emerald-700" />
                <span>Adicionar Novo Modelo</span>
              </h3>
              <button
                onClick={() => {
                  if (!isModelSubmitting) setIsCreatingModel(false);
                }}
                disabled={isModelSubmitting}
                className="text-emerald-400 hover:text-emerald-800 font-bold p-1 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector tabs */}
            <div className="flex bg-emerald-50/50 p-1.5 m-6 mb-0 rounded-2xl text-xs font-bold gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setModelCreationMode("upload")}
                disabled={isModelSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                  modelCreationMode === "upload"
                    ? "bg-white text-emerald-950 shadow-sm"
                    : "text-emerald-700 hover:bg-emerald-100/40"
                }`}
              >
                <Upload size={14} />
                <span>Carregar DOCX ou PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setModelCreationMode("blank")}
                disabled={isModelSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                  modelCreationMode === "blank"
                    ? "bg-white text-emerald-950 shadow-sm"
                    : "text-emerald-700 hover:bg-emerald-100/40"
                }`}
              >
                <PlusCircle size={14} />
                <span>Criar em Branco</span>
              </button>
            </div>

            {/* Modal Content / Forms */}
            <div className="p-6">
              {modelCreationMode === "upload" ? (
                <form onSubmit={handleUploadModelFile} className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => {
                      if (!isModelSubmitting) document.getElementById("model-file-input")?.click();
                    }}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2.5 ${
                      isDraggingFile
                        ? "border-emerald-700 bg-emerald-50/40"
                        : "border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/10"
                    } ${isModelSubmitting ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input
                      id="model-file-input"
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Upload size={24} />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-950">
                        {uploadFile ? uploadFile.name : "Arraste seu modelo de arquivo aqui"}
                      </p>
                      <p className="text-xs text-emerald-600/70">
                        {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : "Ou clique para procurar em seu dispositivo"}
                      </p>
                    </div>

                    <div className="bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100/20 text-[10px] text-emerald-800 font-semibold inline-block">
                      Suporta formatos .docx e .pdf
                    </div>
                  </div>

                  <p className="text-[10px] text-emerald-600/60 leading-relaxed text-center">
                    * Arquivos DOCX e PDF carregados serão convertidos automaticamente para o formato editável do Google Docs e salvos na pasta de Modelos do seu consultório.
                  </p>

                  <div className="pt-2 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingModel(false)}
                      disabled={isModelSubmitting}
                      className="flex-1 py-3 border border-emerald-100 hover:bg-emerald-50 rounded-xl font-bold text-xs text-emerald-700 disabled:opacity-50 transition cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isModelSubmitting || !uploadFile}
                      className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow disabled:opacity-50 transition cursor-pointer text-center"
                    >
                      {isModelSubmitting ? "Carregando..." : "Importar Modelo"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateBlankModel} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-950">Nome do Modelo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Contrato de Terapia, Laudo Clínico Adulto"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      disabled={isModelSubmitting}
                      className="w-full p-3.5 border border-emerald-100 rounded-xl bg-emerald-50/10 text-xs text-emerald-950 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 disabled:opacity-50"
                    />
                  </div>

                  <p className="text-[10px] text-emerald-600/60 leading-relaxed">
                    Um modelo em branco será criado com marcadores de preenchimento padrão (como nome do paciente, data, etc.). Depois, basta clicar no ícone de edição (lápis) para customizar todo o texto no Google Docs.
                  </p>

                  <div className="pt-2 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingModel(false)}
                      disabled={isModelSubmitting}
                      className="flex-1 py-3 border border-emerald-100 hover:bg-emerald-50 rounded-xl font-bold text-xs text-emerald-700 disabled:opacity-50 transition cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isModelSubmitting || !newModelName.trim()}
                      className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow disabled:opacity-50 transition cursor-pointer text-center"
                    >
                      {isModelSubmitting ? "Criando..." : "Criar Modelo"}
                    </button>
                  </div>
                </form>
              )}

              {/* Progress feedback */}
              {modelProgressMessage && (
                <div className="mt-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/30 flex items-center space-x-2.5 animate-pulse shrink-0">
                  <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <span className="text-xs text-emerald-800 font-medium">{modelProgressMessage}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- CUSTOM CONFIRMATION DIALOG --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 animate-scale-up space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmDialog.variant === "danger" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              }`}>
                {confirmDialog.variant === "danger" ? <AlertTriangle size={20} /> : <Check size={20} />}
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h4 className="font-sans font-bold text-base text-emerald-950 leading-tight">{confirmDialog.title}</h4>
                <p className="text-xs text-emerald-800/80 leading-relaxed break-words">{confirmDialog.message}</p>
              </div>
            </div>
            
            <div className="flex space-x-3 pt-1">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 border border-emerald-100 hover:bg-emerald-50 rounded-xl font-bold text-xs text-emerald-700 transition cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer text-center ${
                  confirmDialog.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {confirmDialog.onConfirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST NOTIFICATIONS --- */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
          <div className={`p-4 rounded-2xl shadow-xl border flex items-center space-x-3 text-xs font-medium animate-slide-up ${
            toast.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-100"
              : toast.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-100"
              : "bg-blue-50 text-blue-900 border-blue-100"
          }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              toast.type === "error" ? "bg-rose-600" : toast.type === "success" ? "bg-emerald-600" : "bg-blue-600"
            }`} />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="text-slate-400 hover:text-slate-600 font-bold p-0.5 rounded-lg transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
