'use client';

import { useMemo } from 'react';
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
    ? 'Add songs on the left (or import a pack you already have), then give them tracks.'
    : !assigned
      ? 'Open Tracks, pick a track and click one of your songs.'
      : '';

  return (
    <div className="summary">
      <h2>{packName}</h2>
      {hint ? <p className="summary-next">{hint}</p> : null}
      {!songs.length ? (
        <button className="button" type="button" onClick={onSongs}>
          Go to Songs
        </button>
      ) : null}

      <ul className="summary-bars" aria-label="Tracks with your music, by category">
        {rows.map(r => (
          <li key={r.category}>
            <button type="button" onClick={() => onCategory(r.category)}>
              <span>{CATEGORY_LABELS[r.category]}</span>
              <small>
                {r.done} / {r.total}
              </small>
              <i style={{ ['--done' as string]: `${(r.done / r.total) * 100}%` }} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {problems.length ? (
        <>
          <h3 className="inspector-section">Needs a look</h3>
          <ul className="summary-problems">
            {problems.map(p =>
              p.kind === 'long-song' ? (
                <li key={'l' + p.song.id}>
                  {p.song.title} plays for {formatDuration(p.seconds)}; over 10 minutes may not fit in the Wii’s memory.
                </li>
              ) : (
                <li key={p.kind + p.track.file}>
                  <button type="button" className="link-button" onClick={() => onTrack(p.track.file)}>
                    {p.track.name}
                  </button>
                  : {p.kind === 'missing-song' ? 'its song was removed' : 'its lap 3 song was removed'}
                </li>
              ),
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}
