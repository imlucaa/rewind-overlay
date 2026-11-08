import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeBrstm, withSampleRate } from './brstm.ts';
import { readBrstm, toWav } from './brstmRead.ts';
import { readZip } from './zipRead.ts';
import { ZipWriter } from './zip.ts';
import { nearestSpeed, planImport, sameBytes } from './packImport.ts';
import { parseTrackList } from './tracks.ts';

const list = parseTrackList(readFileSync(new URL('../../../public/data/rr-tracks.tsv', import.meta.url), 'utf8'));

function tone(n: number, freq: number): Int16Array {
  return Int16Array.from({ length: n }, (_, i) => Math.round(12000 * Math.sin((2 * Math.PI * freq * i) / 32000)));
}

test('brstm: what the writer makes reads back as the same song, rate and loop', () => {
  const left = tone(40000, 440), right = tone(40000, 660);
  const file = writeBrstm([left, right], 32000, true, undefined, 14336);
  const back = readBrstm(file);
  assert.equal(back.rate, 32000);
  assert.equal(back.samples, 40000);
  assert.equal(back.loopStart, 14336);
  assert.equal(back.channels.length, 2);
  let worst = 0;
  for (let i = 0; i < 40000; i++) worst = Math.max(worst, Math.abs(back.channels[0][i] - left[i]), Math.abs(back.channels[1][i] - right[i]));
  assert.ok(worst < 400, `ADPCM error up to ${worst}`);
  // a final lap copy is the same audio at another rate
  const fast = readBrstm(withSampleRate(file, 33920));
  assert.equal(fast.rate, 33920);
  assert.ok(sameBytes(fast.audio, back.audio));
  const wav = toWav(back.channels, back.rate);
  assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), 'RIFF');
  assert.equal(wav.length, 44 + 40000 * 4);
});

test('zip: reads stored and deflated files', async () => {
  const zip = new ZipWriter();
  zip.add('RetroRewind6/Patches/0_N.brstm', new Uint8Array([1, 2, 3]));
  const entries = readZip(new Uint8Array(await zip.blob().arrayBuffer()));
  assert.deepEqual(entries.map(e => e.name), ['RetroRewind6/Patches/0_N.brstm']);
  assert.deepEqual([...(await entries[0].read())], [1, 2, 3]);

  // a hand-made zip with one deflated file
  const text = new TextEncoder().encode('hello hello hello hello');
  const deflated = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const name = new TextEncoder().encode('a.txt');
  const local = new Uint8Array(30 + name.length + deflated.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 8, true);
  lv.setUint32(18, deflated.length, true);
  lv.setUint32(22, text.length, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(deflated, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, deflated.length, true);
  cv.setUint32(24, text.length, true);
  cv.setUint16(28, name.length, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);
  const all = new Uint8Array([...local, ...central, ...end]);
  const [entry] = readZip(all);
  assert.equal(new TextDecoder().decode(await entry.read()), 'hello hello hello hello');
});

test('pack import: files go to their tracks, final lap files with them, the rest are loose', () => {
  const own = list.tracks.find(t => t.finalFile === '55_Final')!;
  const plan = planImport(
    ['RetroRewind6/Patches/0_n.brstm', 'Patches/0_Final.brstm', 'x/55_N.brstm', '55_Final.brstm', 'my song.brstm', 'readme.txt'],
    list.tracks,
  );
  const first = plan.matches.find(m => m.track.file === '0_N')!;
  assert.equal(first.main, 'RetroRewind6/Patches/0_n.brstm');
  assert.equal(first.final, 'Patches/0_Final.brstm');
  assert.equal(plan.matches.find(m => m.track === own)?.final, '55_Final.brstm');
  assert.deepEqual(plan.loose, ['my song.brstm']);
  assert.equal(nearestSpeed(33920 / 32000, [1.06, 1, 1.1]), 1.06);
});

test('pack import: the unmodded game’s file names land on the original tracks', () => {
  const plan = planImport(['n_Farm_n.brstm', 'n_Farm_F.brstm', 'n_Circuit32_n.brstm', 'n_Circuit32_f.brstm', 'title_bg.brstm', 'o_FanfareGP1_32.brstm'], list.tracks);
  const name = (file: string | null) => plan.matches.filter(m => m.main === file).map(m => m.track.name).sort();
  assert.deepEqual(name('n_Farm_n.brstm'), ['Wii Moo Moo Meadows']);
  assert.equal(plan.matches.find(m => m.main === 'n_Farm_n.brstm')?.final, 'n_Farm_F.brstm');
  // Luigi Circuit and Mario Circuit share one file in the unmodded game
  assert.deepEqual(name('n_Circuit32_n.brstm'), ['Wii Luigi Circuit', 'Wii Mario Circuit']);
  assert.deepEqual(name('title_bg.brstm'), ['Title screen / main menu']);
  assert.deepEqual(name('o_FanfareGP1_32.brstm'), ['1st place fanfare + results']);
  assert.deepEqual(plan.loose, []);
  assert.equal(list.tracks.filter(t => t.stockFile).length, 32);
});
