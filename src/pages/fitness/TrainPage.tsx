import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, DayType, ExerciseLog, Session, nextInRotation, plannedDayFor, weekPlan } from '../../utils/fitness';
import { getCues, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import PlanCard from '../../components/fitness/PlanCard';
import QuickLog from '../../components/fitness/QuickLog';
import SessionLogger from '../../components/fitness/SessionLogger';
import HistoryList from '../../components/fitness/HistoryList';

const NONE: Session[] = [];
const NO_CUES: Record<string, string> = {};

/** A day the person chose on purpose. `weekday` is set when it came from the week plan. */
interface Pick {
  day: DayType;
  weekday?: string;
}

/** Everything for training: the plan, the session you are logging (recovered if it was left open), and history. */
export default function TrainPage() {
  const { settings, updateSettings, notify, startRest } = useFitness();
  const location = useLocation();
  const navigate = useNavigate();
  // Newest first.
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const cues = useLive(getCues, [], NO_CUES);
  const [editRequest, setEditRequest] = useState<{ session: Session; key: number } | null>(null);
  const [append, setAppend] = useState<{ exercises: ExerciseLog[]; key: number } | null>(null);
  const next = nextInRotation(sessions);
  const schedule = settings.schedule ?? DEFAULT_SETTINGS.schedule;
  const today = plannedDayFor(schedule);

  // The day in use: what was picked, else today's plan, else the next in rotation. A pick only stands
  // while the schedule still has that weekday as a training day.
  const [pickRaw, setPick] = useState<Pick | null>(null);
  const [openCount, setOpenCount] = useState(0); // bumps when a plan day is tapped, to open that session
  const pick = pickRaw && (!pickRaw.weekday || weekPlan(schedule).some((w) => w.weekday === pickRaw.weekday && w.day === pickRaw.day)) ? pickRaw : null;
  const activeDay: DayType = pick?.day ?? today ?? next;

  // "Start workout" on Today lands here with the day to open; take it once, then clear it so a reload does not repeat it.
  useEffect(() => {
    const start = (location.state as { start?: DayType } | null)?.start;
    if (!start) return;
    setPick({ day: start });
    setOpenCount((n) => n + 1);
    navigate(location.pathname, { replace: true, state: null });
    window.setTimeout(() => document.querySelector('[data-testid=session-draft]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <QuickLog mode="workout" notify={notify} onExercises={(exercises) => setAppend({ exercises, key: Date.now() })} />
      <PlanCard
        schedule={schedule}
        onSchedule={(s) => {
          setPick(null);
          updateSettings({ schedule: s });
        }}
        today={today}
        next={next}
        selectedWeekday={pick?.weekday ?? null}
        onSelect={(weekday, day) => {
          setPick({ day, weekday });
          setOpenCount((n) => n + 1);
        }}
      />
      <SessionLogger
        sessions={sessions}
        cues={cues}
        settings={settings}
        activeDay={activeDay}
        activeLabel={pick ? 'selected' : today ? 'today' : 'next up'}
        openCount={openCount}
        onDayChosen={(day) => setPick({ day })}
        onSaved={(m) => notify('success', m)}
        startRest={startRest}
        editRequest={editRequest}
        onEditHandled={() => setEditRequest(null)}
        appendRequest={append}
        onAppendHandled={() => setAppend(null)}
      />
      <HistoryList sessions={sessions} unit={settings.unit} onEdit={(session) => setEditRequest({ session, key: Date.now() })} />
    </div>
  );
}
