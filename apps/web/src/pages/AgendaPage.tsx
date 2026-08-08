import { useEffect, useMemo, useState } from "react";
import {
  createAppointment,
  getAppointments,
  getPatients,
  prepareConfirmationCopy,
  rescheduleAppointment,
  setAppointmentStatus,
  type Appointment,
  type Patient,
} from "../lib/workspace";

export default function AgendaPage() {
  const [day, setDay] = useState(() => new Date());
  const [items, setItems] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">("none");
  const [recurrenceCount, setRecurrenceCount] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const range = useMemo(() => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [day]);

  const load = async () => {
    try {
      const [appts, pats] = await Promise.all([
        getAppointments(range.start.toISOString(), range.end.toISOString()),
        getPatients(),
      ]);
      setItems(appts);
      setPatients(pats);
      if (!patientId && pats[0]) setPatientId(pats[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na agenda");
    }
  };

  useEffect(() => {
    void load();
  }, [range.start.toISOString()]);

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-emerald-950">Agenda</h1>
          <p className="mt-1 text-emerald-800/80">
            Sem Google Calendar — horários na API SerenaPsi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-3 py-1.5"
            onClick={() => setDay(new Date(day.getTime() - 86400000))}
          >
            ←
          </button>
          <div className="min-w-40 text-center font-medium">
            {day.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
          <button
            className="rounded-lg border px-3 py-1.5"
            onClick={() => setDay(new Date(day.getTime() + 86400000))}
          >
            →
          </button>
          <button className="rounded-lg border px-3 py-1.5" onClick={() => setDay(new Date())}>
            Hoje
          </button>
        </div>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!patientId) return;
          const [hh, mm] = time.split(":").map(Number);
          const starts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
          const created = await createAppointment({
            patient_id: patientId,
            starts_at: starts.toISOString(),
            duration_minutes: 50,
            modality: "in_person",
            recurrence_frequency: recurrence === "none" ? undefined : recurrence,
            recurrence_count: recurrence === "none" ? undefined : recurrenceCount,
          });
          setMsg(
            recurrence === "none"
              ? "Atendimento agendado."
              : `Série ${recurrence} criada (${recurrenceCount} ocorrências)${
                  (created as Appointment & { recurrence_id?: string }).recurrence_id
                    ? "."
                    : "."
                }`,
          );
          await load();
        }}
      >
        <label className="text-sm">
          Paciente
          <select
            className="mt-1 block rounded-xl border px-3 py-2"
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
          Horário
          <input
            type="time"
            className="mt-1 block rounded-xl border px-3 py-2"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Recorrência
          <select
            className="mt-1 block rounded-xl border px-3 py-2"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as "none" | "weekly" | "biweekly")}
          >
            <option value="none">Única</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quinzenal</option>
          </select>
        </label>
        {recurrence !== "none" && (
          <label className="text-sm">
            Qtd.
            <input
              type="number"
              min={2}
              max={52}
              className="mt-1 block w-20 rounded-xl border px-3 py-2"
              value={recurrenceCount}
              onChange={(e) => setRecurrenceCount(Number(e.target.value) || 8)}
            />
          </label>
        )}
        <button className="rounded-xl bg-emerald-800 px-4 py-2 text-white" type="submit">
          Agendar
        </button>
      </form>

      {error && <p className="text-red-700">{error}</p>}
      {msg && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm">{msg}</p>}

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-medium">
                  {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {a.patient_display_name}
                </div>
                <div className="text-xs text-emerald-800/70">
                  {a.status} · {a.modality || "presencial"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={async () => {
                    await setAppointmentStatus(a.id, "confirmed");
                    await load();
                  }}
                >
                  Confirmar
                </button>
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={async () => {
                    const next = new Date(a.starts_at);
                    next.setMinutes(next.getMinutes() + 15);
                    await rescheduleAppointment(a.id, next.toISOString(), a.version);
                    await load();
                  }}
                >
                  +15 min
                </button>
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={async () => {
                    const text = await prepareConfirmationCopy(a.id);
                    await navigator.clipboard.writeText(text);
                    setMsg("Mensagem de confirmação copiada (sem Gmail).");
                  }}
                >
                  Copiar confirmação
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-emerald-800/70">Nenhum atendimento neste dia.</p>
        )}
      </div>
    </div>
  );
}
