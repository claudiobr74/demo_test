import { useEffect, useState } from "react";
import type { SerenaUser } from "../lib/auth";
import { getAiUsage } from "../lib/workspace";

type Props = { user: SerenaUser };

/**
 * Item de menu "Configuração & Backup" — igual ao React original.
 * Backup local da organização via API; sem Google Drive/Sheets.
 */
export default function SettingsPage({ user }: Props) {
  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setUsage(await getAiUsage(days));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar uso de IA");
      }
    })();
  }, [days]);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Configuração & Backup</h1>
        <p className="mt-1 text-emerald-800/80">
          Conta, organização e observabilidade. Backup e dados ficam na SerenaPsi — sem Firebase
          nem Drive.
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-emerald-800">Perfil</h2>
        <div>
          <span className="text-emerald-700">Nome</span>
          <div className="font-medium">{user.full_name}</div>
        </div>
        <div>
          <span className="text-emerald-700">E-mail</span>
          <div className="font-medium">{user.email}</div>
        </div>
        <div>
          <span className="text-emerald-700">Organização</span>
          <div className="font-medium">{user.organization_name || user.organization_id}</div>
        </div>
        <div>
          <span className="text-emerald-700">Perfil</span>
          <div className="font-medium">{user.role_key}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-emerald-800">Uso de IA (organização)</h2>
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {usage && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Requisições", `${usage.total_requests ?? 0}`],
                ["Custo est. USD", `${usage.estimated_cost_usd ?? "0"}`],
                [
                  "Latência média",
                  usage.avg_latency_ms != null ? `${usage.avg_latency_ms} ms` : "—",
                ],
                ["Tokens in/out", `${usage.input_tokens ?? 0} / ${usage.output_tokens ?? 0}`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border px-3 py-3">
                <div className="text-xs uppercase text-emerald-700">{label}</div>
                <div className="mt-1 font-serif text-xl">{value}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5 text-sm text-emerald-900 space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p>
          Os dados clínicos e operacionais residem no PostgreSQL da organização. Exportações pontuais
          (documentos TXT/HTML) estão em Documentos. Backup completo automatizado segue no roadmap —
          sem cópia para Google Drive/Sheets.
        </p>
      </section>
    </div>
  );
}
