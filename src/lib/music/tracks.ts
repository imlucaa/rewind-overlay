// Retro Rewind's tracks and the music file each one plays, from public/data/rr-tracks.tsv. That list was read from
// Retro Rewind 6.13.4's ConfigRT/CT/BT.pul and strm folder by Music Pack Maker (same author); the rules below are its
// Catalog.cs, which follows the Pulsar source (github.com/Retro-Rewind-Team/Pulsar) for how music is loaded.

export type TrackCategory = 'original' | 'retro' | 'custom' | 'battle' | 'menu' | 'fanfare';

export const CATEGORY_LABELS: Record<TrackCategory, string> = {
  original: 'Original tracks',
  retro: 'Retro tracks',
  custom: 'Custom tracks',
  battle: 'Battle arenas',
  menu: 'Menus',
  fanfare: 'Fanfares & jingles',
};

/** Menus and fanfares: game music, not a race, so no final lap. */
export const isGameMusic = (t: Track): boolean => t.category === 'menu' || t.category === 'fanfare';

export interface Track {
  /** The music file this track plays, without .brstm (e.g. sw2MC1_N). Unique; used as the track's id. */
  file: string;
  name: string;
  platform: string;
  /** For a version like "SW2 Mario Circuit 1": the track it's a version of. */
  variantOf: string;
  category: TrackCategory;
  /**
   * Retro Rewind's own final lap file for this track (e.g. 55_Final), or null. Retro Rewind plays it on the final lap
   * instead of speeding up the normal file, so a pack must replace it too or the old song comes back on lap 3.
   */
  finalFile: string | null;
  /** Retro Rewind ships music for this exact file; otherwise the track borrows another slot's music. */
  hasOwnMusic: boolean;
  /**
   * For the 32 original tracks: the music file the unmodded game uses (e.g. n_Farm_n). Many packs are made with these
   * names, so importing matches them too.
   */
  stockFile?: string;
  /** For menus and fanfares: where it plays. */
  about?: string;
  /** Short jingles play once instead of looping. */
  playsOnce?: boolean;
}

export interface TrackList {
  version: string;
  tracks: Track[];
}

// The 32 tracks that came with Mario Kart Wii. A few are spelled differently across versions.
const ORIGINALS = new Set(
  [
    'Wii Luigi Circuit', 'Wii Moo Moo Meadows', 'Wii Mushroom Gorge', "Wii Toad's Factory",
    'Wii Mario Circuit', 'Wii Coconut Mall', 'Wii DK Summit', "Wii Wario's Gold Mine",
    'Wii Daisy Circuit', 'Wii Koopa Cape', 'Wii Maple Treeway', 'Wii Grumble Volcano',
    'Wii Dry Dry Ruins', 'Wii Moonview Highway', "Wii Bowser's Castle", 'Wii Rainbow Road',
    'GCN Peach Beach', 'DS Yoshi Falls', 'SNES Ghost Valley 2', 'N64 Mario Raceway',
    'N64 Sherbet Land', 'GBA Shy Guy Beach', 'DS Delfino Square', 'GCN Waluigi Stadium',
    'DS Desert Hills', 'GBA Bowser Castle 3', "N64 DK's Jungle Parkway", 'N64 DK Jungle Parkway',
    'GCN Mario Circuit', 'SNES Mario Circuit 3', 'DS Peach Gardens', 'DS Peach Garden',
    'GCN DK Mountain', "N64 Bowser's Castle",
  ].map(nameKey),
);

// Oldest console first. "Wii U" is checked before "Wii" so it matches first.
const PLATFORM_ORDER = ['SNES', 'N64', 'GBA', 'GCN', 'DS', 'Wii', '3DS', 'Wii U', 'Tour', 'GP', 'SW2', 'SW', 'RMX', 'Beta'];
const PLATFORM_LOOKUP = ['Wii U', ...PLATFORM_ORDER.filter(p => p !== 'Wii U')];
const CONFIGS: Record<string, TrackCategory> = { 'ConfigRT.pul': 'retro', 'ConfigCT.pul': 'custom', 'ConfigBT.pul': 'battle' };
const CATEGORY_ORDER: TrackCategory[] = ['original', 'retro', 'custom', 'battle', 'menu', 'fanfare'];

// The game's own menu music, fanfares and jingles, from Music Pack Maker's Catalog.cs (names and where they play from
// the mkwiiki file list and the mariokartwii.com file thread). They go in Patches like the track music.
const MENUS: readonly [string, string, string][] = [
  ['Title screen / main menu', 'title_bg', 'Plays on the title screen and the main menu.'],
  ['Offline menus', 'offline_bg', 'Plays in the menus for single player and local multiplayer.'],
  ['Wi-Fi menu', 'wifi_globe_bg', 'Plays in the online menus, with the globe.'],
  ['Wi-Fi lobby / voting', 'wifi_lobby_bg', 'Plays in an online room while everyone votes for the next track.'],
  ['Options menu', 'o_Option_32', 'Plays in the Options menu.'],
  ['Wi-Fi waiting to join / ghost replay', 'o_Wi-Fi_waiting32', 'Plays while waiting to join an online race, and while watching a ghost replay.'],
];

