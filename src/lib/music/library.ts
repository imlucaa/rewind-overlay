// The imported songs, kept in IndexedDB so they're still there after a reload. The audio stays a Blob: the browser
// keeps it on disk and only reads it when a song is played or exported.

export interface Song {
  id: string;
  title: string;
  artist: string;
  fileName: string;
  /** Seconds. */
  duration: number;
  size: number;
  type: string;
  addedAt: number;
  blob: Blob;
}

export type SongInfo = Omit<Song, 'blob'>;

const DB_NAME = 'rewind-music-pack';
const STORE = 'songs';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not open.'));
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Saving to this browser failed. It may be out of space.'));
  });
}

export async function allSongs(): Promise<SongInfo[]> {
  const songs = await run('readonly', store => store.getAll() as IDBRequest<Song[]>);
  return songs.map(({ blob, ...info }) => info).sort((a, b) => a.addedAt - b.addedAt);
}

export const songBlob = async (id: string): Promise<Blob | null> =>
  (await run('readonly', store => store.get(id) as IDBRequest<Song | undefined>))?.blob ?? null;

export const putSong = (song: Song): Promise<IDBValidKey> => run('readwrite', store => store.put(song));

export const deleteSong = (id: string): Promise<undefined> => run('readwrite', store => store.delete(id));
