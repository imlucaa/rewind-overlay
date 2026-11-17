// Retro Rewind's public API (rwfc.net, source: github.com/Retro-Rewind-Team/rwfc-web). Every endpoint used here
// sends Access-Control-Allow-Origin: *, so the site calls it straight from the browser. Shapes follow the backend's
// DTOs (Backend/Models/DTOs); only the fields this site shows are typed.

export const API = 'https://rwfc.net/api';

export interface MiiRef {
  data: string;
  name: string;
}

export interface RoomPlayer {
  pid: string;
  name: string;
  friendCode: string;
  vr: number | null;
  br: number | null;
  isOpenHost: boolean;
  isSuspended: boolean;
  mii: MiiRef | null;
  slotId: string | null;
  countryAlpha2?: string | null;
  countryName?: string | null;
}

export interface Room {
  id: string;
  /** 'anybody' for public matchmaking rooms, 'private' for friend rooms. */
  type: string;
  created: string;
  /** The host's slot ID (a player's slotId). */
  host: string;
  rk: string | null;
  players: RoomPlayer[];
  averageVR: number | null;
  /** The race in progress: its number in the room (how many have been raced), track. */
  race: { num: number; course: number; cc: number; trackName: string | null } | null;
  /** The mode's name, like "Retro Tracks" (empty for unknown modes). */
  roomType: string;
  isPublic: boolean;
  /** Public, under 12 players and not suspended. */
  isJoinable: boolean;
  isSuspended: boolean;
}

export interface RoomStatus {
  rooms: Room[];
  timestamp: string;
  totalPlayers: number;
}

export interface RoomStats {
  totalPlayers: number;
  totalRooms: number;
  publicRooms: number;
  privateRooms: number;
  lastUpdated: string;
  peakPlayersToday: number;
  peakPlayersAllTime: number;
}

export interface VrStats {
  last24Hours: number;
  lastWeek: number;
  lastMonth: number;
}

export interface Player {
  pid: string;
  name: string;
  friendCode: string;
  vr: number;
  rank: number;
  lastSeen: string;
  isSuspicious: boolean;
  vrStats: VrStats;
  /** Only filled on single-player lookups; lists leave it null (use the batch Mii endpoint). */
  miiImageBase64: string | null;
  /** The Mii itself (74 bytes, base64), as the game stores it. */
  miiData?: string | null;
  vehiclePreference?: 'kart' | 'bike' | null;
  vehicleRank?: number | null;
  countryAlpha2?: string | null;
  countryName?: string | null;
}

export interface LeaderboardPage {
  players: Player[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  stats: { totalPlayers: number; lastUpdated: string };
}

export type LeaderboardSort = 'rank' | 'vr' | 'name' | 'lastSeen' | 'vrgain24' | 'vrgain7' | 'vrgain30';

export interface LeaderboardQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: LeaderboardSort;
  ascending: boolean;
  activeDays?: number | null;
  vehicle?: 'kart' | 'bike' | null;
}

export interface VrPoint {
  date: string;
  vrChange: number;
  totalVR: number;
}

export interface VrHistory {
  history: VrPoint[];
  totalVRChange: number;
  startingVR: number;
}

export interface RecentRace {
  trackName: string;
  courseId: number;
  finishTimeDisplay: string;
  characterName: string;
  vehicleName: string;
  timestamp: string;
  finishPos: number | null;
  playerCount: number;
  roomId: string;
  raceNumber: number;
  gameMode: string | null;
  isPublic: boolean | null;
}

export interface Setup {
  name: string;
  raceCount: number;
}

export interface RaceStats {
  totalRaces: number;
  trackedSince: string;
  topTracks: { trackName: string; raceCount: number; courseId: number }[];
  topCharacters: Setup[];
  topVehicles: Setup[];
  topCombos: Setup[];
  recentRaces: RecentRace[];
  currentPage: number;
  totalPages: number;
  totalRecentRaces: number;
}

/** One race and everyone in it, from /racestats/races. */
export interface RaceResult {
  roomId: string;
  raceNumber: number;
  timestamp: string;
  courseId: number;
  trackName: string;
  participants: {
    profileId: number;
    name: string;
    friendCode: string;
    finishPos: number | null;
    finishTimeDisplay: string;
    characterName: string;
    vehicleName: string;
  }[];
  gameMode: string | null;
  isPublic: boolean | null;
}

