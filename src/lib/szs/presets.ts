// Ready-made color themes for common.szs's race effects, and a compact way to share any set of colors in a link.
// A preset only sets the groups people notice most (drift sparks, boosts, the trick flash...); everything else keeps
// whatever it had, so a preset can go on top of your own picks.

import { EFFECT_GROUPS } from './effectGroups.ts';

export interface Preset {
  id: string;
  name: string;
  about: string;
  /** Effect group id -> color. */
  colors: Record<string, string>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'neon',
    name: 'Neon',
    about: 'Electric cyan, pink and lime',
    colors: {
      mt: '#00e5ff',
      smt: '#ff2bd6',
      mtBoost: '#7cff00',
      trick: '#ffe600',
      star: '#ff2bd6',
      rocket: '#00e5ff',
      speedLines: '#00e5ff',
      slipstream: '#7cff00',
    },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    about: 'Soft mint, peach and lilac',
    colors: {
      mt: '#9ff0d8',
      smt: '#ffc3a0',
      mtBoost: '#c9b6ff',
      trick: '#fff3a8',
      star: '#ffc6e5',
      rocket: '#a8d8ff',
      speedLines: '#e6e0ff',
      slipstream: '#9ff0d8',
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    about: 'A different color for every effect',
    colors: {
      mt: '#2f7bff',
      smt: '#ff8a00',
      mtBoost: '#ff2a2a',
      trick: '#ffe100',
      star: '#b23cff',
      rocket: '#00d26a',
      speedLines: '#00c8ff',
      slipstream: '#ff4fd8',
    },
  },
  {
    id: 'inferno',
    name: 'Inferno',
    about: 'Fire reds and oranges',
    colors: {
      mt: '#ff5a1f',
      smt: '#ff1f1f',
      mtBoost: '#ffb000',
      trick: '#ff7a00',
      star: '#ff3b00',
      rocket: '#ff5a1f',
      speedLines: '#ff9a3c',
      slipstream: '#ff7a00',
    },
  },
  {
    id: 'ice',
    name: 'Ice',
    about: 'Cold blues and white',
    colors: {
      mt: '#7fd8ff',
      smt: '#2f6bff',
      mtBoost: '#bfefff',
      trick: '#e8fbff',
      star: '#7fd8ff',
      rocket: '#bfefff',
      speedLines: '#d8f4ff',
      slipstream: '#7fd8ff',
    },
  },
  {
    id: 'toxic',
    name: 'Toxic',
    about: 'Acid green and purple',
    colors: {
      mt: '#5cff2e',
      smt: '#a020ff',
      mtBoost: '#c8ff00',
      trick: '#5cff2e',
      star: '#a020ff',
      rocket: '#5cff2e',
      speedLines: '#c8ff00',
      slipstream: '#a020ff',
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    about: 'Warm golds and amber',
    colors: {
      mt: '#ffd34d',
      smt: '#ffad1f',
      mtBoost: '#ffe9a3',
      trick: '#ffd34d',
      star: '#ffad1f',
      rocket: '#ffe9a3',
      speedLines: '#ffd34d',
      slipstream: '#ffe9a3',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    about: 'Plain white, no color',
    colors: {
      mt: '#ffffff',
      smt: '#d9d9d9',
      mtBoost: '#ffffff',
      trick: '#ffffff',
      star: '#ffffff',
      rocket: '#ffffff',
      speedLines: '#ffffff',
      slipstream: '#ffffff',
    },
  },
];

const IDS = new Set(EFFECT_GROUPS.map(g => g.id));

/** Colors as text for a link: "mt-00e5ff.smt-ff2bd6". Unknown groups and colors that aren't #rrggbb are left out. */
export function encodeColors(colors: Record<string, string>): string {
  return Object.entries(colors)
    .filter(([id, hex]) => IDS.has(id) && /^#[0-9a-f]{6}$/i.test(hex))
    .map(([id, hex]) => `${id}-${hex.slice(1).toLowerCase()}`)
    .join('.');
}

/** The colors in a shared link's text; anything malformed is skipped, so a bad link just shares less. */
export function decodeColors(text: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (text ?? '').split('.')) {
    const m = /^([A-Za-z]+)-([0-9a-f]{6})$/i.exec(part.trim());
    if (m && IDS.has(m[1])) out[m[1]] = `#${m[2].toLowerCase()}`;
  }
  return out;
}
