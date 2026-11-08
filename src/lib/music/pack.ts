// What a music pack contains, decided before any audio is touched: which songs to encode (once per song and
// settings, however many tracks share them), the files each one becomes, and what's wrong first.
//
// How Retro Rewind loads music (Pulsar engine, Retro Rewind 6.13.4; see tracks.ts):
// - Each track plays <file>.brstm. Files in RetroRewind6/Patches replace the game's own when Retro Rewind's
//   "Loose Archive Overrides" setting is on (the default). SD:/RetroRewind6/Patches on a Wii;
//   <Dolphin>/Load/Riivolution/[WheelWizard/]RetroRewind6/Patches in Dolphin.
// - On the final lap it plays the track's _Final/_F file if one exists, and otherwise plays the normal file
//   6% faster. Where Retro Rewind ships its own final lap file, the pack writes one too (the same audio with a 6%
//   faster sample rate in its header, which is exactly what the game would have done), or the old song would
//   come back on the last lap.
// - The game has no playback speed setting for music, so speed is baked into the audio.
import type { SongInfo } from './library.ts';
import { isGameMusic, type Track } from './tracks.ts';

export const SAMPLE_RATE = 32000;
/** The game plays final laps this much faster (and higher), by raising the playback rate. */
export const FINAL_LAP_SPEED = 1.06;
/** The Wii plays 16-bit audio up to 44100 Hz. */
export const MAX_WII_RATE = 44100;
export const FINAL_SPEED_CHOICES: readonly (readonly [number, string])[] = [
  [FINAL_LAP_SPEED, 'A little faster, like the game (1.06x)'],
  [1, 'Same speed'],
  [1.1, 'Faster (1.10x)'],
  [1.15, 'Faster (1.15x)'],
  [1.2, 'Much faster (1.20x)'],
  [1.25, 'Much faster (1.25x)'],
];
export const MIN_SPEED = 0.5;
export const MAX_SPEED = 2;
/** Longer songs are a lot for the Wii to hold in memory; Music Pack Maker warns at the same length. */
export const LONG_SONG_SECONDS = 10 * 60;
export const PATCHES_FOLDER = 'RetroRewind6/Patches';

export interface Assignment {
  songId: string;
  /** 0.5–2. 1 is normal. */
  speed: number;
  /** Keep the pitch when the speed changes (time stretch); otherwise pitch moves with speed, like a record. */
  keepPitch: boolean;
  /** -12 to +12 dB, baked into the audio. */
  volumeDb: number;
  /** Where the song loops, in seconds of the original song; null loops the whole song. */
  loop: LoopPoints | null;
  /** How much faster the final lap plays (speed and pitch together, as the game does). */
  finalSpeed: number;
  /** Set by the plan for short jingles: the file plays once and stops. */
  playsOnce?: boolean;
  /**
   * A different song for the final lap, or null for the same song. It gets this assignment's speed, pitch and volume,
   * loops whole, and plays at the final lap speed.
   */
  finalSongId: string | null;
}

export interface LoopPoints {
  start: number;
  end: number;
}

/** By track file. */
export type Assignments = Record<string, Assignment>;

export const newAssignment = (songId: string): Assignment => ({
  songId, speed: 1, keepPitch: true, volumeDb: 0, loop: null, finalSpeed: FINAL_LAP_SPEED, finalSongId: null,
});

export const clampSpeed = (speed: number): number =>
  Number.isFinite(speed) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(speed * 100) / 100)) : 1;

export interface OutputFile {
  name: string;
  /** The final lap file (made from the final lap song when the track has one). */
  final?: boolean;
  /** The sample rate written in the file's header. */
  rate: number;
}

export interface EncodeJob {
  key: string;
  assignment: Assignment;
  song: SongInfo;
  files: OutputFile[];
  tracks: Track[];
}

export type Problem =
  | { kind: 'missing-song'; track: Track }
  | { kind: 'missing-final-song'; track: Track }
  | { kind: 'long-song'; song: SongInfo; seconds: number };

/** What the final lap song is encoded with: the track's settings, the whole song looping. */
export const finalAssignment = (a: Assignment): Assignment | null =>
  a.finalSongId && a.finalSongId !== a.songId ? { ...a, songId: a.finalSongId, loop: null, finalSongId: null } : null;

// The final lap speed isn't part of the key: it only changes the copy's header, not the encode.
export const jobKey = (a: Assignment): string =>
  `${a.songId}|${a.speed}|${a.keepPitch && a.speed !== 1}|${a.volumeDb}|${a.playsOnce ? 'once' : a.loop ? `${a.loop.start}-${a.loop.end}` : ''}`;

