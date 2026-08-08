import { useEffect, useState } from "react";
import { getFinanceCharges, getFinanceSummary } from "../lib/workspace";

export default function FinancePage() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [charges, setCharges] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [s, c] = await Promise.all([getFinanceSummary(), getFinanceCharges()]);
        setSummary(s);
        setCharges(c as Record<string, unknown>[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro financeiro");
      }
    })();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Financeiro</h1>
        <p className="mt-1 text-emerald-800/80">Caixa do consultório — sem planilhas Google.</p>
      </header>
      {error && <p className="text-red-700">{error}</p>}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["A receber", summary.pending_amount],
              ["Recebido", summary.received_amount],
              ["Cobranças abertas", summary.open_charges],
              ["Vencidas", summary.overdue_count],
            ] as [string, unknown][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-emerald-200 bg-white/70 p-4"
            >
              <div className="text-xs uppercase tracking-wide text-emerald-700">{label}</div>
              <div className="mt-2 font-serif text-2xl">{`${value ?? "—"}`}</div>
            </div>
          ))}
        </div>
      )}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Cobranças
        </h2>
        {charges.map((c) => (
          <div key={String(c.id)} className="rounded-xl border bg-white/70 px-4 py-3 text-sm">
            {String(c.description || c.origin || "Cobrança")} · R$ {String(c.amount)} ·{" "}
            {String(c.status)}
          </div>
        ))}
        {charges.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhuma cobrança listada.</p>
        )}
      </section>
    </div>
  );
}
