// BRSTM writer: 16-bit PCM in, a looping DSP-ADPCM .brstm out, laid out exactly as VGAudio writes it (the library
// Music Pack Maker uses), which Mario Kart Wii and Retro Rewind load. Output is byte-identical to VGAudio 2.2.1
// (see brstm.test.ts). The coefficient search is a port of Nintendo's DSPADPCM encoder as published in jackoalan's
// gc-dspadpcm-encode; the frame encoder follows VGAudio's DspEncodeCoef.

type Vec = number[];
type Mtx = Vec[];

interface EncodeWork {
  pcmOut: Int32Array[];
  adpcmOut: Int32Array[];
  scale: Int32Array;
  dist: Float64Array;
}

export interface EncodedChannel {
  coefs: Int16Array;
  data: Uint8Array;
  ps: number;
  /** [hist1, hist2] at the start of each block. */
  seek: Int16Array;
}

const SAMPLES_PER_BLOCK = 0x3800;
const BLOCK_SIZE = 0x2000;

// ---------- coefficients ----------
function innerProductMerge(out: Vec, buf: Int16Array): void {
  for (let i = 0; i <= 2; i++) {
    out[i] = 0;
    for (let x = 0; x < 14; x++) out[i] -= buf[14 + x - i] * buf[14 + x];
  }
}

function outerProductMerge(mtx: Mtx, buf: Int16Array): void {
  for (let x = 1; x <= 2; x++)
    for (let y = 1; y <= 2; y++) {
      mtx[x][y] = 0;
      for (let z = 0; z < 14; z++) mtx[x][y] += buf[14 + z - x] * buf[14 + z - y];
    }
}

function analyzeRanges(mtx: Mtx, idx: number[]): boolean {
  const recips = [0, 0, 0];
  for (let x = 1; x <= 2; x++) {
    const val = Math.max(Math.abs(mtx[x][1]), Math.abs(mtx[x][2]));
    if (val < Number.EPSILON) return true;
    recips[x] = 1 / val;
  }
  let maxIndex = 0;
  for (let i = 1; i <= 2; i++) {
    for (let x = 1; x < i; x++) {
      let tmp = mtx[x][i];
      for (let y = 1; y < x; y++) tmp -= mtx[x][y] * mtx[y][i];
      mtx[x][i] = tmp;
    }
    let val = 0;
    for (let x = i; x <= 2; x++) {
      let tmp = mtx[x][i];
      for (let y = 1; y < i; y++) tmp -= mtx[x][y] * mtx[y][i];
      mtx[x][i] = tmp;
      tmp = Math.abs(tmp) * recips[x];
      if (tmp >= val) {
        val = tmp;
        maxIndex = x;
      }
    }
    if (maxIndex !== i) {
      for (let y = 1; y <= 2; y++) {
        const tmp = mtx[maxIndex][y];
        mtx[maxIndex][y] = mtx[i][y];
        mtx[i][y] = tmp;
      }
      recips[maxIndex] = recips[i];
    }
    idx[i] = maxIndex;
    if (mtx[i][i] === 0) return true;
    if (i !== 2) {
      const tmp = 1 / mtx[i][i];
      for (let x = i + 1; x <= 2; x++) mtx[x][i] *= tmp;
    }
  }
  let min = 1e10, max = 0;
  for (let i = 1; i <= 2; i++) {
    const tmp = Math.abs(mtx[i][i]);
    if (tmp < min) min = tmp;
    if (tmp > max) max = tmp;
  }
  return min / max < 1e-10;
}

function bidirectionalFilter(mtx: Mtx, idx: number[], vec: Vec): void {
  for (let i = 1, x = 0; i <= 2; i++) {
    const index = idx[i];
    let tmp = vec[index];
    vec[index] = vec[i];
    if (x !== 0) for (let y = x; y <= i - 1; y++) tmp -= vec[y] * mtx[i][y];
    else if (tmp !== 0) x = i;
    vec[i] = tmp;
  }
  for (let i = 2; i > 0; i--) {
    let tmp = vec[i];
    for (let y = i + 1; y <= 2; y++) tmp -= vec[y] * mtx[i][y];
    vec[i] = tmp / mtx[i][i];
  }
  vec[0] = 1;
}

