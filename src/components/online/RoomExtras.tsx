'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellIcon, BellOffIcon, ChevronDownIcon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow, useRemote, useWatchlist } from '@/hooks/useRwfc';
import { getRoomRaces, NotFoundError, roomMode, timeAgo, type Room } from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';
import { ordinal } from './charts';
import { PlayerAvatar } from './shared';

/** Where each watched player is right now (only the ones in a room). */
function onlineWatched(rooms: Room[], list: { fc: string; name: string }[]) {
  const out: { fc: string; name: string; room: Room }[] = [];
  for (const w of list) {
    const room = rooms.find(r => r.players.some(p => p.friendCode === w.fc));
    if (room) out.push({ fc: w.fc, name: room.players.find(p => p.friendCode === w.fc)?.name ?? w.name, room });
  }
  return out;
}

/**
 * Browser notifications when a watched player comes online, while this page is open (a website can't notify you
 * once it's closed). The first load only records who's already on, so opening the page doesn't fire a burst.
 */
export function useOnlineAlerts(rooms: Room[] | null) {
  const { list, notify } = useWatchlist();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!rooms) return;
    const now = onlineWatched(rooms, list);
    const before = seen.current;
    seen.current = new Set(now.map(w => w.fc));
    if (!before || !notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    for (const w of now) {
      if (before.has(w.fc)) continue;
      try {
        new Notification(`${w.name} is online`, { body: `${roomMode(w.room)}, room ${w.room.id}`, tag: `rr-online-${w.fc}` });
      } catch {
        // Some browsers only allow notifications from a service worker; the strip on the page still shows them.
      }
    }
  }, [rooms, list, notify]);
}

/** The players you watch who are in a room right now, at the top of the Rooms tab. */
export function WatchingStrip({
  rooms,
  getMii,
  onSelect,
}: {
  rooms: Room[];
  getMii: (fc: string) => string | undefined;
  onSelect: (room: string) => void;
}) {
  const { list, notify, setNotify } = useWatchlist();
  const online = useMemo(() => onlineWatched(rooms, list), [rooms, list]);
  const [asking, setAsking] = useState(false);
  if (!list.length) return null;

  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      return;
    }
    if (typeof Notification === 'undefined') {
      toast.error('This browser can’t show notifications');
      return;
    }
    setAsking(true);
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    setAsking(false);
    if (permission !== 'granted') {
      toast.error('Notifications are blocked', { description: 'Allow them for this site in your browser settings, then try again.' });
      return;
    }
    setNotify(true);
    toast.success('You’ll get a notification when someone you watch comes online', {
      description: 'While this page is open in a tab.',
    });
  };

  return (
    <section className="bg-card flex flex-col gap-3 rounded-xl border p-4" aria-labelledby="watching-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="watching-title" className="flex items-center gap-2 text-sm font-medium">
          <StarIcon aria-hidden="true" className="size-4 fill-current" />
          Watching
          <span className="text-muted-foreground font-normal tabular-nums">
            {online.length} of {list.length} online
          </span>
        </h2>
        <Button variant="ghost" size="xs" onClick={toggleNotify} disabled={asking} aria-pressed={notify}>
          {notify ? <BellIcon data-icon="inline-start" aria-hidden="true" /> : <BellOffIcon data-icon="inline-start" aria-hidden="true" />}
          {notify ? 'Notifications on' : 'Notify me'}
        </Button>
      </div>
      {online.length ? (
        <ul className="flex flex-wrap gap-2">
          {online.map(w => (
            <li key={w.fc}>
              <button
                type="button"
                onClick={() => onSelect(w.room.id)}
                className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <PlayerAvatar name={w.name} src={getMii(w.fc)} className="size-6" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium">{w.name}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {roomMode(w.room)}, {w.room.players.length}/12
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-[13px]">Nobody you watch is in a room right now. They show up here as soon as they are.</p>
      )}
    </section>
  );
}

/** A room's latest races: the newest with everyone's result, the ones before as a short list. */
export function RoomRaces({ room, onPlayer }: { room: Room; onPlayer: (fc: string) => void }) {
  // Keyed by the race number, so a finished race brings the new results in.
  const races = useRemote(`room-races:${room.id}:${room.race?.num ?? 0}`, signal => getRoomRaces(room.id, 6, signal));
  const now = useNow();
  const [open, setOpen] = useState(false);
  const items = races.data?.items ?? [];
  const [latest, ...earlier] = items;
  const standings = latest ? [...latest.participants].sort((a, b) => (a.finishPos ?? 99) - (b.finishPos ?? 99)) : [];
  const shown = open ? standings : standings.slice(0, 3);

  return (
    <section className="flex flex-col gap-2 px-5 py-4" aria-labelledby="room-races-title">
      <h3 id="room-races-title" className="text-sm font-medium">
        Last race
      </h3>
      {races.loading ? (
        <Skeleton className="h-24" />
      ) : !latest ? (
        <p className="text-muted-foreground text-[13px]">
          {races.error && !(races.error instanceof NotFoundError) ? races.error.message : 'No finished races in this room yet.'}
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{latest.trackName}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              Race {latest.raceNumber}, {now ? timeAgo(latest.timestamp, now) : ''}
            </span>
          </div>
          <ol className="flex flex-col">
            {shown.map(p => (
              <li key={p.profileId} className="flex items-center gap-3 py-1 text-[13px]">
                <span
                  className={cn(
                    'grid h-5 w-9 shrink-0 place-items-center rounded text-[11px] font-semibold tabular-nums',
                    'text-muted-foreground',
                  )}
                >
                  {p.finishPos ? ordinal(p.finishPos) : '–'}
                </span>
                <button
                  type="button"
                  onClick={() => onPlayer(p.friendCode)}
                  className="min-w-0 flex-1 cursor-pointer truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {p.name}
                </button>
                <span className="text-muted-foreground tabular-nums">{p.finishTimeDisplay}</span>
              </li>
            ))}
          </ol>
          {standings.length > 3 ? (
            <Button variant="ghost" size="xs" className="self-start" onClick={() => setOpen(o => !o)} aria-expanded={open}>
              <ChevronDownIcon
                data-icon="inline-start"
                aria-hidden="true"
                className={cn('transition-transform duration-200 ease-(--ease-out)', open && 'rotate-180')}
              />
              {open ? 'Show the top 3' : `All ${standings.length} results`}
            </Button>
          ) : null}
          {earlier.length ? (
            <div className="flex flex-col gap-1 border-t pt-3">
              <span className="text-muted-foreground text-xs">Raced before</span>
              <ul className="flex flex-col gap-1 text-[13px]">
                {earlier.map(r => {
                  const winner = r.participants.find(p => p.finishPos === 1);
                  return (
                    <li key={`${r.raceNumber}-${r.timestamp}`} className="flex items-baseline justify-between gap-3">
                      <span className="truncate">{r.trackName}</span>
                      <span className="text-muted-foreground shrink-0 truncate text-xs">{winner ? `won by ${winner.name}` : ''}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
