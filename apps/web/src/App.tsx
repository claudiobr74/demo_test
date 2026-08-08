import { Suspense, lazy, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  canAccessClinical,
  getAccessToken,
  getStoredUser,
  loginWithPassword,
  logoutFromApp,
  mapRoleLabel,
  type SerenaUser,
} from "./lib/auth";
import { setupAppWorkspace } from "./lib/workspace";
import { currentHashTarget, parseDeepLink, toHash, type NavTarget } from "./lib/navigation";
import Sidebar, { type TabId } from "./components/Sidebar";
import { FullLogo } from "./components/Logo";

const MyDayPage = lazy(() => import("./pages/MyDayPage"));
const PatientsPage = lazy(() => import("./pages/PatientsPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const FinancePage = lazy(() => import("./pages/FinancePage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const SupervisorPage = lazy(() => import("./pages/SupervisorPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SessionPage = lazy(() => import("./pages/SessionPage"));
const PatientHubPage = lazy(() => import("./pages/PatientHubPage"));

export default function App() {
  const initialUser = getStoredUser();
  const hasToken = Boolean(getAccessToken());
  const [user, setUser] = useState<SerenaUser | null>(hasToken ? initialUser : null);
  const [tab, setTab] = useState<TabId>("meudia");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [hubFocus, setHubFocus] = useState<"prontuario" | "formulacao" | "hub" | undefined>();
  const [hubRecordId, setHubRecordId] = useState<string | null>(null);
  const [supervisorPatientId, setSupervisorPatientId] = useState<string | null>(null);
  const [email, setEmail] = useState("dra.marina@serenapsi.dev");
  const [password, setPassword] = useState("SerenaPsi!dev1");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const applyNav = (target: NavTarget) => {
    if (target.type === "session") {
      setPatientId(null);
      setSessionId(target.sessionId);
      return;
    }
    if (target.type === "patient") {
      setSessionId(null);
      setPatientId(target.patientId);
      setHubFocus(target.focus || "hub");
      setHubRecordId(target.recordId || null);
      setTab("pacientes");
      return;
    }
    setSessionId(null);
    setPatientId(null);
    setHubFocus(undefined);
    setHubRecordId(null);
    setTab(target.tab);
  };

  const goDeepLink = (link: string | null | undefined) => {
    const target = parseDeepLink(link);
    if (!target) return;
    const hash = toHash(target);
    const next = hash.startsWith("#") ? hash.slice(1) : hash;
    if (window.location.hash.replace(/^#/, "") !== next) {
      window.location.hash = next;
    }
    applyNav(target);
  };

  useEffect(() => {
    if (!user) return;
    const fromHash = currentHashTarget();
    if (fromHash) applyNav(fromHash);
    const onHash = () => {
      const t = currentHashTarget();
      if (t) applyNav(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [user?.id]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore SW failures in dev */
    });
  }, []);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white/80 p-8 shadow-lg"
        >
          <FullLogo />
          <h1 className="mt-4 text-center font-serif text-2xl text-emerald-950">
            Entrar no consultório
          </h1>
          <p className="mt-2 text-center text-sm text-emerald-800/75">
            Autenticação própria SerenaPsi — sem Google Login.
          </p>
          <form
            className="mt-6 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoggingIn(true);
              setLoginError(null);
              try {
                const result = await loginWithPassword(email.trim(), password, keepSignedIn);
                await setupAppWorkspace();
                setUser(result.user);
              } catch (err) {
                setLoginError(err instanceof Error ? err.message : "Falha no login");
              } finally {
                setLoggingIn(false);
              }
            }}
          >
            <label className="block text-sm">
              E-mail
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              Senha
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-emerald-900">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
              />
              Manter conectada neste dispositivo
            </label>
            {loginError && <p className="text-sm text-red-700">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-emerald-800 py-2.5 text-white disabled:opacity-60"
            >
              {loggingIn ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (sessionId) {
    return (
      <Suspense fallback={<p className="p-8">Carregando sessão…</p>}>
        <SessionPage
          sessionId={sessionId}
          onClose={() => {
            setSessionId(null);
            window.location.hash = "meudia";
          }}
        />
      </Suspense>
    );
  }

  if (patientId) {
    return (
      <Suspense fallback={<p className="p-8">Carregando paciente…</p>}>
        <PatientHubPage
          patientId={patientId}
          clinicalAccess={canAccessClinical(user.role_key, user.permissions || [])}
          initialFocus={hubFocus}
          initialRecordId={hubRecordId || undefined}
          onClose={() => {
            setPatientId(null);
            setHubFocus(undefined);
            setHubRecordId(null);
            window.location.hash = "pacientes";
          }}
          onOpenSession={(id) => {
            setPatientId(null);
            setHubFocus(undefined);
            setHubRecordId(null);
            setSessionId(id);
            window.location.hash = `sessoes/${id}`;
          }}
          onNavigateDeepLink={goDeepLink}
        />
      </Suspense>
    );
  }

  const clinicalAccess = canAccessClinical(user.role_key, user.permissions || []);

  const content = (() => {
    switch (tab) {
      case "meudia":
        return (
          <MyDayPage
            clinicalAccess={clinicalAccess}
            onOpenSession={(id) => {
              setSessionId(id);
              window.location.hash = `sessoes/${id}`;
            }}
            onNavigateDeepLink={goDeepLink}
            onPreparePatient={
              clinicalAccess
                ? (id) => {
                    setSupervisorPatientId(id);
                    setTab("supervisor");
                    window.location.hash = "supervisor";
                  }
                : undefined
            }
          />
        );
      case "pacientes":
        return (
          <PatientsPage
            clinicalAccess={clinicalAccess}
            onOpenPatient={(id) => {
              setPatientId(id);
              window.location.hash = `pacientes/${id}`;
            }}
          />
        );
      case "agenda":
        return <AgendaPage />;
      case "financeiro":
        return <FinancePage />;
      case "documentos":
        return clinicalAccess ? (
          <DocumentsPage />
        ) : (
          <p className="text-emerald-800">Documentos clínicos não estão disponíveis para secretaria.</p>
        );
      case "supervisor":
        return clinicalAccess ? (
          <SupervisorPage initialPatientId={supervisorPatientId || undefined} />
        ) : (
          <p className="text-emerald-800">Supervisor IA requer perfil clínico.</p>
        );
      case "notebooklm":
        return clinicalAccess ? (
          <KnowledgePage />
        ) : (
          <p className="text-emerald-800">Conhecimento clínico requer perfil clínico.</p>
        );
      case "configuracoes":
        return (
          <SettingsPage
            user={user}
            onUserUpdated={(next) => setUser(next)}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar
        currentTab={tab}
        setCurrentTab={(next) => {
          setTab(next);
          window.location.hash = next;
        }}
        userName={user.full_name}
        roleLabel={mapRoleLabel(user.role_key)}
        roleKey={user.role_key}
        onLogout={async () => {
          await logoutFromApp();
          setUser(null);
        }}
        isMobileOpen={mobileOpen}
        setIsMobileOpen={setMobileOpen}
      />
      <main className="px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={<p className="text-emerald-800/70">Carregando…</p>}>{content}</Suspense>
      </main>
    </div>
  );
}
