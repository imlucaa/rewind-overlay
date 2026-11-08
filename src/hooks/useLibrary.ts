'use client';

import { useCallback, useEffect, useState } from 'react';
import { allSongs, deleteSong, putSong, type Song, type SongInfo } from '@/lib/music/library';
import { readTags } from '@/lib/music/tags';

export const ACCEPT = '.mp3,.wav,.ogg,.oga,.opus,.flac,.m4a,.aac,audio/*';
const TAG_BYTES = 256 * 1024;

/** The song's length, which also proves the browser can play it. */
function probeDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const done = () => URL.revokeObjectURL(url);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      done();
      if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration);
      else reject(new Error('has no length'));
    };
    audio.onerror = () => {
      done();
      reject(new Error('isn’t audio this browser can play'));
    };
    audio.src = url;
  });
}

async function songFrom(file: File, id: string = crypto.randomUUID()): Promise<Song> {
  const duration = await probeDuration(file);
  const tags = readTags(new Uint8Array(await file.slice(0, TAG_BYTES).arrayBuffer()), file.name);
  return { id, ...tags, fileName: file.name, duration, size: file.size, type: file.type, addedAt: Date.now(), blob: file };
}

export interface ImportResult {
  added: number;
  failed: { name: string; reason: string }[];
}

/** The imported songs (kept in IndexedDB). */
export function useLibrary() {
  const [songs, setSongs] = useState<SongInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    allSongs()
      .then(setSongs)
      .catch(() => setError('This browser won’t let the page store songs (private mode?). Imports won’t be kept.'))
      .finally(() => setReady(true));
  }, []);

  const importFiles = useCallback(async (files: readonly File[]): Promise<ImportResult> => {
    const result: ImportResult = { added: 0, failed: [] };
    // One at a time: each file is read and stored before the next, which keeps memory flat for big imports.
    for (const file of files) {
      try {
        const song = await songFrom(file);
        await putSong(song);
        const { blob, ...info } = song;
        setSongs(list => [...list, info]);
        result.added++;
      } catch (e) {
        result.failed.push({ name: file.name, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return result;
  }, []);

  /** Adds one song and gives back what was stored (for imports that assign it straight away). */
  const addSong = useCallback(async (file: File, title?: string): Promise<SongInfo> => {
    const song = await songFrom(file);
    if (title) song.title = title;
    await putSong(song);
    const { blob, ...info } = song;
    setSongs(list => [...list, info]);
    return info;
  }, []);

  /** Swaps a song's audio, keeping its id so every track using it gets the new file. */
  const replaceSong = useCallback(async (id: string, file: File) => {
    const song = await songFrom(file, id);
    await putSong(song);
    const { blob, ...info } = song;
    setSongs(list => list.map(s => (s.id === id ? { ...info, addedAt: s.addedAt } : s)));
  }, []);

  const removeSong = useCallback(async (id: string) => {
    await deleteSong(id);
    setSongs(list => list.filter(s => s.id !== id));
  }, []);

  return { songs, ready, error, importFiles, addSong, replaceSong, removeSong };
}
