// Reads Mario Kart Wii's sound effect archive (sound/revo_kart.brsar) and swaps the audio of one sound in place.
//
// Layout follows BrawlCrate's definitions (BrawlLib/SSBB/Types/Audio: RSAR, RWSD, RWAR, RWAV). Everything is big
// endian. A replacement is fitted to the original wave's sample count, rate and encoding, so it takes exactly the
// bytes the old audio did: no offset anywhere else in the archive moves, and the file keeps its size. A file can sit
// in several groups, each with its own copy, so every copy is patched.

import { encodeChannel } from '../music/brstm.ts';

export interface WaveFormat {
  /** 0 PCM8, 1 PCM16, 2 DSP-ADPCM. */
  encoding: number;
  looped: boolean;
  channels: number;
  rate: number;
  samples: number;
  loopStart: number;
}

/** One copy of a wave inside the archive: where its info block is, and where its channel offsets count from. */
interface WaveCopy {
  info: number;
  dataBase: number;
}

export interface Wave {
  /** Identifies the wave across sounds (sounds sharing one wave share its audio). */
  key: string;
  format: WaveFormat;
  copies: WaveCopy[];
}

export interface SoundEntry {
  index: number;
  name: string;
  /** The waves it plays (usually one). */
  waves: Wave[];
}

export interface Brsar {
  sounds: SoundEntry[];
}

class Reader {
  readonly v: DataView;
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  private check(at: number, size: number) {
    if (at < 0 || at + size > this.bytes.length) throw new Error(`points outside the file (0x${at.toString(16)})`);
  }
  u8(at: number) {
    this.check(at, 1);
    return this.bytes[at];
  }
  u16(at: number) {
    this.check(at, 2);
    return this.v.getUint16(at);
  }
  u32(at: number) {
    this.check(at, 4);
    return this.v.getUint32(at);
  }
  i32(at: number) {
    this.check(at, 4);
    return this.v.getInt32(at);
  }
  tag(at: number) {
    this.check(at, 4);
    return String.fromCharCode(...this.bytes.subarray(at, at + 4));
  }
  expect(at: number, tag: string, what: string) {
    if (this.tag(at) !== tag) throw new Error(`isn’t laid out as expected: no ${tag} where the ${what} should be`);
  }
  cstring(at: number) {
    let end = at;
    while (end < this.bytes.length && this.bytes[end]) end++;
    return String.fromCharCode(...this.bytes.subarray(at, end));
  }
  /** A list of 8-byte references (type, data type, pad, offset); returns each offset + base. */
  refList(at: number, base: number) {
    const n = this.u32(at);
    if (n > 100000) throw new Error('has a list that is far too long');
    return Array.from({ length: n }, (_, i) => base + this.u32(at + 4 + i * 8 + 4));
  }
}

export function isBrsar(bytes: Uint8Array) {
  return bytes.length > 0x28 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RSAR';
}

function readFormat(r: Reader, info: number): WaveFormat {
  const encoding = r.u8(info);
  const raw = r.u32(info + 0x0c);
  // ADPCM counts nibbles (frame headers included); PCM counts samples.
  const samples = encoding === 2 ? Math.floor(raw / 16) * 14 + Math.max(0, (raw % 16) - 2) : raw;
  return {
    encoding,
    looped: r.u8(info + 1) === 1,
    channels: r.u8(info + 2),
    rate: (r.u8(info + 3) << 16) | r.u16(info + 4),
    samples,
    loopStart: r.u32(info + 8),
  };
}

