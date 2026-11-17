import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availability,
  classifyQuery,
  duration,
  filterRooms,
  flag,
  isGoodMatch,
  vrDistance,
  miiBytes,
  safeFileName,
  normalizeFriendCode,
  plainName,
  roomHost,
  roomMode,
  signed,
  timeAgo,
  type Room,
} from './api.ts';

const player = (name: string, slotId: string, extra: Partial<Room['players'][number]> = {}): Room['players'][number] => ({
  pid: slotId,
  name,
  friendCode: '0000-0000-0000',
  vr: 5000,
  br: 5000,
  isOpenHost: false,
  isSuspended: false,
  mii: null,
  slotId,
  ...extra,
});

const room = (id: string, extra: Partial<Room> = {}): Room => ({
  id,
  type: 'anybody',
  created: '2026-11-16T10:00:00Z',
  host: '1',
  rk: 'vs_10',
  players: [player('Alpha', '1'), player('Bravo', '2')],
  averageVR: 5000,
  race: null,
  roomType: 'Retro Tracks',
  isPublic: true,
  isJoinable: true,
  isSuspended: false,
  ...extra,
});

test('friend codes and search kinds', () => {
  assert.equal(normalizeFriendCode('317131713171'), '3171-3171-3171');
  assert.equal(normalizeFriendCode(' 3171 3171-3171 '), '3171-3171-3171');
  assert.equal(normalizeFriendCode('3171-3171-317'), null);
  assert.equal(normalizeFriendCode('abc317131713171'), null);
  assert.deepEqual(classifyQuery('3137-3137-3137'), { kind: 'fc', fc: '3137-3137-3137' });
  assert.deepEqual(classifyQuery('198760529'), { kind: 'pid', pid: '198760529' });
  assert.deepEqual(classifyQuery(' lex '), { kind: 'name', name: 'lex' });
  assert.deepEqual(classifyQuery('42'), { kind: 'name', name: '42' });
  assert.equal(classifyQuery('   '), null);
});

test('room host, mode and availability', () => {
  const r = room('A', { host: '2' });
  assert.equal(roomHost(r)?.name, 'Bravo');
  assert.equal(roomHost(room('B', { host: '9' }))?.name, 'Alpha');
  assert.equal(roomMode(room('C', { roomType: '', isPublic: false, type: 'private' })), 'Friend room');
  assert.equal(availability(room('D', { isPublic: false })), 'friends');
  assert.equal(availability(room('E', { isJoinable: false })), 'full');
  assert.equal(availability(room('F')), 'open');
});

test('room filters and sorting keep open rooms first', () => {
  const rooms = [
    room('FULL', { isJoinable: false, players: Array.from({ length: 12 }, (_, i) => player(`P${i}`, String(i))) }),
    room('SMALL', { players: [player('Zed', '1')], created: '2026-11-16T12:00:00Z' }),
    room('BIG', {
      players: [player('Yan', '1'), player('Xu', '2'), player('Wu', '3')],
      race: { num: 40, course: 1, cc: 2, trackName: 'x' },
    }),
    room('PRIV', { isPublic: false, type: 'private', roomType: '' }),
  ];
  const base = { query: '', mode: 'all', status: 'all' as const, country: 'all', sort: 'players' as const };
  assert.deepEqual(
    filterRooms(rooms, base).map(r => r.id),
    ['BIG', 'SMALL', 'FULL', 'PRIV'],
  );
  assert.deepEqual(
    filterRooms(rooms, { ...base, sort: 'newest' })
      .map(r => r.id)
      .slice(0, 2),
    ['SMALL', 'BIG'],
  );
  assert.deepEqual(
    filterRooms(rooms, { ...base, query: 'xu' }).map(r => r.id),
    ['BIG'],
  );
  assert.deepEqual(
    filterRooms(rooms, { ...base, query: 'smal' }).map(r => r.id),
    ['SMALL'],
  );
  assert.deepEqual(
    filterRooms(rooms, { ...base, status: 'friends' }).map(r => r.id),
    ['PRIV'],
  );
  assert.deepEqual(
    filterRooms(rooms, { ...base, mode: 'Friend room' }).map(r => r.id),
    ['PRIV'],
  );
});

test('formatting', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  assert.equal(timeAgo('2026-11-16T11:59:50Z', now), 'just now');
  assert.equal(timeAgo('2026-11-16T11:55:00Z', now), '5 min ago');
  assert.equal(timeAgo('2026-11-16T09:00:00Z', now), '3 h ago');
  assert.equal(timeAgo('2026-11-15T12:00:00Z', now), '1 day ago');
  assert.equal(duration('2026-11-16T08:40:00Z', now), '3 h 20 min');
  assert.equal(duration('2026-11-16T11:48:00Z', now), '12 min');
  assert.equal(signed(1234), '+1,234');
  assert.equal(signed(-50), '−50');
  assert.equal(signed(0), '0');
  assert.equal(flag('gb'), '🇬🇧');
  assert.equal(flag(null), '');
});

test('Mii data and file names', () => {
  const raw = Uint8Array.from({ length: 74 }, (_, i) => i);
  const b64 = Buffer.from(raw).toString('base64');
  assert.deepEqual(miiBytes(b64), raw);
  assert.equal(miiBytes(Buffer.from(raw.subarray(0, 73)).toString('base64')), null);
  assert.equal(miiBytes('not base64!!'), null);
  assert.equal(miiBytes(null), null);
  assert.equal(safeFileName('lex✨'), 'lex✨');
  assert.equal(safeFileName('a/b:c?'), 'a_b_c_');
  assert.equal(safeFileName('x\\y'), 'x_y');
  assert.equal(safeFileName('tab\there'), 'tab_here');
  assert.equal(safeFileName('dots...'), 'dots');
  assert.equal(safeFileName('   '), 'Mii');
});

test('rooms that match your VR', () => {
  const near = room('NEAR', { averageVR: 10500 });
  const far = room('FAR', { averageVR: 30000 });
  const fullNear = room('FULLNEAR', { averageVR: 10000, isJoinable: false });
  const none = room('NONE', { averageVR: null });
  assert.equal(vrDistance(near, 10000), 0.05);
  assert.equal(vrDistance(none, 10000), Infinity);
  assert.equal(isGoodMatch(near, 10000), true);
  assert.equal(isGoodMatch(far, 10000), false);
  assert.equal(isGoodMatch(fullNear, 10000), false);
  assert.equal(isGoodMatch(near, null), false);
  const base = { query: '', mode: 'all', status: 'all' as const, country: 'all', sort: 'match' as const };
  assert.deepEqual(
    filterRooms([far, none, near], base, 10000).map(r => r.id),
    ['NEAR', 'FAR', 'NONE'],
  );
});

test('names without emoji or symbols', () => {
  assert.equal(plainName('lex✨'), 'lex');
  assert.equal(plainName('EcCo★'), 'EcCo');
  assert.equal(plainName('¿★ghost★?'), '¿ghost?');
  assert.equal(plainName('ωK'), 'ωK');
  assert.equal(plainName('登山　'), '登山');
  assert.equal(plainName('Clεmγ'), 'Clεmγ');
  assert.equal(plainName('Mr ❤️ Kart'), 'Mr Kart');
  assert.equal(plainName('👍🏽'), '👍🏽');
  assert.equal(plainName('A-B_C 123'), 'A-B_C 123');
});
