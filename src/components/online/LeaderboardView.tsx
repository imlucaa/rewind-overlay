'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  LocateFixedIcon,
  FolderDownIcon,
  MonitorPlayIcon,
  SearchIcon,
  TrophyIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStoredState } from '@/hooks/useStoredState';
import { useMiis, useMyFriendCode, useNow, useRemote } from '@/hooks/useRwfc';
import { flag, formatVr, getLeaderboard, getPlayer, NotFoundError, timeAgo, type LeaderboardSort, type Player } from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Gain, MiiButton, PlayerAvatar, RefreshBar, saveMiiZip, SlashHint, useSlashFocus, WatchButton } from './shared';

const PAGE_SIZE = 50;

interface Prefs {
  sortBy: LeaderboardSort;
  ascending: boolean;
  vehicle: 'all' | 'kart' | 'bike';
  active: 'all' | '7' | '30';
}
const DEFAULT_PREFS: Prefs = { sortBy: 'rank', ascending: true, vehicle: 'all', active: 'all' };
const parsePrefs = (raw: string | null): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
};
const defaultPrefs = () => DEFAULT_PREFS;

// Columns you can sort by, and which way each starts (biggest first, except rank and names).
const COLUMNS: { sort: LeaderboardSort; label: string; ascending: boolean; className?: string }[] = [
  { sort: 'rank', label: 'Rank', ascending: true, className: 'w-16' },
  { sort: 'name', label: 'Player', ascending: true },
  { sort: 'vr', label: 'VR', ascending: false, className: 'text-right' },
  { sort: 'vrgain24', label: '24 h', ascending: false, className: 'text-right' },
  { sort: 'vrgain7', label: '7 days', ascending: false, className: 'text-right max-md:hidden' },
  { sort: 'vrgain30', label: '30 days', ascending: false, className: 'text-right max-lg:hidden' },
  { sort: 'lastSeen', label: 'Last seen', ascending: false, className: 'text-right max-sm:hidden' },
];

interface Props {
  /** The open profile's friend code, highlighted when it's on the page. */
  current: string | null;
  onPlayer: (fc: string) => void;
}