const FANFARES: readonly [string, string, boolean, string][] = [
  ['1st place fanfare + results', 'o_FanfareGP1_32', false, 'Plays when you finish 1st, and carries on through the results.'],
  ['1st place fanfare only', 'o_FanfareGP1_only32', true, 'The short jingle as you cross the line in 1st.'],
  ['2nd–5th place fanfare + results', 'o_FanfareGP2_32', false, 'Plays when you finish 2nd to 5th, and carries on through the results.'],
  ['2nd–5th place fanfare only', 'o_FanfareGP2_only32', true, 'The short jingle as you cross the line in 2nd to 5th.'],
  ['6th–last place fanfare + results', 'o_FanfareGPdame_32', false, 'Plays when you finish 6th or lower, and carries on through the results.'],
  ['6th–last place fanfare only', 'o_FanfareGPdame_only32', true, 'The short jingle as you cross the line in 6th or lower.'],
  ['Battle win fanfare + results', 'o_FanfareTA1st_32', false, 'Plays when you win a battle as the top player, and carries on through the results.'],
  ['Battle win fanfare only', 'o_FanfareTA1st_only32', true, 'The short jingle when you win a battle as the top player.'],
  ['Battle draw + results', 'o_FanfareBTdraw_32', false, 'Plays when a battle ends in a draw, and carries on through the results.'],
  ['Mission win fanfare + results', 'o_FanfareMIwin_32', false, 'Plays when you finish a time trial, and when your team wins a battle but you aren’t the top player.'],
  ['Mission win fanfare only', 'o_FanfareMIwin_only32', true, 'The short jingle when you finish a time trial.'],
  ['Mission lose fanfare + results', 'o_FanfareMIlose_32', false, 'Plays when you lose a battle, and carries on through the results.'],
  ['Mission lose results only', 'o_FanfareMIlose_only32', false, 'Plays when you lose a battle.'],
  ['Mission boss win + results', 'o_FanfareMIWinBoss_32', false, 'Plays when you win a competition, and carries on through the results.'],
  ['Race intro', 'o_Crs_In_Fan', true, 'Plays while the camera flies over the track before an offline race.'],
  ['Wi-Fi race intro', 'o_Crs_In_Fan_Wifi', true, 'Plays while the camera flies over the track before an online race.'],
  ['Battle intro', 'o_Crs_In_Fan_battle', true, 'Plays while the camera flies over the arena before a battle.'],
  ['Mission intro', 'o_Crs_In_Fan_mission', true, 'Left over from the unused mission mode. Where it still plays isn’t known for sure.'],
  ['Race start fanfare', 'o_Start32_fan', true, 'The short jingle as a race starts.'],
  ['Time trial start fanfare', 'o_Start2_32_fan', true, 'The short jingle as a time trial starts.'],
  ['Trophy presentation, main', 'o_hyousyou_winningrun', false, 'The trophy ceremony after a Grand Prix, the full version.'],
  ['Trophy presentation, normal', 'o_hyousyou_normal', false, 'The trophy ceremony after a Grand Prix, a shorter version.'],
  ['Trophy presentation, short', 'o_hyousyou_cut', false, 'The trophy ceremony after a Grand Prix, the shortest version.'],
  ['Trophy presentation, lose', 'o_hyousyou_lose', false, 'Plays after a Grand Prix when you didn’t win a trophy.'],
  ['Ending theme (credits)', 'o_Ending_PartA_32', false, 'Plays during the ending credits.'],
  ['Unlocked character / cup / kart', 'strm_me', true, 'The jingle when you unlock a character, cup or kart.'],
];

