import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { MusicPackApp } from '@/components/music/MusicPackApp';
import { parseTrackList } from '@/lib/music/tracks';

export const metadata: Metadata = {
  title: 'Music Pack',
  description: 'Make a Retro Rewind custom music pack in the browser: import songs, pick tracks, set speed, download.',
};

// The track list is read at build time and sent with the page, so there's no fetch before it can draw.
export default async function MusicPackPage() {
  const { tracks } = parseTrackList(await readFile(path.join(process.cwd(), 'public/data/rr-tracks.tsv'), 'utf8'));
  return <MusicPackApp tracks={tracks} />;
}