export interface Paged<T> {
  items: T[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

/** /racestats/player/{pid}/full: a player found by their player ID. */
export interface PlayerFull {
  pid: string;
  name: string;
  fc: string;
  vr: number;
  rank: number;
  lastSeen: string;
  vrGain24h: number;
  vrGain7d: number;
  vrGain30d: number;
}

export interface Analytics {
  /** Percent of tracked races won, 0–100. */
  winRate: number;
  finishPositionDistribution: { position: number; count: number }[];
  trackPerformance: { courseId: number; trackName: string; raceCount: number; winRate: number; avgFinishPos: number; lowSample: boolean }[];
}

/** The API answered "no such player/page" (404), as opposed to the network or server failing. */
export class NotFoundError extends Error {}

async function getJson<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Can’t reach Retro Rewind’s servers. Check your connection and try again.');
  }
  if (res.status === 404) throw new NotFoundError('Not found');
  if (!res.ok) throw new Error(`Retro Rewind’s servers answered with an error (${res.status}). Try again in a moment.`);
  // Every player name the API sends goes through plainName, so the site never shows emoji or symbols in names.
  return JSON.parse(await res.text(), (key, value) => (key === 'name' && typeof value === 'string' ? plainName(value) : value)) as T;
}

// Emoji, dingbats and symbol characters (✨ ★ ♥ ☆…), plus the joiners and variation selectors that build emoji.
const SYMBOLS = /[\p{Extended_Pictographic}\p{Emoji_Presentation}←-⇿⌀-⏿■-➿⬀-⯿︎️‍⃣]/gu;

/** A player name without emoji or symbols ("lex✨" is "lex"); a name that is only symbols stays as it is. */
export function plainName(name: string): string {
  const clean = name
    .replace(SYMBOLS, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clean || name;
}

export const getRooms = (signal?: AbortSignal) => getJson<RoomStatus>('/roomstatus', signal);
export const getRoomStats = (signal?: AbortSignal) => getJson<RoomStats>('/roomstatus/stats', signal);

export function getLeaderboard(q: LeaderboardQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({
    page: String(q.page),
    pageSize: String(q.pageSize),
    sortBy: q.sortBy,
    ascending: String(q.ascending),
  });
  if (q.search?.trim()) params.set('search', q.search.trim().slice(0, 100));
  if (q.activeDays) params.set('activeDays', String(q.activeDays));
  if (q.vehicle) params.set('vehicleFilter', q.vehicle);
  return getJson<LeaderboardPage>(`/leaderboard?${params}`, signal);
}

export const getPlayer = (fc: string, signal?: AbortSignal) => getJson<Player>(`/leaderboard/player/${encodeURIComponent(fc)}`, signal);
export const getPlayerByPid = (pid: string, signal?: AbortSignal) =>
  getJson<PlayerFull>(`/racestats/player/${encodeURIComponent(pid)}/full`, signal);
export const getVrHistory = (fc: string, days: number, signal?: AbortSignal) =>
  getJson<VrHistory>(`/leaderboard/player/${encodeURIComponent(fc)}/history?days=${days}`, signal);
export const getRaceStats = (pid: string, page: number, pageSize: number, signal?: AbortSignal) =>
  getJson<RaceStats>(`/racestats/player/${encodeURIComponent(pid)}?page=${page}&pageSize=${pageSize}`, signal);
/** A player's races, newest first, with every racer's result (5–50 a page). */
export const getRaces = (fc: string, page: number, pageSize: number, signal?: AbortSignal) =>
  getJson<Paged<RaceResult>>(`/racestats/races?friendCode=${encodeURIComponent(fc)}&page=${page}&pageSize=${pageSize}`, signal);
/** A room's races, newest first, with every racer's result. */
export const getRoomRaces = (roomId: string, pageSize: number, signal?: AbortSignal) =>
  getJson<Paged<RaceResult>>(`/racestats/races?roomId=${encodeURIComponent(roomId)}&page=1&pageSize=${pageSize}`, signal);
export const getAnalytics = (pid: string, signal?: AbortSignal) =>
  getJson<Analytics>(`/racestats/player/${encodeURIComponent(pid)}/analytics`, signal);

/** Mii portraits (PNG, base64) for up to 25 friend codes at once; players without one are left out. */
export async function getMiis(friendCodes: string[], signal?: AbortSignal): Promise<Record<string, string>> {
  const res = await getJson<{ miis: Record<string, string> }>('/leaderboard/miis/batch', signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendCodes }),
  });
  return res.miis ?? {};
}
export const MII_BATCH = 25;

// ---------- helpers (pure, tested) ----------

/** A friend code as 0000-0000-0000, from any spacing or dashes; null unless it has exactly 12 digits. */
export function normalizeFriendCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 12 || /\D/.test(text.replace(/[\s-]/g, ''))) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

