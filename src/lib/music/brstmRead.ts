// BRSTM reader: any Nintendo .brstm (DSP-ADPCM, PCM16 or PCM8) back to 16-bit samples, its rate and loop. Used to
// bring an existing music pack in. Follows the layout writeBrstm uses (HEAD parts 1–3, then interleaved DATA blocks),
// read through the offsets in the file so packs made by other tools load too.

export interface DecodedBrstm {
  channels: Int16Array[];
  rate: number;
  samples: number;
  /** The sample the song loops back to, or null when it doesn't loop. */
  loopStart: number | null;
  /** The raw audio, to tell whether two files hold the same song. */
  audio: Uint8Array;
}

const clamp16 = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

export function isBrstm(bytes: Uint8Array): boolean {
  return bytes.length > 0x40 && bytes[0] === 0x52 && bytes[1] === 0x53 && bytes[2] === 0x54 && bytes[3] === 0x4d;
}

export function readBrstm(bytes: Uint8Array, maxChannels = 2): DecodedBrstm {
  if (!isBrstm(bytes)) throw new Error('isn’t a .brstm file');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(4) !== 0xfeff) throw new Error('is a little-endian .brstm, which isn’t supported');
  const headAt = v.getUint32(0x10);
  const h = headAt + 8;
  const part1 = h + v.getUint32(h + 4);
  const part3 = h + v.getUint32(h + 0x14);
  const codec = bytes[part1];
  if (codec > 2) throw new Error(`uses an unknown codec (${codec})`);
  const looped = bytes[part1 + 1] === 1;
  const count = bytes[part1 + 2];
  const rate = v.getUint16(part1 + 4);
  const loopStart = v.getUint32(part1 + 8);
  const samples = v.getUint32(part1 + 0x0c);
  const dataAt = v.getUint32(part1 + 0x10);
  const blocks = v.getUint32(part1 + 0x14);
  const blockSize = v.getUint32(part1 + 0x18);
  const lastPadded = v.getUint32(part1 + 0x28);
  if (!count || !rate || !samples) throw new Error('has no audio');
  if (dataAt >= bytes.length) throw new Error('is cut short');

  const used = Math.min(count, maxChannels);
  const channels = Array.from({ length: used }, () => new Int16Array(samples));
  // Each channel's ADPCM coefficients and starting history.
  const contexts = Array.from({ length: used }, (_, c) => {
    const info = h + v.getUint32(part3 + 4 + c * 8 + 4);
    const ctx = h + v.getUint32(info + 4);
    const coefs = new Int16Array(16);
    for (let i = 0; i < 16; i++) coefs[i] = v.getInt16(ctx + i * 2);
    return { coefs, hist1: v.getInt16(ctx + 0x24), hist2: v.getInt16(ctx + 0x26) };
  });

  const written = new Array<number>(used).fill(0);
  let at = dataAt;
  for (let b = 0; b < blocks; b++) {
    const size = b === blocks - 1 ? lastPadded : blockSize;
    for (let c = 0; c < count; c++, at += size) {
      if (c >= used) continue;
      const out = channels[c];
      const end = Math.min(at + size, bytes.length);
      if (codec === 2) {
        const ctx = contexts[c];
        for (let f = at; f + 8 <= end && written[c] < samples; f += 8) {
          const header = bytes[f];
          const scale = 1 << (header & 0xf);
          const c1 = ctx.coefs[(header >> 4) * 2], c2 = ctx.coefs[(header >> 4) * 2 + 1];
          for (let n = 0; n < 14 && written[c] < samples; n++) {
            const byte = bytes[f + 1 + (n >> 1)];
            let nibble = n & 1 ? byte & 0xf : byte >> 4;
            if (nibble >= 8) nibble -= 16;
            const sample = clamp16(((nibble * scale) << 11) + 1024 + c1 * ctx.hist1 + c2 * ctx.hist2 >> 11);
            ctx.hist2 = ctx.hist1;
            ctx.hist1 = sample;
            out[written[c]++] = sample;
          }
        }
      } else if (codec === 1) {
        for (let i = at; i + 2 <= end && written[c] < samples; i += 2) out[written[c]++] = v.getInt16(i);
      } else {
        for (let i = at; i < end && written[c] < samples; i++) out[written[c]++] = (bytes[i] << 24) >> 16;
      }
    }
  }
  return {
    channels,
    rate,
    samples,
    loopStart: looped && loopStart > 0 && loopStart < samples ? loopStart : null,
    audio: bytes.subarray(dataAt, Math.min(bytes.length, at)),
  };
}

/** A 16-bit WAV of the samples, for the song library. */
export function toWav(channels: Int16Array[], rate: number): Uint8Array<ArrayBuffer> {
  const count = channels.length;
  const samples = channels[0]?.length ?? 0;
  const bytes = new Uint8Array(44 + samples * count * 2);
  const v = new DataView(bytes.buffer);
  const ascii = (o: number, s: string) => [...s].forEach((ch, i) => (bytes[o + i] = ch.charCodeAt(0)));
  ascii(0, 'RIFF');
  v.setUint32(4, bytes.length - 8, true);
  ascii(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, count, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * count * 2, true);
  v.setUint16(32, count * 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, samples * count * 2, true);
  let o = 44;
  for (let i = 0; i < samples; i++) for (let c = 0; c < count; c++, o += 2) v.setInt16(o, channels[c][i], true);
  return bytes;
}
