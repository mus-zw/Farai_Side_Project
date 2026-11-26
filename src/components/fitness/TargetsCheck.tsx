import { Targets, checkMealKcal } from '../../utils/fitness';

/**
 * Do the daily calorie and macro targets agree (4 / 4 / 9 per gram)? Says so when they do not, with a
 * one-tap fix that sets calories from the macros. Renders nothing while they are consistent.
 */
export default function TargetsCheck({ targets, onFix }: { targets: Targets; onFix: (kcal: number) => void }) {
  const check = checkMealKcal(targets.kcal, targets.protein, targets.carbs, targets.fat);
  if (check.ok) return null;
  return (
    <p className="col-span-full text-xs" role="status" style={{ color: 'var(--f-gold)' }} data-testid="targets-mismatch">
      Your macro targets add up to {check.macroKcal} kcal (4 per g of protein and carbs, 9 per g of fat), but your calorie target is {targets.kcal}.{' '}
      <button type="button" className="underline" style={{ minHeight: 32 }} data-testid="targets-fix" onClick={() => onFix(check.macroKcal)}>
        Set calories to {check.macroKcal}
      </button>
    </p>
  );
}
