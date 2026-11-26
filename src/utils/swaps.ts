/**
 * Sensible alternatives for a lift, for swapping an exercise in the middle of a session (a busy rack,
 * a sore joint, a plateau). Plain keyword rules, no network. Names are examples to pick from.
 */

const RULES: { match: RegExp; options: string[] }[] = [
  { match: /bench|chest press|push[- ]?up/i, options: ['Incline Dumbbell Press', 'Dumbbell Bench Press', 'Machine Chest Press'] },
  { match: /overhead|shoulder press|military/i, options: ['Dumbbell Shoulder Press', 'Arnold Press', 'Landmine Press'] },
  { match: /lateral|side raise/i, options: ['Cable Lateral Raise', 'Machine Lateral Raise'] },
  { match: /tricep|pushdown|skull|dip/i, options: ['Overhead Cable Extension', 'Skull Crusher', 'Close-Grip Push-up'] },
  { match: /pull[- ]?up|chin|pulldown/i, options: ['Lat Pulldown', 'Assisted Pull-up', 'Neutral-Grip Pulldown'] },
  { match: /row/i, options: ['Chest-Supported Row', 'Cable Row', 'One-Arm Dumbbell Row'] },
  { match: /curl/i, options: ['Hammer Curl', 'Cable Curl', 'Incline Dumbbell Curl'] },
  { match: /romanian|rdl|stiff/i, options: ['Good Morning', 'Back Extension', 'Hamstring Curl'] },
  { match: /deadlift/i, options: ['Romanian Deadlift', 'Trap Bar Deadlift', 'Rack Pull'] },
  { match: /leg press/i, options: ['Hack Squat', 'Goblet Squat', 'Walking Lunge'] },
  { match: /squat/i, options: ['Leg Press', 'Front Squat', 'Hack Squat'] },
  { match: /lunge|split squat/i, options: ['Bulgarian Split Squat', 'Step-up', 'Leg Press'] },
  { match: /leg curl|hamstring/i, options: ['Romanian Deadlift', 'Nordic Curl', 'Swiss-Ball Curl'] },
  { match: /calf/i, options: ['Seated Calf Raise', 'Leg Press Calf Raise'] },
  { match: /face pull|rear delt/i, options: ['Reverse Pec Deck', 'Band Pull-Apart'] },
];

/** Up to three alternatives for an exercise name, never the exercise itself. Empty if none are known. */
export function alternativesFor(name: string): string[] {
  const lower = name.trim().toLowerCase();
  const rule = RULES.find((r) => r.match.test(name));
  return (rule?.options ?? []).filter((o) => o.toLowerCase() !== lower).slice(0, 3);
}