function quadraticMerge(vec: Vec): boolean {
  const v2 = vec[2];
  const tmp = 1 - v2 * v2;
  if (tmp === 0) return true;
  const v0 = (vec[0] - v2 * v2) / tmp;
  const v1 = (vec[1] - vec[1] * v2) / tmp;
  vec[0] = v0;
  vec[1] = v1;
  return Math.abs(v1) > 1;
}

function finishRecord(input: Vec, out: Vec): void {
  for (let z = 1; z <= 2; z++) {
    if (input[z] >= 1) input[z] = 0.9999999999;
    else if (input[z] <= -1) input[z] = -0.9999999999;
  }
  out[0] = 1;
  out[1] = input[2] * input[1] + input[1];
  out[2] = input[2];
}

function matrixFilter(src: Vec, dst: Vec): void {
  const mtx = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  mtx[2][0] = 1;
  for (let i = 1; i <= 2; i++) mtx[2][i] = -src[i];
  for (let i = 2; i > 0; i--) {
    const val = 1 - mtx[i][i] * mtx[i][i];
    for (let y = 1; y <= i; y++) mtx[i - 1][y] = (mtx[i][i] * mtx[i][y] + mtx[i][y]) / val;
  }
  dst[0] = 1;
  for (let i = 1; i <= 2; i++) {
    dst[i] = 0;
    for (let y = 1; y <= i; y++) dst[i] += mtx[i][y] * dst[i - y];
  }
}

function mergeFinishRecord(src: Vec, dst: Vec): void {
  const tmp = [0, 0, 0];
  let val = src[0];
  dst[0] = 1;
  for (let i = 1; i <= 2; i++) {
    let v2 = 0;
    for (let y = 1; y < i; y++) v2 += dst[y] * src[i - y];
    dst[i] = val > 0 ? -(v2 + src[i]) / val : 0;
    tmp[i] = dst[i];
    for (let y = 1; y < i; y++) dst[y] += dst[i] * dst[i - y];
    val *= 1 - dst[i] * dst[i];
  }
  finishRecord(tmp, dst);
}

function contrastVectors(a: Vec, b: Vec): number {
  const val = (b[2] * b[1] + -b[1]) / (1 - b[2] * b[2]);
  const val1 = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  const val2 = a[0] * a[1] + a[1] * a[2];
  const val3 = a[0] * a[2];
  return val1 + 2 * val * val2 + 2 * (-b[1] * val + -b[2]) * val3;
}

function filterRecords(best: Mtx, exp: number, records: Vec[], count: number): void {
  const sums = Array.from({ length: 8 }, () => [0, 0, 0]);
  const counts = new Int32Array(8);
  const buf = [0, 0, 0];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < exp; y++) {
      counts[y] = 0;
      sums[y][0] = sums[y][1] = sums[y][2] = 0;
    }
    for (let z = 0; z < count; z++) {
      let index = 0, value = 1e30;
      for (let i = 0; i < exp; i++) {
        const v = contrastVectors(best[i], records[z]);
        if (v < value) {
          value = v;
          index = i;
        }
      }
      counts[index]++;
      matrixFilter(records[z], buf);
      for (let i = 0; i <= 2; i++) sums[index][i] += buf[i];
    }
    for (let i = 0; i < exp; i++) if (counts[i] > 0) for (let y = 0; y <= 2; y++) sums[i][y] /= counts[i];
    for (let i = 0; i < exp; i++) mergeFinishRecord(sums[i], best[i]);
  }
}

