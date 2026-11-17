// Finding a player from whatever was typed: a friend code, a player ID or (part of) a name.

import { classifyQuery, getLeaderboard, getPlayer, getPlayerByPid, NotFoundError } from './api.ts';

/** One search hit, shaped the same whichever way it was found. */
export interface Hit {
  fc: string;
  name: string;
  rank: number;
  vr: number;
  gain24: number | null;
}

export async function searchPlayers(text: string, signal: AbortSignal): Promise<Hit[]> {
  const q = classifyQuery(text);
  if (!q) return [];
  try {
    if (q.kind === 'fc') {
      const p = await getPlayer(q.fc, signal);
      return [{ fc: p.friendCode, name: p.name, rank: p.rank, vr: p.vr, gain24: p.vrStats.last24Hours }];
    }
    if (q.kind === 'pid') {
      // Digits could be a player ID or part of a name, so try both and show whatever exists.
      const [byId, byName] = await Promise.allSettled([
        getPlayerByPid(q.pid, signal),
        getLeaderboard({ page: 1, pageSize: 8, search: q.pid, sortBy: 'rank', ascending: true }, signal),
      ]);
      const hits: Hit[] = [];
      if (byId.status === 'fulfilled')
        hits.push({ fc: byId.value.fc, name: byId.value.name, rank: byId.value.rank, vr: byId.value.vr, gain24: byId.value.vrGain24h });
      if (byName.status === 'fulfilled')
        for (const p of byName.value.players)
          if (!hits.some(h => h.fc === p.friendCode))
            hits.push({ fc: p.friendCode, name: p.name, rank: p.rank, vr: p.vr, gain24: p.vrStats.last24Hours });
      if (!hits.length && byId.status === 'rejected' && !(byId.reason instanceof NotFoundError)) throw byId.reason;
      return hits;
    }
    const page = await getLeaderboard({ page: 1, pageSize: 8, search: q.name, sortBy: 'rank', ascending: true }, signal);
    return page.players.map(p => ({ fc: p.friendCode, name: p.name, rank: p.rank, vr: p.vr, gain24: p.vrStats.last24Hours }));
  } catch (err) {
    if (err instanceof NotFoundError) return [];
    throw err;
  }
}
