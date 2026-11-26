import { useState } from 'react';
import { DEFAULT_SETTINGS, DayType, nextInRotation, plannedDayFor, weekPlan } from '../../utils/fitness';
import { getCues, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import PlanCard from '../../components/fitness/PlanCard';
import SessionLogger from '../../components/fitness/SessionLogger';
import HistoryList from '../../components/fitness/HistoryList';
import type { ExerciseLog, Session } from '../../utils/fitness';

const NONE: Session[] = [];
const NO_CUES: Record<string, string> = {};

/** A day the person chose on purpose. `weekday` is set when it came from the week plan. */
interface Pick {
  day: DayType;
  weekday?: string;
}

export default function TrainPage({ appendRequest, onAppendHandled }: { appendRequest?: { exercises: ExerciseLog[]; key: number } | null; onAppendHandled?: () => void } = {}) {
  const { settings, updateSettings, notify, startRest } = useFitness();
  // Newest first.
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const cues = useLive(getCues, [], NO_CUES);
  const [editRequest, setEditRequest] = useState<{ session: Session; key: number } | null>(null);
  const next = nextInRotation(sessions);
  const schedule = settings.schedule ?? DEFAULT_SETTINGS.schedule;
  const today = plannedDayFor(schedule);

  // The day in use: what was picked, else today's plan, else the next in rotation. A pick only stands
  // while the schedule still has that weekday as a training day.
  const [pickRaw, setPick] = useState<Pick | null>(null);
  const [openCount, setOpenCount] = useState(0); // bumps when a plan day is tapped, to open that session
  const pick = pickRaw && (!pickRaw.weekday || weekPlan(schedule).some((w) => w.weekday === pickRaw.weekday && w.day === pickRaw.day)) ? pickRaw : null;
  const activeDay: DayType = pick?.day ?? today ?? next;

  return (
    <div className="space-y-4">
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
        appendRequest={appendRequest}
        onAppendHandled={onAppendHandled}
      />
      <HistoryList sessions={sessions} unit={settings.unit} onEdit={(session) => setEditRequest({ session, key: Date.now() })} />
    </div>
  );
}
