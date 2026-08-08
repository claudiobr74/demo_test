import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { generateUUID } from "../lib/uuid";
import {
  BookOpen,
  Search,
  Sparkles,
  ChevronRight,
  HelpCircle,
  FileText,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Loader2,
  Check,
  X,
  FileCheck,
  FolderOpen,
  ArrowUpRight,
  CheckCircle,
  RefreshCw,
  Copy,
  UserCheck,
  UserX,
  Eye,
  AlertTriangle,
  ArrowLeft,
  Settings,
  Info,
  Layers,
  Database
} from "lucide-react";
import { getPatients, getSessions, findFileByName, Patient, Session } from "../lib/workspace";
import { googleFetch as fetch } from "../lib/googleFetch";

// --- TYPES & INTERFACES ---
interface NotebookProps {
  token: string | null;
  folders: {
    notebookLmId: string;
    spreadsheetId?: string;
    [key: string]: any;
  } | null;
}

interface NotebookConfig {
  notebookConfigId: string;
  tipo: "predefinido" | "paciente" | "personalizado";
  titulo: string;
  notebookUrl: string;
  driveFolderId: string;
  driveDocumentIds: string; // Comma-separated list of document IDs
  patientId?: string;
  data_ultima_geracao: string;
  data_ultima_modificacao: string;
  situacao: "Não configurado" | "Pronto para adicionar au NotebookLM" | "Fonte adicionada" | "Documento atualizado" | "Sincronização pendente" | "Arquivado";
  usuario_responsavel: string;
}

interface QuickGuideItem {
  id: string;
  category: string;
  title: string;
  definition: string;
  signs: string;
  examples: string;
  questions: string;
  interventions: string;
  materials: string;
}

