import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EFFECT_GROUPS } from './effectGroups.ts';
import { decodeColors, encodeColors, PRESETS } from './presets.ts';

test('every preset only names real effect groups and real colors', () => {
  const ids = new Set(EFFECT_GROUPS.map(g => g.id));
  for (const p of PRESETS)
    for (const [id, hex] of Object.entries(p.colors)) {
      assert.ok(ids.has(id), `${p.id}: ${id}`);
      assert.match(hex, /^#[0-9a-f]{6}$/);
    }
});

test('colors survive a round trip through a link', () => {
  const colors = { mt: '#00E5FF', smt: '#ff2bd6' };
  const text = encodeColors(colors);
  assert.equal(text, 'mt-00e5ff.smt-ff2bd6');
  assert.deepEqual(decodeColors(text), { mt: '#00e5ff', smt: '#ff2bd6' });
});

test('bad parts of a link are skipped', () => {
  assert.deepEqual(decodeColors('mt-00e5ff.nope-112233.smt-zzzzzz.trick-ffe600'), { mt: '#00e5ff', trick: '#ffe600' });
  assert.deepEqual(decodeColors(''), {});
  assert.deepEqual(decodeColors(null), {});
  assert.equal(encodeColors({ mt: 'red', bogus: '#000000' }), '');
});
