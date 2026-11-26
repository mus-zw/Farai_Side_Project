import { DEFAULT_SETTINGS, nextInRotation, plannedDayFor } from '../../utils/fitness';
import { sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import PlanCard from '../../components/fitness/PlanCard';
import SessionLogger from '../../components/fitness/SessionLogger';
import HistoryList from '../../components/fitness/HistoryList';
import type { Session } from '../../utils/fitness';

const NONE: Session[] = [];

export default function TrainPage() {
  const { settings, updateSettings, notify, startRest } = useFitness();
  // Newest first.
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const next = nextInRotation(sessions);
  const today = plannedDayFor(settings.schedule ?? DEFAULT_SETTINGS.schedule);

  return (
    <div className="space-y-4">
      <PlanCard schedule={settings.schedule} onSchedule={(schedule) => updateSettings({ schedule })} today={today} next={next} />
      <SessionLogger sessions={sessions} settings={settings} suggested={today ?? next} onSaved={(m) => notify('success', m)} startRest={startRest} />
      <HistoryList sessions={sessions} unit={settings.unit} />
    </div>
  );
}
