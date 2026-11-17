'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getMiis, MII_BATCH, normalizeFriendCode, plainName } from '@/lib/rwfc/api';
import { defaults, load, STORE_KEY } from '@/lib/overlay/settings';
import { useStoredState } from '@/hooks/useStoredState';

interface Loaded<T> {
  key: string;
  data: T | null;
  error: Error | null;
  at: number;
}

/**
 * Data from rwfc.net for `key` (null loads nothing). The last result stays on screen while a new key or a refresh
 * loads, so pages and filters don't flash empty. With `refreshMs` it reloads on that interval while the browser tab
 * is visible, and once more when the tab comes back. Requests a newer one replaces are cancelled.
 */
export function useRemote<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, refreshMs?: number) {
  const [state, setState] = useState<Loaded<T> | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    let started = false;
    // Async from here on: no state is set synchronously in the effect.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      started = true;
      setBusy(true);
      try {
        const data = await loadRef.current(controller.signal);
        if (!controller.signal.aborted) setState({ key, data, error: null, at: Date.now() });
      } catch (err) {
        if (!controller.signal.aborted)
          setState(prev => ({
            key,
            // Keep what was showing for this same key, so a failed refresh doesn't wipe the page.
            data: prev?.key === key ? prev.data : null,
            error: err instanceof Error ? err : new Error(String(err)),
            at: prev?.key === key ? prev.at : 0,
          }));
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    });
    return () => {
      controller.abort();
      if (started) setBusy(false);
    };
  }, [key, tick]);

  useEffect(() => {
    if (!refreshMs || key === null) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick(t => t + 1);
    }, refreshMs);
    const onVisible = () => document.visibilityState === 'visible' && setTick(t => t + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshMs, key]);

  const current = state && state.key === key ? state : null;
  return {
    /** This key's data, or the previous key's while the new one loads (check `stale`). */
    data: current?.data ?? state?.data ?? null,
    stale: !current,
    error: current?.error ?? null,
    /** Nothing to show yet for this key. */
    loading: key !== null && !current?.data && !current?.error,
    busy,
    updatedAt: current?.at ?? 0,
    refresh: useCallback(() => setTick(t => t + 1), []),
  };
}

// ---------- Mii portraits ----------

// Friend code -> data URL ('' when the player has no Mii image). Shared by every view, kept for the visit.
const miis = new Map<string, string>();
const wanted = new Set<string>();
const miiListeners = new Set<() => void>();
let miiVersion = 0;
let flushTimer = 0;

function notifyMiis() {
  miiVersion++;
  for (const l of miiListeners) l();
}

async function flushMiis() {
  flushTimer = 0;
  const codes = [...wanted].filter(fc => !miis.has(fc));
  wanted.clear();
  for (let i = 0; i < codes.length; i += MII_BATCH) {
    const chunk = codes.slice(i, i + MII_BATCH);
    // Mark as asked first, so a failure doesn't retry in a loop; the initials fallback shows instead.
    for (const fc of chunk) miis.set(fc, '');
    try {
      const found = await getMiis(chunk);
      for (const [fc, b64] of Object.entries(found)) if (b64) miis.set(fc, `data:image/png;base64,${b64}`);
    } catch {
      // No portraits this time.
    }
    notifyMiis();
  }
}

/** Seeds a portrait the API already sent (single-player lookups include one). */
export function rememberMii(fc: string, base64: string | null | undefined) {
  if (!base64 || miis.get(fc)) return;
  miis.set(fc, `data:image/png;base64,${base64}`);
  notifyMiis();
}

/** Mii portraits for these friend codes, fetched in batches of 25 the first time each is asked for. */
export function useMiis(friendCodes: readonly string[]) {
  useSyncExternalStore(
    useCallback(cb => {
      miiListeners.add(cb);
      return () => miiListeners.delete(cb);
    }, []),
    () => miiVersion,
    () => 0,
  );
  const joined = friendCodes.join(',');
  useEffect(() => {
    let added = false;
    for (const fc of joined ? joined.split(',') : []) {
      if (!miis.has(fc)) {
        wanted.add(fc);
        added = true;
      }
    }
    if (added && !flushTimer) flushTimer = window.setTimeout(() => void flushMiis(), 30);
  }, [joined]);
  return (fc: string): string | undefined => miis.get(fc) || undefined;
}

