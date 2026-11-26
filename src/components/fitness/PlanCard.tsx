import { DAY_FOCUS, DAY_LABEL, DayType, SCHEDULE_LABEL, Schedule, weekPlan } from '../../utils/fitness';

interface Props {
  schedule: Schedule;
  onSchedule: (s: Schedule) => void;
  /** Today's planned day, or null on a rest day. */
  today: DayType | null;
  /** The next day in Push -> Pull -> Legs order after the last saved session. */
  next: DayType;
  /** The weekday the person tapped (e.g. "Thu"), if any; otherwise today is the one in use. */
  selectedWeekday?: string | null;
  /** A planned day was tapped: open that day's session. */
  onSelect?: (weekday: string, day: DayType) => void;
}

/** The Push / Pull / Legs split: the week at a glance, and what to train next. */
export default function PlanCard({ schedule, onSchedule, today, next, selectedWeekday = null, onSelect }: Props) {
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

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]" role="group" aria-label="Pick a day to train">
        {weekPlan(schedule).map(({ weekday, day }) => {
          const isToday = weekday === todayWeekday;
          const isSelected = selectedWeekday === weekday;
          return (
            <button
              key={weekday}
              type="button"
              data-testid={`plan-day-${weekday}`}
              data-selected={isSelected ? 'true' : undefined}
              aria-pressed={isSelected}
              disabled={!day}
              aria-label={day ? `${weekday}: ${DAY_LABEL[day]}${isToday ? ' (today)' : ''}. Open this session.` : `${weekday}: rest day`}
              onClick={() => day && onSelect?.(weekday, day)}
              className="min-h-[52px] rounded-lg border px-1 py-2 transition-colors disabled:cursor-default"
              style={
                isSelected
                  ? { borderColor: 'var(--f-accent)', background: 'var(--f-accent-soft)', boxShadow: 'inset 0 0 0 1px var(--f-accent)' }
                  : isToday
                    ? { borderColor: 'var(--f-accent)', background: 'transparent' }
                    : { borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }
              }
            >
              <div className="f-muted">{isToday ? 'Today' : weekday}</div>
              <div className={day ? 'font-semibold' : 'f-muted'} style={day ? { color: 'var(--f-text)' } : undefined}>
                {day ? DAY_LABEL[day] : 'Rest'}
              </div>
            </button>
          );
        })}
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
