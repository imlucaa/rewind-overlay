'use client';

import { useMemo, useRef, useState } from 'react';
import { FileUpIcon, FolderOpenIcon, PauseIcon, PlayIcon, RotateCcwIcon, SaveIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Reveal, Split, Tab } from '@/components/layout/AppShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { download } from '@/hooks/useExport';
import { toWav } from '@/lib/music/brstmRead';
import { decodeWave, fitToWave, isBrsar, patchWave, readBrsar, type SoundEntry, type Wave } from '@/lib/sound/brsar';
import { cn } from '@/lib/utils';

type View = 'all' | 'replaced';
// Long lists render in pages; the search narrows them down.
const PAGE = 120;

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

const seconds = (w: Wave) => (w.format.samples / w.format.rate).toFixed(2);

/** The Sounds tool: open sound/revo_kart.brsar, listen to its sound effects, replace any with your own audio, save. */
export function SoundsApp() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; sounds: SoundEntry[] } | null>(null);
  const [replaced, setReplaced] = useState<Map<string, { pcm: Int16Array; from: string }>>(new Map());
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const browse = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const open = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isBrsar(bytes)) throw new Error('isn’t a .brsar file. Open sound/revo_kart.brsar.');
      const { sounds } = readBrsar(bytes);
      if (!sounds.length) throw new Error('has no sound effects this tool can replace.');
      setFile({ name: f.name, bytes, sounds });
      setReplaced(new Map());
      setError('');
    } catch (err) {
      setError(`${f.name} ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // How many sounds play each wave: replacing a shared wave changes all of them.
  const sharing = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of file?.sounds ?? []) for (const w of s.waves) count.set(w.key, (count.get(w.key) ?? 0) + 1);
    return count;
  }, [file]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (file?.sounds ?? []).filter(
      s => (view === 'all' || s.waves.some(w => replaced.has(w.key))) && (!q || s.name.toLowerCase().includes(q)),
    );
  }, [file, query, view, replaced]);

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

  const replace = async (wave: Wave, f: File | undefined) => {
    if (!f) return;
    try {
      const pcm = fitToWave(await toWaveAudio(f, wave.format.rate), wave.format);
      setReplaced(current => new Map(current).set(wave.key, { pcm, from: f.name }));
    } catch (err) {
      toast.error('Couldn’t use that file', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const reset = (wave: Wave) =>
    setReplaced(current => {
      const next = new Map(current);
      next.delete(wave.key);
      return next;
    });

  const save = () => {
    if (!file) return;
    try {
      const bytes = file.bytes.slice();
      const waves = new Map(file.sounds.flatMap(s => s.waves).map(w => [w.key, w]));
      for (const [key, { pcm }] of replaced) {
        const wave = waves.get(key);
        if (wave) patchWave(bytes, wave, pcm);
      }
      download(new Blob([bytes]), file.name);
      toast.success(`Saved ${file.name}`, { description: 'Put it in your game or mod in place of sound/revo_kart.brsar.' });
    } catch (err) {
      toast.error('Couldn’t save', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const row = (sound: SoundEntry) => {
    const wave = sound.waves[0];
    const mine = replaced.get(wave.key);
    const shared = (sharing.get(wave.key) ?? 1) - 1;
    const originalKey = `o:${sound.index}`;
    const newKey = `n:${sound.index}`;
    const input = `up-${sound.index}`;
    return (
      <div key={sound.index} className="hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 transition-colors last:border-b-0">
        <Button
          variant="outline"
          size="icon"
          aria-label={`${playing === originalKey ? 'Stop' : 'Play'} the original ${sound.name}`}
          onClick={() => play(originalKey, decodeWave(file!.bytes, wave), wave.format.rate)}
        >
          {playing === originalKey ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        </Button>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-medium">{sound.name}</span>
            {mine ? <Badge variant="secondary">Replaced</Badge> : null}
          </div>
          <span className="text-muted-foreground text-[13px]">
            {seconds(wave)} s, {Math.round(wave.format.rate / 100) / 10} kHz
            {shared ? `, shared with ${shared} other sound${shared === 1 ? '' : 's'}` : ''}
            {mine ? `, now ${mine.from}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mine ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => play(newKey, mine.pcm, wave.format.rate)}
                aria-label={`${playing === newKey ? 'Stop' : 'Play'} your replacement for ${sound.name}`}
              >
                {playing === newKey ? <PauseIcon data-icon="inline-start" aria-hidden="true" /> : <PlayIcon data-icon="inline-start" aria-hidden="true" />}
                Yours
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Put back the original ${sound.name}`} title="Put back the original" onClick={() => reset(wave)}>
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <label htmlFor={input} className="cursor-pointer">
              <UploadIcon data-icon="inline-start" aria-hidden="true" />
              {mine ? 'Change' : 'Replace'}
            </label>
          </Button>
          <input
            id={input}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            hidden
            onChange={e => {
              void replace(wave, e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <AppShell
      tabsLabel="Sounds"
      tabs={(['all', 'replaced'] as View[]).map(v => (
        <Tab key={v} current={view === v} onSelect={() => setView(v)}>
          {v === 'all' ? 'All sounds' : 'Replaced'}
          {v === 'replaced' && replaced.size ? <Badge variant="secondary" className="tabular-nums">{replaced.size}</Badge> : null}
        </Tab>
      ))}
      status={
        file ? (
          <span>
            <b className="text-foreground font-medium">{file.name}</b>, {(file.bytes.length / 1024 / 1024).toFixed(1)} MB, {file.sounds.length} sound effects
            {replaced.size ? `, ${replaced.size} replaced` : ''}
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
            <Button disabled={!replaced.size} onClick={save}>
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              Save {file.name}
            </Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-6">
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
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>That file didn’t open</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!file ? (
          <Empty
            className={cn('bg-card/60 min-h-[min(62vh,560px)] border border-dashed transition-colors', dragging && 'border-foreground bg-muted')}
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
                Mario Kart Wii’s sound/revo_kart.brsar, or a mod’s copy of it. It holds the game’s sound effects. It stays on your
                computer: nothing is uploaded.
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
          <Split
            sideLabel="How it works"
            side={
              <div className="bg-card flex flex-col gap-3 rounded-xl border p-5">
                <h2 className="text-sm font-medium">How it works</h2>
                <ol className="text-muted-foreground flex list-decimal flex-col gap-2 pl-5 text-sm">
                  <li>Find a sound by name (try trick, jump or boost) and press play to check it’s the right one.</li>
                  <li>Press Replace and pick any audio file: MP3, WAV, OGG and more.</li>
                  <li>Save, then put the file in your game or mod in place of sound/revo_kart.brsar. Keep the original.</li>
                </ol>
                <p className="text-muted-foreground border-t pt-3 text-[13px] leading-snug">
                  Your audio is fitted to the original’s length: longer clips are cut with a short fade, shorter ones end in silence.
                  That keeps every other sound in the file exactly where the game expects it.
                </p>
              </div>
            }
          >
            <Reveal id={view} className="flex flex-col gap-4">
              <div className="relative">
                <SearchIcon aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  aria-label="Find a sound"
                  placeholder="Find a sound, like trick, jump or boost"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setShown(PAGE);
                  }}
                  className="pl-9"
                />
              </div>
              {list.length ? (
                <div className="bg-card overflow-hidden rounded-xl border">{list.slice(0, shown).map(row)}</div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {view === 'replaced' && !query ? 'Nothing replaced yet.' : `No sound matches “${query.trim()}”.`}
                </p>
              )}
              {list.length > shown ? (
                <Button variant="outline" className="self-center" onClick={() => setShown(n => n + PAGE)}>
                  Show more ({list.length - shown} left)
                </Button>
              ) : null}
            </Reveal>
          </Split>
        )}
      </div>
    </AppShell>
  );
}
