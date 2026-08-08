/**
 * Camada de dados SerenaPsi — substitui Google Drive/Sheets/Calendar/Gmail.
 * Todas as operações passam pela API FastAPI multi-tenant.
 */
import { apiFetch, apiJson } from "./api";

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
  session_fee?: string | number | null;
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
  structured_data?: Record<string, unknown> | null;
  started_at?: string | null;
  version?: number;
  appointment_id?: string | null;
}

/** Proposta revisável no modelo de prontuário CFP (não é ClinicalRecord finalizado). */
export interface CfpProposal {
  focus?: string | null;
  evolution?: string | null;
  relevant_observations?: string | null;
  interventions?: string | null;
  tasks?: string | null;
  planning?: string | null;
  agreements?: string | null;
  mode?: string | null;
  epistemology_note?: string | null;
  status?: string | null;
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
  session_fee?: number | string;
}): Promise<Patient> {
  return apiJson<Patient>("/api/v1/patients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePatient(
  patientId: string,
  payload: {
    first_name?: string;
    last_name?: string;
    preferred_name?: string;
    email?: string | null;
    phone?: string | null;
    session_fee?: number | string | null;
    status?: string;
    version?: number;
  },
): Promise<Patient> {
  return apiJson<Patient>(`/api/v1/patients/${patientId}`, {
    method: "PATCH",
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
  recurrence_frequency?: "none" | "weekly" | "biweekly";
  recurrence_count?: number;
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
  return apiJson<{
    id?: string;
    charge?: {
      id: string;
      amount: string;
      status: string;
      description?: string | null;
      patient_display_name?: string | null;
    } | null;
    package?: {
      id: string;
      remaining_sessions?: number;
      total_sessions?: number;
      used_sessions?: number;
    } | null;
    clinical_record?: { id: string; status: string } | null;
  }>(`/api/v1/sessions/${sessionId}/close`, {
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

export async function checkConsent(patientId: string, consentType: ConsentType | string) {
  return apiJson<{
    allowed: boolean;
    consent_type: string;
    status?: string | null;
    reason?: string | null;
    consent_id?: string;
  }>(`/api/v1/consents/patients/${patientId}/check?type=${encodeURIComponent(consentType)}`);
}

export async function proposeSessionTranscription(
  sessionId: string,
  payload: {
    audio_base64?: string;
    mime_type?: string;
    transcript_text?: string;
  },
) {
  return apiJson<{
    session_id: string;
    version: number;
    proposal: CfpProposal;
    transcript: string;
    stt?: {
      mode?: string | null;
      provider?: string | null;
      model?: string | null;
      fallback_reason?: string | null;
    };
    applied_to_record: boolean;
    note?: string;
  }>(`/api/v1/sessions/${sessionId}/transcription/propose`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function applySessionTranscription(
  sessionId: string,
  payload: CfpProposal & { store_transcript?: boolean; version?: number },
) {
  return apiJson<SessionRecord & { applied_to_record?: boolean; note?: string }>(
    `/api/v1/sessions/${sessionId}/transcription/apply`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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

export async function updateDocument(
  documentId: string,
  payload: { title?: string; body?: string },
): Promise<DocItem> {
  return apiJson<DocItem>(`/api/v1/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function finalizeDocument(documentId: string) {
  return apiJson(`/api/v1/documents/${documentId}/finalize`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}

export async function enqueueConfirmation(appointmentId: string, channel = "whatsapp") {
  return apiJson(`/api/v1/confirmations/appointments/${appointmentId}/enqueue`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
}

export interface ConfirmationQueueItem {
  id: string;
  channel?: string;
  title?: string;
  body?: string;
  status?: string;
  appointment_id?: string;
  patient_id?: string;
  delivery?: string | null;
  created_at?: string | null;
  copied_at?: string | null;
  sent_at?: string | null;
}

export async function getConfirmationQueue(): Promise<ConfirmationQueueItem[]> {
  const data = await apiJson<{ items: ConfirmationQueueItem[] }>("/api/v1/confirmations/queue");
  return data.items || [];
}

export async function markConfirmationStatus(
  notificationId: string,
  status: "copied" | "sent" | "dismissed",
) {
  return apiJson(`/api/v1/confirmations/queue/${notificationId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export interface HypothesisItem {
  id: string;
  statement: string;
  strength?: string;
  epistemology?: string;
  created_by?: string;
  pending_review?: boolean;
  status?: string;
}

export async function getHypotheses(patientId: string): Promise<HypothesisItem[]> {
  const data = await apiJson<{ items: HypothesisItem[] }>(
    `/api/v1/hypotheses/patients/${patientId}`,
  );
  return data.items || [];
}

export async function createHypothesis(patientId: string, statement: string) {
  return apiJson<HypothesisItem>(`/api/v1/hypotheses/patients/${patientId}`, {
    method: "POST",
    body: JSON.stringify({ statement }),
  });
}

export async function acceptHypothesis(id: string) {
  return apiJson<HypothesisItem>(`/api/v1/hypotheses/${id}/accept`, { method: "POST" });
}

export async function updateHypothesisStrength(
  id: string,
  strength: "active" | "strengthened" | "weakened" | "retired",
) {
  return apiJson<HypothesisItem>(`/api/v1/hypotheses/${id}/strength`, {
    method: "POST",
    body: JSON.stringify({ strength }),
  });
}

export async function exportDocument(documentId: string, format: "txt" | "html" | "pdf" = "html") {
  return apiJson<{
    content: string;
    filename?: string;
    print_hint?: string | null;
    format?: string;
    media_type?: string;
    encoding?: string | null;
    object_key?: string | null;
  }>(`/api/v1/documents/${documentId}/export?format=${format}`);
}

export async function downloadDocumentPdf(documentId: string) {
  const res = await apiFetch(`/api/v1/documents/${documentId}/export?format=pdf&download=true`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Falha ao baixar PDF");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || "documento.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename };
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

export async function createTask(payload: {
  title: string;
  kind?: string;
  patient_id?: string;
  priority?: number;
}): Promise<TaskItem> {
  return apiJson<TaskItem>("/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PackageItem {
  id: string;
  patient_id: string;
  patient_display_name?: string | null;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  price: string | number;
  valid_until?: string | null;
  status: string;
  charge?: { id: string; amount: string; status: string } | null;
}

export async function getPackages(patientId?: string): Promise<PackageItem[]> {
  const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  const data = await apiJson<{ items: PackageItem[] }>(`/api/v1/finance/packages${q}`);
  return data.items || [];
}

export async function createPackage(payload: {
  patient_id: string;
  total_sessions: number;
  price: number | string;
  valid_until?: string;
  create_charge?: boolean;
}): Promise<PackageItem> {
  return apiJson<PackageItem>("/api/v1/finance/packages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelPackage(id: string): Promise<PackageItem> {
  return apiJson<PackageItem>(`/api/v1/finance/packages/${id}/cancel`, { method: "POST" });
}

export async function getCurrentFormulation(patientId: string) {
  const data = await apiJson<{ formulation: Record<string, unknown> | null }>(
    `/api/v1/formulations/patients/${patientId}/current`,
  );
  return data.formulation;
}

export async function upsertFormulationDraft(
  patientId: string,
  payload: { framework?: string; body?: Record<string, unknown>; version?: number },
) {
  return apiJson(`/api/v1/formulations/patients/${patientId}/draft`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function promoteFormulation(formulationId: string) {
  return apiJson(`/api/v1/formulations/${formulationId}/promote`, { method: "POST" });
}

export async function getCurrentTreatmentPlan(patientId: string) {
  const data = await apiJson<{ plan: Record<string, unknown> | null }>(
    `/api/v1/treatment-plans/patients/${patientId}/current`,
  );
  return data.plan;
}

export async function upsertTreatmentPlan(
  patientId: string,
  payload: {
    priority_problems?: string[];
    initial_formulation_summary?: string;
    status?: string;
  },
) {
  return apiJson(`/api/v1/treatment-plans/patients/${patientId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function addTreatmentGoal(patientId: string, title: string) {
  return apiJson(`/api/v1/treatment-plans/patients/${patientId}/goals`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateTreatmentGoal(
  goalId: string,
  payload: { status?: string; title?: string },
) {
  return apiJson(`/api/v1/treatment-plans/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getDocuments(): Promise<DocItem[]> {
  const data = await apiJson<{ items: DocItem[] }>("/api/v1/documents");
  return data.items || [];
}

export interface ExpenseItem {
  id: string;
  vendor?: string | null;
  category: string;
  amount: string | number;
  due_date?: string | null;
  paid_at?: string | null;
  status: string;
  notes?: string | null;
}

export async function getFinanceSummary() {
  return apiJson<Record<string, unknown>>("/api/v1/finance/summary");
}

export async function getFinanceCharges() {
  const data = await apiJson<{ items: unknown[] }>("/api/v1/finance/charges");
  return data.items || [];
}

export async function getExpenses(): Promise<ExpenseItem[]> {
  const data = await apiJson<{ items: ExpenseItem[] }>("/api/v1/finance/expenses");
  return data.items || [];
}

export async function createExpense(payload: {
  category: string;
  amount: number | string;
  vendor?: string;
  due_date?: string;
  status?: string;
  notes?: string;
}): Promise<ExpenseItem> {
  return apiJson<ExpenseItem>("/api/v1/finance/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateExpense(
  id: string,
  payload: {
    category?: string;
    amount?: number | string;
    vendor?: string;
    due_date?: string;
    status?: string;
    notes?: string;
    mark_paid?: boolean;
  },
): Promise<ExpenseItem> {
  return apiJson<ExpenseItem>(`/api/v1/finance/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getProfile() {
  return apiJson<{
    user: Record<string, unknown>;
    organization: Record<string, unknown>;
    membership: Record<string, unknown>;
  }>("/api/v1/auth/me");
}

export async function updateProfile(payload: Record<string, unknown>) {
  return apiJson<{
    user: Record<string, unknown>;
    organization: Record<string, unknown>;
    membership: Record<string, unknown>;
  }>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Exportação local JSON — substitui backup para Google Drive/Sheets. */
export async function buildLocalBackupExport(): Promise<Record<string, unknown>> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [profile, patients, charges, expenses, appointments, tasks, documents, summary] =
    await Promise.all([
      getProfile(),
      getPatients(),
      getFinanceCharges(),
      getExpenses(),
      getAppointments(start.toISOString(), end.toISOString()),
      getTasks(),
      getDocuments(),
      getFinanceSummary(),
    ]);

  return {
    exported_at: new Date().toISOString(),
    source: "serenapsi-api",
    note: "Backup operacional local — sem Google Drive/Sheets.",
    profile,
    summary,
    patients,
    charges,
    expenses,
    appointments,
    tasks,
    documents,
  };
}

export async function runSupervisor(payload: {
  mode: string;
  patient_id: string;
  import_hypotheses?: boolean;
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
