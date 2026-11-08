// Bringing an existing music pack in: which .brstm goes on which track, and which are final lap files. A port of the
// matching in Music Pack Maker's PackImporter, kept simple: names are matched without case, from any folder.
import type { Track } from './tracks.ts';

export interface ImportMatch {
  track: Track;
  /** The file's name as found. */
  main: string | null;
  final: string | null;
}

export interface ImportPlan {
  matches: ImportMatch[];
  /** .brstm files named after no track. They still come in as songs, to put on a track by hand. */
  loose: string[];
}

const stem = (path: string) => path.split(/[\\/]/).pop()!.replace(/\.brstm$/i, '');
const base = (file: string) => file.replace(/_[Nn]$/, '');

/** `files` are paths (any folder); only .brstm files count. */
export function planImport(files: readonly string[], tracks: readonly Track[]): ImportPlan {
  const byName = new Map<string, string>();
  for (const f of files) if (/\.brstm$/i.test(f)) byName.set(stem(f).toLowerCase(), f);
  const used = new Set<string>();
  const take = (...names: (string | null)[]) => {
    for (const n of names) {
      const hit = n ? byName.get(n.toLowerCase()) : undefined;
      if (hit) {
        used.add(hit);
        return hit;
      }
    }
    return null;
  };
  const matches: ImportMatch[] = [];
  for (const track of tracks) {
    // Retro Rewind's own name first, then the unmodded game's (n_Farm_n, with its final lap file n_Farm_F).
    const stock = track.stockFile ?? null;
    const main = take(track.file, stock);
    const final = take(
      track.finalFile, base(track.file) + '_Final', base(track.file) + '_F',
      stock && base(stock) + '_F', stock && base(stock) + '_Final',
    );
    if (main || final) matches.push({ track, main, final });
  }
  return { matches, loose: [...byName.values()].filter(f => !used.has(f)) };
}

/** The final lap speed choice nearest a final file's rate over its main file's rate. */
export function nearestSpeed(ratio: number, choices: readonly number[]): number {
  return choices.reduce((best, c) => (Math.abs(c - ratio) < Math.abs(best - ratio) ? c : best), choices[0]);
}

export const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
