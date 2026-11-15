// Yaz0, Nintendo's compression for .szs files: a 16-byte header ("Yaz0", the decompressed size, 8 zero bytes), then
// groups of one code byte and 8 chunks. A set bit is one literal byte; a clear bit is a copy of earlier output, 2 bytes
// (length 3-17 in the top nibble, less 2) or 3 bytes (length 18-273), with a distance of 1-4096.

const MAX_DISTANCE = 0x1000;
const MAX_LENGTH = 0x111;
// How many earlier matches the encoder tries per byte. More packs a little smaller, slower.
const SEARCH_DEPTH = 128;

export const isYaz0 = (data: Uint8Array): boolean =>
  data.length >= 16 && data[0] === 0x59 && data[1] === 0x61 && data[2] === 0x7a && data[3] === 0x30;

export function yaz0Decode(src: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!isYaz0(src)) throw new Error('Not a Yaz0 file: it should start with "Yaz0".');
  const size = new DataView(src.buffer, src.byteOffset, src.byteLength).getUint32(4);
  const out = new Uint8Array(size);
  let s = 16;
  let d = 0;
  while (d < size) {
    if (s >= src.length) throw new Error('The file ends early: it may be cut off.');
    let code = src[s++];
    for (let bit = 0; bit < 8 && d < size; bit++, code <<= 1) {
      if (code & 0x80) {
        out[d++] = src[s++];
        continue;
      }
      const b1 = src[s++];
      const b2 = src[s++];
      const from = d - ((((b1 & 0x0f) << 8) | b2) + 1);
      const length = b1 >> 4 ? (b1 >> 4) + 2 : src[s++] + 0x12;
      if (from < 0 || s > src.length) throw new Error('The file is damaged: a copy points before its start.');
      for (let i = 0; i < length && d < size; i++) out[d++] = out[from + i];
    }
  }
  return out;
}

export function yaz0Encode(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const n = data.length;
  // Worst case is all literals: one code byte per 8 bytes.
  const out = new Uint8Array(16 + n + Math.ceil(n / 8));
  out.set([0x59, 0x61, 0x7a, 0x30]);
  new DataView(out.buffer).setUint32(4, n);
  // Hash chains over 3-byte sequences: head[hash] is the latest position, prev[pos] the one before it.
  const head = new Int32Array(1 << 16).fill(-1);
  const prev = new Int32Array(n);
  const hash = (i: number) => Math.imul((data[i] << 16) | (data[i + 1] << 8) | data[i + 2], 0x9e3779b1) >>> 16;
  const insert = (i: number) => {
    if (i + 2 >= n) return;
    const h = hash(i);
    prev[i] = head[h];
    head[h] = i;
  };
  let o = 16;
  let i = 0;
  while (i < n) {
    const codeAt = o++;
    let code = 0;
    for (let bit = 0; bit < 8 && i < n; bit++) {
      let bestLength = 0;
      let bestAt = 0;
      if (i + 2 < n) {
        const limit = Math.min(MAX_LENGTH, n - i);
        for (let j = head[hash(i)], depth = 0; j >= 0 && i - j <= MAX_DISTANCE && depth < SEARCH_DEPTH; j = prev[j], depth++) {
          let length = 0;
          while (length < limit && data[j + length] === data[i + length]) length++;
          if (length > bestLength) {
            bestLength = length;
            bestAt = j;
            if (length === limit) break;
          }
        }
      }
      if (bestLength >= 3) {
        const distance = i - bestAt - 1;
        if (bestLength >= 0x12) {
          out[o++] = distance >> 8;
          out[o++] = distance & 0xff;
          out[o++] = bestLength - 0x12;
        } else {
          out[o++] = ((bestLength - 2) << 4) | (distance >> 8);
          out[o++] = distance & 0xff;
        }
        for (let k = 0; k < bestLength; k++) insert(i + k);
        i += bestLength;
      } else {
        code |= 0x80 >> bit;
        out[o++] = data[i];
        insert(i);
        i++;
      }
    }
    out[codeAt] = code;
  }
  return out.slice(0, o);
}
