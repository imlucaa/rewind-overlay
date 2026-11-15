'use client';

import { useDeferredValue, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CATEGORY_LABELS, type Track, type TrackCategory } from '@/lib/music/tracks';
import type { Assignments } from '@/lib/music/pack';
import type { SongInfo } from '@/lib/music/library';
import { formatSpeed } from '@/lib/music/format';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <Input type="search" className="xl:max-w-sm" aria-label="Search tracks" placeholder="Search tracks or songs" value={query} onChange={e => onQuery(e.target.value)} />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          aria-label="Show"
          value={filter}
          onValueChange={v => v && onFilter(v as TrackFilter)}
          className="flex flex-wrap justify-start"
        >
          {FILTERS.map(([value, label]) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Checkbox id="select-all" checked={allSelected} disabled={!visible.length} onCheckedChange={() => onSelectMany(allSelected ? [] : visible.map(t => t.file))} />
          <Label htmlFor="select-all" className="font-normal">
            Select all {visible.length} shown
          </Label>
        </div>
      </div>

      {visible.length === 0 ? <p className="text-muted-foreground text-sm">No tracks match. Try another word or show All.</p> : null}
      {(Object.keys(CATEGORY_LABELS) as TrackCategory[]).map(category => {
        const list = groups[category];
        if (!list?.length) return null;
        return (
          <section key={category} className="flex flex-col gap-1.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {CATEGORY_LABELS[category]} <span className="text-muted-foreground font-normal tabular-nums">{list.length}</span>
            </h2>
            <ul className="divide-y rounded-lg border">
              {list.map(t => {
                const a = assignments[t.file];
                const song = a ? songs.get(a.songId) : undefined;
                return (
                  <li
                    key={t.file}
                    className={cn('flex items-center gap-3 px-3', selected.has(t.file) && 'bg-muted/60', focus === t.file && 'bg-muted')}
                    aria-current={focus === t.file || undefined}
                  >
                    <Checkbox aria-label={`Select ${t.name}`} checked={selected.has(t.file)} onCheckedChange={() => onSelect(t.file, 'toggle')} />
                    <button
                      type="button"
                      onClick={() => onSelect(t.file, 'only')}
                      className="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-sm py-1.5 text-left outline-none focus-visible:ring-3"
                    >
                      <span className="truncate text-sm">
                        {t.name}
                        {t.variantOf ? <span className="text-muted-foreground"> · version of {t.variantOf}</span> : null}
                      </span>
                      {a ? (
                        <span className="flex min-w-0 items-center gap-1.5 text-xs">
                          <span className={cn('truncate', song ? 'text-foreground' : 'text-destructive')}>{song ? song.title : 'Song removed'}</span>
                          {a.speed !== 1 ? <Badge variant="secondary">{formatSpeed(a.speed)}</Badge> : null}
                          {a.finalSongId ? <span className="text-muted-foreground truncate">· last lap: {songs.get(a.finalSongId)?.title ?? 'removed'}</span> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Original music</span>
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