/** What a search box holds: a friend code, a player ID (digits only, not 12), or a name. */
export function classifyQuery(
  text: string,
): { kind: 'fc'; fc: string } | { kind: 'pid'; pid: string } | { kind: 'name'; name: string } | null {
  const t = text.trim();
  if (!t) return null;
  const fc = normalizeFriendCode(t);
  if (fc) return { kind: 'fc', fc };
  if (/^\d{3,11}$/.test(t)) return { kind: 'pid', pid: t };
  return { kind: 'name', name: t };
}

export const roomHost = (room: Room) => room.players.find(p => p.slotId === room.host) ?? room.players[0] ?? null;

/** The mode's name, or what kind of room it is when the API has no mode for it. */
export const roomMode = (room: Room) => room.roomType || (room.isPublic ? 'Other mode' : 'Friend room');

export const ROOM_SIZE = 12;

export type Availability = 'open' | 'full' | 'friends';

/** Open: public with a free spot. Full: public with 12 players. Friends: a private room, joined through a friend. */
export function availability(room: Room): Availability {
  if (!room.isPublic) return 'friends';
  return room.isJoinable ? 'open' : 'full';
}

/** A country's flag emoji from its two-letter code ('' for anything else). */
export function flag(alpha2: string | null | undefined): string {
  if (!alpha2 || !/^[a-z]{2}$/i.test(alpha2)) return '';
  return String.fromCodePoint(...[...alpha2.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)));
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", against `now` (milliseconds). */
export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 60 ? `${d} day${d === 1 ? '' : 's'} ago` : `${Math.round(d / 30)} months ago`;
}

/** How long a room has been open: "12 min", "3 h 20 min". */
export function duration(iso: string, now: number): string {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export const formatVr = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('en-US'));
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US')}`;

export interface RoomFilter {
  query: string;
  mode: string;
  status: 'all' | Availability;
  country: string;
  sort: 'players' | 'newest' | 'races' | 'vr' | 'match';
}

/** How far a room's average VR is from yours, as a fraction of yours (0 = the same); Infinity without an average. */
export function vrDistance(room: Room, myVr: number): number {
  if (!room.averageVR || myVr <= 0) return Infinity;
  return Math.abs(room.averageVR - myVr) / myVr;
}

/** An open room whose average VR is within 20% of yours: you can join, and you're racing people your level. */
export const GOOD_MATCH = 0.2;
export const isGoodMatch = (room: Room, myVr: number | null | undefined) =>
  !!myVr && availability(room) === 'open' && vrDistance(room, myVr) <= GOOD_MATCH;

/**
 * Rooms matching a filter, sorted. The search matches the room code and every player's name, host first. "match"
 * sorts by how close each room's average VR is to `myVr` (and falls back to most players without one).
 */
export function filterRooms(rooms: Room[], f: RoomFilter, myVr?: number | null): Room[] {
  const q = f.query.trim().toLowerCase();
  const out = rooms.filter(
    room =>
      (f.mode === 'all' || roomMode(room) === f.mode) &&
      (f.status === 'all' || availability(room) === f.status) &&
      (f.country === 'all' || room.players.some(p => p.countryAlpha2 === f.country)) &&
      (!q || room.id.toLowerCase().includes(q) || room.players.some(p => p.name.toLowerCase().includes(q))),
  );
  const by: Record<RoomFilter['sort'], (a: Room, b: Room) => number> = {
    players: (a, b) => b.players.length - a.players.length,
    newest: (a, b) => Date.parse(b.created) - Date.parse(a.created),
    races: (a, b) => (b.race?.num ?? 0) - (a.race?.num ?? 0),
    vr: (a, b) => (b.averageVR ?? 0) - (a.averageVR ?? 0),
    match: (a, b) => (myVr ? vrDistance(a, myVr) - vrDistance(b, myVr) || 0 : b.players.length - a.players.length),
  };
  // Open rooms first within the chosen order, so the ones you can join are on top.
  const rank = (r: Room) => ({ open: 0, full: 1, friends: 2 })[availability(r)];
  return out.sort((a, b) => rank(a) - rank(b) || by[f.sort](a, b) || a.id.localeCompare(b.id));
}

// ---------- Mii files ----------

/** A Wii Mii is 74 bytes (RFLCharData); the .mii files Mii tools and Dolphin read are exactly that. */
export const MII_SIZE = 74;

/** The raw Mii from its base64 form, or null if it isn't one. */
export function miiBytes(base64: string | null | undefined): Uint8Array<ArrayBuffer> | null {
  if (!base64) return null;
  try {
    const bin = atob(base64);
    if (bin.length !== MII_SIZE) return null;
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A file name from a player name: characters Windows refuses become _, never empty. */
export function safeFileName(name: string): string {
  const clean = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim();
  return clean || 'Mii';
}
