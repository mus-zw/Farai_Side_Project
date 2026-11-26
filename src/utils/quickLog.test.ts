/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeExercises, parseQuickLog } from './quickLog';
import { newSession } from './fitness';

test('meals: foods are estimated, and the estimate is flagged', () => {
  const r = parseQuickLog('2 eggs, toast');
  assert.equal(r.meals.length, 1);
  assert.equal(r.meals[0].kcal, 223); // 2 eggs (143) + 30 g bread (80)
  assert.equal(r.meals[0].estimated, true);
});

test('meals: typed numbers always win over estimates', () => {
  const m = parseQuickLog('chicken salad 450 kcal 40p 20c 15f').meals[0];
  assert.deepEqual([m.kcal, m.protein, m.carbs, m.fat], [450, 40, 20, 15]);
  assert.equal(m.estimated, false);
  const mixed = parseQuickLog('2 eggs, 450 kcal').meals[0];
  assert.equal(mixed.kcal, 450);
  assert.equal(mixed.note, undefined, 'partial macros are not compared with the typed calories');
});

test('meals: grams are honoured, and a conflicting full set of numbers is flagged', () => {
  const g = parseQuickLog('200g chicken and 150g rice').meals[0];
  assert.equal(g.protein, 66);
  assert.ok(parseQuickLog('shake 900 kcal 10p 10c 5f').meals[0].note);
});

test('workouts: the common notations', () => {
  const ex = (s: string) => parseQuickLog(s).exercises[0];
  const bench = ex('bench 80x8x3');
  assert.equal(bench.sets.length, 3);
  assert.deepEqual([bench.sets[0].weight, bench.sets[0].reps, bench.sets[0].done], ['80', '8', true]);
  const squat = ex('squat 5x5 @ 100kg');
  assert.deepEqual([squat.sets.length, squat.sets[0].reps, squat.sets[0].weight], [5, '5', '100']);
  assert.equal(ex('overhead press 4x6').sets[0].weight, '', 'no weight given: left for the person to fill in');
  const dl = ex('deadlift 140x5');
  assert.deepEqual([dl.sets.length, dl.sets[0].weight, dl.sets[0].reps], [1, '140', '5']);
  assert.equal(parseQuickLog('bench 80x8x3, row 3x10 60kg').exercises.length, 2);
});

test('unreadable or absurd input is returned, never guessed', () => {
  const r = parseQuickLog('asdf qwer\ncurl 20x500x99\nbanana');
  assert.deepEqual(r.unparsed, ['asdf qwer', 'curl 20x500x99']);
  assert.equal(r.meals.length, 1);
  assert.equal(r.exercises.length, 0);
});

test('mergeExercises fills a matching exercise and adds the rest', () => {
  const session = newSession('push');
  const bench = parseQuickLog('bench 82x8x3').exercises[0];
  const curl = parseQuickLog('zottman curl 15x10x3').exercises[0];
  const merged = mergeExercises(session, [bench, curl]);
  assert.equal(merged.exercises.length, session.exercises.length + 1);
  const filled = merged.exercises.find((e) => /bench/i.test(e.name))!;
  assert.equal(filled.name, session.exercises.find((e) => /bench/i.test(e.name))!.name, 'keeps the template name');
  assert.ok(filled.sets.every((s) => s.done && s.weight === '82'));
  assert.equal(session.exercises.find((e) => /bench/i.test(e.name))!.sets.some((s) => s.done), false, 'the original session is not mutated');
});
