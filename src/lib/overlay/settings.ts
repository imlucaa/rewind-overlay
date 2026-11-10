// The overlay's settings: the same options as Wheel Wizard+'s VR overlay tab, kept in this browser under the same
// localStorage key as before, so settings made on the old page carry over.

export const STORE_KEY = 'rewind-overlay-plus';

export type Source = 'vr' | 'mmr' | 'mkw';
export type RrLadder = 'rr' | 'ct' | 'tt';
export type MkwLadder = 'rt' | 'ct';
export type Look = 'card' | 'slim';
export type VrAnimation = 'count' | 'spring' | 'flip' | 'burst' | 'none' | 'race hud';
export type RankAnimation = 'flip' | 'count' | 'spring' | 'burst' | 'none';
export type BorderEffect = 'rainbow' | 'snake' | 'pulse' | 'wave' | 'ghost' | 'solid' | 'off';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type AvatarBackground = 'gradient' | 'solid' | 'transparent';

/** The overlay page's own options. Only what differs from these travels in its cfg parameter. */
export interface PageSettings {
  visibility: {
    avatar: boolean;
    name: boolean;
    tag: boolean;
    vr: boolean;
    delta: boolean;
    rank: boolean;
    rankDelta: boolean;
    connection: boolean;
    room: boolean;
    track: boolean;
    sessionDelta: boolean;
    dailyDelta: boolean;
  };
  avatar: { background: AvatarBackground; color1: string; color2: string };
  layout: { scale: number; width: number; compact: boolean; align: 'horizontal' | 'vertical' };
  typography: {
    weight: number;
    textColor: string;
    mutedColor: string;
    vrColor: string;
    gainColor: string;
    lossColor: string;
    rankColor: string;
  };
  background: {
    imageUrl: string;
    fit: BackgroundFit;
    x: number;
    y: number;
    zoom: number;
    blur: number;
    brightness: number;
    saturation: number;
    contrast: number;
    overlayColor: string;
    overlayOpacity: number;
    glass: number;
  };
  border: {
    effect: BorderEffect;
    width: number;
    radius: number;
    speed: number;
    glow: boolean;
    glowStrength: number;
    color1: string;
    color2: string;
    color3: string;
  };
  animations: { vr: VrAnimation; rank: RankAnimation; durationMs: number; celebrateThreshold: number; reducedMotion: boolean };
}

/** Wheel Wizard+'s additions, carried as their own link parameters. */
export interface PlusSettings {
  preview: { gain: number };
  font: { text: string; number: string; customText: string; customNumber: string };
  player: {
    source: Source;
    friendCode: string;
    tag: string;
    pollSeconds: number;
    loungeName: string;
    ladder: RrLadder;
    mkwLadder: MkwLadder;
    flag: boolean;
  };
  plus: {
    rankBadge: boolean;
    rankOutline: boolean;
    rankOutlineColor: string;
    rankOutlineWidth: number;
    rankBadgeSize: number;
    rankBadgeGap: number;
    rankBadgeKind: string;
    card: boolean;
    hudDigits: boolean;
    look: Look;
    divisionBacking: boolean;
    vrLabel: boolean;
    changeBox: boolean;
    /** Race HUD: the last change stays beside the number until the next race, instead of counting away. */
    keepChange: boolean;
    /** Race HUD: how big the +/- change is drawn, in percent (100 = the game's small one). */
    changeSize: number;
    /** Stats tab: a VR goal (digits, empty for none), VR to the next rank, races this stream, win streak. */
    goal: string;
    nextRank: boolean;
    raceCount: boolean;
    winStreak: boolean;
  };
}

export type Settings = PageSettings & PlusSettings;

export const PAGE_DEFAULTS: PageSettings = {
  visibility: {
    avatar: true, name: true, tag: true, vr: true, delta: true, rank: true, rankDelta: true,
    connection: false, room: false, track: false, sessionDelta: false, dailyDelta: false,
  },
  avatar: { background: 'gradient', color1: '#31d4ff', color2: '#3556ae' },
  layout: { scale: 1, width: 560, compact: false, align: 'horizontal' },
  typography: { weight: 800, textColor: '#ffffff', mutedColor: '#c9d1e7', vrColor: '#8effc6', gainColor: '#5ef0a5', lossColor: '#ff6d7e', rankColor: '#ffe88f' },
  background: {
    imageUrl: '', fit: 'cover', x: 50, y: 50, zoom: 1, blur: 0, brightness: 0.58, saturation: 1.15, contrast: 1.08,
    overlayColor: '#07111f', overlayOpacity: 0.38, glass: 0.26,
  },
  border: { effect: 'rainbow', width: 4, radius: 38, speed: 5.5, glow: true, glowStrength: 0.65, color1: '#22d3ee', color2: '#8b5cf6', color3: '#f97316' },
  animations: { vr: 'count', rank: 'flip', durationMs: 1100, celebrateThreshold: 250, reducedMotion: false },
};

