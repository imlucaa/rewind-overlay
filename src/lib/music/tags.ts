// Song title and artist from the file's own tags: ID3v2 (MP3), Vorbis comments (FLAC, OGG Vorbis, Opus).
// Anything else falls back to the file name, read as "Artist - Title" when it has that shape.

export interface SongTags {
  title: string;
  artist: string;
}

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

function id3Text(frame: Uint8Array): string {
  const encoding = frame[0];
  const body = frame.subarray(1);
  const text =
    encoding === 1 || encoding === 2
      ? new TextDecoder(encoding === 2 || (body[0] === 0xfe && body[1] === 0xff) ? 'utf-16be' : 'utf-16le').decode(body)
      : encoding === 3
        ? utf8.decode(body)
        : latin1.decode(body);
  return text.replace(/^﻿/, '').replace(/\0.*$/s, '').trim();
}

function readId3(bytes: Uint8Array): Partial<SongTags> {
  const major = bytes[3];
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const end = Math.min(bytes.length, 10 + size);
  const out: Partial<SongTags> = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 10;
  if (bytes[5] & 0x40) at += major === 4 ? ((bytes[10] & 0x7f) << 21) | ((bytes[11] & 0x7f) << 14) | ((bytes[12] & 0x7f) << 7) | (bytes[13] & 0x7f) : 4 + view.getUint32(10);
  while (at + 10 <= end) {
    const id = latin1.decode(bytes.subarray(at, at + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize =
      major === 4
        ? ((bytes[at + 4] & 0x7f) << 21) | ((bytes[at + 5] & 0x7f) << 14) | ((bytes[at + 6] & 0x7f) << 7) | (bytes[at + 7] & 0x7f)
        : view.getUint32(at + 4);
    const frame = bytes.subarray(at + 10, Math.min(end, at + 10 + frameSize));
    if (id === 'TIT2') out.title = id3Text(frame);
    if (id === 'TPE1') out.artist = id3Text(frame);
    at += 10 + frameSize;
  }
  return out;
}

/** The comment list of a Vorbis comment block (little-endian lengths), starting at `at`. */
function readVorbisComments(bytes: Uint8Array, at: number): Partial<SongTags> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Partial<SongTags> = {};
  if (at + 4 > bytes.length) return out;
  at += 4 + view.getUint32(at, true); // vendor
  if (at + 4 > bytes.length) return out;
  const count = view.getUint32(at, true);
  at += 4;
  for (let i = 0; i < count && at + 4 <= bytes.length; i++) {
    const length = view.getUint32(at, true);
    const comment = utf8.decode(bytes.subarray(at + 4, at + 4 + length));
    at += 4 + length;
    const eq = comment.indexOf('=');
    const key = comment.slice(0, eq).toUpperCase();
    const value = comment.slice(eq + 1).trim();
    if (key === 'TITLE' && value) out.title = value;
    if (key === 'ARTIST' && value) out.artist = value;
  }
  return out;
}

function readFlac(bytes: Uint8Array): Partial<SongTags> {
  let at = 4;
  while (at + 4 <= bytes.length) {
    const header = bytes[at];
    const length = (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
    if ((header & 0x7f) === 4) return readVorbisComments(bytes, at + 4);
    if (header & 0x80) break;
    at += 4 + length;
  }
  return {};
}

function indexOf(bytes: Uint8Array, needle: string): number {
  const n = [...needle].map(ch => ch.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= bytes.length; i++) {
    for (let j = 0; j < n.length; j++) if (bytes[i + j] !== n[j]) continue outer;
    return i;
  }
  return -1;
}

/** OGG: the comment packet sits on the first pages, so a scan of the file's start finds it. */
function readOgg(bytes: Uint8Array): Partial<SongTags> {
  const vorbis = indexOf(bytes, '\x03vorbis');
  if (vorbis >= 0) return readVorbisComments(bytes, vorbis + 7);
  const opus = indexOf(bytes, 'OpusTags');
  return opus >= 0 ? readVorbisComments(bytes, opus + 8) : {};
}

export function fromFileName(fileName: string): SongTags {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const dash = base.indexOf(' - ');
  return dash > 0 ? { artist: base.slice(0, dash).trim(), title: base.slice(dash + 3).trim() } : { artist: '', title: base };
}

/** `head` is the start of the file; 256 KB covers the tags of almost every file (cover art can push them later). */
export function readTags(head: Uint8Array, fileName: string): SongTags {
  let found: Partial<SongTags> = {};
  try {
    const magic = latin1.decode(head.subarray(0, 4));
    if (magic.startsWith('ID3')) found = readId3(head);
    else if (magic === 'fLaC') found = readFlac(head);
    else if (magic === 'OggS') found = readOgg(head);
  } catch {
    // Damaged tags only mean the file name is used.
  }
  const fallback = fromFileName(fileName);
  return { title: found.title || fallback.title, artist: found.artist || (found.title ? '' : fallback.artist) };
}
