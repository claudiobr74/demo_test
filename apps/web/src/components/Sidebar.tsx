import React from "react";
import {
  BrainCircuit,
  BookOpen,
  Calendar,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Info,
  Laptop,
  LogOut,
  Menu,
  Settings,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { LogoIcon } from "./Logo";

/** IDs e rótulos idênticos ao menu do projeto React original. */
export type TabId =
  | "meudia"
  | "pacientes"
  | "agenda"
  | "financeiro"
  | "documentos"
  | "supervisor"
  | "notebooklm"
  | "configuracoes";

interface SidebarProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
  userName: string;
  roleLabel: string;
  roleKey: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const FULL_MENU: { id: TabId; label: string; icon: typeof Calendar }[] = [
  { id: "meudia", label: "Meu dia", icon: Calendar },
  { id: "pacientes", label: "Pacientes", icon: Users },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "supervisor", label: "Supervisor IA", icon: BrainCircuit },
  { id: "notebooklm", label: "Conhecimento & NotebookLM", icon: BookOpen },
  { id: "configuracoes", label: "Configuração & Backup", icon: Settings },
];

const SECRETARY_MENU = FULL_MENU.filter((i) =>
  ["meudia", "pacientes", "agenda", "financeiro"].includes(i.id),
);

export default function Sidebar({
  currentTab,
  setCurrentTab,
  userName,
  roleLabel,
  roleKey,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<Event | null>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState(true);
  const [isInstallModalOpen, setIsInstallModalOpen] = React.useState(false);
  const [activeInstructionTab, setActiveInstructionTab] = React.useState<"ios" | "android" | "desktop">(
    "ios",
  );

  const isIframe = React.useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
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
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const menuItems = roleKey === "secretary" ? SECRETARY_MENU : FULL_MENU;

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt as
      | (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> })
      | null;
    if (promptEvent && !isIframe) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const handleTabClick = (tabId: TabId) => {
    setCurrentTab(tabId);
    setIsMobileOpen(false);
  };

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-emerald-900 text-white border-b border-emerald-800">
        <div className="flex items-center space-x-2">
          <LogoIcon size={32} className="rounded-lg shadow-sm" />
          <span className="font-sans font-semibold text-lg tracking-tight">SerenaPsi</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1 hover:bg-emerald-800 rounded transition"
          id="mobile-menu-toggle"
          aria-label="Menu"
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-emerald-900 text-emerald-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:flex md:flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="app-sidebar"
      >
        <div className="p-6 border-b border-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <LogoIcon size={40} className="rounded-xl shadow-md" />
            <div>
              <h1 className="font-sans font-bold text-xl tracking-tight leading-none text-white">
                SerenaPsi
              </h1>
              <span className="text-[10px] text-emerald-300 font-mono tracking-wider">
                GESTÃO INTEGRADA
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden text-emerald-200 hover:text-white"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 mx-4 my-3 bg-emerald-950/40 rounded-xl border border-emerald-800/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700/60 border-2 border-emerald-500/50 flex items-center justify-center text-sm font-semibold">
              {userName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase() || "SP"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[11px] text-emerald-300 flex items-center space-x-1 font-sans">
                <UserCheck size={10} className="text-emerald-400" />
                <span>{roleLabel}</span>
              </p>
            </div>
          </div>
        </div>

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
                <span className="text-left">{item.label}</span>
                {item.id === "supervisor" && (
                  <Sparkles size={12} className="ml-auto text-yellow-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {showInstallBtn && (
          <div className="px-4 py-2 border-t border-emerald-800/40">
            <button
              onClick={() => void handleInstallClick()}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm bg-emerald-800 hover:bg-emerald-700 text-white font-medium transition-all duration-150 shadow-inner cursor-pointer"
              id="pwa-install-btn"
            >
              <Download size={18} className="text-emerald-300 animate-bounce" />
              <span>Instalar Aplicativo</span>
            </button>
          </div>
        )}

        <div className="p-4 border-t border-emerald-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-emerald-300 hover:bg-red-950/40 hover:text-red-200 transition-all duration-150"
            id="sidebar-logout-btn"
          >
            <LogOut size={18} className="text-emerald-400" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {isInstallModalOpen && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 animate-scale-up space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-50">
              <div className="flex items-center space-x-2">
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

            {isIframe && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
                <div className="flex items-start space-x-2.5">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-amber-900">Abra o app em uma nova aba</h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Em modo de visualização (iframe), a instalação direta pode ser bloqueada.
                    </p>
                  </div>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm"
                >
                  <span>Abrir em Nova Aba</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            )}

            <div className="flex border border-emerald-100 rounded-xl p-1 bg-emerald-50/50">
              {(
                [
                  ["ios", "iOS", Smartphone],
                  ["android", "Android", Smartphone],
                  ["desktop", "Desktop", Laptop],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setActiveInstructionTab(id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    activeInstructionTab === id
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-emerald-800 hover:bg-emerald-100/50"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs text-emerald-900 leading-relaxed space-y-2">
              {activeInstructionTab === "ios" && (
                <p>No Safari: Compartilhar → Adicionar à Tela de Início.</p>
              )}
              {activeInstructionTab === "android" && (
                <p>No Chrome: menu ⋮ → Instalar app / Adicionar à tela inicial.</p>
              )}
              {activeInstructionTab === "desktop" && (
                <p>No Chrome/Edge: ícone de instalação na barra de endereço ou menu → Instalar SerenaPsi.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
