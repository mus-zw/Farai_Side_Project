/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEAL_LIMITS, checkMealKcal, cleanWeightInput, daysBetween, isPristineDraft, newSession, plannedDaysPerWeek, kcalFromMacros } from './fitness';

test('calories from macros use 4 / 4 / 9', () => {
  assert.equal(kcalFromMacros(40, 60, 15), 535);
});

test('checkMealKcal: tolerance is 15% with at least 40 kcal of slack', () => {
  assert.equal(checkMealKcal(560, 40, 60, 15).ok, true);
  assert.equal(checkMealKcal(1200, 40, 60, 15).ok, false);
  assert.equal(checkMealKcal(100, 0, 0, 0).ok, true, 'no macros: nothing to compare');
  // A 60 kcal meal (10 g protein, 5 g carbs) gets 40 kcal of slack for rounding and fibre, so up to 100 passes.
  assert.equal(checkMealKcal(100, 10, 5, 0).ok, true);
  assert.equal(checkMealKcal(101, 10, 5, 0).ok, false);
  assert.equal(checkMealKcal(130, 10, 5, 0).ok, false, 'a 2x error on a small meal is still caught');
  assert.equal(MEAL_LIMITS.protein, 300);
});

test('cleanWeightInput keeps digits and one separator', () => {
  assert.equal(cleanWeightInput('80abc'), '80');
  assert.equal(cleanWeightInput('1.2.3,4'), '1.234');
  assert.equal(cleanWeightInput('82,5'), '82,5');
  assert.equal(cleanWeightInput('123456789'), '12345678');
});

test('planned days and date arithmetic', () => {
  assert.equal(plannedDaysPerWeek('ppl6'), 6);
  assert.equal(plannedDaysPerWeek('ppl3'), 3);
  assert.equal(daysBetween('2026-11-20', '2026-11-26'), 6);
  assert.equal(daysBetween('2026-11-26', '2026-11-20'), -6);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
});

test('isPristineDraft: untouched is swappable, any entry is not', () => {
  const d = newSession('push');
  assert.equal(isPristineDraft(d, []), true);
  const ticked = structuredClone(d);
  ticked.exercises[0].sets[0].done = true;
  assert.equal(isPristineDraft(ticked, []), false);
  const typed = structuredClone(d);
  typed.exercises[0].sets[0].weight = '99';
  assert.equal(isPristineDraft(typed, []), false);
  const extra = structuredClone(d);
  extra.exercises.pop();
  assert.equal(isPristineDraft(extra, []), false);
});
