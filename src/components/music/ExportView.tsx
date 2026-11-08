'use client';

import { useRef, useState } from 'react';
import { DOLPHIN_FOLDER, TARGETS, WHEEL_WIZARD_FOLDER, type Problem, type Target } from '@/lib/music/pack';
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
}

/** Download the pack, check it first, and move assignments between browsers. */
export function ExportView({ packName, target, onTarget, trackCount, fileCount, songCount, problems, status, onRename, onExport, onSaveFile, onLoadFile, onResetAll }: Props) {
  const load = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const blocking = problems.filter(p => p.kind === 'missing-song');
  const working = status.kind === 'working';

  return (
    <div className="music-view">
      <div className="rows">
        <Row label="Pack name" hint="The zip's name">
          <TextField label="Pack name" placeholder="My music pack" value={packName} onChange={onRename} />
        </Row>
        <Row label="Playing on" hint="Changes the install steps (and the README in the zip)">
          <Select label="Playing on" value={target} options={TARGETS} onChange={onTarget} />
        </Row>
        <Row label="In the pack" hint="Final lap files are added where Retro Rewind has its own">
          <span className="figure">
            {trackCount} track{trackCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'} · {songCount} song{songCount === 1 ? '' : 's'} to encode
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
        <li>
          {target === 'wii' ? (
            <>Unzip it. Copy the <code>RetroRewind6</code> folder to the root of your SD card. Say yes to replacing files.</>
          ) : (
            <>
              Unzip it. Copy the <code>RetroRewind6</code> folder into <code>{WHEEL_WIZARD_FOLDER}</code> if you play through Wheel
              Wizard, otherwise into <code>{DOLPHIN_FOLDER}</code> (the one that already has a <code>RetroRewind6</code>). Say yes to
              replacing files. In Dolphin, File › Open User Folder opens the <code>Dolphin Emulator</code> folder.
            </>
          )}
        </li>
        <li>The songs land in <code>RetroRewind6/Patches</code>, which Retro Rewind loads over its own music.</li>
        <li>No change in game? Check Retro Rewind’s Music setting isn’t off and Loose Archive Overrides is on (it is by default).</li>
      </ol>

      <h2 className="sub">Assignments file</h2>
      <p className="note">Saves which song goes on which track, to back up or open in another browser. The songs themselves stay here.</p>
      <div className="inspector-actions">
        <button className="button" type="button" onClick={onSaveFile}>
          Save assignments
        </button>
        <button className="button" type="button" onClick={() => load.current?.click()}>
          Load assignments
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
          Reset all assignments
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
