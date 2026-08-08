import { getAccessToken, logoutFromApp } from "./auth";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

/**
 * Fetch autenticado contra a SerenaPsi API (JWT).
 * Sem Firebase e sem Google Workspace.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${apiBase()}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    await logoutFromApp();
    window.location.reload();
  }

  return response;
}

export async function apiJson<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string; detail?: string }).message ||
      (typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null) ||
      "Falha na requisição.";
    throw new Error(message);
  }
  return data as T;
}
