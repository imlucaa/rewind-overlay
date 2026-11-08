import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeBrstm, withSampleRate } from './brstm.ts';
import { testSignal } from './testSignal.ts';

// The fixture is VGAudio 2.2.1's BrstmWriter output for the same samples, looping the whole song.
test('matches VGAudio byte for byte', () => {
  const expected = readFileSync(new URL('./fixtures/vgaudio-30001.brstm', import.meta.url));
  const actual = writeBrstm(testSignal(), 32000);
  assert.equal(actual.length, expected.length);
  assert.ok(Buffer.from(actual).equals(expected));
});

test('final lap copy only changes the header rate', () => {
  const file = writeBrstm(testSignal(2000), 32000);
  const fast = withSampleRate(file, 33920);
  const view = new DataView(fast.buffer);
  assert.equal(view.getUint16(0x64), 33920);
  assert.equal(new DataView(file.buffer).getUint16(0x64), 32000);
  assert.deepEqual(fast.subarray(0x70), file.subarray(0x70));
});

// VGAudio moves a loop start of 10007 to the next block (14336) and copies the skipped audio onto the end.
test('a loop in the middle matches VGAudio byte for byte', () => {
  const expected = readFileSync(new URL('./fixtures/vgaudio-30001-loop10007.brstm', import.meta.url));
  const actual = writeBrstm(testSignal(), 32000, true, undefined, 10007);
  assert.equal(actual.length, expected.length);
  assert.ok(Buffer.from(actual).equals(expected));
});