// Eight predictor pairs for one channel, as Int16Array(16).
export function coefficients(pcm: Int16Array): Int16Array {
  const samples = pcm.length;
  const block = new Int16Array(SAMPLES_PER_BLOCK);
  const hist = new Int16Array(28); // previous frame, then current frame
  const vec1 = [0, 0, 0], vec2 = [0, 0, 0];
  const mtx = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const idx = [0, 0, 0];
  const records: Vec[] = [];
  let read = 0;
  for (let x = samples; x > 0; ) {
    let frameSamples: number;
    if (x > SAMPLES_PER_BLOCK) {
      frameSamples = SAMPLES_PER_BLOCK;
      x -= SAMPLES_PER_BLOCK;
    } else {
      frameSamples = x;
      for (let z = 0; z < 14 && z + frameSamples < SAMPLES_PER_BLOCK; z++) block[frameSamples + z] = 0;
      x = 0;
    }
    block.set(pcm.subarray(read, read + frameSamples));
    read += frameSamples;
    for (let i = 0; i < frameSamples; ) {
      hist.copyWithin(0, 14, 28);
      for (let z = 0; z < 14; z++) hist[14 + z] = block[i++];
      innerProductMerge(vec1, hist);
      if (Math.abs(vec1[0]) > 10) {
        outerProductMerge(mtx, hist);
        if (!analyzeRanges(mtx, idx)) {
          bidirectionalFilter(mtx, idx, vec1);
          if (!quadraticMerge(vec1)) {
            const record = [0, 0, 0];
            finishRecord(vec1, record);
            records.push(record);
          }
        }
      }
    }
  }
  const best = Array.from({ length: 8 }, () => [0, 0, 0]);
  vec1[0] = 1;
  vec1[1] = 0;
  vec1[2] = 0;
  for (const record of records) {
    matrixFilter(record, best[0]);
    for (let y = 1; y <= 2; y++) vec1[y] += best[0][y];
  }
  for (let y = 1; y <= 2; y++) vec1[y] /= records.length;
  mergeFinishRecord(vec1, best[0]);
  let exp = 1;
  for (let w = 0; w < 3; ) {
    vec2[0] = 0;
    vec2[1] = -1;
    vec2[2] = 0;
    for (let i = 0; i < exp; i++) for (let y = 0; y <= 2; y++) best[exp + i][y] = 0.01 * vec2[y] + best[i][y];
    ++w;
    exp = 1 << w;
    filterRecords(best, exp, records, records.length);
  }
  const out = new Int16Array(16);
  const toShort = (d: number): number => (d > 0 ? (d > 32767 ? 32767 : Math.round(d)) : d < -32768 ? -32768 : -Math.round(-d)); // lround: half away from zero
  for (let z = 0; z < 8; z++) {
    out[z * 2] = toShort(-best[z][1] * 2048);
    out[z * 2 + 1] = toShort(-best[z][2] * 2048);
  }
  return out;
}

// ---------- frames ----------
// Matches VGAudio's DspEncodeCoef, including its float rounding and 32-bit integer wrap, so files come out the same.
const HALF = Math.fround(0.4999999);
const clamp16 = (v: number): number => (v >= 32767 ? 32767 : v <= -32768 ? -32768 : v);
const clamp4 = (v: number): number => (v > 7 ? 7 : v < -8 ? -8 : v);