/**
 * The files a track gets. The final lap file is the same audio (or the final lap song) with a faster header rate.
 * It's written when Retro Rewind has its own (or that would play on lap 3), when there's a final lap song, or when
 * the final lap speed isn't the game's own 1.06x (otherwise the game speeds up the normal file itself, which sounds
 * the same).
 */
export function filesFor(track: Track, assignment?: Partial<Pick<Assignment, 'finalSpeed' | 'finalSongId'>>): OutputFile[] {
  const files: OutputFile[] = [{ name: track.file + '.brstm', rate: SAMPLE_RATE }];
  if (isGameMusic(track)) return files;
  const finalSpeed = assignment?.finalSpeed ?? FINAL_LAP_SPEED;
  if (track.finalFile || finalSpeed !== FINAL_LAP_SPEED || assignment?.finalSongId) {
    const name = track.finalFile ?? track.file.replace(/_[Nn]$/, '') + '_Final';
    files.push({ name: name + '.brstm', rate: Math.min(MAX_WII_RATE, Math.round(SAMPLE_RATE * finalSpeed)), final: true });
  }
  return files;
}

export function planPack(tracks: readonly Track[], assignments: Assignments, songs: ReadonlyMap<string, SongInfo>, target: Target = 'wii') {
  const jobs = new Map<string, EncodeJob>();
  const problems: Problem[] = [];
  for (const track of tracks) {
    const assigned = assignments[track.file];
    if (!assigned) continue;
    // Jingles play once; game music has no final lap.
    const assignment: Assignment = track.playsOnce
      ? { ...assigned, loop: null, playsOnce: true, finalSongId: null }
      : isGameMusic(track) ? { ...assigned, finalSongId: null } : assigned;
    const song = songs.get(assignment.songId);
    if (!song) {
      problems.push({ kind: 'missing-song', track });
      continue;
    }
    const files = filesFor(track, assignment);
    const lap3 = finalAssignment(assignment);
    const lap3Song = lap3 ? songs.get(lap3.songId) : undefined;
    if (lap3 && !lap3Song) problems.push({ kind: 'missing-final-song', track });
    const add = (a: Assignment, s: SongInfo, out: OutputFile[]) => {
      const key = jobKey(a);
      const job = jobs.get(key) ?? { key, assignment: a, song: s, files: [], tracks: [] };
      job.files.push(...out);
      if (!job.tracks.includes(track)) job.tracks.push(track);
      jobs.set(key, job);
    };
    if (lap3 && lap3Song) {
      add(assignment, song, files.filter(f => !f.final));
      add(lap3, lap3Song, files.filter(f => f.final));
    } else add(assignment, song, files);
  }
  for (const job of jobs.values()) {
    const seconds = (job.assignment.loop?.end ?? job.song.duration) / job.assignment.speed;
    if (target === 'wii' && seconds > LONG_SONG_SECONDS && !problems.some(p => p.kind === 'long-song' && p.song.id === job.song.id))
      problems.push({ kind: 'long-song', song: job.song, seconds });
  }
  return { jobs: [...jobs.values()], problems };
}

/** Where the pack will be played. It decides the install steps, and the Wii's memory limit on long songs. */
export type Target = 'wii' | 'dolphin';

export const TARGETS: readonly (readonly [Target, string])[] = [
  ['wii', 'Wii (SD card)'],
  ['dolphin', 'Dolphin'],
];

/** Dolphin's Riivolution folder; Wheel Wizard keeps Retro Rewind one folder further in. */
export const DOLPHIN_FOLDER = 'Dolphin Emulator/Load/Riivolution';
export const WHEEL_WIZARD_FOLDER = DOLPHIN_FOLDER + '/WheelWizard';

export const readmeFor = (target: Target): string =>
  target === 'wii'
    ? `Retro Rewind music pack, made for Wii

Copy the RetroRewind6 folder to the root of your SD card, and say yes if it asks to replace files.
The songs end up in SD:/RetroRewind6/Patches.
${README_END}`
    : `Retro Rewind music pack, made for Dolphin

Copy the RetroRewind6 folder into the folder that already has a RetroRewind6 in it, and say yes if it asks to
replace files:
- Playing through Wheel Wizard: ${WHEEL_WIZARD_FOLDER}
- Otherwise: ${DOLPHIN_FOLDER}
(In Dolphin, File > Open User Folder opens the Dolphin Emulator folder.)
${README_END}`;

const README_END = `
No change in game? Check that Retro Rewind's Music setting isn't off and that Loose Archive Overrides is on.
Removing the files from Patches brings back Retro Rewind's own music.
`;