export const PLUS_DEFAULTS: PlusSettings = {
  preview: { gain: 41 },
  font: { text: '', number: '', customText: '', customNumber: '' },
  player: { source: 'vr', friendCode: '', tag: '', pollSeconds: 5, loungeName: '', ladder: 'rr', mkwLadder: 'rt', flag: false },
  plus: {
    rankBadge: false, rankOutline: false, rankOutlineColor: '#ffffff', rankOutlineWidth: 2, rankBadgeSize: 100, rankBadgeGap: 15, rankBadgeKind: '',
    card: true, hudDigits: false, look: 'card', divisionBacking: false, vrLabel: true, changeBox: true, keepChange: false, changeSize: 100,
    goal: '', nextRank: false, raceCount: false, winStreak: false,
  },
};

export const defaults = (): Settings => ({ ...structuredClone(PAGE_DEFAULTS), ...structuredClone(PLUS_DEFAULTS) });

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Copies saved values over the defaults: only known keys, and only values of the default's type. */
export function merge<T extends object>(into: T, from: unknown): T {
  if (!isObject(from)) return into;
  const target = into as Record<string, unknown>;
  for (const [key, value] of Object.entries(from)) {
    if (!(key in target)) continue;
    const current = target[key];
    if (isObject(current)) merge(current, value);
    else if (typeof value === typeof current) target[key] = value;
  }
  return into;
}

export function load(text: string | null): Settings {
  let saved: Json = null;
  try {
    saved = text ? (JSON.parse(text) as Json) : null;
  } catch {
    // A damaged entry only means starting from the defaults.
  }
  return merge(defaults(), saved);
}

// ---------- what the current choices mean ----------
export const isMkw = (s: Settings): boolean => s.player.source === 'mkw';
/** One of the Lounges (RR Lounge MMR, or MKW Lounge LR) instead of the VR. */
export const isMmr = (s: Settings): boolean => s.player.source === 'mmr' || isMkw(s);
/** The race HUD look comes with the "race hud" VR change: no card, race HUD digits and font. */
export const isHud = (s: Settings): boolean => s.animations.vr === 'race hud';
export const isSlim = (s: Settings): boolean => !isHud(s) && s.plus.look === 'slim';

/** With MMR or LR picked, labels say that instead of VR. */
export const unitLabel = (s: Settings, text: string): string =>
  isMkw(s) ? text.replace(/\bVR\b/g, 'LR') : isMmr(s) ? text.replace(/\bVR\b/g, 'MMR') : text;

export const friendCodeDigits = (s: Settings): string => s.player.friendCode.replace(/\D/g, '');

export const isComplete = (s: Settings): boolean =>
  isMmr(s) ? s.player.loungeName.trim().length > 0 : friendCodeDigits(s).length === 12;

export const missingMessage = (s: Settings): string =>
  isMkw(s) ? 'Enter your MKW Lounge name' : isMmr(s) ? 'Enter your RR Lounge name' : 'Enter your friend code';

// ---------- reading and writing by path ----------
export type Path = string;

export function getPath(s: Settings, path: Path): unknown {
  return path.split('.').reduce<unknown>((o, k) => (isObject(o) ? o[k] : undefined), s);
}

/** A copy of the settings with one value changed. */
export function setPath(s: Settings, path: Path, value: unknown): Settings {
  const next = structuredClone(s);
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce<unknown>((o, k) => (isObject(o) ? o[k] : undefined), next);
  if (!isObject(parent) || last === undefined || !(last in parent)) throw new Error(`Unknown setting ${path}`);
  parent[last] = value;
  return next;
}

// ---------- the three looks ----------
export type Style = 'card' | 'slim' | 'hud';

export const styleOf = (s: Settings): Style => (isHud(s) ? 'hud' : isSlim(s) ? 'slim' : 'card');

/** Card and Slim each start from their own look; the options can change it after. */
export function applyStyle(s: Settings, style: Style): Settings {
  const next = structuredClone(s);
  if (style === 'card') {
    Object.assign(next.plus, { card: true, hudDigits: false, look: 'card' });
    Object.assign(next.visibility, { avatar: true, name: true, rank: true });
    next.border = structuredClone(PAGE_DEFAULTS.border);
    next.layout = structuredClone(PAGE_DEFAULTS.layout);
  }
  if (style === 'slim') {
    Object.assign(next.plus, { card: true, hudDigits: false, look: 'slim' });
    Object.assign(next.visibility, { avatar: false, name: true, rank: false, delta: true });
    Object.assign(next.border, { effect: 'solid', width: 3, radius: 60, glow: false, color1: '#e8a6b8' });
    Object.assign(next.layout, { compact: true, width: 470 });
    Object.assign(next.background, { overlayOpacity: 0.3, brightness: 0.75, blur: 0 });
  }
  next.animations.vr = style === 'hud' ? 'race hud' : 'count';
  return next;
}

/** Reset look: everything back to the defaults except who the overlay is for. */
export function resetLook(s: Settings): Settings {
  return { ...defaults(), player: structuredClone(s.player) };
}
