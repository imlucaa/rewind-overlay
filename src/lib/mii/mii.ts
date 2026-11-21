// Wii Miis for the Mii Creator: the 74-byte record (RFLCharData), field by field, and the Mii Studio code that renders
// it. Bit positions follow WiiBrew's "Mii data" page (big-endian words, counted from the most significant bit); the
// ranges are the Mii Channel's, the same ones Wheel Wizard's Mii editor uses.

export const MII_SIZE = 74;

type Word = 8 | 16 | 32;
interface Field {
  at: number;
  word: Word;
  from: number;
  width: number;
  min: number;
  max: number;
}

const f = (at: number, word: Word, from: number, width: number, min: number, max: number): Field => ({ at, word, from, width, min, max });

/** Every field the creator can change. */
export const FIELDS = {
  // Header (0x00)
  isGirl: f(0x00, 16, 1, 1, 0, 1),
  birthMonth: f(0x00, 16, 2, 4, 0, 12),
  birthDay: f(0x00, 16, 6, 5, 0, 31),
  favoriteColor: f(0x00, 16, 11, 4, 0, 11),
  isFavorite: f(0x00, 16, 15, 1, 0, 1),
  // Body
  height: f(0x16, 8, 0, 8, 0, 127),
  weight: f(0x17, 8, 0, 8, 0, 127),
  // Face (0x20)
  faceShape: f(0x20, 16, 0, 3, 0, 7),
  skinColor: f(0x20, 16, 3, 3, 0, 5),
  facialFeature: f(0x20, 16, 6, 4, 0, 11),
  // Hair (0x22)
  hairType: f(0x22, 16, 0, 7, 0, 71),
  hairColor: f(0x22, 16, 7, 3, 0, 7),
  hairFlipped: f(0x22, 16, 10, 1, 0, 1),
  // Eyebrows (0x24)
  eyebrowType: f(0x24, 32, 0, 5, 0, 23),
  eyebrowRotation: f(0x24, 32, 6, 4, 0, 11),
  eyebrowColor: f(0x24, 32, 16, 3, 0, 7),
  eyebrowSize: f(0x24, 32, 19, 4, 0, 8),
  eyebrowVertical: f(0x24, 32, 23, 5, 3, 18),
  eyebrowSpacing: f(0x24, 32, 28, 4, 0, 12),
  // Eyes (0x28)
  eyeType: f(0x28, 32, 0, 6, 0, 47),
  eyeRotation: f(0x28, 32, 8, 3, 0, 7),
  eyeVertical: f(0x28, 32, 11, 5, 0, 18),
  eyeColor: f(0x28, 32, 16, 3, 0, 5),
  eyeSize: f(0x28, 32, 20, 3, 0, 7),
  eyeSpacing: f(0x28, 32, 23, 4, 0, 12),
  // Nose (0x2C)
  noseType: f(0x2c, 16, 0, 4, 0, 11),
  noseSize: f(0x2c, 16, 4, 4, 0, 8),
  noseVertical: f(0x2c, 16, 8, 5, 0, 18),
  // Mouth (0x2E)
  mouthType: f(0x2e, 16, 0, 5, 0, 23),
  mouthColor: f(0x2e, 16, 5, 2, 0, 2),
  mouthSize: f(0x2e, 16, 7, 4, 0, 8),
  mouthVertical: f(0x2e, 16, 11, 5, 0, 18),
  // Glasses (0x30)
  glassesType: f(0x30, 16, 0, 4, 0, 8),
  glassesColor: f(0x30, 16, 4, 3, 0, 5),
  glassesSize: f(0x30, 16, 8, 3, 0, 7),
  glassesVertical: f(0x30, 16, 11, 5, 0, 20),
  // Facial hair (0x32)
  mustacheType: f(0x32, 16, 0, 2, 0, 3),
  beardType: f(0x32, 16, 2, 2, 0, 3),
  facialHairColor: f(0x32, 16, 4, 3, 0, 7),
  mustacheSize: f(0x32, 16, 7, 4, 0, 8),
  mustacheVertical: f(0x32, 16, 11, 5, 0, 16),
  // Mole (0x34)
  hasMole: f(0x34, 16, 0, 1, 0, 1),
  moleSize: f(0x34, 16, 1, 4, 0, 8),
  moleVertical: f(0x34, 16, 5, 5, 0, 30),
  moleHorizontal: f(0x34, 16, 10, 5, 0, 16),
} as const;

export type FieldKey = keyof typeof FIELDS;
export type Mii = Uint8Array<ArrayBuffer>;

