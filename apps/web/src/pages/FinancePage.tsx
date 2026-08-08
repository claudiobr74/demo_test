import { useEffect, useState } from "react";
import {
  createCharge,
  getFinanceCharges,
  getFinanceSummary,
  getPatients,
  registerPayment,
  type ChargeItem,
  type Patient,
} from "../lib/workspace";

export default function FinancePage() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("150");
  const [description, setDescription] = useState("Sessão");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, c, p] = await Promise.all([
        getFinanceSummary(),
        getFinanceCharges() as Promise<ChargeItem[]>,
        getPatients(),
      ]);
      setSummary(s);
      setCharges(c);
      setPatients(p);
      if (!patientId && p[0]) setPatientId(p[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro financeiro");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Financeiro</h1>
        <p className="mt-1 text-emerald-800/80">
          Cobranças e recebimentos do consultório — sem planilhas Google.
        </p>
      </header>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

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
            <div key={label} className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">{label}</div>
              <div className="mt-2 font-serif text-2xl">{`${value ?? "—"}`}</div>
            </div>
          ))}
        </div>
      )}

      <form
        className="grid gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-4 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!patientId) return;
          await createCharge({
            patient_id: patientId,
            amount,
            description,
            origin: "adjustment",
          });
          setHint("Cobrança criada.");
          await load();
        }}
      >
        <label className="text-sm">
          Paciente
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Valor (R$)
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Descrição
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="mt-auto rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
          Nova cobrança
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Cobranças
        </h2>
        {charges.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium">
                {c.description || c.origin || "Cobrança"} · R$ {String(c.amount)}
              </div>
              <div className="text-xs text-emerald-800/70">{c.status}</div>
            </div>
            {c.status !== "paid" && c.status !== "cancelled" && (
              <button
                className="rounded-lg border px-3 py-1.5"
                onClick={async () => {
                  await registerPayment({
                    charge_id: c.id,
                    amount: c.amount,
                    method: "pix",
                  });
                  setHint("Pagamento registrado.");
                  await load();
                }}
              >
                Registrar Pix
              </button>
            )}
          </div>
        ))}
        {charges.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhuma cobrança listada.</p>
        )}
      </section>
    </div>
  );
}
