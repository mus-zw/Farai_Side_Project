import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, Home, Sparkles } from 'lucide-react';
import { SCHEDULE_LABEL, Schedule, Unit, deriveTargets, MAX_ATHLETE_NAME, cleanAthleteName, num } from '../../utils/fitness';
import { completeOnboarding, continueAsGuest } from '../../utils/fitnessDb';
import { useProfile } from '../ProfileProvider';

/**
 * First-run screen for /fitness: set up an athlete profile (name, split, units,
 * daily targets), or continue as a guest with sample data. Nothing leaves the
 * browser. A Portfolio link stays visible so nobody is trapped here.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { profile } = useProfile(); // the portfolio's local name, if the visitor already set one
  const [name, setName] = useState(profile.signedIn ? profile.name.slice(0, MAX_ATHLETE_NAME) : '');
  const [schedule, setSchedule] = useState<Schedule>('ppl6');
  const [unit, setUnit] = useState<Unit>('kg');
  const [kcal, setKcal] = useState('2500');
  const [protein, setProtein] = useState('150');
  const [meals, setMeals] = useState('4');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const t = deriveTargets(num(kcal), num(protein), num(meals) || 4);
  const nameOk = cleanAthleteName(name) !== null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOk) {
      setError('Enter a name or handle to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completeOnboarding({ name, schedule, unit, kcal: num(kcal), protein: num(protein), meals: num(meals) || 4 });
      navigate('/fitness', { replace: true }); // always start on Train, whatever URL setup was opened from
    } catch (err: any) {
      setError(err?.message || 'Could not save your profile.');
      setBusy(false);
    }
  };

  const guest = async () => {
    setBusy(true);
    setError('');
    try {
      await continueAsGuest();
      navigate('/fitness', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Could not load the sample data.');
      setBusy(false);
    }
  };

  const num2 = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/\D/g, '').slice(0, max));

  return (
    <div className="mx-auto max-w-md space-y-5 pb-10" data-testid="onboarding">
      <div className="flex items-center justify-between">
        <Link to="/" className="f-btn" style={{ minHeight: 34, padding: '0 11px', fontSize: 12 }} data-testid="onboarding-portfolio">
          <Home className="h-4 w-4" /> Portfolio
        </Link>
        <span className="flex items-center gap-1.5 text-xs font-bold f-muted">
          <Dumbbell className="h-4 w-4 f-accent" /> Fitness
        </span>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Set up your athlete profile
        </h1>
        <p className="f-small">Takes a minute, stays on this device. Change any of it later in Profile.</p>
      </div>

      <form onSubmit={create} className="f-card space-y-5" data-testid="onboarding-form">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Name or handle</span>
          <input
            className="f-input"
            data-testid="onboarding-name"
            value={name}
            maxLength={MAX_ATHLETE_NAME}
            autoComplete="nickname"
            autoFocus
            placeholder="e.g. Farai or @iron_farai"
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">Training split</legend>
          <div className="grid gap-2" role="radiogroup" aria-label="Training split">
            {(Object.keys(SCHEDULE_LABEL) as Schedule[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={schedule === s} data-testid={`split-${s}`} className="f-choice" onClick={() => setSchedule(s)}>
                <span className="font-semibold">Push / Pull / Legs</span>
                <span className="f-small">{SCHEDULE_LABEL[s]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">Weight unit</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Weight unit">
            {(
              [
                ['kg', 'kg'],
                ['lb', 'lbs'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={unit === value} data-testid={`unit-${value}`} className="f-choice" style={{ flex: 1, alignItems: 'center' }} onClick={() => setUnit(value)}>
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">Daily targets</legend>
          <div className="grid grid-cols-3 gap-2 f-small">
            <label className="space-y-1">
              Calories
              <input className="f-input f-center" inputMode="numeric" data-testid="onboarding-kcal" value={kcal} onChange={num2(setKcal, 5)} />
            </label>
            <label className="space-y-1">
              Protein (g)
              <input className="f-input f-center" inputMode="numeric" data-testid="onboarding-protein" value={protein} onChange={num2(setProtein, 4)} />
            </label>
            <label className="space-y-1">
              Meals
              <input className="f-input f-center" inputMode="numeric" data-testid="onboarding-meals" value={meals} onChange={num2(setMeals, 2)} />
            </label>
          </div>
          <p className="f-small" data-testid="onboarding-derived">
            That works out to about {t.carbs} g carbs and {t.fat} g fat a day. Starting points, not medical advice.
          </p>
        </fieldset>

        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="onboarding-error">
            {error}
          </p>
        )}

        <button type="submit" className="f-btn-primary w-full" style={{ minHeight: 48 }} disabled={busy} data-testid="onboarding-create">
          Create profile &amp; start
        </button>
      </form>

      <div className="space-y-2 text-center">
        <p className="f-small">Just looking around?</p>
        <button type="button" className="f-btn w-full" style={{ minHeight: 48 }} disabled={busy} data-testid="onboarding-guest" onClick={() => void guest()}>
          <Sparkles className="h-4 w-4 f-accent" /> Continue as Guest (sample data)
        </button>
        <p className="f-small">Fills the app with made-up history so you can try every screen. You can start fresh any time.</p>
      </div>
    </div>
  );
}
