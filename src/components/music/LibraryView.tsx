'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShimmerLine } from '@/components/amicro/Loaders';
import { easeOutExpo } from '@/components/amicro/presets';
import type { SongInfo } from '@/lib/music/library';
import type { Track } from '@/lib/music/tracks';
import { formatDuration, formatSize } from '@/lib/music/format';
import { ACCEPT, type ImportResult } from '@/hooks/useLibrary';
import type { Preview } from '@/hooks/usePreview';
import type { Assignments } from '@/lib/music/pack';
import { TrackPicker } from './TrackPicker';

interface Props {
  songs: readonly SongInfo[];
  tracks: readonly Track[];
  usage: ReadonlyMap<string, number>;
  assignments: Assignments;
  /** Gives the song to a track (replacing what it had). */
  onAssign: (songId: string, track: Track) => void;
  /** Puts the track back to its original music. */
  onUnassign: (track: Track) => void;
  preview: Preview;
  storageError: string;
  onImport: (files: File[]) => Promise<ImportResult>;
  /** Brings in an existing pack (.zip or .brstm files); returns what happened. */
  onImportPack: (files: File[]) => Promise<string>;
  importProgress: string;
  onReplace: (id: string, file: File) => Promise<void>;
  onRemove: (song: SongInfo) => void;
}

/** Imported songs: drop or browse to add, play, replace, remove. */
export function LibraryView({ songs, tracks, usage, assignments, preview, storageError, onImport, onImportPack, importProgress, onReplace, onRemove, onAssign, onUnassign }: Props) {
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const browse = useRef<HTMLInputElement>(null);
  const browsePack = useRef<HTMLInputElement>(null);

  const importPack = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setMessage('Opening the pack…');
    try {
      setMessage(await onImportPack(files));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async (all: File[]) => {
    // Packs (.zip, .brstm) go through the pack import; everything else is a song.
    const packFiles = all.filter(f => /\.(zip|brstm)$/i.test(f.name));
    const files = all.filter(f => !packFiles.includes(f));
    if (packFiles.length) await importPack(packFiles);
    if (!files.length) return;
    setBusy(true);
    setMessage(`Adding ${files.length} file${files.length === 1 ? '' : 's'}…`);
    const result = await onImport(files);
    setBusy(false);
    const failed = result.failed.map(f => `${f.name} ${f.reason}`).join('; ');
    setMessage(
      `${result.added} added.` + (failed ? ` Not added: ${failed}.` : ''),
    );
  };

  return (
    <div className="music-view">
      <div
        className="dropzone"
        data-spotlight
        data-dragging={dragging}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          void add([...e.dataTransfer.files]);
        }}
      >
        <strong>Drop songs here</strong>
        <small>MP3, WAV, OGG or FLAC. Several at once is fine. Or a music pack (.zip or .brstm files) to edit it.</small>
        <div className="inspector-actions">
          <button className="button" type="button" disabled={busy} onClick={() => browse.current?.click()}>
            Browse files
          </button>
          <button className="button" type="button" disabled={busy} onClick={() => browsePack.current?.click()}>
            Import a pack
          </button>
        </div>
        {busy ? <ShimmerLine /> : null}
        <input
          ref={browsePack}
          type="file"
          accept=".zip,.brstm"
          multiple
          hidden
          onChange={e => {
            void importPack([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <input
          ref={browse}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={e => {
            void add([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="note" role="status">
        {storageError || importProgress || message}
      </p>

      {songs.length ? (
        <ul className="song-list">
          <AnimatePresence initial={true}>
          {songs.map((song, index) => (
            <SongCard
              key={song.id}
              index={index}
              song={song}
              usedOn={usage.get(song.id) ?? 0}
              preview={preview}
              onReplace={file => onReplace(song.id, file).catch(e => setMessage(`${file.name} ${e instanceof Error ? e.message : e}.`))}
              onRemove={() => onRemove(song)}
              tracks={tracks}
              using={new Set(Object.entries(assignments).filter(([, a]) => a.songId === song.id).map(([file]) => file))}
              onPickTrack={track => {
                onAssign(song.id, track);
                setMessage(`${song.title} now plays on ${track.name}.`);
              }}
              onRemoveTrack={track => {
                onUnassign(track);
                setMessage(`${track.name} is back to its original music.`);
              }}
            />
          ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="empty">No songs yet. Add some, then give them tracks under Tracks.</p>
      )}
    </div>
  );
}

interface CardProps {
  /** Its place in the list, for the staggered entrance. */
  index: number;
  song: SongInfo;
  usedOn: number;
  preview: Preview;
  onReplace: (file: File) => void;
  onRemove: () => void;
  tracks: readonly Track[];
  using: ReadonlySet<string>;
  onPickTrack: (track: Track) => void;
  onRemoveTrack: (track: Track) => void;
}

function SongCard({ index, song, usedOn, preview, onReplace, onRemove, tracks, using, onPickTrack, onRemoveTrack }: CardProps) {
  const replace = useRef<HTMLInputElement>(null);
  const key = 'song:' + song.id;
  const playing = preview.playing === key;
  return (
    // Amicro's ScrollReveal with a short stagger: songs rise in as they come into view; a removed one slides out
    // and the rest close up.
    <motion.li
      className="song"
      data-spotlight
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      transition={{ duration: 0.5, ease: easeOutExpo, delay: Math.min(index, 8) * 0.035 }}
    >
      <PlayButton playing={playing} label={song.title} onToggle={() => (playing ? preview.pause() : void preview.play(key, song.id, song.title))} />
      <div className="song-text">
        <strong>{song.title}</strong>
        <small>
          {[song.artist, formatDuration(song.duration), formatSize(song.size)].filter(Boolean).join(' · ')}
        </small>
      </div>
      <TrackPicker tracks={tracks} using={using} label={`Add ${song.title} to a track`} onPick={onPickTrack} onRemove={onRemoveTrack} />
      <span className="pill" data-on={usedOn > 0}>
        {usedOn ? `${usedOn} track${usedOn === 1 ? '' : 's'}` : 'Unused'}
      </span>
      <button className="link-button" type="button" onClick={() => replace.current?.click()}>
        Replace
      </button>
      <input
        ref={replace}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onReplace(file);
          e.target.value = '';
        }}
      />
      <button className="link-button danger" type="button" onClick={onRemove}>
        Remove
      </button>
    </motion.li>
  );
}

export function PlayButton({ playing, label, onToggle, disabled }: { playing: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button className="play" type="button" aria-label={`${playing ? 'Pause' : 'Play'} ${label}`} onClick={onToggle} disabled={disabled}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4 2.5v11l9-5.5z" fill="currentColor" />}
      </svg>
    </button>
  );
}
