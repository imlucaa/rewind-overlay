'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRightIcon, GitCompareArrowsIcon, SearchIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { rememberMii, useMiis, useRemote, useWatchlist } from '@/hooks/useRwfc';
import { formatVr, getAnalytics, getPlayer, getRaceStats, NotFoundError, signed, type Analytics, type Player } from '@/lib/rwfc/api';
import { searchPlayers } from '@/lib/rwfc/search';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './shared';

// ---------- picking who to compare with ----------

/** "Compare" on a profile: pick a second player by search or from your watch list. */
export function CompareButton({ fc, name, onCompare }: { fc: string; name: string; onCompare: (vs: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const { list } = useWatchlist();

  useEffect(() => {
    const next = text.trim();
    if (next === query) return;
    const id = window.setTimeout(() => setQuery(next), 250);
    return () => window.clearTimeout(id);
  }, [text, query]);

  const results = useRemote(open && query ? `compare-search:${query}` : null, signal => searchPlayers(query, signal));
  const hits = (query ? (results.data ?? []) : list.map(w => ({ fc: w.fc, name: w.name, rank: 0, vr: 0, gain24: null }))).filter(
    h => h.fc !== fc,
  );
  const getMii = useMiis(useMemo(() => hits.map(h => h.fc), [hits]));
  const pick = (vs: string) => {
    setOpen(false);
    setText('');
    onCompare(vs);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <GitCompareArrowsIcon data-icon="inline-start" aria-hidden="true" />
        Compare
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compare {name} with</DialogTitle>
            <DialogDescription>
              Search by name, friend code or player ID{list.length ? ', or pick someone you watch' : ''}.
            </DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              type="search"
              aria-label="Find a player to compare with"
              placeholder="Name, friend code or player ID"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && hits[0] && query === text.trim()) pick(hits[0].fc);
              }}
            />
          </InputGroup>
          <div className="max-h-80 min-h-24 overflow-y-auto">
            {query && (query !== text.trim() || results.loading) ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : results.error && query ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{results.error.message}</p>
            ) : hits.length ? (
              <ul className="flex flex-col">
                {!query ? <li className="text-muted-foreground px-2 pb-1 text-xs">Watching</li> : null}
                {hits.map(h => (
                  <li key={h.fc}>
                    <button
                      type="button"
                      onClick={() => pick(h.fc)}
                      className="hover:bg-muted focus-visible:bg-muted flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors"
                    >
                      <PlayerAvatar name={h.name} src={getMii(h.fc)} className="size-8" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{h.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">{h.fc}</span>
                      </span>
                      {h.vr ? <span className="text-sm font-semibold tabular-nums">{formatVr(h.vr)} VR</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {query ? 'No player found.' : 'Type a name, a friend code or a player ID.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- the comparison ----------

interface Side {
  player: Player | null;
  analytics: Analytics | null;
  races: number | null;
  loading: boolean;
  error: Error | null;
}

function useSide(fc: string): Side {
  const player = useRemote(`player:${fc}`, signal => getPlayer(fc, signal));
  const p = player.data && !player.stale ? player.data : null;
  const analytics = useRemote(p ? `analytics:${p.pid}` : null, signal => getAnalytics(p!.pid, signal));
  const races = useRemote(p ? `racestats:${p.pid}` : null, signal => getRaceStats(p!.pid, 1, 5, signal));
  useEffect(() => {
    if (p) rememberMii(p.friendCode, p.miiImageBase64);
  }, [p]);
  return {
    player: p,
    analytics: analytics.data,
    races: races.data?.totalRaces ?? (races.error instanceof NotFoundError ? 0 : null),
    loading: player.loading,
    error: player.error,
  };
}

/** Share of tracked races finished in the top 3, and the average place, from the finish distribution. */
function placings(a: Analytics | null) {
  if (!a) return { podium: null, average: null };
  const total = a.finishPositionDistribution.reduce((n, d) => n + d.count, 0);
  if (!total) return { podium: null, average: null };
  const podium = a.finishPositionDistribution.filter(d => d.position <= 3).reduce((n, d) => n + d.count, 0) / total;
  const average = a.finishPositionDistribution.reduce((n, d) => n + d.position * d.count, 0) / total;
  return { podium: podium * 100, average };
}

interface Metric {
  label: string;
  a: number | null;
  b: number | null;
  show: (v: number) => string;
  /** Which way is better: higher numbers (VR, win rate) or lower (rank, average place). */
  better: 'high' | 'low';
}

export function CompareView({
  a,
  b,
  onSwap,
  onChange,
  onClose,
  onPlayer,
}: {
  a: string;
  b: string;
  onSwap: () => void;
  onChange: (vs: string) => void;
  onClose: () => void;
  onPlayer: (fc: string) => void;
}) {
  const left = useSide(a);
  const right = useSide(b);
  const getMii = useMiis([a, b]);

  if (left.error || right.error) {
    const err = left.error ?? right.error!;
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Couldn’t load both players</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {err instanceof NotFoundError ? 'One of these friend codes isn’t on the leaderboard.' : err.message}
          <Button size="sm" variant="outline" onClick={onClose}>
            Back to the profile
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!left.player || !right.player) return <Skeleton className="h-[480px] rounded-xl" />;

  const lp = placings(left.analytics);
  const rp = placings(right.analytics);
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const metrics: Metric[] = [
    { label: 'Rank', a: left.player.rank, b: right.player.rank, show: v => `#${v.toLocaleString('en-US')}`, better: 'low' },
    { label: 'VR', a: left.player.vr, b: right.player.vr, show: formatVr, better: 'high' },
    { label: 'Last 24 h', a: left.player.vrStats.last24Hours, b: right.player.vrStats.last24Hours, show: signed, better: 'high' },
    { label: 'Last 7 days', a: left.player.vrStats.lastWeek, b: right.player.vrStats.lastWeek, show: signed, better: 'high' },
    { label: 'Last 30 days', a: left.player.vrStats.lastMonth, b: right.player.vrStats.lastMonth, show: signed, better: 'high' },
    { label: 'Win rate', a: left.analytics?.winRate ?? null, b: right.analytics?.winRate ?? null, show: pct, better: 'high' },
    { label: 'Top 3 finishes', a: lp.podium, b: rp.podium, show: pct, better: 'high' },
    { label: 'Average place', a: lp.average, b: rp.average, show: v => v.toFixed(2), better: 'low' },
    { label: 'Races tracked', a: left.races, b: right.races, show: formatVr, better: 'high' },
  ];
  const winner = (m: Metric): 'a' | 'b' | null => {
    if (m.a == null || m.b == null || m.a === m.b) return null;
    return (m.better === 'high' ? m.a > m.b : m.a < m.b) ? 'a' : 'b';
  };

  // Tracks both of them race, by how often they race them together.
  const shared = (() => {
    const theirs = new Map((right.analytics?.trackPerformance ?? []).map(t => [t.courseId, t]));
    return (left.analytics?.trackPerformance ?? [])
      .filter(t => theirs.has(t.courseId))
      .map(t => ({ track: t.trackName, a: t, b: theirs.get(t.courseId)! }))
      .sort((x, y) => y.a.raceCount + y.b.raceCount - (x.a.raceCount + x.b.raceCount))
      .slice(0, 8);
  })();

  const head = (p: Player) => (
    <button
      type="button"
      onClick={() => onPlayer(p.friendCode)}
      className="hover:bg-muted/50 flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-lg p-2 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <PlayerAvatar name={p.name} src={getMii(p.friendCode)} className="size-16" />
      <span className="max-w-full truncate font-semibold">{p.name}</span>
      <span className="text-muted-foreground font-mono text-xs">{p.friendCode}</span>
    </button>
  );

  return (
    <article className="flex flex-col gap-4" aria-label={`${left.player.name} compared with ${right.player.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon data-icon="inline-start" aria-hidden="true" />
          Close comparison
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSwap}>
            <ArrowLeftRightIcon data-icon="inline-start" aria-hidden="true" />
            Swap sides
          </Button>
          <CompareButton fc={a} name={left.player.name} onCompare={onChange} />
        </div>
      </div>

      <section className="bg-card overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b p-4">
          {head(left.player)}
          <span className="text-muted-foreground text-sm font-medium">vs</span>
          {head(right.player)}
        </div>
        <dl className="flex flex-col">
          {metrics.map(m => {
            const w = winner(m);
            return (
              <div key={m.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-4 py-2.5 last:border-b-0">
                <dd className={cn('text-right tabular-nums', w === 'a' ? 'font-semibold' : 'text-muted-foreground')}>
                  {m.a == null ? '–' : m.show(m.a)}
                  {w === 'a' ? <span className="sr-only"> (better)</span> : null}
                </dd>
                <dt className="text-muted-foreground w-32 text-center text-[13px]">{m.label}</dt>
                <dd className={cn('tabular-nums', w === 'b' ? 'font-semibold' : 'text-muted-foreground')}>
                  {m.b == null ? '–' : m.show(m.b)}
                  {w === 'b' ? <span className="sr-only"> (better)</span> : null}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="bg-card flex flex-col gap-3 rounded-xl border p-5" aria-labelledby="shared-title">
        <div className="flex flex-col gap-0.5">
          <h3 id="shared-title" className="font-medium">
            Tracks they both race
          </h3>
          <span className="text-muted-foreground text-[13px]">Win rate on each, from every race rwfc.net tracked</span>
        </div>
        {shared.length ? (
          <ul className="flex flex-col">
            {shared.map(t => (
              <li
                key={t.a.courseId}
                className="grid grid-cols-[1fr_auto_minmax(0,2fr)_auto] items-center gap-3 border-b py-2 text-sm last:border-b-0"
              >
                <span className={cn('text-right tabular-nums', t.a.winRate > t.b.winRate ? 'font-semibold' : 'text-muted-foreground')}>
                  {t.a.winRate.toFixed(0)}%
                </span>
                <span aria-hidden="true" />
                <span className="truncate text-center">{t.track}</span>
                <span className={cn('tabular-nums', t.b.winRate > t.a.winRate ? 'font-semibold' : 'text-muted-foreground')}>
                  {t.b.winRate.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        ) : left.analytics && right.analytics ? (
          <p className="text-muted-foreground text-sm">No tracks in common yet.</p>
        ) : (
          <Skeleton className="h-32" />
        )}
      </section>
    </article>
  );
}
