import type { TabId } from "../components/Sidebar";

export type NavTarget =
  | { type: "tab"; tab: TabId }
  | { type: "session"; sessionId: string }
  | { type: "patient"; patientId: string; focus?: "prontuario" | "formulacao" | "hub" };

const TAB_PATHS: Record<string, TabId> = {
  "/meudia": "meudia",
  "/pacientes": "pacientes",
  "/agenda": "agenda",
  "/financeiro": "financeiro",
  "/documentos": "documentos",
  "/supervisor": "supervisor",
  "/notebooklm": "notebooklm",
  "/conhecimento": "notebooklm",
  "/configuracoes": "configuracoes",
};

/** Interpreta deep_links da API (`/sessoes/:id`, `/pacientes/:id/...`, `/financeiro`). */
export function parseDeepLink(link: string | null | undefined): NavTarget | null {
  if (!link) return null;
  const raw = link.trim();
  if (!raw) return null;
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  const [pathPart] = withoutHash.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;

  const sessionMatch = path.match(/^\/sessoes\/([^/]+)\/?$/);
  if (sessionMatch) return { type: "session", sessionId: sessionMatch[1] };

  const patientFocus = path.match(/^\/pacientes\/([^/]+)\/(prontuario|formulacao)\/?$/);
  if (patientFocus) {
    return {
      type: "patient",
      patientId: patientFocus[1],
      focus: patientFocus[2] as "prontuario" | "formulacao",
    };
  }

  const patientMatch = path.match(/^\/pacientes\/([^/]+)\/?$/);
  if (patientMatch) return { type: "patient", patientId: patientMatch[1], focus: "hub" };

  const tab = TAB_PATHS[path.replace(/\/$/, "") || "/"];
  if (tab) return { type: "tab", tab };

  return null;
}

export function toHash(target: NavTarget): string {
  switch (target.type) {
    case "session":
      return `#/sessoes/${target.sessionId}`;
    case "patient":
      return target.focus && target.focus !== "hub"
        ? `#/pacientes/${target.patientId}/${target.focus}`
        : `#/pacientes/${target.patientId}`;
    case "tab":
      return `#/${target.tab === "notebooklm" ? "notebooklm" : target.tab}`;
  }
}

export function navigateDeepLink(link: string | null | undefined): boolean {
  const target = parseDeepLink(link);
  if (!target) return false;
  const hash = toHash(target);
  window.location.hash = hash.startsWith("#") ? hash.slice(1) : hash;
  // hashchange may not fire if identical — callers should also apply target.
  return true;
}

export function currentHashTarget(): NavTarget | null {
  try {
    return parseDeepLink(window.location.hash || "");
  } catch {
    return null;
  }
}
