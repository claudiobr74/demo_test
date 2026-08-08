import React, { useState } from "react";
import { generateUUID } from "../../lib/uuid";
import { Cobranca, Plano, Pagamento } from "./FinanceTypes";
import { Search, Plus, MessageSquare, FileText, CheckCircle2, AlertTriangle, Play, Pause, RefreshCw, X, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface FinanceRecebimentosProps {
  cobrancas: Cobranca[];
  pagamentos?: Pagamento[];
  planos: Plano[];
  patients: any[];
  onAddCobranca: (c: Cobranca) => void;
  onUpdateCobranca: (c: Cobranca) => void;
  onAddPlano: (p: Plano) => void;
  onUpdatePlano: (p: Plano) => void;
  onAddPagamento: (p: Pagamento) => void;
  onOpenReceipt: (c: Cobranca, pName: string) => void;
  onOpenCobrar: (c: Cobranca) => void;
}

export default function FinanceRecebimentos({
  cobrancas,
  pagamentos = [],
  planos,
  patients,
  onAddCobranca,
  onUpdateCobranca,
  onAddPlano,
  onUpdatePlano,
  onAddPagamento,
  onOpenReceipt,
  onOpenCobrar
}: FinanceRecebimentosProps) {
  const [activeSubTab, setActiveSubTab] = useState<"cobrancas" | "planos">("cobrancas");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Modals
  const [isAddingCobranca, setIsAddingCobranca] = useState(false);
  const [isAddingPlano, setIsAddingPlano] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState<Cobranca | null>(null);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState<Plano | null>(null);

  // Form states for Invoice
  const [invPatientId, setInvPatientId] = useState("");
  const [invOrigem, setInvOrigem] = useState("Sessão Avulsa");
  const [invValor, setInvValor] = useState(150);
  const [invVencimento, setInvVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [invObs, setInvObs] = useState("");

  // Form states for Plan
  const [plPatientId, setPlPatientId] = useState("");
  const [plTipo, setPlTipo] = useState<Plano["tipo"]>("Pacote pré-pago");
  const [plNome, setPlNome] = useState("Mensalidade 4 Sessões");
  const [plQtdSessoes, setPlQtdSessoes] = useState(4);
  const [plValor, setPlValor] = useState(600);
  const [plVencimentoDia, setPlVencimentoDia] = useState(10);
  const [plValidade, setPlValidade] = useState("Indeterminada");
  const [plRenovacao, setPlRenovacao] = useState<"Sim" | "Não">("Sim");
  const [plReajuste, setPlReajuste] = useState("Nenhum");

  // Form states for Payment
  const [payValor, setPayValor] = useState(150);
  const [payForma, setPayForma] = useState<Cobranca["forma_pagamento"]>("Pix");
  const [payObs, setPayObs] = useState("");

  // Form states for manual credits adjustment
  const [adjCreds, setAdjCreds] = useState(0);
  const [adjJustification, setAdjJustification] = useState("");

  const getPatientName = (id: string) => {
    const pat = patients.find(p => p.id === id);
    return pat ? pat.nome_preferencial : "Paciente";
  };

  const getPatientEmail = (id: string) => {
    const pat = patients.find(p => p.id === id);
    return pat ? pat.contato_email : "";
  };

  const getPatientPhone = (id: string) => {
    const pat = patients.find(p => p.id === id);
    return pat ? pat.contato_telefone : "";
  };

  // Filter Invoice lists
  const filteredCobrancas = cobrancas.filter(c => {
    const patientName = getPatientName(c.paciente_id).toLowerCase();
    const matchesSearch = patientName.includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || c.situacao === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredPlanos = planos.filter(p => {
    const patientName = getPatientName(p.paciente_id).toLowerCase();
    return patientName.includes(searchTerm.toLowerCase());
  });

  // Action: Add Invoice
  const handleCreateCobrancaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invPatientId) return alert("Selecione um paciente!");
    const newId = generateUUID();
    const newCob: Cobranca = {
      id: newId,
      paciente_id: invPatientId,
      responsavel_financeiro: getPatientName(invPatientId),
      origem: invOrigem,
      periodo_sessao_id: new Date(invVencimento).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
      valor_original: Number(invValor),
      desconto: 0,
      acrescimo: 0,
      valor_pago: 0,
      saldo_restante: Number(invValor),
      data_vencimento: invVencimento,
      situacao: "Pendente",
      forma_pagamento: "Pix",
      situacao_recibo: "Não solicitado",
      situacao_nfse: "Não solicitada",
      observacoes: invObs
    };
    onAddCobranca(newCob);
    setIsAddingCobranca(false);
  };

  // Action: Add Plan
  const handleCreatePlanoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plPatientId) return alert("Selecione um paciente!");
    const newId = generateUUID();
    const newPl: Plano = {
      id: newId,
      paciente_id: plPatientId,
      tipo: plTipo,
      nome: plNome,
      qtd_sessoes: Number(plQtdSessoes),
      valor: Number(plValor),
      vencimento_dia: Number(plVencimentoDia),
      validade: plValidade,
      status: "Ativo",
      renovacao_auto: plRenovacao,
      reajuste_index: plReajuste
    };
    onAddPlano(newPl);
    setIsAddingPlano(false);
  };

  // Action: Receive partial/full payment
  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingPayment) return;
    const paymentId = generateUUID();
    const pValue = Number(payValor);

    const updatedPaid = isAddingPayment.valor_pago + pValue;
    const updatedBalance = Math.max(0, isAddingPayment.valor_original - updatedPaid);
    const updatedSituacao = updatedBalance === 0 ? "Paga" : "Parcialmente paga";

    const updatedCob: Cobranca = {
      ...isAddingPayment,
      valor_pago: updatedPaid,
      saldo_restante: updatedBalance,
      situacao: updatedSituacao,
      forma_pagamento: payForma
    };

    const newPay: Pagamento = {
      id: paymentId,
      cobranca_id: isAddingPayment.id,
      paciente_id: isAddingPayment.paciente_id,
      valor_pago: pValue,
      data_pagamento: new Date().toISOString().split("T")[0],
      forma_pagamento: payForma,
      comprovante_url: "",
      observacoes: payObs
    };

    onAddPagamento(newPay);
    onUpdateCobranca(updatedCob);
    setIsAddingPayment(null);
  };

  // Action: One-Click Receive
  const handleOneClickReceive = (c: Cobranca, e: React.MouseEvent) => {
    e.stopPropagation();
    const paymentId = generateUUID();
    const pValue = c.saldo_restante;

    const updatedCob: Cobranca = {
      ...c,
      valor_pago: c.valor_pago + pValue,
      saldo_restante: 0,
      situacao: "Paga",
      forma_pagamento: "Pix" // assume Pix for 1-click
    };

    const newPay: Pagamento = {
      id: paymentId,
      cobranca_id: c.id,
      paciente_id: c.paciente_id,
      valor_pago: pValue,
      data_pagamento: new Date().toISOString().split("T")[0],
      forma_pagamento: "Pix",
      comprovante_url: "",
      observacoes: "Baixa rápida"
    };

    onAddPagamento(newPay);
    onUpdateCobranca(updatedCob);
  };

  // Action: Manual Adjust Plan credits
  const handleAdjustCreditsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdjustingCredits) return;
    if (!adjJustification.trim()) return alert("Forneça uma justificativa obrigatória!");

    const updatedPlano: Plano = {
      ...isAdjustingCredits,
      qtd_sessoes: Math.max(0, isAdjustingCredits.qtd_sessoes + adjCreds)
    };

    onUpdatePlano(updatedPlano);
    setIsAdjustingCredits(null);
    setAdjJustification("");
    setAdjCreds(0);
  };

  // Toggle Plan Status
  const handleTogglePlanStatus = (pl: Plano) => {
    const nextStatus: Plano["status"] = pl.status === "Ativo" ? "Pausado" : "Ativo";
    const updated: Plano = { ...pl, status: nextStatus };
    onUpdatePlano(updated);
  };

  // Admin: Solicitar NFS-e message
  const handleSolicitarNfse = (c: Cobranca) => {
    const pName = getPatientName(c.paciente_id);
    const message = `Prezada contabilidade, gostaria de solicitar a emissão de NFS-e para o paciente ${pName}, CPF sob cadastro, no valor de R$ ${c.valor_pago.toFixed(2)}, referente ao atendimento do período ${c.periodo_sessao_id}. Obrigado!`;
    const updated: Cobranca = { ...c, situacao_nfse: "Solicitada" };
    onUpdateCobranca(updated);
    alert(`Solicitação administrativa de NFS-e registrada!\n\nMensagem gerada para o contador:\n"${message}"`);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Sub Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveSubTab("cobrancas")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === "cobrancas" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            Cobranças & Faturas
          </button>
          <button
            onClick={() => setActiveSubTab("planos")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === "planos" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            Planos & Pacotes dos Pacientes
          </button>
        </div>

        {/* Inputs */}
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 font-sans bg-white"
            />
          </div>

          {activeSubTab === "cobrancas" ? (
            <button
              onClick={() => setIsAddingCobranca(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Nova Fatura</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddingPlano(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Novo Plano</span>
            </button>
          )}
        </div>

      </div>

      {/* COBRANCAS PANEL */}
      {activeSubTab === "cobrancas" && (
        <div className="bg-white border border-slate-150 rounded-3xl shadow-sm overflow-hidden">
          
          {/* Status filters */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {["all", "Pendente", "Paga", "Atrasada", "Parcialmente paga"].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg transition border cursor-pointer ${filterStatus === st ? "bg-white text-emerald-800 border-emerald-100 font-bold shadow-sm" : "border-transparent hover:text-slate-700"}`}
              >
                {st === "all" ? "Todos" : st}
              </button>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/45 text-slate-500 font-bold">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Origem</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Saldo Restante</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCobrancas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Nenhum registro de faturamento encontrado.</td>
                  </tr>
                ) : (
                  filteredCobrancas.map(c => {
                    const isExpanded = expandedInvoiceId === c.id;
                    const pName = getPatientName(c.paciente_id);
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-slate-50/60 transition group cursor-pointer" onClick={() => setExpandedInvoiceId(isExpanded ? null : c.id)}>
                          <td className="px-6 py-4 font-bold text-slate-900 flex items-center space-x-2">
                            <span>{pName}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{c.origem}</td>
                          <td className="px-6 py-4 text-slate-500">{new Date(c.data_vencimento).toLocaleDateString("pt-BR")}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">R$ {c.valor_original.toFixed(2)}</td>
                          <td className="px-6 py-4 text-slate-500">R$ {c.saldo_restante.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              c.situacao === "Paga" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                              c.situacao === "Atrasada" ? "bg-red-50 text-red-800 border border-red-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                            }`}>
                              {c.situacao}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1" onClick={e => e.stopPropagation()}>
                            {c.situacao !== "Paga" && (
                              <>
                                <button
                                  onClick={(e) => handleOneClickReceive(c, e)}
                                  className="px-2.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-[10px] transition cursor-pointer flex items-center space-x-1"
                                  title="Baixa rápida de pagamento"
                                >
                                  <Check size={12} />
                                  <span>Recebido</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIsAddingPayment(c); }}
                                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-[10px] transition cursor-pointer"
                                  title="Recebimento parcial ou detalhes"
                                >
                                  ...
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onOpenCobrar(c); }}
                                  className="px-2.5 py-1.5 border border-emerald-100 text-emerald-800 hover:bg-emerald-50 rounded-xl font-bold text-[10px] transition cursor-pointer"
                                >
                                  Cobrar
                                </button>
                              </>
                            )}
                            {c.situacao === "Paga" && (
                              <>
                                <button
                                  onClick={() => onOpenReceipt(c, pName)}
                                  className="px-2.5 py-1.5 bg-slate-55 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold text-[10px] transition cursor-pointer"
                                >
                                  Recibo
                                </button>
                                <button
                                  onClick={() => handleSolicitarNfse(c)}
                                  className="px-2.5 py-1.5 bg-slate-55 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-bold text-[10px] transition cursor-pointer"
                                >
                                  NFS-e
                                </button>
                              </>
                            )}
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4 font-sans text-slate-600 space-y-4 border-t border-slate-100/50">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 leading-relaxed">
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">ID Único da Cobrança</p>
                                  <p className="font-mono text-[11px] font-semibold text-slate-800">{c.id}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">Desconto / Acréscimo</p>
                                  <p className="text-[11px] font-semibold text-slate-800">R$ {c.desconto.toFixed(2)} / R$ {c.acrescimo.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">Situação Recibo / NFS-e</p>
                                  <p className="text-[11px] font-semibold text-slate-800">{c.situacao_recibo} / {c.situacao_nfse}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">Observações Administrativas</p>
                                  <p className="text-[11px] font-semibold text-slate-800 italic">{c.observacoes || "Nenhuma observação."}</p>
                                </div>
                              </div>

                              {/* Histórico Auditável de Pagamentos Parciais/Totais */}
                              <div className="pt-2 border-t border-slate-200/60">
                                <h6 className="text-[11px] font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center space-x-1">
                                  <span>Histórico de Pagamentos Lançados</span>
                                  <span className="text-slate-400 font-normal">({pagamentos.filter(p => p.cobranca_id === c.id).length})</span>
                                </h6>

                                {pagamentos.filter(p => p.cobranca_id === c.id).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">Nenhum pagamento registrado para esta cobrança ainda.</p>
                                ) : (
                                  <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden text-[11px]">
                                    <table className="w-full text-left">
                                      <thead className="bg-slate-100/70 text-slate-500 font-bold border-b border-slate-200/60">
                                        <tr>
                                          <th className="px-3 py-1.5">Data Pagamento</th>
                                          <th className="px-3 py-1.5">Valor Pago</th>
                                          <th className="px-3 py-1.5">Forma</th>
                                          <th className="px-3 py-1.5">Observação</th>
                                          <th className="px-3 py-1.5">Lançado por</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {pagamentos.filter(p => p.cobranca_id === c.id).map(p => (
                                          <tr key={p.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5 font-semibold text-slate-800">
                                              {new Date(p.data_pagamento).toLocaleDateString("pt-BR")}
                                            </td>
                                            <td className="px-3 py-1.5 font-bold text-emerald-800">
                                              R$ {Number(p.valor_pago).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-600">{p.forma_pagamento}</td>
                                            <td className="px-3 py-1.5 text-slate-500 italic">{p.observacoes || "—"}</td>
                                            <td className="px-3 py-1.5 text-slate-400 text-[10px]">{p.createdBy || "Sistema"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card list */}
          <div className="block md:hidden p-4 space-y-4 font-sans text-xs">
            {filteredCobrancas.length === 0 ? (
              <p className="text-center text-slate-400 italic py-6">Nenhum registro encontrado.</p>
            ) : (
              filteredCobrancas.map(c => {
                const pName = getPatientName(c.paciente_id);
                return (
                  <div key={c.id} className="p-4 bg-slate-50/40 border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-slate-900">{pName}</h5>
                        <p className="text-[10px] text-slate-400">{c.origem} • Ref: {c.periodo_sessao_id}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        c.situacao === "Paga" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                      }`}>
                        {c.situacao}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline border-t border-slate-100/50 pt-2 text-[11px]">
                      <span className="text-slate-400">Valor Original:</span>
                      <strong className="text-slate-900">R$ {c.valor_original.toFixed(2)}</strong>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                      {c.situacao !== "Paga" ? (
                        <>
                          <button onClick={(e) => handleOneClickReceive(c, e)} className="px-3 py-1.5 bg-emerald-800 text-white rounded-xl font-bold text-[10px] cursor-pointer flex items-center space-x-1">
                            <Check size={12} />
                            <span>Recebido</span>
                          </button>
                          <button onClick={() => onOpenCobrar(c)} className="px-3 py-1.5 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-[10px] cursor-pointer">
                            Cobrar
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onOpenReceipt(c, pName)} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-[10px] cursor-pointer">
                            Recibo
                          </button>
                          <button onClick={() => handleSolicitarNfse(c)} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-[10px] cursor-pointer">
                            NFS-e
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* PLANOS PANEL */}
      {activeSubTab === "planos" && (
        <div className="bg-white border border-slate-150 rounded-3xl shadow-sm overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/45 text-slate-500 font-bold">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Plano</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Sessões Restantes</th>
                  <th className="px-6 py-4">Mensalidade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlanos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Nenhum plano ou contrato de pacote ativo.</td>
                  </tr>
                ) : (
                  filteredPlanos.map(p => {
                    const pName = getPatientName(p.paciente_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">{pName}</td>
                        <td className="px-6 py-4 text-slate-500">{p.nome}</td>
                        <td className="px-6 py-4 text-slate-400">{p.tipo}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          {p.qtd_sessoes} sessões
                          {p.qtd_sessoes <= 1 && (
                            <span className="ml-2 inline-block w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" title="Crédito crítico!" />
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">R$ {p.valor.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${p.status === "Ativo" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <button
                            onClick={() => handleTogglePlanStatus(p)}
                            className="px-2.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[10px] cursor-pointer"
                          >
                            {p.status === "Ativo" ? "Pausar" : "Ativar"}
                          </button>
                          <button
                            onClick={() => setIsAdjustingCredits(p)}
                            className="px-2.5 py-1.5 bg-slate-55 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[10px] cursor-pointer"
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card list */}
          <div className="block md:hidden p-4 space-y-4 font-sans text-xs">
            {filteredPlanos.length === 0 ? (
              <p className="text-center text-slate-400 italic py-6">Nenhum contrato ativo.</p>
            ) : (
              filteredPlanos.map(p => {
                const pName = getPatientName(p.paciente_id);
                return (
                  <div key={p.id} className="p-4 bg-slate-50/40 border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-slate-900">{pName}</h5>
                        <p className="text-[10px] text-slate-400">{p.nome} • {p.tipo}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${p.status === "Ativo" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] border-t border-slate-100/50 pt-2">
                      <span className="text-slate-400">Saldo Atual:</span>
                      <strong className="text-slate-900">{p.qtd_sessoes} sessões</strong>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                      <button onClick={() => handleTogglePlanStatus(p)} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-[10px] cursor-pointer">
                        {p.status === "Ativo" ? "Pausar" : "Reativar"}
                      </button>
                      <button onClick={() => setIsAdjustingCredits(p)} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-[10px] cursor-pointer">
                        Ajustar Créditos
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* POPUP: REGISTER MANUAL COBRANCA */}
      {isAddingCobranca && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateCobrancaSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm">Lançar Nova Fatura Administrativa</h4>
              <button type="button" onClick={() => setIsAddingCobranca(false)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Paciente Associado</label>
                <select
                  value={invPatientId}
                  onChange={e => setInvPatientId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  required
                >
                  <option value="">Selecione o paciente...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.nome_preferencial}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Valor Original (R$)</label>
                  <input
                    type="number"
                    value={invValor}
                    onChange={e => setInvValor(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Vencimento</label>
                  <input
                    type="date"
                    value={invVencimento}
                    onChange={e => setInvVencimento(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Origem de Faturamento</label>
                <select
                  value={invOrigem}
                  onChange={e => setInvOrigem(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="Sessão Avulsa">Sessão Avulsa</option>
                  <option value="Pacote Pré-Pago">Pacote Pré-Pago</option>
                  <option value="Mensalidade Recorrente">Mensalidade Recorrente</option>
                  <option value="Acordo Administrativo">Acordo Administrativo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Observações Administrativas (Privado)</label>
                <textarea
                  value={invObs}
                  onChange={e => setInvObs(e.target.value)}
                  placeholder="Instruções privadas de faturamento ou detalhes..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 resize-none"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddingCobranca(false)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                Lançar Fatura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP: NEW PLAN */}
      {isAddingPlano && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreatePlanoSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm">Criar Novo Plano / Pacote</h4>
              <button type="button" onClick={() => setIsAddingPlano(false)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Paciente</label>
                <select
                  value={plPatientId}
                  onChange={e => setPlPatientId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  required
                >
                  <option value="">Selecione o paciente...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.nome_preferencial}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tipo do Plano</label>
                <select
                  value={plTipo}
                  onChange={e => setPlTipo(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="Pacote pré-pago">Pacote Pré-Pago (Créditos antecipados)</option>
                  <option value="Mensalidade recorrente">Mensalidade Recorrente (Cobrança mensal contratual)</option>
                  <option value="Pacote pós-pago">Pacote Pós-Pago (Faturado ao final)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Nome do Plano/Contrato</label>
                <input
                  type="text"
                  value={plNome}
                  onChange={e => setPlNome(e.target.value)}
                  placeholder="Ex: Mensalidade Psicoterapia 4x"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Créditos Iniciais (Sessões)</label>
                  <input
                    type="number"
                    value={plQtdSessoes}
                    onChange={e => setPlQtdSessoes(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Valor Mensal / Total (R$)</label>
                  <input
                    type="number"
                    value={plValor}
                    onChange={e => setPlValor(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              {/* Advanced collapsibles (Progressive Disclosure) */}
              <details className="space-y-3 cursor-pointer select-none">
                <summary className="text-[10px] text-emerald-800 font-bold hover:text-emerald-950 transition py-1">Mais opções avançadas</summary>
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Vencimento (Dia)</label>
                      <input
                        type="number"
                        value={plVencimentoDia}
                        onChange={e => setPlVencimentoDia(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Renovação Automática</label>
                      <select
                        value={plRenovacao}
                        onChange={e => setPlRenovacao(e.target.value as any)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="Sim">Sim, renovar no vencimento</option>
                        <option value="Não">Não, encerrar ao zerar créditos</option>
                      </select>
                    </div>
                  </div>
                </div>
              </details>

            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddingPlano(false)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                Cadastrar Plano
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP: RECEIVE PAYMENT FORM */}
      {isAddingPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddPaymentSubmit} className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h4 className="font-serif font-bold text-sm">Receber Quitação</h4>
                <p className="text-[10px] text-emerald-300">Paciente: {getPatientName(isAddingPayment.paciente_id)}</p>
              </div>
              <button type="button" onClick={() => setIsAddingPayment(null)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-emerald-50/50 border border-emerald-100/60 p-3 rounded-2xl flex justify-between items-center leading-relaxed">
                <div>
                  <p className="text-[10px] text-slate-400">Total Fatura</p>
                  <p className="text-sm font-bold text-slate-900">R$ {isAddingPayment.valor_original.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Saldo Restante</p>
                  <p className="text-sm font-bold text-amber-800">R$ {isAddingPayment.saldo_restante.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Sendo Pago (R$)</label>
                <input
                  type="number"
                  value={payValor}
                  max={isAddingPayment.saldo_restante}
                  onChange={e => setPayValor(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Forma de Pagamento</label>
                <select
                  value={payForma}
                  onChange={e => setPayForma(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de débito">Cartão de débito</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                  <option value="Transferência">Transferência bancária</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Observações do Recebimento (Opcional)</label>
                <input
                  type="text"
                  value={payObs}
                  onChange={e => setPayObs(e.target.value)}
                  placeholder="Ex: Pago com comprovante anexo via whatsapp"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddingPayment(null)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                Confirmar Recebimento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP: MANUAL CREDITS ADJUSTMENT */}
      {isAdjustingCredits && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAdjustCreditsSubmit} className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h4 className="font-serif font-bold text-sm">Ajustar Saldo de Pacote</h4>
                <p className="text-[10px] text-emerald-300">{getPatientName(isAdjustingCredits.paciente_id)}</p>
              </div>
              <button type="button" onClick={() => setIsAdjustingCredits(null)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 font-sans text-xs">
              <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl flex gap-2.5 text-amber-950 leading-relaxed">
                <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[10px]"><strong>Rastreabilidade de Auditoria:</strong> Alterações de créditos de sessões exigem justificativa fundamentada por exigências do conselho regional e auditoria do prontuário.</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Ajuste de Crédito (Quantidade)</label>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setAdjCreds(prev => prev - 1)}
                    className="w-10 h-10 border border-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-50 text-center text-sm"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-mono font-bold text-sm text-slate-900">{adjCreds >= 0 ? `+${adjCreds}` : adjCreds} sessões</span>
                  <button
                    type="button"
                    onClick={() => setAdjCreds(prev => prev + 1)}
                    className="w-10 h-10 border border-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-50 text-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Justificativa do Ajuste (Obrigatória)</label>
                <input
                  type="text"
                  value={adjJustification}
                  onChange={e => setAdjJustification(e.target.value)}
                  placeholder="Ex: Acordo de reposição de feriado conforme combinado"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAdjustingCredits(null)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer">
                Confirmar Ajuste
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
