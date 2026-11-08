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
      { label: 'Rating', hint: 'Which score the overlay shows', control: select('player.source', [['vr', 'Retro Rewind VR'], ['mmr', 'RR Lounge MMR'], ['mkw', 'MKW Lounge LR']]) },
      { label: 'Friend code', hint: 'Your Retro Rewind friend code', control: text('player.friendCode', '0000-0000-0000'), when: vrOnly },
      { label: 'Check for new VR every', hint: 'Lower updates faster', control: slider('player.pollSeconds', 3, 60, 1, ' s'), when: vrOnly },
      { label: 'RR Lounge name', hint: 'Your name on the RR Lounge', control: text('player.loungeName', 'Your RR Lounge name'), when: rrLounge },
      { label: 'Leaderboard', control: select('player.ladder', [['rr', 'Retro Rewind'], ['ct', 'Custom Tracks'], ['tt', 'Time Trial']]), when: rrLounge },
      { label: 'MKW Lounge name', hint: 'Your name on mkwlounge.gg', control: text('player.loungeName', 'Your mkwlounge.gg name'), when: isMkw },
      { label: 'Leaderboard', control: select('player.mkwLadder', [['rt', 'Regular Tracks'], ['ct', 'Custom Tracks']]), when: isMkw },
      { label: 'Tag', hint: 'Short text before your name, like a team tag', control: text('player.tag', ''), when: notHud },
    ],
  },
  {
    title: 'Show',
    rows: [
      { label: 'Mii', control: toggle('visibility.avatar'), when: notHud },
      { label: 'Name', control: toggle('visibility.name'), when: notHud },
      { label: 'Country flag', control: toggle('player.flag'), when: s => isMmr(s) && !isHud(s) },
      { label: 'Tag', control: toggle('visibility.tag'), when: notHud },
      { label: 'VR', control: toggle('visibility.vr') },
      { label: 'VR gained or lost', hint: 'Like +241 after a race', control: toggle('visibility.delta'), when: notHud },
      { label: 'Keep last race’s VR', hint: 'Like +241 stays next to your VR until your next race', control: toggle('plus.keepChange'), when: isHud },
      { label: 'Box behind it', hint: 'A coloured box behind the +241', control: toggle('plus.changeBox'), when: s => !isHud(s) && s.visibility.delta },
      { label: 'The word “VR”', hint: 'Small label under the number', control: toggle('plus.vrLabel'), when: notHud },
      { label: 'Rank', hint: 'Your place on the leaderboard', control: toggle('visibility.rank') },
      { label: 'Rank gained or lost', control: toggle('visibility.rankDelta'), when: cardVr },
      { label: 'Online status', hint: 'Whether you’re online right now', control: toggle('visibility.connection'), when: cardVr },
      { label: 'Room', hint: 'The room you’re in', control: toggle('visibility.room'), when: cardVr },
      { label: 'Track', hint: 'The track being raced', control: toggle('visibility.track'), when: cardVr },
      { label: 'Box behind division', hint: 'Black box behind “Gold”, “Silver”…', control: toggle('plus.divisionBacking'), when: s => isSlim(s) && isMmr(s) },
      { label: 'Badge', hint: 'Automatic picks it from your VR', control: { kind: 'badge', options: BADGES } },
      { label: 'Badge outline', hint: 'A thin edge around the badge', control: toggle('plus.rankOutline'), when: badgeOn },
      { label: 'Outline thickness', control: slider('plus.rankOutlineWidth', 0.5, 10, 0.5, ''), when: outlined },
      { label: 'Badge size', control: slider('plus.rankBadgeSize', 30, 300, 5, ' %'), when: badgeOn },
      { label: 'Space before number', control: slider('plus.rankBadgeGap', 0, 100, 1, ' %'), when: badgeOn },
    ],
  },
  {
    title: 'Stats',
    rows: [
      { label: 'VR goal', hint: 'A bar fills toward it. Leave empty for none', control: text('plus.goal', 'e.g. 20000') },
      { label: 'VR to next rank', hint: 'Like “1,733 VR to C rank”', control: toggle('plus.nextRank'), when: vrOnly },
      { label: 'Races this stream', hint: 'Like “12 races · 8 up · 4 down”', control: toggle('plus.raceCount') },
      { label: 'Win streak', hint: 'Like “3 wins in a row”, shown from 2 wins', control: toggle('plus.winStreak') },
      { label: 'VR this stream', hint: 'Total gained or lost since you opened the overlay', control: toggle('visibility.sessionDelta') },
      { label: 'VR today', hint: 'Total gained or lost in the last 24 hours', control: toggle('visibility.dailyDelta'), when: cardVr },
    ],
  },
  {
    title: 'Size',
    rows: [
      { label: 'Size', hint: 'Use this instead of stretching it in OBS, it stays sharp', control: slider('layout.scale', 0.5, 3, 0.05, 'x') },
      { label: 'Width', control: slider('layout.width', 320, 900, 10, ' px'), when: notHud },
      { label: 'Smaller padding', control: toggle('layout.compact'), when: notHud },
      { label: 'Card background', hint: 'Off shows only the text', control: toggle('plus.card'), when: notHud },
      { label: 'Text thickness', control: slider('typography.weight', 400, 900, 100, ''), when: notHud },
    ],
  },
  {
    title: 'Font',
    when: notHud,
    rows: [
      { label: 'Text font', hint: 'For your name and labels', control: select('font.text', FONTS) },
      { label: 'Font name', hint: 'Any font from fonts.google.com', control: text('font.customText', 'e.g. Exo 2'), when: s => s.font.text === 'custom' },
      { label: 'Number font', hint: 'For your VR', control: select('font.number', FONTS) },
      { label: 'Font name', hint: 'Any font from fonts.google.com', control: text('font.customNumber', 'e.g. Teko'), when: s => s.font.number === 'custom' },
    ],
  },
  {
    title: 'Border',
    when: notHud,
    rows: [
      {
        label: 'Look',
        control: select('border.effect', [
          ['rainbow', 'Rainbow'], ['snake', 'Moving line'], ['pulse', 'Pulse'], ['wave', 'Wave'], ['ghost', 'Faint'], ['solid', 'Plain'], ['off', 'Off'],
        ]),
      },
      { label: 'Thickness', control: slider('border.width', 0, 16, 1, ' px') },
      { label: 'Round corners', control: slider('border.radius', 0, 60, 1, ' px') },
      { label: 'Speed', hint: 'Seconds per loop, lower is faster', control: slider('border.speed', 1, 20, 0.5, ' s') },
      { label: 'Glow', control: toggle('border.glow') },
      { label: 'Glow strength', control: slider('border.glowStrength', 0, 1, 0.05, '') },
      { label: 'Colour 1', control: color('border.color1') },
      { label: 'Colour 2', control: color('border.color2') },
      { label: 'Colour 3', control: color('border.color3') },
    ],
  },
  {
    title: 'Colors',
    rows: [
      { label: 'Text', control: color('typography.textColor') },
      { label: 'Small text', control: color('typography.mutedColor'), when: notHud },
      { label: 'VR number', control: color('typography.vrColor') },
      { label: 'In-game number style', hint: 'Numbers look like Mario Kart’s', control: toggle('plus.hudDigits'), when: notHud },
      { label: 'VR gained', control: color('typography.gainColor') },
      { label: 'VR lost', control: color('typography.lossColor') },
      { label: 'Rank', control: color('typography.rankColor'), when: notHud },
      { label: 'Badge outline', control: color('plus.rankOutlineColor'), when: outlined },
      {
        label: 'Behind the Mii',
        control: select('avatar.background', [['gradient', 'Two colours'], ['solid', 'One colour'], ['transparent', 'Nothing']]),
        when: notHud,
      },
      { label: 'Mii colour 1', control: color('avatar.color1'), when: s => !isHud(s) && s.avatar.background !== 'transparent' },
      { label: 'Mii colour 2', control: color('avatar.color2'), when: s => !isHud(s) && s.avatar.background === 'gradient' },
    ],
  },
  {
    title: 'Background',
    when: notHud,
    rows: [
      { label: 'Picture link', hint: 'Paste a link to any picture', control: text('background.imageUrl', 'https://…') },
      { label: 'Fit', control: select('background.fit', [['cover', 'Fill the card'], ['contain', 'Show all of it'], ['stretch', 'Stretch']]) },
      { label: 'Zoom', control: slider('background.zoom', 1, 4, 0.05, 'x') },
      { label: 'Move left/right', control: slider('background.x', 0, 100, 1, ' %') },
      { label: 'Move up/down', control: slider('background.y', 0, 100, 1, ' %') },
      { label: 'Tint colour', hint: 'Colour laid over the picture', control: color('background.overlayColor') },
      { label: 'Tint strength', control: slider('background.overlayOpacity', 0, 1, 0.02, '') },
      { label: 'Brightness', control: slider('background.brightness', 0, 2, 0.02, '') },
      { label: 'Contrast', control: slider('background.contrast', 0, 2, 0.02, '') },
      { label: 'Colour strength', control: slider('background.saturation', 0, 2, 0.02, '') },
      { label: 'Blur', control: slider('background.blur', 0, 30, 1, ' px') },
      { label: 'See-through', hint: 'Higher shows more of what’s behind the card', control: slider('background.glass', 0, 1, 0.02, '') },
    ],
  },
  {
    title: 'Animation',
    when: notHud,
    playsGain: true,
    rows: [
      {
        label: 'When VR changes',
        control: select('animations.vr', [['count', 'Count up'], ['spring', 'Bounce'], ['flip', 'Flip'], ['burst', 'Burst'], ['none', 'Just change']]),
      },
      {
        label: 'When rank changes',
        control: select('animations.rank', [['flip', 'Flip'], ['count', 'Count'], ['spring', 'Bounce'], ['burst', 'Burst'], ['none', 'Just change']]),
      },
      { label: 'How long', control: slider('animations.durationMs', 200, 3000, 50, ' ms') },
      { label: 'Big win effect from', hint: 'Gains this big get extra sparkle', control: slider('animations.celebrateThreshold', 50, 1000, 10, ' VR') },
      { label: 'Less movement', hint: 'Calmer animations', control: toggle('animations.reducedMotion') },
    ],
  },
];
