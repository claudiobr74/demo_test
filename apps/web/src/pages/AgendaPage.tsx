import { useEffect, useMemo, useState } from "react";
import ConfirmationQueuePanel from "../components/ConfirmationQueuePanel";
import {
  createAppointment,
  createCharge,
  enqueueConfirmation,
  getAppointments,
  getPatients,
  prepareConfirmationCopy,
  rescheduleAppointment,
  setAppointmentStatus,
  type Appointment,
  type Patient,
} from "../lib/workspace";

type ViewMode = "day" | "week" | "month";

export default function AgendaPage() {
  const [day, setDay] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("day");
  const [items, setItems] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">("none");
  const [recurrenceCount, setRecurrenceCount] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [queueKey, setQueueKey] = useState(0);

  const range = useMemo(() => {
    if (view === "day") {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    if (view === "month") {
      const start = new Date(day.getFullYear(), day.getMonth(), 1);
      const end = new Date(day.getFullYear(), day.getMonth() + 1, 1);
      return { start, end };
    }
    const start = startOfWeek(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }, [day, view]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of items) {
      const key = new Date(a.starts_at).toISOString().slice(0, 10);
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [day]);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 7), []);

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
  }, [range.start.toISOString(), range.end.toISOString()]);

  const shiftDay = (delta: number) => {
    const next = new Date(day);
    if (view === "month") {
      next.setMonth(next.getMonth() + delta);
    } else {
      next.setDate(next.getDate() + (view === "week" ? delta * 7 : delta));
    }
    setDay(next);
  };

  const moveMinutes = async (a: Appointment, delta: number) => {
    const next = new Date(a.starts_at);
    next.setMinutes(next.getMinutes() + delta);
    await rescheduleAppointment(a.id, next.toISOString(), a.version);
    await load();
  };

  const dropOnSlot = async (date: Date, hour: number) => {
    if (!dragId) return;
    const appt = items.find((a) => a.id === dragId);
    if (!appt) return;
    const original = new Date(appt.starts_at);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, snap15(original.getMinutes()));
    await rescheduleAppointment(appt.id, target.toISOString(), appt.version);
    setDragId(null);
    setMsg("Horário atualizado (snap 15 min).");
    await load();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-emerald-950">Agenda</h1>
          <p className="mt-1 text-emerald-800/80">
            Sem Google Calendar — horários na API SerenaPsi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-emerald-200 bg-white p-0.5 text-sm">
            <button
              className={`rounded-lg px-3 py-1.5 ${view === "day" ? "bg-emerald-800 text-white" : ""}`}
              onClick={() => setView("day")}
            >
              Dia
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 ${view === "week" ? "bg-emerald-800 text-white" : ""}`}
              onClick={() => setView("week")}
            >
              Semana
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 ${view === "month" ? "bg-emerald-800 text-white" : ""}`}
              onClick={() => setView("month")}
            >
              Mês
            </button>
          </div>
          <button className="rounded-lg border px-3 py-1.5" onClick={() => shiftDay(-1)}>
            ←
          </button>
          <div className="min-w-44 text-center font-medium">
            {view === "day"
              ? day.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })
              : view === "month"
                ? day.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                : `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
          </div>
          <button className="rounded-lg border px-3 py-1.5" onClick={() => shiftDay(1)}>
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
          await createAppointment({
            patient_id: patientId,
            starts_at: starts.toISOString(),
            duration_minutes: 50,
            modality: "in_person",
            recurrence_frequency: recurrence === "none" ? undefined : recurrence,
            recurrence_count: recurrence === "none" ? undefined : recurrenceCount,
          });
          setMsg(recurrence === "none" ? "Atendimento agendado." : `Série ${recurrence} criada.`);
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

      {view === "day" && (
        <div className="space-y-3">
          {items.map((a) => (
            <AppointmentCard
              key={a.id}
              a={a}
              onConfirm={async () => {
                await setAppointmentStatus(a.id, "confirmed");
                await load();
              }}
              onMinus={() => void moveMinutes(a, -15)}
              onPlus={() => void moveMinutes(a, 15)}
              onCopy={async () => {
                const text = await prepareConfirmationCopy(a.id);
                await navigator.clipboard.writeText(text);
                setMsg("Mensagem de confirmação copiada (sem Gmail).");
              }}
              onEnqueue={async () => {
                await enqueueConfirmation(a.id);
                setQueueKey((k) => k + 1);
                setMsg("Confirmação enfileirada (stub multi-canal — sem Gmail).");
              }}
              onNoShow={async () => {
                const name = a.patient_display_name || "paciente";
                if (
                  !window.confirm(
                    `Registrar falta para ${name}? Isso marca no-show e pode gerar cobrança.`,
                  )
                ) {
                  return;
                }
                await setAppointmentStatus(a.id, "no_show");
                const feeRaw = String(a.session_fee ?? "").trim();
                const fee = Number(feeRaw.replace(",", "."));
                if (feeRaw && Number.isFinite(fee) && fee > 0) {
                  try {
                    await createCharge({
                      patient_id: a.patient_id,
                      amount: feeRaw,
                      description: `Cobrança por falta — ${name}`,
                      origin: "no_show",
                    });
                    setMsg(`Falta registrada. Cobrança de R$ ${feeRaw} gerada.`);
                  } catch {
                    setMsg("Falta registrada. Não foi possível gerar a cobrança.");
                  }
                } else {
                  setMsg("Falta registrada. Paciente sem taxa de sessão — cobrança não gerada.");
                }
                await load();
              }}
            />
          ))}
          {items.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhum atendimento neste dia.</p>
          )}
        </div>
      )}

      {view === "week" && (
        <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white/70">
          <div className="grid min-w-[900px] grid-cols-[64px_repeat(7,1fr)]">
            <div className="border-b border-emerald-100 p-2 text-xs text-emerald-700" />
            {weekDays.map((d) => (
              <div
                key={d.toISOString()}
                className="border-b border-l border-emerald-100 p-2 text-center text-xs font-semibold text-emerald-900"
              >
                {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}
              </div>
            ))}
            {hours.map((hour) => (
              <WeekHourRow
                key={`row-${hour}`}
                hour={hour}
                weekDays={weekDays}
                items={items}
                onDragStart={setDragId}
                onDragEnd={() => setDragId(null)}
                onDrop={dropOnSlot}
              />
            ))}
          </div>
          <p className="border-t border-emerald-100 px-3 py-2 text-xs text-emerald-800/70">
            Arraste para reagendar (snap 15 min). Conflitos aparecem em âmbar.
          </p>
        </div>
      )}

      {view === "month" && (
        <div className="space-y-4">
          {monthGroups.map(([dateKey, dayItems]) => (
            <section
              key={dateKey}
              className="rounded-2xl border border-emerald-200 bg-white/70 p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-emerald-900">
                {new Date(`${dateKey}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </h3>
              <div className="space-y-2">
                {dayItems.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    onClick={() => {
                      setDay(new Date(a.starts_at));
                      setView("day");
                    }}
                  >
                    <span>
                      {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {a.patient_display_name}
                    </span>
                    <span className="text-xs text-emerald-800/70">{a.status}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {monthGroups.length === 0 && (
            <p className="text-sm text-emerald-800/70">Nenhum atendimento neste mês.</p>
          )}
        </div>
      )}

      <ConfirmationQueuePanel refreshKey={queueKey} />
    </div>
  );
}

