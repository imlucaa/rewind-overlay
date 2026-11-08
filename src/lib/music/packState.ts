// The pack being made: its name and which song each track plays. Kept in localStorage (the songs themselves are in
// IndexedDB), and saved to / loaded from a .json file so a pack can be moved or backed up.
import { FINAL_SPEED_CHOICES, FINAL_LAP_SPEED, TARGETS, clampSpeed, type Assignment, type Assignments, type LoopPoints, type Target } from './pack.ts';
import type { SongInfo } from './library.ts';

export const PACK_KEY = 'rewind-music-pack';

export interface PackState {
  packName: string;
  assignments: Assignments;
  /** Where it'll be played. Kept in this browser, not in the assignments file. */
  target: Target;
}

export const emptyPack = (): PackState => ({ packName: 'My music pack', assignments: {}, target: 'wii' });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readAssignment(v: unknown): Assignment | null {
  if (!isRecord(v) || typeof v.songId !== 'string') return null;
  const volume = typeof v.volumeDb === 'number' && Number.isFinite(v.volumeDb) ? Math.round(v.volumeDb) : 0;
  return {
    songId: v.songId,
    speed: clampSpeed(typeof v.speed === 'number' ? v.speed : 1),
    keepPitch: v.keepPitch !== false,
    volumeDb: Math.min(12, Math.max(-12, volume)),
    loop: readLoop(v.loop),
    finalSpeed: FINAL_SPEED_CHOICES.some(([speed]) => speed === v.finalSpeed) ? (v.finalSpeed as number) : FINAL_LAP_SPEED,
    finalSongId: typeof v.finalSongId === 'string' && v.finalSongId && v.finalSongId !== v.songId ? v.finalSongId : null,
    ...(typeof v.trimStart === 'number' && v.trimStart > 0 ? { trimStart: Math.min(60, v.trimStart) } : {}),
    ...(typeof v.fadeIn === 'number' && v.fadeIn > 0 ? { fadeIn: Math.min(10, v.fadeIn) } : {}),
  };
}

function readLoop(v: unknown): LoopPoints | null {
  if (!isRecord(v) || typeof v.start !== 'number' || typeof v.end !== 'number') return null;
  return Number.isFinite(v.start) && Number.isFinite(v.end) && v.start >= 0 && v.end > v.start + 1 ? { start: v.start, end: v.end } : null;
}

function readAssignments(v: unknown): Assignments {
  const out: Assignments = {};
  if (isRecord(v))
    for (const [file, raw] of Object.entries(v)) {
      const a = readAssignment(raw);
      if (a) out[file] = a;
    }
  return out;
}

export function parsePack(text: string | null): PackState {
  try {
    const raw: unknown = text ? JSON.parse(text) : null;
    if (!isRecord(raw)) return emptyPack();
    return {
      packName: typeof raw.packName === 'string' && raw.packName.trim() ? raw.packName : emptyPack().packName,
      assignments: readAssignments(raw.assignments),
      // the two Dolphin choices were merged into one
      target: raw.target === 'dolphin-ww' ? 'dolphin' : TARGETS.some(([t]) => t === raw.target) ? (raw.target as Target) : 'wii',
    };
  } catch {
    return emptyPack();
  }
}

// ---------- the .json file ----------
const FILE_KIND = 'rewind-overlay music pack';

interface PackFile {
  kind: typeof FILE_KIND;
  version: 1;
  packName: string;
  assignments: Assignments;
  /** Enough to find each song again in another browser's library. */
  songs: Record<string, { title: string; fileName: string; size: number }>;
}

export function packToFile(pack: PackState, songs: readonly SongInfo[]): string {
  const used = new Set(Object.values(pack.assignments).flatMap(a => (a.finalSongId ? [a.songId, a.finalSongId] : [a.songId])));
  const file: PackFile = {
    kind: FILE_KIND,
    version: 1,
    packName: pack.packName,
    assignments: pack.assignments,
    songs: Object.fromEntries(songs.filter(s => used.has(s.id)).map(s => [s.id, { title: s.title, fileName: s.fileName, size: s.size }])),
  };
  return JSON.stringify(file, null, 1);
}

export interface PackImport {
  pack: Omit<PackState, 'target'>;
  /** Assignments dropped because their song isn't in this library. */
  missing: number;
  /** Assignments dropped because Retro Rewind has no such track. */
  unknownTracks: number;
}

/** Reads a pack file against this library: songs match by id, else by file name and size. */
export function packFromFile(text: string, songs: readonly SongInfo[], trackFiles: ReadonlySet<string>): PackImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a music pack file.');
  }
  if (!isRecord(raw) || raw.kind !== FILE_KIND) throw new Error('That file isn’t a music pack file.');
  const known = isRecord(raw.songs) ? raw.songs : {};
  const byId = new Map(songs.map(s => [s.id, s]));
  const byFile = new Map(songs.map(s => [`${s.fileName}|${s.size}`, s]));
  const assignments: Assignments = {};
  let missing = 0;
  let unknownTracks = 0;
  for (const [file, a] of Object.entries(readAssignments(raw.assignments))) {
    if (!trackFiles.has(file)) {
      unknownTracks++;
      continue;
    }
    const find = (id: string) => {
      const info = known[id];
      return byId.get(id) ?? (isRecord(info) ? byFile.get(`${String(info.fileName)}|${Number(info.size)}`) : undefined);
    };
    const song = find(a.songId);
    if (!song) {
      missing++;
      continue;
    }
    // A final lap song that isn't here just falls back to the main song.
    assignments[file] = { ...a, songId: song.id, finalSongId: a.finalSongId ? find(a.finalSongId)?.id ?? null : null };
  }
  const packName = typeof raw.packName === 'string' && raw.packName.trim() ? raw.packName : emptyPack().packName;
  return { pack: { packName, assignments }, missing, unknownTracks };
}

export const safeFileName = (name: string): string =>
  name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'Music pack';