// ---------- a clock for "5 min ago" labels ----------

const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer = 0;

/** The time, updated every 15 seconds while something on the page shows relative times. */
export function useNow() {
  return useSyncExternalStore(
    useCallback(cb => {
      clockListeners.add(cb);
      if (!clockTimer) {
        clockNow = Date.now();
        clockTimer = window.setInterval(() => {
          clockNow = Date.now();
          for (const l of clockListeners) l();
        }, 15000);
      }
      return () => {
        clockListeners.delete(cb);
        if (!clockListeners.size) {
          window.clearInterval(clockTimer);
          clockTimer = 0;
        }
      };
    }, []),
    () => clockNow || Date.now(),
    () => 0,
  );
}

// ---------- where you are: ?tab=…&fc=…&room=… ----------

export type OnlineTab = 'rooms' | 'leaderboard' | 'players';

export interface OnlineRoute {
  tab: OnlineTab;
  /** The open player profile (friend code). */
  fc: string | null;
  /** The selected room. */
  room: string | null;
  /** The player compared with the open profile. */
  vs: string | null;
}

const TABS: OnlineTab[] = ['rooms', 'leaderboard', 'players'];
const routeListeners = new Set<() => void>();
let routeCache: { search: string; route: OnlineRoute } | null = null;

function readRoute(): OnlineRoute {
  const search = window.location.search;
  if (routeCache?.search === search) return routeCache.route;
  const q = new URLSearchParams(search);
  const tab = q.get('tab') as OnlineTab;
  const route = { tab: TABS.includes(tab) ? tab : 'rooms', fc: q.get('fc'), room: q.get('room'), vs: q.get('vs') };
  routeCache = { search, route };
  return route;
}

const SERVER_ROUTE: OnlineRoute = { tab: 'rooms', fc: null, room: null, vs: null };

/** The Online page's tab, open profile and selected room, kept in the address so links and Back work. */
export function useOnlineRoute() {
  const route = useSyncExternalStore(
    useCallback(cb => {
      routeListeners.add(cb);
      window.addEventListener('popstate', cb);
      return () => {
        routeListeners.delete(cb);
        window.removeEventListener('popstate', cb);
      };
    }, []),
    readRoute,
    () => SERVER_ROUTE,
  );
  const go = useCallback((next: Partial<OnlineRoute>, replace = false) => {
    const merged = { ...readRoute(), ...next };
    const q = new URLSearchParams();
    if (merged.tab !== 'rooms') q.set('tab', merged.tab);
    if (merged.fc) q.set('fc', merged.fc);
    if (merged.room) q.set('room', merged.room);
    if (merged.vs && merged.fc) q.set('vs', merged.vs);
    const url = `${window.location.pathname}${q.size ? `?${q}` : ''}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    for (const l of routeListeners) l();
  }, []);
  return [route, go] as const;
}

// ---------- you ----------

/** The friend code saved in the overlay settings on this site, or null: used to find and highlight "you". */
export function useMyFriendCode(): string | null {
  const [settings] = useStoredState(STORE_KEY, load, defaults);
  return normalizeFriendCode(settings.player.friendCode);
}

// ---------- the watch list ----------

export interface Watched {
  fc: string;
  name: string;
}

const parseWatched = (raw: string | null): Watched[] => {
  try {
    const list = raw ? (JSON.parse(raw) as Watched[]) : [];
    return Array.isArray(list)
      ? list.filter(w => w && typeof w.fc === 'string' && typeof w.name === 'string').map(w => ({ ...w, name: plainName(w.name) }))
      : [];
  } catch {
    return [];
  }
};
const noWatched = (): Watched[] => [];
const parseFlag = (raw: string | null) => raw === 'true';
const off = () => false;

/** Players you starred, kept in this browser, and whether to notify you when one comes online. */
export function useWatchlist() {
  const [list, setList] = useStoredState('rewind-online-watch', parseWatched, noWatched);
  const [notify, setNotify] = useStoredState('rewind-online-notify', parseFlag, off);
  const toggle = useCallback(
    (player: Watched) =>
      setList(current =>
        current.some(w => w.fc === player.fc) ? current.filter(w => w.fc !== player.fc) : [...current, player].slice(-50),
      ),
    [setList],
  );
  return { list, watching: (fc: string) => list.some(w => w.fc === fc), toggle, notify, setNotify };
}
