import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stretch, toPcm16 } from './pcm.ts';

const RATE = 32000;
const sine = (freq: number, seconds: number): Float32Array =>
  new Float32Array(RATE * seconds).map((_, i) => 0.5 * Math.sin((2 * Math.PI * freq * i) / RATE));

// Upward zero crossings per second = the frequency.
function frequency(samples: Float32Array): number {
  let crossings = 0;
  const from = 2048, to = samples.length - 2048;
  for (let i = from + 1; i < to; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
  return (crossings * RATE) / (to - from);
}

for (const speed of [0.5, 0.75, 1.25, 1.5, 2])
  test(`keep-pitch speed ${speed}x: length divides, pitch stays`, () => {
    const [out] = stretch([sine(440, 3)], speed);
    assert.equal(out.length, Math.floor((RATE * 3) / speed));
    assert.ok(Math.abs(frequency(out) - 440) < 3, `got ${frequency(out)} Hz`);
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(peak > 0.45 && peak < 0.56, `level ${peak}`);
  });

test('volume never clips: a boost past full scale is turned down to fit', () => {
  const [left, right] = toPcm16([new Float32Array([0.9, -0.9])], 12);
  assert.deepEqual([...left], [32767, -32767]);
  assert.deepEqual([...right], [...left]);
  const [quiet] = toPcm16([new Float32Array([0.5])], -6);
  assert.equal(quiet[0], Math.round(0.5 * 10 ** (-6 / 20) * 32767));
});