// buf: Int16Array(16), [hist2, hist1, 14 samples (zero past the end)]; on return holds the decoded samples.
// Writes 8 bytes at out[o].
function encodeFrame(buf: Int16Array, coefs: Int16Array, out: Uint8Array, o: number, work: EncodeWork): void {
  const { pcmOut, adpcmOut, scale, dist } = work;
  for (let i = 0; i < 8; i++) {
    const c0 = coefs[i * 2], c1 = coefs[i * 2 + 1];
    const po = pcmOut[i], ao = adpcmOut[i];
    po[0] = buf[0];
    po[1] = buf[1];
    let maxDistance = 0;
    for (let s = 0; s < 14; s++) {
      const predicted = ((Math.imul(buf[s], c1) + Math.imul(buf[s + 1], c0)) | 0) / 2048 | 0;
      const distance = clamp16((buf[s + 2] - predicted) | 0);
      if (Math.abs(distance) > Math.abs(maxDistance)) maxDistance = distance;
    }
    let sp = 0;
    while (sp <= 12 && (maxDistance > 7 || maxDistance < -8)) {
      maxDistance = (maxDistance / 2) | 0;
      sp++;
    }
    sp = sp <= 1 ? -1 : sp - 2;
    let maxOverflow: number;
    do {
      sp++;
      const sc = Math.imul(1 << sp, 2048);
      dist[i] = 0;
      maxOverflow = 0;
      for (let s = 0; s < 14; s++) {
        const input = Math.imul(buf[s + 2], 2048);
        const predicted = (Math.imul(po[s], c1) + Math.imul(po[s + 1], c0)) | 0;
        const distance = (input - predicted) | 0;
        const q = Math.fround(distance / sc);
        const unclamped = distance > 0 ? Math.trunc(q + HALF) : Math.trunc(q - HALF);
        const sample = clamp4(unclamped);
        if (sample !== unclamped) maxOverflow = Math.max(maxOverflow, Math.abs(unclamped - sample));
        ao[s] = sample;
        const corrected = (predicted + Math.imul(sample, sc)) | 0;
        po[s + 2] = clamp16((corrected + 1024) >> 11);
        const d = buf[s + 2] - po[s + 2];
        dist[i] += d * d;
      }
      for (let x = maxOverflow + 8; x > 256; x >>= 1) if (++sp >= 12) sp = 11;
    } while (sp < 12 && maxOverflow > 1);
    scale[i] = sp;
  }
  let best = 0, min = Infinity;
  for (let i = 0; i < 8; i++)
    if (dist[i] < min) {
      min = dist[i];
      best = i;
    }
  for (let s = 0; s < 14; s++) buf[s + 2] = pcmOut[best][s + 2];
  out[o] = ((best & 0xf) << 4) | (scale[best] & 0xf);
  for (let y = 0; y < 7; y++) out[o + 1 + y] = ((adpcmOut[best][y * 2] & 0xf) << 4) | (adpcmOut[best][y * 2 + 1] & 0xf);
}

const bytesFor = (samples: number): number => Math.floor(samples / 14) * 8 + (samples % 14 ? 1 + Math.ceil((samples % 14) / 2) : 0);

/** Encodes PCM frame by frame from the given history. `decoded` is what the game will play back. */
function encodeFrames(pcm: Int16Array, coefs: Int16Array, hist1 = 0, hist2 = 0): { data: Uint8Array; decoded: Int16Array } {
  const n = pcm.length;
  const data = new Uint8Array(Math.ceil(n / 14) * 8); // the last frame is encoded whole, then cut to its samples
  const decoded = new Int16Array(n);
  const buf = new Int16Array(16);
  buf[0] = hist2;
  buf[1] = hist1;
  const work: EncodeWork = {
    pcmOut: Array.from({ length: 8 }, () => new Int32Array(16)),
    adpcmOut: Array.from({ length: 8 }, () => new Int32Array(14)),
    scale: new Int32Array(8),
    dist: new Float64Array(8),
  };
  for (let start = 0, o = 0; start < n; start += 14, o += 8) {
    const count = Math.min(14, n - start);
    for (let s = 0; s < 14; s++) buf[s + 2] = s < count ? pcm[start + s] : 0;
    encodeFrame(buf, coefs, data, o, work);
    decoded.set(buf.subarray(2, 2 + count), start);
    buf[0] = buf[14];
    buf[1] = buf[15];
  }
  return { data: data.subarray(0, bytesFor(n)), decoded };
}

export interface ChannelOutput extends EncodedChannel {
  /** The loop start after alignment, and the channel's length after it. */
  loopStart: number;
  samples: number;
  loopPs: number;
  loopHist1: number;
  loopHist2: number;
}

/**
 * One channel, looping from `loopStart` to its end. A loop start off a block boundary is moved to the next block and
 * the audio it skips is copied onto the end, so it plays the same; that part is re-encoded from the decoded audio with
 * the same coefficients. This is VGAudio's GcAdpcmAlignment step for step, so files still match it byte for byte.
 */
