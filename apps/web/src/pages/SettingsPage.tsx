import { useEffect, useState } from "react";
import type { SerenaUser } from "../lib/auth";
import { updateStoredUser } from "../lib/auth";
import {
  buildLocalBackupExport,
  getAiUsage,
  getProfile,
  updateProfile,
} from "../lib/workspace";

type Props = {
  user: SerenaUser;
  onUserUpdated?: (user: SerenaUser) => void;
};

/**
 * Item de menu "Configuração & Backup" — igual ao React original.
 * Backup local JSON da organização via API; sem Google Drive/Sheets.
 */
export default function SettingsPage({ user, onUserUpdated }: Props) {
  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [fullName, setFullName] = useState(user.full_name);
  const [preferredName, setPreferredName] = useState(user.preferred_name || "");
  const [crp, setCrp] = useState(user.professional_registration || "");
  const [specialty, setSpecialty] = useState(user.specialty || "");
  const [framework, setFramework] = useState(user.default_framework || "cbt");
  const [orgName, setOrgName] = useState(user.organization_name || "");
  const [pixKey, setPixKey] = useState("");
  const [monthlyGoal, setMonthlyGoal] = useState("10000");

  useEffect(() => {
    void (async () => {
      try {
        const me = await getProfile();
        const u = me.user;
        const org = me.organization as {
          name?: string;
          settings?: { pix_key?: string; monthly_goal?: string };
        };
        setFullName(String(u.full_name || user.full_name));
        setPreferredName(String(u.preferred_name || ""));
        setCrp(String(u.professional_registration || ""));
        setSpecialty(String(u.specialty || ""));
        setFramework(String(u.default_framework || "cbt"));
        setOrgName(String(org.name || user.organization_name || ""));
        setPixKey(String(org.settings?.pix_key || ""));
        setMonthlyGoal(String(org.settings?.monthly_goal || "10000"));
      } catch {
        /* perfil local já preenchido */
      }
    })();
  }, [user]);

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

      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 space-y-3">
        <h2 className="font-semibold text-emerald-800">Perfil editável</h2>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              const result = await updateProfile({
                full_name: fullName,
                preferred_name: preferredName || null,
                professional_registration: crp || null,
                specialty: specialty || null,
                default_framework: framework,
                organization_name: orgName || undefined,
                pix_key: pixKey || null,
                monthly_goal: monthlyGoal || null,
              });
              const next = updateStoredUser({
                full_name: String(result.user.full_name || fullName),
                preferred_name: (result.user.preferred_name as string) || null,
                professional_registration:
                  (result.user.professional_registration as string) || null,
                specialty: (result.user.specialty as string) || null,
                default_framework: (result.user.default_framework as string) || framework,
                organization_name: String(
                  (result.organization as { name?: string }).name || orgName,
                ),
              });
              if (next) onUserUpdated?.(next);
              setHint("Perfil atualizado.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Falha ao salvar perfil");
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="text-sm">
            Nome completo
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            Nome preferencial
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            E-mail
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 bg-emerald-50/50"
              value={user.email}
              disabled
            />
          </label>
          <label className="text-sm">
            CRP / registro
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={crp}
              onChange={(e) => setCrp(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Especialidade
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Abordagem padrão
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
            >
              <option value="cbt">TCC</option>
              <option value="schema">Schema Therapy</option>
            </select>
          </label>
          <label className="text-sm">
            Organização
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Chave Pix
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Meta mensal (R$)
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <div className="mb-2 text-xs text-emerald-700">Perfil de acesso: {user.role_key}</div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
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

      <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5 text-sm text-emerald-900 space-y-3">
        <h2 className="font-semibold">Backup local (JSON)</h2>
        <p>
          Exporte um pacote operacional (perfil, pacientes, agenda do mês, cobranças, despesas,
          tarefas e documentos) para arquivo JSON neste dispositivo. Não envia nada ao Google
          Drive/Sheets.
        </p>
        <button
          className="rounded-xl bg-emerald-800 px-4 py-2 text-white disabled:opacity-60"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setError(null);
            try {
              const payload = await buildLocalBackupExport();
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const stamp = new Date().toISOString().slice(0, 10);
              a.href = url;
              a.download = `serenapsi-backup-${stamp}.json`;
              a.click();
              URL.revokeObjectURL(url);
              setHint("Backup JSON baixado.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Falha ao exportar backup");
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Exportando…" : "Baixar backup JSON"}
        </button>
      </section>
    </div>
  );
}
