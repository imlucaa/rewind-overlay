// Sample work for the encoder: keep-pitch speed changes and volume. Pure functions, run in the worker.

/**
 * WSOLA time stretch: the same pitch, `1 / speed` as long. Each 1024-sample window (32 ms at 32 kHz) is placed where
 * it best lines up with the audio already written, which avoids the phasing and clicks of a plain overlap-add.
 */
export function stretch(channels: readonly Float32Array[], speed: number): Float32Array[] {
  const N = 1024;
  const H = N / 2;
  const SEARCH = 256;
  const len = channels[0].length;
  if (len < N * 2) return channels.map(ch => ch.slice(0, Math.max(1, Math.floor(len / speed))));
  const outLen = Math.max(1, Math.floor(len / speed));
  // Periodic Hann: two windows half a window apart add up to exactly 1.
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i];
  const out = channels.map(() => new Float32Array(outLen + N));
  let previous = 0;
  for (let at = 0; at < outLen; at += H) {
    const ideal = Math.min(Math.round(at * speed), len - N);
    let pick = ideal;
    if (at > 0) {
      // The natural continuation of the last window; find the spot near `ideal` that sounds most like it.
      const target = Math.min(previous + H, len - H);
      let best = -Infinity;
      for (let k = Math.max(0, ideal - SEARCH); k <= Math.min(len - N, ideal + SEARCH); k += 2) {
        let sum = 0;
        for (let i = 0; i < H; i += 4) sum += mono[target + i] * mono[k + i];
        if (sum > best) {
          best = sum;
          pick = k;
        }
      }
    }
    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const dst = out[c];
      for (let i = 0; i < N; i++) dst[at + i] += src[pick + i] * win[i];
    }
    previous = pick;
  }
  // The first half window has no partner before it: undo its fade-in.
  for (const ch of out) for (let i = 1; i < H; i++) ch[i] /= win[i];
  return out.map(ch => ch.slice(0, outLen));
}

/** Gain in dB, turned down as a whole if that would clip, as 16-bit stereo (mono is copied to both sides). */
export function toPcm16(channels: readonly Float32Array[], gainDb: number): Int16Array[] {
  let gain = Math.pow(10, gainDb / 20);
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak * gain > 1) gain = 1 / peak;
  const stereo = channels.length === 1 ? [channels[0], channels[0]] : channels.slice(0, 2);
  return stereo.map(ch => {
    const pcm = new Int16Array(ch.length);
    for (let i = 0; i < ch.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * gain * 32767)));
    return pcm;
  });
}
