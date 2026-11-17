'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { CrownIcon, FolderDownIcon, SearchIcon, StarIcon, UsersIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoredState } from '@/hooks/useStoredState';
import { useMiis, useMyFriendCode, useNow, useRemote, useWatchlist } from '@/hooks/useRwfc';
import {
  availability,
  duration,
  filterRooms,
  flag,
  formatVr,
  getPlayer,
  getRooms,
  getRoomStats,
  isGoodMatch,
  roomHost,
  roomMode,
  ROOM_SIZE,
  type Availability,
  type Room,
  type RoomFilter,
} from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';
import { CopyButton, MiiButton, PlayerAvatar, RefreshBar, saveMiiZip, SlashHint, Stat, useSlashFocus, WatchButton } from './shared';
import { RoomRaces, useOnlineAlerts, WatchingStrip } from './RoomExtras';

const REFRESH_MS = 15000;
const FILTER_KEY = 'rewind-online-rooms';
const DEFAULT_FILTER: RoomFilter = { query: '', mode: 'all', status: 'all', country: 'all', sort: 'players' };
const parseFilter = (raw: string | null): RoomFilter => {
  try {
    return { ...DEFAULT_FILTER, ...(raw ? (JSON.parse(raw) as Partial<RoomFilter>) : {}) };
  } catch {
    return DEFAULT_FILTER;
  }
};
const defaultFilter = () => DEFAULT_FILTER;

const STATUS: Record<Availability, { label: string; hint: string }> = {
  open: { label: 'Open', hint: 'Public, with a free spot' },
  full: { label: 'Full', hint: 'All 12 spots taken' },
  friends: { label: 'Friends', hint: 'A private room: join through a friend inside it' },
};

interface Props {
  selected: string | null;
  onSelect: (room: string | null) => void;
  onPlayer: (fc: string) => void;
}

