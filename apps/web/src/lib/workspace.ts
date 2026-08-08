/**
 * Camada de dados SerenaPsi — substitui Google Drive/Sheets/Calendar/Gmail.
 * Todas as operações passam pela API FastAPI multi-tenant.
 */
import { apiJson } from "./api";

export type ConsentType =
  | "data_processing"
  | "digital_resources"
  | "transcription"
  | "ai_processing"
  | "telehealth";

export interface Patient {
  id: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  internal_code?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_display_name?: string;
  starts_at: string;
  ends_at?: string;
  duration_minutes?: number;
  modality?: string;
  status?: string;
  confirmation_status?: string;
  version?: number;
}

export interface SessionRecord {
  id: string;
  patient_id: string;
  patient_display_name?: string;
  status?: string;
  focus?: string | null;
  observations?: string | null;
  started_at?: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  kind?: string;
  status?: string;
  priority?: number;
  patient_id?: string | null;
  deep_link?: string | null;
}

export interface DocItem {
  id: string;
  title: string;
  doc_type?: string;
  status?: string;
  body?: string;
  patient_id?: string | null;
}

/** Estrutura local — não cria pastas no Google Drive. */
export interface FolderStructure {
  mode: "api";
  label: string;
}

export async function setupAppWorkspace(): Promise<FolderStructure> {
  // Workspace = organização no PostgreSQL; nada a provisionar no Google.
  return { mode: "api", label: "SerenaPsi API" };
}

export async function getPatients(): Promise<Patient[]> {
  const data = await apiJson<{ items: Patient[] }>("/api/v1/patients");
  return data.items || [];
}

export async function createPatient(payload: {
  first_name: string;
  last_name: string;
  internal_code?: string;
  email?: string;
  phone?: string;
}): Promise<Patient> {
  return apiJson<Patient>("/api/v1/patients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getToday() {
  return apiJson<Record<string, unknown>>("/api/v1/today");
}

export async function getAppointments(startIso: string, endIso: string): Promise<Appointment[]> {
  const data = await apiJson<{ items: Appointment[] }>(
    `/api/v1/appointments?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
  );
  return data.items || [];
}

export async function createAppointment(payload: {
  patient_id: string;
  starts_at: string;
  duration_minutes?: number;
  modality?: string;
}): Promise<Appointment> {
  return apiJson<Appointment>("/api/v1/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rescheduleAppointment(
  id: string,
  startsAt: string,
  version?: number,
): Promise<Appointment> {
  return apiJson<Appointment>(`/api/v1/appointments/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ starts_at: startsAt, version }),
  });
}

export async function setAppointmentStatus(id: string, status: string): Promise<Appointment> {
  return apiJson<Appointment>(`/api/v1/appointments/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function startSession(patientId: string, appointmentId?: string): Promise<SessionRecord> {
  return apiJson<SessionRecord>("/api/v1/sessions/start", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      appointment_id: appointmentId,
    }),
  });
}

export async function getTasks(): Promise<TaskItem[]> {
  const data = await apiJson<{ items: TaskItem[] }>("/api/v1/tasks");
  return data.items || [];
}

export async function completeTask(id: string): Promise<TaskItem> {
  return apiJson<TaskItem>(`/api/v1/tasks/${id}/complete`, { method: "POST" });
}

export async function getDocuments(): Promise<DocItem[]> {
  const data = await apiJson<{ items: DocItem[] }>("/api/v1/documents");
  return data.items || [];
}

export async function getFinanceSummary() {
  return apiJson<Record<string, unknown>>("/api/v1/finance/summary");
}

export async function getFinanceCharges() {
  const data = await apiJson<{ items: unknown[] }>("/api/v1/finance/charges");
  return data.items || [];
}

export async function runSupervisor(payload: {
  mode: string;
  patient_id: string;
}): Promise<Record<string, unknown>> {
  return apiJson("/api/v1/supervisor/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAiUsage(days = 30) {
  return apiJson<Record<string, unknown>>(`/api/v1/ai/usage?days=${days}`);
}

export async function getConfirmationMessage(appointmentId: string) {
  return apiJson<{ message: string }>(
    `/api/v1/appointments/${appointmentId}/confirmation-message`,
  );
}

/** Substitui Gmail: copia mensagem para a profissional enviar pelo canal que preferir. */
export async function prepareConfirmationCopy(appointmentId: string): Promise<string> {
  const data = await getConfirmationMessage(appointmentId);
  return data.message || "";
}

/** Meet/Google Calendar removidos — teleconsulta usa link livre no futuro. */
export async function createMeetingLink(): Promise<{ meet_link?: string; note: string }> {
  return {
    note: "Videoconferência não depende mais do Google Meet. Informe o link da plataforma que você usa.",
  };
}

export async function addAuditLog(_log: {
  acao: string;
  detalhes?: string;
}): Promise<void> {
  // Auditoria é gravada no servidor nas operações de domínio.
}
