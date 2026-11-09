'use client';

import { useDeferredValue, useMemo } from 'react';
import { CATEGORY_LABELS, type Track, type TrackCategory } from '@/lib/music/tracks';
import type { Assignments } from '@/lib/music/pack';
import type { SongInfo } from '@/lib/music/library';
import { formatSpeed } from '@/lib/music/format';

export type TrackFilter = 'all' | TrackCategory | 'custom-music' | 'original-music';

const FILTERS: readonly [TrackFilter, string][] = [
  ['all', 'All'],
  ['original', 'Original'],
  ['retro', 'Retro'],
  ['custom', 'Custom'],
  ['battle', 'Battle'],
  ['menu', 'Menus'],
  ['fanfare', 'Fanfares'],
  ['custom-music', 'With your music'],
  ['original-music', 'No song yet'],
];

interface Props {
  tracks: readonly Track[];
  assignments: Assignments;
  songs: ReadonlyMap<string, SongInfo>;
  query: string;
  filter: TrackFilter;
  selected: ReadonlySet<string>;
  focus: string | null;
  onQuery: (q: string) => void;
  onFilter: (f: TrackFilter) => void;
  /** Click: just this track. Toggle (checkbox): add or remove it from the selection. */
  onSelect: (file: string, mode: 'only' | 'toggle') => void;
  onSelectMany: (files: string[]) => void;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Retro Rewind's tracks by category, with search and filters, showing which have your music. */
export function TracksView({ tracks, assignments, songs, query, filter, selected, focus, onQuery, onFilter, onSelect, onSelectMany }: Props) {
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => {
    const words = norm(deferredQuery).split(/\s+/).filter(Boolean);
    return tracks.filter(t => {
      const assigned = t.file in assignments;
      if (filter === 'custom-music' && !assigned) return false;
      if (filter === 'original-music' && assigned) return false;
      if (filter !== 'all' && filter !== 'custom-music' && filter !== 'original-music' && t.category !== filter) return false;
      const a = assignments[t.file];
      const song = a ? `${songs.get(a.songId)?.title ?? ''} ${a.finalSongId ? songs.get(a.finalSongId)?.title ?? '' : ''}` : '';
      const haystack = norm(`${t.name} ${t.variantOf} ${t.file} ${song}`);
      return words.every(w => haystack.includes(w));
    });
  }, [tracks, assignments, songs, filter, deferredQuery]);

  const groups = useMemo(() => Object.groupBy(visible, t => t.category), [visible]);
  const allSelected = visible.length > 0 && visible.every(t => selected.has(t.file));

  return (
    <div className="music-view">
      <div className="track-tools">
        <input type="search" aria-label="Search tracks" placeholder="Search tracks or songs" value={query} onChange={e => onQuery(e.target.value)} />
        <div className="chips" role="radiogroup" aria-label="Filter">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={filter === value} onClick={() => onFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="select-all">
          <input type="checkbox" checked={allSelected} onChange={() => onSelectMany(allSelected ? [] : visible.map(t => t.file))} />
          Select all {visible.length}
        </label>
      </div>

      {visible.length === 0 ? <p className="empty">No tracks match.</p> : null}
      {(Object.keys(CATEGORY_LABELS) as TrackCategory[]).map(category => {
        const list = groups[category];
        if (!list?.length) return null;
        return (
          <section key={category} className="track-group">
            <h2>
              {CATEGORY_LABELS[category]} <span>{list.length}</span>
            </h2>
            <ul className="rows track-list">
              {list.map(t => {
                const a = assignments[t.file];
                const song = a ? songs.get(a.songId) : undefined;
                return (
                  <li key={t.file} className="track" aria-current={focus === t.file} data-selected={selected.has(t.file)}>
                    <input type="checkbox" aria-label={`Select ${t.name}`} checked={selected.has(t.file)} onChange={() => onSelect(t.file, 'toggle')} />
                    <button type="button" className="track-main" onClick={() => onSelect(t.file, 'only')}>
                      <span className="track-name">
                        {t.name}
                        {t.variantOf ? <small> version of {t.variantOf}</small> : null}
                      </span>
                      {a ? (
                        <span className="track-song" data-missing={!song}>
                          <i aria-hidden="true" />
                          {song ? song.title : 'Song removed'}
                          {a.speed !== 1 ? <em>{formatSpeed(a.speed)}</em> : null}
                          {a.finalSongId ? <em>· last lap: {songs.get(a.finalSongId)?.title ?? 'removed'}</em> : null}
                        </span>
                      ) : (
                        <span className="track-song original">Original music</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