export function encodeChannel(pcm: Int16Array, loopStart = 0): ChannelOutput {
  const coefs = coefficients(pcm);
  let { data, decoded } = encodeFrames(pcm, coefs);
  // VGAudio takes the loop context at the requested loop start, from the first encode.
  const loopPs = data[Math.floor(loopStart / 14) * 8] ?? 0;
  const loopHist1 = loopStart > 0 ? decoded[loopStart - 1] : 0;
  const loopHist2 = loopStart > 1 ? decoded[loopStart - 2] : 0;
  let start = loopStart;
  if (loopStart % SAMPLES_PER_BLOCK !== 0) {
    const loopEnd = pcm.length;
    const loopLength = loopEnd - loopStart;
    start = Math.ceil(loopStart / SAMPLES_PER_BLOCK) * SAMPLES_PER_BLOCK;
    const total = loopEnd + (start - loopStart);
    const keepFrames = Math.floor(loopEnd / 14);
    const keepSamples = keepFrames * 14;
    const fresh = new Int16Array(total - keepSamples);
    fresh.set(decoded.subarray(keepSamples, loopEnd));
    for (let at = loopEnd - keepSamples; at < fresh.length; at += loopLength)
      fresh.set(decoded.subarray(loopStart, loopStart + Math.min(loopLength, fresh.length - at)), at);
    const again = encodeFrames(fresh, coefs, keepSamples > 0 ? decoded[keepSamples - 1] : 0, keepSamples > 1 ? decoded[keepSamples - 2] : 0);
    const alignedData = new Uint8Array(bytesFor(total));
    alignedData.set(data.subarray(0, keepFrames * 8));
    alignedData.set(again.data, keepFrames * 8);
    const alignedPcm = new Int16Array(total);
    alignedPcm.set(decoded.subarray(0, keepSamples));
    alignedPcm.set(again.decoded, keepSamples);
    data = alignedData;
    decoded = alignedPcm;
  }
  const n = decoded.length;
  const blocks = Math.ceil(n / SAMPLES_PER_BLOCK);
  const seek = new Int16Array(blocks * 2);
  const at = (i: number): number => (i >= 0 ? decoded[i] : 0);
  for (let b = 0; b < blocks; b++) {
    seek[b * 2] = at(b * SAMPLES_PER_BLOCK - 1);
    seek[b * 2 + 1] = at(b * SAMPLES_PER_BLOCK - 2);
  }
  return {
    coefs, data, ps: data[0], seek,
    loopStart: start, samples: n,
    loopPs, loopHist1, loopHist2,
  };
}

