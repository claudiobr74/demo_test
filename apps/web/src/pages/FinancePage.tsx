import { useEffect, useMemo, useState } from "react";
import ReceiptModal from "../components/ReceiptModal";
import {
  cancelPackage,
  createCharge,
  createExpense,
  createPackage,
  getExpenses,
  getFinanceCharges,
  getFinanceSummary,
  getPackages,
  getPatients,
  registerPayment,
  updateExpense,
  type ChargeItem,
  type ExpenseItem,
  type PackageItem,
  type Patient,
} from "../lib/workspace";

type TabId = "hoje" | "recebimentos" | "despesas" | "relatorios";

const EXPENSE_CATEGORIES = [
  "Aluguel & Infraestrutura",
  "Impostos & Taxas",
  "Supervisão & Estudos",
  "Marketing & Divulgação",
  "Softwares & Assinaturas",
  "Outros Custos Clínicos",
];

export default function FinancePage() {
  const [tab, setTab] = useState<TabId>("hoje");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("150");
  const [description, setDescription] = useState("Sessão");
  const [pkgSessions, setPkgSessions] = useState("4");
  const [pkgPrice, setPkgPrice] = useState("600");
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[1]);
  const [expAmount, setExpAmount] = useState("200");
  const [expVendor, setExpVendor] = useState("");
  const [expNotes, setExpNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    patientName: string;
    amount: string | number;
    description?: string | null;
  } | null>(null);

  const load = async () => {
    try {
      const [s, c, e, p, pkgs] = await Promise.all([
        getFinanceSummary(),
        getFinanceCharges() as Promise<ChargeItem[]>,
        getExpenses(),
        getPatients(),
        getPackages(),
      ]);
      setSummary(s);
      setCharges(c);
      setExpenses(e);
      setPatients(p);
      setPackages(pkgs);
      if (!patientId && p[0]) setPatientId(p[0].id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro financeiro");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCharges = useMemo(
    () => charges.filter((c) => c.status !== "paid" && c.status !== "cancelled"),
    [charges],
  );
  const paidCharges = useMemo(() => charges.filter((c) => c.status === "paid"), [charges]);
  const activeExpenses = useMemo(
    () => expenses.filter((e) => e.status !== "cancelled"),
    [expenses],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "hoje", label: "Hoje" },
    { id: "recebimentos", label: "Recebimentos" },
    { id: "despesas", label: "Despesas" },
    { id: "relatorios", label: "Relatórios" },
  ];

  const reportText = useMemo(() => {
    if (!summary) return "";
    const month = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return [
      `Relatório financeiro SerenaPsi — ${month}`,
      `Recebido: R$ ${String(summary.received_amount ?? "0")}`,
      `A receber: R$ ${String(summary.pending_amount ?? "0")}`,
      `Despesas do mês: R$ ${String(summary.expenses_month_amount ?? "0")}`,
      `Despesas pagas: R$ ${String(summary.expenses_paid_month_amount ?? "0")}`,
      `Líquido estimado: R$ ${String(summary.net_month_estimate ?? "0")}`,
      `Cobranças abertas: ${String(summary.open_charges ?? 0)}`,
      `Cobranças vencidas: ${String(summary.overdue_count ?? 0)}`,
      `Pacotes ativos: ${packages.filter((p) => p.status === "active").length}`,
      "",
      "Gerado na SerenaPsi (sem Google Sheets).",
    ].join("\n");
  }, [summary, packages]);

  return (
    <div className="animate-fade-in space-y-6">
      {receipt && (
        <ReceiptModal
          patientName={receipt.patientName}
          amount={receipt.amount}
          description={receipt.description}
          onClose={() => setReceipt(null)}
        />
      )}
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Financeiro</h1>
        <p className="mt-1 text-emerald-800/80">
          Cobranças, recebimentos e despesas do consultório — sem planilhas Google.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-emerald-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`border-b-2 px-4 py-2 text-sm transition ${
              tab === t.id
                ? "border-emerald-800 font-bold text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      {tab === "hoje" && summary && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Entrou no caixa", summary.received_amount, "emerald"],
                ["A receber", summary.pending_amount, "orange"],
                ["Despesas do mês", summary.expenses_month_amount, "red"],
              ] as [string, unknown, string][]
            ).map(([label, value, tone]) => (
              <div
                key={label}
                className={`rounded-2xl border p-4 ${
                  tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50"
                    : tone === "orange"
                      ? "border-orange-200 bg-orange-50"
                      : "border-red-200 bg-red-50"
                }`}
              >
                <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
                <div className="mt-2 font-serif text-2xl">R$ {String(value ?? "0")}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-emerald-800/80">
            Você possui {String(summary.overdue_count ?? 0)} cobranças atrasadas e{" "}
            {String(summary.open_charges ?? 0)} abertas. Resultado líquido estimado do mês: R${" "}
            {String(summary.net_month_estimate ?? "0")}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
              onClick={() => setTab("recebimentos")}
            >
              Registrar recebimento
            </button>
            <button
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => setTab("despesas")}
            >
              Nova despesa
            </button>
          </div>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Cobranças em aberto
            </h2>
            {openCharges.slice(0, 5).map((c) => (
              <ChargeRow
                key={c.id}
                charge={c}
                onPaid={async () => {
                  await registerPayment({
                    charge_id: c.id,
                    amount: c.amount,
                    method: "pix",
                  });
                  setHint("Pagamento registrado.");
                  await load();
                }}
              />
            ))}
            {openCharges.length === 0 && (
              <p className="text-sm text-emerald-800/70">Nenhuma cobrança em aberto.</p>
            )}
          </section>
        </div>
      )}

      {tab === "recebimentos" && (
        <div className="space-y-4">
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

          <form
            className="grid gap-3 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 md:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!patientId) return;
              await createPackage({
                patient_id: patientId,
                total_sessions: Number(pkgSessions) || 4,
                price: pkgPrice,
              });
              setHint("Pacote criado (cobrança gerada automaticamente).");
              await load();
            }}
          >
            <div className="md:col-span-4 text-sm font-semibold text-emerald-800">
              Pacotes de sessões
            </div>
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
              Sessões
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={pkgSessions}
                onChange={(e) => setPkgSessions(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Preço total (R$)
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={pkgPrice}
                onChange={(e) => setPkgPrice(e.target.value)}
              />
            </label>
            <button className="mt-auto rounded-xl border border-emerald-800 px-4 py-2 text-emerald-900" type="submit">
              Criar pacote
            </button>
          </form>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Pacotes
            </h2>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {pkg.patient_display_name} · {pkg.used_sessions}/{pkg.total_sessions} usadas
                  </div>
                  <div className="text-xs text-emerald-800/70">
                    Restam {pkg.remaining_sessions} · R$ {String(pkg.price)} · {pkg.status}
                  </div>
                </div>
                {pkg.status === "active" && (
                  <button
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700"
                    onClick={async () => {
                      if (!window.confirm("Cancelar este pacote?")) return;
                      await cancelPackage(pkg.id);
                      await load();
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-sm text-emerald-800/70">Nenhum pacote cadastrado.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Cobranças
            </h2>
            {charges.map((c) => (
              <ChargeRow
                key={c.id}
                charge={c}
                onPaid={
                  c.status !== "paid" && c.status !== "cancelled"
                    ? async () => {
                        await registerPayment({
                          charge_id: c.id,
                          amount: c.amount,
                          method: "pix",
                        });
                        setHint("Pagamento registrado.");
                        setReceipt({
                          patientName:
                            (c as ChargeItem & { patient_display_name?: string })
                              .patient_display_name || "Paciente",
                          amount: c.amount,
                          description: c.description,
                        });
                        await load();
                      }
                    : undefined
                }
                onReceipt={
                  c.status === "paid"
                    ? () =>
                        setReceipt({
                          patientName:
                            (c as ChargeItem & { patient_display_name?: string })
                              .patient_display_name || "Paciente",
                          amount: c.amount,
                          description: c.description,
                        })
                    : undefined
                }
              />
            ))}
            {charges.length === 0 && (
              <p className="text-sm text-emerald-800/70">Nenhuma cobrança listada.</p>
            )}
          </section>
        </div>
      )}

      {tab === "despesas" && (
        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-4 md:grid-cols-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await createExpense({
                category: expCategory,
                amount: expAmount,
                vendor: expVendor || undefined,
                notes: expNotes || undefined,
                due_date: new Date().toISOString().slice(0, 10),
              });
              setHint("Despesa registrada.");
              setExpVendor("");
              setExpNotes("");
              await load();
            }}
          >
            <label className="text-sm md:col-span-2">
              Categoria
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Valor (R$)
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Fornecedor
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={expVendor}
                onChange={(e) => setExpVendor(e.target.value)}
              />
            </label>
            <button className="mt-auto rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
              Adicionar
            </button>
            <label className="text-sm md:col-span-5">
              Observações
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
              />
            </label>
          </form>

          <section className="space-y-2">
            {activeExpenses.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {e.category} · R$ {String(e.amount)}
                  </div>
                  <div className="text-xs text-emerald-800/70">
                    {e.vendor || "—"} · {e.status}
                    {e.due_date ? ` · venc. ${e.due_date}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {e.status !== "paid" && (
                    <button
                      className="rounded-lg border px-3 py-1.5"
                      onClick={async () => {
                        await updateExpense(e.id, { mark_paid: true });
                        setHint("Despesa marcada como paga.");
                        await load();
                      }}
                    >
                      Marcar paga
                    </button>
                  )}
                  {e.status !== "cancelled" && (
                    <button
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700"
                      onClick={async () => {
                        if (!window.confirm("Cancelar esta despesa?")) return;
                        await updateExpense(e.id, { status: "cancelled" });
                        await load();
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activeExpenses.length === 0 && (
              <p className="text-sm text-emerald-800/70">Nenhuma despesa registrada.</p>
            )}
          </section>
        </div>
      )}

      {tab === "relatorios" && summary && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white/70 p-5">
          <h2 className="font-serif text-xl text-emerald-900">Relatório do mês (caixa)</h2>
          <ul className="space-y-2 text-sm text-emerald-900">
            <li>Recebido: R$ {String(summary.received_amount ?? "0")}</li>
            <li>A receber: R$ {String(summary.pending_amount ?? "0")}</li>
            <li>Despesas (mês): R$ {String(summary.expenses_month_amount ?? "0")}</li>
            <li>Despesas pagas: R$ {String(summary.expenses_paid_month_amount ?? "0")}</li>
            <li>Líquido estimado: R$ {String(summary.net_month_estimate ?? "0")}</li>
            <li>Cobranças abertas: {String(summary.open_charges ?? 0)}</li>
            <li>Cobranças vencidas: {String(summary.overdue_count ?? 0)}</li>
            <li>Recebimentos quitados neste extrato: {paidCharges.length}</li>
            <li>
              Pacotes ativos: {packages.filter((p) => p.status === "active").length} · esgotados:{" "}
              {packages.filter((p) => p.status === "exhausted").length}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(reportText);
                setHint("Relatório copiado para a área de transferência (contador/contabilidade).");
              }}
            >
              Copiar para contabilidade
            </button>
            <button
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => {
                const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `serenapsi-financeiro-${new Date().toISOString().slice(0, 7)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Baixar TXT
            </button>
          </div>
          <p className="text-xs text-emerald-800/70">
            Relatório gerado na SerenaPsi — sem exportação automática para Google Sheets.
          </p>
        </div>
      )}
    </div>
  );
}

function ChargeRow({
  charge,
  onPaid,
  onReceipt,
}: {
  charge: ChargeItem;
  onPaid?: () => Promise<void>;
  onReceipt?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3 text-sm">
      <div>
        <div className="font-medium">
          {charge.description || charge.origin || "Cobrança"} · R$ {String(charge.amount)}
        </div>
        <div className="text-xs text-emerald-800/70">
          {(charge as ChargeItem & { patient_display_name?: string }).patient_display_name ||
            charge.patient_id}{" "}
          · {charge.status}
        </div>
      </div>
      <div className="flex gap-2">
        {onPaid && (
          <button className="rounded-lg border px-3 py-1.5" onClick={() => void onPaid()}>
            Registrar Pix
          </button>
        )}
        {onReceipt && (
          <button className="rounded-lg border px-3 py-1.5" onClick={onReceipt}>
            Recibo
          </button>
        )}
      </div>
    </div>
  );
}