function WeekHourRow({
  hour,
  weekDays,
  items,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  hour: number;
  weekDays: Date[];
  items: Appointment[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (date: Date, hour: number) => Promise<void>;
}) {
  return (
    <>
      <div className="border-b border-emerald-50 px-2 py-3 text-right text-[11px] text-emerald-700">
        {String(hour).padStart(2, "0")}:00
      </div>
      {weekDays.map((d) => {
        const slotItems = items.filter((a) => {
          const starts = new Date(a.starts_at);
          return sameDay(starts, d) && starts.getHours() === hour;
        });
        const conflicts = slotItems.length > 1;
        return (
          <div
            key={`${d.toISOString()}-${hour}`}
            className={`min-h-16 border-b border-l border-emerald-50 p-1 ${
              conflicts ? "bg-amber-50" : ""
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void onDrop(d, hour)}
          >
            {slotItems.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={() => onDragStart(a.id)}
                onDragEnd={onDragEnd}
                className={`mb-1 cursor-grab rounded-lg border px-1.5 py-1 text-[11px] ${
                  conflicts
                    ? "border-amber-300 bg-amber-100 text-amber-950"
                    : "border-emerald-200 bg-emerald-50 text-emerald-950"
                }`}
                title={`${a.patient_display_name} · ${a.status}`}
              >
                <div className="truncate font-semibold">{a.patient_display_name}</div>
                <div className="opacity-70">
                  {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function AppointmentCard({
  a,
  onConfirm,
  onMinus,
  onPlus,
  onCopy,
  onEnqueue,
  onNoShow,
}: {
  a: Appointment;
  onConfirm: () => Promise<void>;
  onMinus: () => void;
  onPlus: () => void;
  onCopy: () => Promise<void>;
  onEnqueue: () => Promise<void>;
  onNoShow: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4">
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
            {a.session_fee != null && a.session_fee !== ""
              ? ` · taxa R$ ${a.session_fee}`
              : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => void onConfirm()}>
            Confirmar
          </button>
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={onMinus}>
            −15 min
          </button>
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={onPlus}>
            +15 min
          </button>
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => void onCopy()}>
            Copiar confirmação
          </button>
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => void onEnqueue()}>
            Enfileirar
          </button>
          <button
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
            onClick={() => void onNoShow()}
          >
            Falta
          </button>
        </div>
      </div>
    </div>
  );
}

function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setDate(date.getDate() + diff);
  return date;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function snap15(minutes: number) {
  return Math.round(minutes / 15) * 15;
}
