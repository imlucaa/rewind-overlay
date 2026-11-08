import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { overlayQuery, overlayUrl } from './link.ts';
import { applyStyle, defaults, load, merge, type Settings } from './settings.ts';

// Made by running the old settings page's link() on each scenario: OBS links must not change.
const legacy = JSON.parse(readFileSync(new URL('./fixtures/legacy-links.json', import.meta.url), 'utf8')) as {
  name: string;
  settings: unknown;
  query: string;
}[];

for (const { name, settings, query } of legacy)
  test(`same link as the old page: ${name}`, () => {
    assert.equal(overlayQuery(merge(defaults(), settings)), query);
  });

test('the link sits under the site root', () => {
  const s: Settings = load(JSON.stringify({ player: { friendCode: '123456789012' } }));
  assert.match(overlayUrl(s, 'https://imlucaa.github.io/rewind-overlay/'), /^https:\/\/imlucaa\.github\.io\/rewind-overlay\/overlay\/index\.html\?view=overlay&fc=123456789012/);
});

test('saved settings of the wrong type are ignored, damaged ones fall back to defaults', () => {
  assert.equal(load('{"layout":{"width":"wide"}}').layout.width, 560);
  assert.deepEqual(load('{oops'), defaults());
});

test('race HUD look turns on the race hud VR change, card turns it back', () => {
  const hud = applyStyle(defaults(), 'hud');
  assert.equal(hud.animations.vr, 'race hud');
  assert.equal(applyStyle(hud, 'card').animations.vr, 'count');
});
