import React from "react";
import {
  Calendar,
  Users,
  DollarSign,
  FileText,
  BrainCircuit,
  Settings,
  LogOut,
  Sparkles,
  BookOpen,
  UserCheck,
  Menu,
  X,
  Download,
  Share2,
  ExternalLink,
  Smartphone,
  Laptop,
  Info
} from "lucide-react";
import { LogoIcon } from "./Logo";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  role: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  user,
  role,
  onLogout,
  isMobileOpen,
  setIsMobileOpen
}: SidebarProps) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState(true);
  const [isInstallModalOpen, setIsInstallModalOpen] = React.useState(false);
  const [activeInstructionTab, setActiveInstructionTab] = React.useState<"ios" | "android" | "desktop">("ios");

  const isIframe = React.useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt && !isIframe) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[SerenaPsi PWA] Resposta de instalação do usuário: ${outcome}`);
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  let menuItems = [
    { id: "meudia", label: "Meu dia", icon: Calendar },
    { id: "pacientes", label: "Pacientes", icon: Users },
    { id: "agenda", label: "Agenda", icon: Calendar },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "supervisor", label: "Supervisor IA", icon: BrainCircuit },
    { id: "notebooklm", label: "Conhecimento & NotebookLM", icon: BookOpen },
    { id: "configuracoes", label: "Configuração & Backup", icon: Settings }
  ];

  if (role === "secretary") {
    menuItems = [
      { id: "meudia", label: "Meu dia", icon: Calendar },
      { id: "pacientes", label: "Pacientes", icon: Users },
      { id: "agenda", label: "Agenda", icon: Calendar },
      { id: "financeiro", label: "Financeiro", icon: DollarSign }
    ];
  }

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-emerald-900 text-white border-b border-emerald-800">
        <div className="flex items-center space-x-2">
          <LogoIcon size={32} className="rounded-lg shadow-sm" />
          <span className="font-sans font-semibold text-lg tracking-tight">SerenaPsi</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1 hover:bg-emerald-800 rounded transition"
          id="mobile-menu-toggle"
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-emerald-900 text-emerald-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="app-sidebar"
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <LogoIcon size={40} className="rounded-xl shadow-md" />
            <div>
              <h1 className="font-sans font-bold text-xl tracking-tight leading-none text-white">SerenaPsi</h1>
              <span className="text-[10px] text-emerald-300 font-mono tracking-wider">GESTÃO INTEGRADA</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden text-emerald-200 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* User profile brief card */}
        <div className="p-4 mx-4 my-3 bg-emerald-950/40 rounded-xl border border-emerald-800/30">
          <div className="flex items-center space-x-3">
            <img
              src={user?.photoURL || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=60"}
              alt="Dra. Virgínia"
              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/50"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-white">{user?.displayName || "Dra. Virgínia"}</p>
              <p className="text-[11px] text-emerald-300 flex items-center space-x-1 font-sans">
                <UserCheck size={10} className="text-emerald-400" />
                <span>{role}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-950 shadow-sm font-semibold"
                    : "text-emerald-200 hover:bg-emerald-800/60 hover:text-white"
                }`}
                id={`sidebar-link-${item.id}`}
              >
                <Icon size={18} className={isActive ? "text-emerald-800" : "text-emerald-300"} />
                <span>{item.label}</span>
                {item.id === "supervisor" && (
                  <Sparkles size={12} className="ml-auto text-yellow-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* PWA Install Button */}
        {showInstallBtn && (
          <div className="px-4 py-2 border-t border-emerald-800/40">
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm bg-emerald-800 hover:bg-emerald-700 text-white font-medium transition-all duration-150 shadow-inner cursor-pointer"
              id="pwa-install-btn"
            >
              <Download size={18} className="text-emerald-300 animate-bounce" />
              <span>Instalar Aplicativo</span>
            </button>
          </div>
        )}

        {/* Log Out Button */}
        <div className="p-4 border-t border-emerald-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-emerald-300 hover:bg-red-950/40 hover:text-red-200 transition-all duration-150"
            id="sidebar-logout-btn"
          >
            <LogOut size={18} className="text-emerald-400 hover:text-red-300" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </div>

      {/* Overlay to close mobile sidebar */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* PWA Elegant Installation Guide Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 animate-scale-up space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-50">
              <div className="flex items-center space-x-2 text-emerald-850">
                <Download size={20} className="text-emerald-600" />
                <h3 className="font-sans font-bold text-lg leading-tight">Instalar SerenaPsi</h3>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* If inside iframe, warning and direct new tab link */}
            {isIframe ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
                <div className="flex items-start space-x-2.5">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-amber-900">Abra o app em uma nova aba</h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Como o SerenaPsi está em modo de visualização (iframe), os navegadores bloqueiam a instalação direta por segurança.
                    </p>
                  </div>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm animate-pulse"
                >
                  <span>Abrir em Nova Aba</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            ) : null}

            {/* Instructions Segmented Tabs */}
            <div className="flex border border-emerald-100 rounded-xl p-1 bg-emerald-50/50">
              <button
                onClick={() => setActiveInstructionTab("ios")}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  activeInstructionTab === "ios"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-emerald-800 hover:bg-emerald-100/50"
                }`}
              >
                iPhone (iOS)
              </button>
              <button
                onClick={() => setActiveInstructionTab("android")}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  activeInstructionTab === "android"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-emerald-800 hover:bg-emerald-100/50"
                }`}
              >
                Android
              </button>
              <button
                onClick={() => setActiveInstructionTab("desktop")}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  activeInstructionTab === "desktop"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-emerald-800 hover:bg-emerald-100/50"
                }`}
              >
                Computador
              </button>
            </div>

            {/* Instructions content */}
            <div className="pt-2 min-h-[160px]">
              {activeInstructionTab === "ios" && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-950">
                    <Smartphone size={16} className="text-emerald-600" />
                    <span>Passo a Passo para Safari (iOS)</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
                    <li>Abra o link do SerenaPsi usando o navegador <strong>Safari</strong>.</li>
                    <li>Toque no botão de <strong>Compartilhar</strong> <Share2 size={12} className="inline mx-1 text-emerald-600" /> (ícone de quadrado com seta para cima na barra inferior).</li>
                    <li>Role as opções para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
                    <li>Escolha o nome e confirme tocando em <strong>"Adicionar"</strong> no canto superior direito.</li>
                  </ol>
                </div>
              )}

              {activeInstructionTab === "android" && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-950">
                    <Smartphone size={16} className="text-emerald-600" />
                    <span>Passo a Passo para Google Chrome (Android)</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
                    <li>Abra o SerenaPsi no navegador <strong>Chrome</strong> do celular.</li>
                    <li>Toque no ícone de <strong>três pontinhos</strong> no canto superior direito do navegador.</li>
                    <li>Toque na opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
                    <li>Confirme a instalação tocando em <strong>"Instalar"</strong>.</li>
                  </ol>
                </div>
              )}

              {activeInstructionTab === "desktop" && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-950">
                    <Laptop size={16} className="text-emerald-600" />
                    <span>Como instalar no Computador (Chrome / Edge)</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
                    <li>No computador, abra o site no <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>.</li>
                    <li>Na barra de endereços (ao lado do link), clique no ícone de computador com uma seta para baixo <Download size={12} className="inline mx-1 text-emerald-600" />.</li>
                    <li>Ou clique no menu de <strong>três pontos</strong> no canto superior direito e selecione <strong>"Salvar e compartilhar"</strong> &gt; <strong>"Instalar SerenaPsi"</strong>.</li>
                    <li>Confirme a instalação para criar o atalho direto na sua área de trabalho.</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-2xl text-xs transition cursor-pointer text-center shadow"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
