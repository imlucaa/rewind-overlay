// Turns the settings into the overlay's link (overlay/index.html?view=overlay&...). The output must stay identical
// to the old settings page's, because people have these links in OBS; link.test.ts checks that.
import {
  PAGE_DEFAULTS, friendCodeDigits, isHud, isMkw, isMmr, isSlim,
  type PageSettings, type Settings,
} from './settings.ts';

// MMR needs no friend code, but the page only leaves its demo mode with a real-looking one (Wii friend codes carry
// a checksum): this is the code of player id 1.
const PLACEHOLDER_FC = '021474836481';

type Patch = { [key: string]: Patch | string | number | boolean };

function diff(base: object, current: object): Patch {
  const out: Patch = {};
  const defaults = base as Record<string, unknown>;
  for (const [key, value] of Object.entries(current)) {
    if (!(key in defaults)) continue;
    if (value && typeof value === 'object') {
      const inner = diff(defaults[key] as object, value as object);
      if (Object.keys(inner).length) out[key] = inner;
    } else if (value !== defaults[key]) out[key] = value as string | number | boolean;
  }
  return out;
}

const base64url = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const bare = (color: string): string => (color || '').replace('#', '');

const HUD_HIDDEN = ['avatar', 'name', 'tag', 'rankDelta', 'connection', 'room', 'track', 'sessionDelta', 'dailyDelta'] as const;

/** The overlay link's query string. `overlayUrl` joins it to the overlay page's address. */
export function overlayQuery(settings: Settings): string {
  const hud = isHud(settings);
  const mmr = isMmr(settings);
  const page = {} as PageSettings;
  for (const key of Object.keys(PAGE_DEFAULTS) as (keyof PageSettings)[])
    (page as unknown as Record<string, unknown>)[key] = structuredClone(settings[key]);
  // Race HUD only has the VR and the rank: the rest stays off whatever the card had.
  if (hud) for (const key of HUD_HIDDEN) page.visibility[key] = false;
  const patch = diff(PAGE_DEFAULTS, structuredClone(page));
  // Colours Wheel Wizard+ adds itself (the page has them fixed).
  const typography = patch.typography as Patch | undefined;
  if (typography) {
    for (const key of ['vrColor', 'gainColor', 'lossColor', 'rankColor']) delete typography[key];
    if (!Object.keys(typography).length) delete patch.typography;
  }
  // "race hud" is Wheel Wizard+'s own VR change: the page counts, the script draws the countdown.
  const animations = patch.animations as Patch | undefined;
  if (hud && animations) animations.vr = 'count';
  if (mmr) patch.data = { leaderboardUrl: './ww-mmr/player/{friendCode}', groupsUrl: './ww-mmr/rooms' };

  const { player, plus, font } = settings;
  const params = new URLSearchParams({ view: 'overlay', fc: mmr ? PLACEHOLDER_FC : friendCodeDigits(settings) });
  const t = settings.typography;
  const colors = [t.vrColor, t.gainColor, t.lossColor, t.rankColor].map(bare).join('-');
  if (colors !== '8effc6-5ef0a5-ff6d7e-ffe88f') params.set('colors', colors);
  if (player.tag && !hud) params.set('tag', player.tag);
  if (!mmr && player.pollSeconds !== 5) params.set('poll', String(player.pollSeconds));
  if (Object.keys(patch).length) params.set('cfg', base64url(JSON.stringify(patch)));
  if (mmr) {
    params.set('src', player.source);
    params.set('ln', player.loungeName);
    params.set('ladder', isMkw(settings) ? player.mkwLadder : player.ladder);
    if (player.flag && !hud) params.set('flag', 'on');
  }
  if (!hud) {
    const pick = (value: string, custom: string): string => (value === 'custom' ? custom.trim() : value);
    const text = pick(font.text, font.customText);
    const number = pick(font.number, font.customNumber);
    if (text) params.set('font', text);
    if (number) params.set('nfont', number);
  }
  if (!hud && !plus.vrLabel) params.set('vl', 'off');
  if (!hud && !plus.changeBox) params.set('cb', 'off');
  if (isSlim(settings)) params.set('look', 'slim');
  if (isSlim(settings) && mmr && plus.divisionBacking) params.set('db', 'on');
  if (hud || !plus.card) params.set('card', 'off');
  if (hud || plus.hudDigits) params.set('digits', 'hud');
  if (hud) {
    params.set('text', 'hud');
    params.set('vrhud', '1');
  }
  if (plus.rankBadge) {
    params.set('rank', 'on');
    if (plus.rankBadgeKind) params.set('badge', plus.rankBadgeKind);
    params.set('bs', String(plus.rankBadgeSize));
    params.set('bg', String(plus.rankBadgeGap));
    if (plus.rankOutline) {
      params.set('ro', bare(plus.rankOutlineColor));
      params.set('rw', String(plus.rankOutlineWidth));
    }
  }
  params.set('tc', bare(t.textColor));
  params.set('mc', bare(t.mutedColor));
  return params.toString();
}

/** The full link, relative to the site's root (e.g. https://imlucaa.github.io/rewind-overlay/). */
export const overlayUrl = (settings: Settings, siteRoot: string): string =>
  new URL('overlay/index.html?' + overlayQuery(settings), siteRoot).href;
