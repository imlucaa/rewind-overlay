'use client';

import { useState } from 'react';
import { songBlob } from '@/lib/music/library';
import { PATCHES_FOLDER, SAMPLE_RATE, readmeFor, type EncodeJob, type Target } from '@/lib/music/pack';
import { ZipWriter } from '@/lib/music/zip';

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'working'; done: number; total: number; song: string; fraction: number }
  | { kind: 'finished'; files: number; failed: { song: string; reason: string }[] }
  | { kind: 'failed'; reason: string };

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Encodes jobs one after another and downloads the result: a zip, or a lone .brstm for a single file. */
export function useExport() {
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });

  const run = async (jobs: readonly EncodeJob[], downloadName: string, withReadme: boolean, target: Target) => {
    // The encoder only loads once something is exported.
    const [{ renderBrstm }, { withSampleRate }] = await Promise.all([import('@/lib/music/render'), import('@/lib/music/brstm')]);
    const zip = new ZipWriter();
    const failed: { song: string; reason: string }[] = [];
    let single: { name: string; data: Uint8Array } | null = null;
    for (const [i, job] of jobs.entries()) {
      const song = job.song.title;
      setStatus({ kind: 'working', done: i, total: jobs.length, song, fraction: 0 });
      try {
        const blob = await songBlob(job.song.id);
        if (!blob) throw new Error('The song is no longer in your library.');
        const bytes = await renderBrstm(blob, job.assignment, fraction =>
          setStatus({ kind: 'working', done: i, total: jobs.length, song, fraction }),
        );
        for (const file of job.files) {
          const data = file.rate === SAMPLE_RATE ? bytes : withSampleRate(bytes, file.rate);
          zip.add(`${PATCHES_FOLDER}/${file.name}`, data);
          single = { name: file.name, data };
        }
      } catch (e) {
        failed.push({ song, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    if (zip.size === 0) {
      setStatus({ kind: 'failed', reason: failed[0]?.reason ?? 'Nothing to export.' });
      return;
    }
    const files = zip.size;
    if (files === 1 && !withReadme && single) download(new Blob([single.data as Uint8Array<ArrayBuffer>]), single.name);
    else {
      if (withReadme) zip.add('README.txt', new TextEncoder().encode(readmeFor(target)));
      download(zip.blob(), downloadName);
    }
    setStatus({ kind: 'finished', files, failed });
  };

  return { status, run, busy: status.kind === 'working', reset: () => setStatus({ kind: 'idle' }) };
}

export type ExportApi = ReturnType<typeof useExport>;
