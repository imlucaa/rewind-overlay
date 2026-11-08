// Finds a seamless loop: the longest stretch of music that plays again later, unchanged. A port of Music Pack
// Maker's LoopFinder.Find (same author): spectral match to find the repeat, waveform match to place it to the sample.

const ANALYSIS_RATE = 8000;
const WINDOW = 2048;
const HOP = 512;
const BANDS = 24;
const MIN_LOOP_SECONDS = 20;
const MIN_REPEAT_SECONDS = 12;
const SMOOTH_SECONDS = 1;
const MATCH_LEVEL = 0.7;
const ALLOWED_GAP_SECONDS = 2;
const LONGER_LOOP_BONUS = 0.25;
const START_MARGIN_SECONDS = 0.25;
const WALK_STEP_SECONDS = 0.5;
const CHECK_SECONDS = 4;
const MIN_WAVE_MATCH = 0.8;
const CANDIDATE_GAP_SECONDS = 1;
const MAX_CANDIDATES = 12;

export interface FoundLoop {
  /** Samples, at the rate the audio was given in. The loop plays start..end, then jumps back to start. */
  start: number;
  end: number;
  /** How well the waveform lines up at the jump, 0–1. */
  score: number;
}

/** The best loop, or null when the song has no clear repeat. */
export function findLoop(mono: Float32Array, rate: number): FoundLoop | null {
  return findLoops(mono, rate, 1)[0] ?? null;
}

/** Up to `max` different loops, best first. */
export function findLoops(mono: Float32Array, rate: number, max = 5): FoundLoop[] {
  const found: FoundLoop[] = [];
  const low = decimate(mono, rate);
  if (low.length < WINDOW * 4) return found;
  const frames = features(low);
  const framesPerSecond = ANALYSIS_RATE / HOP;
  const minLag = Math.floor(MIN_LOOP_SECONDS * framesPerSecond);
  const minRun = Math.floor(MIN_REPEAT_SECONDS * framesPerSecond);
  const smooth = Math.floor(SMOOTH_SECONDS * framesPerSecond);
  if (frames.length < minLag + minRun + smooth) return found;

  // For every possible loop length, the longest stretch that repeats at that distance.
  const lagCount = frames.length - minRun - smooth - minLag;
  if (lagCount <= 0) return found;
  const runs = Array.from({ length: lagCount }, (_, offset) => longestRepeat(frames, minLag + offset, smooth, MATCH_LEVEL));
  const candidates = [...runs.keys()]
    .filter(offset => runs[offset].length >= minRun)
    .sort((a, b) => runs[b].length + LONGER_LOOP_BONUS * (minLag + b) - (runs[a].length + LONGER_LOOP_BONUS * (minLag + a)));

  // The spectrum only says the music looks alike. The waveform must line up too, or the jump would be heard.
  const samplesPerFrame = HOP * (rate / ANALYSIS_RATE);
  const minimumGap = Math.floor(CANDIDATE_GAP_SECONDS * framesPerSecond);
  const tried: number[] = [];
  for (const offset of candidates) {
    if (tried.length === MAX_CANDIDATES || found.length === max) break;
    if (tried.some(other => Math.abs(other - offset) < minimumGap)) continue;
    tried.push(offset);

    // Tune the length in the middle of the run, the part most surely inside the repeat.
    const middle = Math.floor((runs[offset].start + runs[offset].length / 2) * samplesPerFrame);
    const lag = refine(mono, middle, Math.floor((minLag + offset) * samplesPerFrame), rate, Math.floor(samplesPerFrame) + 16);
    if (middle + lag + CHECK_SECONDS * rate >= mono.length) continue;
    const match = waveMatch(mono, middle, middle + lag, Math.floor(CHECK_SECONDS * rate));
    if (match < MIN_WAVE_MATCH) continue;

    // Walk back on the waveform to where the repeat begins, so the loop keeps as much music as it can.
    const step = Math.floor(WALK_STEP_SECONDS * rate);
    let start = middle;
    while (start - step >= 0 && waveMatch(mono, start - step, start - step + lag, step) >= MIN_WAVE_MATCH) start -= step;
    // The last step passed with most of it matching, so its first moments may be from before the repeat.
    start = Math.min(middle, start + Math.floor(START_MARGIN_SECONDS * rate));
    // Two runs can walk back to the same loop; keep the first.
    if (found.some(f => Math.abs(f.start - start) < rate && Math.abs(f.end - (start + lag)) < rate)) continue;
    found.push({ start, end: start + lag, score: match });
  }
  return found;
}

/**
 * Moves the loop end (samples) to the nearby spot, within `rangeSeconds`, where the waveform after it best matches
 * the waveform after the start, so the jump back lands in step. Returns the new end and how well it lines up, 0–1.
 */
