import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLoop, findLoops, snapLoopEnd } from './loop.ts';

const RATE = 32000;

// A song with an 8 s intro, then a 24 s phrase played twice, then a fade: the loop is that phrase.
function songWithRepeat(): Float32Array {
  const intro = 8 * RATE, phrase = 24 * RATE;
  let seed = 7;
  const noise = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32 - 0.5);
  const notes = Array.from({ length: 48 }, () => 220 * 2 ** Math.floor((noise() + 0.5) * 24 / 12));
  const phraseAt = (i: number) => {
    const note = notes[Math.floor(i / (RATE / 2)) % notes.length];
    return 0.4 * Math.sin((2 * Math.PI * note * i) / RATE) * (1 - ((i % (RATE / 2)) / (RATE / 2)) * 0.7);
  };
  const out = new Float32Array(intro + phrase * 2 + 2 * RATE);
  for (let i = 0; i < intro; i++) out[i] = 0.3 * Math.sin((2 * Math.PI * 97 * i) / RATE) * noise();
  for (let i = 0; i < phrase * 2 + 2 * RATE; i++) out[intro + i] = phraseAt(i % phrase) * (i > phrase * 2 ? 0.3 : 1);
  return out;
}

test('finds a repeating phrase, to the sample length', () => {
  const found = findLoop(songWithRepeat(), RATE);
  assert.ok(found, 'no loop found');
  const length = found.end - found.start;
  assert.ok(Math.abs(length - 24 * RATE) <= 2, `loop length ${length / RATE} s`);
  assert.ok(found.start >= 7.5 * RATE && found.start < 20 * RATE, `starts at ${found.start / RATE} s`);
  assert.ok(found.score > 0.95);
});

test('noise has no loop', () => {
  let seed = 3;
  const mono = new Float32Array(60 * RATE).map(() => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32 - 0.5));
  assert.equal(findLoop(mono, RATE), null);
});

test('candidates: the best loop first, no duplicates', () => {
  const loops = findLoops(songWithRepeat(), RATE);
  assert.ok(loops.length >= 1);
  assert.deepEqual(loops[0], findLoop(songWithRepeat(), RATE));
  for (const [i, a] of loops.entries())
    for (const b of loops.slice(i + 1)) assert.ok(Math.abs(a.start - b.start) >= RATE || Math.abs(a.end - b.end) >= RATE);
});

test('snap end: a slightly wrong end moves back to the exact repeat', () => {
  const mono = songWithRepeat();
  const start = 10 * RATE, exact = start + 24 * RATE;
  for (const off of [-900, -37, 0, 512, 1200]) {
    const snapped = snapLoopEnd(mono, RATE, start, exact + off);
    assert.ok(Math.abs(snapped.end - exact) <= 1, `off by ${off}: landed ${snapped.end - exact}`);
    assert.ok(snapped.score > 0.95);
  }
});
