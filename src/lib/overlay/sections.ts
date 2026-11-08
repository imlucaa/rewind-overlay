// Every tab and option of the overlay editor, as data. The editor draws these; `when` hides what doesn't apply.
import { isHud, isMkw, isMmr, isSlim, type Settings } from './settings.ts';

type Option = readonly [value: string, label: string];

export type Control =
  | { kind: 'style' }
  | { kind: 'toggle'; path: string }
  | { kind: 'slider'; path: string; min: number; max: number; step: number; unit: string }
  | { kind: 'color'; path: string }
  | { kind: 'select'; path: string; options: readonly Option[] }
  | { kind: 'text'; path: string; placeholder: string }
  | { kind: 'badge'; options: readonly Option[] };

export interface RowDef {
  label: string;
  hint?: string;
  control: Control;
  when?: (s: Settings) => boolean;
}

export interface SectionDef {
  title: string;
  rows: readonly RowDef[];
  when?: (s: Settings) => boolean;
  /** While open, the preview acts out a race result every few seconds. */
  playsGain?: boolean;
}

const toggle = (path: string): Control => ({ kind: 'toggle', path });
const slider = (path: string, min: number, max: number, step: number, unit: string): Control => ({ kind: 'slider', path, min, max, step, unit });
const color = (path: string): Control => ({ kind: 'color', path });
const select = (path: string, options: readonly (string | Option)[]): Control => ({
  kind: 'select',
  path,
  options: options.map(o => (typeof o === 'string' ? ([o, o] as const) : o)),
});
const text = (path: string, placeholder: string): Control => ({ kind: 'text', path, placeholder });

const vrOnly = (s: Settings) => !isMmr(s);
const rrLounge = (s: Settings) => isMmr(s) && !isMkw(s);
const notHud = (s: Settings) => !isHud(s);
// Rooms, connection and VR history only exist for VR (rwfc.net), not on the Lounges.
const cardVr = (s: Settings) => !isHud(s) && !isMmr(s);
const badgeOn = (s: Settings) => s.plus.rankBadge;
const outlined = (s: Settings) => s.plus.rankBadge && s.plus.rankOutline;

const BADGES: readonly Option[] = [
  ['off', 'Off'], ['', 'Automatic'],
  ['e', 'E rank (0–24k)'], ['d', 'D rank (24–36k)'], ['c', 'C rank (36–48k)'], ['b', 'B rank (48–60k)'], ['a', 'A rank (60–72k)'],
  ['star', 'Star (72–84k)'], ['2star', 'Two stars (84–94k)'], ['3star', 'Three stars (94–100k)'], ['crown', 'Crown (100k+)'],
  ['tester', 'Beta tester'], ['donor', 'Donor / supporter'], ['translator', 'Translator'], ['discord-staff', 'Discord staff'],
  ['contributor', 'Pack contributor'], ['major-contributor', 'Major pack contributor'], ['wfc-staff', 'Retro WFC staff'],
  ['developer', 'Retro Rewind developer'],
  ['mkw-iron', 'MKW Iron'], ['mkw-copper', 'MKW Copper'], ['mkw-bronze', 'MKW Bronze'], ['mkw-silver', 'MKW Silver'],
  ['mkw-gold', 'MKW Gold'], ['mkw-platinum', 'MKW Platinum'], ['mkw-emerald', 'MKW Emerald'], ['mkw-ruby', 'MKW Ruby'],
  ['mkw-diamond', 'MKW Diamond'], ['mkw-master', 'MKW Master'], ['mkw-grandmaster', 'MKW Grandmaster'],
];

const FONTS: readonly Option[] = [
  ['', 'Default'], ['Inter', 'Inter'], ['Poppins', 'Poppins'], ['Montserrat', 'Montserrat'], ['Rubik', 'Rubik'],
  ['Outfit', 'Outfit'], ['Oswald', 'Oswald'], ['Bebas Neue', 'Bebas Neue'], ['Anton', 'Anton'], ['Russo One', 'Russo One'],
  ['Orbitron', 'Orbitron'], ['Audiowide', 'Audiowide'], ['Bungee', 'Bungee'], ['Press Start 2P', 'Press Start 2P'],
  ['Fredoka', 'Fredoka'], ['Lilita One', 'Lilita One'], ['custom', 'Other (Google Fonts)…'],
];

