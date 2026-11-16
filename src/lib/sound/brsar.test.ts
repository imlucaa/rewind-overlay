import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeChannel } from '../music/brstm.ts';
import { channelBytes, decodeWave, fitToWave, patchWave, readBrsar } from './brsar.ts';

// A small archive with the same nesting as revo_kart.brsar: SYMB names, INFO tables (sound, file, group), and a group
// holding one RWSD (version 1.3, so its wave sits in an RWAR of RWAVs) with one sound playing one mono ADPCM wave.
const SAMPLES = 1000;
const RATE = 32000;
const nibbles = (n: number) => Math.floor(n / 14) * 16 + (n % 14 ? (n % 14) + 2 : 0);

function tone(freq: number, amp = 12000) {
  return Int16Array.from({ length: SAMPLES }, (_, i) => Math.round(amp * Math.sin((2 * Math.PI * freq * i) / RATE)));
}

function build(): { bytes: Uint8Array; waveData: number; adpcm: number } {
  const bytes = new Uint8Array(0x1000);
  const v = new DataView(bytes.buffer);
  const tag = (at: number, t: string) => [...t].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  const ref = (at: number, offset: number) => {
    bytes[at] = 1;
    v.setUint32(at + 4, offset);
  };

  // Header.
  tag(0, 'RSAR');
  v.setUint16(4, 0xfeff);
  v.setUint16(6, 0x0104);
  v.setUint32(8, bytes.length);
  v.setUint32(0x10, 0x40);
  v.setUint32(0x18, 0x100);
  v.setUint32(0x20, 0x400);

  // SYMB: one name.
  tag(0x40, 'SYMB');
  const S = 0x48;
  v.setUint32(S, 0x14);
  v.setUint32(S + 0x14, 1);
  v.setUint32(S + 0x18, 0x1c);
  tag(S + 0x1c, 'SE_TEST_TRICK');

  // INFO: references count from its body.
  tag(0x100, 'INFO');
  const I = 0x108;
  const at = (abs: number) => abs - I;
  const sounds = 0x140, banks = 0x150, players = 0x154, files = 0x158, groups = 0x168, footer = 0x178;
  [sounds, banks, players, files, groups, footer].forEach((t, k) => ref(I + k * 8, at(t)));
  const sound = 0x180, waveInfo = 0x1b0, fileHead = 0x1c0, fileList = 0x1e0, fileEntry = 0x1f0, group = 0x200, groupList = 0x230, groupEntry = 0x240;
  v.setUint32(sounds, 1);
  ref(sounds + 4, at(sound));
  v.setUint32(files, 1);
  ref(files + 4, at(fileHead));
  v.setUint32(groups, 1);
  ref(groups + 4, at(group));
  // Sound: name 0, file 0, wave sound (3), info -> sound index 0.
  bytes[sound + 0x16] = 3;
  ref(sound + 0x18, at(waveInfo));
  v.setInt32(waveInfo, 0);
  // File 0 lives in group 0, item 0.
  ref(fileHead + 0x14, at(fileList));
  v.setUint32(fileList, 1);
  ref(fileList + 4, at(fileEntry));
  v.setInt32(fileEntry, 0);
  v.setInt32(fileEntry + 4, 0);
  // Group 0: headers from 0x420, wave data from 0x600; one item at their starts.
  v.setInt32(group + 0x10, 0x420);
  v.setInt32(group + 0x18, 0x600);
  ref(group + 0x20, at(groupList));
  v.setUint32(groupList, 1);
  ref(groupList + 4, at(groupEntry));

  // FILE, then the RWSD (1.3: no WAVE block).
  tag(0x400, 'FILE');
  const R = 0x420;
  tag(R, 'RWSD');
  v.setUint16(R + 4, 0xfeff);
  v.setUint16(R + 6, 0x0103);
  v.setUint32(R + 0x10, 0x20);
  tag(R + 0x20, 'DATA');
  const L = R + 0x28;
  v.setUint32(L, 1);
  ref(L + 4, 0x10); // entry at L+0x10
  ref(L + 0x10 + 0x10, 0x30); // note table at L+0x30
  v.setUint32(L + 0x30, 1);
  ref(L + 0x34, 0x40); // note at L+0x40
  v.setInt32(L + 0x40, 0); // wave index 0

  // Wave data: RWAR -> TABL / DATA -> RWAV -> INFO (WaveInfo) / DATA (samples).
  const A = 0x600;
  tag(A, 'RWAR');
  v.setUint32(A + 0x10, 0x20);
  v.setUint32(A + 0x18, 0x60);
  tag(A + 0x20, 'TABL');
  v.setUint32(A + 0x28, 1);
  ref(A + 0x2c, 0x20); // RWAV at DATA + 0x20
  tag(A + 0x60, 'DATA');
  const W = A + 0x80;
  tag(W, 'RWAV');
  v.setUint32(W + 0x10, 0x20);
  v.setUint32(W + 0x18, 0x100);
  tag(W + 0x20, 'INFO');
  const info = W + 0x28;
  bytes[info] = 2; // ADPCM
  bytes[info + 2] = 1; // mono
  v.setUint16(info + 4, RATE);
  v.setUint32(info + 0x0c, nibbles(SAMPLES));
  v.setUint32(info + 0x10, 0x1c);
  v.setUint32(info + 0x1c, 0x20); // channel info at info + 0x20
  v.setUint32(info + 0x20, 0); // data offset
  v.setUint32(info + 0x24, 0x3c); // ADPCM info at info + 0x3c
  tag(W + 0x100, 'DATA');
  const waveData = W + 0x108;
  const adpcm = info + 0x3c;

  // The original: a 440 Hz tone.
  const original = encodeChannel(tone(440), 0);
  original.coefs.forEach((k, i) => v.setInt16(adpcm + i * 2, k));
  v.setUint16(adpcm + 0x22, original.data[0]);
  bytes.set(original.data, waveData);
  return { bytes, waveData, adpcm };
}

