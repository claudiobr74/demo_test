import React from "react";
import { Cobranca } from "./FinanceTypes";
import { Printer, X, FileText } from "lucide-react";

interface FinanceReceiptProps {
  onClose: () => void;
  cobranca: Cobranca;
  patientName: string;
}

export default function FinanceReceipt({ onClose, cobranca, patientName }: FinanceReceiptProps) {
  const clinicianName = localStorage.getItem("serenapsi_profile_name") || "Dra. Virgínia Macedo";
  const clinicianSubtitle = localStorage.getItem("serenapsi_profile_subtitle") || "Psicóloga Clínica";
  const clinicianCRP = localStorage.getItem("serenapsi_profile_crp") || "CRP 11/04580";
  const clinicianCPF = localStorage.getItem("serenapsi_profile_cpf") || "000.000.000-00";
  const companyName = localStorage.getItem("serenapsi_profile_company_name") || "Virgínia Macedo Psicologia Clínica LTDA";
  const cnpj = localStorage.getItem("serenapsi_profile_cnpj") || "00.000.000/0001-00";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden p-6 flex flex-col gap-6">
        
        {/* Printable Card Area */}
        <div id="printable-receipt-card" className="border-4 border-double border-slate-200 p-6 space-y-6 text-slate-950 font-sans bg-white leading-relaxed">
          
          {/* Letterhead */}
          <div className="text-center space-y-1 pb-4 border-b border-slate-100">
            <h2 className="font-serif font-bold text-lg text-slate-900 tracking-tight">{companyName}</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              CNPJ: {cnpj}
            </p>
            <p className="text-[9px] text-slate-400 mt-1">
              Resp. Téc: {clinicianName} • {clinicianCRP} • Fortaleza, CE
            </p>
          </div>

          {/* Title */}
          <div className="text-center">
            <h3 className="font-serif font-bold text-sm tracking-widest uppercase border-y border-slate-100 py-1.5 text-slate-800">
              Recibo de Honorários
            </h3>
          </div>

          {/* Value Indicator */}
          <div className="flex justify-end pr-2">
            <div className="bg-slate-50 border border-slate-200/60 px-4 py-1.5 rounded-xl font-mono text-xs font-bold text-slate-900">
              VALOR: R$ {cobranca.valor_pago.toFixed(2)}
            </div>
          </div>

          {/* Narrative Body */}
          <div className="text-xs space-y-4 text-justify font-sans">
            <p className="indent-8 leading-relaxed">
              A empresa <strong>{companyName}</strong>, inscrita no CNPJ <strong>{cnpj}</strong>, declara ter recebido de <strong>{patientName}</strong>, a importância líquida de <strong>R$ {cobranca.valor_pago.toFixed(2)}</strong> (por extenso: <strong>{numberToWords(cobranca.valor_pago)}</strong>), referente a serviços de psicoterapia clínica prestados no período correspondente à sessão ou competência de referência <strong>{cobranca.periodo_sessao_id}</strong>.
            </p>
            <p>
              Por ser verdade e para que produza os devidos efeitos legais e fiscais, firmamos o presente.
            </p>
          </div>

          {/* Place & Date */}
          <div className="text-right text-[10px] text-slate-500 font-mono">
            Fortaleza, {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.
          </div>

          {/* Signature Block */}
          <div className="text-center pt-8 space-y-1">
            <div className="w-48 h-px bg-slate-300 mx-auto" />
            <p className="text-[11px] font-bold text-slate-950 font-serif italic">{companyName}</p>
            <p className="text-[9px] text-slate-400 font-mono">CNPJ: {cnpj}</p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex gap-3 font-sans">
          <button
            onClick={() => {
              window.print();
            }}
            className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-3 rounded-xl font-bold shadow-md transition flex items-center justify-center space-x-2 cursor-pointer text-xs"
          >
            <Printer size={14} />
            <span>Imprimir Recibo (PDF)</span>
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-200 text-slate-800 rounded-xl hover:bg-slate-50 transition font-semibold text-xs"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

// Convert numbers into simple Portuguese text representation
function numberToWords(amount: number): string {
  const value = Math.floor(amount);
  if (value === 150) return "cento e cinquenta reais";
  if (value === 200) return "duzentos reais";
  if (value === 300) return "trezentos reais";
  if (value === 400) return "quatrocentos reais";
  if (value === 500) return "quinhentos reais";
  if (value === 600) return "seiscentos reais";
  if (value === 800) return "oitocentos reais";
  if (value === 1000) return "mil reais";
  return `${value} reais`;
}
