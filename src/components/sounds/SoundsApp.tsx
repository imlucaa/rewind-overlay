'use client';

import { useMemo, useRef, useState } from 'react';
import {
  DownloadIcon,
  FileUpIcon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Reveal, Tab } from '@/components/layout/AppShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { download } from '@/hooks/useExport';
import { toWav } from '@/lib/music/brstmRead';
import { decodeWave, fitToWave, isBrsar, looseFile, patchWave, readBrsar, type Brsar, type Wave } from '@/lib/sound/brsar';
import { MUSIC_FOLDER } from '@/lib/music/pack';
import { ZipWriter } from '@/lib/music/zip';
import { cn } from '@/lib/utils';

const ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.flac';

type Group = 'Driving' | 'Items' | 'Race and results' | 'Music';

interface SoundDef {
  code: string;
  label: string;
  about: string;
  group: Group;
}

// The trick sound: the whoosh when you do a trick off a ramp. One sound shared by every character and kart.
const TRICK: SoundDef = {
  code: 'SE_VCL_JUMP_ACTION',
  label: 'Trick',
  about: 'The whoosh when you do a trick off a ramp.',
  group: 'Driving',
};

// Other well-known sounds, by their names inside revo_kart.brsar. The descriptions come from those names, so press
// play to check one before you replace it.
const SOUNDS: SoundDef[] = [
  { code: 'SE_VCL_DASH', label: 'Boost', about: 'Mushrooms, boost pads and mini-turbos.', group: 'Driving' },
  { code: 'SE_VCL_DASHJ', label: 'Boost ramp', about: 'Launching off a boost ramp.', group: 'Driving' },
  { code: 'SE_VCL_SLIP_STREAM_DASH', label: 'Slipstream boost', about: 'When drafting behind someone pays off.', group: 'Driving' },
  { code: 'SE_VCL_DRIFT_HIBANA_BLUE', label: 'Drift sparks', about: 'The sparks while you hold a drift.', group: 'Driving' },
  { code: 'SE_VCL_DRIFT_KEMURI', label: 'Drift smoke', about: 'The tyre smoke as a drift starts.', group: 'Driving' },
  { code: 'SE_VCL_MINI_JUMP', label: 'Hop', about: 'The little hop before a drift.', group: 'Driving' },
  { code: 'SE_VCL_COL_CAR', label: 'Bump', about: 'Bumping into another racer.', group: 'Driving' },
  { code: 'SE_VCL_SPIN', label: 'Spin out', about: 'Spinning out, like after a banana.', group: 'Driving' },
  { code: 'SE_ITM_BOX_HIT', label: 'Item box', about: 'Driving through an item box.', group: 'Items' },
  { code: 'SE_ITM_BOX_BRK', label: 'Item box breaks', about: 'An item box breaking apart.', group: 'Items' },
  { code: 'SE_RC_ITEM_DECIDE', label: 'Item picked', about: 'When the item roulette stops on your item.', group: 'Items' },
  { code: 'SE_ITM_EQUIP', label: 'Item ready', about: 'Holding an item out behind you.', group: 'Items' },
  { code: 'SE_ITM_ALARM', label: 'Incoming item', about: 'The warning beep when something is coming for you.', group: 'Items' },
  { code: 'SE_ITM_KAME_R_MOVE', label: 'Red shell chasing', about: 'A red shell homing in.', group: 'Items' },
  { code: 'SE_ITM_KAME_HIT', label: 'Shell hit', about: 'Getting hit by a shell.', group: 'Items' },
  { code: 'SE_ITM_BANANA_GND', label: 'Banana lands', about: 'A banana dropping onto the track.', group: 'Items' },
  { code: 'SE_ITM_STAR_STATE', label: 'Star power', about: 'While a Star is running.', group: 'Items' },
  { code: 'SE_ITM_STAR_HIT', label: 'Star hit', about: 'Ramming someone with a Star.', group: 'Items' },
  { code: 'SE_ITM_THNDR_USE', label: 'Lightning', about: 'Someone uses the Lightning.', group: 'Items' },
  { code: 'SE_ITM_KUMO_ON', label: 'Thundercloud', about: 'A Thundercloud landing on someone.', group: 'Items' },
  { code: 'SE_ITM_BIG_KINOKO_USE', label: 'Mega Mushroom', about: 'Growing big.', group: 'Items' },
  { code: 'SE_ITM_BIG_KINOKO_STATE', label: 'Mega Mushroom, while big', about: 'The loop that plays while you’re big.', group: 'Items' },
  { code: 'SE_ITM_BOMB_HIBANA', label: 'Bob-omb fuse', about: 'A Bob-omb’s fuse fizzing.', group: 'Items' },
  { code: 'SE_ITM_BOMB_EXPLODE', label: 'Bob-omb', about: 'A Bob-omb going off.', group: 'Items' },
  { code: 'SE_ITM_HANE_EXPLODE', label: 'Blue shell', about: 'The Spiny Shell exploding.', group: 'Items' },
  { code: 'W_BGM_FINALLAP_FAN', label: 'Final lap', about: 'The fanfare as you start the last lap.', group: 'Race and results' },
  {
    code: 'SE_UI_WIFI_COUNTDOWN_321',
    label: 'Online countdown',
    about: 'The 3, 2, 1 beeps in the online menus.',
    group: 'Race and results',
  },
  {
    code: 'SE_UI_CRS_ROULETTE',
    label: 'Track roulette',
    about: 'The ticks while the next track is picked online.',
    group: 'Race and results',
  },
  { code: 'SE_RC_BTL_FINISH', label: 'Battle finish', about: 'The end of a battle.', group: 'Race and results' },
  { code: 'SE_RSLT_POINT_UP', label: 'Points counting', about: 'Points ticking up on the results screen.', group: 'Race and results' },
  { code: 'SE_RSLT_WIFI_WIN', label: 'Online win', about: 'Your VR going up after an online race.', group: 'Race and results' },
  { code: 'SE_RSLT_WIFI_LOSE', label: 'Online loss', about: 'Your VR going down after an online race.', group: 'Race and results' },
  { code: 'W_BGM_TITLE', label: 'Title theme', about: 'The music on the title screen.', group: 'Music' },
];

