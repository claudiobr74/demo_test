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
  events?: string | null;
  interventions?: string | null;
  responses?: string | null;
  hypotheses?: string | null;
  tasks?: string | null;
  agreements?: string | null;
  planning?: string | null;
  started_at?: string | null;
  version?: number;
  appointment_id?: string | null;
}

export interface DocTemplate {
  id: string;
  name: string;
  doc_type?: string;
  body_template?: string;
}

export interface ChargeItem {
  id: string;
  patient_id?: string;
  amount: string | number;
  status: string;
  description?: string | null;
  origin?: string;
  due_date?: string | null;
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

export async function getSession(sessionId: string): Promise<SessionRecord> {
  return apiJson<SessionRecord>(`/api/v1/sessions/${sessionId}`);
}

export async function autosaveSession(
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<{ version: number; autosave_at?: string }> {
  return apiJson(`/api/v1/sessions/${sessionId}/autosave`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function closeSession(sessionId: string, finalizeRecord = true) {
  return apiJson<Record<string, unknown>>(`/api/v1/sessions/${sessionId}/close`, {
    method: "POST",
    body: JSON.stringify({ finalize_record: finalizeRecord }),
  });
}

export async function deferSessionClosure(sessionId: string) {
  return apiJson(`/api/v1/sessions/${sessionId}/defer-closure`, { method: "POST" });
}

export async function prepareSessionContext(patientId: string) {
  return apiJson<Record<string, unknown>>(`/api/v1/sessions/prepare/${patientId}`);
}

export async function getPatient(patientId: string): Promise<Patient> {
  return apiJson<Patient>(`/api/v1/patients/${patientId}`);
}

export async function getCaseMemory(patientId: string) {
  const data = await apiJson<{ items: Record<string, unknown>[] }>(
    `/api/v1/case-memory/patients/${patientId}`,
  );
  return data.items || [];
}

export async function addCaseMemory(
  patientId: string,
  payload: { kind: string; content: string; provenance?: Record<string, unknown>[] },
) {
  return apiJson(`/api/v1/case-memory/patients/${patientId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acceptCaseMemory(entryId: string) {
  return apiJson(`/api/v1/case-memory/${entryId}/accept`, { method: "POST" });
}

export async function getPatientConsents(patientId: string) {
  const data = await apiJson<{ items: Record<string, unknown>[] }>(
    `/api/v1/consents/patients/${patientId}`,
  );
  return data.items || [];
}

export async function requestConsent(patientId: string, consentType: string) {
  return apiJson(`/api/v1/consents/patients/${patientId}`, {
    method: "POST",
    body: JSON.stringify({ consent_type: consentType }),
  });
}

export async function decideConsent(consentId: string, status: "accepted" | "refused") {
  return apiJson(`/api/v1/consents/${consentId}/decision`, {
    method: "POST",
    body: JSON.stringify({ status, method: "manual" }),
  });
}

export async function getClinicalRecords(patientId: string) {
  const data = await apiJson<{ items: Record<string, unknown>[] }>(
    `/api/v1/clinical-records/patients/${patientId}`,
  );
  return data.items || [];
}

export async function getDocumentTemplates(): Promise<DocTemplate[]> {
  const data = await apiJson<{ items: DocTemplate[] }>("/api/v1/documents/templates");
  return data.items || [];
}

export async function createDocument(payload: {
  patient_id?: string;
  template_id?: string;
  title?: string;
  body?: string;
}) {
  return apiJson<DocItem>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function finalizeDocument(documentId: string) {
  return apiJson(`/api/v1/documents/${documentId}/finalize`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}

export async function exportDocument(documentId: string, format: "txt" | "html" | "pdf" = "html") {
  return apiJson<{ content: string; filename?: string; print_hint?: string }>(
    `/api/v1/documents/${documentId}/export?format=${format}`,
  );
}

export async function createCharge(payload: {
  patient_id: string;
  amount: number | string;
  description?: string;
  origin?: string;
}) {
  return apiJson<ChargeItem>("/api/v1/finance/charges", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerPayment(payload: {
  charge_id: string;
  amount: number | string;
  method?: string;
  notes?: string;
}) {
  return apiJson("/api/v1/finance/payments", {
    method: "POST",
    body: JSON.stringify(payload),
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
