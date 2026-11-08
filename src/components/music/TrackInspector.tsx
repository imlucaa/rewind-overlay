'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isGameMusic, type Track } from '@/lib/music/tracks';
import {
  FINAL_SPEED_CHOICES, MAX_SPEED, MIN_SPEED, clampSpeed, filesFor, newAssignment, type Assignment, type Assignments,
} from '@/lib/music/pack';
import type { SongInfo } from '@/lib/music/library';
import type { PackState } from '@/lib/music/packState';
import { formatDuration } from '@/lib/music/format';
import type { Preview } from '@/hooks/usePreview';
import { Row, Select, Slider, Toggle } from '@/components/ui/controls';
import { PlayButton } from './LibraryView';
import { LoopEditor } from './LoopEditor';

interface Props {
  tracks: readonly Track[];
  assignments: Assignments;
  songs: readonly SongInfo[];
  songsById: ReadonlyMap<string, SongInfo>;
  preview: Preview;
  busy: boolean;
  update: (change: (pack: PackState) => PackState, mergeKey?: string) => void;
  onDownload: (track: Track) => void;
  /** Shown when no track is selected. */
  empty: ReactNode;
  /** Adds a dropped file to the library. */
  onAddSong: (file: File) => Promise<SongInfo>;
}

const ORIGINAL = '';
const SAME = '';

/**
 * How lap 3 sounds: the final lap song (or the song) at the track's speed, then sped up by the final lap speed with
 * the pitch rising, as the game raises the playback rate. One audio element can't keep pitch for the first part and
 * not the second, so a kept-pitch speed change is heard here with the pitch moving too.
 */
const lap3Preview = (a: Assignment) => ({ speed: a.speed * a.finalSpeed, keepPitch: false, volumeDb: a.volumeDb, loop: null });

function withAssignments(files: readonly string[], change: (file: string, a: Assignment | undefined) => Assignment | undefined) {
  return (pack: PackState): PackState => {
    const assignments = { ...pack.assignments };
    for (const file of files) {
      const next = change(file, assignments[file]);
      if (next) assignments[file] = next;
      else delete assignments[file];
    }
    return { ...pack, assignments };
  };
}

