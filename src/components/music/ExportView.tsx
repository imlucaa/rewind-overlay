'use client';

import { useRef, useState } from 'react';
import { TARGETS, type Problem, type Target } from '@/lib/music/pack';
import { formatDuration } from '@/lib/music/format';
import type { ExportStatus } from '@/hooks/useExport';
import { Row, Select, TextField } from '@/components/ui/controls';

interface Props {
  packName: string;
  target: Target;
  onTarget: (target: Target) => void;
  trackCount: number;
  fileCount: number;
  songCount: number;
  problems: readonly Problem[];
  status: ExportStatus;
  onRename: (name: string) => void;
  onExport: () => void;
  onSaveFile: () => void;
  onLoadFile: (text: string) => string;
  onResetAll: () => void;
  /** Measures the songs on tracks and sets their volumes; resolves with what happened. */
  onEvenLoudness: (progress: (text: string) => void) => Promise<string>;
  /** Copies a share link; resolves with what happened. */
  onShare: () => Promise<string>;
}

/** Download the pack, check it first, and move assignments between browsers. */
export function ExportView({ packName, target, onTarget, trackCount, fileCount, songCount, problems, status, onRename, onExport, onSaveFile, onLoadFile, onResetAll, onEvenLoudness, onShare }: Props) {
  const load = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [evening, setEvening] = useState(false);
  const [loudnessMessage, setLoudnessMessage] = useState('');
  const even = async () => {
    setEvening(true);
    try {
      setLoudnessMessage(await onEvenLoudness(setLoudnessMessage));
    } catch (err) {
      setLoudnessMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setEvening(false);
    }
  };
  const blocking = problems.filter(p => p.kind === 'missing-song');
  const working = status.kind === 'working';

  return (
    <div className="music-view">
      <div className="rows">
        <Row label="Pack name" hint="Name of the download">
          <TextField label="Pack name" placeholder="My music pack" value={packName} onChange={onRename} />
        </Row>
        <Row label="Playing on" hint="Where you play Retro Rewind">
          <Select label="Playing on" value={target} options={TARGETS} onChange={onTarget} />
        </Row>
        <Row label="Same loudness" hint="Sets each song’s volume so none are much louder or quieter than the rest">
          <button className="button" type="button" disabled={evening || !trackCount} onClick={() => void even()}>
            {evening ? 'Measuring…' : 'Even out loudness'}
          </button>
        </Row>
        {loudnessMessage ? (
          <p className="note" role="status">
            {loudnessMessage}
          </p>
        ) : null}
        <Row label="In the pack" hint="Last lap files are added for you">
          <span className="figure">
            {trackCount} track{trackCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'} · {songCount} song{songCount === 1 ? '' : 's'} to convert
          </span>
        </Row>
      </div>

      {problems.length ? (
        <ul className="problems">
          {problems.map(p =>
            p.kind === 'missing-song' ? (
              <li key={'m' + p.track.file} className="warn">
                {p.track.name}: its song was removed. It’s left out until you pick another.
              </li>
            ) : p.kind === 'missing-final-song' ? (
              <li key={'f' + p.track.file} className="warn">
                {p.track.name}: its last lap song was removed, so lap 3 plays the main song.
              </li>
            ) : (
              <li key={'l' + p.song.id}>
                {p.song.title} plays for {formatDuration(p.seconds)}. Songs over 10 minutes take a lot of the Wii’s memory and may not play.
              </li>
            ),
          )}
        </ul>
      ) : null}

      <div className="export-box">
        <button className="button primary" type="button" disabled={working || trackCount === blocking.length} onClick={onExport}>
          {working ? 'Exporting…' : 'Download pack (.zip)'}
        </button>
        <ExportProgress status={status} />
      </div>

      <h2 className="sub">How to install</h2>
      <ol className="steps">
        {target === 'wheelwizard' ? (
          <>
            <li>In Wheel Wizard, open Patches.</li>
            <li>Click the arrow next to Browse, then Import, and pick the downloaded .zip. Give it a name.</li>
            <li>Make sure it’s switched on, then launch Retro Rewind.</li>
          </>
        ) : target === 'wii' ? (
          <>
            <li>Unzip the download.</li>
            <li>Copy the <code>RetroRewind6</code> folder to the top of your SD card. When it asks, choose Replace.</li>
            <li>Start Retro Rewind.</li>
          </>
        ) : (
          <>
            <li>Unzip the download.</li>
            <li>In Dolphin, click File › Open User Folder.</li>
            <li>
              Copy the <code>RetroRewind6</code> folder into <code>Load/Riivolution</code>. When it asks, choose Replace.
            </li>
            <li>Start Retro Rewind.</li>
          </>
        )}
      </ol>
      <p className="install-path">
        <span>{target === 'wheelwizard' ? 'Wheel Wizard copies your songs into' : 'Your songs end up in'}</span>
        <code>
          {target === 'wii'
            ? 'SD card/RetroRewind6/Patches'
            : target === 'wheelwizard'
              ? 'Dolphin Emulator/Load/Riivolution/WheelWizard/RetroRewind6/Patches'
              : 'Dolphin Emulator/Load/Riivolution/RetroRewind6/Patches'}
        </code>
        <small>
          {target === 'wheelwizard'
            ? 'They play instead of those tracks’ music. To undo, switch the pack off in Wheel Wizard.'
            : 'They play instead of those tracks’ music. To undo, delete them from Patches.'}{' '}
          Still the old music? Check Music is on in Retro Rewind’s settings.
        </small>
      </p>

      <h2 className="sub">Back up your choices</h2>
      <p className="note explain">
        Saves which song is on which track, so you can open it later or in another browser. A share link does the same for someone
        else. Neither has the songs themselves: the other person needs the same song files.
      </p>
      <div className="inspector-actions">
        <button className="button" type="button" onClick={onSaveFile}>
          Save backup
        </button>
        <button className="button" type="button" onClick={() => load.current?.click()}>
          Open backup
        </button>
        <button
          className="button"
          type="button"
          disabled={!trackCount}
          onClick={async () => {
            try {
              setMessage(await onShare());
            } catch (err) {
              setMessage(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Copy share link
        </button>
        <input
          ref={load}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setMessage(onLoadFile(await file.text()));
            } catch (err) {
              setMessage(err instanceof Error ? err.message : String(err));
            }
          }}
        />
        <button className="link-button danger" type="button" onClick={onResetAll}>
          Clear all tracks
        </button>
      </div>
      <p className="note" role="status">
        {message}
      </p>
    </div>
  );
}

export function ExportProgress({ status }: { status: ExportStatus }) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'working': {
      const value = (status.done + status.fraction) / status.total;
      return (
        <div className="progress" role="status">
          <progress max={1} value={value} />
          <span>
            Encoding {status.done + 1} of {status.total}: {status.song}
          </span>
        </div>
      );
    }
    case 'finished':
      return (
        <p className="note" role="status">
          Done: {status.files} file{status.files === 1 ? '' : 's'}.
          {status.failed.length ? ` Left out: ${status.failed.map(f => `${f.song} (${f.reason})`).join('; ')}.` : ''}
        </p>
      );
    case 'failed':
      return (
        <p className="note warn" role="status">
          Export failed: {status.reason}
        </p>
      );
  }
}