/** Reads the archive's sound list and finds every copy of every wave-sound's audio. Throws on anything unexpected. */
export function readBrsar(bytes: Uint8Array): Brsar {
  const r = new Reader(bytes);
  if (!isBrsar(bytes)) throw new Error('isn’t a .brsar file');
  if (r.u16(4) !== 0xfeff) throw new Error('is a little-endian .brsar, which isn’t supported');
  const symb = r.u32(0x10);
  const info = r.u32(0x18);
  r.expect(symb, 'SYMB', 'name table');
  r.expect(info, 'INFO', 'info table');

  // Names: a count and offsets, both counted from the start of SYMB's body.
  const strBase = symb + 8;
  const strTable = strBase + r.u32(strBase);
  const nameCount = r.u32(strTable);
  const name = (id: number) => (id >= 0 && id < nameCount ? r.cstring(strBase + r.u32(strTable + 4 + id * 4)) : `#${id}`);

  // INFO: a collection of references (sounds, banks, players, files, groups); every offset inside counts from the
  // start of its body.
  const base = info + 8;
  const table = (k: number) => base + r.u32(base + k * 8 + 4);
  const soundEntries = r.refList(table(0), base);
  const fileEntries = r.refList(table(3), base);
  const groupEntries = r.refList(table(4), base);

  const groups = groupEntries.map(g => ({
    headerOffset: r.u32(g + 0x10),
    waveDataOffset: r.u32(g + 0x18),
    items: r.refList(base + r.u32(g + 0x24), base).map(it => ({
      headerOffset: r.u32(it + 4),
      dataOffset: r.u32(it + 0x0c),
    })),
  }));

  // Every copy of a file: (RWSD start, start of its audio).
  const fileCopies = (fileId: number) => {
    const f = fileEntries[fileId];
    if (f === undefined) return [];
    return r.refList(base + r.u32(f + 0x18), base).flatMap(pos => {
      const group = groups[r.i32(pos)];
      const item = group?.items[r.i32(pos + 4)];
      return group && item ? [{ header: group.headerOffset + item.headerOffset, audio: group.waveDataOffset + item.dataOffset }] : [];
    });
  };

  // The wave infos a copy of an RWSD file holds, by wave index.
  const waveTable = (rwsd: number, audio: number): WaveCopy[] => {
    r.expect(rwsd, 'RWSD', 'sound file');
    const minor = r.u16(rwsd + 6) & 0xff;
    const waveOffset = r.u32(rwsd + 0x18);
    if (minor <= 2 && waveOffset) {
      // Older files keep wave infos in their own WAVE block; the audio sits in the group's wave data.
      const wave = rwsd + waveOffset;
      r.expect(wave, 'WAVE', 'wave table');
      const n = r.u32(wave + 8);
      return Array.from({ length: n }, (_, i) => {
        const at = wave + r.u32(wave + 12 + i * 4);
        return { info: at, dataBase: audio + r.u32(at + 0x14) };
      });
    }
    // Newer files keep each wave as an RWAV inside an RWAR at the start of the file's audio.
    r.expect(audio, 'RWAR', 'wave archive');
    const tabl = audio + r.u32(audio + 0x10);
    const data = audio + r.u32(audio + 0x18);
    r.expect(tabl, 'TABL', 'wave archive table');
    const n = r.u32(tabl + 8);
    return Array.from({ length: n }, (_, i) => {
      const rwav = data + r.u32(tabl + 12 + i * 12 + 4);
      r.expect(rwav, 'RWAV', 'wave');
      return { info: rwav + r.u32(rwav + 0x10) + 8, dataBase: rwav + r.u32(rwav + 0x18) + 8 };
    });
  };

  // Which wave indices a sound in an RWSD plays: DATA list -> sound -> note table -> each note's wave index.
  const notesOf = (rwsd: number, soundIndex: number): number[] => {
    const dataBlock = rwsd + r.u32(rwsd + 0x10);
    r.expect(dataBlock, 'DATA', 'sound data');
    const list = dataBlock + 8;
    const entries = r.refList(list, list);
    const entry = entries[soundIndex];
    if (entry === undefined) return [];
    const notes = r.refList(list + r.u32(entry + 0x14), list);
    return notes.map(n => r.i32(n));
  };

  const waves = new Map<string, Wave>();
  const result: SoundEntry[] = [];
  soundEntries.forEach((s, index) => {
    if (r.u8(s + 0x16) !== 3) return; // only wave sounds (not sequences or streams)
    const fileId = r.i32(s + 4);
    const soundIndex = r.i32(base + r.u32(s + 0x1c));
    const copies = fileCopies(fileId);
    if (!copies.length) return;
    const wavesBySlot = new Map<number, WaveCopy[]>();
    for (const copy of copies) {
      const table = waveTable(copy.header, copy.audio);
      for (const w of notesOf(copy.header, soundIndex)) {
        if (!table[w]) continue;
        wavesBySlot.set(w, [...(wavesBySlot.get(w) ?? []), table[w]]);
      }
    }
    const list: Wave[] = [];
    for (const [slot, found] of wavesBySlot) {
      const key = `${fileId}:${slot}`;
      let wave = waves.get(key);
      if (!wave) {
        wave = { key, format: readFormat(r, found[0].info), copies: found };
        waves.set(key, wave);
      }
      list.push(wave);
    }
    if (list.length) result.push({ index, name: name(r.i32(s)), waves: list });
  });
  return { sounds: result };
}

// ---------- audio ----------

const clamp16 = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

function channelAt(r: Reader, copy: WaveCopy, c: number) {
  const table = copy.info + r.u32(copy.info + 0x10);
  const ch = copy.info + r.u32(table + c * 4);
  return { data: copy.dataBase + r.u32(ch), adpcm: copy.info + r.u32(ch + 4) };
}

/** Bytes one channel takes for this format. */
export function channelBytes(f: WaveFormat) {
  if (f.encoding === 2) return Math.ceil(f.samples / 14) * 8;
  return f.encoding === 1 ? f.samples * 2 : f.samples;
}