// ---------- the file ----------
// channels: Int16Array per channel, all the same length. Loops the whole song from the start.
// onProgress(channelsDone, channels) lets a caller report progress.
/** `channels` end at the loop end; the song loops from `loopStart` (a sample) to its end. */
export function writeBrstm(
  channels: Int16Array[],
  rate: number,
  loop = true,
  onProgress?: (done: number, total: number) => void,
  requestedLoopStart = 0,
): Uint8Array {
  const count = channels.length;
  const encoded: ChannelOutput[] = [];
  for (const pcm of channels) {
    encoded.push(encodeChannel(pcm, loop ? requestedLoopStart : 0));
    onProgress?.(encoded.length, count);
  }
  const { samples, loopStart } = encoded[0];
  const blocks = Math.ceil(samples / SAMPLES_PER_BLOCK);
  const lastSamples = samples - (blocks - 1) * SAMPLES_PER_BLOCK;
  const lastSize = bytesFor(lastSamples);
  const lastPadded = Math.ceil(lastSize / 0x20) * 0x20;
  const align = (v: number): number => Math.ceil(v / 0x20) * 0x20;

  // HEAD: three parts, then a reference and DSP context per channel.
  const part1 = 0x18, part2 = part1 + 0x34, track = part2 + 0x0c, part3 = track + 0x0c;
  const chanRefs = part3 + 4;
  const chanInfo = chanRefs + count * 8; // each: ref (8) + context (0x30)
  const headSize = align(8 + chanInfo + count * 0x38);
  const adpcSize = align(8 + blocks * count * 4);
  const dataSize = 0x20 + (blocks - 1) * count * BLOCK_SIZE + count * lastPadded;
  const headAt = 0x40, adpcAt = headAt + headSize, dataAt = adpcAt + adpcSize;
  const total = dataAt + dataSize;

  const bytes = new Uint8Array(total);
  const v = new DataView(bytes.buffer);
  const ascii = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
  };

  ascii(0, 'RSTM');
  v.setUint16(4, 0xfeff);
  v.setUint16(6, 0x0100);
  v.setUint32(8, total);
  v.setUint16(0x0c, 0x40);
  v.setUint16(0x0e, 2);
  v.setUint32(0x10, headAt);
  v.setUint32(0x14, headSize);
  v.setUint32(0x18, adpcAt);
  v.setUint32(0x1c, adpcSize);
  v.setUint32(0x20, dataAt);
  v.setUint32(0x24, dataSize);

  const h = headAt + 8; // HEAD offsets count from here
  ascii(headAt, 'HEAD');
  v.setUint32(headAt + 4, headSize);
  [part1, part2, part3].forEach((at, i) => {
    v.setUint32(h + i * 8, 0x01000000);
    v.setUint32(h + i * 8 + 4, at);
  });
  let p = h + part1;
  bytes[p] = 2; // DSP-ADPCM
  bytes[p + 1] = loop ? 1 : 0;
  bytes[p + 2] = count;
  v.setUint16(p + 4, rate);
  v.setUint32(p + 8, loopStart);
  v.setUint32(p + 0x0c, samples);
  v.setUint32(p + 0x10, dataAt + 0x20);
  v.setUint32(p + 0x14, blocks);
  v.setUint32(p + 0x18, BLOCK_SIZE);
  v.setUint32(p + 0x1c, SAMPLES_PER_BLOCK);
  v.setUint32(p + 0x20, lastSize);
  v.setUint32(p + 0x24, lastSamples);
  v.setUint32(p + 0x28, lastPadded);
  v.setUint32(p + 0x2c, SAMPLES_PER_BLOCK);
  v.setUint32(p + 0x30, 4);
  // One track: volume 0x7f, pan centre, its first two channels.
  p = h + part2;
  bytes[p] = 1;
  bytes[p + 1] = 1;
  v.setUint32(p + 4, 0x01010000);
  v.setUint32(p + 8, track);
  p = h + track;
  bytes[p] = 0x7f;
  bytes[p + 1] = 0x40;
  bytes[p + 8] = Math.min(count, 2);
  bytes[p + 9] = 0;
  bytes[p + 10] = count > 1 ? 1 : 0;
  p = h + part3;
  bytes[p] = count;
  encoded.forEach((ch, c) => {
    const info = chanInfo + c * 0x38;
    v.setUint32(h + chanRefs + c * 8, 0x01000000);
    v.setUint32(h + chanRefs + c * 8 + 4, info);
    v.setUint32(h + info, 0x01000000);
    v.setUint32(h + info + 4, info + 8);
    const ctx = h + info + 8;
    for (let i = 0; i < 16; i++) v.setInt16(ctx + i * 2, ch.coefs[i]);
    v.setUint16(ctx + 0x22, ch.ps);
    v.setUint16(ctx + 0x28, ch.loopPs);
    v.setInt16(ctx + 0x2a, ch.loopHist1);
    v.setInt16(ctx + 0x2c, ch.loopHist2);
  });

  ascii(adpcAt, 'ADPC');
  v.setUint32(adpcAt + 4, adpcSize);
  for (let b = 0; b < blocks; b++)
    encoded.forEach((ch, c) => {
      const at = adpcAt + 8 + (b * count + c) * 4;
      v.setInt16(at, ch.seek[b * 2]);
      v.setInt16(at + 2, ch.seek[b * 2 + 1]);
    });

  ascii(dataAt, 'DATA');
  v.setUint32(dataAt + 4, dataSize);
  v.setUint32(dataAt + 8, 0x18);
  let o = dataAt + 0x20;
  for (let b = 0; b < blocks; b++) {
    const last = b === blocks - 1;
    for (const ch of encoded) {
      bytes.set(ch.data.subarray(b * BLOCK_SIZE, last ? b * BLOCK_SIZE + lastSize : (b + 1) * BLOCK_SIZE), o);
      o += last ? lastPadded : BLOCK_SIZE;
    }
  }
  return bytes;
}

/** The same file played back at another rate: Retro Rewind's final lap files are the song with a faster header rate. */
export function withSampleRate(brstm: Uint8Array, rate: number): Uint8Array {
  const copy = brstm.slice();
  new DataView(copy.buffer).setUint16(0x40 + 8 + 0x18 + 4, rate);
  return copy;
}
