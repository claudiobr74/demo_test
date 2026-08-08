import React from "react";
import { Cobranca, Despesa } from "./FinanceTypes";
import { DollarSign, TrendingUp, AlertCircle, PlusCircle, CheckCircle, Clock, Calendar, MessageSquare, ChevronRight, Target, Sparkles, AlertTriangle } from "lucide-react";

interface FinanceHojeProps {
  cobrancas: Cobranca[];
  despesas: Despesa[];
  sessions: any[];
  patients: any[];
  onOpenReceivePayment: () => void;
  onOpenAddExpense: () => void;
  onOpenFechamento: () => void;
  onOpenCobrar: (c: Cobranca) => void;
  monthlyGoal: number;
  currentMonth: number;
  currentYear: number;
}

export default function FinanceHoje({
  cobrancas,
  despesas,
  sessions,
  patients,
  onOpenReceivePayment,
  onOpenAddExpense,
  onOpenFechamento,
  onOpenCobrar,
  monthlyGoal,
  currentMonth,
  currentYear
}: FinanceHojeProps) {
  const competence = `${String(currentMonth).padStart(2, "0")}/${currentYear}`;

  // Metrics calculation
  const currentMonthCobrancas = cobrancas.filter(c => c.data_vencimento.includes(`-${String(currentMonth).padStart(2, "0")}-`) || c.periodo_sessao_id.includes(competence));
  const currentMonthDespesas = despesas.filter(d => d.data_vencimento.includes(`-${String(currentMonth).padStart(2, "0")}-`) || d.competencia === competence);

  const recebidoMes = currentMonthCobrancas.filter(c => c.situacao === "Paga" || c.situacao === "Parcialmente paga" || c.situacao === "Isenta ou Cortesia").reduce((sum, curr) => sum + curr.valor_pago, 0);
  const aReceberMes = currentMonthCobrancas.filter(c => c.situacao === "Pendente" || c.situacao === "Atrasada" || c.situacao === "Prevista").reduce((sum, curr) => sum + (curr.valor_original - curr.valor_pago), 0);
  const emAtrasoTotal = cobrancas.filter(c => c.situacao === "Atrasada").reduce((sum, curr) => sum + (curr.valor_original - curr.valor_pago), 0);
  const despesasPagasMes = currentMonthDespesas.filter(d => d.situacao === "Paga").reduce((sum, curr) => sum + curr.valor, 0);
  const resultadoLiquido = recebidoMes - despesasPagasMes;

  // Active items for daily alerts
  const realizedSessions = sessions.filter(s => s.status === "Realizada" && s.data_hora.includes(`-${String(currentMonth).padStart(2, "0")}-`));
  const unlinkedSessionsCount = realizedSessions.filter(s => !currentMonthCobrancas.some(c => c.periodo_sessao_id === s.id)).length;
  const overdueInvoicesCount = cobrancas.filter(c => c.situacao === "Atrasada").length;
  const packagesExpiringCount = 0; // Simulated/Analyzed plans near session exhaustion

  // Narrative contextual message
  const alertText = `Você possui ${overdueInvoicesCount} cobranças atrasadas, ${unlinkedSessionsCount} sessões aguardando faturamento e ${packagesExpiringCount} pacotes de pacientes próximos do fim das sessões contratadas.`;

  const getPatientName = (id: string) => {
    const pat = patients.find(p => p.id === id);
    return pat ? pat.nome_preferencial : "Paciente";
  };

  // Lists for display
  const recebidosHoje = currentMonthCobrancas.filter(c => c.situacao === "Paga" && c.data_vencimento === new Date().toISOString().split("T")[0]);
  const vencendoHoje = currentMonthCobrancas.filter(c => c.situacao === "Pendente" && c.data_vencimento === new Date().toISOString().split("T")[0]);
  const despesasAtrasadas = despesas.filter(d => d.situacao === "Atrasada");

  return (
    <div className="space-y-6 font-sans">
      
      {/* 3 Key Indicators Panel (Semaforo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Entrou no Caixa (Verde) */}
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-center text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">Entrou no Caixa</span>
            <CheckCircle size={20} className="text-emerald-600" />
          </div>
          <div className="mt-4 space-y-1">
            <h4 className="text-2xl font-black text-emerald-900 leading-tight">R$ {recebidoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h4>
            <p className="text-xs text-emerald-700/80">Valor já recebido neste mês</p>
          </div>
        </div>

        {/* A Receber (Laranja) */}
        <div className="bg-orange-50 border border-orange-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-center text-orange-800">
            <span className="text-xs font-bold uppercase tracking-wider">A Receber</span>
            <Clock size={20} className="text-orange-600" />
          </div>
          <div className="mt-4 space-y-1">
            <h4 className="text-2xl font-black text-orange-900 leading-tight">R$ {(aReceberMes + emAtrasoTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h4>
            <p className="text-xs text-orange-700/80">Pendente e em atraso</p>
          </div>
        </div>

        {/* Despesas do Mês (Vermelho) */}
        <div className="bg-red-50 border border-red-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-center text-red-800">
            <span className="text-xs font-bold uppercase tracking-wider">Despesas do Mês</span>
            <TrendingUp size={20} className="text-red-600" />
          </div>
          <div className="mt-4 space-y-1">
            <h4 className="text-2xl font-black text-red-900 leading-tight">R$ {currentMonthDespesas.reduce((acc, d) => acc + d.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h4>
            <p className="text-xs text-red-700/80">Saídas registradas</p>
          </div>
        </div>
      </div>

      {/* AI Assistant Banner */}
      <div className="bg-slate-900 p-5 rounded-3xl flex flex-col md:flex-row gap-4 justify-between items-center text-slate-50 font-sans shadow-lg">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Sparkles size={24} className="text-indigo-400" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm text-indigo-200">Assistente SerenaFin</p>
            {overdueInvoicesCount > 0 ? (
              <p className="text-xs text-slate-300 leading-relaxed">
                Dra., há <strong>{overdueInvoicesCount} pagamentos pendentes/atrasados</strong>. Deseja que eu prepare as mensagens carinhosas de WhatsApp para envio agora?
              </p>
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                Tudo em dia! O financeiro está organizado. Nenhuma cobrança em atraso no momento.
              </p>
            )}
          </div>
        </div>
        {overdueInvoicesCount > 0 && (
          <button 
            onClick={onOpenReceivePayment} 
            className="shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md"
          >
            Preparar Mensagens
          </button>
        )}
      </div>

      {/* 4 Primary Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={onOpenReceivePayment}
          className="flex flex-col items-start bg-emerald-800 hover:bg-emerald-900 text-white p-5 rounded-3xl shadow-sm hover:shadow transition text-left cursor-pointer space-y-2 group"
        >
          <PlusCircle size={22} className="text-emerald-300 group-hover:scale-105 transition" />
          <div>
            <p className="font-bold text-xs">Receber Pagamento</p>
            <p className="text-[10px] text-emerald-200">Registrar quitação de sessão</p>
          </div>
        </button>

        <button
          onClick={onOpenAddExpense}
          className="flex flex-col items-start bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 p-5 rounded-3xl shadow-sm transition text-left cursor-pointer space-y-2 group"
        >
          <PlusCircle size={22} className="text-emerald-800 group-hover:scale-105 transition" />
          <div>
            <p className="font-bold text-xs">Registrar Despesa</p>
            <p className="text-[10px] text-slate-400">Cadastrar pagamento de conta</p>
          </div>
        </button>

        <button
          onClick={onOpenReceivePayment} // redirects to payments/bills for collection
          className="flex flex-col items-start bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 p-5 rounded-3xl shadow-sm transition text-left cursor-pointer space-y-2 group"
        >
          <MessageSquare size={22} className="text-emerald-800 group-hover:scale-105 transition" />
          <div>
            <p className="font-bold text-xs">Enviar Cobrança</p>
            <p className="text-[10px] text-slate-400">Lançar lembrete no WhatsApp</p>
          </div>
        </button>

        <button
          onClick={onOpenFechamento}
          className="flex flex-col items-start bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 p-5 rounded-3xl shadow-sm transition text-left cursor-pointer space-y-2 group"
        >
          <CheckCircle size={22} className="text-emerald-800 group-hover:scale-105 transition" />
          <div>
            <p className="font-bold text-xs">Fechar o Mês</p>
            <p className="text-[10px] text-slate-400">Balanço e trancamento fiscal</p>
          </div>
        </button>
      </div>

      {/* Task List Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Sessions awaiting billing decision */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 space-y-3.5">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Aguardando Faturamento Clínico</p>
          {realizedSessions.filter(s => !currentMonthCobrancas.some(c => c.periodo_sessao_id === s.id)).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Todas as sessões realizadas do mês estão faturadas ou debitadas de pacotes!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 font-sans text-xs">
              {realizedSessions
                .filter(s => !currentMonthCobrancas.some(c => c.periodo_sessao_id === s.id))
                .slice(0, 5)
                .map(s => (
                  <div key={s.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-900">{getPatientName(s.paciente_id)}</p>
                      <p className="text-[10px] text-slate-400">Sessão em: {new Date(s.data_hora).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <button
                      onClick={onOpenReceivePayment}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold transition text-[10px]"
                    >
                      Processar
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right Side: Collections Overdue / Due Today */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 space-y-3.5">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">Cobranças Ativas Recentes</p>
          {currentMonthCobrancas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhuma cobrança ativa registrada para este mês ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 font-sans text-xs">
              {currentMonthCobrancas.slice(0, 5).map(c => (
                <div key={c.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-900">{getPatientName(c.paciente_id)}</p>
                    <p className="text-[10px] text-slate-400">Vencimento: {new Date(c.data_vencimento).toLocaleDateString("pt-BR")} • {c.origem}</p>
                  </div>
                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <p className="font-bold text-slate-900">R$ {c.valor_original.toFixed(2)}</p>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${c.situacao === "Paga" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"}`}>
                        {c.situacao}
                      </span>
                    </div>
                    {c.situacao !== "Paga" && (
                      <button
                        onClick={() => onOpenCobrar(c)}
                        className="p-1.5 hover:bg-emerald-50 rounded-xl text-emerald-800 transition cursor-pointer"
                        title="Enviar Cobrança"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
