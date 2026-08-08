/**
 * Cadernos clínicos locais — substitui Google NotebookLM / Drive.
 * Persistência em localStorage por organização.
 */
import { generateUUID } from "./uuid";

export type LocalNotebook = {
  id: string;
  title: string;
  kind: "paciente" | "personalizado" | "biblioteca";
  patient_id?: string | null;
  notes: string;
  updated_at: string;
};

export type QuickGuide = {
  id: string;
  category: string;
  title: string;
  definition: string;
  signs: string;
  questions: string;
  interventions: string;
};

const STORAGE_PREFIX = "serenapsi_local_notebooks:";

function key(organizationId: string) {
  return `${STORAGE_PREFIX}${organizationId}`;
}

export function listNotebooks(organizationId: string): LocalNotebook[] {
  try {
    const raw = localStorage.getItem(key(organizationId));
    if (!raw) return [];
    return JSON.parse(raw) as LocalNotebook[];
  } catch {
    return [];
  }
}

function persist(organizationId: string, items: LocalNotebook[]) {
  localStorage.setItem(key(organizationId), JSON.stringify(items));
}

export function createNotebook(
  organizationId: string,
  input: { title: string; kind?: LocalNotebook["kind"]; patient_id?: string; notes?: string },
): LocalNotebook {
  const items = listNotebooks(organizationId);
  const notebook: LocalNotebook = {
    id: generateUUID(),
    title: input.title.trim(),
    kind: input.kind || "personalizado",
    patient_id: input.patient_id || null,
    notes: input.notes || "",
    updated_at: new Date().toISOString(),
  };
  persist(organizationId, [notebook, ...items]);
  return notebook;
}

export function updateNotebook(
  organizationId: string,
  id: string,
  patch: Partial<Pick<LocalNotebook, "title" | "notes" | "patient_id" | "kind">>,
): LocalNotebook | null {
  const items = listNotebooks(organizationId);
  const idx = items.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  const next = {
    ...items[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  items[idx] = next;
  persist(organizationId, items);
  return next;
}

export function deleteNotebook(organizationId: string, id: string): void {
  persist(
    organizationId,
    listNotebooks(organizationId).filter((n) => n.id !== id),
  );
}

/** Guias rápidos embutidos (biblioteca clínica estática — sem Google). */
export const QUICK_GUIDES: QuickGuide[] = [
  {
    id: "eid_abandono",
    category: "Esquemas Iniciais Desadaptativos",
    title: "Abandono / Instabilidade",
    definition:
      "Crença de que os outros são instáveis, não confiáveis ou que vão abandonar o paciente a qualquer momento.",
    signs: "Apego ansioso, hipervigilância a rejeição, medo de ficar sozinho.",
    questions:
      "Quais evidências reais apoiam o afastamento? Você já sobreviveu a separações sem que isso destruísse sua vida?",
    interventions:
      "Fortalecer Adulto Saudável; questionar pensamentos catastróficos; cartões de enfrentamento.",
  },
  {
    id: "eid_desconfianca",
    category: "Esquemas Iniciais Desadaptativos",
    title: "Desconfiança / Abuso",
    definition:
      "Expectativa de que os outros vão intencionalmente magoar, enganar ou tirar vantagem.",
    signs: "Postura defensiva, dificuldade em se abrir, testar a confiança dos outros.",
    questions:
      "Há indícios claros de desonestidade ou está aplicando uma lente do passado?",
    interventions:
      "Confrontação empática; experimentos graduais de confiança; imagens de reparentalização.",
  },
  {
    id: "eid_defectibilidade",
    category: "Esquemas Iniciais Desadaptativos",
    title: "Defectibilidade / Vergonha",
    definition:
      "Sentimento intrínseco de ser falho, indesejado ou inferior em aspectos importantes.",
    signs: "Sensibilidade a críticas, comparação social, esconder falhas percebidas.",
    questions:
      "Que defeitos específicos anulariam todo o seu valor? Isso é fato ou eco de vozes punitivas?",
    interventions:
      "Trabalho com crítico interno; reestruturação cognitiva; validação de autoestima.",
  },
  {
    id: "dominio_desconexao",
    category: "Domínios Esquemáticos",
    title: "Domínio I: Desconexão e Rejeição",
    definition:
      "Expectativa de que necessidades de segurança, cuidado e aceitação não serão satisfeitas.",
    signs: "Dificuldade em vínculos íntimos; solidão; receio de rejeição.",
    questions:
      "Suas relações atuais repetem a dinâmica familiar ou as lentes estão distorcendo o afeto?",
    interventions:
      "Reparentalização limitada; segurança do vínculo; mapear suporte seguro atual.",
  },
];
