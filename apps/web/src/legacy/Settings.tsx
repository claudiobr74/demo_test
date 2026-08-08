import { apiFetch } from "../lib/api";
import { generateUUID } from "../lib/uuid";
import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  FolderOpen,
  RefreshCw,
  Download,
  UploadCloud,
  Shield,
  Trash2,
  Mail,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  User,
  Edit2,
  Check,
  X,
  Lock
} from "lucide-react";
import {
  setupAppWorkspace,
  addAuditLog
} from "../lib/workspace";
import { googleFetch as fetch } from "../lib/googleFetch";

interface UserRecord {
  uid?: string;
  docId?: string;
  email: string;
  displayName?: string;
  role: "psychologist_admin" | "secretary";
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BackupItem {
  id: string;
  backupId: string;
  fileId: string | null;
  createdAt: string;
  createdBy: string;
  schemaVersion: string;
  appVersion: string;
  tamanho: string;
  status: string;
  isRestorable?: boolean;
  description: string;
  errorMessage?: string;
}

interface SettingsProps {
  token: string;
  spreadsheetId: string;
  userEmail: string;
  role: string;
  onRefreshAllData: () => void;
  onLogout: () => void;
  profileName: string;
  profileCrp: string;
  profileSubtitle: string;
  profileQuote: string;
  profileSessionDuration: number;
  profileGreetingPrefix: string;
  profileClinicName: string;
  profileCompanyName: string;
  profileCnpj: string;
  profileCpf: string;
  profilePix: string;
  profilePicture: string;
  onProfilePictureChange: (pic: string) => void;
  onProfileUpdate: (
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
  userPermissions?: any;
}

export default function Settings({
  token,
  spreadsheetId,
  userEmail,
  role,
  onRefreshAllData,
  onLogout,
  profileName,
  profileCrp,
  profileSubtitle,
  profileQuote,
  profileSessionDuration,
  profileGreetingPrefix,
  profileClinicName,
  profileCompanyName,
  profileCnpj,
  profileCpf,
  profilePix,
  profilePicture,
  onProfilePictureChange,
  onProfileUpdate,
  userPermissions
}: SettingsProps) {
  const [repairing, setRepairing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupsList, setBackupsList] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  // Professional clinical profile form states
  const [nameInput, setNameInput] = useState(profileName);
  const [crpInput, setCrpInput] = useState(profileCrp);
  const [subtitleInput, setSubtitleInput] = useState(profileSubtitle);
  const [quoteInput, setQuoteInput] = useState(profileQuote);
  const [durationInput, setDurationInput] = useState<number | string>(profileSessionDuration);
  const [greetingPrefixInput, setGreetingPrefixInput] = useState(profileGreetingPrefix);
  const [clinicNameInput, setClinicNameInput] = useState(profileClinicName);
  const [companyNameInput, setCompanyNameInput] = useState(profileCompanyName);
  const [cnpjInput, setCnpjInput] = useState(profileCnpj);
  const [cpfInput, setCpfInput] = useState(profileCpf);
  const [pixInput, setPixInput] = useState(profilePix);
  const [picPreview, setPicPreview] = useState(profilePicture);
  const [isDragging, setIsDragging] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  // Sync state with props when they change (e.g., if updated via another tab/component)
  useEffect(() => {
    setNameInput(profileName);
    setCrpInput(profileCrp);
    setSubtitleInput(profileSubtitle);
    setQuoteInput(profileQuote);
    setDurationInput(profileSessionDuration);
    setGreetingPrefixInput(profileGreetingPrefix);
    setClinicNameInput(profileClinicName);
    setCompanyNameInput(profileCompanyName);
    setCnpjInput(profileCnpj);
    setCpfInput(profileCpf);
    setPixInput(profilePix);
    setPicPreview(profilePicture);
  }, [
    profileName,
    profileCrp,
    profileSubtitle,
    profileQuote,
    profileSessionDuration,
    profileGreetingPrefix,
    profileClinicName,
    profileCompanyName,
    profileCnpj,
    profileCpf,
    profilePix,
    profilePicture
  ]);

  // Theme state
  const [themeChoice, setThemeChoice] = useState(() => localStorage.getItem("serenapsi_theme") || "light");

  // Dynamic Authorized users state
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Load authorized users list and real backups list on mount
  useEffect(() => {
    fetchUsers();
    if (role === "psychologist_admin" || !userPermissions?.isSecretary) {
      fetchBackups();
    }
  }, [role, userPermissions]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiFetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error("Erro ao carregar lista de usuários:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchBackups = async () => {
    if (role !== "psychologist_admin" || userPermissions?.isSecretary) {
      return;
    }
    setLoadingBackups(true);
    try {
      const res = await apiFetch("/api/backup/list");
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data);
      }
    } catch (err) {
      console.error("Erro ao carregar lista de backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleThemeChange = (value: "light" | "dark") => {
    setThemeChoice(value);
    localStorage.setItem("serenapsi_theme", value);
    if (value === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Repair folders
  const handleRepairIntegration = async () => {
    setRepairing(true);
    try {
      const folders = await setupAppWorkspace(token);
      alert("Integração do Google Workspace verificada e REPARADA com sucesso! Todas as pastas estão ativas no Google Drive.");
      
      await addAuditLog(spreadsheetId, {
        id: generateUUID(),
        data_hora: new Date().toISOString(),
        usuario_email: userEmail,
        perfil: role,
        acao: "Verificação de Sistema",
        detalhes: "Reparação e alinhamento de pastas efetuados via Configurações"
      }, token);

      onRefreshAllData();
    } catch (e: any) {
      alert("Erro ao reestruturar pastas: " + e.message);
    } finally {
      setRepairing(false);
    }
  };

  // Create Real Backup
  const handleCreateBackup = async () => {
    if (role !== "psychologist_admin" || userPermissions?.isSecretary) {
      alert("Apenas administradores podem criar backups de segurança.");
      return;
    }
    setBackingUp(true);
    try {
      let driveFolderId = "";
      try {
        const folders = await setupAppWorkspace(token);
        driveFolderId = folders.backupsId;
      } catch (e) {
        console.warn("Aviso ao buscar pasta de backup no Google Drive:", e);
      }

      const res = await apiFetch("/api/backup/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveFolderId,
          googleAccessToken: token || "",
          description: `Backup de segurança gerado em ${new Date().toLocaleDateString("pt-BR")}`
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao comunicar com o servidor de backup.");
      }

      const newBkp = await res.json();
      alert(`Backup do sistema gerado com sucesso!\n\n• ID: ${newBkp.backupId}\n• Tamanho: ${newBkp.tamanho}\n• Status: ${newBkp.status}`);
      await fetchBackups();
    } catch (e: any) {
      console.error("Erro ao gerar backup:", e);
      alert(`Erro ao gerar backup de segurança: ${e.message || "Tente novamente."}`);
    } finally {
      setBackingUp(false);
    }
  };

  // Restore Real Backup
  const handleRestoreBackup = async (bkp: BackupItem) => {
    if (role !== "psychologist_admin" || userPermissions?.isSecretary) {
      alert("Apenas administradores podem realizar restauração do sistema.");
      return;
    }

    if (bkp.status === "failed" || bkp.isRestorable === false) {
      alert("Este ponto de backup está marcado como falhou/inválido e não pode ser restaurado.");
      return;
    }

    const dateFormatted = new Date(bkp.createdAt).toLocaleString("pt-BR");
    const confirmed = window.confirm(
      `ATENÇÃO: RESTAURAÇÃO CRÍTICA DO SISTEMA!\n\n` +
      `Você está prestes a restaurar todos os dados para o ponto de backup:\n` +
      `• ID: ${bkp.backupId}\n` +
      `• Data: ${dateFormatted}\n` +
      `• Criado por: ${bkp.createdBy}\n` +
      `• Tamanho: ${bkp.tamanho}\n\n` +
      `O sistema gerará automaticamente um ponto de segurança pré-restauração antes de aplicar os dados.\n\n` +
      `Deseja prosseguir com a restauração?`
    );

    if (!confirmed) return;

    setRestoringId(bkp.backupId);
    try {
      const res = await apiFetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: bkp.backupId })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "A restauração no servidor falhou.");
      }

      const resData = await res.json();
      alert(`RESTAURAÇÃO CONCLUÍDA COM SUCESSO!\n\n${resData.message}\n(Ponto de Segurança Pré-Restore criado com ID: ${resData.safetyBackupId})`);

      if (onRefreshAllData) {
        onRefreshAllData();
      }
      await fetchBackups();
    } catch (e: any) {
      console.error("Erro na restauração:", e);
      alert(`ERRO CRÍTICO NA RESTAURAÇÃO: ${e.message || "Não foi possível restaurar o backup."}`);
    } finally {
      setRestoringId(null);
    }
  };

