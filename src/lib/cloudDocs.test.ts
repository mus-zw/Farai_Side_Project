/// <reference types="node" />
/**
 * The privacy guard for cloud documents. These tests are the contract: camera frames, video, pose
 * landmarks, keypoints, embeddings and long numeric vectors must never be uploaded, and a document
 * carrying them must never be accepted from the cloud. If one of these fails, do not "fix" the test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_SCHEMA, findForbidden, fromCloudDoc, toCloudDoc } from './cloudDocs';

const meal = { id: 'm1', date: '2026-11-26', name: 'Lunch', kcal: 500, protein: 30, carbs: 50, fat: 15 };
const session = {
  id: 's1',
  date: '2026-11-26',
  day: 'push',
  exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ weight: '80', reps: '8', done: true, type: 'normal' }] }],
  notes: '',
  savedAt: 1,
};
const weight = { date: '2026-11-26', value: 80.5 };

const FORBIDDEN_KEYS = ['image', 'images', 'imageData', 'frame', 'frames', 'video', 'videoUrl', 'landmark', 'landmarks', 'poseLandmarks', 'keypoint', 'keypoints', 'embedding', 'embeddings', 'biometric', 'biometrics', 'faceprint', 'descriptor', 'pixel', 'pixels', 'snapshot', 'Snapshot'];

test('findForbidden refuses every media or body-data key name, at any depth', () => {
  for (const key of FORBIDDEN_KEYS) {
    assert.ok(findForbidden({ [key]: 'x' }), `top-level ${key}`);
    assert.ok(findForbidden({ a: { b: { [key]: 1 } } }), `nested ${key}`);
    assert.ok(findForbidden({ list: [{ [key]: 1 }] }), `inside an array ${key}`);
  }
});

test('findForbidden refuses media data URLs, binary data and long numeric vectors', () => {
  assert.ok(findForbidden({ a: 'data:image/png;base64,AAAA' }));
  assert.ok(findForbidden({ a: 'data:video/mp4;base64,AAAA' }));
  assert.ok(findForbidden({ a: new Uint8Array(4) }));
  assert.ok(findForbidden({ a: new ArrayBuffer(8) }));
  assert.ok(findForbidden({ a: new Blob(['x']) }));
  assert.ok(findForbidden({ a: 'x'.repeat(2001) }));
  assert.ok(findForbidden({ v: Array.from({ length: 65 }, (_, i) => i / 3) }), '65 numbers is a vector');
  assert.ok(findForbidden({ deep: { v: Array.from({ length: 200 }, () => 0.5) } }));
});

test('findForbidden allows ordinary fitness data', () => {
  assert.equal(findForbidden(meal), null);
  assert.equal(findForbidden(session), null);
  assert.equal(findForbidden(weight), null);
  assert.equal(findForbidden({ v: Array.from({ length: 64 }, () => 1) }), null, '64 numbers is still allowed');
  assert.equal(findForbidden({ name: 'Image of a meal', note: 'frame the shot' }), null, 'words in values are fine; only keys and data are screened');
});

test('toCloudDoc keeps only known fields: smuggled media never reaches the upload', () => {
  const hostile = { ...meal, image: 'data:image/jpeg;base64,AAAA', frame: 'x', landmarks: [1, 2, 3], embedding: Array.from({ length: 128 }, (_, i) => i), video: 'v', pixels: [1] };
  const r = toCloudDoc('meals', hostile);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(findForbidden(r.data), null);
    assert.deepEqual(Object.keys(r.data).sort(), ['_schema', 'carbs', 'date', 'fat', 'id', 'kcal', 'name', 'protein']);
    assert.equal(r.data._schema, CLOUD_SCHEMA);
  }
  const s = toCloudDoc('sessions', { ...session, keypoints: [[1, 2]], exercises: [{ ...session.exercises[0], landmarks: [1] }] });
  assert.ok(s.ok);
  if (s.ok) assert.equal(findForbidden(s.data), null);
  const w = toCloudDoc('weights', { ...weight, image: 'data:image/png;base64,AAAA' });
  assert.ok(w.ok);
  if (w.ok) assert.equal(findForbidden(w.data), null);
});

test('toCloudDoc accepts the real shapes and refuses garbage', () => {
  assert.ok(toCloudDoc('meals', meal).ok);
  assert.ok(toCloudDoc('sessions', session).ok);
  assert.ok(toCloudDoc('weights', weight).ok);
  assert.equal(toCloudDoc('meals', null).ok, false);
  assert.equal(toCloudDoc('meals', 'nope').ok, false);
  assert.equal(toCloudDoc('sessions', { id: 'x' }).ok, false, 'a session with no day or date is not valid');
});

test('fromCloudDoc rejects any incoming document that carries forbidden data, for every collection', () => {
  const clean = {
    meals: toCloudDoc('meals', meal),
    sessions: toCloudDoc('sessions', session),
    weights: toCloudDoc('weights', weight),
  };
  for (const coll of ['meals', 'sessions', 'weights'] as const) {
    const c = clean[coll];
    assert.ok(c.ok);
    if (!c.ok) continue;
    assert.notEqual(fromCloudDoc(coll, c.id, c.data), null, `${coll}: the clean document is accepted`);
    for (const key of FORBIDDEN_KEYS) {
      assert.equal(fromCloudDoc(coll, c.id, { ...c.data, [key]: 'x' }), null, `${coll}: rejects ${key}`);
      assert.equal(fromCloudDoc(coll, c.id, { ...c.data, extra: { [key]: 1 } }), null, `${coll}: rejects nested ${key}`);
    }
    assert.equal(fromCloudDoc(coll, c.id, { ...c.data, extra: 'data:image/png;base64,AAAA' }), null, `${coll}: rejects a media data URL`);
    assert.equal(fromCloudDoc(coll, c.id, { ...c.data, extra: Array.from({ length: 100 }, () => 0.1) }), null, `${coll}: rejects a numeric vector`);
  }
});

test('fromCloudDoc rejects hostile settings, athlete and cues documents', () => {
  assert.equal(fromCloudDoc('prefs', 'settings', { unit: 'kg', landmarks: [1] }), null);
  assert.equal(fromCloudDoc('prefs', 'athlete', { name: 'A', mode: 'athlete', createdAt: 1, image: 'data:image/png;base64,AAAA' }), null);
  assert.equal(fromCloudDoc('prefs', 'cues', { items: [], embedding: Array.from({ length: 70 }, () => 1) }), null);
  assert.notEqual(fromCloudDoc('prefs', 'settings', { unit: 'kg', schedule: 'ppl6' }), null);
});

test('toCloudDoc settings carry no media and pass the guard', () => {
  const r = toCloudDoc('prefs', { unit: 'kg', schedule: 'ppl6', goal: 'lose', goalWeight: 75.5, targets: { kcal: 2500, protein: 150, carbs: 300, fat: 70, meals: 4 }, restSeconds: 90, autoRest: true, frame: 'x' }, 'settings');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(findForbidden(r.data), null);
    assert.equal(r.data.goalWeight, 75.5);
  }
});

test('over-long ids are refused on the way in', () => {
  const c = toCloudDoc('meals', meal);
  assert.ok(c.ok);
  if (c.ok) assert.equal(fromCloudDoc('meals', 'x'.repeat(121), c.data), null);
});