/** Live rooms: who's racing where, refreshed every 15 seconds while the page is open. */
export function RoomsView({ selected, onSelect, onPlayer }: Props) {
  const rooms = useRemote('rooms', getRooms, REFRESH_MS);
  const stats = useRemote('room-stats', getRoomStats, REFRESH_MS * 4);
  const [filter, setFilter] = useStoredState(FILTER_KEY, parseFilter, defaultFilter);
  const set = (patch: Partial<RoomFilter>) => setFilter(f => ({ ...f, ...patch }));

  const all = useMemo(() => rooms.data?.rooms ?? [], [rooms.data]);
  const modes = useMemo(() => [...new Set(all.map(roomMode))].sort(), [all]);
  // Countries only appear when the API sends them, so the filter only shows then.
  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of all) for (const p of r.players) if (p.countryAlpha2) seen.set(p.countryAlpha2, p.countryName ?? p.countryAlpha2);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);
  const me = useMyFriendCode();
  const mine = useRemote(me ? `me:${me}` : null, signal => getPlayer(me!, signal), 60000);
  const myVr = mine.data?.vr ?? null;
  const list = useMemo(() => filterRooms(all, filter, myVr), [all, filter, myVr]);
  const watch = useWatchlist();
  useOnlineAlerts(rooms.data?.rooms ?? null);
  const filtered = filter.query.trim() !== '' || filter.mode !== 'all' || filter.status !== 'all' || filter.country !== 'all';
  const open = all.find(r => r.id === selected) ?? null;
  const getMii = useMiis(useMemo(() => all.flatMap(r => r.players.map(p => p.friendCode)), [all]));
  const searchBox = useRef<HTMLInputElement>(null);
  useSlashFocus(searchBox);

  // Escape closes the open room (when you're not typing).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && !t?.closest('input, textarea, [role="dialog"]')) onSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onSelect]);

  const wide = useWide();

  // The list takes the full width until a room is picked; then its details open beside it. One stable tree either
  // way, so the list (and a focused search box) isn't rebuilt when the panel opens.
  return (
    <div
      className={cn('grid gap-6 lg:gap-8', open && 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:grid-cols-[minmax(0,1fr)_420px]')}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <WatchingStrip rooms={all} getMii={getMii} onSelect={id => onSelect(id)} />
        <div className="bg-card grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border p-5 sm:grid-cols-4">
          <Stat label="Racing now">
            {stats.data ? (
              formatVr(stats.data.totalPlayers)
            ) : rooms.data ? (
              formatVr(rooms.data.totalPlayers)
            ) : (
              <Skeleton className="h-7 w-14" />
            )}
          </Stat>
          <Stat label="Rooms">{rooms.data ? all.length : <Skeleton className="h-7 w-10" />}</Stat>
          <Stat label="Open to join">
            {rooms.data ? all.filter(r => availability(r) === 'open').length : <Skeleton className="h-7 w-10" />}
          </Stat>
          <Stat label="Peak today" hint={stats.data ? `All-time peak: ${formatVr(stats.data.peakPlayersAllTime)} players` : undefined}>
            {stats.data ? formatVr(stats.data.peakPlayersToday) : <Skeleton className="h-7 w-14" />}
          </Stat>
        </div>

        <div className="flex flex-col gap-3">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchBox}
              type="search"
              aria-label="Search rooms"
              placeholder="Search by room code, host or any player"
              value={filter.query}
              onChange={e => set({ query: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Escape') set({ query: '' });
                if (e.key === 'Enter' && list[0]) onSelect(list[0].id);
              }}
            />
            <InputGroupAddon align="inline-end">
              {filter.query ? (
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => set({ query: '' })}>
                  <XIcon aria-hidden="true" />
                </InputGroupButton>
              ) : (
                <SlashHint />
              )}
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={1}
              value={filter.status}
              onValueChange={v => v && set({ status: v as RoomFilter['status'] })}
              aria-label="Availability"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              {(Object.keys(STATUS) as Availability[]).map(s => (
                <ToggleGroupItem key={s} value={s} title={STATUS[s].hint}>
                  {STATUS[s].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select
              label="Game mode"
              value={filter.mode}
              options={[['all', 'Every mode'], ...modes.map(m => [m, m] as const)]}
              onChange={v => set({ mode: v })}
            />
            {countries.length ? (
              <Select
                label="Country"
                value={filter.country}
                options={[['all', 'Every country'], ...countries.map(([code, name]) => [code, `${flag(code)} ${name}`] as const)]}
                onChange={v => set({ country: v })}
              />
            ) : null}
            <Select
              label="Sort rooms"
              value={filter.sort}
              options={[
                ['players', 'Most players'],
                ['newest', 'Newest'],
                ['races', 'Most races'],
                ['vr', 'Highest average VR'],
                ...(myVr ? ([['match', 'Closest to my VR']] as const) : []),
              ]}
              onChange={v => set({ sort: v as RoomFilter['sort'] })}
            />
            <div className="ml-auto">
              <RefreshBar updatedAt={rooms.updatedAt} busy={rooms.busy} onRefresh={rooms.refresh} auto="refreshes on its own" />
            </div>
          </div>
        </div>

        {rooms.error && !rooms.data ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Rooms didn’t load</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {rooms.error.message}
              <Button size="sm" variant="outline" onClick={rooms.refresh}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : rooms.loading ? (
          <div className="grid gap-3 xl:grid-cols-2" aria-busy="true" aria-label="Loading rooms">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[154px] rounded-xl" />
            ))}
          </div>
        ) : list.length ? (
          <>
            {rooms.error ? (
              <p className="text-muted-foreground text-[13px]">
                Couldn’t refresh just now, so these may be a little old. {rooms.error.message}
              </p>
            ) : null}
            <ul className="grid gap-3 xl:grid-cols-2" aria-label={`${list.length} rooms`}>
              {list.map(r => (
                <li key={r.id} className="flex">
                  <RoomCard
                    room={r}
                    me={me}
                    selected={r.id === selected}
                    getMii={getMii}
                    goodMatch={!!me && isGoodMatch(r, myVr)}
                    watched={r.players.filter(x => watch.watching(x.friendCode)).map(x => x.name)}
                    onSelect={() => onSelect(r.id === selected ? null : r.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty className="bg-card/60 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{filtered ? 'No rooms match' : 'Nobody’s in a room right now'}</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? 'Try another mode or clear the search.'
                  : 'Rooms show up here as soon as players go online. This page checks again every 15 seconds.'}
              </EmptyDescription>
            </EmptyHeader>
            {filtered ? (
              <EmptyContent>
                <Button variant="outline" onClick={() => setFilter(DEFAULT_FILTER)}>
                  Clear filters
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </div>
      {open && wide ? (
        <section
          aria-label="Room details"
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16 lg:max-h-[calc(100svh-5rem)] lg:self-start lg:overflow-y-auto"
        >
          <RoomDetails room={open} me={me} getMii={getMii} onClose={() => onSelect(null)} onPlayer={onPlayer} />
        </section>
      ) : null}
      {/* Phones and tablets: the room slides up from the bottom instead of landing under a long list. */}
      <Sheet open={!!open && !wide} onOpenChange={o => !o && onSelect(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[88svh] gap-0 overflow-y-auto rounded-t-2xl p-0">
          <SheetTitle className="sr-only">{open ? `${roomMode(open)}, room ${open.id}` : 'Room'}</SheetTitle>
          <SheetDescription className="sr-only">Who’s in the room, the last race and how to join.</SheetDescription>
          <div className="bg-muted mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full" aria-hidden="true" />
          {open ? <RoomDetails room={open} me={me} getMii={getMii} onClose={() => onSelect(null)} onPlayer={onPlayer} bare /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadge({ room }: { room: Room }) {
  const a = availability(room);
  const free = ROOM_SIZE - room.players.length;
  return (
    <Badge variant={a === 'open' ? 'default' : 'outline'} title={STATUS[a].hint}>
      {a === 'open' ? `${free} spot${free === 1 ? '' : 's'} open` : STATUS[a].label}
    </Badge>
  );
}

function Capacity({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${count} of ${ROOM_SIZE} players`}>
      <div className="flex h-2 w-full max-w-24 gap-0.5" aria-hidden="true">
        {Array.from({ length: ROOM_SIZE }, (_, i) => (
          <span key={i} className={cn('flex-1 rounded-[2px]', i < count ? 'bg-foreground/80' : 'bg-muted')} />
        ))}
      </div>
    </div>
  );
}

/** One room: what it is and whether you can get in, what's being raced, then the numbers in fixed columns. */
function RoomCard({
  room,
  me,
  selected,
  getMii,
  goodMatch,
  watched,
  onSelect,
}: {
  room: Room;
  me: string | null;
  selected: boolean;
  getMii: (fc: string) => string | undefined;
  goodMatch: boolean;
  watched: string[];
  onSelect: () => void;
}) {
  const now = useNow();
  const host = roomHost(room);
  const faces = [...room.players].sort((a, b) => (b.vr ?? 0) - (a.vr ?? 0)).slice(0, 5);
  const more = room.players.length - faces.length;
  const vrs = room.players.map(p => p.vr).filter((v): v is number => v != null);
  const mine = !!me && room.players.some(p => p.friendCode === me);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'bg-card flex h-full w-full cursor-pointer flex-col rounded-xl border text-left outline-none transition-[border-color,box-shadow,scale] duration-150 ease-(--ease-out) active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring/50',
        '[@media(hover:hover)]:hover:border-foreground/25',
        selected && 'border-foreground/50 ring-foreground/15 ring-2',
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{roomMode(room)}</span>
          <span className="text-muted-foreground font-mono text-xs tracking-wider">{room.id}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mine ? (
            <Badge variant="secondary">You’re here</Badge>
          ) : goodMatch ? (
            <Badge variant="secondary" title="Open, and the average VR is within 20% of yours">
              Good match
            </Badge>
          ) : null}
          <StatusBadge room={room} />
        </div>
      </div>

      <div className="flex min-h-[3.25rem] flex-col justify-center gap-0.5 px-4 py-3">
        <span className="text-muted-foreground text-xs">{room.race ? `Race ${room.race.num}` : 'Waiting to start'}</span>
        <span className="line-clamp-1 text-base font-medium" title={room.race?.trackName ?? undefined}>
          {room.race?.trackName || (room.race ? 'Track loading' : 'No race yet')}
        </span>
      </div>

      {watched.length ? (
        <p className="flex items-center gap-1.5 px-4 pb-3 text-[13px]">
          <StarIcon aria-hidden="true" className="size-3.5 shrink-0 fill-current" />
          <span className="truncate">
            {watched.slice(0, 2).join(', ')}
            {watched.length > 2 ? ` and ${watched.length - 2} more` : ''}
          </span>
        </p>
      ) : null}
      <dl className="mt-auto grid grid-cols-3 gap-3 border-t px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Players</dt>
          <dd className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold tabular-nums">
              {room.players.length}
              <span className="text-muted-foreground font-normal">/{ROOM_SIZE}</span>
            </span>
            <Capacity count={room.players.length} />
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Average VR</dt>
          <dd className="flex flex-col">
            <span className="text-sm font-semibold tabular-nums">{formatVr(room.averageVR)}</span>
            {vrs.length > 1 ? (
              <span className="text-muted-foreground truncate text-[11px] tabular-nums">
                {formatVr(Math.min(...vrs))} to {formatVr(Math.max(...vrs))}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Open for</dt>
          <dd className="text-sm font-semibold tabular-nums">{now ? duration(room.created, now) : '–'}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {host ? <PlayerAvatar name={host.name} src={getMii(host.friendCode)} className="size-6" /> : null}
          <span className="truncate text-[13px]">
            <span className="text-muted-foreground">Hosted by </span>
            {host?.name ?? 'unknown'}
          </span>
        </div>
        <div className="flex shrink-0 items-center [&>*+*]:-ml-1.5" aria-hidden="true">
          {faces.map(p => (
            <PlayerAvatar key={p.pid} name={p.name} src={getMii(p.friendCode)} className="ring-card size-6 ring-2" />
          ))}
          {more > 0 ? (
            <span className="bg-muted ring-card text-muted-foreground grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-2 tabular-nums">
              +{more}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function RoomDetails({
  room,
  me,
  getMii,
  onClose,
  onPlayer,
  bare = false,
}: {
  room: Room;
  me: string | null;
  getMii: (fc: string) => string | undefined;
  onClose: () => void;
  onPlayer: (fc: string) => void;
  /** Inside the phone sheet: no card border of its own. */
  bare?: boolean;
}) {
  const now = useNow();
  const host = roomHost(room);
  const players = [...room.players].sort((a, b) => (b.vr ?? 0) - (a.vr ?? 0));
  const a = availability(room);
  return (
    <div className={cn('flex flex-col', !bare && 'bg-card rounded-xl border')}>
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-lg font-semibold">{roomMode(room)}</h2>
          <div className="text-muted-foreground flex items-center gap-1 font-mono text-[13px]">
            Room {room.id}
            <CopyButton value={room.id} label="room code" />
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close room details" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4 text-sm">
        <div>
          <dt className="text-muted-foreground text-[13px]">Players</dt>
          <dd className="tabular-nums">
            {room.players.length} of {ROOM_SIZE}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[13px]">Status</dt>
          <dd>{STATUS[a].hint}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[13px]">Average VR</dt>
          <dd className="tabular-nums">{formatVr(room.averageVR)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[13px]">Open for</dt>
          <dd className="tabular-nums">{now ? duration(room.created, now) : '–'}</dd>
        </div>
        {room.race ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground text-[13px]">Now racing</dt>
            <dd>
              Race {room.race.num}
              {room.race.trackName ? `, ${room.race.trackName}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
      {host ? (
        <div className="bg-muted/50 mx-5 mb-4 flex flex-col gap-2 rounded-lg p-3 text-[13px]">
          <p>
            <span className="font-medium">Join {host.name}’s room:</span>{' '}
            <span className="text-muted-foreground">
              add their friend code in Mario Kart Wii, wait for them to add yours, then pick them from your friend roster.
            </span>
          </p>
          <CopyButton value={host.friendCode} label={`${host.name}’s friend code`} size="sm">
            Copy host’s friend code
          </CopyButton>
        </div>
      ) : null}
      <Separator />
      <RoomRaces room={room} onPlayer={onPlayer} />
      <Separator />
      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-1">
        <h3 className="text-sm font-medium">Players</h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() =>
            saveMiiZip(
              `Room ${room.id} Miis`,
              room.players.map(p => ({ name: p.name, mii: p.mii?.data })),
            )
          }
        >
          <FolderDownIcon data-icon="inline-start" aria-hidden="true" />
          All Miis (.zip)
        </Button>
      </div>
      <ul className="flex flex-col pb-1" aria-label="Players in this room">
        {players.map(p => (
          <li
            key={p.pid}
            className={cn(
              'hover:bg-muted/50 flex items-center gap-3 py-2 pr-3 pl-5 transition-colors',
              p.friendCode === me && 'bg-muted/60',
            )}
          >
            <PlayerAvatar name={p.name} src={getMii(p.friendCode)} className="size-8" />
            <button
              type="button"
              onClick={() => onPlayer(p.friendCode)}
              className="flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex max-w-full items-center gap-1.5 text-sm font-medium">
                <span className="truncate hover:underline">{p.name}</span>
                {p.friendCode === me ? <Badge className="h-4 px-1.5 text-[10px]">You</Badge> : null}
                {flag(p.countryAlpha2) ? <span title={p.countryName ?? undefined}>{flag(p.countryAlpha2)}</span> : null}
                {p.slotId === room.host ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CrownIcon aria-label="Host" className="text-muted-foreground size-3.5 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Room host</TooltipContent>
                  </Tooltip>
                ) : null}
              </span>
              <span className="text-muted-foreground font-mono text-xs">{p.friendCode}</span>
            </button>
            <span className="text-sm tabular-nums">{formatVr(p.vr)}</span>
            <div className="flex">
              <WatchButton fc={p.friendCode} name={p.name} />
              <MiiButton name={p.name} mii={p.mii?.data} />
              <CopyButton value={p.friendCode} label={`${p.name}’s friend code`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Laptop width and up, where the room panel sits beside the list (below it, it's a bottom sheet). */
function useWide() {
  return useSyncExternalStore(
    useCallback(cb => {
      const q = window.matchMedia('(min-width: 1024px)');
      q.addEventListener('change', cb);
      return () => q.removeEventListener('change', cb);
    }, []),
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true,
  );
}