// --- STATIC CLINICAL KNOWLEDGE LIBRARY (GUIAS RÁPIDOS) ---
const QUICK_GUIDES_DATABASE: QuickGuideItem[] = [
  {
    id: "eid_abandono",
    category: "Esquemas Iniciais Desadaptativos (EIDs)",
    title: "Abandono / Instabilidade",
    definition: "Crença de que os outros são instáveis, não confiáveis ou que vão falecer ou abandonar o paciente a qualquer momento.",
    signs: "Apego ansioso, ciúmes recorrentes, hipervigilância a sinais de rejeição ou afastamento, medo constante de ser deixado sozinho.",
    examples: "Pensamentos como: 'Se ela demorar a responder, é porque está perdendo o interesse' ou 'As pessoas que eu amo sempre vão embora no final'.",
    questions: "Quais evidências reais apoiam o afastamento dessa pessoa? Você já sobreviveu a separações no passado sem que isso destruísse sua vida?",
    interventions: "Fortalecimento do Adulto Saudável para acolher a Criança Vulnerável; questionamento cognitivo de pensamentos catastróficos; cartões de enfrentamento.",
    materials: "Diário de Relações Seguras, Cartão de Enfrentamento para Crises de Separação."
  },
  {
    id: "eid_desconfianca",
    category: "Esquemas Iniciais Desadaptativos (EIDs)",
    title: "Desconfiança / Abuso",
    definition: "Expectativa de que os outros vão intencionalmente magoar, enganar, humilhar, abusar ou tirar vantagem.",
    signs: "Postura defensiva constante, recusa em se abrir emocionalmente, testar as pessoas secretamente, agressividade preventiva.",
    examples: "Pensamentos como: 'Se eu contar isso, vão usar contra mim' ou 'Ele está sendo legal apenas porque quer alguma coisa'.",
    questions: "Essa pessoa deu indícios claros de desonestidade ou você está aplicando uma lente do passado sobre ela?",
    interventions: "Confrontação empática de comportamentos defensivos; experimentos comportamentais de confiança gradual; imagens mentais para reparentalização.",
    materials: "Tabela de Evidências de Confiabilidade Humana."
  },
  {
    id: "eid_privacao",
    category: "Esquemas Iniciais Desadaptativos (EIDs)",
    title: "Privação Emocional",
    definition: "Expectativa de que o desejo de apoio emocional (cuidado, afeto, empatia, proteção) não será adequadamente satisfeito pelos outros.",
    signs: "Não expressar necessidades emocionais, escolher parceiros emocionalmente indisponíveis, isolamento afetivo crônico, sensação de vazio e solidão profunda.",
    examples: "Pensamentos como: 'Ninguém realmente se importa comigo' ou 'Não vale a pena pedir carinho, nunca vou receber mesmo'.",
    questions: "Você expressa suas necessidades de forma clara ou espera que as pessoas adivinhem? Como podemos comunicar seus desejos sem cobrar agressivamente?",
    interventions: "Reparentalização limitada no vínculo terapêutico; psicoeducação sobre necessidades emocionais básicas; treino de assertividade emocional.",
    materials: "Guia de Comunicação de Necessidades Emocionais."
  },
  {
    id: "eid_defectibilidade",
    category: "Esquemas Iniciais Desadaptativos (EIDs)",
    title: "Defectibilidade / Vergonha",
    definition: "Sentimento intrínseco de ser falho, mau, indesejado, inferior ou inválido em aspectos importantes para si ou para os outros.",
    signs: "Sensibilidade extrema a críticas, vergonha corporal ou social, comparação social desfavorável crônica, busca constante por esconder falhas perceived.",
    examples: "Pensamentos como: 'Se eles descobrirem quem eu sou de verdade, vão me rejeitar' ou 'Não mereço ser amado'.",
    questions: "Que defeitos específicos você acha que tem que anulam todo o seu valor como pessoa humana? Isso é uma verdade factual ou um eco de vozes punitivas?",
    interventions: "Trabalho de cadeiras para confrontar o Crítico Interno Punitivo; reestruturação cognitiva de pensamentos de autodepreciação; imagens mentais reconfortantes.",
    materials: "Lista de Forças Pessoais e Validação de Autoestima."
  },
  {
    id: "eid_padroes_inflexiveis",
    category: "Esquemas Iniciais Desadaptativos (EIDs)",
    title: "Padrões Inflexíveis / Postura Crítica",
    definition: "Crença de que se deve atingir padrões extremamente elevados de comportamento ou desempenho, geralmente para evitar críticas.",
    signs: "Perfeccionismo paralisante, hiperfoco em regras, escassez de momentos de lazer, cobrança implacável consigo mesmo e com os outros.",
    examples: "Pensamentos como: 'Se eu cometer um erro, serei um fracasso completo' ou '99% não é bom o suficiente'.",
    questions: "Qual é o custo real físico e mental de manter essa exigência? O que aconteceria se você aceitasse um resultado bom o bastante?",
    interventions: "Reavaliação de custo-benefício de regras rígidas; experimentos de tolerância a pequenos erros; prescrição de tempo de lazer incondicional.",
    materials: "Planejamento de Lazer Semanal sem Metas."
  },
  {
    id: "dominio_desconexao",
    category: "Domínios Esquemáticos",
    title: "Domínio I: Desconexão e Rejeição",
    definition: "Expectativa de que as necessidades de segurança, estabilidade, cuidado, empatia e aceitação não serão satisfeitas de forma segura.",
    signs: "Famílias de origem frias, rejeitadoras, abusivas ou instáveis. Dificuldade em estabelecer relacionamentos íntimos e nutritivos.",
    examples: "Sentimento persistente de inadequação, solidão, inadequação social ou receio de rejeição em qualquer ambiente.",
    questions: "Suas relações atuais repetem a dinâmica familiar ou são as suas lentes que estão enxergando rejeição onde há carinho?",
    interventions: "Reparentalização limitada; focar na segurança do vínculo terapêutico; mapear conexões seguras no ambiente atual do paciente.",
    materials: "Mapeamento de Círculos de Suporte Seguro."
  },
  {
    id: "dominio_autonomia",
    category: "Domínios Esquemáticos",
    title: "Domínio II: Autonomia e Desempenho Prejudicados",
    definition: "Expectativas sobre si mesmo que minam a capacidade de funcionar de forma independente, sobreviver ou ter desempenho satisfatório.",
    signs: "Famílias superprotetoras ou negligentes que não incentivaram a autossuficiência. Medo de tomar decisões sozinho, dependência excessiva de aprovação.",
    examples: "Pensamentos como: 'Não consigo resolver isso sem pedir opinião' ou 'Vou falhar se tentar algo novo por conta própria'.",
    questions: "Quais pequenas tarefas diárias você pode tentar concluir de forma autônoma para testar sua capacidade?",
    interventions: "Treino de tomada de decisões; experimentos comportamentais de independência progressiva; questionamento de crenças de incompetência.",
    materials: "Diário de Pequenas Vitórias Autônomas."
  },
  {
    id: "modo_crianca_vulneravel",
    category: "Modos Esquemáticos",
    title: "Modo Criança Vulnerável",
    definition: "O estado emocional que sente e revive as dores da infância: solidão, abandono, medo, desamparo, tristeza e inadequação.",
    signs: "Choro desamparado, postura encolhida, sentimentos repentinos de pânico de abandono, sensação de que não há ninguém para defendê-la.",
    examples: "Expressões como: 'Não sei o que fazer, me sinto tão pequenininho diante desse problema' ou 'Quero apenas me esconder'.",
    questions: "Onde você sente essa tristeza no corpo agora? Quantos anos essa parte de você parece ter no momento?",
    interventions: "Acolhimento empático imediato pelo terapeuta; imagens mentais onde o Adulto Saudável (ou o terapeuta) entra na cena para proteger e confortar a criança.",
    materials: "Carta de Conforto do Adulto Saudável para a Criança Vulnerável."
  },
  {
    id: "modo_critico_interno",
    category: "Modos Esquemáticos",
    title: "Modo Crítico Interno (Punitivo / Exigente)",
    definition: "A internalização das vozes críticas, punitivas, exigentes e desvalorizadoras de figuras de autoridade da infância.",
    signs: "Autocobrança implacável, culpa esmagadora após cometer erros banais, sentimentos de asco ou raiva direcionados a si próprio.",
    examples: "Pensamentos automáticos insultuosos: 'Você é um idiota', 'Fez tudo errado de novo', 'Você nunca vai conseguir nada na vida'.",
    questions: "De quem é essa voz que você ouve cobrando isso de você? Ela ajuda ou paralisa você na resolução desse problema?",
    interventions: "Trabalho com cadeiras para externalizar a voz crítica, combatendo-a com a força e lógica do Adulto Saudável; banir exigências irreais.",
    materials: "Técnica de Enfrentamento do Crítico Interno nas Duas Cadeiras."
  },
  {
    id: "necessidade_vinculos",
    category: "Necessidades Emocionais Básicas",
    title: "Vínculos Seguros (Afeto, Estabilidade e Aceitação)",
    definition: "A necessidade humana primordial de se sentir amado, aceito, protegido e pertencente a um grupo ou relação estável.",
    signs: "Quando não atendida, gera esquemas do Domínio I (Desconexão). Quando atendida, promove autoconfiança, regulação emocional e resiliência social.",
    examples: "Busca por ambientes onde possa expressar sua individualidade sem medo de perder o amor do parceiro ou da família.",
    questions: "Quais relacionamentos na sua vida atual proporcionam um porto seguro onde você se sente aceito por inteiro?",
    interventions: "Garantir que a relação terapêutica funcione como um ambiente de apego seguro; estimular novos vínculos sociais saudáveis.",
    materials: "Inventário de Relacionamentos de Suporte Seguro."
  },
  {
    id: "distorcao_catastrofizacao",
    category: "Distorções Cognitivas",
    title: "Catastrofização",
    definition: "Antecipar o pior cenário possível para o futuro, tratando-o como um fato consumado e ignorando possibilidades mais moderadas.",
    signs: "Ansiedade antecipatória severa, evitação de novos desafios, insônia por pensamentos intrusivos de desastre.",
    examples: "Pensamentos como: 'Se eu gaguejar na apresentação, serei demitido e ficarei na miséria de forma definitiva'.",
    questions: "Qual é o cenário mais provável e realista? Se o pior acontecesse, como você lidaria na prática de forma passo a passo?",
    interventions: "Descatastrofização (técnica do pior/melhor/mais provável caso); criação de planos de contingência realistas; relaxamento muscular.",
    materials: "Folha de Trabalho de Descatastrofização Progressiva."
  },
  {
    id: "distorcao_tudo_nada",
    category: "Distorções Cognitivas",
    title: "Pensamento Tudo-ou-Nada (Polarizado)",
    definition: "Avaliar as situações, comportamentos ou pessoas apenas em categorias extremas e dicotômicas, sem considerar nuances intermédias.",
    signs: "Mudanças abruptas de opinião, exigências extremas de perfeição, desânimo completo diante de falhas de menor importância.",
    examples: "Pensamentos como: 'Como não cumpri a dieta no almoço, estraguei tudo e vou comer doce o dia todo' ou 'Ele me criticou, então não gosta mais de mim'.",
    questions: "As coisas no mundo são sempre pretas ou brancas ou existem tons de cinza? Que nota de 0 a 100 você daria para esse desempenho?",
    interventions: "Gráfico de pizza para distribuição de responsabilidades; escala percentual de 0 a 100 para quebrar avaliações binárias.",
    materials: "Gráfico Continuum de Tons de Cinza."
  },
  {
    id: "tecnica_rpd",
    category: "Técnicas de TCC",
    title: "Registro de Pensamentos Disfuncionais (RPD)",
    definition: "Uma ferramenta estruturada de monitoramento de pensamentos automáticos disfuncionais em resposta a situações desencadeadoras.",
    signs: "Usado para treinar o paciente a perceber a relação direta entre pensamento, emoção, reação corporal e comportamento prático.",
    examples: "Análise de episódios de ansiedade no trânsito ou insegurança social registrando as colunas: Situação -> Pensamentos -> Emoções -> Resposta Racional.",
    questions: "O que passou pela sua mente no momento exato em que sentiu essa emoção mudar?",
    interventions: "Instrução passo a passo do RPD durante as sessões; prescrição como tarefa de casa focada; revisão conjunta na sessão posterior.",
    materials: "Template de RPD de 5 ou 7 colunas (Disponível no SerenaPsi)."
  },
  {
    id: "tecnica_socratico",
    category: "Técnicas de TCC",
    title: "Questionamento Socrático",
    definition: "Método de diálogo reflexivo que ajuda o paciente a examinar a validade, utilidade e as evidências de suas próprias convicções disfuncionais.",
    signs: "Evita o debate direto ou a persuasão. Estimula o paciente a tirar suas próprias conclusões lógicas e saudáveis.",
    examples: "Uso de perguntas sequenciais como: 'Que dados você tem para essa conclusão?', 'Quais são as alternativas?', 'O que você aconselharia a seu filho?'",
    questions: "Quais perguntas socráticas seriam mais úteis para desarmar esse pensamento específico hoje?",
    interventions: "Treinar a escuta ativa; formular perguntas abertas focadas no exame de evidências práticas e funcionalidade de pensamentos.",
    materials: "Guia de Bolso de Perguntas Socráticas para Terapeutas."
  },
  {
    id: "tecnica_cadeiras",
    category: "Técnicas de Terapia do Esquema",
    title: "Trabalho com Cadeiras (Chairwork)",
    definition: "Técnica vivencial que posiciona diferentes modos esquemáticos em cadeiras físicas separadas para promover diálogos e resolução de conflitos internos.",
    signs: "Ideal para processar pensamentos autodepreciativos crônicos, combater vozes punitivas e fortalecer o modo Adulto Saudável.",
    examples: "Paciente senta na Cadeira A para expressar o Crítico Interno, muda para a Cadeira B para externalizar a Criança Vulnerável, e senta na Cadeira C como Adulto Saudável para barrar a agressão do crítico.",
    questions: "O que o seu Adulto Saudável diria hoje para rebater as exigências dessa cadeira do Crítico Interno?",
    interventions: "Conduzir a técnica com segurança emocional; encorajar a expressão intensa de emoções retidas; mediar a confrontação do crítico.",
    materials: "Protocolo Clínico de Condução de Diálogo de Cadeiras."
  },
  {
    id: "tecnica_imagens",
    category: "Técnicas de Terapia do Esquema",
    title: "Imagens Mentais e Reparentalização",
    definition: "Técnica vivencial para acessar memórias dolorosas de infância por meio de imaginação ativa e promover a correção da experiência traumática.",
    signs: "Útil quando as explicações racionais não aliviam a dor emocional profunda. Requer alto rapport e preparo técnico.",
    examples: "Imaginar uma cena dolorosa da infância, permitir que o terapeuta ou a versão adulta do paciente entre na cena para suprir as necessidades da criança vulnerável.",
    questions: "O que aquela criancinha mais precisava de apoio naquele momento da cena e quem pode entrar lá para protegê-la?",
    interventions: "Instruir relaxamento inicial; guiar a visualização sem forçar detalhes; realizar reparentalização limitada de forma ativa na imagem.",
    materials: "Roteiro Clínico de Exercício de Imaginação para Reparentalização."
  },
  {
    id: "estrutura_sessao_tcc",
    category: "Estrutura de Sessão",
    title: "Estrutura de Sessão Padrão na TCC",
    definition: "O esqueleto clássico e colaborativo que pauta cada atendimento clínico para maximizar a eficácia do tempo terapêutico.",
    signs: "Equilibra foco prático e acolhimento humano. Evita dispersão e conversas genéricas sem direcionamento terapêutico.",
    examples: "1. Acolhimento e checagem de humor (2m) -> 2. Revisão de tarefas (5m) -> 3. Definição da pauta (3m) -> 4. Intervenção (35m) -> 5. Novas tarefas (3m) -> 6. Feedback (2m).",
    questions: "Qual dessas etapas costuma ser mais negligenciada ou estendida além do planejado nos seus atendimentos?",
    interventions: "Uso de cronômetros discretos; pactuação colaborativa do tempo com o paciente no início de cada sessão.",
    materials: "Checklist de Autoavaliação de Condução de Sessão TCC."
  },
  {
    id: "escala_ysq",
    category: "Escalas e Instrumentos",
    title: "Questionário de Esquemas de Young (YSQ-S3)",
    definition: "Inventário autoaplicável simplificado para avaliar a presença de 18 Esquemas Iniciais Desadaptativos do paciente.",
    signs: "Fornece dados quantitativos excelentes para embasar a conceituação cognitiva e o planejamento terapêutico do caso.",
    examples: "Análise de escores altos em itens relacionados à Dependência ou Privação Emocional para direcionar a terapia do esquema.",
    questions: "Quais foram os esquemas que apresentaram as maiores pontuações nesse questionário do paciente?",
    interventions: "Aplicação ética e agendada; discussão colaborativa dos resultados com o paciente visando a psicoeducação do caso.",
    materials: "Questionário Completo de Esquemas YSQ-S3 com Gabarito de Correção."
  }
];

