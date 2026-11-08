import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { parseTrackList } from './tracks.ts';
import { filesFor, newAssignment, planPack, type Assignments } from './pack.ts';
import { crc32, ZipWriter } from './zip.ts';
import { fromFileName, readTags } from './tags.ts';
import type { SongInfo } from './library.ts';

const list = parseTrackList(readFileSync(new URL('../../../public/data/rr-tracks.tsv', import.meta.url), 'utf8'));
const byName = (name: string) => list.tracks.find(t => t.name === name);

test('reads the Retro Rewind 6.13.4 track list', () => {
  assert.equal(list.version, '6.13.4');
  assert.ok(list.tracks.length > 350, String(list.tracks.length));
  assert.equal(new Set(list.tracks.map(t => t.file)).size, list.tracks.length);
  const counts = Object.groupBy(list.tracks, t => t.category);
  assert.ok((counts.original?.length ?? 0) >= 30 && (counts.original?.length ?? 0) <= 34, String(counts.original?.length));
  assert.ok(counts.battle?.length);
});

test('track files and final lap files follow the strm folder', () => {
  assert.equal(byName('SNES Mario Circuit 1')?.file, '0_N');
  assert.equal(byName('SNES Mario Circuit 1')?.category, 'retro');
  const sw2 = list.tracks.find(t => t.file === 'sw2MC1_N');
  assert.equal(sw2?.variantOf, 'SNES Mario Circuit 1');
  assert.ok(list.tracks.some(t => t.finalFile === '55_Final'));
  const final = list.tracks.find(t => t.finalFile)!;
  assert.deepEqual(filesFor(final).map(f => f.rate), [32000, 33920]);
});

test('one encode per song and settings, however many tracks share it', () => {
  const song: SongInfo = { id: 's', title: 'T', artist: '', fileName: 't.mp3', duration: 700, size: 1, type: 'audio/mpeg', addedAt: 0 };
  const [a, b, c] = list.tracks;
  const assignments: Assignments = { [a.file]: newAssignment('s'), [b.file]: newAssignment('s'), [c.file]: { ...newAssignment('s'), speed: 1.5 } };
  assignments.ghost = newAssignment('gone');
  const { jobs, problems } = planPack([...list.tracks, { ...a, file: 'ghost' }], assignments, new Map([['s', song]]));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].tracks.length, 2);
  assert.deepEqual(problems.map(p => p.kind).sort(), ['long-song', 'missing-song']);
});

test('zip: CRCs match zlib and the layout is a valid archive', async () => {
  const data = new TextEncoder().encode('hello brstm');
  assert.equal(crc32(data), nodeCrc32(data));
  const zip = new ZipWriter();
  zip.add('RetroRewind6/Patches/0_N.brstm', data);
  zip.add('README.txt', data);
  const bytes = Buffer.from(await zip.blob().arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 10), 2);
  assert.equal(bytes.readUInt32LE(bytes.readUInt32LE(end + 16)), 0x02014b50);
});

test('tags: ID3v2.3 title and artist, file name fallback', () => {
  const frame = (id: string, text: string) => {
    const body = Buffer.concat([Buffer.from([3]), Buffer.from(text, 'utf8')]);
    const h = Buffer.alloc(10);
    h.write(id, 0);
    h.writeUInt32BE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  const frames = Buffer.concat([frame('TIT2', 'Coconut Mall'), frame('TPE1', 'Nintendo')]);
  const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, (frames.length >> 7) & 0x7f, frames.length & 0x7f]);
  assert.deepEqual(readTags(Buffer.concat([header, frames]), 'x.mp3'), { title: 'Coconut Mall', artist: 'Nintendo' });
  assert.deepEqual(fromFileName('Artist - Song_Name.flac'), { artist: 'Artist', title: 'Song Name' });
});

