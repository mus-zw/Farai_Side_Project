import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ScanSearch, UserCircle2 } from 'lucide-react';
import { SCHEDULE_LABEL, Schedule, Unit, MAX_ATHLETE_NAME, cleanAthleteName, num } from '../../utils/fitness';
import { renameAthlete, resetEverything, seedSampleData, startFresh } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import { useProfile } from '../../components/ProfileProvider';
import BackupPanel from '../../components/fitness/BackupPanel';

const REST_PRESETS = [60, 90, 120, 180];

export default function ProfilePage() {
  const { settings, updateSettings, seeded, athlete, notify } = useFitness();
  const { openProfile } = useProfile();
  const [name, setName] = useState(athlete?.name ?? '');
  useEffect(() => setName(athlete?.name ?? ''), [athlete?.name]);
  if (!athlete) return null;

  const guest = athlete.mode === 'guest';
  const nameChanged = cleanAthleteName(name) !== null && cleanAthleteName(name) !== athlete.name;

  const setTarget = (key: 'kcal' | 'protein' | 'meals', raw: string) => {
    const v = Math.round(num(raw));
    updateSettings({ targets: { [key]: key === 'meals' ? Math.min(12, v) : v } });
  };

  return (
    <div className="space-y-4">
      <section className="f-card space-y-4" data-testid="athlete-card">
        <div className="flex items-center gap-3">
          <span className="f-avatar lg" aria-hidden="true">
            {athlete.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold" data-testid="athlete-name">
              {athlete.name}
            </div>
            <div className="f-small">
              {guest ? 'Guest · sample data' : 'Athlete profile'} · since {new Date(athlete.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameChanged) {
              void renameAthlete(name);
              notify('success', 'Name updated.');
            }
          }}
        >
          <input className="f-input" data-testid="rename-input" aria-label="Name or handle" maxLength={MAX_ATHLETE_NAME} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="f-btn-primary" data-testid="rename-save" disabled={!nameChanged}>
            Save
          </button>
        </form>
      </section>

      <section className="f-card space-y-4" data-testid="plan-settings">
        <h2 className="f-h">Plan &amp; targets</h2>
        <div className="space-y-1.5">
          <div className="text-sm">Training split</div>
          <div className="grid gap-2" role="radiogroup" aria-label="Training split">
            {(Object.keys(SCHEDULE_LABEL) as Schedule[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={settings.schedule === s} data-testid={`profile-split-${s}`} className="f-choice" onClick={() => updateSettings({ schedule: s })}>
                <span className="font-semibold">Push / Pull / Legs</span>
                <span className="f-small">{SCHEDULE_LABEL[s]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-sm">Weight unit</div>
          <div className="flex gap-2" role="radiogroup" aria-label="Weight unit">
            {(
              [
                ['kg', 'kg'],
                ['lb', 'lbs'],
              ] as [Unit, string][]
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={settings.unit === value} data-testid={`profile-unit-${value}`} className="f-choice" style={{ flex: 1, alignItems: 'center' }} onClick={() => updateSettings({ unit: value })}>
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>
          <p className="f-small">Changing the unit relabels your numbers; it does not convert values you already logged.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 f-small">
          <label className="space-y-1">
            Calories
            <input className="f-input f-center" inputMode="numeric" data-testid="profile-kcal" value={settings.targets.kcal} onChange={(e) => setTarget('kcal', e.target.value)} />
          </label>
          <label className="space-y-1">
            Protein (g)
            <input className="f-input f-center" inputMode="numeric" data-testid="profile-protein" value={settings.targets.protein} onChange={(e) => setTarget('protein', e.target.value)} />
          </label>
          <label className="space-y-1">
            Meals / day
            <input className="f-input f-center" inputMode="numeric" data-testid="profile-meals" value={settings.targets.meals} onChange={(e) => setTarget('meals', e.target.value)} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Auto rest timer</span>
          <input type="checkbox" className="h-5 w-5" style={{ accentColor: 'var(--f-accent)' }} aria-label="Auto rest timer" data-testid="auto-rest" checked={settings.autoRest} onChange={(e) => updateSettings({ autoRest: e.target.checked })} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm">Rest</span>
          {REST_PRESETS.map((s) => (
            <button key={s} type="button" className="f-chip" aria-pressed={settings.restSeconds === s} data-testid={`rest-${s}`} onClick={() => updateSettings({ restSeconds: s })}>
              {s}s
            </button>
          ))}
        </div>
      </section>

      <section className="f-card space-y-3" data-testid="data-card">
        <h2 className="f-h">{seeded ? 'You are looking at sample data' : 'Your data'}</h2>
        <p className="f-small">
          {seeded
            ? 'This is made-up history so every screen has something to show. Start fresh when you are ready to log your own.'
            : 'Everything you log stays in this browser (IndexedDB). Nothing is uploaded.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={seeded ? 'f-btn-primary' : 'f-btn'}
            data-testid="start-fresh"
            onClick={async () => {
              const msg = seeded
                ? 'Remove the sample data and start with an empty log? You will keep your plan and targets.'
                : 'Clear all your logged sessions, meals and weigh-ins? You keep your profile, plan and targets. Download a backup first if you want a copy.';
              if (!window.confirm(msg)) return;
              await startFresh();
              notify('success', guest ? 'Sample data removed. You are now a regular athlete profile: rename yourself above.' : 'Your logs were cleared.');
            }}
          >
            {seeded ? 'Start fresh' : 'Clear my logs'}
          </button>
          {seeded ? (
            <button type="button" className="f-btn" data-testid="reset-sample" onClick={async () => { await seedSampleData(); notify('success', 'Sample data reset.'); }}>
              Reset sample data
            </button>
          ) : (
            <button
              type="button"
              className="f-btn"
              data-testid="load-sample"
              onClick={async () => {
                if (window.confirm('Loading sample data REPLACES everything you have logged. Download a backup first if you want to keep it. Continue?')) {
                  await seedSampleData();
                  notify('success', 'Sample data loaded.');
                }
              }}
            >
              Load sample data
            </button>
          )}
          <button
            type="button"
            className="f-btn-danger"
            data-testid="reset-everything"
            onClick={async () => {
              if (window.confirm('Delete your profile and ALL fitness data from this browser, then go back to setup? This cannot be undone.')) {
                await resetEverything();
              }
            }}
          >
            Sign out &amp; restart setup
          </button>
        </div>
      </section>

      <BackupPanel unit={settings.unit} notify={notify} />

      <section className="f-card space-y-3" data-testid="elsewhere-card">
        <h2 className="f-h">Elsewhere</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="f-btn" data-testid="more-portfolio">
            <ArrowLeft className="h-4 w-4" /> Portfolio
          </Link>
          <Link to="/demo" className="f-btn" data-testid="to-demo">
            <ScanSearch className="h-4 w-4" /> CV Demo
          </Link>
          <button type="button" className="f-btn" onClick={openProfile}>
            <UserCircle2 className="h-4 w-4" /> Site profile &amp; interests
          </button>
        </div>
      </section>
    </div>
  );
}
