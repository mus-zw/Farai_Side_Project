import { Link } from 'react-router-dom';
import { UserCircle2, ArrowLeft } from 'lucide-react';
import { eraseAll, seedSampleData } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import { useProfile } from '../../components/ProfileProvider';
import BackupPanel from '../../components/fitness/BackupPanel';

const REST_PRESETS = [60, 90, 120, 180];

export default function MorePage() {
  const { settings, updateSettings, seeded, notify } = useFitness();
  const { profile, openProfile } = useProfile();

  return (
    <div className="space-y-4">
      <section className="f-card space-y-3" data-testid="data-card">
        <h2 className="f-h">{seeded ? 'You are looking at sample data' : 'Your data'}</h2>
        <p className="f-small">
          {seeded
            ? 'This is made-up history so every screen has something to show. Start fresh when you are ready to log your own.'
            : 'Everything you log stays in this browser (IndexedDB). Nothing is uploaded.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {seeded ? (
            <>
              <button
                type="button"
                className="f-btn-primary"
                data-testid="start-fresh"
                onClick={async () => {
                  if (window.confirm('Remove the sample data and start with an empty log?')) {
                    await eraseAll();
                    notify('success', 'Sample data removed. Your log is empty.');
                  }
                }}
              >
                Start fresh
              </button>
              <button type="button" className="f-btn" data-testid="reset-sample" onClick={async () => { await seedSampleData(); notify('success', 'Sample data reset.'); }}>
                Reset sample data
              </button>
            </>
          ) : (
            <>
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
              <button
                type="button"
                className="f-btn-danger"
                data-testid="erase-all"
                onClick={async () => {
                  if (window.confirm('Permanently delete ALL sessions, meals, weigh-ins and settings from this browser? This cannot be undone.')) {
                    await eraseAll();
                    notify('info', 'All fitness data deleted.');
                  }
                }}
              >
                Erase everything
              </button>
            </>
          )}
        </div>
      </section>

      <section className="f-card space-y-3" data-testid="settings-card">
        <h2 className="f-h">Settings</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          Weight unit
          <select className="f-select" style={{ width: 'auto' }} aria-label="Weight unit" data-testid="unit-select" value={settings.unit} onChange={(e) => updateSettings({ unit: e.target.value === 'lb' ? 'lb' : 'kg' })}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
        <p className="f-small">Changing the unit relabels your numbers; it does not convert values you already logged.</p>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Auto rest timer</span>
          <input type="checkbox" className="h-5 w-5" style={{ accentColor: 'var(--f-accent)' }} aria-label="Auto rest timer" data-testid="auto-rest" checked={settings.autoRest} onChange={(e) => updateSettings({ autoRest: e.target.checked })} />
        </div>
        <div>
          <div className="mb-1.5 text-sm">Rest between sets</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {REST_PRESETS.map((s) => (
              <button key={s} type="button" className="f-chip" aria-pressed={settings.restSeconds === s} data-testid={`rest-${s}`} onClick={() => updateSettings({ restSeconds: s })}>
                {s}s
              </button>
            ))}
            <span className="f-small">Use −15/+15 on the timer to adjust a single rest.</span>
          </div>
        </div>
      </section>

      <BackupPanel unit={settings.unit} notify={notify} />

      <section className="f-card space-y-3">
        <h2 className="f-h">Account</h2>
        <p className="f-small">{profile.signedIn ? `Signed in locally as ${profile.name}.` : 'Add your name and interests (stored in this browser only).'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="f-btn" onClick={openProfile}>
            <UserCircle2 className="h-4 w-4" /> Profile &amp; interests
          </button>
          <Link to="/" className="f-btn" data-testid="more-portfolio">
            <ArrowLeft className="h-4 w-4" /> Back to portfolio
          </Link>
          <Link to="/demo" className="f-btn">
            CV Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
