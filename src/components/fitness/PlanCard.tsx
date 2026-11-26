import { DAY_FOCUS, DAY_LABEL, DayType, SCHEDULE_LABEL, Schedule, weekPlan } from '../../utils/fitness';

interface Props {
  schedule: Schedule;
  onSchedule: (s: Schedule) => void;
  /** Today's planned day, or null on a rest day. */
  today: DayType | null;
  /** The next day in Push -> Pull -> Legs order after the last saved session. */
  next: DayType;
}

/** The Push / Pull / Legs split: the week at a glance, and what to train next. */
export default function PlanCard({ schedule, onSchedule, today, next }: Props) {
  const todayWeekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  return (
    <section className="rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5 space-y-4" data-testid="plan-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Push / Pull / Legs</h2>
          <p className="text-xs text-neutral-500">
            Today: {today ? <strong className="text-[#32FF00]">{DAY_LABEL[today]}</strong> : 'rest day'} · Next in rotation:{' '}
            <strong className="text-neutral-200">{DAY_LABEL[next]}</strong>
          </p>
        </div>
        <select
          aria-label="Training schedule"
          data-testid="schedule-select"
          value={schedule}
          onChange={(e) => onSchedule(e.target.value as Schedule)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          {(Object.keys(SCHEDULE_LABEL) as Schedule[]).map((s) => (
            <option key={s} value={s}>
              {SCHEDULE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
        {weekPlan(schedule).map(({ weekday, day }) => (
          <div
            key={weekday}
            className={`rounded-lg border px-1 py-2 ${
              weekday === todayWeekday ? 'border-[#32FF00] bg-[#32FF00]/10' : 'border-neutral-800 bg-neutral-900/50'
            }`}
          >
            <div className="text-neutral-500">{weekday}</div>
            <div className={day ? 'font-semibold text-white' : 'text-neutral-600'}>{day ? DAY_LABEL[day] : 'Rest'}</div>
          </div>
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-3 text-[11px] text-neutral-400">
        {(Object.keys(DAY_LABEL) as DayType[]).map((d) => (
          <li key={d}>
            <strong className="text-neutral-200">{DAY_LABEL[d]}</strong> · {DAY_FOCUS[d]}
          </li>
        ))}
      </ul>
    </section>
  );
}
