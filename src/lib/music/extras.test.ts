import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evenVolumes, loudnessDb } from './loudness.ts';
import { jobKey, newAssignment } from './pack.ts';
import { parsePack } from './packState.ts';

const RATE = 32000;
const sine = (amplitude: number, seconds: number) =>
  Float32Array.from({ length: seconds * RATE }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / RATE));

test('loudness: a full-scale sine is about -3 dB, half as loud is 6 dB lower', () => {
  assert.ok(Math.abs(loudnessDb(sine(1, 4), RATE) + 3.01) < 0.05);
  assert.ok(Math.abs(loudnessDb(sine(0.5, 4), RATE) - loudnessDb(sine(1, 4), RATE) + 6.02) < 0.05);
});

test('loudness: silence and quiet stretches do not pull a song down', () => {
  const loud = sine(0.5, 4);
  const withGap = new Float32Array(loud.length * 2);
  withGap.set(loud); // then 4 s of silence
  assert.ok(Math.abs(loudnessDb(withGap, RATE) - loudnessDb(loud, RATE)) < 0.05);
  assert.equal(loudnessDb(new Float32Array(RATE), RATE), -Infinity);
});

test('even volumes: everything moves to the middle song, within ±12 dB', () => {
  const volumes = evenVolumes(new Map([['quiet', -20], ['middle', -12], ['loud', -6], ['silent', -Infinity], ['way-off', -40]]));
  // sorted: -40 -20 -12 -6 → the middle one (index 2) is -12
  assert.deepEqual(Object.fromEntries(volumes), { quiet: 8, middle: 0, loud: -6, 'way-off': 12 });
});

test('skip the start and fade in: part of the encode, and kept when the pack is saved', () => {
  const a = newAssignment('song');
  assert.notEqual(jobKey(a), jobKey({ ...a, trimStart: 5 }));
  assert.notEqual(jobKey(a), jobKey({ ...a, fadeIn: 2 }));
  const pack = parsePack(JSON.stringify({ packName: 'x', assignments: { T: { ...a, trimStart: 5, fadeIn: 99 } } }));
  assert.equal(pack.assignments.T.trimStart, 5);
  assert.equal(pack.assignments.T.fadeIn, 10);
  const plain = parsePack(JSON.stringify({ packName: 'x', assignments: { T: a } }));
  assert.equal('trimStart' in plain.assignments.T, false);
});
