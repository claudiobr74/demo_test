export interface Cobranca {
  id: string;
  paciente_id: string;
  responsavel_financeiro: string;
  origem: string; // "Sessão Avulsa" | "Pacote" | "Mensalidade"
  periodo_sessao_id: string; // ID da sessão vinculada ou período
  valor_original: number;
  desconto: number;
  acrescimo: number;
  valor_pago: number;
  saldo_restante: number;
  data_vencimento: string;
  situacao: "Prevista" | "Pendente" | "Parcialmente paga" | "Paga" | "Atrasada" | "Cancelada" | "Isenta ou Cortesia" | "Estornada";
  forma_pagamento: "Pix" | "Dinheiro" | "Cartão de débito" | "Cartão de crédito" | "Transferência" | "Outro";
  situacao_recibo: "Não solicitado" | "Gerado" | "Enviado";
  situacao_nfse: "Não solicitada" | "Solicitada" | "Emitida" | "Enviada";
  observacoes: string;
  legacyPartialAmountUnknown?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface Pagamento {
  id: string;
  cobranca_id: string;
  paciente_id: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento: string;
  comprovante_url?: string;
  observacoes?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface Plano {
  id: string;
  paciente_id: string;
  tipo: "Sessão avulsa" | "Pacote pré-pago" | "Mensalidade recorrente" | "Pacote pós-pago";
  nome: string;
  qtd_sessoes: number;
  sessoes_usadas?: number;
  sessoes_restantes?: number;
  valor: number;
  vencimento_dia: number;
  validade: string; // e.g., "Indeterminada" ou data
  status: "Ativo" | "Pausado" | "Suspenso" | "Finalizado";
  renovacao_auto: "Sim" | "Não";
  reajuste_index: string; // "IPCA" | "IGP-M" | "Nenhum"
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditoSessao {
  id: string;
  paciente_id: string;
  plano_id: string;
  sessao_id: string;
  data_consumo: string;
  creditos_anteriores: number;
  creditos_restantes: number;
  justificativa: string;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria: string;
  situacao: "Prevista" | "Pendente" | "Paga" | "Atrasada" | "Cancelada" | "Estornada";
  recorrente: "Sim" | "Não";
  conta_pagamento: string;
  competencia: string; // format "MM/YYYY"
  centro_custo: string;
  fornecedor: string;
  comprovante_url: string;
  observacoes: string;
  parcelamento: string; // e.g. "1/1"
}

export interface Fechamento {
  id: string;
  competencia: string; // format "MM/YYYY"
  data_fechamento: string;
  usuario: string;
  resumo_json: string;
  situacao: "Fechado" | "Reaberto";
}
