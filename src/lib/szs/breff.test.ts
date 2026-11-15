import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromHex, groupColors, readBreff, readColor, recolorGroup, toHex } from './breff.ts';
import { EFFECT_GROUPS, groupOf } from './effectGroups.ts';

// A one-effect BREFF: 4 colors, then a baked R+G curve on color 0 (2 frames), a keyed RGB curve on color 4 (one key
// with its values, one taken from the range table), and the range table (one entry, value and spread per channel).
function sample(): Uint8Array {
  const name = [...'rk_blueSpark00\0'].map(c => c.charCodeAt(0));
  const u32 = (n: number) => [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const u16 = (n: number) => [n >> 8, n & 0xff];
  const colors = [0x20, 0x40, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0x20, 0x40, 0xff, 0x80];
  const baked = [0xab, 0, 0, 0b011, 0, 0, 0, 0, ...u16(2), 0, 0, ...u32(4), ...u32(0), ...u32(0), ...u32(0), ...u32(0), 0x20, 0x40, 0x21, 0x41];
  const keys = [...u16(2), 0, 0, ...u16(0), 0, 0, ...new Array(8).fill(0), 0x20, 0x40, 0xff, 0, ...u16(5), 1, 0, ...new Array(8).fill(0), 0, 0, 0, 0];
  const range = [...u16(1), 0, 0, 0x20, 0x10, 0x40, 0x10, 0xff, 0, 0, 0];
  const keyed = [0xac, 4, 0, 0b111, 0, 0, 0, 0, ...u16(5), 0, 0, ...u32(keys.length), ...u32(range.length), ...u32(0), ...u32(0), ...u32(0), ...keys, ...range];
  const anims = [...u16(2), 0, 0, ...u32(0), ...u32(0), ...u32(baked.length), ...u32(keyed.length), 0, 0, 0, 0, ...baked, ...keyed];
  const effect = [...u32(0), ...u32(8), ...new Array(8).fill(0), ...u32(colors.length), ...colors, ...anims];
  const tableHead = 8 + 2 + name.length + 8;
  const table = [...u32(tableHead), ...u16(1), 0, 0, ...u16(name.length), ...name, ...u32(tableHead), ...u32(effect.length)];
  const head = [...'REFF'].map(c => c.charCodeAt(0)).concat(0xfe, 0xff, 0, 7, ...new Array(8).fill(0), 0x52, 0x45, 0x46, 0x46, 0, 0, 0, 0, ...u32(0x20), ...new Array(0x20 - 0x1c + 0x18 - 0x18).fill(0));
  const out = [...head];
  while (out.length < 0x38) out.push(0);
  return Uint8Array.from([...out, ...table, ...effect]);
}

test('finds every color: the 4 own colors, baked frames, a keyed value and the range table', () => {
  const data = sample();
  const [effect] = readBreff(data);
  assert.equal(effect.name, 'rk_blueSpark00');
  // R and G from the baked frames, B from the effect's own color 1.
  assert.deepEqual(effect.spots.map(s => toHex(readColor(data, s))), ['#2040ff', '#ffffff', '#000000', '#2040ff', '#2040ff', '#2141ff', '#2040ff', '#2040ff']);
});

test('recolors a group: the main color becomes the pick, white stays with Keep white, black and alpha never change', () => {
  const data = sample();
  const effects = readBreff(data);
  assert.equal(toHex(groupColors(data, effects)[0]), '#2040ff');
  recolorGroup(data, effects, fromHex('#ff8000')!, true);
  const after = effects[0].spots.map(s => toHex(readColor(data, s)));
  assert.equal(after[0], '#ff8000');
  assert.equal(after[1], '#ffffff');
  assert.equal(after[2], '#000000');
  assert.ok(after.slice(3).every(c => c !== '#2040ff'), after.join());
  // Only RGB bytes changed: alpha, frames, spreads and headers are as they were.
  const colorBytes = new Set(effects[0].spots.flatMap(s => s.at.filter(at => at >= 0)));
  const before = sample();
  assert.ok([...data].every((v, i) => colorBytes.has(i) || v === before[i]));
  const fresh = sample();
  recolorGroup(fresh, readBreff(fresh), fromHex('#ff8000')!, false);
  assert.notEqual(toHex(readColor(fresh, readBreff(fresh)[0].spots[1])), '#ffffff');
});

test('effect groups: Star and Rocket Start apart, team lightning apart', () => {
  assert.equal(groupOf('rk_startSeikou')?.id, 'rocket');
  assert.equal(groupOf('rk_star1_spin')?.id, 'star');
  assert.equal(groupOf('rk_thunderS_R')?.id, 'teamLightning');
  assert.equal(groupOf('rk_thunder_gndSpark')?.id, 'lightning');
  assert.equal(groupOf('rk_crashWater0')?.id, 'water');
  assert.equal(new Set(EFFECT_GROUPS.map(g => g.id)).size, EFFECT_GROUPS.length);
});

test('an all-black group (a hidden effect) can still be given a color', () => {
  const data = sample();
  const effects = readBreff(data);
  for (const spot of effects[0].spots) for (const at of spot.at) if (at >= 0) data[at] = 0;
  for (const spot of effects[0].spots) for (let c = 0; c < 3; c++) data[spot.base + c] = 0;
  assert.equal(toHex(groupColors(data, effects)[0]), '#000000');
  recolorGroup(data, effects, fromHex('#3060ff')!, false);
  assert.equal(toHex(readColor(data, effects[0].spots[0])), '#3060ff');
});
