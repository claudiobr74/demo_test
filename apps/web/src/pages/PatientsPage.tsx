import { useEffect, useState } from "react";
import { createPatient, getPatients, updatePatient, type Patient } from "../lib/workspace";

type Props = {
  onOpenPatient: (patientId: string) => void;
  clinicalAccess?: boolean;
};

export default function PatientsPage({ onOpenPatient, clinicalAccess = true }: Props) {
  const [items, setItems] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [sessionFee, setSessionFee] = useState("180");
  const [editing, setEditing] = useState<Patient | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFee, setEditFee] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const load = async () => {
    try {
      setItems(await getPatients());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar pacientes");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Pacientes</h1>
        <p className="mt-1 text-emerald-800/80">
          {clinicalAccess
            ? "Fichas e hub clínico — toque para abrir memória, consentimentos e prontuário."
            : "Cadastro administrativo — dados clínicos ficam restritos ao perfil clínico."}
        </p>
      </header>

      <form
        className="grid gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-5 md:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!firstName.trim() || !lastName.trim()) return;
          await createPatient({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            internal_code: code.trim() || undefined,
            session_fee: sessionFee.trim() || undefined,
          });
          setFirstName("");
          setLastName("");
          setCode("");
          setHint("Paciente cadastrado.");
          await load();
        }}
      >
        <input
          className="rounded-xl border px-3 py-2"
          placeholder="Nome"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2"
          placeholder="Sobrenome"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2"
          placeholder="Código (opcional)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2"
          placeholder="Valor sessão (R$)"
          value={sessionFee}
          onChange={(e) => setSessionFee(e.target.value)}
        />
        <button className="rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
          Cadastrar
        </button>
      </form>

      {error && <p className="text-red-700">{error}</p>}
      {hint && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{hint}</p>}

      {editing && (
        <form
          className="grid gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/50 p-4 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await updatePatient(editing.id, {
              phone: editPhone || null,
              email: editEmail || null,
              session_fee: editFee || null,
              status: editStatus,
            });
            setEditing(null);
            setHint("Cadastro atualizado.");
            await load();
          }}
        >
          <div className="md:col-span-4 text-sm font-semibold text-emerald-900">
            Editar {editing.display_name}
          </div>
          <label className="text-sm">
            Telefone
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </label>
          <label className="text-sm">
            E-mail
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Valor sessão
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={editFee}
              onChange={(e) => setEditFee(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Situação
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="inactive">Inativo</option>
              <option value="closed">Alta / encerrado</option>
            </select>
          </label>
          <div className="flex gap-2 md:col-span-4">
            <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white" type="submit">
              Salvar
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3"
          >
            <button
              type="button"
              onClick={() => onOpenPatient(p.id)}
              className="min-w-0 flex-1 text-left hover:text-emerald-900"
            >
              <div className="font-medium">{p.display_name}</div>
              <div className="text-xs text-emerald-800/70">
                {p.internal_code || "—"} · {p.email || "sem e-mail"}
                {p.session_fee != null ? ` · R$ ${p.session_fee}` : ""}
                {p.status ? ` · ${p.status}` : ""}
              </div>
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm"
              onClick={() => {
                setEditing(p);
                setEditPhone(p.phone || "");
                setEditEmail(p.email || "");
                setEditFee(p.session_fee != null ? String(p.session_fee) : "");
                setEditStatus(p.status || "active");
              }}
            >
              Editar
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhum paciente cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
