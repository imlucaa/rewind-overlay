import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataSize, decodeTexture, encodeRgb5a3 } from './gx.ts';
import { readBreft, replaceTexture, writeBreft } from './breft.ts';

test('RGB5A3: opaque pixels keep 5 bits a color, see-through ones 4 bits and 3 of alpha; tiles are 4×4', () => {
  const w = 5;
  const h = 3;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) rgba.set([p * 16, 255 - p * 16, 128, p % 2 ? 255 : 96], p * 4);
  const data = encodeRgb5a3(rgba, w, h);
  assert.equal(data.length, dataSize(5, w, h)); // 8×4 padded pixels, 2 bytes each
  assert.equal(data.length, 64);
  const back = decodeTexture(5, w, h, data);
  for (let i = 0; i < rgba.length; i++) assert.ok(Math.abs(back[i] - rgba[i]) <= (i % 4 === 3 ? 18 : 17), `byte ${i}: ${rgba[i]} came back as ${back[i]}`);
  for (let p = 1; p < w * h; p += 2) assert.equal(back[p * 4 + 3], 255);
});

test('I8 decodes tile by tile: 8×4 tiles, gray with the same alpha', () => {
  const data = Uint8Array.from({ length: 64 }, (_, i) => i);
  const px = decodeTexture(1, 16, 4, data);
  assert.deepEqual([...px.subarray(0, 4)], [0, 0, 0, 0]);
  // (8, 0) is the first pixel of the second tile: byte 32.
  assert.deepEqual([...px.subarray(8 * 4, 8 * 4 + 4)], [32, 32, 32, 32]);
  // (0, 1) is the 9th byte of the first tile.
  assert.deepEqual([...px.subarray(16 * 4, 16 * 4 + 4)], [8, 8, 8, 8]);
});

// A BREFT with two textures, built the way RKRace.breft is laid out.
function sample(): Uint8Array {
  const u32 = (n: number) => [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const u16 = (n: number) => [n >> 8, n & 0xff];
  const tex = (w: number, h: number, format: number, fill: number) => {
    const size = dataSize(format, w, h);
    return [...u32(0), ...u16(w), ...u16(h), ...u32(size), format, 0, 0, 0, ...new Array(16).fill(0), ...new Array(size).fill(fill)];
  };
  const names = ['rk_hamon', 'rk_spark'];
  const tableSize = 0x40;
  const a = tex(8, 4, 1, 7);
  const b = tex(4, 4, 5, 9);
  const entries = [...u32(tableSize), ...u16(2), 0, 0];
  let offset = tableSize;
  for (const [i, n] of names.entries()) {
    const bytes = [...n].map(c => c.charCodeAt(0));
    entries.push(...u16(bytes.length + 1), ...bytes, 0, ...u32(offset), ...u32((i ? b : a).length - 0x20));
    offset += (i ? b : a).length;
  }
  while (entries.length < tableSize) entries.push(0);
  const head = [0x52, 0x45, 0x46, 0x54, 0xfe, 0xff, 0, 7, 0, 0, 0, 0, 0, 0x10, 0, 1, 0x52, 0x45, 0x46, 0x54, 0, 0, 0, 0, ...u32(0x28)];
  while (head.length < 0x40) head.push(0);
  const file = [...head, ...entries, ...a, ...b];
  file.splice(8, 4, ...u32(file.length));
  file.splice(0x14, 4, ...u32(file.length - 0x18));
  return Uint8Array.from(file);
}

test('BREFT reads, writes back byte for byte, and takes a bigger replacement', () => {
  const file = sample();
  const breft = readBreft(file);
  assert.deepEqual(breft.textures.map(t => [t.name, t.width, t.height, t.format]), [['rk_hamon', 8, 4, 1], ['rk_spark', 4, 4, 5]]);
  assert.deepEqual(writeBreft(breft), file);
  const rgba = new Uint8ClampedArray(16 * 16 * 4).fill(200);
  breft.textures[0] = replaceTexture(breft.textures[0], 16, 16, 5, encodeRgb5a3(rgba, 16, 16));
  const again = readBreft(writeBreft(breft));
  assert.deepEqual(again.textures.map(t => [t.name, t.width, t.height, t.format, t.data.length]), [['rk_hamon', 16, 16, 5, 512], ['rk_spark', 4, 4, 5, 32]]);
  assert.deepEqual(again.textures[1].data, readBreft(file).textures[1].data);
  assert.throws(() => replaceTexture(breft.textures[1], 8, 8, 5, new Uint8Array(10)));
});