/** Retro Rewind's VR rankings, 50 to a page, searchable and sortable on the server. */
export function LeaderboardView({ current, onPlayer }: Props) {
  const [prefs, setPrefs] = useStoredState('rewind-online-leaderboard', parsePrefs, defaultPrefs);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const me = useMyFriendCode();
  const mine = useRemote(me ? `me:${me}` : null, signal => getPlayer(me!, signal), 60000);
  const searchBox = useRef<HTMLInputElement>(null);
  useSlashFocus(searchBox);
  // After "Show my row", scroll to it once its page has loaded.
  const jumpTo = useRef<string | null>(null);

  // The server searches, so wait for a pause in typing.
  useEffect(() => {
    const next = search.trim();
    if (next === query) return;
    const id = window.setTimeout(() => {
      setQuery(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search, query]);

  const request = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: query,
      sortBy: prefs.sortBy,
      ascending: prefs.ascending,
      activeDays: prefs.active === 'all' ? null : Number(prefs.active),
      vehicle: prefs.vehicle === 'all' ? null : prefs.vehicle,
    }),
    [page, query, prefs],
  );
  const board = useRemote(JSON.stringify(request), signal => getLeaderboard(request, signal), 60000);
  const players = useMemo(() => board.data?.players ?? [], [board.data]);
  const getMii = useMiis(useMemo(() => players.map(p => p.friendCode), [players]));
  const ranked = prefs.sortBy === 'rank' && prefs.ascending;
  const podium = ranked && page === 1 && !query && !board.stale && players.length >= 3;
  const filtered = !!query || prefs.vehicle !== 'all' || prefs.active !== 'all';
  const totalPages = board.data?.totalPages ?? 1;

  useEffect(() => {
    const fc = jumpTo.current;
    if (!fc || board.stale || !players.some(x => x.friendCode === fc)) return;
    jumpTo.current = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`lb-${fc}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [players, board.stale]);

  const [jump, setJump] = useState('');
  const goToPage = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.round(Number(jump));
    if (n >= 1 && n <= totalPages) setPage(n);
    setJump('');
  };

  const sortBy = (col: (typeof COLUMNS)[number]) => {
    setPrefs(p => (p.sortBy === col.sort ? { ...p, ascending: !p.ascending } : { ...p, sortBy: col.sort, ascending: col.ascending }));
    setPage(1);
  };

  // Jumps to the page your rank is on (ranks count from the whole board, so filters and search are cleared).
  const findMe = async () => {
    if (!me) return;
    setFinding(true);
    try {
      const player = await getPlayer(me);
      setPrefs(p => ({ ...p, sortBy: 'rank', ascending: true, vehicle: 'all', active: 'all' }));
      setSearch('');
      setQuery('');
      setPage(Math.max(1, Math.ceil(player.rank / PAGE_SIZE)));
      jumpTo.current = me;
      toast(`You’re #${player.rank.toLocaleString('en-US')}`, { description: `${player.name}, ${formatVr(player.vr)} VR` });
    } catch {
      toast.error('Couldn’t find you on the board', { description: `No ranked player has the friend code ${me}.` });
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchBox}
            type="search"
            aria-label="Search the leaderboard"
            placeholder="Search players by name"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('');
              if (e.key === 'Enter' && players[0] && !board.stale) onPlayer(players[0].friendCode);
            }}
          />
          <InputGroupAddon align="inline-end">
            {search ? (
              <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setSearch('')}>
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
            value={prefs.vehicle}
            onValueChange={v => {
              if (!v) return;
              setPrefs(p => ({ ...p, vehicle: v as Prefs['vehicle'] }));
              setPage(1);
            }}
            aria-label="Vehicle"
          >
            <ToggleGroupItem value="all">Everyone</ToggleGroupItem>
            <ToggleGroupItem value="kart" title="Players who mostly race karts">
              Karts
            </ToggleGroupItem>
            <ToggleGroupItem value="bike" title="Players who mostly race bikes">
              Bikes
            </ToggleGroupItem>
          </ToggleGroup>
          <Select
            label="Active players"
            value={prefs.active}
            options={[
              ['all', 'Any time'],
              ['7', 'Raced this week'],
              ['30', 'Raced this month'],
            ]}
            onChange={v => {
              setPrefs(p => ({ ...p, active: v }));
              setPage(1);
            }}
          />
          <div className="ml-auto">
            <RefreshBar updatedAt={board.updatedAt} busy={board.busy} onRefresh={board.refresh} />
          </div>
        </div>
      </div>

      {board.error && !board.data ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>The leaderboard didn’t load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {board.error.message}
            <Button size="sm" variant="outline" onClick={board.refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {me ? (
        <div className="bg-card flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border px-4 py-3">
          {mine.data ? (
            <>
              <PlayerAvatar name={mine.data.name} src={getMii(me)} className="size-10" />
              <div className="flex min-w-0 flex-col">
                <span className="text-muted-foreground text-[13px]">Your position</span>
                <span className="truncate font-semibold">{mine.data.name}</span>
              </div>
              <div className="flex items-baseline gap-4 text-sm tabular-nums">
                <span className="text-lg font-semibold">#{mine.data.rank.toLocaleString('en-US')}</span>
                <span>{formatVr(mine.data.vr)} VR</span>
                <span>
                  <Gain value={mine.data.vrStats.last24Hours} /> <span className="text-muted-foreground">in 24 h</span>
                </span>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onPlayer(me)}>
                  Profile
                </Button>
                <Button size="sm" onClick={findMe} disabled={finding}>
                  <LocateFixedIcon data-icon="inline-start" aria-hidden="true" />
                  {finding ? 'Finding' : 'Show my row'}
                </Button>
              </div>
            </>
          ) : mine.error ? (
            <span className="text-muted-foreground text-sm">
              {mine.error instanceof NotFoundError
                ? `Your friend code ${me} isn’t on the leaderboard yet. It shows up after your first online race.`
                : mine.error.message}
            </span>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-[13px]">
          Add your friend code in the overlay settings to see your own position here.
          <Button variant="ghost" size="xs" asChild>
            <Link href="/">
              <MonitorPlayIcon data-icon="inline-start" aria-hidden="true" />
              Open the overlay settings
            </Link>
          </Button>
        </p>
      )}

      {podium ? <Podium players={players.slice(0, 3)} getMii={getMii} onPlayer={onPlayer} me={me} current={current} /> : null}

      {board.loading ? (
        <div className="bg-card flex flex-col gap-1 rounded-xl border p-3" aria-busy="true" aria-label="Loading the leaderboard">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : board.data && !players.length ? (
        <Empty className="bg-card/60 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No players found</EmptyTitle>
            <EmptyDescription>
              {query ? `Nobody on the board is called “${query}”.` : 'No ranked players match these filters.'}
            </EmptyDescription>
          </EmptyHeader>
          {filtered ? (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setPrefs(p => ({ ...p, vehicle: 'all', active: 'all' }));
                }}
              >
                Clear search and filters
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : players.length ? (
        <div className={cn('bg-card overflow-clip rounded-xl border transition-opacity duration-150', board.stale && 'opacity-60')}>
          {/* overflow: clip (not hidden or auto) on both boxes, so the header can stick under the top bar while you scroll. */}
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="bg-card sticky top-16 z-10 shadow-[0_1px_0_var(--border)]">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map(col => {
                  const active = prefs.sortBy === col.sort;
                  return (
                    <TableHead
                      key={col.sort}
                      className={cn('h-10', col.className)}
                      aria-sort={active ? (prefs.ascending ? 'ascending' : 'descending') : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(col)}
                        className={cn(
                          'hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          active ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {col.label}
                        {active ? (
                          prefs.ascending ? (
                            <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                          ) : (
                            <ArrowDownIcon aria-hidden="true" className="size-3.5" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="w-20">
                  <span className="sr-only">Watch and Mii</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(podium ? players.slice(3) : players).map(p => (
                <LeaderboardRow
                  key={p.pid}
                  player={p}
                  src={getMii(p.friendCode)}
                  me={p.friendCode === me}
                  open={p.friendCode === current}
                  query={query}
                  onPlayer={onPlayer}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {board.data && totalPages > 1 ? (
        <nav aria-label="Leaderboard pages" className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatVr(board.data.totalCount)} players, page {page.toLocaleString('en-US')} of {totalPages.toLocaleString('en-US')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              saveMiiZip(
                `Leaderboard page ${page} Miis`,
                players.map(x => ({ name: x.name, mii: x.miiData })),
              )
            }
          >
            <FolderDownIcon data-icon="inline-start" aria-hidden="true" />
            Miis on this page (.zip)
          </Button>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" aria-label="First page" disabled={page <= 1} onClick={() => setPage(1)}>
              <ChevronsLeftIcon aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
            <form onSubmit={goToPage} className="ml-1 flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={totalPages}
                value={jump}
                onChange={e => setJump(e.target.value)}
                placeholder="Page"
                aria-label={`Go to page (1 to ${totalPages})`}
                className="h-8 w-20 tabular-nums"
              />
              <Button type="submit" variant="ghost" size="sm" disabled={!jump}>
                Go
              </Button>
            </form>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function LeaderboardRow({
  player: p,
  src,
  me,
  open,
  query,
  onPlayer,
}: {
  player: Player;
  src?: string;
  me: boolean;
  open: boolean;
  query: string;
  onPlayer: (fc: string) => void;
}) {
  const now = useNow();
  return (
    <TableRow
      id={`lb-${p.friendCode}`}
      onClick={() => onPlayer(p.friendCode)}
      data-state={open ? 'selected' : undefined}
      className={cn('cursor-pointer', me && 'bg-muted/60')}
    >
      <TableCell className="text-muted-foreground font-medium tabular-nums">{p.rank.toLocaleString('en-US')}</TableCell>
      <TableCell className="max-w-0 w-full">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={p.name} src={src} className="size-8" />
          <div className="flex min-w-0 flex-col">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onPlayer(p.friendCode);
              }}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="truncate">
                <Highlight text={p.name} query={query} />
              </span>
              {flag(p.countryAlpha2) ? <span title={p.countryName ?? undefined}>{flag(p.countryAlpha2)}</span> : null}
            </button>
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {me ? <Badge className="h-4 px-1.5 text-[10px]">You</Badge> : null}
              {p.vehiclePreference ? `${p.vehiclePreference === 'bike' ? 'Bike' : 'Kart'} racer` : null}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{formatVr(p.vr)}</TableCell>
      <TableCell className="text-right">
        <Gain value={p.vrStats.last24Hours} />
      </TableCell>
      <TableCell className="text-right max-md:hidden">
        <Gain value={p.vrStats.lastWeek} />
      </TableCell>
      <TableCell className="text-right max-lg:hidden">
        <Gain value={p.vrStats.lastMonth} />
      </TableCell>
      <TableCell className="text-muted-foreground text-right text-[13px] max-sm:hidden">{now ? timeAgo(p.lastSeen, now) : ''}</TableCell>
      <TableCell className="py-0 pr-2">
        <div className="flex justify-end">
          <WatchButton fc={p.friendCode} name={p.name} />
          <MiiButton name={p.name} mii={p.miiData} />
        </div>
      </TableCell>
    </TableRow>
  );
}

const PLACE = ['1st', '2nd', '3rd'];

/** The top three, second-first-third like a real podium on wide screens, first on top on phones. */
function Podium({
  players,
  getMii,
  onPlayer,
  me,
  current,
}: {
  players: Player[];
  getMii: (fc: string) => string | undefined;
  onPlayer: (fc: string) => void;
  me: string | null;
  current: string | null;
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:items-end" aria-label="Top three">
      {players.map((p, i) => (
        <li key={p.pid} className={cn(i === 0 ? 'sm:order-2' : i === 1 ? 'sm:order-1' : 'sm:order-3')}>
          <button
            type="button"
            onClick={() => onPlayer(p.friendCode)}
            className={cn(
              'bg-card flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border px-4 text-center outline-none transition-[border-color,scale] duration-150 ease-(--ease-out) active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:border-foreground/25',
              i === 0 ? 'border-foreground/30 py-7 shadow-sm' : 'py-5',
              (p.friendCode === current || p.friendCode === me) && 'ring-foreground/15 ring-2',
            )}
          >
            <span className={cn('font-semibold tabular-nums', i === 0 ? 'text-foreground text-sm' : 'text-muted-foreground text-[13px]')}>
              {PLACE[i]}
            </span>
            <PlayerAvatar name={p.name} src={getMii(p.friendCode)} className={i === 0 ? 'size-20' : 'size-16'} />
            <span className="flex max-w-full flex-col gap-0.5">
              <span className={cn('truncate font-semibold', i === 0 ? 'text-lg' : 'text-base')}>
                {p.name} {flag(p.countryAlpha2)}
              </span>
              <span className={cn('font-semibold tracking-[-0.01em] tabular-nums', i === 0 ? 'text-2xl' : 'text-xl')}>
                {formatVr(p.vr)} VR
              </span>
              <span className="text-[13px]">
                <Gain value={p.vrStats.last24Hours} /> <span className="text-muted-foreground">in 24 h</span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The text with the part matching the search in bold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="text-foreground bg-transparent font-bold">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}
