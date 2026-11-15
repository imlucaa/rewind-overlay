'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CATEGORY_LABELS, type Track, type TrackCategory } from '@/lib/music/tracks';
import type { Assignments, Problem } from '@/lib/music/pack';
import type { SongInfo } from '@/lib/music/library';
import { formatDuration } from '@/lib/music/format';

interface Props {
  packName: string;
  tracks: readonly Track[];
  assignments: Assignments;
  songs: readonly SongInfo[];
  problems: readonly Problem[];
  /** Opens the Tracks view filtered to a category. */
  onCategory: (category: TrackCategory) => void;
  onTrack: (file: string) => void;
  onSongs: () => void;
}

/** The pack at a glance: how far each category is, what needs fixing, and what to do next. */
export function PackSummary({ packName, tracks, assignments, songs, problems, onCategory, onTrack, onSongs }: Props) {
  const rows = useMemo(() => {
    const out: { category: TrackCategory; done: number; total: number }[] = [];
    for (const category of Object.keys(CATEGORY_LABELS) as TrackCategory[]) {
      const list = tracks.filter(t => t.category === category);
      if (list.length) out.push({ category, total: list.length, done: list.filter(t => t.file in assignments).length });
    }
    return out;
  }, [tracks, assignments]);
  const assigned = rows.reduce((n, r) => n + r.done, 0);
  // Only until the first track has a song; after that the bars say it all.
  const hint = !songs.length
    ? 'Add songs (or open a pack you already have), then give them tracks.'
    : !assigned
      ? 'Open Tracks, pick a track and choose one of your songs.'
      : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{packName}</h2>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>
      {!songs.length ? (
        <Button variant="outline" className="self-start" onClick={onSongs}>
          Go to Songs
        </Button>
      ) : null}

      <ul className="flex flex-col gap-1" aria-label="Tracks with your music, by category">
        {rows.map(r => (
          <li key={r.category}>
            <button
              type="button"
              onClick={() => onCategory(r.category)}
              className="hover:bg-muted focus-visible:ring-ring/50 flex w-full flex-col gap-1.5 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-3"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                {CATEGORY_LABELS[r.category]}
                <small className="text-muted-foreground tabular-nums">
                  {r.done} / {r.total}
                </small>
              </span>
              <Progress value={(r.done / r.total) * 100} aria-label={`${CATEGORY_LABELS[r.category]}: ${r.done} of ${r.total} with your music`} />
            </button>
          </li>
        ))}
      </ul>

      {problems.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Needs fixing</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {problems.map(p =>
              p.kind === 'long-song' ? (
                <li key={'l' + p.song.id}>
                  {p.song.title} plays for {formatDuration(p.seconds)}. Over 10 minutes may not fit in the Wii’s memory.
                </li>
              ) : (
                <li key={p.kind + p.track.file}>
                  <Button variant="link" className="h-auto p-0" onClick={() => onTrack(p.track.file)}>
                    {p.track.name}
                  </Button>
                  : {p.kind === 'missing-song' ? 'its song was removed' : 'its last lap song was removed'}
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
