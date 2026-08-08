import type { SerenaUser } from "../lib/auth";

type Props = { user: SerenaUser };

export default function SettingsPage({ user }: Props) {
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Configuração</h1>
        <p className="mt-1 text-emerald-800/80">
          Conta e organização — sem Firebase, Drive ou backup em Google Sheets.
        </p>
      </header>
      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-5 space-y-2 text-sm">
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
      <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5 text-sm text-emerald-900">
        <strong>Diferencial desta fundação:</strong> autenticação JWT multi-tenant, PostgreSQL e
        Serena AI Gateway. Não há OAuth Google, Calendar, Gmail, Docs, Drive nem NotebookLM.
      </section>
    </div>
  );
}
