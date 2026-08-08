import React from "react";
import { Cobranca, Despesa } from "./FinanceTypes";
import { CheckCircle2, Sparkles, X, FileText, Check } from "lucide-react";

interface FechamentoWizardProps {
  onClose: () => void;
  onConfirm: (resumo: string) => void;
  cobrancas: Cobranca[];
  despesas: Despesa[];
  sessions: any[];
  patients: any[];
  currentMonth: number;
  currentYear: number;
}

export default function FechamentoWizard({
  onClose,
  onConfirm,
  cobrancas,
  despesas,
  sessions,
  patients,
  currentMonth,
  currentYear
}: FechamentoWizardProps) {
  const competence = `${String(currentMonth).padStart(2, "0")}/${currentYear}`;

  // Filter items of the competence
  const cobrancasMes = cobrancas.filter(c => c.data_vencimento.includes(`-${String(currentMonth).padStart(2, "0")}-`) || c.periodo_sessao_id.includes(competence));
  const despesasMes = despesas.filter(d => d.data_vencimento.includes(`-${String(currentMonth).padStart(2, "0")}-`) || d.competencia === competence);
  const realizedSessions = sessions.filter(s => s.status === "Realizada" && s.data_hora.includes(`-${String(currentMonth).padStart(2, "0")}-`));

  // Compute metrics
  const totalReceived = cobrancasMes.filter(c => c.situacao === "Paga" || c.situacao === "Parcialmente paga" || c.situacao === "Isenta ou Cortesia").reduce((acc, curr) => acc + curr.valor_pago, 0);
  const totalPaidDespesas = despesasMes.filter(d => d.situacao === "Paga").reduce((acc, curr) => acc + curr.valor, 0);
  const netProfit = totalReceived - totalPaidDespesas;

  const handleFinish = () => {
    const resumo = `Resumo de Fechamento (${competence})\nAtendimentos: ${realizedSessions.length} sessões\nFaturado: R$ ${totalReceived.toFixed(2)}\nDespesas: R$ ${totalPaidDespesas.toFixed(2)}\nLucro Líquido: R$ ${netProfit.toFixed(2)}`;
    onConfirm(resumo);
    // Optionally trigger a print/PDF save
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans text-slate-800">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-emerald-950 text-white px-6 py-5 flex justify-between items-center shrink-0">
          <div>
            <h4 className="font-serif font-bold text-lg">Resumo do Mês</h4>
            <p className="text-xs text-emerald-300">Competência {competence}</p>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 flex-1 bg-slate-50 text-center">
          <Sparkles className="text-emerald-600 mx-auto" size={40} />
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Bom trabalho, Doutora!</h2>
            <p className="text-sm text-slate-600">Aqui está o seu relatório simplificado do mês.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-semibold text-slate-600">Pacientes Atendidos:</span>
              <span className="text-base font-bold text-slate-900">{realizedSessions.length} sessões</span>
            </div>
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-semibold text-slate-600">Entrou no Caixa:</span>
              <span className="text-base font-bold text-emerald-700">R$ {totalReceived.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-semibold text-slate-600">Despesas do Mês:</span>
              <span className="text-base font-bold text-red-700">R$ {totalPaidDespesas.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-bold text-slate-900">Seu Lucro Líquido:</span>
              <span className={`text-xl font-black ${netProfit >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                R$ {netProfit.toFixed(2)}
              </span>
            </div>
          </div>
          
          <p className="text-xs text-slate-400">
            Você pode salvar este resumo em PDF ou enviá-lo diretamente para a sua contabilidade.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer text-sm"
          >
            Fechar
          </button>

          <button
            onClick={handleFinish}
            className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-md transition flex items-center space-x-2 cursor-pointer text-sm"
          >
            <FileText size={16} />
            <span>Gerar PDF / Salvar</span>
          </button>
        </div>

      </div>
    </div>
  );
}