export function snapLoopEnd(mono: Float32Array, rate: number, start: number, end: number, rangeSeconds = 0.05): { end: number; score: number } {
  const range = Math.floor(rangeSeconds * rate);
  // Compare the second after each point (the music the jump lands in); near the song's end, the second before.
  const forward = end + range + rate <= mono.length;
  const window = forward ? Math.min(rate, end - range - start) : Math.min(rate, start, end - range - start);
  if (window < rate / 10) return { end, score: 0 };
  const from = (p: number) => (forward ? p : p - window);
  let best = end;
  let bestScore = -Infinity;
  for (let candidate = Math.max(start + window, end - range); candidate <= Math.min(end + range, mono.length - (forward ? window : 0)); candidate++) {
    let score = 0;
    const a = from(start), b = from(candidate);
    for (let i = 0; i < window; i += 2) score += mono[a + i] * mono[b + i];
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return { end: best, score: Math.max(0, waveMatch(mono, from(start), from(best), window)) };
}

function longestRepeat(frames: Float32Array[], lag: number, smooth: number, level: number): { length: number; start: number } {
  const count = frames.length - lag;
  const sums = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) sums[i + 1] = sums[i] + dot(frames[i], frames[i + lag]);
  let bestLength = 0, bestStart = 0, runStart = -1, lastMatch = -1;
  const allowedGap = Math.floor((ALLOWED_GAP_SECONDS * ANALYSIS_RATE) / HOP);
  const need = level * smooth;
  for (let i = 0; i + smooth <= count; i++) {
    if (sums[i + smooth] - sums[i] < need) continue;
    // Quiet moments match badly, so a short gap does not end the run.
    if (runStart < 0 || i - lastMatch > allowedGap) runStart = i;
    lastMatch = i;
    if (i - runStart + 1 > bestLength) {
      bestLength = i - runStart + 1;
      bestStart = runStart;
    }
  }
  return { length: bestLength, start: bestStart };
}

/** Fine tunes the loop length to the sample using the waveform. */
function refine(mono: Float32Array, start: number, lag: number, rate: number, range: number): number {
  const window = rate;
  let best = lag;
  let bestScore = -Infinity;
  for (let candidate = lag - range; candidate <= lag + range; candidate++) {
    if (start + candidate + window >= mono.length) continue;
    let score = 0;
    for (let i = 0; i < window; i += 2) score += mono[start + i] * mono[start + candidate + i];
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function waveMatch(mono: Float32Array, a: number, b: number, length: number): number {
  length = Math.min(length, mono.length - b);
  let both = 0, first = 0, second = 0;
  for (let i = 0; i < length; i++) {
    both += mono[a + i] * mono[b + i];
    first += mono[a + i] * mono[a + i];
    second += mono[b + i] * mono[b + i];
  }
  return first <= 0 || second <= 0 ? 0 : both / Math.sqrt(first * second);
}

function decimate(input: Float32Array, rate: number): Float32Array {
  const step = rate / ANALYSIS_RATE;
  const output = new Float32Array(Math.floor(input.length / step));
  const span = Math.max(1, Math.floor(step));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(start + span, input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = sum / span;
  }
  return output;
}

function features(audio: Float32Array): Float32Array[] {
  const count = Math.floor((audio.length - WINDOW) / HOP);
  const window = new Float64Array(WINDOW).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW));
  // Which band each FFT bin adds to, on a log scale.
  const bandOf = new Int32Array(WINDOW / 2).map((_, bin) =>
    bin === 0 ? -1 : Math.min(BANDS - 1, Math.floor((Math.log(bin) / Math.log(WINDOW / 2)) * BANDS)),
  );
  const re = new Float64Array(WINDOW);
  const im = new Float64Array(WINDOW);
  const frames: Float32Array[] = [];
  for (let f = 0; f < count; f++) {
    for (let i = 0; i < WINDOW; i++) {
      re[i] = audio[f * HOP + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const bands = new Float32Array(BANDS);
    for (let bin = 1; bin < WINDOW / 2; bin++) bands[bandOf[bin]] += Math.hypot(re[bin], im[bin]);
    for (let b = 0; b < BANDS; b++) bands[b] = Math.log(1 + bands[b] * 50);
    frames.push(bands);
  }
  // Remove each band's average, so a steady sound does not count as a match, then scale every frame to length 1.
  for (let b = 0; b < BANDS; b++) {
    let mean = 0;
    for (const frame of frames) mean += frame[b];
    mean /= frames.length;
    let spread = 0;
    for (const frame of frames) spread += (frame[b] - mean) ** 2;
    spread = Math.sqrt(spread / frames.length);
    for (const frame of frames) frame[b] = spread < 1e-4 ? 0 : (frame[b] - mean) / spread;
  }
  for (const frame of frames) {
    let norm = 0;
    for (let b = 0; b < BANDS; b++) norm += frame[b] * frame[b];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let b = 0; b < BANDS; b++) frame[b] /= norm;
  }
  return frames;
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepRe = Math.cos(angle), stepIm = Math.sin(angle);
    for (let i = 0; i < n; i += size) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < size / 2; j++) {
        const a = i + j, b = a + size / 2;
        const oddRe = re[b] * wRe - im[b] * wIm;
        const oddIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - oddRe;
        im[b] = im[a] - oddIm;
        re[a] += oddRe;
        im[a] += oddIm;
        const t = wRe * stepRe - wIm * stepIm;
        wIm = wRe * stepIm + wIm * stepRe;
        wRe = t;
      }
    }
  }
}

/**
 * Blends the end of the loop into its start, so the jump has no hard cut. Used when a keep-pitch speed change has
 * reshaped the waveform. Returns the new loop start (it moves past the audio blended in).
 */
export function crossfadeLoop(channels: Float32Array[], start: number, end: number, fade: number): number {
  fade = Math.min(fade, Math.floor((end - start) / 3));
  if (fade < 2) return start;
  for (const ch of channels)
    for (let i = 0; i < fade; i++) {
      const position = ((i + 0.5) / fade) * (Math.PI / 2);
      ch[end - fade + i] = ch[end - fade + i] * Math.cos(position) + ch[start + i] * Math.sin(position);
    }
  return start + fade;
}
