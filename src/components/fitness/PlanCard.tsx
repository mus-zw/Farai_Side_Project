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
    <section className="f-card space-y-3" data-testid="plan-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="f-h">Push / Pull / Legs</h2>
          <p className="f-small">
            Today: {today ? <strong className="f-accent">{DAY_LABEL[today]}</strong> : 'rest day'} · Next in rotation:{' '}
            <strong style={{ color: 'var(--f-text)' }}>{DAY_LABEL[next]}</strong>
          </p>
        </div>
        <select
          aria-label="Training schedule"
          data-testid="schedule-select"
          className="f-select"
          style={{ width: 'auto' }}
          value={schedule}
          onChange={(e) => onSchedule(e.target.value as Schedule)}
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
            className="rounded-lg border px-1 py-2"
            style={weekday === todayWeekday ? { borderColor: 'var(--f-accent)', background: 'var(--f-accent-soft)' } : { borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }}
          >
            <div className="f-muted">{weekday}</div>
            <div className={day ? 'font-semibold' : 'f-muted'}>{day ? DAY_LABEL[day] : 'Rest'}</div>
          </div>
        ))}
      </div>

      <ul className="grid gap-1 sm:grid-cols-3 f-small">
        {(Object.keys(DAY_LABEL) as DayType[]).map((d) => (
          <li key={d}>
            <strong style={{ color: 'var(--f-text)' }}>{DAY_LABEL[d]}</strong> · {DAY_FOCUS[d]}
          </li>
        ))}
      </ul>
    </section>
  );
}
