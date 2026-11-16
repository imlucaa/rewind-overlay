'use client';

import { useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import type { SongInfo } from '@/lib/music/library';
import type { Track } from '@/lib/music/tracks';
import { formatDuration, formatSize } from '@/lib/music/format';
import { ACCEPT, type ImportResult } from '@/hooks/useLibrary';
import type { Preview } from '@/hooks/usePreview';
import type { Assignments } from '@/lib/music/pack';
import { cn } from '@/lib/utils';
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

/** Imported songs: drop or browse to add, play, give to tracks, replace, remove. */
export function LibraryView({ songs, tracks, usage, assignments, preview, storageError, onImport, onImportPack, importProgress, onReplace, onRemove, onAssign, onUnassign }: Props) {
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const browse = useRef<HTMLInputElement>(null);
  // The songs already here when the view opened; only ones added after that animate in.
  const [initialSongs] = useState(() => new Set(songs.map(s => s.id)));
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
    setMessage(`${result.added} added.` + (failed ? ` Not added: ${failed}.` : ''));
  };

  const status = storageError || importProgress || message;

  return (
    <div className="flex flex-col gap-4">
      <Empty
        className={cn('bg-card/60 border border-dashed transition-colors', dragging && 'border-foreground bg-muted')}
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
        <EmptyHeader>
          <EmptyTitle>Drop songs here</EmptyTitle>
          <EmptyDescription>MP3, WAV, OGG or FLAC, several at once. Or drop a music pack (.zip or .brstm files) to keep editing it.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button disabled={busy} onClick={() => browse.current?.click()}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            Choose songs
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => browsePack.current?.click()}>
            Open a pack
          </Button>
        </EmptyContent>
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
      </Empty>
      <p className={cn('text-sm', storageError ? 'text-destructive' : 'text-muted-foreground')} role="status">
        {status}
      </p>

      {songs.length ? (
        <ItemGroup className="gap-2">
          {songs.map(song => (
            <SongRow
              key={song.id}
              fresh={!initialSongs.has(song.id)}
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
        </ItemGroup>
      ) : (
        <p className="text-muted-foreground text-sm">No songs yet. Add some above, then give them tracks with Add to track or under Tracks.</p>
      )}
    </div>
  );
}

interface RowProps {
  /** Added since this view opened: it slides in. */
  fresh: boolean;
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

function SongRow({ fresh, song, usedOn, preview, onReplace, onRemove, tracks, using, onPickTrack, onRemoveTrack }: RowProps) {
  const replace = useRef<HTMLInputElement>(null);
  const key = 'song:' + song.id;
  const playing = preview.playing === key;
  return (
    <Item variant="outline" className={fresh ? 'animate-in fade-in slide-in-from-top-1 duration-200 ease-(--ease-out)' : undefined}>
      <ItemMedia>
        <PlayButton playing={playing} label={song.title} onToggle={() => (playing ? preview.pause() : void preview.play(key, song.id, song.title))} />
      </ItemMedia>
      <ItemContent className="min-w-40">
        <ItemTitle className="w-full truncate">{song.title}</ItemTitle>
        <ItemDescription>{[song.artist, formatDuration(song.duration), formatSize(song.size)].filter(Boolean).join(' · ')}</ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap">
        <Badge variant={usedOn ? 'secondary' : 'outline'}>{usedOn ? `On ${usedOn} track${usedOn === 1 ? '' : 's'}` : 'Not used yet'}</Badge>
        <TrackPicker tracks={tracks} using={using} label={`Add ${song.title} to a track`} onPick={onPickTrack} onRemove={onRemoveTrack} />
        <Button variant="ghost" size="sm" onClick={() => replace.current?.click()}>
          Replace
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
          Remove
        </Button>
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
      </ItemActions>
    </Item>
  );
}

export function PlayButton({ playing, label, onToggle, disabled }: { playing: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="icon" aria-label={`${playing ? 'Pause' : 'Play'} ${label}`} onClick={onToggle} disabled={disabled}>
      {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
    </Button>
  );
}