const close = (a: Int16Array, b: Int16Array) => {
  let err = 0, energy = 0;
  for (let i = 0; i < a.length; i++) {
    err += (a[i] - b[i]) ** 2;
    energy += b[i] ** 2;
  }
  return err / energy;
};

test('finds the sound, its name and its wave format', () => {
  const { bytes } = build();
  const { sounds } = readBrsar(bytes);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].name, 'SE_TEST_TRICK');
  const f = sounds[0].waves[0].format;
  assert.deepEqual([f.encoding, f.channels, f.rate, f.samples], [2, 1, RATE, SAMPLES]);
});

test('decodes the original wave', () => {
  const { bytes } = build();
  const wave = readBrsar(bytes).sounds[0].waves[0];
  assert.ok(close(decodeWave(bytes, wave), tone(440)) < 0.01);
});

test('patches a replacement in place without moving anything else', () => {
  const { bytes, waveData, adpcm } = build();
  const before = bytes.slice();
  const wave = readBrsar(bytes).sounds[0].waves[0];
  const replacement = fitToWave(tone(1200, 9000), wave.format);
  patchWave(bytes, wave, replacement);
  assert.equal(bytes.length, before.length);
  // Only the ADPCM header and the audio itself may differ.
  const size = channelBytes(wave.format);
  for (let i = 0; i < bytes.length; i++) {
    const inAudio = i >= waveData && i < waveData + size;
    const inHeader = i >= adpcm && i < adpcm + 0x30;
    if (!inAudio && !inHeader) assert.equal(bytes[i], before[i], `byte 0x${i.toString(16)} changed`);
  }
  assert.ok(close(decodeWave(bytes, readBrsar(bytes).sounds[0].waves[0]), replacement) < 0.01);
});

test('fits longer audio to the wave with a fade, shorter audio with silence', () => {
  const { bytes } = build();
  const f = readBrsar(bytes).sounds[0].waves[0].format;
  const long = fitToWave(new Int16Array(SAMPLES * 2).fill(10000), f);
  assert.equal(long.length, SAMPLES);
  assert.equal(long[SAMPLES - 1], 0);
  const short = fitToWave(new Int16Array(10).fill(5), f);
  assert.equal(short[9], 5);
  assert.equal(short[10], 0);
});