const ALL = [TRICK, ...SOUNDS];
const GROUPS: Group[] = ['Driving', 'Items', 'Race and results', 'Music'];

type View = 'trick' | 'sounds';

/** Decodes any audio file the browser can read, at the wave's own rate, mixed down to one channel. */
async function toWaveAudio(file: File, rate: number): Promise<Int16Array> {
  const context = new OfflineAudioContext(1, 1, rate);
  let audio: AudioBuffer;
  try {
    audio = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('This browser can’t read that file. Try MP3, WAV or OGG.');
  }
  const out = new Int16Array(audio.length);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i];
    const s = (sum / channels.length) * 32767;
    out[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : Math.round(s);
  }
  return out;
}

const seconds = (w: Wave) => (w.format.samples / w.format.rate).toFixed(1);

/** The loudest point in each of `bars` slices, 0–1, for drawing a waveform. */
function peaks(pcm: Int16Array, bars: number): number[] {
  const step = Math.max(1, Math.floor(pcm.length / bars));
  return Array.from({ length: bars }, (_, b) => {
    let max = 0;
    for (let i = b * step, end = Math.min(pcm.length, i + step); i < end; i++) max = Math.max(max, Math.abs(pcm[i]));
    return max / 32768;
  });
}

/** A sound's shape, as a row of bars. */
function Waveform({ pcm, label, muted }: { pcm: Int16Array; label: string; muted?: boolean }) {
  const bars = useMemo(() => peaks(pcm, 96), [pcm]);
  return (
    <div className="flex h-14 items-center gap-px" role="img" aria-label={label}>
      {bars.map((v, i) => (
        <span
          key={i}
          className={cn('flex-1 rounded-full', muted ? 'bg-muted-foreground/40' : 'bg-foreground/80')}
          style={{ height: `${Math.max(4, v * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** The Sounds tool: open sound/revo_kart.brsar, replace the trick sound and other well-known sounds, save. */
export function SoundsApp() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; archive: Brsar; waves: Map<string, Wave[]> } | null>(null);
  // Per sound: your audio fitted to each of its waves.
  const [mine, setMine] = useState<Map<string, { pcm: Int16Array[]; from: string }>>(new Map());
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [view, setView] = useState<View>('trick');
  const [query, setQuery] = useState('');
  const browse = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const open = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isBrsar(bytes)) throw new Error('isn’t a .brsar file. Open sound/revo_kart.brsar.');
      const archive = readBrsar(bytes);
      const byName = new Map(archive.sounds.map(s => [s.name, s.waves]));
      const waves = new Map<string, Wave[]>();
      for (const s of ALL) {
        const found = byName.get(s.code);
        if (found?.length) waves.set(s.code, found);
      }
      if (!waves.size) throw new Error('has none of the sounds this tool replaces where the game keeps them.');
      audio.current?.pause();
      setPlaying(null);
      setFile({ name: f.name, bytes, archive, waves });
      setMine(new Map());
      setError('');
    } catch (err) {
      setError(`${f.name} ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const play = (key: string, pcm: Int16Array, rate: number) => {
    audio.current?.pause();
    if (playing === key) {
      setPlaying(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([toWav([pcm], rate)], { type: 'audio/wav' }));
    const el = new Audio(url);
    audio.current = el;
    el.onended = () => {
      setPlaying(null);
      URL.revokeObjectURL(url);
    };
    void el.play();
    setPlaying(key);
  };

  const choose = (code: string) => {
    target.current = code;
    pick.current?.click();
  };

  const replace = async (f: File | undefined) => {
    const code = target.current;
    const waves = code && file?.waves.get(code);
    if (!f || !code || !waves) return;
    try {
      const byRate = new Map<number, Int16Array>();
      const pcm: Int16Array[] = [];
      for (const w of waves) {
        let decoded = byRate.get(w.format.rate);
        if (!decoded) byRate.set(w.format.rate, (decoded = await toWaveAudio(f, w.format.rate)));
        pcm.push(fitToWave(decoded, w.format));
      }
      setMine(current => new Map(current).set(code, { pcm, from: f.name }));
    } catch (err) {
      toast.error('Couldn’t use that file', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const reset = (code: string) =>
    setMine(current => {
      const next = new Map(current);
      next.delete(code);
      return next;
    });

  // A copy of the archive with every replacement written in.
  const patched = () => {
    const bytes = file!.bytes.slice();
    for (const [code, { pcm }] of mine) file!.waves.get(code)!.forEach((w, i) => patchWave(bytes, w, pcm[i]));
    return bytes;
  };

  // Retro Rewind's Patches: only the archive files holding a replaced sound, each as <file ID>.<label>.brbnk or
  // .brwsd, which the game loads over those files of its own revo_kart.brsar. Several sounds can share one file.
  const exportPatches = () => {
    if (!file || !mine.size) return;
    try {
      const bytes = patched();
      const byFile = new Map<number, string[]>();
      for (const code of mine.keys())
        for (const w of file.waves.get(code)!) {
          const labels = byFile.get(w.file) ?? [];
          const label = ALL.find(s => s.code === code)!.label;
          if (!labels.includes(label)) labels.push(label);
          byFile.set(w.file, labels);
        }
      const zip = new ZipWriter();
      for (const [id, labels] of byFile) {
        const loose = looseFile(bytes, file.archive, id, labels.join('_').toLowerCase());
        if (!loose) throw new Error(`${labels.join(', ')} can’t be saved as a patch. Use “Whole ${file.name}” instead.`);
        zip.add(`${MUSIC_FOLDER}/${loose.name}`, loose.data);
      }
      download(zip.blob(), 'Rewind Sounds.zip');
      toast.success('Downloaded Rewind Sounds.zip', {
        description: 'Wheel Wizard: add it as a mod. SD card or Dolphin: unzip it so RetroRewind6 merges with yours.',
      });
    } catch (err) {
      toast.error('Couldn’t make the patch', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const save = () => {
    if (!file || !mine.size) return;
    try {
      download(new Blob([patched()]), file.name);
      toast.success(`Saved ${file.name}`, { description: 'Put it in your game or mod in place of sound/revo_kart.brsar.' });
    } catch (err) {
      toast.error('Couldn’t save', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const row = (s: SoundDef) => {
    const waves = file!.waves.get(s.code);
    if (!waves) return null;
    const first = waves[0];
    const yours = mine.get(s.code);
    const original = `o:${s.code}`;
    const replaced = `n:${s.code}`;
    return (
      <li key={s.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0">
        <Button
          variant="outline"
          size="icon"
          aria-label={`${playing === original ? 'Stop' : 'Play'} the original ${s.label} sound`}
          onClick={() => play(original, decodeWave(file!.bytes, first), first.format.rate)}
        >
          {playing === original ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        </Button>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium">{s.label}</span>
            {yours ? <Badge variant="secondary">Yours</Badge> : null}
          </div>
          <span className="text-muted-foreground text-[13px]">
            {s.about} {seconds(first)} s{yours ? `, now ${yours.from}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {yours ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${playing === replaced ? 'Stop' : 'Play'} your ${s.label} sound`}
                onClick={() => play(replaced, yours.pcm[0], first.format.rate)}
              >
                {playing === replaced ? (
                  <PauseIcon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <PlayIcon data-icon="inline-start" aria-hidden="true" />
                )}
                Yours
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Put back the original ${s.label} sound`}
                title="Put back the original"
                onClick={() => reset(s.code)}
              >
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => choose(s.code)}>
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {yours ? 'Change' : 'Replace'}
          </Button>
        </div>
      </li>
    );
  };

  const trickWaves = file?.waves.get(TRICK.code);
  const trickYours = mine.get(TRICK.code);
  const trickOriginal = useMemo(() => (file && trickWaves ? decodeWave(file.bytes, trickWaves[0]) : null), [file, trickWaves]);

  const q = query.trim().toLowerCase();
  const shown = SOUNDS.filter(s => file?.waves.has(s.code) && (!q || `${s.label} ${s.about} ${s.group}`.toLowerCase().includes(q)));
  const replacedOthers = SOUNDS.filter(s => mine.has(s.code)).length;

  return (
    <AppShell
      tabsLabel="Sounds"
      tabs={(['trick', 'sounds'] as View[]).map(v => (
        <Tab key={v} current={view === v} onSelect={() => setView(v)}>
          {v === 'trick' ? 'Trick sound' : 'Sounds'}
          {v === 'trick' && trickYours ? <Badge variant="secondary">Yours</Badge> : null}
          {v === 'sounds' && replacedOthers ? (
            <Badge variant="secondary" className="tabular-nums">
              {replacedOthers}
            </Badge>
          ) : null}
        </Tab>
      ))}
      status={
        file ? (
          <span>
            <b className="text-foreground font-medium">{file.name}</b>
            {mine.size ? `, ${mine.size} replaced` : ''}
          </span>
        ) : undefined
      }
      actions={
        file ? (
          <>
            <Button variant="outline" onClick={() => browse.current?.click()}>
              <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
              Open another
            </Button>
            <Button variant="outline" disabled={!mine.size} onClick={save} title="The whole archive, for other mods or a patched game">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              Whole {file.name}
            </Button>
            <Button disabled={!mine.size} onClick={exportPatches}>
              <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              Download for Retro Rewind
            </Button>
          </>
        ) : null
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <input
          ref={browse}
          type="file"
          accept=".brsar"
          hidden
          onChange={e => {
            void open(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={pick}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={e => {
            void replace(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>That file didn’t open</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!file ? (
          <Empty
            className={cn(
              'bg-card/60 min-h-[min(56vh,480px)] border border-dashed transition-colors',
              dragging && 'border-foreground bg-muted',
            )}
            onDragOver={e => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              void open(e.dataTransfer.files[0]);
            }}
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileUpIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-xl">Drop revo_kart.brsar here</EmptyTitle>
              <EmptyDescription>
                From your game or mod’s sound folder. Swap the trick sound and {SOUNDS.length} others, from boosts to the title theme. It
                stays on your computer: nothing is uploaded.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="lg" onClick={() => browse.current?.click()}>
                <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
                Choose revo_kart.brsar
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Reveal id={view} className="flex flex-col gap-6">
            {view === 'trick' ? (
              trickWaves && trickOriginal ? (
                <section className="bg-card flex flex-col gap-5 rounded-xl border p-6" aria-labelledby="trick-title">
                  <div className="flex flex-col gap-1">
                    <h2 id="trick-title" className="text-xl font-semibold tracking-[-0.01em]">
                      Trick sound
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {TRICK.about} Every character and kart uses this one sound, so one replacement changes it for everyone. It’s{' '}
                      {seconds(trickWaves[0])} seconds long.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-muted-foreground text-[13px]">Original</span>
                      <Waveform pcm={trickOriginal} label="The original trick sound’s waveform" muted={!!trickYours} />
                    </div>
                    {trickYours ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground text-[13px]">Yours: {trickYours.from}</span>
                        <Waveform pcm={trickYours.pcm[0]} label="Your trick sound’s waveform" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => play(`o:${TRICK.code}`, trickOriginal, trickWaves[0].format.rate)}>
                      {playing === `o:${TRICK.code}` ? (
                        <PauseIcon data-icon="inline-start" aria-hidden="true" />
                      ) : (
                        <PlayIcon data-icon="inline-start" aria-hidden="true" />
                      )}
                      Original
                    </Button>
                    {trickYours ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => play(`n:${TRICK.code}`, trickYours.pcm[0], trickWaves[0].format.rate)}
                      >
                        {playing === `n:${TRICK.code}` ? (
                          <PauseIcon data-icon="inline-start" aria-hidden="true" />
                        ) : (
                          <PlayIcon data-icon="inline-start" aria-hidden="true" />
                        )}
                        Yours
                      </Button>
                    ) : null}
                    <Button onClick={() => choose(TRICK.code)}>
                      <UploadIcon data-icon="inline-start" aria-hidden="true" />
                      {trickYours ? 'Change' : 'Replace'}
                    </Button>
                    {trickYours ? (
                      <Button variant="ghost" onClick={() => reset(TRICK.code)}>
                        <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                        Put back the original
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground border-t pt-4 text-[13px] leading-snug">
                    Any audio file works: MP3, WAV, OGG and more. A longer clip is cut with a short fade, a shorter one ends in silence.
                    Then use Download for Retro Rewind at the top.
                  </p>
                </section>
              ) : (
                <Alert>
                  <AlertTitle>No trick sound in this file</AlertTitle>
                  <AlertDescription>This copy of revo_kart.brsar doesn’t have the trick sound where the game keeps it.</AlertDescription>
                </Alert>
              )
            ) : (
              <>
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    aria-label="Find a sound"
                    placeholder="Find a sound, like boost, shell or countdown"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setQuery('')}
                  />
                  {query ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery('')}>
                        <XIcon aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
                {shown.length ? (
                  GROUPS.map(g => {
                    const list = shown.filter(s => s.group === g);
                    return list.length ? (
                      <section key={g} className="flex flex-col gap-2" aria-labelledby={`group-${g}`}>
                        <h2 id={`group-${g}`} className="text-muted-foreground text-sm font-medium">
                          {g}
                        </h2>
                        <ul className="bg-card overflow-hidden rounded-xl border">{list.map(row)}</ul>
                      </section>
                    ) : null;
                  })
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">No sound matches “{query.trim()}”.</p>
                )}
                <p className="text-muted-foreground text-[13px] leading-snug">
                  Any audio file works. Each sound keeps its original length, so longer clips are cut with a short fade and shorter ones end
                  in silence. Labels come from the game’s own sound names, so press play to check one before replacing it.
                </p>
              </>
            )}
            <div className="bg-card flex flex-col gap-2 rounded-xl border p-5 text-sm">
              <h2 className="font-medium">Playing it in Retro Rewind</h2>
              <p className="text-muted-foreground">
                Download for Retro Rewind gives a small zip with only the changed sound files, as Retro Rewind Patches. It includes
                everything you replaced on both tabs. In Wheel Wizard, add the zip as a mod. On a Wii SD card or in Dolphin, unzip it so its
                RetroRewind6 folder merges with yours. Turn on Patches in the game’s settings if they’re off.
              </p>
              <p className="text-muted-foreground">
                Patch files replace whole groups of sounds, so open the revo_kart.brsar from your Retro Rewind install: that way the sounds
                you didn’t change stay exactly as Retro Rewind has them.
              </p>
            </div>
          </Reveal>
        )}
      </div>
    </AppShell>
  );
}
