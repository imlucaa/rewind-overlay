'use client';

import { useRef, useState } from 'react';
import { TARGETS, type Problem, type Target } from '@/lib/music/pack';
import { formatDuration } from '@/lib/music/format';
import type { ExportStatus } from '@/hooks/useExport';
import { Row, Rows, Select, TextField, Toggle } from '@/components/ui/controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  packName: string;
  target: Target;
  onTarget: (target: Target) => void;
  originalNames: boolean;
  onOriginalNames: (on: boolean) => void;
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

const Code = ({ children }: { children: string }) => <code className="bg-muted rounded px-1 font-mono text-xs">{children}</code>;

/** Download the pack, check it first, and move assignments between browsers. */
export function ExportView({ packName, target, onTarget, originalNames, onOriginalNames, trackCount, fileCount, songCount, problems, status, onRename, onExport, onSaveFile, onLoadFile, onResetAll, onEvenLoudness, onShare }: Props) {
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
    <div className="flex flex-col gap-6">
      <Rows>
        <Row label="Pack name" hint="Name of the download">
          <TextField label="Pack name" placeholder="My music pack" value={packName} onChange={onRename} />
        </Row>
        <Row label="Playing on" hint="Where you play Retro Rewind">
          <Select label="Playing on" value={target} options={TARGETS} onChange={onTarget} />
        </Row>
        <Row label="Original file names for the 32 original tracks" hint="For CTGP or the original game, like n_Farm_n. Retro Rewind doesn’t use them.">
          <Toggle label="Original file names for the 32 original tracks" checked={originalNames} onChange={onOriginalNames} />
        </Row>
        <Row label="Same loudness" hint={loudnessMessage || 'Sets each song’s volume so none are much louder or quieter than the rest'}>
          <Button variant="outline" disabled={evening || !trackCount} onClick={() => void even()}>
            {evening ? <Spinner data-icon="inline-start" /> : null}
            {evening ? 'Measuring' : 'Even out loudness'}
          </Button>
        </Row>
        <Row label="In the pack" hint="Last lap files are added for you">
          <span className="text-muted-foreground text-sm tabular-nums">
            {trackCount} track{trackCount === 1 ? '' : 's'}, {fileCount} file{fileCount === 1 ? '' : 's'}, {songCount} song{songCount === 1 ? '' : 's'} to convert
          </span>
        </Row>
      </Rows>

      {problems.length ? (
        <Alert>
          <AlertTitle>Check before you download</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {problems.map(p =>
                p.kind === 'missing-song' ? (
                  <li key={'m' + p.track.file}>{p.track.name}: its song was removed. It’s left out until you pick another.</li>
                ) : p.kind === 'missing-final-song' ? (
                  <li key={'f' + p.track.file}>{p.track.name}: its last lap song was removed, so lap 3 plays the main song.</li>
                ) : (
                  <li key={'l' + p.song.id}>
                    {p.song.title} plays for {formatDuration(p.seconds)}. Songs over 10 minutes take a lot of the Wii’s memory and may not play.
                  </li>
                ),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={working || trackCount === blocking.length} onClick={onExport}>
            {working ? <Spinner data-icon="inline-start" /> : null}
            {working ? 'Making the pack' : 'Download pack (.zip)'}
          </Button>
          {/* A greyed-out button alone reads as broken; say what it's waiting for. */}
          {!working && !trackCount ? <span className="text-muted-foreground text-sm">Give a track one of your songs first.</span> : null}
        </div>
        <ExportProgress status={status} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">How to install</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {target === 'wii' ? (
            <>
              <li>Unzip the download.</li>
              <li>
                Copy the <Code>RetroRewind6</Code> folder to the top of your SD card. When it asks, choose Replace.
              </li>
              <li>Start Retro Rewind.</li>
            </>
          ) : (
            <>
              <li>Unzip the download.</li>
              <li>In Dolphin, click File › Open User Folder.</li>
              <li>
                Copy the <Code>RetroRewind6</Code> folder into <Code>Load/Riivolution</Code>. When it asks, choose Replace.
              </li>
              <li>Start Retro Rewind.</li>
            </>
          )}
        </ol>
        <div className="bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">Your songs end up in</span>
          <code className="font-mono text-xs break-all">
            {target === 'wii' ? 'SD card/RetroRewind6/Patches' : 'Dolphin Emulator/Load/Riivolution/RetroRewind6/Patches'}
          </code>
          <small className="text-muted-foreground">
            They play instead of those tracks’ music. To undo, delete them from Patches. Still the old music? Check Music is on in Retro Rewind’s settings.
          </small>
          {originalNames ? (
            <small className="text-muted-foreground">
              CTGP: the 32 original tracks also get the game’s own names in <Code>ctgpr/My Stuff</Code>. Copy the <Code>ctgpr</Code> folder to the top of your
              SD card and turn My Stuff on in CTGP. Luigi Circuit and Mario Circuit share one file, so one song plays on both.
            </small>
          ) : null}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Back up your choices</h2>
          <p className="text-muted-foreground text-sm">
            Saves which song is on which track, so you can open it later or in another browser. A share link does the same for someone else. Neither holds the
            songs themselves: the other person needs the same song files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSaveFile}>
            Save backup
          </Button>
          <Button variant="outline" onClick={() => load.current?.click()}>
            Open backup
          </Button>
          <Button
            variant="outline"
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
          </Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onResetAll}>
            Clear all tracks
          </Button>
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
        </div>
        <p className="text-muted-foreground min-h-5 text-sm" role="status">
          {message}
        </p>
      </section>
    </div>
  );
}

export function ExportProgress({ status }: { status: ExportStatus }) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'working': {
      const value = ((status.done + status.fraction) / status.total) * 100;
      return (
        <div className="flex flex-col gap-1.5" role="status">
          <Progress value={value} aria-label="Pack progress" />
          <span className="text-muted-foreground text-sm">
            Converting {status.done + 1} of {status.total}: {status.song}
          </span>
        </div>
      );
    }
    case 'finished':
      return (
        <p className="text-muted-foreground text-sm" role="status">
          Done: {status.files} file{status.files === 1 ? '' : 's'}.
          {status.failed.length ? ` Left out: ${status.failed.map(f => `${f.song} (${f.reason})`).join('; ')}.` : ''}
        </p>
      );
    case 'failed':
      return (
        <Alert variant="destructive" role="status">
          <AlertTitle>The pack couldn’t be made</AlertTitle>
          <AlertDescription>{status.reason}</AlertDescription>
        </Alert>
      );
  }
}
