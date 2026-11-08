'use client';

import { useMemo, useState } from 'react';
import { useStoredState } from '@/hooks/useStoredState';
import { AppShell, Tab } from '@/components/layout/AppShell';
import { useLibrary } from '@/hooks/useLibrary';
import { usePack } from '@/hooks/usePack';
import { usePreview } from '@/hooks/usePreview';
import { download, useExport } from '@/hooks/useExport';
import { usePackImport } from '@/hooks/usePackImport';
import { newAssignment, planPack } from '@/lib/music/pack';
import { packFromFile, packToFile, safeFileName } from '@/lib/music/packState';
import type { SongInfo } from '@/lib/music/library';
import type { Track } from '@/lib/music/tracks';
import { LibraryView } from './LibraryView';
import { TracksView, type TrackFilter } from './TracksView';
import { TrackInspector } from './TrackInspector';
import { ExportProgress, ExportView } from './ExportView';
import { NowPlaying } from './NowPlaying';
import { PackSummary } from './PackSummary';

type View = 'library' | 'tracks' | 'export';
const VIEWS: readonly [View, string][] = [
  ['library', 'Songs'],
  ['tracks', 'Tracks'],
  ['export', 'Export'],
];

// Where you were (tab, selected tracks), so reopening the site lands back there. The pack itself is saved by usePack.
interface Place {
  view: View;
  selected: string[];
  focus: string | null;
}
const PLACE_KEY = 'rewind-music-place';
const startPlace = (): Place => ({ view: 'library', selected: [], focus: null });
function parsePlace(text: string | null): Place {
  try {
    const raw = text ? JSON.parse(text) : null;
    if (!raw || !VIEWS.some(([v]) => v === raw.view)) return startPlace();
    return {
      view: raw.view,
      selected: Array.isArray(raw.selected) ? raw.selected.filter((f: unknown) => typeof f === 'string') : [],
      focus: typeof raw.focus === 'string' ? raw.focus : null,
    };
  } catch {
    return startPlace();
  }
}

interface Props {
  tracks: readonly Track[];
}