/** The selected track(s): which song plays, at what speed and volume. */
export function TrackInspector({ tracks, assignments, songs, songsById, preview, busy, update, onDownload, empty, onAddSong }: Props) {
  const [dragging, setDragging] = useState(false);
  const [dropMessage, setDropMessage] = useState('');
  const [songQuery, setSongQuery] = useState('');
  const files = tracks.map(t => t.file);
  // Menus and fanfares have no laps; short jingles play once, so they have no loop either.
  const hasLaps = !tracks.some(isGameMusic);
  const loops = !tracks.some(t => t.playsOnce);
  const single = tracks.length === 1 ? tracks[0] : null;
  const assigned = tracks.map(t => assignments[t.file]).filter((a): a is Assignment => !!a);
  const first = assigned[0];
  const sameSong = assigned.length === tracks.length && assigned.every(a => a.songId === first?.songId);
  const songValue = sameSong && first ? first.songId : assigned.length === 0 ? ORIGINAL : 'mixed';
  const key = single ? 'track:' + single.file : '';
  const playing = !!single && preview.playing === key;
  const lap3Key = single ? 'lap3:' + single.file : '';
  const playingLap3 = !!single && preview.playing === lap3Key;

  // Hear speed, pitch and volume changes while it plays.
  useEffect(() => {
    if (playing && first) preview.apply(first);
    if (playingLap3 && first) preview.apply(lap3Preview(first));
  }, [playing, playingLap3, first, preview]);

  if (!tracks.length) return <>{empty}</>;

  const setSong = (songId: string) =>
    update(
      withAssignments(files, (_, a) =>
        songId === ORIGINAL
          ? undefined
          : a
            ? { ...a, songId, loop: a.songId === songId ? a.loop : null, finalSongId: a.finalSongId === songId ? null : a.finalSongId }
            : newAssignment(songId),
      ),
    );
  const setFinalSong = (songId: string) =>
    update(withAssignments(files, (_, a) => (a ? { ...a, finalSongId: songId === SAME || songId === a.songId ? null : songId } : a)));
  const setAll = (patch: Partial<Assignment>, mergeKey: string) =>
    update(withAssignments(files, (_, a) => (a ? { ...a, ...patch } : a)), mergeKey + files.join());
  const randomSongs = () =>
    update(withAssignments(files, (_, a) => {
      const song = songs[Math.floor(Math.random() * songs.length)];
      return a ? { ...a, songId: song.id, loop: null } : newAssignment(song.id);
    }));

  const songOptions: [string, string][] = [
    [ORIGINAL, 'Original music'],
    ...(songValue === 'mixed' ? ([['mixed', 'Different songs']] as [string, string][]) : []),
    ...songs.map(s => [s.id, s.artist ? `${s.title} – ${s.artist}` : s.title] as [string, string]),
  ];
  const finals = assigned.map(a => a.finalSongId ?? SAME);
  const finalValue = finals.every(f => f === finals[0]) ? finals[0] ?? SAME : 'mixed';
  const finalOptions: [string, string][] = [
    [SAME, tracks.length > 1 ? 'Each track’s own song' : 'Same song'],
    ...(finalValue === 'mixed' ? ([['mixed', 'Different songs']] as [string, string][]) : []),
    ...songOptions.slice(1).filter(([id]) => id !== 'mixed' && !(sameSong && id === first?.songId)),
  ];
  const finalSong = first?.finalSongId ? songsById.get(first.finalSongId) : undefined;
  const missingSong = first && !songsById.has(first.songId);
  const song = first ? songsById.get(first.songId) : undefined;


  return (
    <div
      className="inspector"
      data-dragging={dragging}
      onDragOver={e => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const file = [...e.dataTransfer.files][0];
        if (!file) return;
        setDropMessage(`Adding ${file.name}…`);
        onAddSong(file)
          .then(song => {
            setSong(song.id);
            setDropMessage(`${song.title} now plays on ${single ? single.name : `${tracks.length} tracks`}.`);
          })
          .catch(err => setDropMessage(`${file.name} ${err instanceof Error ? err.message : err}.`));
      }}
    >
      {dragging ? (
        <div className="drop-here" aria-hidden="true">
          Drop to put it on {single ? single.name : `${tracks.length} tracks`}
        </div>
      ) : null}
      <header>
        <h2>{single ? single.name : `${tracks.length} tracks`}</h2>
        {single ? (
          <small>
            {filesFor(single, first).map(f => f.name).join(' + ')}
            {single.variantOf ? ` · version of ${single.variantOf}` : ''}
            {single.hasOwnMusic ? '' : ' · uses another track’s music in Retro Rewind'}
            {single.playsOnce ? ' · plays once' : ''}
          </small>
        ) : (
          <small>Changes here apply to all of them.</small>
        )}
        {single?.about ? <p className="note">{single.about}</p> : null}
      </header>

      {/* An empty track picks its song from the cards below; the dropdown comes back once it has one. */}
      {assigned.length ? (
        <div className="rows">
          <Row label="Song">
            <Select label="Song" value={songValue} options={songOptions} onChange={v => v !== 'mixed' && setSong(v)} />
          </Row>
          {missingSong ? <p className="warn">This track’s song was removed from your songs. Pick another.</p> : null}
          {first ? (
            <>
              <Row label="Speed" hint={`1.00x is normal. ${MIN_SPEED.toFixed(2)}x to ${MAX_SPEED.toFixed(2)}x`}>
                <div className="speed">
                  <input
                    type="range"
                    aria-label="Speed"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    step={0.01}
                    value={first.speed}
                    onChange={e => setAll({ speed: clampSpeed(Number(e.target.value)) }, 'speed')}
                  />
                  <input
                    type="number"
                    aria-label="Speed value"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    step={0.01}
                    value={first.speed}
                    onChange={e => e.target.value && setAll({ speed: clampSpeed(Number(e.target.value)) }, 'speed')}
                  />
                  <button className="link-button" type="button" disabled={first.speed === 1} onClick={() => setAll({ speed: 1 }, 'speed-reset')}>
                    Reset
                  </button>
                </div>
              </Row>
              <Row label="Keep pitch" hint={first.keepPitch ? 'Speed changes, the notes sound the same' : 'Faster sounds higher, slower sounds deeper'}>
                <Toggle label="Keep pitch" checked={first.keepPitch} onChange={v => setAll({ keepPitch: v }, 'pitch')} />
              </Row>
              <Row label="Volume" hint="Louder or quieter than the song is now">
                <Slider label="Volume" value={first.volumeDb} min={-12} max={12} step={1} unit=" dB" onChange={v => setAll({ volumeDb: v }, 'volume')} />
              </Row>
              {single && song && loops ? (
                <>
                  <h3 className="inspector-section">Loop</h3>
                  <LoopEditor
                    key={single.file + first.songId}
                    songId={first.songId}
                    loop={first.loop}
                    playhead={playing && preview.time.position ? preview.time.position : null}
                    onChange={loop => setAll({ loop }, 'loop')}
                    onHearJump={loop => void preview.play(key, first.songId, single.name, { ...first, loop }, loop.end - 4 * first.speed)}
                  />
                </>
              ) : null}
              {hasLaps ? (
                <>
                  <h3 className="inspector-section">Last lap</h3>
                  <Row label="Last lap song" hint={finalValue === SAME ? 'The same song keeps playing, a bit faster' : 'Switches to this song on the last lap'}>
                    <Select label="Last lap song" value={finalValue} options={finalOptions} onChange={v => v !== 'mixed' && setFinalSong(v)} />
                  </Row>
                  {first.finalSongId && !finalSong ? <p className="warn">The last lap song was removed from your songs, so the last lap plays the main song.</p> : null}
                  <Row label="Last lap speed" hint="How much faster the last lap plays">
                    <Select
                      label="Last lap speed"
                      value={String(first.finalSpeed)}
                      options={FINAL_SPEED_CHOICES.map(([speed, text]) => [String(speed), text] as [string, string])}
                      onChange={v => setAll({ finalSpeed: Number(v) }, 'final')}
                    />
                  </Row>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {dropMessage ? (
        <p className="note" role="status">
          {dropMessage}
        </p>
      ) : null}
      {!assigned.length ? (
        <div className="quick-songs">
          <h3 className="inspector-section">Your songs</h3>
          {songs.length ? (
            <>
              {songs.length > 6 ? (
                <input type="search" aria-label="Search your songs" placeholder="Search your songs" value={songQuery} onChange={e => setSongQuery(e.target.value)} />
              ) : null}
              <ul>
                {songs
                  .filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(songQuery.trim().toLowerCase()))
                  .map(s => {
                    const songKey = 'song:' + s.id;
                    const on = preview.playing === songKey;
                    return (
                      <li key={s.id}>
                        <PlayButton playing={on} label={s.title} onToggle={() => (on ? preview.pause() : void preview.play(songKey, s.id, s.title))} />
                        <button type="button" className="quick-song" onClick={() => setSong(s.id)}>
                          <span>
                            <strong>{s.title}</strong>
                            <small>{[s.artist, formatDuration(s.duration)].filter(Boolean).join(' · ')}</small>
                          </span>
                          <em>Use</em>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </>
          ) : null}
          <p className="note">{songs.length ? 'Click a song to use it here, or drop a music file on this panel.' : 'Drop a music file on this panel to add it and use it here.'}</p>
        </div>
      ) : null}

      <div className="inspector-actions">
        {single && first && !missingSong ? (
          <>
            <PlayButton playing={playing} label={single.name} onToggle={() => (playing ? preview.pause() : void preview.play(key, first.songId, single.name, first))} />
            {hasLaps ? (
              <button
                className="button"
                type="button"
                onClick={() =>
                  playingLap3
                    ? preview.pause()
                    : void preview.play(lap3Key, finalSong?.id ?? first.songId, `${single.name} · last lap`, lap3Preview(first))
                }
              >
                {playingLap3 ? 'Stop last lap' : 'Hear last lap'}
              </button>
            ) : null}
            <button className="button" type="button" disabled={busy} onClick={() => onDownload(single)}>
              Download just this track
            </button>
          </>
        ) : null}
        {songs.length > 0 ? (
          <button className="button" type="button" onClick={randomSongs}>
            {tracks.length > 1 ? 'Random songs' : 'Random song'}
          </button>
        ) : null}
        {assigned.length ? (
          <button className="link-button" type="button" onClick={() => setSong(ORIGINAL)}>
            Back to original music
          </button>
        ) : null}
      </div>
      {single && first && song ? (
        <p className="note">
          {first.loop
            ? `Plays ${formatDuration(first.loop.end / first.speed)}, then repeats the last ${formatDuration((first.loop.end - first.loop.start) / first.speed)}.`
            : `Plays ${formatDuration(song.duration / first.speed)}, then starts again from the beginning.`}
        </p>
      ) : null}
    </div>
  );
}
