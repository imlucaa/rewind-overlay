'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, DoorOpenIcon, FlagIcon, UserRoundXIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { rememberMii, useMiis, useNow, useRemote } from '@/hooks/useRwfc';
import {
  flag,
  formatVr,
  getAnalytics,
  getPlayer,
  getRaceStats,
  getRaces,
  getVrHistory,
  NotFoundError,
  roomMode,
  timeAgo,
  type RaceStats,
  type RaceResult,
  type Room,
} from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';
import { FinishChart, ordinal, VrChart } from './charts';
import { CopyButton, Gain, MiiActions, PlayerAvatar, Stat, WatchButton } from './shared';
import type { Recent } from './PlayersView';
import { CompareButton } from './Compare';

const RACES_PAGE = 10;

interface Props {
  fc: string;
  /** Live rooms, to tell whether this player is online now. */
  rooms: Room[] | null;
  onLoaded: (player: Recent) => void;
  onPlayer: (fc: string) => void;
  onRoom: (room: string) => void;
  onCompare: (vs: string) => void;
}

/** Everything rwfc.net knows about one player: rank and VR, VR history, results and recent races. */
export function PlayerProfile({ fc, rooms, onLoaded, onPlayer, onRoom, onCompare }: Props) {
  const player = useRemote(`player:${fc}`, signal => getPlayer(fc, signal));
  const p = player.data && !player.stale ? player.data : null;
  const [days, setDays] = useState('30');
  const history = useRemote(p ? `history:${fc}:${days}` : null, signal => getVrHistory(fc, Number(days), signal));
  const analytics = useRemote(p ? `analytics:${p.pid}` : null, signal => getAnalytics(p!.pid, signal));
  // Totals and favourite setups (its own race list stops at five, so match history pages through /racestats/races).
  const races = useRemote(p ? `racestats:${p.pid}` : null, signal => getRaceStats(p!.pid, 1, 5, signal));
  const now = useNow();
  const getMii = useMiis(p ? [fc] : []);
  const loaded = useRef(onLoaded);
  useEffect(() => {
    loaded.current = onLoaded;
  });

  useEffect(() => {
    if (!p) return;
    rememberMii(p.friendCode, p.miiImageBase64);
    loaded.current({ fc: p.friendCode, name: p.name });
  }, [p]);

  const inRoom = useMemo(() => rooms?.find(r => r.players.some(x => x.friendCode === fc)) ?? null, [rooms, fc]);

  if (player.error && player.error instanceof NotFoundError)
    return (
      <Empty className="bg-card/60 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRoundXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No ranked player with that friend code</EmptyTitle>
          <EmptyDescription>
            {fc} hasn’t raced online in Retro Rewind yet, or the code has a typo. Players appear after their first online race.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (player.error && !p)
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>This profile didn’t load</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {player.error.message}
          <Button size="sm" variant="outline" onClick={player.refresh}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!p) return <ProfileSkeleton />;

  const stats: RaceStats | null = races.data && !races.error ? races.data : null;
  const noRaces = races.error instanceof NotFoundError || (stats && stats.totalRaces === 0);

  return (
    <article className="flex flex-col gap-4" aria-label={`${p.name}’s profile`}>
      <header className="bg-card flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center">
        <PlayerAvatar name={p.name} src={getMii(p.friendCode)} className="size-20 sm:size-24" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold tracking-[-0.02em]">{p.name}</h2>
            {flag(p.countryAlpha2) ? <span title={p.countryName ?? undefined}>{flag(p.countryAlpha2)}</span> : null}
            <CopyButton value={p.name} label="name" />
            {p.isSuspicious ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline">
                    <FlagIcon data-icon="inline-start" aria-hidden="true" />
                    Flagged
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Retro Rewind flagged this player’s VR for unusual jumps</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="flex items-center gap-0.5 font-mono">
              FC {p.friendCode}
              <CopyButton value={p.friendCode} label="friend code" />
            </span>
            <span className="flex items-center gap-0.5 font-mono">
              ID {p.pid}
              <CopyButton value={p.pid} label="player ID" />
            </span>
          </div>
          {inRoom ? (
            <button
              type="button"
              onClick={() => onRoom(inRoom.id)}
              className="hover:bg-muted flex w-fit cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[13px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="bg-gain size-2 rounded-full" aria-hidden="true" />
              Online now in {roomMode(inRoom)}, room {inRoom.id}
              <DoorOpenIcon aria-hidden="true" className="text-muted-foreground size-3.5" />
            </button>
          ) : (
            <span className="text-muted-foreground text-[13px]">Last seen online {now ? timeAgo(p.lastSeen, now) : ''}</span>
          )}
        </div>
        <div className="sm:self-start">
          <div className="flex flex-wrap gap-2">
            <WatchButton fc={p.friendCode} name={p.name} size="sm" />
            <CompareButton fc={p.friendCode} name={p.name} onCompare={onCompare} />
            <MiiActions name={p.name} mii={p.miiData} fc={p.friendCode} />
          </div>
        </div>
      </header>

      <div className="bg-card grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rank">#{p.rank.toLocaleString('en-US')}</Stat>
        <Stat label="VR">{formatVr(p.vr)}</Stat>
        <Stat label="Last 24 h">
          <Gain value={p.vrStats.last24Hours} />
        </Stat>
        <Stat label="Last 7 days">
          <Gain value={p.vrStats.lastWeek} />
        </Stat>
        <Stat label="Win rate" hint="Races finished 1st, of every race rwfc.net tracked">
          {analytics.data ? `${analytics.data.winRate.toFixed(1)}%` : analytics.loading ? <Skeleton className="h-7 w-14" /> : '–'}
        </Stat>
        <Stat label="Races tracked">{stats ? formatVr(stats.totalRaces) : races.loading ? <Skeleton className="h-7 w-14" /> : '–'}</Stat>
      </div>

      <section className="bg-card flex flex-col gap-4 rounded-xl border p-5" aria-labelledby="vr-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 id="vr-title" className="font-medium">
              VR
            </h3>
            {history.data && !history.stale ? (
              <span className="text-muted-foreground text-[13px]">
                <Gain value={history.data.totalVRChange} /> over the last {days} days
              </span>
            ) : null}
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={days}
            onValueChange={v => v && setDays(v)}
            aria-label="Time range"
          >
            <ToggleGroupItem value="7">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30">30 days</ToggleGroupItem>
            <ToggleGroupItem value="90">90 days</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {history.loading ? (
          <Skeleton className="h-52" />
        ) : history.data && history.data.history.length > 1 ? (
          <div className={cn('transition-opacity', history.stale && 'opacity-50')}>
            <VrChart history={history.data.history} />
          </div>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {history.error && !(history.error instanceof NotFoundError) ? history.error.message : `No VR changes in the last ${days} days.`}
          </p>
        )}
      </section>

      {noRaces ? (
        <p className="text-muted-foreground bg-card/60 rounded-xl border border-dashed px-5 py-6 text-sm">
          rwfc.net hasn’t tracked any races for {p.name} yet, so there are no results, tracks or match history to show.
        </p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="bg-card flex flex-col gap-4 rounded-xl border p-5" aria-labelledby="finish-title">
              <div className="flex flex-col gap-0.5">
                <h3 id="finish-title" className="font-medium">
                  Finishing places
                </h3>
                <span className="text-muted-foreground text-[13px]">How often they finish in each place</span>
              </div>
              {analytics.data ? (
                <FinishChart positions={analytics.data.finishPositionDistribution} />
              ) : analytics.loading ? (
                <Skeleton className="h-36" />
              ) : (
                <p className="text-muted-foreground text-sm">{analytics.error?.message ?? 'No results yet.'}</p>
              )}
            </section>
            <section className="bg-card flex flex-col gap-4 rounded-xl border p-5" aria-labelledby="tracks-title">
              <div className="flex flex-col gap-0.5">
                <h3 id="tracks-title" className="font-medium">
                  Most raced tracks
                </h3>
                {stats?.topCombos[0] ? (
                  <span className="text-muted-foreground text-[13px]">Usually races {stats.topCombos[0].name}</span>
                ) : null}
              </div>
              {analytics.data?.trackPerformance.length ? (
                <ul className="flex flex-col gap-2.5 text-sm">
                  {[...analytics.data.trackPerformance]
                    .sort((a, b) => b.raceCount - a.raceCount)
                    .slice(0, 6)
                    .map(t => (
                      <li key={t.courseId} className="flex items-center justify-between gap-3">
                        <span className="truncate">{t.trackName}</span>
                        <span className="text-muted-foreground shrink-0 text-[13px] tabular-nums">
                          {t.raceCount} races, {t.winRate.toFixed(0)}% won
                        </span>
                      </li>
                    ))}
                </ul>
              ) : analytics.loading ? (
                <Skeleton className="h-36" />
              ) : (
                <p className="text-muted-foreground text-sm">No tracks yet.</p>
              )}
            </section>
          </div>

          <MatchHistory fc={p.friendCode} onPlayer={onPlayer} />
        </>
      )}
    </article>
  );
}

/** A player's races, newest first, ten at a time; each one opens to the full results. */
function MatchHistory({ fc, onPlayer }: { fc: string; onPlayer: (fc: string) => void }) {
  const [pages, setPages] = useState(1);
  const first = useRemote(`races:${fc}:1`, signal => getRaces(fc, 1, RACES_PAGE, signal));
  const total = first.data?.totalCount ?? 0;
  return (
    <section className="bg-card flex flex-col rounded-xl border" aria-labelledby="races-title">
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="races-title" className="font-medium">
            Match history
          </h3>
          <span className="text-muted-foreground text-[13px]">Open a race to see everyone’s result</span>
        </div>
        {first.data ? <span className="text-muted-foreground text-[13px] tabular-nums">{formatVr(total)} races</span> : null}
      </div>
      <Separator />
      {first.loading ? (
        <div className="flex flex-col gap-1 p-3" aria-busy="true" aria-label="Loading races">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : first.error && !first.data ? (
        <div className="text-muted-foreground flex items-center justify-between gap-3 p-5 text-sm">
          {first.error instanceof NotFoundError ? 'No races tracked yet.' : first.error.message}
          {first.error instanceof NotFoundError ? null : (
            <Button size="sm" variant="outline" onClick={first.refresh}>
              Try again
            </Button>
          )}
        </div>
      ) : first.data?.items.length ? (
        <ul className="flex flex-col">
          {first.data.items.map(r => (
            <RaceRow key={`${r.roomId}-${r.raceNumber}-${r.timestamp}`} race={r} fc={fc} onPlayer={onPlayer} />
          ))}
          {Array.from({ length: pages - 1 }, (_, i) => (
            <RacePage key={i} fc={fc} page={i + 2} onPlayer={onPlayer} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground p-5 text-sm">No races tracked yet.</p>
      )}
      {pages * RACES_PAGE < total ? (
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setPages(n => n + 1)}>
            Show more races
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** One more page of races, loaded when it's added to the list. */
function RacePage({ fc, page, onPlayer }: { fc: string; page: number; onPlayer: (fc: string) => void }) {
  const races = useRemote(`races:${fc}:${page}`, signal => getRaces(fc, page, RACES_PAGE, signal));
  if (races.loading)
    return (
      <li className="flex flex-col gap-1 p-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </li>
    );
  if (races.error && !races.data)
    return (
      <li className="text-muted-foreground flex items-center justify-between gap-3 border-b px-5 py-3 text-sm">
        {races.error.message}
        <Button size="sm" variant="outline" onClick={races.refresh}>
          Try again
        </Button>
      </li>
    );
  return (races.data?.items ?? []).map(r => (
    <RaceRow key={`${r.roomId}-${r.raceNumber}-${r.timestamp}`} race={r} fc={fc} onPlayer={onPlayer} />
  ));
}

function RaceRow({ race: r, fc, onPlayer }: { race: RaceResult; fc: string; onPlayer: (fc: string) => void }) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const me = r.participants.find(x => x.friendCode === fc);
  const finishers = [...r.participants].sort((a, b) => (a.finishPos ?? 99) - (b.finishPos ?? 99));
  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="hover:bg-muted/40 focus-visible:bg-muted/50 flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left outline-none transition-colors"
      >
        <span
          className={cn('grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums', 'bg-muted')}
          aria-label={me?.finishPos ? `Finished ${ordinal(me.finishPos)} of ${r.participants.length}` : 'No finish'}
        >
          {me?.finishPos ? ordinal(me.finishPos) : '–'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{r.trackName}</span>
          <span className="text-muted-foreground truncate text-[13px]">
            {me ? `${me.characterName}, ${me.vehicleName}` : ''}
            {r.gameMode ? `${me ? ', ' : ''}${r.gameMode}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-[13px] tabular-nums">
          <span>{me?.finishTimeDisplay ?? '–'}</span>
          <span className="text-muted-foreground">
            of {r.participants.length}, {now ? timeAgo(r.timestamp, now) : ''}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn('text-muted-foreground size-4 shrink-0 transition-transform duration-200 ease-(--ease-out)', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <ol className="bg-muted/30 flex flex-col border-t px-5 py-2" aria-label={`Results, race ${r.raceNumber} in room ${r.roomId}`}>
          {finishers.map(x => (
            <li key={x.profileId} className="flex items-center gap-3 py-1.5 text-[13px]">
              <span className="text-muted-foreground w-9 tabular-nums">{x.finishPos ? ordinal(x.finishPos) : '–'}</span>
              {x.friendCode === fc ? (
                <span className="min-w-0 flex-1 truncate font-semibold">{x.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPlayer(x.friendCode)}
                  className="min-w-0 flex-1 cursor-pointer truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {x.name}
                </button>
              )}
              <span className="text-muted-foreground hidden truncate sm:block">
                {x.characterName}, {x.vehicleName}
              </span>
              <span className="w-16 text-right tabular-nums">{x.finishTimeDisplay}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the profile">
      <div className="bg-card flex items-center gap-5 rounded-xl border p-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
