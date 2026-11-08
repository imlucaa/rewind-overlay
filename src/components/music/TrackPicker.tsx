'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, type Track } from '@/lib/music/tracks';

interface Props {
  tracks: readonly Track[];
  /** Tracks that already play this song, ticked in the list. */
  using: ReadonlySet<string>;
  label: string;
  onPick: (track: Track) => void;
  /** Clicking a track that already has the song takes it off. */
  onRemove: (track: Track) => void;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * "Add to track…": a button that opens a searchable list of every track, grouped by cup category. Arrow keys move,
 * Enter picks, Escape or a click outside closes. Replaces the browser's datalist, which showed 350 rows unstyled
 * and jumped around while typing.
 */
export function TrackPicker({ tracks, using, label, onPick, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return tracks.filter(t => {
      const hay = norm(`${t.name} ${t.variantOf ?? ''} ${t.file} ${CATEGORY_LABELS[t.category]}`);
      return words.every(w => hay.includes(w));
    });
  }, [tracks, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  // Keep the highlighted row in view while moving with the keys.
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (track: Track | undefined) => {
    if (!track) return;
    if (using.has(track.file)) onRemove(track);
    else onPick(track);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="track-picker" ref={root}>
      <button
        type="button"
        className="track-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setOpen(o => !o);
          setActive(0);
        }}
      >
        Add to track…
      </button>
      {open ? (
        <div className="track-picker-pop">
          <input
            type="search"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            placeholder="Search tracks"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') setActive(i => Math.min(matches.length - 1, i + 1));
              else if (e.key === 'ArrowUp') setActive(i => Math.max(0, i - 1));
              else if (e.key === 'Enter') pick(matches[active]);
              else if (e.key === 'Escape') setOpen(false);
              else return;
              e.preventDefault();
            }}
          />
          <ul id={listId} role="listbox" ref={list}>
            {matches.length === 0 ? <li className="track-picker-empty">No tracks match.</li> : null}
            {matches.map((t, i) => (
              <li
                key={t.file}
                id={`${listId}-${i}`}
                role="option"
                data-index={i}
                aria-selected={i === active}
                data-using={using.has(t.file)}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(t)}
              >
                {i === 0 || matches[i - 1].category !== t.category ? <span className="track-picker-group">{CATEGORY_LABELS[t.category]}</span> : null}
                <span className="track-picker-row">
                  <span>
                    {t.name}
                    {t.variantOf ? <small> version of {t.variantOf}</small> : null}
                  </span>
                  {using.has(t.file) ? <small>{i === active ? 'remove' : 'has it'}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