/** The first channel of a wave as 16-bit samples, for listening to the original. */
export function decodeWave(bytes: Uint8Array, wave: Wave): Int16Array {
  const r = new Reader(bytes);
  const f = wave.format;
  const copy = wave.copies[0];
  const { data, adpcm } = channelAt(r, copy, 0);
  const out = new Int16Array(f.samples);
  if (f.encoding === 1) {
    for (let i = 0; i < f.samples; i++) out[i] = r.v.getInt16(data + i * 2);
    return out;
  }
  if (f.encoding === 0) {
    for (let i = 0; i < f.samples; i++) out[i] = (r.u8(data + i) << 24) >> 16;
    return out;
  }
  const coefs = Array.from({ length: 16 }, (_, i) => r.v.getInt16(adpcm + i * 2));
  let hist1 = r.v.getInt16(adpcm + 0x24);
  let hist2 = r.v.getInt16(adpcm + 0x26);
  let n = 0;
  for (let frame = data; n < f.samples; frame += 8) {
    const header = r.u8(frame);
    const scale = 1 << (header & 0xf);
    const c1 = coefs[(header >> 4) * 2];
    const c2 = coefs[(header >> 4) * 2 + 1];
    for (let k = 0; k < 14 && n < f.samples; k++) {
      const byte = r.u8(frame + 1 + (k >> 1));
      let nibble = k & 1 ? byte & 0xf : byte >> 4;
      if (nibble >= 8) nibble -= 16;
      const sample = clamp16((((nibble * scale) << 11) + 1024 + c1 * hist1 + c2 * hist2) >> 11);
      hist2 = hist1;
      hist1 = sample;
      out[n++] = sample;
    }
  }
  return out;
}

/** Fits samples to the wave's length: cut with a short fade if longer, silence after if shorter. */
export function fitToWave(pcm: Int16Array, f: WaveFormat): Int16Array {
  const out = new Int16Array(f.samples);
  out.set(pcm.subarray(0, f.samples));
  if (pcm.length > f.samples) {
    const fade = Math.min(f.samples, Math.round(f.rate * 0.02));
    for (let i = 0; i < fade; i++) out[f.samples - 1 - i] = Math.round(out[f.samples - 1 - i] * (i / fade));
  }
  return out;
}

/**
 * Writes `pcm` (already fitted to the wave's length) over every copy of the wave, into every channel, in the wave's own
 * encoding. Only the audio bytes and the ADPCM header of each channel change. Returns the bytes for convenience.
 */
export function patchWave(bytes: Uint8Array, wave: Wave, pcm: Int16Array): Uint8Array {
  const r = new Reader(bytes);
  const f = wave.format;
  if (pcm.length !== f.samples) throw new Error('replacement must be fitted to the wave first');
  const size = channelBytes(f);
  let encoded: Uint8Array;
  let coefs: Int16Array | null = null;
  if (f.encoding === 2) {
    const ch = encodeChannel(pcm, 0);
    coefs = ch.coefs;
    encoded = ch.data;
  } else if (f.encoding === 1) {
    encoded = new Uint8Array(size);
    const v = new DataView(encoded.buffer);
    pcm.forEach((s, i) => v.setInt16(i * 2, s));
  } else {
    encoded = Uint8Array.from(pcm, s => (s >> 8) & 0xff);
  }

  for (const copy of wave.copies) {
    for (let c = 0; c < f.channels; c++) {
      const { data, adpcm } = channelAt(r, copy, c);
      if (data + size > bytes.length) throw new Error('a wave runs past the end of the file');
      bytes.fill(0, data, data + size);
      bytes.set(encoded.subarray(0, size), data);
      if (coefs) {
        coefs.forEach((k, i) => r.v.setInt16(adpcm + i * 2, k));
        r.v.setUint16(adpcm + 0x20, 0); // gain
        r.v.setUint16(adpcm + 0x22, encoded[0]); // predictor/scale of the first frame
        r.v.setInt16(adpcm + 0x24, 0);
        r.v.setInt16(adpcm + 0x26, 0);
        // Loop context: the frame header at the loop start and the two samples before it, from our own encode.
        const ls = f.looped ? f.loopStart : 0;
        const decoded = ls ? decodeWave(bytes, { ...wave, copies: [copy] }) : null;
        r.v.setUint16(adpcm + 0x28, f.looped ? encoded[Math.floor(ls / 14) * 8] ?? 0 : 0);
        r.v.setInt16(adpcm + 0x2a, decoded && ls > 0 ? decoded[ls - 1] : 0);
        r.v.setInt16(adpcm + 0x2c, decoded && ls > 1 ? decoded[ls - 2] : 0);
      }
    }
  }
  return bytes;
}

