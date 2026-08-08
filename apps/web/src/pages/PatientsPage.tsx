import { useEffect, useState } from "react";
import { createPatient, getPatients, type Patient } from "../lib/workspace";

type Props = { onOpenPatient: (patientId: string) => void };

export default function PatientsPage({ onOpenPatient }: Props) {
  const [items, setItems] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");

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
          Fichas e hub clínico — toque para abrir memória, consentimentos e prontuário.
        </p>
      </header>

      <form
        className="grid gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-5 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!firstName.trim() || !lastName.trim()) return;
          await createPatient({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            internal_code: code.trim() || undefined,
          });
          setFirstName("");
          setLastName("");
          setCode("");
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
        <button className="rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
          Cadastrar
        </button>
      </form>

      {error && <p className="text-red-700">{error}</p>}

      <div className="space-y-2">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPatient(p.id)}
            className="w-full rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3 text-left hover:border-emerald-500"
          >
            <div className="font-medium">{p.display_name}</div>
            <div className="text-xs text-emerald-800/70">
              {p.internal_code || "—"} · {p.email || "sem e-mail"}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhum paciente cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
