import { useEffect, useState } from 'react';
import { Minus, Plus, SkipForward, Timer } from 'lucide-react';
import { useFitness } from './FitnessProvider';

/** A short beep and a buzz when rest is over. Both are best-effort: no sound permission or vibration motor is fine. */
function alertDone() {
  try {
    // Browsers block vibration until the page has had a tap or key press.
    if ((navigator as any).userActivation?.hasBeenActive !== false) navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not supported.
  }
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => void ctx.close();
  } catch {
    // Autoplay blocked or no audio: fine.
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The rest countdown that starts when a set is ticked off. Uses a deadline, so it stays right in a background tab. */
export default function RestTimerBar() {
  const { rest, adjustRest, skipRest } = useFitness();
  const [now, setNow] = useState(() => performance.now());
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (rest.endsAt === null) return;
    setFinished(false);
    setNow(performance.now());
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, [rest.endsAt]);

  const remainingMs = rest.endsAt === null ? 0 : rest.endsAt - now;

  useEffect(() => {
    if (rest.endsAt !== null && remainingMs <= 0 && !finished) {
      setFinished(true);
      alertDone();
    }
  }, [rest.endsAt, remainingMs, finished]);

  // Its own effect, so the per-tick re-render above cannot cancel the dismiss timer.
  useEffect(() => {
    if (!finished) return;
    const t = window.setTimeout(skipRest, 4000);
    return () => window.clearTimeout(t);
  }, [finished, skipRest]);

  if (rest.endsAt === null) return null;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const pct = rest.total > 0 ? Math.min(1, Math.max(0, remainingMs / 1000 / rest.total)) : 0;

  return (
    <div className="f-timer" role="timer" aria-live="off" data-testid="rest-timer">
      <Timer className="h-5 w-5 shrink-0 f-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs f-muted">{finished ? 'Rest over. Next set!' : 'Rest'}</span>
          <span className="text-lg font-bold tabular-nums" data-testid="rest-remaining">
            {fmt(seconds)}
          </span>
        </div>
        <div className="f-track mt-1">
          <div className="f-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <button type="button" className="f-btn" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => adjustRest(-15)} aria-label="Subtract 15 seconds" data-testid="rest-minus">
        <Minus className="h-3.5 w-3.5" />15
      </button>
      <button type="button" className="f-btn" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => adjustRest(15)} aria-label="Add 15 seconds" data-testid="rest-plus">
        <Plus className="h-3.5 w-3.5" />15
      </button>
      <button type="button" className="f-btn" style={{ minHeight: 36, padding: '0 10px' }} onClick={skipRest} aria-label="Skip rest">
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
