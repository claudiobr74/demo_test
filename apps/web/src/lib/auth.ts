/**
 * Auth JWT próprio da SerenaPsi — sem Firebase / Google OAuth.
 */

const TOKEN_KEY = "serenapsi_access_token";
const USER_KEY = "serenapsi_user";

export type SerenaUser = {
  id: string;
  email: string;
  full_name: string;
  organization_id: string;
  organization_name?: string;
  role_key: string;
  permissions: string[];
};

export type LoginResult = {
  access_token: string;
  token_type: string;
  user: SerenaUser;
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): SerenaUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SerenaUser) : null;
  } catch {
    return null;
  }
}

function persist(result: LoginResult, keepSignedIn: boolean) {
  const store = keepSignedIn ? localStorage : sessionStorage;
  const other = keepSignedIn ? sessionStorage : localStorage;
  store.setItem(TOKEN_KEY, result.access_token);
  store.setItem(USER_KEY, JSON.stringify(result.user));
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

export async function loginWithPassword(
  email: string,
  password: string,
  keepSignedIn = true,
): Promise<LoginResult> {
  const res = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.detail || "Falha no login.");
  }
  const user: SerenaUser = {
    id: data.user?.id,
    email: data.user?.email || email,
    full_name: data.user?.full_name || email,
    organization_id: data.organization?.id,
    organization_name: data.organization?.name,
    role_key: data.membership?.role_key || "psychologist",
    permissions: data.membership?.permissions || [],
  };
  const result = {
    access_token: data.access_token as string,
    token_type: data.token_type || "bearer",
    user,
  };
  persist(result, keepSignedIn);
  return result;
}

export async function logoutFromApp(): Promise<void> {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function mapRoleLabel(roleKey: string): string {
  switch (roleKey) {
    case "owner":
    case "psychologist_admin":
      return "Psicóloga administradora";
    case "secretary":
      return "Secretaria";
    case "org_admin":
      return "Admin da organização";
    default:
      return "Psicóloga";
  }
}

export function canAccessClinical(roleKey: string, permissions: string[]): boolean {
  if (roleKey === "secretary") return false;
  return (
    permissions.includes("clinical_record.read") ||
    permissions.includes("ai_supervision.use") ||
    roleKey === "owner" ||
    roleKey === "psychologist"
  );
}
