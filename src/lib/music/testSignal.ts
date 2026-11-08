// A deterministic stereo test signal for the encoder tests: tones, noise and a clipped square wave,
// 30001 samples so it spans three blocks and ends mid-frame.
export function testSignal(length = 30001): Int16Array[] {
  const left = new Int16Array(length);
  const right = new Int16Array(length);
  let seed = 12345;
  const noise = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
  for (let i = 0; i < length; i++) {
    const t = i / 32000;
    left[i] = Math.round(12000 * Math.sin(2 * Math.PI * 440 * t) + 6000 * Math.sin(2 * Math.PI * 1234 * t) + 3000 * noise());
    right[i] = i > 20000 ? (Math.floor(i / 40) % 2 ? 32767 : -32768) : Math.round(20000 * noise());
  }
  return [left, right];
}
