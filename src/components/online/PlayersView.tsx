'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, ClockIcon, RadioIcon, SearchIcon, UserRoundSearchIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoredState } from '@/hooks/useStoredState';
import { useMiis, useRemote } from '@/hooks/useRwfc';
import { classifyQuery, formatVr, getRooms, plainName, roomMode } from '@/lib/rwfc/api';
import { Gain, PlayerAvatar } from './shared';
import { searchPlayers as search } from '@/lib/rwfc/search';
import { PlayerProfile } from './PlayerProfile';
import { CompareView } from './Compare';

export interface Recent {
  fc: string;
  name: string;
}

const RECENT_KEY = 'rewind-online-recent';
const parseRecent = (raw: string | null): Recent[] => {
  try {
    const list = raw ? (JSON.parse(raw) as Recent[]) : [];
    return Array.isArray(list)
      ? list
          .filter(r => r && typeof r.fc === 'string' && typeof r.name === 'string')
          .slice(0, 8)
          .map(r => ({ ...r, name: plainName(r.name) }))
      : [];
  } catch {
    return [];
  }
};
const noRecent = (): Recent[] => [];

interface Props {
  fc: string | null;
  /** A second player to compare with the open one. */
  vs: string | null;
  onCompare: (vs: string | null) => void;
  onPlayer: (fc: string | null) => void;
  onRoom: (room: string) => void;
}

