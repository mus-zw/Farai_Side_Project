import { useState } from 'react';
import { DEFAULT_SETTINGS, nextInRotation, plannedDayFor } from '../../utils/fitness';
import { getCues, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import PlanCard from '../../components/fitness/PlanCard';
import SessionLogger from '../../components/fitness/SessionLogger';
import HistoryList from '../../components/fitness/HistoryList';
import type { Session } from '../../utils/fitness';

const NONE: Session[] = [];
const NO_CUES: Record<string, string> = {};

export default function TrainPage() {
  const { settings, updateSettings, notify, startRest } = useFitness();
  // Newest first.
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const cues = useLive(getCues, [], NO_CUES);
  const [editRequest, setEditRequest] = useState<{ session: Session; key: number } | null>(null);
  const next = nextInRotation(sessions);
  const today = plannedDayFor(settings.schedule ?? DEFAULT_SETTINGS.schedule);

  return (
    <div className="space-y-4">
      <PlanCard schedule={settings.schedule} onSchedule={(schedule) => updateSettings({ schedule })} today={today} next={next} />
      <SessionLogger sessions={sessions} cues={cues} settings={settings} suggested={today ?? next} onSaved={(m) => notify('success', m)} startRest={startRest} editRequest={editRequest} onEditHandled={() => setEditRequest(null)} />
      <HistoryList sessions={sessions} unit={settings.unit} onEdit={(session) => setEditRequest({ session, key: Date.now() })} />
    </div>
  );
}
