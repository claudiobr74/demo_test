import { Printer } from "lucide-react";
import { getStoredUser } from "../lib/auth";

type Props = {
  patientName: string;
  amount: string | number;
  description?: string | null;
  paidAt?: string | null;
  method?: string;
  onClose: () => void;
};

/** Recibo imprimível local — substitui Google Docs. */
export default function ReceiptModal({
  patientName,
  amount,
  description,
  paidAt,
  method = "pix",
  onClose,
}: Props) {
  const user = getStoredUser();
  const clinician = user?.full_name || "Profissional";
  const crp = user?.professional_registration || "";
  const org = user?.organization_name || "Consultório SerenaPsi";
  const value = Number(amount);
  const valueLabel = Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    : String(amount);
  const dateLabel = paidAt
    ? new Date(paidAt).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="flex w-full max-w-lg flex-col gap-4 overflow-hidden rounded-3xl bg-white p-6 shadow-xl print:max-w-none print:shadow-none">
        <div
          id="printable-receipt-card"
          className="space-y-6 border-4 border-double border-slate-200 bg-white p-6 font-sans leading-relaxed text-slate-950"
        >
          <div className="space-y-1 border-b border-slate-100 pb-4 text-center">
            <h2 className="font-serif text-lg font-bold tracking-tight text-slate-900">{org}</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Resp. téc.: {clinician}
              {crp ? ` · ${crp}` : ""}
            </p>
          </div>

          <div className="text-center">
            <h3 className="border-y border-slate-100 py-1.5 font-serif text-sm font-bold uppercase tracking-widest text-slate-800">
              Recibo de Honorários
            </h3>
          </div>

          <div className="flex justify-end pr-2">
            <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-1.5 font-mono text-xs font-bold text-slate-900">
              VALOR: R$ {valueLabel}
            </div>
          </div>

          <div className="space-y-4 text-justify text-xs">
            <p className="indent-8 leading-relaxed">
              <strong>{org}</strong> declara ter recebido de <strong>{patientName}</strong> a
              importância de <strong>R$ {valueLabel}</strong>
              {Number.isFinite(value) ? (
                <>
                  {" "}
                  (por extenso: <strong>{numberToWords(value)}</strong>)
                </>
              ) : null}
              , referente a {description || "serviços de psicoterapia clínica"}, pago via{" "}
              <strong>{methodLabel(method)}</strong>.
            </p>
            <p>
              Por ser verdade e para que produza os devidos efeitos, firmamos o presente recibo.
            </p>
          </div>

          <div className="text-right font-mono text-[10px] text-slate-500">{dateLabel}.</div>

          <div className="space-y-1 pt-8 text-center">
            <div className="mx-auto h-px w-48 bg-slate-300" />
            <p className="font-serif text-[11px] font-bold italic text-slate-950">{clinician}</p>
            {crp && <p className="font-mono text-[9px] text-slate-400">{crp}</p>}
          </div>
        </div>

        <div className="flex gap-3 print:hidden">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 text-xs font-bold text-white"
            onClick={() => window.print()}
          >
            <Printer size={14} />
            Imprimir recibo (PDF)
          </button>
          <button
            className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-semibold"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function methodLabel(method: string) {
  switch (method) {
    case "pix":
      return "Pix";
    case "cash":
      return "dinheiro";
    case "card":
      return "cartão";
    case "transfer":
      return "transferência";
    default:
      return method;
  }
}

function numberToWords(amount: number): string {
  const value = Math.floor(amount);
  if (value === 0) return "zero reais";
  if (value < 20) {
    const units = [
      "zero",
      "um",
      "dois",
      "três",
      "quatro",
      "cinco",
      "seis",
      "sete",
      "oito",
      "nove",
      "dez",
      "onze",
      "doze",
      "treze",
      "quatorze",
      "quinze",
      "dezesseis",
      "dezessete",
      "dezoito",
      "dezenove",
    ];
    return `${units[value]} ${value === 1 ? "real" : "reais"}`;
  }
  return `${value} reais`;
}