/** The music pack maker: import songs, give them tracks, set speed and volume, download a Retro Rewind pack. */
export function MusicPackApp({ tracks }: Props) {
  const library = useLibrary();
  const { pack, update, undo, redo, canUndo, canRedo } = usePack();
  const preview = usePreview();
  const exporter = useExport();
  const packImport = usePackImport(tracks, library.addSong);
  const [place, setPlace] = useStoredState<Place>(PLACE_KEY, parsePlace, startPlace);
  const view = place.view;
  const setView = (v: View) => setPlace(p => ({ ...p, view: v }));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TrackFilter>('all');
  const selected = useMemo<ReadonlySet<string>>(() => new Set(place.selected), [place.selected]);
  const focus = place.focus;
  const setFocus = (file: string | null) => setPlace(p => ({ ...p, focus: file }));
  const setSelected = (change: ReadonlySet<string> | ((current: ReadonlySet<string>) => ReadonlySet<string>)) =>
    setPlace(p => ({ ...p, selected: [...(typeof change === 'function' ? change(new Set(p.selected)) : change)] }));

  const songsById = useMemo(() => new Map(library.songs.map(s => [s.id, s])), [library.songs]);
  const trackFiles = useMemo(() => new Set(tracks.map(t => t.file)), [tracks]);
  const assignedTracks = useMemo(() => tracks.filter(t => t.file in pack.assignments), [tracks, pack.assignments]);
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of Object.values(pack.assignments))
      for (const id of a.finalSongId ? [a.songId, a.finalSongId] : [a.songId]) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [pack.assignments]);
  // Wait for the library before judging songs missing, or every assignment looks broken while it loads.
  const plan = useMemo(
    () => (library.ready ? planPack(tracks, pack.assignments, songsById, pack.target) : { jobs: [], problems: [] }),
    [library.ready, tracks, pack.assignments, songsById, pack.target],
  );
  const selectedTracks = useMemo(() => tracks.filter(t => selected.has(t.file)), [tracks, selected]);

  const select = (file: string, mode: 'only' | 'toggle') => {
    setFocus(file);
    setSelected(current => {
      if (mode === 'only') return new Set([file]);
      const next = new Set(current);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const removeSong = (song: SongInfo) => {
    const used = usage.get(song.id) ?? 0;
    if (used && !window.confirm(`${song.title} is on ${used} track${used === 1 ? '' : 's'}. Remove it, and put those tracks back to their original music?`)) return;
    if (preview.loadedKey?.endsWith(song.id)) preview.pause();
    void library.removeSong(song.id).then(() =>
      update(p => ({
        ...p,
        assignments: Object.fromEntries(
          Object.entries(p.assignments)
            .filter(([, a]) => a.songId !== song.id)
            .map(([file, a]) => [file, a.finalSongId === song.id ? { ...a, finalSongId: null } : a]),
        ),
      })),
    );
  };

  const exportAll = () => void exporter.run(plan.jobs, `${safeFileName(pack.packName)}.zip`, true, pack.target);
  const exportTrack = (track: Track) => {
    const one = planPack([track], pack.assignments, songsById, pack.target);
    void exporter.run(one.jobs, `${safeFileName(pack.packName)} - ${track.file}.zip`, false, pack.target);
  };

  const summary = (
    <PackSummary
      packName={pack.packName}
      tracks={tracks}
      assignments={pack.assignments}
      songs={library.songs}
      problems={plan.problems}
      onCategory={category => {
        setFilter(category);
        setQuery('');
        setView('tracks');
      }}
      onTrack={file => {
        setFilter('all');
        setQuery('');
        select(file, 'only');
        setView('tracks');
      }}
      onSongs={() => setView('library')}
    />
  );

  const fileCount = plan.jobs.reduce((n, j) => n + j.files.length, 0);
  const songsToEncode = plan.jobs.length;

  return (
    <AppShell
      className="music"
      tabsLabel="Music pack"
      tabs={VIEWS.map(([v, label]) => (
        <Tab key={v} current={view === v} onSelect={() => setView(v)}>
          {label}
        </Tab>
      ))}
      status={
        <span className="stats">
          <b>{library.songs.length}</b> song{library.songs.length === 1 ? '' : 's'} · <b>{assignedTracks.length}</b> of {tracks.length} tracks with your music
        </span>
      }
      actions={
        <>
          <button className="button hide-small" type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">
            Undo
          </button>
          <button className="button hide-small" type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">
            Redo
          </button>
          <button className="button primary" type="button" disabled={exporter.busy || !songsToEncode} onClick={exportAll}>
            {exporter.busy ? 'Exporting…' : 'Download pack'}
          </button>
        </>
      }
      asideLabel={view === 'tracks' ? 'Selected track' : 'Pack'}
      aside={
        <>
          {view === 'tracks' ? (
            <TrackInspector
              tracks={selectedTracks}
              assignments={pack.assignments}
              songs={library.songs}
              songsById={songsById}
              preview={preview}
              busy={exporter.busy}
              update={update}
              onDownload={exportTrack}
              empty={summary}
              onAddSong={library.addSong}
            />
          ) : (
            summary
          )}
          {view !== 'export' ? <ExportProgress status={exporter.status} /> : null}
          <NowPlaying preview={preview} />
        </>
      }
    >
      {view === 'library' ? (
        <LibraryView
          songs={library.songs}
          tracks={tracks}
          usage={usage}
          assignments={pack.assignments}
          onAssign={(songId, track) =>
            update(p => {
              const current = p.assignments[track.file];
              const next = current ? { ...current, songId, loop: current.songId === songId ? current.loop : null } : newAssignment(songId);
              return { ...p, assignments: { ...p.assignments, [track.file]: next } };
            })
          }
          onUnassign={track =>
            update(p => {
              const assignments = { ...p.assignments };
              delete assignments[track.file];
              return { ...p, assignments };
            })
          }
          preview={preview}
          storageError={library.error}
          onImport={library.importFiles}
          importProgress={packImport.progress}
          onImportPack={async files => {
            const result = await packImport.run(files);
            update(p => ({ ...p, assignments: { ...p.assignments, ...result.assignments } }));
            return result.summary;
          }}
          onReplace={library.replaceSong}
          onRemove={removeSong}
        />
      ) : view === 'tracks' ? (
        <TracksView
          tracks={tracks}
          assignments={pack.assignments}
          songs={songsById}
          query={query}
          filter={filter}
          selected={selected}
          focus={focus}
          onQuery={setQuery}
          onFilter={setFilter}
          onSelect={select}
          onSelectMany={files => setSelected(new Set(files))}
        />
      ) : (
        <ExportView
          packName={pack.packName}
          target={pack.target}
          onTarget={target => update(p => ({ ...p, target }))}
          trackCount={assignedTracks.length}
          fileCount={fileCount}
          songCount={songsToEncode}
          problems={plan.problems}
          status={exporter.status}
          onRename={name => update(p => ({ ...p, packName: name }), 'name')}
          onExport={exportAll}
          onSaveFile={() => download(new Blob([packToFile(pack, library.songs)], { type: 'application/json' }), `${safeFileName(pack.packName)}.json`)}
          onLoadFile={text => {
            const result = packFromFile(text, library.songs, trackFiles);
            update(p => ({ ...result.pack, target: p.target }));
            const count = Object.keys(result.pack.assignments).length;
            const skipped = [
              result.missing ? `${result.missing} whose song isn’t in this library` : '',
              result.unknownTracks ? `${result.unknownTracks} for tracks Retro Rewind doesn’t have` : '',
            ].filter(Boolean);
            return `Loaded ${count} assignment${count === 1 ? '' : 's'}.` + (skipped.length ? ` Skipped ${skipped.join(' and ')}.` : '');
          }}
          onResetAll={() => {
            if (window.confirm('Put every track back to its original music? Undo can bring it back.'))
              update(p => ({ ...p, assignments: {} }));
          }}
        />
      )}
    </AppShell>
  );
}
