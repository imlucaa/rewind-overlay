// How loud a song sounds, for "Even out loudness". Roughly the way loudness meters do it (EBU R128 gating, without
// the K-weighting filter): the average power of 400 ms blocks, leaving out silence and quiet stretches so a long
// fade or a gap doesn't make a song look quieter than it plays.

const BLOCK_SECONDS = 0.4;
const SILENCE_DB = -70;
/** Blocks this far below the song's average are its quiet stretches, and don't count. */
const RELATIVE_DB = -10;

const toDb = (power: number): number => 10 * Math.log10(power);

/** The song's loudness in dB (full-scale sine: about -3). -Infinity for silence. */
export function loudnessDb(mono: Float32Array, rate: number): number {
  const size = Math.max(1, Math.round(BLOCK_SECONDS * rate));
  const blocks: number[] = [];
  for (let start = 0; start < mono.length; start += size) {
    const end = Math.min(mono.length, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) sum += mono[i] * mono[i];
    blocks.push(sum / (end - start));
  }
  const loud = blocks.filter(p => p > 0 && toDb(p) > SILENCE_DB);
  if (!loud.length) return -Infinity;
  const average = loud.reduce((a, b) => a + b, 0) / loud.length;
  const kept = loud.filter(p => toDb(p) > toDb(average) + RELATIVE_DB);
  return toDb(kept.reduce((a, b) => a + b, 0) / kept.length);
}

/**
 * The volume for each song so they all sound as loud as the middle one: the fewest songs move, and nothing is
 * boosted past the slider's +12 dB.
 */
export function evenVolumes(levels: ReadonlyMap<string, number>): Map<string, number> {
  const known = [...levels].filter(([, db]) => Number.isFinite(db));
  const sorted = known.map(([, db]) => db).sort((a, b) => a - b);
  const target = sorted[Math.floor(sorted.length / 2)];
  return new Map(known.map(([id, db]) => [id, Math.max(-12, Math.min(12, Math.round(target - db)))]));
}