/** Find any ranked player by name, friend code or player ID, and open their profile. */
export function PlayersView({ fc, vs, onPlayer, onRoom, onCompare }: Props) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useStoredState(RECENT_KEY, parseRecent, noRecent);

  useEffect(() => {
    const next = text.trim();
    if (next === query) return;
    const id = window.setTimeout(() => setQuery(next), 250);
    return () => window.clearTimeout(id);
  }, [text, query]);

  const results = useRemote(query ? `search:${query}` : null, signal => search(query, signal));
  const hits = useMemo(() => (query ? (results.data ?? []) : []), [query, results.data]);
  const rooms = useRemote('rooms', getRooms, 15000);
  const kind = classifyQuery(text)?.kind;

  // Suggestions while the box is empty: the highest-rated players in a room right now.
  const live = useMemo(
    () =>
      (rooms.data?.rooms ?? [])
        .flatMap(r => r.players.map(p => ({ ...p, room: r })))
        .sort((a, b) => (b.vr ?? 0) - (a.vr ?? 0))
        .slice(0, 6),
    [rooms.data],
  );
  const getMii = useMiis(
    useMemo(() => [...hits.map(h => h.fc), ...live.map(p => p.friendCode), ...recent.map(r => r.fc)], [hits, live, recent]),
  );

  const open = (target: string) => {
    onPlayer(target);
    setText('');
  };
  const remember = (r: Recent) => setRecent(list => [r, ...list.filter(x => x.fc !== r.fc)].slice(0, 8));

  return (
    <div className="flex flex-col gap-5">
      <InputGroup className="h-11">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Find a player"
          placeholder="Name, friend code (0000-0000-0000) or player ID"
          value={text}
          autoFocus={!fc}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') setText('');
            if (e.key === 'Enter' && hits[0] && query === text.trim()) open(hits[0].fc);
          }}
        />
        {text ? (
          <InputGroupAddon align="inline-end">
            <span className="text-muted-foreground mr-1 text-xs" aria-live="polite">
              {kind === 'fc' ? 'Friend code' : kind === 'pid' ? 'Player ID or name' : kind === 'name' ? 'Name' : ''}
            </span>
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setText('')}>
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {text.trim() ? (
        <section aria-label="Search results" className="flex flex-col gap-2">
          {results.error && query === text.trim() ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Search didn’t work</AlertTitle>
              <AlertDescription>{results.error.message}</AlertDescription>
            </Alert>
          ) : query !== text.trim() || results.loading ? (
            <div className="bg-card flex flex-col gap-1 rounded-xl border p-2" aria-busy="true" aria-label="Searching">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : hits.length ? (
            <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
              {hits.map((h, i) => (
                <li key={h.fc} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => open(h.fc)}
                    className="hover:bg-muted/50 focus-visible:bg-muted/60 flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors"
                  >
                    <PlayerAvatar name={h.name} src={getMii(h.fc)} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{h.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{h.fc}</span>
                    </span>
                    <span className="flex flex-col items-end text-sm tabular-nums">
                      <span className="font-semibold">{formatVr(h.vr)} VR</span>
                      <span className="text-muted-foreground text-xs">
                        #{h.rank.toLocaleString('en-US')}, <Gain value={h.gain24} /> in 24 h
                      </span>
                    </span>
                    {i === 0 ? (
                      <kbd className="text-muted-foreground bg-muted hidden rounded px-1.5 py-0.5 text-[11px] sm:block">Enter</kbd>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="bg-card/60 border border-dashed py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserRoundSearchIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No player found</EmptyTitle>
                <EmptyDescription>
                  {kind === 'fc'
                    ? 'Nobody ranked has that friend code. Players appear once they’ve raced online in Retro Rewind.'
                    : 'Check the spelling, or search by friend code, which never changes.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      ) : null}

      {fc ? (
        <div className="flex flex-col gap-3">
          {!text.trim() ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => onPlayer(null)}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              All players
            </Button>
          ) : null}
          {vs ? (
            <CompareView
              key={`${fc}:${vs}`}
              a={fc}
              b={vs}
              onSwap={() => {
                onPlayer(vs);
                onCompare(fc);
              }}
              onChange={onCompare}
              onClose={() => onCompare(null)}
              onPlayer={onPlayer}
            />
          ) : (
            <PlayerProfile
              key={fc}
              fc={fc}
              rooms={rooms.data?.rooms ?? null}
              onLoaded={remember}
              onPlayer={onPlayer}
              onRoom={onRoom}
              onCompare={onCompare}
            />
          )}
        </div>
      ) : !text.trim() ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="flex flex-col gap-2" aria-labelledby="recent-title">
            <div className="flex items-center justify-between">
              <h2 id="recent-title" className="flex items-center gap-2 text-sm font-medium">
                <ClockIcon aria-hidden="true" className="text-muted-foreground size-4" />
                Recently viewed
              </h2>
              {recent.length ? (
                <Button variant="ghost" size="xs" onClick={() => setRecent([])}>
                  Clear
                </Button>
              ) : null}
            </div>
            {recent.length ? (
              <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
                {recent.map(r => (
                  <li key={r.fc} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => open(r.fc)}
                      className="hover:bg-muted/50 focus-visible:bg-muted/60 flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors"
                    >
                      <PlayerAvatar name={r.name} src={getMii(r.fc)} className="size-8" />
                      <span className="flex-1 truncate font-medium">{r.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{r.fc}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground bg-card/60 rounded-xl border border-dashed px-4 py-6 text-sm">
                Players you open show up here, so you can get back to them quickly.
              </p>
            )}
          </section>
          <section className="flex flex-col gap-2" aria-labelledby="live-title">
            <h2 id="live-title" className="flex items-center gap-2 text-sm font-medium">
              <RadioIcon aria-hidden="true" className="text-muted-foreground size-4" />
              Racing right now
            </h2>
            {rooms.loading ? (
              <Skeleton className="h-60 rounded-xl" />
            ) : live.length ? (
              <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
                {live.map(p => (
                  <li key={p.pid} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => open(p.friendCode)}
                      className="hover:bg-muted/50 focus-visible:bg-muted/60 flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors"
                    >
                      <PlayerAvatar name={p.name} src={getMii(p.friendCode)} className="size-8" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="text-muted-foreground truncate text-xs">{roomMode(p.room)}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatVr(p.vr)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground bg-card/60 rounded-xl border border-dashed px-4 py-6 text-sm">
                Nobody’s in a room right now. Search by name or friend code instead.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