test('lap 3 speed: a final lap file only when needed, named as Retro Rewind expects', () => {
  const plain = list.tracks.find(t => !t.finalFile && t.file === '0_N')!;
  assert.deepEqual(filesFor(plain, { finalSpeed: 1.06 }).map(f => f.name), ['0_N.brstm']);
  assert.deepEqual(filesFor(plain, { finalSpeed: 1.2 }), [{ name: '0_N.brstm', rate: 32000 }, { name: '0_Final.brstm', rate: 38400, final: true }]);
  assert.deepEqual(filesFor(plain, { finalSpeed: 1 }).map(f => f.rate), [32000, 32000]);
  const own = list.tracks.find(t => t.finalFile === '55_Final')!;
  assert.deepEqual(filesFor(own, { finalSpeed: 1.25 }), [{ name: '55_N.brstm', rate: 32000 }, { name: '55_Final.brstm', rate: 40000, final: true }]);
});

test('lap 3 song: the final lap file is made from the other song, at the final lap speed', () => {
  const info = (id: string): SongInfo => ({ id, title: id, artist: '', fileName: id + '.mp3', duration: 90, size: 1, type: 'audio/mpeg', addedAt: 0 });
  const plain = list.tracks.find(t => t.file === '0_N')!;
  const own = list.tracks.find(t => t.finalFile === '55_Final')!;
  const assignments: Assignments = {
    [plain.file]: { ...newAssignment('main'), speed: 1.2, finalSongId: 'fast' },
    [own.file]: { ...newAssignment('main'), finalSongId: 'gone' },
  };
  const { jobs, problems } = planPack([plain, own], assignments, new Map([['main', info('main')], ['fast', info('fast')]]));
  const fast = jobs.find(j => j.song.id === 'fast')!;
  assert.deepEqual(fast.files, [{ name: '0_Final.brstm', rate: 33920, final: true }]);
  assert.equal(fast.assignment.speed, 1.2);
  assert.equal(fast.assignment.loop, null);
  // a removed lap 3 song falls back to the main song, and says so
  assert.ok(jobs.some(j => j.song.id === 'main' && j.files.some(f => f.name === '55_Final.brstm')));
  assert.deepEqual(problems.map(p => p.kind), ['missing-final-song']);
  assert.ok(!jobs.some(j => j.song.id === 'main' && j.files.some(f => f.name === '0_Final.brstm')));
});

test('menus and fanfares: in Patches under the game’s names, no final lap, jingles play once', () => {
  const title = list.tracks.find(t => t.file === 'title_bg')!;
  const jingle = list.tracks.find(t => t.file === 'o_FanfareGP1_only32')!;
  const results = list.tracks.find(t => t.file === 'o_FanfareGP1_32')!;
  assert.equal(title.category, 'menu');
  assert.equal(list.tracks.filter(t => t.category === 'menu').length, 6);
  assert.equal(list.tracks.filter(t => t.category === 'fanfare').length, 26);
  assert.deepEqual(filesFor(title, { finalSpeed: 1.25, finalSongId: 'x' }).map(f => f.name), ['title_bg.brstm']);
  const song: SongInfo = { id: 's', title: 'T', artist: '', fileName: 't.mp3', duration: 30, size: 1, type: 'audio/mpeg', addedAt: 0 };
  const assignments: Assignments = {
    [jingle.file]: { ...newAssignment('s'), loop: { start: 2, end: 20 }, finalSongId: 's2' },
    [results.file]: newAssignment('s'),
  };
  const { jobs, problems } = planPack([jingle, results], assignments, new Map([['s', song]]));
  assert.deepEqual(problems, []);
  const once = jobs.find(j => j.assignment.playsOnce)!;
  assert.deepEqual(once.files.map(f => f.name), ['o_FanfareGP1_only32.brstm']);
  assert.equal(once.assignment.loop, null);
  assert.ok(jobs.some(j => !j.assignment.playsOnce && j.files[0].name === 'o_FanfareGP1_32.brstm'));
});