export default function Notebook({ token, folders }: NotebookProps) {
  // Navigation States
  const [activeView, setActiveView] = useState<"home" | "estudar" | "supervisao" | "guias">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistence Mode State
  const [integrationMode, setIntegrationMode] = useState<"MANUAL_WORKSPACE" | "NOTEBOOKLM_ENTERPRISE_API">("MANUAL_WORKSPACE");

  // Configuration Database Rows (from Sheets or LocalStorage backup)
  const [configs, setConfigs] = useState<NotebookConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<NotebookConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputNotebookTitle, setInputNotebookTitle] = useState("");
  const [inputNotebookUrl, setInputNotebookUrl] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Predefined lists
  const predefinedThemes = [
    {
      id: "PRE_TCC",
      titulo: "TCC — Base Científica",
      finalidade: "Estudo de artigos, manuais e a fundamentação teórica da Terapia Cognitivo-Comportamental.",
      defaultUrl: "https://notebooklm.google.com/"
    },
    {
      id: "PRE_ESQUEMA",
      titulo: "Terapia do Esquema",
      finalidade: "Compreensão aprofundada dos Esquemas Iniciais Desadaptativos, Domínios e Modos Esquemáticos.",
      defaultUrl: "https://notebooklm.google.com/"
    },
    {
      id: "PRE_AVAL_PSICO",
      titulo: "Avaliação e Psicopatologia",
      finalidade: "Critérios de diagnóstico do DSM-5, testes clínicos e protocolos de avaliação psicológica.",
      defaultUrl: "https://notebooklm.google.com/"
    },
    {
      id: "PRE_TECNICAS",
      titulo: "Técnicas, Psicoeducação e Tarefas",
      finalidade: "Práticas clínicas de intervenção, exercícios socráticos e guias de psicoeducação para os pacientes.",
      defaultUrl: "https://notebooklm.google.com/"
    },
    {
      id: "PRE_DOCS_CFP",
      titulo: "Documentação Clínica, CFP e LGPD",
      finalidade: "Regulamentação ética da prática clínica, proteção de dados dos pacientes e conduta do CFP.",
      defaultUrl: "https://notebooklm.google.com/"
    },
    {
      id: "PRE_DESENV_PROF",
      titulo: "Desenvolvimento Profissional",
      finalidade: "Artigos de carreira, supervisão geral, pesquisas e educação contínua.",
      defaultUrl: "https://notebooklm.google.com/"
    }
  ];

  // Section 1 - Custom Notebook Form
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [newCustomUrl, setNewCustomUrl] = useState("");

  // Section 2 - Wizard States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardPatient, setWizardPatient] = useState<Patient | null>(null);
  const [sessionOption, setSessionOption] = useState<"all" | "3" | "5" | "10" | "custom">("5");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [supervisionQuestion, setSupervisionQuestion] = useState("");
  const [selectedContentTags, setSelectedContentTags] = useState<string[]>([
    "resumo", "foco_sessao", "intervencoes", "tarefas", "combinados", "evolucao"
  ]);
  const [pseudonymName, setPseudonymName] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [detectedPII, setDetectedPII] = useState<{ original: string; type: string }[]>([]);
  const [previewContent, setPreviewContent] = useState("");
  const [generatedDoc, setGeneratedDoc] = useState<{ id: string; url: string; title: string } | null>(null);
  const [privacyLogs, setPrivacyLogs] = useState<any[]>([]);

  // Section 3 - Search Library States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuideCategory, setSelectedGuideCategory] = useState("Todos os Guias");
  const [activeGuideDetail, setActiveGuideDetail] = useState<QuickGuideItem | null>(null);

  // Sync Overlay
  const [syncNotice, setSyncNotice] = useState<{ title: string; notebookUrl: string } | null>(null);

  // Load patient list and configs on mount
  useEffect(() => {
    loadInitialData();
  }, [folders?.spreadsheetId, token]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Patients & Sessions
      if (folders?.spreadsheetId && token) {
        const fetchedPatients = await getPatients(folders.spreadsheetId, token);
        const fetchedSessions = await getSessions(folders.spreadsheetId, token);
        setPatients(fetchedPatients);
        setSessions(fetchedSessions);
      }

      // 2. Load configurations from Google Sheets or local storage
      await loadConfigs();

      // Load local privacy logs
      const savedLogs = localStorage.getItem("serenapsi_privacy_logs");
      if (savedLogs) {
        setPrivacyLogs(JSON.parse(savedLogs));
      }
    } catch (e: any) {
      console.error("Error loading initial data in Notebook", e);
      setError("Dificuldade temporária ao carregar dados. Usando carregamento em cache.");
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE SHEETS TAB MANAGEMENT ---
  const loadConfigs = async () => {
    let sheetConfigs: NotebookConfig[] = [];
    const localBackup = localStorage.getItem("serenapsi_notebook_configs");
    
    if (token && folders?.spreadsheetId) {
      try {
        const spreadsheetId = folders.spreadsheetId;
        // Check sheets list to see if ConfigNotebooks tab exists
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const sheetTitles = metaData.sheets?.map((s: any) => s.properties.title) || [];
          
          if (!sheetTitles.includes("ConfigNotebooks")) {
            await createConfigTabInSheets(spreadsheetId);
          } else {
            // Read rows
            const rowsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("ConfigNotebooks!A2:K1000")}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (rowsRes.ok) {
              const rowsData = await rowsRes.json();
              const rows = rowsData.values || [];
              sheetConfigs = rows.map((row: any) => ({
                notebookConfigId: row[0] || "",
                tipo: (row[1] || "personalizado") as any,
                titulo: row[2] || "",
                notebookUrl: row[3] || "https://notebooklm.google.com/",
                driveFolderId: row[4] || "",
                driveDocumentIds: row[5] || "",
                patientId: row[6] || "",
                data_ultima_geracao: row[7] || "",
                data_ultima_modificacao: row[8] || "",
                situacao: (row[9] || "Não configurado") as any,
                usuario_responsavel: row[10] || ""
              }));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load configs from Sheets, falling back to local storage", err);
      }
    }

    // Merge or set configs
    if (sheetConfigs.length > 0) {
      setConfigs(sheetConfigs);
      localStorage.setItem("serenapsi_notebook_configs", JSON.stringify(sheetConfigs));
    } else if (localBackup) {
      setConfigs(JSON.parse(localBackup));
    } else {
      // Initialize with default predefined templates
      const initial: NotebookConfig[] = predefinedThemes.map(t => ({
        notebookConfigId: t.id,
        tipo: "predefinido",
        titulo: t.titulo,
        notebookUrl: t.defaultUrl,
        driveFolderId: folders?.notebookLmId || "",
        driveDocumentIds: "",
        data_ultima_geracao: "",
        data_ultima_modificacao: new Date().toLocaleDateString("pt-BR"),
        situacao: "Não configurado",
        usuario_responsavel: "Dra. Virgínia Macedo"
      }));
      setConfigs(initial);
      localStorage.setItem("serenapsi_notebook_configs", JSON.stringify(initial));
    }
  };

  const createConfigTabInSheets = async (spreadsheetId: string) => {
    if (!token) return;
    try {
      // Add sheet
      const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: "ConfigNotebooks",
                  gridProperties: { rowCount: 1000, columnCount: 15 }
                }
              }
            }
          ]
        })
      });
      
      if (addRes.ok) {
        // Write headers
        const headers = [
          "notebookConfigId", "tipo", "título", "notebookUrl", "driveFolderId",
          "driveDocumentIds", "patientId", "data_ultima_geracao", "data_ultima_modificacao",
          "situacao", "usuario_responsavel"
        ];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("ConfigNotebooks!A1:K1")}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: [headers] })
        });

        // Write initial default predefined config rows
        const initialRows = predefinedThemes.map(t => [
          t.id, "predefinido", t.titulo, t.defaultUrl, folders?.notebookLmId || "",
          "", "", "", new Date().toLocaleDateString("pt-BR"), "Não configurado", "Dra. Virgínia Macedo"
        ]);
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("ConfigNotebooks!A2:K7")}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: initialRows })
        });
      }
    } catch (e) {
      console.error("Error creating ConfigNotebooks sheet tab", e);
    }
  };

  const saveAllConfigsToSheets = async (updatedList: NotebookConfig[]) => {
    if (!token || !folders?.spreadsheetId) return;
    try {
      const spreadsheetId = folders.spreadsheetId;
      // First, clear the entire range to avoid leaving old tail data
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("ConfigNotebooks!A2:K1000")}:clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      // Prepare all rows
      const rows = updatedList.map(config => [
        config.notebookConfigId,
        config.tipo,
        config.titulo,
        config.notebookUrl,
        config.driveFolderId,
        config.driveDocumentIds,
        config.patientId || "",
        config.data_ultima_geracao,
        config.data_ultima_modificacao,
        config.situacao,
        config.usuario_responsavel
      ]);

      if (rows.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`ConfigNotebooks!A2:K${rows.length + 1}`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: rows })
        });
      }
    } catch (err) {
      console.error("Could not write updated config list to Sheets", err);
    }
  };

  const saveNotebookConfig = async (config: NotebookConfig) => {
    const updatedConfigs = configs.map(c => c.notebookConfigId === config.notebookConfigId ? config : c);
    // If not found in original, append
    if (!configs.some(c => c.notebookConfigId === config.notebookConfigId)) {
      updatedConfigs.push(config);
    }
    setConfigs(updatedConfigs);
    localStorage.setItem("serenapsi_notebook_configs", JSON.stringify(updatedConfigs));

    await saveAllConfigsToSheets(updatedConfigs);
  };

  const handleDeleteNotebook = async (notebookConfigId: string, title: string) => {
    if (!confirm(`Tem certeza de que deseja excluir o caderno "${title}"?`)) {
      return;
    }
    const updatedConfigs = configs.filter(c => c.notebookConfigId !== notebookConfigId);
    setConfigs(updatedConfigs);
    localStorage.setItem("serenapsi_notebook_configs", JSON.stringify(updatedConfigs));
    await saveAllConfigsToSheets(updatedConfigs);
  };

  // --- SEÇÃO 1 — ACTIONS ---
  const handleOpenConfigModal = (cfg: NotebookConfig) => {
    setActiveConfig(cfg);
    setInputNotebookTitle(cfg.titulo);
    setInputNotebookUrl(cfg.notebookUrl);
    setShowConfigModal(true);
  };

  const handleSaveConfigModal = async () => {
    if (!activeConfig) return;
    setSavingConfig(true);
    const updated: NotebookConfig = {
      ...activeConfig,
      titulo: inputNotebookTitle.trim() || activeConfig.titulo,
      notebookUrl: inputNotebookUrl,
      situacao: activeConfig.situacao === "Não configurado" ? "Pronto para adicionar au NotebookLM" : activeConfig.situacao,
      data_ultima_modificacao: new Date().toLocaleDateString("pt-BR")
    };
    await saveNotebookConfig(updated);
    setSavingConfig(false);
    setShowConfigModal(false);
  };

  const handleCreateCustomNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTitle.trim()) return;

    const newId = generateUUID();
    const newConfig: NotebookConfig = {
      notebookConfigId: newId,
      tipo: "personalizado",
      titulo: newCustomTitle,
      notebookUrl: newCustomUrl.trim() || "https://notebooklm.google.com/",
      driveFolderId: folders?.notebookLmId || "",
      driveDocumentIds: "",
      data_ultima_geracao: "",
      data_ultima_modificacao: new Date().toLocaleDateString("pt-BR"),
      situacao: newCustomUrl.trim() ? "Pronto para adicionar au NotebookLM" : "Não configurado",
      usuario_responsavel: "Dra. Virgínia Macedo"
    };

    await saveNotebookConfig(newConfig);
    setNewCustomTitle("");
    setNewCustomUrl("");
    setShowCreateCustom(false);
  };

  const handleTriggerPrepareSource = (cfg: NotebookConfig) => {
    if (!token) {
      alert("Para criar arquivos reais no Google Drive, conecte sua conta Google no menu principal.");
      return;
    }
    // Simulate creating a structured model file inside the NotebookLM Drive Folder
    setLoading(true);
    setTimeout(async () => {
      try {
        const docName = `[Fonte] ${cfg.titulo} - Estrutura de Apoio`;
        // Create an empty structured template doc on Drive
        let docId = generateUUID();
        let docUrl = `https://docs.google.com/document/u/0/`;

        if (folders?.notebookLmId) {
          // Attempt real Drive API creation
          const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: docName,
              mimeType: "application/vnd.google-apps.document",
              parents: [folders.notebookLmId]
            })
          });
          if (metaRes.ok) {
            const fileData = await metaRes.json();
            docId = fileData.id;
            docUrl = `https://docs.google.com/document/d/${docId}/edit`;

            // Write helper context inside this document
            const textContent = `# Guia de Estudo - ${cfg.titulo}\n\nEste documento serve como fonte clínica para o NotebookLM.\nÚltima atualização do SerenaPsi em: ${new Date().toLocaleDateString("pt-BR")}.\n\n--- Conteúdo estruturado para análise do modelo de IA ---`;
            await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                requests: [
                  { insertText: { location: { index: 1 }, text: textContent } }
                ]
              })
            });
          }
        }

        // Save doc reference
        const currentDocIds = cfg.driveDocumentIds ? cfg.driveDocumentIds.split(",") : [];
        if (!currentDocIds.includes(docId)) {
          currentDocIds.push(docId);
        }

        const updated: NotebookConfig = {
          ...cfg,
          driveDocumentIds: currentDocIds.join(","),
          situacao: "Documento atualizado",
          data_ultima_modificacao: new Date().toLocaleDateString("pt-BR")
        };
        await saveNotebookConfig(updated);
        
        // Trigger notice to sync manually
        setSyncNotice({
          title: cfg.titulo,
          notebookUrl: cfg.notebookUrl
        });

      } catch (err) {
        console.error("Error preparing source document on Drive", err);
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  // --- SEÇÃO 2 — WIZARD (SUPERVISÃO) ---
  const handleStartWizard = () => {
    setWizardStep(1);
    setWizardPatient(null);
    setSupervisionQuestion("");
    setSelectedSessionIds([]);
    setGeneratedDoc(null);
    setPseudonymName("");
    setPrivacyConsent(false);
    setActiveView("supervisao");
  };

  const getStablePseudonym = (p: Patient) => {
    const pseudonyms = [
      "Alice", "Bruno", "Clara", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique",
      "Isabela", "João", "Karina", "Leonardo", "Marina", "Nicolas", "Olivia", "Pedro",
      "Renata", "Samuel", "Tatiana", "Vinícius", "Yasmim", "Zeca", "Márcia", "Sandro", "Bárbara"
    ];
    const idNum = parseInt(p.id.replace(/\D/g, "") || "0", 10);
    const index = idNum % pseudonyms.length;
    return `Paciente ${pseudonyms[index]}`;
  };

  const handleSelectPatient = (p: Patient) => {
    setWizardPatient(p);
    setPseudonymName(getStablePseudonym(p));
    
    // Auto filter sessions
    const patientSessions = sessions.filter(s => s.paciente_id === p.id);
    const ids = patientSessions.slice(0, 5).map(s => s.id);
    setSelectedSessionIds(ids);
    setWizardStep(2);
  };

  const handleSessionOptionChange = (opt: "all" | "3" | "5" | "10" | "custom") => {
    setSessionOption(opt);
    if (!wizardPatient) return;
    const patientSessions = sessions.filter(s => s.paciente_id === wizardPatient.id);
    
    if (opt === "all") {
      setSelectedSessionIds(patientSessions.map(s => s.id));
    } else if (opt === "3") {
      setSelectedSessionIds(patientSessions.slice(0, 3).map(s => s.id));
    } else if (opt === "5") {
      setSelectedSessionIds(patientSessions.slice(0, 5).map(s => s.id));
    } else if (opt === "10") {
      setSelectedSessionIds(patientSessions.slice(0, 10).map(s => s.id));
    }
  };

  const toggleSelectSessionId = (sid: string) => {
    if (selectedSessionIds.includes(sid)) {
      setSelectedSessionIds(selectedSessionIds.filter(id => id !== sid));
    } else {
      setSelectedSessionIds([...selectedSessionIds, sid]);
    }
  };

  // Compile selected sessions details, apply sensitive data check
  const preparePrivacyCheck = () => {
    if (!wizardPatient) return;
    const patientSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    
    // Simple mock sensitive entity detection
    const detections: { original: string; type: string }[] = [];
    const collect = (text: string) => {
      if (!text) return;
      // Real patient elements
      const name = wizardPatient.nome_preferencial;
      const fullName = wizardPatient.nome_completo;
      const phone = wizardPatient.contato_telefone;
      const email = wizardPatient.contato_email;
      
      if (name && text.includes(name) && !detections.some(d => d.original === name)) {
        detections.push({ original: name, type: "Nome" });
      }
      if (fullName && text.includes(fullName) && !detections.some(d => d.original === fullName)) {
        detections.push({ original: fullName, type: "Nome Completo" });
      }
      if (phone && text.includes(phone) && !detections.some(d => d.original === phone)) {
        detections.push({ original: phone, type: "Telefone" });
      }
      if (email && text.includes(email) && !detections.some(d => d.original === email)) {
        detections.push({ original: email, type: "E-mail" });
      }

      // Simple regex for CPF
      const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
      let match;
      while ((match = cpfRegex.exec(text)) !== null) {
        if (!detections.some(d => d.original === match[0])) {
          detections.push({ original: match[0], type: "CPF" });
        }
      }
    };

    collect(wizardPatient.nome_completo || "");
    collect(wizardPatient.nome_preferencial || "");
    patientSessions.forEach(s => {
      collect(s.resumo || "");
      collect(s.foco || "");
      collect(s.combinados_atual || "");
    });

    setDetectedPII(detections);
    
    // Auto-generate compiled report with pseudonyms
    let compiled = `# HISTÓRICO PARA SUPERVISÃO CLÍNICA\n`;
    compiled += `Pseudônimo do Caso: ${pseudonymName}\n`;
    compiled += `Data de Elaboração: ${new Date().toLocaleDateString("pt-BR")}\n`;
    compiled += `Terapeuta Responsável: Dra. Virgínia Macedo\n\n`;
    
    compiled += `## 1. QUESTÃO PRINCIPAL DE SUPERVISÃO\n`;
    compiled += `"${supervisionQuestion || "Não especificada. Avaliação clínica geral do caso."}"\n\n`;

    compiled += `## 2. SÍNTESE DO PACIENTE (ANONIMIZADA)\n`;
    compiled += `* **Modalidade:** ${wizardPatient.modalidade || "Individual"}\n`;
    compiled += `* **Faturamento de Referência:** R$ ${(wizardPatient.valor_padrao || 150).toFixed(2)}\n`;
    compiled += `* **Histórico Clínico:** Caso clínico estruturado em Terapia Cognitivo-Comportamental e Terapia do Esquema.\n\n`;

    compiled += `## 3. EVOLUÇÃO DAS SESSÕES SELECIONADAS (${patientSessions.length})\n\n`;
    
    patientSessions.forEach((s, idx) => {
      const sDate = s.data_hora ? new Date(s.data_hora).toLocaleDateString("pt-BR") : "Data não registrada";
      compiled += `### SESSÃO ${idx + 1} - ${sDate}\n`;
      
      if (selectedContentTags.includes("foco_sessao")) {
        compiled += `* **Foco Clínico:** ${anonymizeText(s.foco || "Geral", detections)}\n`;
      }
      if (selectedContentTags.includes("resumo")) {
        compiled += `* **Evolução & Resumo:** ${anonymizeText(s.resumo || "Sem notas registradas", detections)}\n`;
      }
      if (selectedContentTags.includes("combinados") && s.combinados_atual) {
        compiled += `* **Combinados / Ações:** ${anonymizeText(s.combinados_atual, detections)}\n`;
      }
      compiled += `\n`;
    });

    compiled += `\n---\n`;
    compiled += `**AVISO ÉTICO IMPORTANTE:** Este material foi gerado como apoio pedagógico à supervisão clínica e de forma alguma substitui o julgamento profissional e independente da psicóloga assistente responsável.`;

    setPreviewContent(compiled);
    setWizardStep(5); // Go to privacy stage
  };

  const anonymizeText = (text: string, detections: { original: string; type: string }[]) => {
    let cleaned = text;
    detections.forEach(d => {
      const escaped = d.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, "gi");
      cleaned = cleaned.replace(regex, `[${d.type.toUpperCase()} ANONIMIZADO]`);
    });
    return cleaned;
  };

  const handleConfirmPrivacyReview = () => {
    if (!privacyConsent) {
      alert("Por favor, marque a caixa confirmando que você revisou pessoalmente a privacidade dos dados clínicos.");
      return;
    }
    setWizardStep(6); // Proceed to preview step
  };

  const handleExportSupervisionDoc = async () => {
    if (!wizardPatient) return;
    setLoading(true);
    setError(null);
    try {
      // Check LGPD Consent for NotebookLM (Fail-Closed)
      const consentRes = await apiFetch(`/api/patient/${wizardPatient.id}/consents/check?type=notebooklm`);
      if (!consentRes.ok) {
        const errData = await consentRes.json().catch(() => ({}));
        alert(`⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nO paciente "${wizardPatient.nome_completo || wizardPatient.nome_preferencial}" não possui consentimento ativo para utilização de dados no NotebookLM ou a verificação falhou (${errData.error || errData.reason || "Não autorizado"}).\nPor favor, atualize o termo no cadastro do paciente antes de exportar o caso.`);
        setLoading(false);
        return;
      }
      const consentData = await consentRes.json();
      if (!consentData.allowed) {
        alert(`⚠️ AÇÃO BLOQUEADA POR CONSENTIMENTO (LGPD):\n\nO paciente "${wizardPatient.nome_completo || wizardPatient.nome_preferencial}" não possui consentimento ativo para utilização de dados no NotebookLM (notebooklm).\nPor favor, atualize o termo no cadastro do paciente antes de exportar o caso.`);
        setLoading(false);
        return;
      }

      const docName = `Supervisão — ${pseudonymName} — ${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}`;
      let createdId = "MOCK_SUPERVISAO_ID";
      let createdUrl = "https://docs.google.com/document/u/0/";

      if (token && folders?.notebookLmId) {
        // Create new Google Doc in NotebookLM folder
        const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: docName,
            mimeType: "application/vnd.google-apps.document",
            parents: [folders.notebookLmId]
          })
        });

        if (metaRes.ok) {
          const docData = await metaRes.json();
          createdId = docData.id;
          createdUrl = `https://docs.google.com/document/d/${createdId}/edit`;

          // Write contents
          await fetch(`https://docs.googleapis.com/v1/documents/${createdId}:batchUpdate`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              requests: [
                { insertText: { location: { index: 1 }, text: previewContent } }
              ]
            })
          });
        }
      }

      setGeneratedDoc({
        id: createdId,
        url: createdUrl,
        title: docName
      });

      // Update configurations list in Sheets & LocalStorage
      const newConfigId = `SUPERV_${wizardPatient.id}`;
      // Search for existing patient config or create new one
      const existing = configs.find(c => c.patientId === wizardPatient.id);
      
      const newConfig: NotebookConfig = {
        notebookConfigId: existing ? existing.notebookConfigId : newConfigId,
        tipo: "paciente",
        titulo: `Supervisão — ${pseudonymName}`,
        notebookUrl: existing ? existing.notebookUrl : "https://notebooklm.google.com/",
        driveFolderId: folders?.notebookLmId || "",
        driveDocumentIds: existing 
          ? (existing.driveDocumentIds.includes(createdId) ? existing.driveDocumentIds : `${existing.driveDocumentIds},${createdId}`)
          : createdId,
        patientId: wizardPatient.id,
        data_ultima_geracao: new Date().toLocaleDateString("pt-BR"),
        data_ultima_modificacao: new Date().toLocaleDateString("pt-BR"),
        situacao: "Documento atualizado",
        usuario_responsavel: "Dra. Virgínia Macedo"
      };

      await saveNotebookConfig(newConfig);

      // Log Privacy & Action
      const newLog = {
        id: generateUUID(),
        timestamp: new Date().toLocaleString("pt-BR"),
        generatedBy: "Dra. Virgínia Macedo",
        patientPseudonym: pseudonymName,
        sessionsCount: selectedSessionIds.length,
        anonymizationStrategy: "Pseudônimo estável com substituição de entidades sensíveis (PII)",
        humanReviewConfirmed: true,
        documentVersion: "1.0",
        documentTitle: docName
      };

      const updatedLogs = [newLog, ...privacyLogs];
      setPrivacyLogs(updatedLogs);
      localStorage.setItem("serenapsi_privacy_logs", JSON.stringify(updatedLogs));

      setWizardStep(7); // Show finish step

    } catch (e: any) {
      console.error("Error creating supervision doc", e);
      setError("Falha técnica ao criar documento no Drive. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // --- SEÇÃO 3 — GUIAS RÁPIDOS SEARCH ---
  const handleSelectGuide = (guide: QuickGuideItem) => {
    setActiveGuideDetail(guide);
  };

  const getFilteredGuides = () => {
    return QUICK_GUIDES_DATABASE.filter(g => {
      const matchCategory = selectedGuideCategory === "Todos os Guias" || g.category === selectedGuideCategory;
      const cleanQuery = searchQuery.toLowerCase().trim();
      const matchQuery = !cleanQuery || 
        g.title.toLowerCase().includes(cleanQuery) || 
        g.definition.toLowerCase().includes(cleanQuery) || 
        g.signs.toLowerCase().includes(cleanQuery) || 
        g.examples.toLowerCase().includes(cleanQuery);
      return matchCategory && matchQuery;
    });
  };

  const guideCategories = [
    "Todos os Guias",
    "Esquemas Iniciais Desadaptativos (EIDs)",
    "Domínios Esquemáticos",
    "Modos Esquemáticos",
    "Necessidades Emocionais Básicas",
    "Distorções Cognitivas",
    "Técnicas de TCC",
    "Técnicas de Terapia do Esquema",
    "Estrutura de Sessão",
    "Escalas e Instrumentos"
  ];

  const handleCopyPrompt = () => {
    const promptText = `Você é um supervisor clínico de alta senioridade, especializado em Terapia Cognitivo-Comportamental (TCC) e Terapia do Esquema.
Estude a fonte clínica anexada a este notebook (Supervisão do Caso) e responda com precisão ética e rigor clínico à seguinte questão de supervisão formulada pelo psicólogo assistente:

"${supervisionQuestion || "Não especificada. Forneça uma avaliação conceitual abrangente do caso com foco nos sintomas principais."}"

Ao elaborar seus direcionamentos estruturados:
1. Analise as hipóteses diagnósticas e conceituação cognitiva do caso.
2. Identifique os Esquemas Iniciais Desadaptativos (EIDs) ativados e os modos esquemáticos predominantes demonstrados nas sessões relatadas.
3. Avalie a eficácia das intervenções descritas e sugira abordagens de enfrentamento ou técnicas vivenciais alternativas.
4. Identifique possíveis impasses na relação terapêutica e recomende próximos passos e tarefas de casa práticas.
5. Lembre-se de fundamentar suas orientações teóricas nos pressupostos científicos vigentes.`;

    navigator.clipboard.writeText(promptText);
    alert("Prompt de análise clínica copiado para a área de transferência! Cole-o no NotebookLM junto ao material anexado.");
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans p-6 overflow-y-auto">
      
      {/* HEADER BANNER */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mb-6 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider block mb-1">Módulo de Estudo e Suporte Técnico</span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">Conhecimento & NotebookLM</h1>
          <p className="text-xs text-slate-500 mt-1">Sua ponte integrada para organização de fontes e preparação de supervisão clínica no Google NotebookLM.</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {activeView !== "home" && (
            <button
              onClick={() => {
                setActiveView("home");
                setError(null);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft size={14} className="shrink-0" />
              <span>Voltar ao Menu</span>
            </button>
          )}
          <button
            onClick={() => {
              setIntegrationMode(prev => prev === "MANUAL_WORKSPACE" ? "NOTEBOOKLM_ENTERPRISE_API" : "MANUAL_WORKSPACE");
              alert(`Modo de integração alterado com sucesso!`);
            }}
            className="px-3.5 py-2 border border-slate-200 hover:border-slate-350 text-slate-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Clique para alternar o modo de persistência/API"
          >
            <Layers size={14} className="text-emerald-700 shrink-0" />
            <span>Modo: {integrationMode === "MANUAL_WORKSPACE" ? "Workspace Manual" : "Enterprise API (Futuro)"}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-3 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2 animate-pulse">
          <Loader2 size={16} className="animate-spin text-emerald-800" />
          <span>Sincronizando dados com o Google Drive e Planilhas...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-800 border border-red-100 px-4 py-3 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: HOME SCREEN (THREE PRIMARY OPTIONS ONLY)
          ========================================================================= */}
      {activeView === "home" && (
        <div className="space-y-8 max-w-4xl mx-auto py-6 animate-fade-in">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-serif text-slate-800 font-semibold">O que você deseja fazer agora?</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">Selecione uma das tarefas recomendadas abaixo para iniciar seu fluxo de estudos ou análise de casos clínicos.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* OPTION 1: ESTUDAR UM TEMA */}
            <div className="bg-white border border-slate-100 hover:border-emerald-300 rounded-3xl p-6 shadow-sm flex flex-col justify-between transition group">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 transition">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-800">1. Estudar um tema</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Organize seus materiais de estudo por tópicos clínicos e abra-os de forma simples no Google NotebookLM para consultas, resumos e podcasts de áudio.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveView("estudar")}
                className="mt-6 w-full py-2.5 bg-emerald-800 text-white rounded-xl font-bold text-xs hover:bg-emerald-900 transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Selecionar Tema</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* OPTION 2: PREPARAR CASO PARA SUPERVISÃO */}
            <div className="bg-white border border-slate-100 hover:border-emerald-300 rounded-3xl p-6 shadow-sm flex flex-col justify-between transition group">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 transition">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-800">2. Preparar supervisão</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Use nosso assistente passo a passo seguro para selecionar sessões de um paciente, remover dados sensíveis e gerar um documento limpo de apoio.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStartWizard}
                className="mt-6 w-full py-2.5 bg-emerald-800 text-white rounded-xl font-bold text-xs hover:bg-emerald-900 transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Preparar Caso</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* OPTION 3: CONSULTAR GUIA RÁPIDO */}
            <div className="bg-white border border-slate-100 hover:border-emerald-300 rounded-3xl p-6 shadow-sm flex flex-col justify-between transition group">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 transition">
                  <Search size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-800">3. Consultar guia rápido</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Acesse uma biblioteca unificada de consulta rápida sobre conceitos de esquemas, distorções cognitivas, técnicas e instrumentos clínicos.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveView("guias");
                  setActiveGuideDetail(null);
                }}
                className="mt-6 w-full py-2.5 bg-emerald-800 text-white rounded-xl font-bold text-xs hover:bg-emerald-900 transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Abrir Biblioteca</span>
                <ChevronRight size={14} />
              </button>
            </div>

          </div>

          {/* PRIVACY & COMPLIANCE BOX */}
          <div className="bg-slate-100/60 border border-slate-200 rounded-3xl p-5 flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl text-slate-500 shrink-0 border border-slate-150">
              <Info size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Apoio à Proteção de Dados e Conformidade</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                O SerenaPsi organiza e prepara o material clínico removendo identificadores óbvios antes de exportá-los ao Google Drive. No entanto, lembre-se de que a conformidade integral com a LGPD e o Código de Ética do CFP depende sempre da conferência manual e do julgamento profissional da psicóloga. O NotebookLM nunca deve ser utilizado para armazenar prontuários oficiais sem supervisão.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* =========================================================================
          VIEW 2: ESTUDAR UM TEMA
          ========================================================================= */}
      {activeView === "estudar" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-serif text-slate-900 font-bold">Estudar um Tema Clínico</h2>
              <p className="text-xs text-slate-500">Selecione o caderno temático que deseja estudar. Seus arquivos gerados pelo SerenaPsi estão salvos no Google Drive correspondente.</p>
            </div>
            <button
              onClick={() => setShowCreateCustom(true)}
              className="px-4 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Criar Caderno Personalizado</span>
            </button>
          </div>

          {/* CADERNOS CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {configs.map(cfg => {
              const docCount = cfg.driveDocumentIds ? cfg.driveDocumentIds.split(",").filter(id => id.trim()).length : 0;
              const isPredefined = cfg.tipo === "predefinido";
              
              return (
                <div key={cfg.notebookConfigId} className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isPredefined ? "bg-emerald-50 text-emerald-800" : "bg-purple-50 text-purple-800"
                        }`}>
                          {cfg.tipo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{cfg.data_ultima_modificacao}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenConfigModal(cfg)}
                          className="p-1.5 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40 rounded-xl transition cursor-pointer border border-emerald-100/30"
                          title="Editar Caderno"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteNotebook(cfg.notebookConfigId, cfg.titulo)}
                          className="p-1.5 text-rose-600 bg-rose-50/80 hover:bg-rose-100/90 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40 rounded-xl transition cursor-pointer border border-rose-100/30"
                          title="Excluir Caderno"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-serif font-bold text-base text-slate-800">{cfg.titulo}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                      {predefinedThemes.find(t => t.id === cfg.notebookConfigId || t.titulo === cfg.titulo)?.finalidade || "Caderno personalizado para agrupamento de materiais de estudo e supervisão clínica."}
                    </p>
                    
                    <div className="bg-slate-50 p-2.5 rounded-2xl flex justify-between text-[11px] text-slate-600 border border-slate-100">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Fontes no Drive</span>
                        <span className="font-semibold">{docCount} documento(s)</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Situação</span>
                        <span className="font-semibold text-emerald-800">{cfg.situacao}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={cfg.notebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-xl text-center text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Abrir no Google NotebookLM em nova aba"
                      >
                        <ExternalLink size={12} />
                        <span>NotebookLM</span>
                      </a>
                      
                      <a
                        href={`https://drive.google.com/drive/folders/${cfg.driveFolderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-xl text-center text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FolderOpen size={12} />
                        <span>Ver no Drive</span>
                      </a>
                    </div>

                    <button
                      onClick={() => handleTriggerPrepareSource(cfg)}
                      className="w-full py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Preparar nova fonte</span>
                    </button>

                    <button
                      onClick={() => handleOpenConfigModal(cfg)}
                      className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer py-1 block"
                    >
                      Configurar Link do NotebookLM
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CREATE CUSTOM MODAL */}
          {showCreateCustom && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <form onSubmit={handleCreateCustomNotebook} className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden text-xs flex flex-col">
                <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
                  <h4 className="font-serif font-bold text-sm">Novo Caderno Temático</h4>
                  <button type="button" onClick={() => setShowCreateCustom(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Título do Caderno</label>
                    <input
                      type="text"
                      value={newCustomTitle}
                      onChange={e => setNewCustomTitle(e.target.value)}
                      placeholder="Ex: Terapia de Casal e Vínculos"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Link do NotebookLM (Opcional)</label>
                    <input
                      type="url"
                      value={newCustomUrl}
                      onChange={e => setNewCustomUrl(e.target.value)}
                      placeholder="https://notebooklm.google.com/notebook/..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Crie um notebook no Google NotebookLM e cole o link dele aqui para mantê-lo integrado ao SerenaPsi.
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
                  <button type="button" onClick={() => setShowCreateCustom(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                    Salvar Caderno
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}


      {/* =========================================================================
          VIEW 3: PREPARAR CASO PARA SUPERVISÃO (WIZARD STEPS)
          ========================================================================= */}
      {activeView === "supervisao" && (
        <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-6">
          
          {/* STEP HEADER INDICATOR */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Assistente Clínico de Supervisão</span>
              <h2 className="text-xl font-serif font-bold text-slate-900">Etapa {wizardStep} de 7: {
                wizardStep === 1 ? "Selecionar Paciente" :
                wizardStep === 2 ? "Selecionar Sessões" :
                wizardStep === 3 ? "Foco / Questão de Supervisão" :
                wizardStep === 4 ? "Selecionar Conteúdos Clínicos" :
                wizardStep === 5 ? "Proteção de Dados & Privacidade" :
                wizardStep === 6 ? "Pré-visualização do Documento" : "Concluído!"
              }</h2>
            </div>
            {wizardStep > 1 && wizardStep < 7 && (
              <button
                onClick={() => setWizardStep(prev => prev - 1)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>

          {/* STEP 1: SELECT SINGLE PATIENT */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Selecione o paciente do qual deseja preparar o material clínico. Por motivos éticos, o SerenaPsi restringe a exportação a um único paciente por vez para evitar mistura de dados.
              </p>
              {patients.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400">Nenhum paciente cadastrado ou carregado do Google Sheets.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer"
                    >
                      <h4 className="font-bold text-sm text-slate-800">{p.nome_preferencial}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{p.modalidade} • Código: {p.id}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Pseudônimo Estável: {getStablePseudonym(p)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT SESSIONS */}
          {wizardStep === 2 && wizardPatient && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Quais sessões de <strong>{wizardPatient.nome_preferencial}</strong> devem ser incluídas na síntese clínica de supervisão?
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "Todas as sessões" },
                  { id: "3", label: "Últimas 3 sessões" },
                  { id: "5", label: "Últimas 5 sessões" },
                  { id: "10", label: "Últimas 10 sessões" },
                  { id: "custom", label: "Escolher sessões específicas" }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleSessionOptionChange(opt.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      sessionOption === opt.id
                        ? "bg-emerald-800 text-white border-emerald-850"
                        : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* SESSIONS CHECKBOXES FOR CUSTOM OPTION */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                {sessions.filter(s => s.paciente_id === wizardPatient.id).length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center">Nenhuma sessão registrada para este paciente.</p>
                ) : (
                  sessions
                    .filter(s => s.paciente_id === wizardPatient.id)
                    .map(s => {
                      const isSelected = selectedSessionIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSelectSessionId(s.id)}
                          className={`p-3 border-b border-slate-100 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition ${
                            isSelected ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-emerald-800 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="text-left text-xs">
                            <span className="font-bold text-slate-800">
                              {s.data_hora ? new Date(s.data_hora).toLocaleDateString("pt-BR") : "Data não registrada"}
                            </span>
                            <span className="text-slate-400 ml-2">• ID: {s.id}</span>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.foco || "Sem foco clínico registrado"}</p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={selectedSessionIds.length === 0}
                  onClick={() => setWizardStep(3)}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow transition flex items-center gap-1 cursor-pointer ${
                    selectedSessionIds.length === 0 ? "bg-slate-300 cursor-not-allowed" : "bg-emerald-800 hover:bg-emerald-900"
                  }`}
                >
                  <span>Continuar</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DEFINE SUPERVISION QUESTION */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Escreva a pergunta clínica, hipótese ou dúvida principal que você deseja analisar na supervisão deste caso junto ao NotebookLM.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Dúvida / Questão de Supervisão</label>
                <textarea
                  value={supervisionQuestion}
                  onChange={e => setSupervisionQuestion(e.target.value)}
                  placeholder="Ex: Como posso conduzir a reestruturação cognitiva da crença central de defectibilidade diante do comportamento de esquiva social do paciente?"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[100px] font-sans"
                  required
                />
              </div>

              {/* QUICK SUGGESTIONS CHIPS */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sugestões de Foco Clínico</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Revisar conceituação cognitiva clínica do caso",
                    "Definir foco terapêutico prioritário para os sintomas",
                    "Avaliar progresso clínico e planejar alta terapêutica",
                    "Compreender impasse na relação e vínculo terapêutico",
                    "Planejar próximas intervenções práticas comportamentais",
                    "Revisar hipóteses diagnósticas cognitivo-comportamentais (TCC)",
                    "Revisar hipóteses da Terapia do Esquema e modos ativos"
                  ].map(sug => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setSupervisionQuestion(sug)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 rounded-full text-[11px] transition text-left cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  disabled={!supervisionQuestion.trim()}
                  onClick={() => setWizardStep(4)}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow transition flex items-center gap-1 cursor-pointer ${
                    !supervisionQuestion.trim() ? "bg-slate-300 cursor-not-allowed" : "bg-emerald-800 hover:bg-emerald-900"
                  }`}
                >
                  <span>Continuar</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SELECT CONTENTS */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Selecione as categorias de dados clínicos cadastrados no prontuário que você quer exportar para a análise.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                {[
                  { id: "resumo", label: "Resumo Clínico da Sessão" },
                  { id: "foco_sessao", label: "Foco Principal das Sessões" },
                  { id: "intervencoes", label: "Intervenções Realizadas" },
                  { id: "tarefas", label: "Tarefas Terapêuticas Passadas" },
                  { id: "combinados", label: "Combinados e Planos de Ação" },
                  { id: "evolucao", label: "Evolução e Análise de Humor" },
                  { id: "escalas", label: "Escalas e Resultados de Testes" },
                  { id: "formulacao_clinica", label: "Formulação e Conceituação Cognitiva" },
                  { id: "observacoes_selecionadas", label: "Observações Clínicas Adicionais" }
                ].map(tag => {
                  const isChecked = selectedContentTags.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer transition ${
                        isChecked ? "bg-emerald-50/10 border-emerald-500 font-semibold" : "bg-white border-slate-150 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedContentTags(selectedContentTags.filter(t => t !== tag.id));
                          } else {
                            setSelectedContentTags([...selectedContentTags, tag.id]);
                          }
                        }}
                        className="rounded text-emerald-800 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700">{tag.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={selectedContentTags.length === 0}
                  onClick={preparePrivacyCheck}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow transition flex items-center gap-1 cursor-pointer ${
                    selectedContentTags.length === 0 ? "bg-slate-300 cursor-not-allowed" : "bg-emerald-800 hover:bg-emerald-900"
                  }`}
                >
                  <span>Analisar Privacidade</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: PRIVACY & ANONYMIZATION CHECK (MANDATORY) */}
          {wizardStep === 5 && wizardPatient && (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl p-4 text-xs space-y-1.5">
                <h4 className="font-bold flex items-center gap-1">
                  <AlertTriangle size={15} className="text-amber-700" />
                  <span>Aviso Importante de Privacidade & Proteção de Dados (CFP e LGPD)</span>
                </h4>
                <p className="leading-relaxed">
                  A anonimização automática baseia-se na substituição estável dos identificadores cadastrados. No entanto, ela não garante conformidade integral de forma isolada. O sigilo do paciente é uma obrigação ética indelegável do profissional.
                </p>
              </div>

              <p className="text-xs text-slate-600">
                O SerenaPsi analisou o texto das sessões selecionadas e detectou os seguintes termos sensíveis do(a) paciente <strong>{wizardPatient.nome_preferencial}</strong> para substituição pelo pseudônimo <strong>{pseudonymName}</strong>:
              </p>

              {detectedPII.length === 0 ? (
                <p className="text-xs text-emerald-700 font-bold bg-emerald-50 p-3 rounded-xl">
                  Nenhum identificador explícito de PII (Nome, CPF, Telefone) foi detectado no conteúdo selecionado.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-150 rounded-2xl p-3 bg-slate-50">
                  {detectedPII.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={item.original}>{item.original}</span>
                      <span className="text-[9px] bg-red-50 text-red-700 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* MANDATORY CHECKBOX */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={e => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-800 focus:ring-emerald-500 cursor-pointer h-4 w-4 shrink-0"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed font-semibold">
                    Confirmo que realizei a revisão manual crítica de privacidade dos dados clínicos gerados para exportação, garantindo que não há informações residuais que possam comprometer a identidade do paciente de acordo com os princípios éticos do CFP.
                  </span>
                </label>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Ajustar Conteúdos
                </button>
                <button
                  disabled={!privacyConsent}
                  onClick={handleConfirmPrivacyReview}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow transition flex items-center gap-1 cursor-pointer ${
                    !privacyConsent ? "bg-slate-300 cursor-not-allowed" : "bg-emerald-800 hover:bg-emerald-900"
                  }`}
                >
                  <span>Ir para Pré-visualização</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: PREVIEW AND EDIT (MANDATORY BEFORE GENERATING) */}
          {wizardStep === 6 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Esta é a pré-visualização textual exata do que será gerado e copiado para o Google Drive. Sinta-se livre para editar, apagar ou adicionar detalhes clínicos antes de exportar.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Editor Rápido de Pré-visualização</label>
                <textarea
                  value={previewContent}
                  onChange={e => setPreviewContent(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[260px] font-mono leading-relaxed"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Ajustar Privacidade
                </button>
                <button
                  onClick={handleExportSupervisionDoc}
                  className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCheck size={14} />
                  <span>Gerar Documento no Drive</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: CONGRATS & ACTIONS */}
          {wizardStep === 7 && generatedDoc && (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle size={32} className="animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="font-serif font-bold text-xl text-slate-800">Prontuário de Supervisão Gerado!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  O arquivo foi criado com segurança na sua pasta de cadernos do Google Drive com o pseudônimo do paciente para maior segurança.
                </p>
                <p className="text-[11px] font-mono bg-slate-50 border border-slate-150 inline-block px-3 py-1 rounded-xl text-slate-600 mt-2">
                  Nome do arquivo: {generatedDoc.title}
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <a
                  href={generatedDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Documento Google Docs</span>
                </a>

                <button
                  onClick={handleCopyPrompt}
                  className="py-3 px-4 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                >
                  <Copy size={14} />
                  <span>Copiar Prompt de Análise</span>
                </button>

                <a
                  href="https://notebooklm.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-white sm:col-span-2"
                >
                  <BookOpen size={14} className="text-emerald-700" />
                  <span>Abrir Google NotebookLM do Caso</span>
                </a>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <button
                  onClick={() => {
                    setActiveView("home");
                    setError(null);
                  }}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  Voltar ao Menu Inicial
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {/* =========================================================================
          VIEW 4: GUIAS RÁPIDOS (SINGLE UNIFIED SEARCHABLE LIBRARY)
          ========================================================================= */}
      {activeView === "guias" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-serif text-slate-900 font-bold">Biblioteca de Consulta Rápida</h2>
              <p className="text-xs text-slate-500">Consulte termos, distorções, esquemas, intervenções e ferramentas em um único local pesquisável.</p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto shrink-0">
              {/* SEARCH INPUT */}
              <div className="relative flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar termo ou técnica..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* CATEGORIES HORIZONTAL NAVIGATION */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 shrink-0 scrollbar-none">
            {guideCategories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedGuideCategory(cat);
                  setActiveGuideDetail(null);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedGuideCategory === cat
                    ? "bg-emerald-800 text-white"
                    : "bg-white text-slate-600 border border-slate-150 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* MAIN TWO-COLUMN OR SINGLE LAYOUT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* LEFT COLUMN: GUIDES RESULTS LIST */}
            <div className={`space-y-3 ${activeGuideDetail ? "md:col-span-1" : "md:col-span-3"}`}>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                Resultados encontrados ({getFilteredGuides().length})
              </span>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {getFilteredGuides().length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-3xl">
                    Nenhum termo clínico encontrado para esta pesquisa.
                  </p>
                ) : (
                  getFilteredGuides().map(guide => (
                    <div
                      key={guide.id}
                      onClick={() => handleSelectGuide(guide)}
                      className={`p-4 bg-white border rounded-3xl cursor-pointer text-left transition ${
                        activeGuideDetail?.id === guide.id
                          ? "border-emerald-500 bg-emerald-50/10 shadow-xs"
                          : "border-slate-150 hover:border-slate-350"
                      }`}
                    >
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{guide.category}</span>
                      <h4 className="font-serif font-bold text-sm text-slate-800">{guide.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{guide.definition}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: ACTIVE GUIDE DETAIL */}
            {activeGuideDetail && (
              <div className="md:col-span-2 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in">
                
                {/* DETAIL HEADER */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block mb-1">
                      {activeGuideDetail.category}
                    </span>
                    <h3 className="font-serif font-bold text-xl text-slate-900">{activeGuideDetail.title}</h3>
                  </div>
                  <button
                    onClick={() => setActiveGuideDetail(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* DETAIL BODY */}
                <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                  
                  {/* DEFINITION */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Definição Clínica</span>
                    <p className="bg-slate-50 p-3 rounded-2xl border border-slate-100">{activeGuideDetail.definition}</p>
                  </div>

                  {/* SIGNS */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Sinais Clínicos / Indicadores</span>
                    <p>{activeGuideDetail.signs}</p>
                  </div>

                  {/* EXAMPLES */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Exemplos Práticos & Pensamentos</span>
                    <p className="italic text-slate-500 border-l-2 border-emerald-300 pl-3">"{activeGuideDetail.examples}"</p>
                  </div>

                  {/* QUESTIONS */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Perguntas de Investigação Socrática</span>
                    <p className="font-mono text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{activeGuideDetail.questions}</p>
                  </div>

                  {/* INTERVENTIONS */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Intervenções e Manejo Recomendado</span>
                    <p>{activeGuideDetail.interventions}</p>
                  </div>

                  {/* MATERIALS */}
                  {activeGuideDetail.materials && (
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block text-emerald-800">Materiais & Ferramentas Associadas</span>
                      <p className="font-semibold text-emerald-950">{activeGuideDetail.materials}</p>
                    </div>
                  )}

                </div>

                {/* STUDY BUTTON */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <a
                    href="https://notebooklm.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen size={14} />
                    <span>Estudar no NotebookLM</span>
                  </a>
                </div>

              </div>
            )}

          </div>
        </div>
      )}


      {/* =========================================================================
          GLOBAL OVERLAYS & MODALS
          ========================================================================= */}

      {/* SYNCHRONIZE OVERLAY ALERT */}
      {syncNotice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden text-xs flex flex-col p-6 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-2xl shrink-0 border border-emerald-100">
                <RefreshCw size={20} className="animate-spin text-emerald-800" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-base text-slate-900">Fonte Pronta no Google Drive</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Material criado com sucesso no Drive. Lembre-se de que o Google NotebookLM exige uma ação manual simples de sincronização.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2 text-slate-600">
              <span className="font-bold block uppercase text-[10px] tracking-wider text-slate-500">O que fazer agora?</span>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li>Clique no botão <strong>Abrir Notebook</strong> abaixo.</li>
                <li>Dentro da tela do NotebookLM, clique na seção <strong>"Fontes"</strong> (lado esquerdo).</li>
                <li>Localize o arquivo <strong>"[Fonte] {syncNotice.title}"</strong> e selecione <strong>"Sincronizar"</strong> ou adicione-o como nova fonte no Drive.</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSyncNotice(null)}
                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold cursor-pointer"
              >
                Entendi
              </button>
              <a
                href={syncNotice.notebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSyncNotice(null)}
                className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition text-center flex items-center gap-1 cursor-pointer"
              >
                <span>Abrir Notebook</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* NOTEBOOKLM CONFIG LINK MODAL */}
      {showConfigModal && activeConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden text-xs flex flex-col">
            <div className="bg-slate-950 text-white px-5 py-4 flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm">Editar Caderno — {activeConfig.titulo}</h4>
              <button type="button" onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Título do Caderno</label>
                <input
                  type="text"
                  value={inputNotebookTitle}
                  onChange={e => setInputNotebookTitle(e.target.value)}
                  placeholder="Ex: TCC — Base Científica"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Link de Compartilhamento do NotebookLM</label>
                <input
                  type="url"
                  value={inputNotebookUrl}
                  onChange={e => setInputNotebookUrl(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Abra o Notebook correspondente em <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-emerald-800">notebooklm.google.com</a>, copie o link do navegador e cole aqui.
                </span>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowConfigModal(false)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSaveConfigModal}
                disabled={savingConfig}
                className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer"
              >
                {savingConfig ? "Salvando..." : "Salvar Link"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