export const SECTIONS: readonly SectionDef[] = [
  {
    title: 'Player',
    rows: [
      { label: 'Style', control: { kind: 'style' } },
      { label: 'Show', control: select('player.source', [['vr', 'VR · RWFC'], ['mmr', 'MMR · RR Lounge'], ['mkw', 'LR · MKW Lounge']]) },
      { label: 'Friend code', control: text('player.friendCode', '0000-0000-0000'), when: vrOnly },
      { label: 'Update every', control: slider('player.pollSeconds', 3, 60, 1, ' s'), when: vrOnly },
      { label: 'RR Lounge name', control: text('player.loungeName', 'Your RR Lounge name'), when: rrLounge },
      { label: 'Leaderboard', control: select('player.ladder', [['rr', 'Retro Rewind'], ['ct', 'Custom Tracks'], ['tt', 'Time Trial']]), when: rrLounge },
      { label: 'MKW Lounge name', control: text('player.loungeName', 'Your mkwlounge.gg name'), when: isMkw },
      { label: 'Leaderboard', control: select('player.mkwLadder', [['rt', 'Regular Tracks'], ['ct', 'Custom Tracks']]), when: isMkw },
      { label: 'Tag', control: text('player.tag', ''), when: notHud },
    ],
  },
  {
    title: 'Show',
    rows: [
      { label: 'Mii picture', control: toggle('visibility.avatar'), when: notHud },
      { label: 'Name', control: toggle('visibility.name'), when: notHud },
      { label: 'Country flag', control: toggle('player.flag'), when: s => isMmr(s) && !isHud(s) },
      { label: 'Tag', control: toggle('visibility.tag'), when: notHud },
      { label: 'VR', control: toggle('visibility.vr') },
      { label: 'VR change', control: toggle('visibility.delta'), when: notHud },
      { label: 'Change box', control: toggle('plus.changeBox'), when: s => !isHud(s) && s.visibility.delta },
      { label: 'VR label', control: toggle('plus.vrLabel'), when: notHud },
      { label: 'Rank', control: toggle('visibility.rank') },
      { label: 'Rank change', control: toggle('visibility.rankDelta'), when: cardVr },
      { label: 'Connection', control: toggle('visibility.connection'), when: cardVr },
      { label: 'Room', control: toggle('visibility.room'), when: cardVr },
      { label: 'Track', control: toggle('visibility.track'), when: cardVr },
      { label: 'Session VR', control: toggle('visibility.sessionDelta'), when: notHud },
      { label: '24 hour VR', control: toggle('visibility.dailyDelta'), when: cardVr },
      { label: 'Division backing', hint: 'Black box behind the division name', control: toggle('plus.divisionBacking'), when: s => isSlim(s) && isMmr(s) },
      { label: 'Badge', control: { kind: 'badge', options: BADGES } },
      { label: 'Badge outline', control: toggle('plus.rankOutline'), when: badgeOn },
      { label: 'Outline strength', control: slider('plus.rankOutlineWidth', 0.5, 10, 0.5, ''), when: outlined },
      { label: 'Badge size', control: slider('plus.rankBadgeSize', 30, 300, 5, ' %'), when: badgeOn },
      { label: 'Badge spacing', control: slider('plus.rankBadgeGap', 0, 100, 1, ' %'), when: badgeOn },
    ],
  },
  {
    title: 'Size',
    rows: [
      {
        label: 'Scale',
        hint: 'Sharper than resizing the source in OBS',
        control: slider('layout.scale', 0.5, 3, 0.05, 'x'),
      },
      { label: 'Width', control: slider('layout.width', 320, 900, 10, ' px'), when: notHud },
      { label: 'Compact', control: toggle('layout.compact'), when: notHud },
      { label: 'Card', control: toggle('plus.card'), when: notHud },
      { label: 'Text weight', control: slider('typography.weight', 400, 900, 100, ''), when: notHud },
    ],
  },
  {
    title: 'Font',
    when: notHud,
    rows: [
      { label: 'Text font', hint: 'Name and labels', control: select('font.text', FONTS) },
      { label: 'Font name', hint: 'Any font on fonts.google.com', control: text('font.customText', 'e.g. Exo 2'), when: s => s.font.text === 'custom' },
      { label: 'Number font', control: select('font.number', FONTS) },
      { label: 'Font name', hint: 'Any font on fonts.google.com', control: text('font.customNumber', 'e.g. Teko'), when: s => s.font.number === 'custom' },
    ],
  },
  {
    title: 'Border',
    when: notHud,
    rows: [
      { label: 'Effect', control: select('border.effect', ['rainbow', 'snake', 'pulse', 'wave', 'ghost', 'solid', 'off']) },
      { label: 'Thickness', control: slider('border.width', 0, 16, 1, ' px') },
      { label: 'Roundness', control: slider('border.radius', 0, 60, 1, ' px') },
      { label: 'Speed', control: slider('border.speed', 1, 20, 0.5, ' s') },
      { label: 'Glow', control: toggle('border.glow') },
      { label: 'Glow strength', control: slider('border.glowStrength', 0, 1, 0.05, '') },
      { label: 'Color 1', control: color('border.color1') },
      { label: 'Color 2', control: color('border.color2') },
      { label: 'Color 3', control: color('border.color3') },
    ],
  },
  {
    title: 'Colors',
    rows: [
      { label: 'Text', control: color('typography.textColor') },
      { label: 'Secondary text', control: color('typography.mutedColor'), when: notHud },
      { label: 'VR number', control: color('typography.vrColor') },
      { label: 'Race HUD digits', control: toggle('plus.hudDigits'), when: notHud },
      { label: 'Gains', control: color('typography.gainColor') },
      { label: 'Losses', control: color('typography.lossColor') },
      { label: 'Rank', control: color('typography.rankColor'), when: notHud },
      { label: 'Badge outline', control: color('plus.rankOutlineColor'), when: outlined },
      { label: 'Mii backing', control: select('avatar.background', ['gradient', 'solid', 'transparent']), when: notHud },
      { label: 'Mii color 1', control: color('avatar.color1'), when: notHud },
      { label: 'Mii color 2', control: color('avatar.color2'), when: notHud },
    ],
  },
  {
    title: 'Background',
    when: notHud,
    rows: [
      { label: 'Picture link', control: text('background.imageUrl', 'https://…') },
      { label: 'Fit', control: select('background.fit', ['cover', 'contain', 'stretch']) },
      { label: 'Zoom', control: slider('background.zoom', 1, 4, 0.05, 'x') },
      { label: 'Position left/right', control: slider('background.x', 0, 100, 1, ' %') },
      { label: 'Position up/down', control: slider('background.y', 0, 100, 1, ' %') },
      { label: 'Tint color', control: color('background.overlayColor') },
      { label: 'Tint strength', control: slider('background.overlayOpacity', 0, 1, 0.02, '') },
      { label: 'Brightness', control: slider('background.brightness', 0, 2, 0.02, '') },
      { label: 'Contrast', control: slider('background.contrast', 0, 2, 0.02, '') },
      { label: 'Saturation', control: slider('background.saturation', 0, 2, 0.02, '') },
      { label: 'Blur', control: slider('background.blur', 0, 30, 1, ' px') },
      { label: 'Glass', control: slider('background.glass', 0, 1, 0.02, '') },
    ],
  },
  {
    title: 'Preview',
    when: isHud,
    playsGain: true,
    rows: [{ label: 'Change', hint: 'Plays over and over while this tab is open.', control: slider('preview.gain', -100, 200, 1, ' VR') }],
  },
  {
    title: 'Animation',
    when: notHud,
    playsGain: true,
    rows: [
      { label: 'Preview change', hint: 'Plays over and over while this tab is open.', control: slider('preview.gain', -100, 200, 1, ' VR') },
      { label: 'VR change', control: select('animations.vr', ['count', 'spring', 'flip', 'burst', 'none']) },
      { label: 'Rank change', control: select('animations.rank', ['flip', 'count', 'spring', 'burst', 'none']) },
      { label: 'Length', control: slider('animations.durationMs', 200, 3000, 50, ' ms') },
      { label: 'Big gain bursts at', control: slider('animations.celebrateThreshold', 50, 1000, 10, ' VR') },
      { label: 'Reduce motion', control: toggle('animations.reducedMotion') },
    ],
  },
];
