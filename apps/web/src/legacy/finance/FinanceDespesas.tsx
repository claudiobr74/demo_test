import React, { useState } from "react";
import { generateUUID } from "../../lib/uuid";
import { Despesa } from "./FinanceTypes";
import { Search, Plus, Filter, Trash2, CheckCircle, AlertTriangle, Eye, X, ChevronRight } from "lucide-react";

interface FinanceDespesasProps {
  despesas: Despesa[];
  onAddDespesa: (d: Despesa) => void;
  onUpdateDespesa: (d: Despesa) => void;
}

export default function FinanceDespesas({ despesas, onAddDespesa, onUpdateDespesa }: FinanceDespesasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Form states (Progressive Disclosure)
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [cat, setCat] = useState("Impostos & Taxas");
  const [situacao, setSituacao] = useState<Despesa["situacao"]>("Pendente");

  // Advanced fields (under details)
  const [recorrente, setRecorrente] = useState<"Sim" | "Não">("Não");
  const [fornecedor, setFornecedor] = useState("");
  const [obs, setObs] = useState("");

  const categories = [
    "Aluguel & Infraestrutura",
    "Impostos & Taxas",
    "Supervisão & Estudos",
    "Marketing & Divulgação",
    "Softwares & Assinaturas",
    "Outros Custos Clínicos"
  ];

  // Filtering
  const filteredDespesas = despesas.filter(d => {
    const matchesSearch = d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || d.fornecedor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || d.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !valor) return alert("Por favor preencha descrição e valor!");

    const newId = generateUUID();
    const newDesp: Despesa = {
      id: newId,
      descricao: desc,
      valor: Number(valor),
      data_vencimento: vencimento,
      categoria: cat,
      situacao: situacao,
      recorrente: recorrente,
      conta_pagamento: "Conta Principal",
      competencia: new Date(vencimento).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
      centro_custo: "Clínica Geral",
      fornecedor: fornecedor || "Diverso",
      comprovante_url: "",
      observacoes: obs,
      parcelamento: "1/1"
    };

    onAddDespesa(newDesp);

    // Reset Form
    setDesc("");
    setValor("");
    setVencimento(new Date().toISOString().split("T")[0]);
    setCat("Impostos & Taxas");
    setSituacao("Pendente");
    setRecorrente("Não");
    setFornecedor("");
    setObs("");

    setIsAddingExpense(false);
  };

  const handleTogglePaga = (d: Despesa) => {
    const nextSituacao: Despesa["situacao"] = d.situacao === "Paga" ? "Pendente" : "Paga";
    const updated: Despesa = { ...d, situacao: nextSituacao };
    onUpdateDespesa(updated);
  };

  const handleCancelDesp = (d: Despesa) => {
    if (confirm("Deseja realmente cancelar esta despesa de modo lógico?")) {
      const updated: Despesa = { ...d, situacao: "Cancelada" };
      onUpdateDespesa(updated);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Category Pill Filters */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit overflow-x-auto text-[10px] uppercase font-bold tracking-wider text-slate-400">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-2 rounded-xl transition cursor-pointer ${filterCategory === "all" ? "bg-white text-emerald-800 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
          >
            Todas Categorias
          </button>
          {categories.slice(0, 3).map(c => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-2 rounded-xl transition cursor-pointer ${filterCategory === c ? "bg-white text-emerald-800 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
            >
              {c.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar despesa..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
            />
          </div>

          <button
            onClick={() => setIsAddingExpense(true)}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Nova Conta</span>
          </button>
        </div>

      </div>

      {/* EXPENSES BOARD */}
      <div className="bg-white border border-slate-150 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/45 text-slate-500 font-bold">
                <th className="px-6 py-4">Despesa / Fornecedor</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredDespesas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma conta ou despesa registrada.</td>
                </tr>
              ) : (
                filteredDespesas.map(d => {
                  const isExpanded = expandedExpenseId === d.id;
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="hover:bg-slate-50/60 transition group cursor-pointer" onClick={() => setExpandedExpenseId(isExpanded ? null : d.id)}>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <div>
                            <p>{d.descricao}</p>
                            <p className="text-[10px] text-slate-400 font-normal">Fornecedor: {d.fornecedor}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{d.categoria}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(d.data_vencimento).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">R$ {d.valor.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            d.situacao === "Paga" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                            d.situacao === "Atrasada" ? "bg-red-50 text-red-800 border border-red-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                          }`}>
                            {d.situacao}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleTogglePaga(d)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition cursor-pointer ${
                              d.situacao === "Paga" ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-emerald-800 text-white hover:bg-emerald-900"
                            }`}
                          >
                            {d.situacao === "Paga" ? "Estornar" : "Pagar"}
                          </button>
                          <button
                            onClick={() => handleCancelDesp(d)}
                            className="p-1.5 text-slate-400 hover:text-red-700 transition inline-block align-middle cursor-pointer"
                            title="Deletar lógico"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded private block */}
                      {isExpanded && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={6} className="px-6 py-4 font-sans text-slate-600 space-y-1.5 border-t border-slate-100/50 text-[11px]">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed">
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">ID Único</p>
                                <p className="font-mono text-slate-800 font-semibold">{d.id}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">Recorrente</p>
                                <p className="text-slate-800 font-semibold">{d.recorrente}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">Instruções / Observações privadas</p>
                                <p className="text-slate-800 italic font-semibold">{d.observacoes || "Nenhuma observação."}</p>
                              </div>
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

        {/* Mobile card list */}
        <div className="block md:hidden p-4 space-y-4 font-sans text-xs">
          {filteredDespesas.length === 0 ? (
            <p className="text-center text-slate-400 italic py-6">Nenhuma conta cadastrada.</p>
          ) : (
            filteredDespesas.map(d => {
              return (
                <div key={d.id} className="p-4 bg-slate-50/40 border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-slate-900">{d.descricao}</h5>
                      <p className="text-[10px] text-slate-400">{d.categoria} • Fornecedor: {d.fornecedor}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      d.situacao === "Paga" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                    }`}>
                      {d.situacao}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline border-t border-slate-100/50 pt-2 text-[11px]">
                    <span className="text-slate-400">Valor Original:</span>
                    <strong className="text-slate-900">R$ {d.valor.toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                    <button
                      onClick={() => handleTogglePaga(d)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] cursor-pointer ${
                        d.situacao === "Paga" ? "border border-slate-200 text-slate-700" : "bg-emerald-800 text-white"
                      }`}
                    >
                      {d.situacao === "Paga" ? "Estornar" : "Pagar"}
                    </button>
                    <button onClick={() => handleCancelDesp(d)} className="px-3 py-1.5 border border-slate-200 text-red-700 rounded-xl font-bold text-[10px] cursor-pointer">
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* POPUP: QUICK REGISTER DESPESA */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden font-sans text-xs flex flex-col">
            <div className="bg-emerald-950 text-white px-5 py-4 flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm">Registrar Nova Despesa Clínica</h4>
              <button type="button" onClick={() => setIsAddingExpense(false)} className="text-emerald-200 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Descrição da Conta</label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Ex: Aluguel da Sala 304"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Aluguel", "CRP", "Supervisão", "Internet", "Plataformas (Zoom/Meet)", "Contabilidade", "Materiais"].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDesc(cat)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Valor (R$)</label>
                  <input
                    type="number"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Vencimento</label>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={e => setVencimento(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Categoria</label>
                  <select
                    value={cat}
                    onChange={e => setCat(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Situação Inicial</label>
                  <select
                    value={situacao}
                    onChange={e => setSituacao(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="Pendente">Pendente (Não paga)</option>
                    <option value="Paga">Paga (Quitada)</option>
                    <option value="Prevista">Prevista (Estimada)</option>
                  </select>
                </div>
              </div>

              {/* Advanced collapsibles */}
              <details className="space-y-3 cursor-pointer select-none">
                <summary className="text-[10px] text-emerald-800 font-bold hover:text-emerald-950 transition py-1">Mais opções avançadas</summary>
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Fornecedor / Credor</label>
                      <input
                        type="text"
                        value={fornecedor}
                        onChange={e => setFornecedor(e.target.value)}
                        placeholder="Ex: Condomínio Medical"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Despesa Recorrente</label>
                      <select
                        value={recorrente}
                        onChange={e => setRecorrente(e.target.value as any)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="Sim">Sim, mensal fixa</option>
                        <option value="Não">Não, eventual</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Observações do Registro</label>
                    <input
                      type="text"
                      value={obs}
                      onChange={e => setObs(e.target.value)}
                      placeholder="Instruções adicionais de pagamento..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              </details>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddingExpense(false)} className="px-4 py-2 border border-slate-250 text-slate-600 rounded-xl font-bold cursor-pointer font-sans">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-bold shadow transition cursor-pointer font-sans">
                Registrar Despesa
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