  // Add Authorized user to Firestore
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToTrim = newEmail.trim().toLowerCase();
    if (!emailToTrim) return;

    if (usersList.some(u => u.email.toLowerCase() === emailToTrim)) {
      alert("Este e-mail já está cadastrado no SerenaPsi.");
      return;
    }

    try {
      const res = await apiFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToTrim, role: "secretary", active: true })
      });

      if (res.ok) {
        const newUser = await res.json();
        setUsersList(prev => [...prev, newUser]);
        setNewEmail("");
        setEditingUser(newUser);
        alert(`E-mail ${emailToTrim} cadastrado com sucesso no Firestore como Secretária! Ajuste o perfil e status abaixo se necessário.`);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao cadastrar e-mail.");
      }
    } catch (err) {
      alert("Erro de conexão ao adicionar e-mail.");
    }
  };

  // Update user role & active status in Firestore
  const handleUpdateUserPermissions = async () => {
    if (!editingUser) return;

    try {
      const res = await apiFetch("/api/auth/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingUser.uid || editingUser.docId,
          email: editingUser.email,
          role: editingUser.role,
          active: editingUser.active
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setUsersList(prev => prev.map(u => u.email.toLowerCase() === updated.email?.toLowerCase() ? { ...u, ...updated } : u));
        setEditingUser(null);
        alert(`Perfil e status de ${editingUser.email} atualizados com sucesso no Firestore!`);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao atualizar usuário.");
      }
    } catch (err) {
      alert("Erro de conexão ao salvar alterações.");
    }
  };

  // Delete user from Firestore
  const handleDeleteUser = async (emailToDelete: string, userUid?: string) => {
    if (emailToDelete.toLowerCase() === userEmail.toLowerCase()) {
      alert("Você não pode excluir sua própria conta enquanto estiver conectada.");
      return;
    }

    const confirmDelete = window.confirm(`Deseja realmente remover a conta ${emailToDelete} do controle de acessos no Firestore?`);
    if (!confirmDelete) return;

    try {
      const res = await apiFetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userUid, email: emailToDelete })
      });

      if (res.ok) {
        setUsersList(prev => prev.filter(u => u.email.toLowerCase() !== emailToDelete.toLowerCase()));
        if (editingUser?.email.toLowerCase() === emailToDelete.toLowerCase()) {
          setEditingUser(null);
        }
        alert(`E-mail ${emailToDelete} removido do Firestore com sucesso.`);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao excluir usuário.");
      }
    } catch (err) {
      alert("Erro de conexão ao excluir usuário.");
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido.");
      return;
    }
    // Limit size to 2.5MB to fit nicely in localStorage
    if (file.size > 2.5 * 1024 * 1024) {
      alert("A imagem selecionada é muito grande. Escolha uma foto de até 2.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPicPreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemovePicture = () => {
    setPicPreview("");
  };

  // Save dynamic clinical profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onProfilePictureChange(picPreview);
    onProfileUpdate(
      nameInput,
      crpInput,
      subtitleInput,
      quoteInput,
      Number(durationInput),
      greetingPrefixInput,
      clinicNameInput,
      companyNameInput,
      cnpjInput,
      cpfInput,
      pixInput
    );
    setProfileSavedMsg(true);
    setTimeout(() => setProfileSavedMsg(false), 4000);
  };

  // Secure full database uninstaller (LGPD)
  const handleFullDeinstallation = async () => {
    if (role !== "psychologist_admin" && userPermissions?.isSecretary) {
      alert("Apenas a Administradora (Psicóloga responsável) tem permissão para realizar o expurgo de dados.");
      return;
    }

    if (confirmInput !== "CONFIRMAR EXCLUSÃO") {
      alert("Por favor, digite 'CONFIRMAR EXCLUSÃO' exatamente como instruído para realizar o apagamento de dados.");
      return;
    }

    const doublyConfirmed = window.confirm(
      "⚠️ ATENÇÃO EXTREMA: AÇÃO IRREVERSÍVEL!\n\n" +
      "Isso iniciará o processo de expurgo técnico de dados do sistema:\n" +
      "• Serão excluídos cadastros de pacientes, sessões, evoluções e financeiro (Firestore e Google Sheets).\n" +
      "• Os logs de auditoria técnica serão pseudonimizados.\n" +
      "• Backups históricos previamente criados serão mantidos conforme política de retenção técnica.\n\n" +
      "Deseja prosseguir com o expurgo dos dados?"
    );
    if (!doublyConfirmed) return;

    setDeleting(true);
    try {
      const res = await apiFetch("/api/system/lgpd-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationText: confirmInput,
          spreadsheetId,
          googleAccessToken: token
        })
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        const errorList = resData.report?.erros?.join("\n• ") || resData.error || "Erro desconhecido";
        alert(`FALHA OU ERROS PARCIAIS NO EXPURGO:\n\n• ${errorList}\n\nO processo não foi concluído totalmente.`);
        return;
      }

      const report = resData.report || {};
      const removidoText = report.removido?.length ? "• " + report.removido.join("\n• ") : "Nenhum item";
      const mantidoText = report.mantido?.length ? "• " + report.mantido.join("\n• ") : "Nenhum item";

      alert(
        `RELATÓRIO TÉCNICO DE EXPURGO LGPD:\n\n` +
        `[REMOVIDO COM SUCESSO]:\n${removidoText}\n\n` +
        `[MANTIDO / PSEUDONIMIZADO POR EXIGÊNCIA TÉCNICA/REGRAS DE RETENÇÃO]:\n${mantidoText}\n\n` +
        `Você será desconectada do sistema por segurança.`
      );

      onLogout();
    } catch (e: any) {
      console.error("Erro ao realizar expurgo LGPD:", e);
      alert(`Erro de conexão ao realizar expurgo: ${e.message || "Tente novamente."}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in px-4 md:px-0">
      
      {/* Settings Title */}
      <div>
        <h2 className="text-3xl font-serif italic text-emerald-950 dark:text-emerald-50 flex items-center space-x-2">
          <SettingsIcon size={22} className="text-emerald-700 dark:text-emerald-400" />
          <span>Configurações do Consultório</span>
        </h2>
        <p className="text-xs text-emerald-600/70 dark:text-emerald-300/60">Gerenciamento de identidade, nível de acesso da equipe, backups de planilhas e segurança da informação.</p>
      </div>

      {/* Custom Clinical Profile Personalization Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-emerald-100/40 dark:border-emerald-900/40 space-y-6">
        <div className="border-b border-emerald-50 dark:border-emerald-900/30 pb-4">
          <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-50 font-serif italic flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-xl">✨</span>
            <span>Identidade Visual & Configuração de Perfil Clínico</span>
          </h3>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80 mt-1">Configure como o seu nome, registro profissional (CRP) e especialidade aparecem no dashboard, além de personalizar a frase de acolhimento e o tema claro ou escuro.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Foto de Perfil da Psicóloga (Arquivo Externo) */}
          <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-2xl bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/30">
            <div className="relative shrink-0">
              {picPreview ? (
                <img
                  src={picPreview}
                  alt="Foto do perfil"
                  className="w-24 h-24 rounded-full border-2 border-emerald-600 dark:border-emerald-500 object-cover shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-3xl shadow-sm border border-emerald-200 dark:border-emerald-900">
                  {nameInput ? nameInput.replace("Dra. ", "").charAt(0) : "V"}
                </div>
              )}
              {picPreview && (
                <button
                  type="button"
                  onClick={handleRemovePicture}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            
            <div className="flex-1 space-y-2.5 w-full">
              <label className="text-[11px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">
                Foto de Perfil do Consultório
              </label>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300/60 leading-relaxed">
                Carregue uma foto sua do seu dispositivo (JPEG, PNG ou WEBP). Ela será sincronizada e exibida no painel lateral junto com seu nome e CRP, acima do botão de desconectar.
              </p>
              
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("profile-pic-file")?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                  isDragging 
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
                    : "border-emerald-200 dark:border-emerald-800/80 hover:border-emerald-400"
                }`}
              >
                <input
                  type="file"
                  id="profile-pic-file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center space-y-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <UploadCloud size={20} className="text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {isDragging ? "Solte a foto aqui..." : "Arraste sua foto aqui ou clique para selecionar"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Nome no Dashboard</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Ex: Dra. Virgínia Macedo"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Número do Registro Profissional (CRP)</label>
              <input
                type="text"
                required
                value={crpInput}
                onChange={e => setCrpInput(e.target.value)}
                placeholder="Ex: CRP 11/04580"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Duração Padrão de Sessão (minutos)</label>
              <input
                type="number"
                required
                min={10}
                max={180}
                value={durationInput}
                onChange={e => setDurationInput(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Especialidade / Subtítulo</label>
              <input
                type="text"
                required
                value={subtitleInput}
                onChange={e => setSubtitleInput(e.target.value)}
                placeholder="Ex: Terapia Cognitivo-Comportamental & Terapia do Esquema"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Frase de Acolhimento do Dashboard</label>
              <input
                type="text"
                required
                value={quoteInput}
                onChange={e => setQuoteInput(e.target.value)}
                placeholder="Sua frase inspiradora para o início de cada dia clínico..."
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Como deseja a saudação do Dashboard?</label>
              <select
                value={greetingPrefixInput}
                onChange={e => setGreetingPrefixInput(e.target.value)}
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium cursor-pointer"
              >
                <option value="Bom dia">Bom dia</option>
                <option value="Boa tarde">Boa tarde</option>
                <option value="Boa noite">Boa noite</option>
                <option value="Olá">Olá</option>
                <option value="Seja muito bem-vinda">Seja muito bem-vinda</option>
                <option value="Bem-vinda de volta">Bem-vinda de volta</option>
                <option value="Acolhimento especial para você">Acolhimento especial para você</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Nome do Consultório / Clínica</label>
              <input
                type="text"
                required
                value={clinicNameInput}
                onChange={e => setClinicNameInput(e.target.value)}
                placeholder="Ex: Clínica de Psicologia Virgínia Macedo"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Razão Social (PJ)</label>
              <input
                type="text"
                value={companyNameInput}
                onChange={e => setCompanyNameInput(e.target.value)}
                placeholder="Ex: Virgínia Macedo Psicologia Clínica LTDA"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">CNPJ</label>
              <input
                type="text"
                value={cnpjInput}
                onChange={e => setCnpjInput(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">CPF do Profissional</label>
              <input
                type="text"
                value={cpfInput}
                onChange={e => setCpfInput(e.target.value)}
                placeholder="Ex: 000.000.000-00"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Chave PIX para Cobranças</label>
              <input
                type="text"
                value={pixInput}
                onChange={e => setPixInput(e.target.value)}
                placeholder="Ex: E-mail, Celular ou CPF"
                className="w-full text-xs px-4 py-2.5 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/5 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50 font-medium"
              />
            </div>
          </div>

          {/* SELETOR DE TEMA */}
          <div className="space-y-2 border-t border-emerald-50 dark:border-emerald-900/30 pt-4">
            <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">Tema Visual do SerenaPsi</label>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300/80">Escolha entre a suavidade clássica do tema claro ou a imersão aconchegante do tema escuro.</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border font-bold text-xs transition cursor-pointer ${
                  themeChoice === "light"
                    ? "bg-emerald-800 border-emerald-800 text-white shadow-sm"
                    : "bg-emerald-50/10 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-slate-950"
                }`}
              >
                <span>☀️ Tema Claro (Suave)</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border font-bold text-xs transition cursor-pointer ${
                  themeChoice === "dark"
                    ? "bg-emerald-800 border-emerald-800 text-white shadow-sm"
                    : "bg-emerald-50/10 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-slate-950"
                }`}
              >
                <span>🌙 Tema Escuro (Sage Cosmic)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-emerald-50 dark:border-emerald-900/30 pt-4">
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold min-h-6">
              {profileSavedMsg && (
                <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-850 dark:text-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-100/60 dark:border-emerald-850 animate-fade-in flex items-center space-x-1">
                  <span>✓</span>
                  <span>Configurações atualizadas com sucesso!</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer w-full sm:w-auto"
            >
              Salvar Alterações de Perfil
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Folders setup and backups */}
        <div className="space-y-6">
          
          {/* Repair Folders Integration */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-emerald-100/40 dark:border-emerald-900/40 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-sans flex items-center space-x-2">
              <FolderOpen size={16} />
              <span>Verificação de Pastas</span>
            </h3>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-300/60 leading-relaxed">Dra. Virgínia, caso sinta que a integração com o Google Drive está lenta ou faltam pastas internas, clique no botão abaixo para restaurar e reconectar as planilhas oficiais.</p>

            <button
              onClick={handleRepairIntegration}
              disabled={repairing}
              className="w-full bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-400 py-3 rounded-xl font-bold text-xs border border-emerald-100/60 dark:border-emerald-900/40 transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <RefreshCw size={14} className={repairing ? "animate-spin" : ""} />
              <span>{repairing ? "Reparando Pastas..." : "Verificar e Reparar Pastas Google"}</span>
            </button>
          </div>

          {/* Database Backups Export (Apenas para Administrador) */}
          {role === "psychologist_admin" && !userPermissions?.isSecretary && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-emerald-100/40 dark:border-emerald-900/40 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-sans flex items-center space-x-2">
                <Download size={16} />
                <span>Pontos de Restauração (Backups Reais)</span>
              </h3>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-300/60 leading-relaxed">
                Gere e gerencie backups completos em JSON sincronizados com o Google Drive e o banco de dados oficial, preservando todo o histórico do SerenaPsi.
              </p>

              <button
                onClick={handleCreateBackup}
                disabled={backingUp}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <UploadCloud size={14} className={backingUp ? "animate-spin" : ""} />
                <span>{backingUp ? "Criando Snapshot de Backup..." : "Gerar Novo Ponto de Backup Seguro"}</span>
              </button>

              <div className="border-t border-emerald-50 dark:border-emerald-900/30 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Backups Registrados no Sistema:
                  </span>
                  {loadingBackups && <span className="text-[10px] text-emerald-500 animate-pulse">Carregando...</span>}
                </div>

                {backupsList.length === 0 && !loadingBackups ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                    Nenhum ponto de backup registrado ainda. Clique no botão acima para criar o primeiro.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {backupsList.map(bkp => {
                      const isFailed = bkp.status === "failed" || bkp.status === "Falhou";
                      const isRestorable = bkp.isRestorable !== false && !isFailed;

                      return (
                        <div key={bkp.id || bkp.backupId} className="flex items-center justify-between p-3 bg-emerald-50/20 dark:bg-slate-950/50 rounded-xl text-xs border border-emerald-100/30 dark:border-emerald-900/30">
                          <div className="space-y-0.5 max-w-[220px]">
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-emerald-950 dark:text-emerald-50 truncate text-[11px]">
                                {bkp.backupId}
                              </p>
                              {isFailed ? (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[8px] font-bold rounded">
                                  Falhou
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[8px] font-bold rounded">
                                  Concluído
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-[9px] text-emerald-700/70 dark:text-emerald-300/60">
                              <span>{new Date(bkp.createdAt).toLocaleString("pt-BR")}</span>
                              <span>•</span>
                              <span>{bkp.tamanho}</span>
                            </div>
                            <p className="text-[9px] text-slate-400 truncate">
                              Criado por: {bkp.createdBy}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRestoreBackup(bkp)}
                            disabled={!isRestorable || restoringId === bkp.backupId}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isRestorable
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            {restoringId === bkp.backupId ? "Restaurando..." : isRestorable ? "Restaurar" : "Indisponível"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Dynamic Access Control and uninstaller */}
        <div className="space-y-6">
          
          {/* Clinic access control permissions menu list */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-emerald-100/40 dark:border-emerald-900/40 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-sans flex items-center space-x-2">
              <Shield size={16} />
              <span>Controle de Acesso da Clínica (Firestore)</span>
            </h3>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-300/60 leading-relaxed">
              Gerencie quem possui acesso ao SerenaPsi e defina o perfil oficial (<strong className="text-emerald-800 dark:text-emerald-300">Psicóloga / Admin</strong> ou <strong className="text-emerald-800 dark:text-emerald-300">Secretária</strong>).
            </p>

            <form onSubmit={handleAddEmail} className="flex gap-2 text-xs">
              <input
                type="email"
                required
                placeholder="Ex: secretaria@clinicavirginiamacedo.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-emerald-100 dark:border-emerald-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-emerald-50/10 dark:bg-slate-950 text-emerald-950 dark:text-emerald-50"
              />
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl font-bold shadow cursor-pointer text-xs"
              >
                Cadastrar
              </button>
            </form>

            <div className="space-y-2 pt-1 max-h-60 overflow-y-auto pr-1">
              {loadingUsers ? (
                <p className="text-xs text-emerald-600/60 animate-pulse text-center py-4">Carregando usuários do Firestore...</p>
              ) : usersList.length === 0 ? (
                <p className="text-xs text-emerald-600/60 text-center py-4">Nenhum usuário cadastrado.</p>
              ) : (
                usersList.map((usr) => (
                  <div key={usr.email} className="flex items-center justify-between p-3 bg-emerald-50/10 dark:bg-slate-950/30 rounded-xl border border-emerald-100/10 dark:border-emerald-900/10 text-xs">
                    <div className="flex items-center space-x-2 truncate min-w-0">
                      <Mail size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-emerald-950 dark:text-emerald-50 truncate font-semibold font-sans">{usr.email}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        usr.role === "psychologist_admin"
                          ? "bg-emerald-800 text-white"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      }`}>
                        {usr.role === "psychologist_admin" ? "Psicóloga / Admin" : "Secretária"}
                      </span>

                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        usr.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {usr.active !== false ? "Ativo" : "Inativo"}
                      </span>
                      
                      <button
                        onClick={() => setEditingUser(editingUser?.email === usr.email ? null : usr)}
                        className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-950 rounded"
                        title="Ajustar Perfil e Status"
                      >
                        <Edit2 size={12} />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(usr.email, usr.uid)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                        title="Remover Usuário"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Individual profile editing drawer/modal */}
            {editingUser && (
              <div className="bg-emerald-50/50 dark:bg-slate-950/50 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl space-y-3.5 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-2">
                  <h4 className="font-bold text-emerald-950 dark:text-emerald-100 truncate flex items-center space-x-1.5">
                    <User size={13} className="text-emerald-700" />
                    <span>Editar: {editingUser.email}</span>
                  </h4>
                  <button onClick={() => setEditingUser(null)} className="p-0.5 hover:bg-emerald-100 dark:hover:bg-slate-900 rounded">
                    <X size={14} className="text-emerald-700" />
                  </button>
                </div>

                {/* Role selection */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400 block">Perfil Oficial (Role)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, role: "psychologist_admin" })}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg border font-bold text-[10px] uppercase text-center cursor-pointer transition ${
                        editingUser.role === "psychologist_admin"
                          ? "bg-emerald-800 text-white border-emerald-800"
                          : "bg-white dark:bg-slate-900 border-emerald-100 text-emerald-700"
                      }`}
                    >
                      Psicóloga / Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, role: "secretary" })}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg border font-bold text-[10px] uppercase text-center cursor-pointer transition ${
                        editingUser.role === "secretary"
                          ? "bg-emerald-800 text-white border-emerald-800"
                          : "bg-white dark:bg-slate-900 border-emerald-100 text-emerald-700"
                      }`}
                    >
                      Secretária
                    </button>
                  </div>
                </div>

                {/* Active status selection */}
                <div className="space-y-1 pt-1 border-t border-emerald-100/40 dark:border-emerald-900/30">
                  <label className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400 block">Status da Conta</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, active: true })}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg border font-bold text-[10px] uppercase text-center cursor-pointer transition ${
                        editingUser.active !== false
                          ? "bg-emerald-700 text-white border-emerald-700"
                          : "bg-white dark:bg-slate-900 border-emerald-100 text-emerald-700"
                      }`}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, active: false })}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg border font-bold text-[10px] uppercase text-center cursor-pointer transition ${
                        editingUser.active === false
                          ? "bg-red-700 text-white border-red-700"
                          : "bg-white dark:bg-slate-900 border-emerald-100 text-emerald-700"
                      }`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUpdateUserPermissions}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2 rounded-xl text-[11px] uppercase transition cursor-pointer shadow-sm text-center block"
                >
                  Confirmar e Salvar no Firestore
                </button>
              </div>
            )}
          </div>

          {/* Secure database uninstaller */}
          <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100 dark:border-red-950/40 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-800 dark:text-red-400 font-sans flex items-center space-x-2">
              <Trash2 size={16} />
              <span>Desinstalação Segura e Apagamento LGPD</span>
            </h3>
            <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed">Em caso de mudança de software, encerramento de atividades ou migração definitiva, utilize esta ferramenta para esvaziar integralmente as planilhas sincronizadas, garantindo o absoluto apagamento de dados e preservando o sigilo ético obrigatório.</p>

            <div className="space-y-3.5 pt-1 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase block">Para prosseguir, digite "CONFIRMAR EXCLUSÃO" abaixo:</label>
                <input
                  type="text"
                  placeholder="Digite aqui..."
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-red-100 dark:border-red-900/40 rounded-xl focus:outline-none bg-white dark:bg-slate-950 text-red-950 dark:text-red-50"
                />
              </div>

              <button
                onClick={handleFullDeinstallation}
                disabled={confirmInput !== "CONFIRMAR EXCLUSÃO" || deleting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{deleting ? "Limpando registros..." : "Apagar Todo o Histórico Clínico (LGPD)"}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
