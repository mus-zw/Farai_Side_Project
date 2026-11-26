/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { backupDue, looksOffline } from './offline';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 26);
const due = (over: Partial<Parameters<typeof backupDue>[0]> = {}) => backupDue({ records: 20, signedIn: false, seeded: false, lastBackup: null, snoozedUntil: null, now, ...over });

test('backup reminder: only for a personal, local-only, un-backed-up log', () => {
  assert.equal(due(), true);
  assert.equal(due({ signedIn: true }), false);
  assert.equal(due({ seeded: true }), false);
  assert.equal(due({ records: 4 }), false);
  assert.equal(due({ lastBackup: now - 10 * DAY }), false);
  assert.equal(due({ lastBackup: now - 31 * DAY }), true);
  assert.equal(due({ snoozedUntil: now + 3 * DAY }), false);
  assert.equal(due({ snoozedUntil: now - 1 }), true);
});

test('looksOffline recognises network failures and not real bugs', () => {
  assert.equal(looksOffline(new TypeError('Failed to fetch')), true);
  assert.equal(looksOffline(new Error('Failed to fetch dynamically imported module: x.js')), true);
  assert.equal(looksOffline(new Error('Invalid model file')), false);
});
