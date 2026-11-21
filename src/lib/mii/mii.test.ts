import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELDS,
  MII_SIZE,
  creatorOf,
  get,
  isValidMii,
  nameOf,
  newMii,
  randomize,
  set,
  studioCode,
  toStudio,
  withCreator,
  withName,
  withGender,
  STARTING_LOOK,
  type FieldKey,
  type Mii,
} from './mii.ts';

const decode = (code: string) => {
  const bytes = code.match(/../g)!.map(h => parseInt(h, 16));
  return bytes.slice(1).map((e, i) => ((e - 7) & 0xff) ^ bytes[i]);
};

test('every field reads back what was set, and nothing else changes', () => {
  const base = newMii(0);
  for (const key of Object.keys(FIELDS) as FieldKey[]) {
    const { max } = FIELDS[key];
    const changed = set(base, key, max);
    assert.equal(get(changed, key), max, key);
    for (const other of Object.keys(FIELDS) as FieldKey[]) {
      if (other !== key && FIELDS[other].at !== FIELDS[key].at) assert.equal(get(changed, other), get(base, other), `${key} touched ${other}`);
    }
  }
});

test('out-of-range values are refused and the original is untouched', () => {
  const m = newMii(0);
  assert.throws(() => set(m, 'hairType', 72), RangeError);
  assert.throws(() => set(m, 'eyebrowVertical', 2), RangeError);
  assert.equal(get(m, 'hairType'), 33);
});

test('names round-trip and are limited to 10 characters', () => {
  const m = withCreator(withName(newMii(0), 'Lucía'), 'Me');
  assert.equal(nameOf(m), 'Lucía');
  assert.equal(creatorOf(m), 'Me');
  assert.throws(() => withName(m, 'ElevenChars'), RangeError);
});

test('a new Mii is valid, normal, and 74 bytes', () => {
  const m = newMii(1_800_000_000_000);
  assert.equal(m.length, MII_SIZE);
  assert.equal(m[0x18] & 0xe0, 0x80);
  assert.ok(isValidMii(m));
  assert.equal(nameOf(m), 'New Mii');
});

test('random Miis stay valid', () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 50; i++) assert.ok(isValidMii(randomize(newMii(0), rnd)));
});

test('the studio code decodes back to the studio bytes', () => {
  const m = newMii(0);
  const code = studioCode(m);
  assert.equal(code.length, 94);
  assert.deepEqual(decode(code), toStudio(m));
});

test('studio mapping matches the Rust converter on known fields', () => {
  let m = newMii(0) as Mii;
  m = set(set(set(m, 'hairType', 33), 'hairColor', 4), 'hairFlipped', 1);
  m = set(set(m, 'eyeType', 12), 'eyeColor', 3);
  m = set(set(m, 'facialFeature', 5), 'isGirl', 1);
  const s = toStudio(m);
  assert.deepEqual([s[0x1d], s[0x1b], s[0x1c]], [33, 4, 1]);
  assert.deepEqual([s[0x07], s[0x04]], [12, 11]);
  assert.equal(s[0x14], 2); // facial feature 5 -> wrinkles 2
  assert.equal(s[0x16], 1);
  assert.deepEqual([s[0x03], s[0x0a], s[0x23]], [3, 3, 3]);
});

test('zero bytes and wrong lengths are not Miis', () => {
  assert.equal(isValidMii(new Uint8Array(MII_SIZE)), false);
  assert.equal(isValidMii(new Uint8Array(76)), false);
});

test('switching a fresh Mii to female gives the female starting face, and back', () => {
  const girl = withGender(newMii(0), true);
  assert.equal(get(girl, 'isGirl'), 1);
  assert.equal(get(girl, 'hairType'), STARTING_LOOK.female.hairType);
  assert.equal(get(girl, 'mouthType'), STARTING_LOOK.female.mouthType);
  const boy = withGender(girl, false);
  assert.equal(get(boy, 'isGirl'), 0);
  assert.equal(get(boy, 'hairType'), STARTING_LOOK.male.hairType);
  assert.deepEqual(newMii(0, true), girl);
});

test('switching gender keeps a face you already changed', () => {
  const edited = set(newMii(0), 'hairType', 50);
  const girl = withGender(edited, true);
  assert.equal(get(girl, 'isGirl'), 1);
  assert.equal(get(girl, 'hairType'), 50);
  assert.equal(get(girl, 'eyeType'), STARTING_LOOK.male.eyeType);
});
