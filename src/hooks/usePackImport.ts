'use client';

import { useState } from 'react';
import { FINAL_LAP_SPEED, FINAL_SPEED_CHOICES, newAssignment, type Assignments } from '@/lib/music/pack';
import { nearestSpeed, planImport, sameBytes } from '@/lib/music/packImport';
import type { SongInfo } from '@/lib/music/library';
import type { Track } from '@/lib/music/tracks';

interface Source {
  name: string;
  read: () => Promise<Uint8Array>;
}

/**
 * Brings an existing pack in: a .zip, or .brstm files from a Patches folder. Each file becomes a song (decoded to
 * WAV) on its track, with its loop. A final lap file that's the main song at another rate becomes the lap 3 speed;
 * a different song becomes the lap 3 song.
 */
export function usePackImport(tracks: readonly Track[], addSong: (file: File, title?: string) => Promise<SongInfo>) {
  const [progress, setProgress] = useState('');

  const run = async (files: readonly File[]): Promise<{ assignments: Assignments; summary: string }> => {
    const [{ readZip }, { readBrstm, toWav }] = await Promise.all([import('@/lib/music/zipRead'), import('@/lib/music/brstmRead')]);
    const sources: Source[] = [];
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        for (const entry of readZip(new Uint8Array(await file.arrayBuffer()))) if (/\.brstm$/i.test(entry.name)) sources.push(entry);
      } else if (/\.brstm$/i.test(file.name)) sources.push({ name: file.name, read: async () => new Uint8Array(await file.arrayBuffer()) });
    }
    if (!sources.length) throw new Error('No .brstm files in that. Pick a pack’s .zip, or the .brstm files from its Patches folder.');
    const byName = new Map(sources.map(s => [s.name, s]));
    const plan = planImport([...byName.keys()], tracks);
    const assignments: Assignments = {};
    const failed: string[] = [];
    const total = plan.matches.length + plan.loose.length;
    let done = 0;
    const leaf = (path: string) => path.split(/[\/]/).pop()!;

    const load = async (path: string) => readBrstm(await byName.get(path)!.read());
    const store = async (decoded: Awaited<ReturnType<typeof load>>, path: string, title: string) =>
      addSong(new File([toWav(decoded.channels, decoded.rate)], leaf(path).replace(/\.brstm$/i, '.wav'), { type: 'audio/wav' }), title);

    for (const { track, main, final } of plan.matches) {
      setProgress(`Reading ${++done} of ${total}: ${track.name}`);
      try {
        const first = main ?? final!;
        const decoded = await load(first);
        const song = await store(decoded, first, track.name);
        const a = newAssignment(song.id);
        if (decoded.loopStart !== null) a.loop = { start: decoded.loopStart / decoded.rate, end: decoded.samples / decoded.rate };
        if (main && final) {
          const lap3 = await load(final);
          if (sameBytes(lap3.audio, decoded.audio)) a.finalSpeed = nearestSpeed(lap3.rate / decoded.rate, FINAL_SPEED_CHOICES.map(([s]) => s));
          else {
            a.finalSongId = (await store(lap3, final, `${track.name} (final lap)`)).id;
            a.finalSpeed = 1;
          }
        } else if (!main) a.finalSpeed = FINAL_LAP_SPEED;
        assignments[track.file] = a;
      } catch (e) {
        failed.push(`${leaf(main ?? final!)} ${e instanceof Error ? e.message : e}`);
      }
    }
    for (const path of plan.loose) {
      setProgress(`Reading ${++done} of ${total}: ${leaf(path)}`);
      try {
        await store(await load(path), path, leaf(path).replace(/\.brstm$/i, ''));
      } catch (e) {
        failed.push(`${leaf(path)} ${e instanceof Error ? e.message : e}`);
      }
    }
    setProgress('');
    const tracksDone = Object.keys(assignments).length;
    const summary = [
      `Imported ${tracksDone} track${tracksDone === 1 ? '' : 's'}.`,
      plan.loose.length ? `${plan.loose.length} file${plan.loose.length === 1 ? '' : 's'} named after no track ${plan.loose.length === 1 ? 'is' : 'are'} in your songs to place by hand.` : '',
      failed.length ? `Couldn’t read: ${failed.join('; ')}.` : '',
    ].filter(Boolean).join(' ');
    return { assignments, summary };
  };

  return { run, progress };
}