// The unmodded game's race music files by music slot, from Music Pack Maker's Catalog.cs (checked against Retro
// Rewind 6.13.4's ConfigRT.pul). Luigi Circuit and Mario Circuit share one file.
const STOCK_RACE: Record<number, string> = {
  0x08: 'n_Circuit32_n', 0x00: 'n_Circuit32_n', 0x01: 'n_Farm_n', 0x02: 'n_Kinoko_n', 0x04: 'STRM_N_FACTORY_N',
  0x05: 'n_Shopping32_n', 0x06: 'n_Snowboard32_n', 0x07: 'STRM_N_TRUCK_N', 0x09: 'n_Daisy32_n', 0x0f: 'STRM_N_WATER_N',
  0x0b: 'n_maple_n', 0x03: 'n_Volcano32_n', 0x0e: 'STRM_N_DESERT_N', 0x0a: 'STRM_N_RIDGEHIGHWAY_N', 0x0c: 'STRM_N_KOOPA_N',
  0x0d: 'n_Rainbow32_n', 0x10: 'r_GC_Beach32_n', 0x14: 'r_DS_Jungle32_n', 0x19: 'r_SFC_Obake32_n', 0x1a: 'r_64_Circuit32_n',
  0x1b: 'r_64_Sherbet32_n', 0x1f: 'r_AGB_Beach32_n', 0x17: 'r_DS_Town32_n', 0x12: 'r_GC_Stadium32_n', 0x15: 'r_DS_Desert32_n',
  0x1e: 'r_AGB_Kuppa32_n', 0x1d: 'r_64_Jungle32_n', 0x11: 'r_GC_Circuit32_n', 0x18: 'r_SFC_Circuit32_n', 0x16: 'r_DS_Garden32_n',
  0x13: 'r_GC_Mountain32_n', 0x1c: 'r_64_Kuppa32_n',
};

const gameMusic = (): Track[] => [
  ...MENUS.map(([name, file, about]): Track => ({
    file, name, platform: '', variantOf: '', category: 'menu', finalFile: null, hasOwnMusic: true, about,
  })),
  ...FANFARES.map(([name, file, once, about]): Track => ({
    file, name, platform: '', variantOf: '', category: 'fanfare', finalFile: null, hasOwnMusic: true, about, playsOnce: once,
  })),
];

function nameKey(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

const platformOf = (name: string): string => PLATFORM_LOOKUP.find(p => name.startsWith(p + ' ')) ?? '';

/** The track's own name, without any variant part. */
function mainName(name: string): string {
  let at = name.indexOf(' > ');
  if (at < 0) at = name.indexOf(' (variant ');
  return at < 0 ? name : name.slice(0, at);
}

/** The "SW2 X" of "SNES X > SW2 X", when it names a console. */
function versionName(name: string): string | null {
  const at = name.indexOf(' > ');
  if (at < 0) return null;
  const version = name.slice(at + 3);
  return platformOf(version) ? version : null;
}

/** One of the 32 originals. A remake from another game, like SW2's, is a retro even though it replaces one. */
function isOriginal(name: string): boolean {
  const version = versionName(name);
  if (version && platformOf(version) !== platformOf(mainName(name))) return false;
  return ORIGINALS.has(nameKey(mainName(name)));
}

export function parseTrackList(tsv: string): TrackList {
  let version = '';
  const music = new Set<string>();
  const rows: { config: string; name: string; stem: string; variant: number; slot: number }[] = [];
  for (const line of tsv.split('\n')) {
    const parts = line.replace(/\r$/, '').split('\t');
    const [kind, a = '', b = '', c = '', d = ''] = parts;
    if (kind === 'version') version = a;
    else if (kind === 'music' && a) music.add(a);
    else if (kind === 'track' && parts.length >= 6) rows.push({ config: a, name: b, stem: c, variant: Number(d), slot: Number(parts[5]) });
  }
  // The file names in the strm folder decide the exact spelling (_N or _n, _Final or _F).
  const existing = (...names: string[]): string | null => names.find(n => music.has(n)) ?? null;

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const row of rows) {
    const category = CONFIGS[row.config];
    if (!category) continue;
    const file = existing(row.stem + '_N', row.stem + '_n') ?? row.stem + '_N';
    if (seen.has(file)) continue;
    seen.add(file);
    const version = versionName(row.name);
    const shown = version ?? row.name;
    const original = category === 'retro' && isOriginal(row.name);
    tracks.push({
      file,
      name: shown,
      platform: platformOf(mainName(shown)),
      variantOf: version ? mainName(row.name) : '',
      category: original ? 'original' : category,
      ...(original && row.variant === 0 && STOCK_RACE[row.slot] ? { stockFile: STOCK_RACE[row.slot] } : {}),
      finalFile: existing(row.stem + '_Final', row.stem + '_F'),
      hasOwnMusic: music.has(file),
    });
  }
  const platformIndex = (p: string): number => {
    const at = PLATFORM_ORDER.indexOf(p);
    return at < 0 ? PLATFORM_ORDER.length : at;
  };
  // By category, then console, then name, with each track's versions right after it.
  const order = new Map(tracks.map((t, i) => [t, i]));
  tracks.sort(
    (x, y) =>
      CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) ||
      platformIndex(x.variantOf ? platformOf(x.variantOf) : x.platform) - platformIndex(y.variantOf ? platformOf(y.variantOf) : y.platform) ||
      mainName(x.variantOf || x.name).localeCompare(mainName(y.variantOf || y.name), 'en', { sensitivity: 'base' }) ||
      (order.get(x) ?? 0) - (order.get(y) ?? 0),
  );
  // Menus and fanfares keep their own order, after the tracks.
  return { version, tracks: [...tracks, ...gameMusic()] };
}
