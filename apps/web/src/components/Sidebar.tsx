import {
  BrainCircuit,
  BookOpen,
  Calendar,
  DollarSign,
  FileText,
  LogOut,
  Settings,
  Sparkles,
  Users,
  Menu,
  X,
} from "lucide-react";
import { LogoIcon } from "./Logo";

export type TabId =
  | "meudia"
  | "pacientes"
  | "agenda"
  | "financeiro"
  | "documentos"
  | "supervisor"
  | "conhecimento"
  | "configuracoes"
  | "ia";

interface SidebarProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  clinicalAccess: boolean;
}

const ALL_ITEMS: { id: TabId; label: string; icon: typeof Calendar; clinical?: boolean }[] = [
  { id: "meudia", label: "Meu dia", icon: Calendar },
  { id: "pacientes", label: "Pacientes", icon: Users },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "supervisor", label: "Supervisor IA", icon: BrainCircuit, clinical: true },
  { id: "conhecimento", label: "Conhecimento", icon: BookOpen, clinical: true },
  { id: "ia", label: "Uso de IA", icon: Sparkles, clinical: true },
  { id: "configuracoes", label: "Configuração", icon: Settings },
];

export default function Sidebar({
  currentTab,
  setCurrentTab,
  userName,
  roleLabel,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
  clinicalAccess,
}: SidebarProps) {
  const menuItems = ALL_ITEMS.filter((i) => !i.clinical || clinicalAccess);

  const Nav = (
    <div className="flex h-full flex-col bg-emerald-900 text-emerald-50">
      <div className="flex items-center gap-3 px-5 py-6">
        <LogoIcon size={40} className="rounded-xl" />
        <div>
          <div className="font-serif text-xl tracking-tight">SerenaPsi</div>
          <div className="text-xs text-emerald-200/80">Consultório com serenidade</div>
        </div>
        <button
          className="ml-auto md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setIsMobileOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-emerald-50/15 font-semibold text-white"
                  : "text-emerald-100/85 hover:bg-emerald-50/10"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-emerald-800 px-5 py-4">
        <div className="truncate text-sm font-medium">{userName}</div>
        <div className="mb-3 text-xs text-emerald-200/80">{roleLabel}</div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-emerald-900 text-white">
        <div className="flex items-center gap-2">
          <LogoIcon size={32} />
          <span className="font-serif text-lg">SerenaPsi</span>
        </div>
        <button onClick={() => setIsMobileOpen(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      </div>

      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col">
        {Nav}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">{Nav}</div>
        </div>
      )}
    </>
  );
}