function readWord(b: Mii, at: number, word: Word): number {
  if (word === 8) return b[at];
  if (word === 16) return (b[at] << 8) | b[at + 1];
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

function writeWord(b: Mii, at: number, word: Word, v: number) {
  if (word === 8) b[at] = v & 0xff;
  else if (word === 16) {
    b[at] = (v >>> 8) & 0xff;
    b[at + 1] = v & 0xff;
  } else {
    b[at] = (v >>> 24) & 0xff;
    b[at + 1] = (v >>> 16) & 0xff;
    b[at + 2] = (v >>> 8) & 0xff;
    b[at + 3] = v & 0xff;
  }
}

export function get(mii: Mii, key: FieldKey): number {
  const fd = FIELDS[key];
  const shift = fd.word - fd.from - fd.width;
  return (readWord(mii, fd.at, fd.word) >>> shift) & ((1 << fd.width) - 1);
}

/** A copy of the Mii with `key` set. Values outside the field's range are refused. */
export function set(mii: Mii, key: FieldKey, value: number): Mii {
  const fd = FIELDS[key];
  if (!Number.isInteger(value) || value < fd.min || value > fd.max) throw new RangeError(`${key} must be ${fd.min}-${fd.max}`);
  const out = new Uint8Array(mii) as Mii;
  const shift = fd.word - fd.from - fd.width;
  const mask = (((1 << fd.width) - 1) << shift) >>> 0;
  const word = ((readWord(out, fd.at, fd.word) & ~mask) | ((value << shift) & mask)) >>> 0;
  writeWord(out, fd.at, fd.word, word);
  return out;
}

export const setMany = (mii: Mii, edits: Partial<Record<FieldKey, number>>) =>
  Object.entries(edits).reduce((m, [k, v]) => set(m, k as FieldKey, v as number), mii);

export const range = (key: FieldKey) => ({ min: FIELDS[key].min, max: FIELDS[key].max });

// ---------- names (UTF-16 BE, 10 characters: the name at 0x02, the creator at 0x36)

function readName(mii: Mii, at: number) {
  let s = '';
  for (let i = 0; i < 10; i++) {
    const u = (mii[at + i * 2] << 8) | mii[at + i * 2 + 1];
    if (!u) break;
    s += String.fromCharCode(u);
  }
  return s;
}

function writeName(mii: Mii, at: number, name: string): Mii {
  if (name.length > 10) throw new RangeError('Names are at most 10 characters');
  const out = new Uint8Array(mii) as Mii;
  out.fill(0, at, at + 20);
  for (let i = 0; i < name.length; i++) {
    const u = name.charCodeAt(i);
    out[at + i * 2] = u >>> 8;
    out[at + i * 2 + 1] = u & 0xff;
  }
  return out;
}

export const nameOf = (mii: Mii) => readName(mii, 0x02);
export const creatorOf = (mii: Mii) => readName(mii, 0x36);
export const withName = (mii: Mii, name: string) => writeName(mii, 0x02, name);
export const withCreator = (mii: Mii, creator: string) => writeName(mii, 0x36, creator);

// ---------- new and random Miis

/** The Wii's Mii ID clock: 4-second ticks since 2006-01-01. */
export const miiIdClock = (unixSeconds: number) => Math.floor(Math.max(0, unixSeconds - 1_136_073_600) / 4) & 0x1fffffff;

/** A new Mii: a normal Mii ID made now, no console (System ID 0), and a plain default face. */
/** The starting hair, eyes, eyebrows and mouth for each gender. */
export const STARTING_LOOK = {
  male: { hairType: 33, eyeType: 2, eyebrowType: 6, mouthType: 23, mouthColor: 0 },
  female: { hairType: 12, eyeType: 4, eyebrowType: 0, mouthType: 11, mouthColor: 1 },
} as const satisfies Record<string, Partial<Record<FieldKey, number>>>;

const lookOf = (girl: boolean) => (girl ? STARTING_LOOK.female : STARTING_LOOK.male);

/** A new Mii: a normal Mii ID made now, no console (System ID 0), and a plain starting face for its gender. */
export function newMii(now = Date.now(), girl = false): Mii {
  let mii = new Uint8Array(MII_SIZE) as Mii;
  const id = (0x80000000 | miiIdClock(now / 1000)) >>> 0;
  writeWord(mii, 0x18, 32, id);
  mii = setMany(mii, {
    favoriteColor: 5, height: 64, weight: 64, hairColor: 1, eyebrowRotation: 6,
    eyebrowColor: 1, eyebrowSize: 4, eyebrowVertical: 10, eyebrowSpacing: 2, eyeRotation: 4, eyeVertical: 12,
    eyeSize: 4, eyeSpacing: 2, noseType: 1, noseSize: 4, noseVertical: 9, mouthSize: 4, mouthVertical: 13,
    glassesSize: 4, glassesVertical: 10, mustacheSize: 4, mustacheVertical: 10, moleSize: 4, moleVertical: 20, moleHorizontal: 2,
    isGirl: girl ? 1 : 0,
    ...lookOf(girl),
  });
  return withName(mii, 'New Mii');
}

/**
 * The Mii as a boy or a girl. Like on the Wii this changes the body; a Mii still wearing the other gender's starting
 * face also gets this gender's starting face, so switching on a fresh Mii looks right. Faces you changed are kept.
 */
export function withGender(mii: Mii, girl: boolean): Mii {
  const other = lookOf(!girl);
  const untouched = (Object.keys(other) as FieldKey[]).every(k => get(mii, k) === other[k as keyof typeof other]);
  return setMany(mii, { isGirl: girl ? 1 : 0, ...(untouched ? lookOf(girl) : {}) });
}

/** The look "Surprise me" may change. Positions and sizes stay, so the face never ends up scattered. */
export const RANDOM_FIELDS: FieldKey[] = [
  'faceShape', 'skinColor', 'hairType', 'hairColor', 'hairFlipped', 'eyebrowType', 'eyebrowColor', 'eyeType', 'eyeColor',
  'noseType', 'mouthType', 'mouthColor', 'height', 'weight', 'favoriteColor',
];

export function randomize(mii: Mii, random = Math.random): Mii {
  return RANDOM_FIELDS.reduce((m, key) => {
    const { min, max } = range(key);
    return set(m, key, min + Math.floor(random() * (max - min + 1)));
  }, mii);
}

/** Whether 74 bytes look like a Wii Mii the Wii would accept: every type and colour in range, a normal Mii ID bit. */
export function isValidMii(bytes: Uint8Array): bytes is Mii {
  if (bytes.length !== MII_SIZE || bytes.every(b => b === 0)) return false;
  return (Object.keys(FIELDS) as FieldKey[]).every(k => {
    const v = get(bytes as Mii, k);
    const { min, max } = FIELDS[k];
    // Positions and sizes outside the editor's range still load (other tools write them); only types and colours must fit.
    return /Type|Color|faceShape|facialFeature|birth/.test(k) ? v >= min && v <= max : true;
  });
}

// ---------- Mii Studio (studio.mii.nintendo.com renders from this; it carries only the look, never names or IDs)

const MAKEUP = [0, 1, 6, 9, 0, 0, 0, 0, 0, 10, 0, 0];
const WRINKLES = [0, 0, 0, 0, 5, 2, 3, 7, 8, 0, 9, 11];

/** The 46 studio bytes, in studio order (the mapping mii2studio and Mii Database Editor use). */
export function toStudio(b: Mii): number[] {
  const w16 = (at: number) => readWord(b, at, 16);
  const w32 = (at: number) => readWord(b, at, 32);
  const [h, face, hair] = [w16(0x00), w16(0x20), w16(0x22)];
  const [brow, eye] = [w32(0x24), w32(0x28)];
  const [nose, mouth, glasses, beard, mole] = [w16(0x2c), w16(0x2e), w16(0x30), w16(0x32), w16(0x34)];
  const z8 = (v: number) => (v === 0 ? 8 : v);
  const feature = (face >>> 6) & 0xf;
  const gc = (glasses >>> 9) & 7;
  const glassesColor = gc === 0 ? 8 : gc <= 5 ? gc + 13 : 0;
  return [
    z8((beard >>> 9) & 7), (beard >>> 12) & 3, b[0x17], 3, ((eye >>> 13) & 7) + 8, (eye >>> 21) & 7, (eye >>> 9) & 7,
    (eye >>> 26) & 0x3f, (eye >>> 5) & 0xf, (eye >>> 16) & 0x1f, 3, z8((brow >>> 13) & 7), (brow >>> 22) & 0xf, (brow >>> 9) & 0xf,
    (brow >>> 27) & 0x1f, brow & 0xf, (brow >>> 4) & 0x1f, (face >>> 10) & 7, MAKEUP[feature] ?? 0, face >>> 13, WRINKLES[feature] ?? 0,
    (h >>> 1) & 0xf, (h >>> 14) & 1, glassesColor, (glasses >>> 5) & 7, glasses >>> 12, glasses & 0x1f, z8((hair >>> 6) & 7),
    (hair >>> 5) & 1, hair >>> 9, b[0x16], (mole >>> 11) & 0xf, mole >>> 15, (mole >>> 1) & 0x1f, (mole >>> 6) & 0x1f, 3,
    ((mouth >>> 9) & 3) + 19, (mouth >>> 5) & 0xf, mouth >>> 11, mouth & 0x1f, (beard >>> 5) & 0xf, beard >>> 14, beard & 0x1f,
    (nose >>> 8) & 0xf, nose >>> 12, (nose >>> 3) & 0x1f,
  ];
}

/** The `data=` value: a 00 byte, then each studio byte XORed with the previous output byte plus 7, as hex. */
export function studioCode(mii: Mii): string {
  let out = '00';
  let prev = 0;
  for (const v of toStudio(mii)) {
    const e = ((v ^ prev) + 7) & 0xff;
    out += e.toString(16).padStart(2, '0');
    prev = e;
  }
  return out;
}

export const FRAMES = 16;
/** A Mii Studio render. With `frames`, a strip of that many angles side by side (22.5 degrees apart for 16). */
export function studioUrl(code: string, opts: { body?: boolean; width?: 96 | 270 | 512; smile?: boolean; frames?: number } = {}) {
  const q = new URLSearchParams({
    data: code,
    type: opts.body ? 'all_body' : 'face',
    expression: opts.smile ? 'smile' : 'normal',
    width: String(opts.width ?? 270),
    bgColor: 'FFFFFF00',
  });
  if (opts.frames) {
    q.set('instanceCount', String(opts.frames));
    q.set('instanceRotationMode', 'model');
  }
  return `https://studio.mii.nintendo.com/miis/image.png?${q}`;
}
