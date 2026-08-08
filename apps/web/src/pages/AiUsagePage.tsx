import { useEffect, useState } from "react";
import { getAiUsage } from "../lib/workspace";

export default function AiUsagePage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await getAiUsage(days));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar uso de IA");
      }
    })();
  }, [days]);

  const byProvider = (data?.by_provider as Record<string, unknown>[]) || [];

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-emerald-950">Uso de IA</h1>
          <p className="mt-1 text-emerald-800/80">Custo estimado e latência da organização.</p>
        </div>
        <select
          className="rounded-xl border px-3 py-2"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </header>
      {error && <p className="text-red-700">{error}</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Requisições", `${data.total_requests ?? 0}`],
                ["Custo est. USD", `${data.estimated_cost_usd ?? "0"}`],
                [
                  "Latência média",
                  data.avg_latency_ms != null ? `${data.avg_latency_ms} ms` : "—",
                ],
                ["Tokens in/out", `${data.input_tokens ?? 0} / ${data.output_tokens ?? 0}`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-white/70 p-4">
                <div className="text-xs uppercase text-emerald-700">{label}</div>
                <div className="mt-2 font-serif text-2xl">{value}</div>
              </div>
            ))}
          </div>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase text-emerald-700">Por provedor</h2>
            {byProvider.length === 0 && (
              <p className="text-sm text-emerald-800/70">Nenhuma requisição no período.</p>
            )}
            {byProvider.map((row) => (
              <div key={String(row.provider)} className="mb-2 rounded-xl border bg-white/70 px-4 py-3 text-sm">
                {String(row.provider)} · {String(row.count)} req · lat. {String(row.avg_latency_ms)} ms
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
