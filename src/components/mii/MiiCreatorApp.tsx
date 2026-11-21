'use client';

// The Mii Creator: Wheel Wizard's Mii editor, on the web. The Mii stands on the left (drag to turn it); its parts are
// grouped the way Wheel Wizard groups them, each choice drawn as a face, with colours and sliders for size and
// position. Everything happens in the browser; Mii Studio only receives the look to draw it.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { DicesIcon, DownloadIcon, FileUpIcon, Redo2Icon, RotateCcwIcon, Undo2Icon, UserSearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Reveal, Split, Tab } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { download } from '@/hooks/useExport';
import {
  FRAMES,
  creatorOf,
  get,
  isValidMii,
  nameOf,
  newMii,
  randomize,
  range,
  setMany,
  studioCode,
  studioUrl,
  withCreator,
  withGender,
  withName,
  type FieldKey,
  type Mii,
} from '@/lib/mii/mii';
import { getPlayer, miiBytes, normalizeFriendCode, safeFileName } from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';

// ---------- what each group edits (Wheel Wizard's groups; its colour swatches from MiiColorMappings)

const FAVORITE = ['#FC2114', '#FF771B', '#FFED21', '#8FF01F', '#008232', '#0A50B8', '#47BAE1', '#FF627E', '#8A2AB0', '#573E17', '#FFFFFA', '#000000'];
const FAVORITE_NAMES = ['Red', 'Orange', 'Yellow', 'Light green', 'Green', 'Blue', 'Light blue', 'Pink', 'Purple', 'Brown', 'White', 'Black'];
const HAIR = ['#000000', '#562D1B', '#782515', '#9D4A20', '#988B8C', '#684E1B', '#AB6A24', '#FFB757'];
const HAIR_NAMES = ['Black', 'Brown', 'Red', 'Light red', 'Grey', 'Light brown', 'Blonde', 'Gold'];
const SKIN = ['#FFD39D', '#FFB963', '#DE7B3D', '#FFAB80', '#C85327', '#752E17'];
const EYE = ['#000000', '#5A5E66', '#96482D', '#A59837', '#555DC3', '#488F64'];
const EYE_NAMES = ['Black', 'Grey', 'Brown', 'Gold', 'Blue', 'Green'];
const LIPS = ['#FF120D', '#FF534D', '#FF5D0D'];
const LIP_NAMES = ['Red', 'Pink', 'Skin'];
const GLASSES = ['#909090', '#FFAF47', '#CA9366', '#7B87BD', '#FF574D', '#DCC5BE'];
const GLASSES_NAMES = ['Grey', 'Gold', 'Dark gold', 'Blue', 'Red', 'White'];

interface Adjust {
  key: FieldKey;
  label: string;
  low: string;
  high: string;
}
interface Part {
  id: string;
  label: string;
  /** The field picked from the grid of faces. */
  type?: FieldKey;
  /** Type 0 is "none" (glasses, mustache, beard). */
  none?: boolean;
  colors?: { key: FieldKey; swatches: string[]; names?: string[] };
  adjust?: Adjust[];
  toggle?: { key: FieldKey; label: string };
  /** Zoom and the height (0 top, 1 bottom) to centre each tile on. */
  focus?: [number, number];
}
interface Group {
  id: string;
  label: string;
  body?: boolean;
  parts: Part[];
}

const up = (key: FieldKey): Adjust => ({ key, label: 'Height', low: 'Up', high: 'Down' });
const size = (key: FieldKey): Adjust => ({ key, label: 'Size', low: 'Small', high: 'Big' });
const tilt = (key: FieldKey): Adjust => ({ key, label: 'Tilt', low: 'Flat', high: 'Steep' });
const spacing = (key: FieldKey): Adjust => ({ key, label: 'Spacing', low: 'Close', high: 'Apart' });

const GROUPS: Group[] = [
  { id: 'profile', label: 'Profile', body: true, parts: [] },
  {
    id: 'face',
    label: 'Face',
    parts: [
      { id: 'shape', label: 'Shape', type: 'faceShape', colors: { key: 'skinColor', swatches: SKIN }, focus: [1, 0.5] },
      { id: 'features', label: 'Features', type: 'facialFeature', colors: { key: 'skinColor', swatches: SKIN }, focus: [1.25, 0.55] },
      { id: 'mole', label: 'Mole', toggle: { key: 'hasMole', label: 'Mole' }, adjust: [up('moleVertical'), { key: 'moleHorizontal', label: 'Side', low: 'Left', high: 'Right' }, size('moleSize')] },
    ],
  },
  { id: 'hair', label: 'Hair', parts: [{ id: 'hair', label: 'Hair', type: 'hairType', colors: { key: 'hairColor', swatches: HAIR, names: HAIR_NAMES }, toggle: { key: 'hairFlipped', label: 'Part on the other side' }, focus: [1, 0.4] }] },
  {
    id: 'eyes',
    label: 'Eyes',
    parts: [
      { id: 'eyes', label: 'Eyes', type: 'eyeType', colors: { key: 'eyeColor', swatches: EYE, names: EYE_NAMES }, adjust: [up('eyeVertical'), size('eyeSize'), tilt('eyeRotation'), spacing('eyeSpacing')], focus: [2.2, 0.5] },
      { id: 'eyebrows', label: 'Eyebrows', type: 'eyebrowType', colors: { key: 'eyebrowColor', swatches: HAIR, names: HAIR_NAMES }, adjust: [up('eyebrowVertical'), size('eyebrowSize'), tilt('eyebrowRotation'), spacing('eyebrowSpacing')], focus: [2.2, 0.42] },
      { id: 'glasses', label: 'Glasses', type: 'glassesType', none: true, colors: { key: 'glassesColor', swatches: GLASSES, names: GLASSES_NAMES }, adjust: [up('glassesVertical'), size('glassesSize')], focus: [1.7, 0.5] },
    ],
  },
  { id: 'nose', label: 'Nose', parts: [{ id: 'nose', label: 'Nose', type: 'noseType', adjust: [up('noseVertical'), size('noseSize')], focus: [2.4, 0.58] }] },
  { id: 'mouth', label: 'Mouth', parts: [{ id: 'mouth', label: 'Mouth', type: 'mouthType', colors: { key: 'mouthColor', swatches: LIPS, names: LIP_NAMES }, adjust: [up('mouthVertical'), size('mouthSize')], focus: [2.4, 0.68] }] },
  {
    id: 'beard',
    label: 'Facial hair',
    parts: [
      { id: 'mustache', label: 'Mustache', type: 'mustacheType', none: true, colors: { key: 'facialHairColor', swatches: HAIR, names: HAIR_NAMES }, adjust: [up('mustacheVertical'), size('mustacheSize')], focus: [2.2, 0.66] },
      { id: 'beard', label: 'Beard', type: 'beardType', none: true, colors: { key: 'facialHairColor', swatches: HAIR, names: HAIR_NAMES }, focus: [1.5, 0.72] },
    ],
  },
  { id: 'body', label: 'Body', body: true, parts: [{ id: 'body', label: 'Body', adjust: [{ key: 'height', label: 'Height', low: 'Short', high: 'Tall' }, { key: 'weight', label: 'Build', low: 'Thin', high: 'Wide' }] }] },
];

// ---------- the Mii, turnable

/**
 * The newest of the wanted images that has finished loading. While a new one loads (after an edit) the previous one
 * stays, so the Mii never flashes empty. The browser caches each render, so going back to one is instant.
 */
function useLoadedImage(url: string) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live) setShown(url);
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return shown;
}

/** Drag sideways to turn; a flick keeps it turning and slowing down. */
function useSpin() {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; start: number; lastX: number; lastT: number; v: number } | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return {
    angle,
    reset: () => setAngle(0),
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return;
        cancelAnimationFrame(raf.current);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, start: angle, lastX: e.clientX, lastT: performance.now(), v: 0 };
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const now = performance.now();
        d.v = ((e.clientX - d.lastX) / Math.max(1, now - d.lastT)) * 0.9;
        d.lastX = e.clientX;
        d.lastT = now;
        setAngle(d.start + (e.clientX - d.x) * 0.9);
      },
      onPointerUp: () => {
        const d = drag.current;
        drag.current = null;
        if (!d || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let v = d.v * 16;
        const tick = () => {
          v *= 0.94;
          if (Math.abs(v) < 0.2) return;
          setAngle(a => a + v);
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      },
    },
  };
}

function MiiStage({ mii, body }: { mii: Mii; body: boolean }) {
  const spin = useSpin();
  const [hover, setHover] = useState(false);
  const code = studioCode(mii);
  const normal = studioUrl(code, { body, frames: FRAMES });
  const smile = studioUrl(code, { body, frames: FRAMES, smile: true });
  // The smile strip while the pointer is on the Mii, the normal one otherwise; each shows once it has loaded.
  const shown = useLoadedImage(hover ? smile : normal);
  const frame = ((Math.round(spin.angle / (360 / FRAMES)) % FRAMES) + FRAMES) % FRAMES;

  return (
    <div
      {...spin.handlers}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onDoubleClick={spin.reset}
      title="Drag to turn your Mii. Double-click to face it front."
      className="relative aspect-square w-full cursor-grab touch-none select-none active:cursor-grabbing"
    >
      <div aria-hidden className="bg-primary/15 absolute bottom-[6%] left-1/2 h-[7%] w-1/2 -translate-x-1/2 rounded-[50%] blur-[1px]" />
      {shown ? (
        <div
          role="img"
          aria-label={`${nameOf(mii) || 'Your Mii'}, turned ${Math.round(frame * (360 / FRAMES))} degrees`}
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${shown}")`,
            backgroundSize: `${FRAMES * 100}% 100%`,
            backgroundPositionX: `${(frame / (FRAMES - 1)) * 100}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <div className="bg-muted absolute inset-[25%] animate-pulse rounded-full" />
      )}
    </div>
  );
}

// ---------- controls

function Swatches({ label, swatches, names, value, onPick }: { label: string; swatches: string[]; names?: string[]; value: number; onPick: (v: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted-foreground mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {swatches.map((hex, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            aria-label={names?.[i] ?? `Colour ${i + 1}`}
            title={names?.[i]}
            onClick={() => onPick(i)}
            className={cn(
              'size-9 cursor-pointer rounded-full ring-2 ring-offset-2 ring-offset-background transition-[box-shadow,transform] duration-150 ease-out active:scale-90',
              value === i ? 'ring-primary' : 'ring-border hover:ring-muted-foreground/50',
            )}
            style={{ background: hex }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function AdjustSlider({ adj, value, onChange }: { adj: Adjust; value: number; onChange: (v: number) => void }) {
  const { min, max } = range(adj.key);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <Label className="font-medium">{adj.label}</Label>
        <span className="text-muted-foreground tabular-nums">
          {value - min + 1} / {max - min + 1}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} aria-label={adj.label} />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{adj.low}</span>
        <span>{adj.high}</span>
      </div>
    </div>
  );
}

function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card ring-border/70 flex flex-col gap-4 rounded-2xl p-4 ring-1', className)}>
      {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

// ---------- the page

export function MiiCreatorApp() {
  const [mii, setMii] = useState<Mii>(() => newMii());
  const [past, setPast] = useState<Mii[]>([]);
  const [future, setFuture] = useState<Mii[]>([]);
  const [groupId, setGroupId] = useState('face');
  const [partId, setPartId] = useState<Record<string, string>>({});
  const [fc, setFc] = useState('');
  const [loadingFc, setLoadingFc] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  const group = GROUPS.find(g => g.id === groupId)!;
  const part = group.parts.find(p => p.id === partId[group.id]) ?? group.parts[0];

  const commit = useCallback(
    (next: Mii) => {
      setPast(p => [...p.slice(-99), mii]);
      setFuture([]);
      setMii(next);
    },
    [mii],
  );
  const change = (edits: Partial<Record<FieldKey, number>>) => commit(setMany(mii, edits));
  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture(f => [mii, ...f]);
    setMii(past[past.length - 1]);
    setPast(p => p.slice(0, -1));
  }, [past, mii]);
  const redo = useCallback(() => {
    if (!future.length) return;
    setPast(p => [...p, mii]);
    setMii(future[0]);
    setFuture(f => f.slice(1));
  }, [future, mii]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const loadBytes = (bytes: Uint8Array | null, from: string) => {
    if (!bytes || !isValidMii(bytes)) {
      toast.error(`${from} isn't a Wii Mii (a .mii file is 74 bytes).`);
      return;
    }
    commit(new Uint8Array(bytes) as Mii);
    toast.success(`Loaded ${nameOf(bytes as Mii) || 'the Mii'}`);
  };

  async function openFile(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer());
    // .rsd files carry a 2-byte checksum after the Mii; the Mii itself is the first 74 bytes.
    loadBytes(buf.length === 76 ? buf.slice(0, 74) : buf, file.name);
  }

  const loadFromFriendCode = useCallback(async (code: string) => {
    const normalized = normalizeFriendCode(code);
    if (!normalized) {
      toast.error('Type a friend code like 1234-5678-9012.');
      return;
    }
    setLoadingFc(true);
    try {
      const player = await getPlayer(normalized);
      const bytes = miiBytes(player.miiData);
      if (!bytes) toast.error(`${player.name || 'That player'} has no Mii saved on RWFC.`);
      else loadBytes(bytes, player.name);
    } catch {
      toast.error('No player with that friend code on RWFC.');
    } finally {
      setLoadingFc(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mii]);

  // ?fc=1234-5678-9012 opens that player's Mii, so profiles can link here.
  const opened = useRef(false);
  useEffect(() => {
    const code = params.get('fc');
    if (code && !opened.current) {
      opened.current = true;
      setFc(code);
      void loadFromFriendCode(code);
    }
  }, [params, loadFromFriendCode]);

  const name = nameOf(mii);
  const type = part?.type;
  const typeRange = type ? range(type) : null;

  const side = (
    <Panel>
      <MiiStage mii={mii} body={!!group.body} />
      <p className="text-muted-foreground -mt-2 text-center text-xs">Drag to turn your Mii</p>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="mii-name">Name</Label>
          <Input
            id="mii-name"
            key={`n${name}`}
            defaultValue={name}
            maxLength={10}
            onBlur={e => e.target.value !== name && commit(withName(mii, e.target.value))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mii-creator">Creator</Label>
          <Input
            id="mii-creator"
            key={`c${creatorOf(mii)}`}
            defaultValue={creatorOf(mii)}
            maxLength={10}
            onBlur={e => e.target.value !== creatorOf(mii) && commit(withCreator(mii, e.target.value))}
          />
        </div>
      </div>
    </Panel>
  );

  return (
    <AppShell
      tabsLabel="Parts"
      status={`${name || 'Your Mii'}${past.length ? ', edited' : ''}`}
      tabs={GROUPS.map(g => (
        <Tab key={g.id} current={g.id === groupId} onSelect={() => setGroupId(g.id)}>
          {g.label}
        </Tab>
      ))}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}>
            <Undo2Icon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!future.length} onClick={redo}>
            <Redo2Icon />
          </Button>
          <Button variant="outline" onClick={() => commit(randomize(mii))}>
            <DicesIcon data-icon="inline-start" />
            Surprise me
          </Button>
          <Button variant="outline" onClick={() => commit(newMii(Date.now(), get(mii, 'isGirl') === 1))}>
            <RotateCcwIcon data-icon="inline-start" />
            Start over
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <FileUpIcon data-icon="inline-start" />
            Open .mii
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".mii,.miigx,.mae,.rcd,.rsd,application/octet-stream"
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void openFile(file);
            }}
          />
          <Button onClick={() => download(new Blob([mii], { type: 'application/octet-stream' }), `${safeFileName(name || 'Mii')}.mii`)}>
            <DownloadIcon data-icon="inline-start" />
            Download .mii
          </Button>
        </div>
      }
    >
      <Split side={side} sideLabel="Your Mii" sidePosition="start">
        <Reveal id={group.id} className="flex flex-col gap-4">
          {group.id === 'profile' ? (
            <>
              <Panel title="About">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Gender</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Male', 'Female'].map((label, i) => (
                        <Button key={label} variant={get(mii, 'isGirl') === i ? 'default' : 'outline'} onClick={() => get(mii, 'isGirl') !== i && commit(withGender(mii, i === 1))}>
                          {label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Changes the body. A Mii you haven&rsquo;t styled yet also gets a matching starting face.
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="mii-month">Birthday</Label>
                    <div className="flex gap-2">
                      <select
                        id="mii-month"
                        value={get(mii, 'birthMonth')}
                        onChange={e => change({ birthMonth: Number(e.target.value), ...(Number(e.target.value) === 0 ? { birthDay: 0 } : {}) })}
                        className="border-input bg-background h-9 flex-1 rounded-md border px-2 text-sm"
                      >
                        <option value={0}>Not set</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' })}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Birth day"
                        value={get(mii, 'birthDay')}
                        disabled={!get(mii, 'birthMonth')}
                        onChange={e => change({ birthDay: Number(e.target.value) })}
                        className="border-input bg-background h-9 w-20 rounded-md border px-2 text-sm"
                      >
                        <option value={0}>-</option>
                        {Array.from({ length: new Date(2000, get(mii, 'birthMonth') || 1, 0).getDate() }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <Button
                  variant={get(mii, 'isFavorite') ? 'default' : 'outline'}
                  className="w-fit"
                  onClick={() => change({ isFavorite: get(mii, 'isFavorite') ? 0 : 1 })}
                >
                  {get(mii, 'isFavorite') ? 'Favorite Mii' : 'Mark as favorite'}
                </Button>
              </Panel>
              <Panel>
                <Swatches label="Favorite colour" swatches={FAVORITE} names={FAVORITE_NAMES} value={get(mii, 'favoriteColor')} onPick={v => change({ favoriteColor: v })} />
              </Panel>
              <Panel title="Load a player's Mii">
                <form
                  className="flex gap-2"
                  onSubmit={e => {
                    e.preventDefault();
                    void loadFromFriendCode(fc);
                  }}
                >
                  <Input value={fc} onChange={e => setFc(e.target.value)} placeholder="Friend code, e.g. 1234-5678-9012" aria-label="Friend code" />
                  <Button type="submit" disabled={loadingFc}>
                    <UserSearchIcon data-icon="inline-start" />
                    Load
                  </Button>
                </form>
                <p className="text-muted-foreground text-xs">Loads the Mii a Retro Rewind player last used online (from RWFC), so you can edit a copy.</p>
              </Panel>
            </>
          ) : (
            <>
              {group.parts.length > 1 ? (
                <div role="tablist" aria-label={group.label} className="bg-muted flex w-fit gap-1 rounded-xl p-1">
                  {group.parts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={p.id === part.id}
                      onClick={() => setPartId(s => ({ ...s, [group.id]: p.id }))}
                      className={cn(
                        'cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                        p.id === part.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {type && typeRange ? (
                <Panel title={part.label}>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                    {Array.from({ length: typeRange.max - typeRange.min + 1 }, (_, i) => typeRange.min + i).map(v => {
                      const on = get(mii, type) === v;
                      const [zoom, focusY] = part.focus ?? [1, 0.5];
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={on}
                          aria-label={v === 0 && part.none ? 'None' : `${part.label} ${v + 1}`}
                          onClick={() => change({ [type]: v })}
                          className={cn(
                            'bg-muted/40 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl ring-2 transition-[box-shadow,transform] duration-150 ease-out active:scale-95',
                            on ? 'ring-primary bg-primary/10' : 'ring-transparent hover:ring-border',
                          )}
                        >
                          {v === 0 && part.none ? (
                            <span className="text-muted-foreground text-sm font-medium">None</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- Mii Studio renders, already the size shown
                            <img
                              src={studioUrl(studioCode(setMany(mii, { [type]: v })), { width: 96 })}
                              alt=""
                              loading="lazy"
                              draggable={false}
                              className="size-full object-contain"
                              style={{ transform: `scale(${zoom})`, transformOrigin: `50% ${focusY * 100}%` } as CSSProperties}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Panel>
              ) : null}

              {part.toggle ? (
                <Panel>
                  <Button
                    variant={get(mii, part.toggle.key) ? 'default' : 'outline'}
                    className="w-fit"
                    onClick={() => change({ [part.toggle!.key]: get(mii, part.toggle!.key) ? 0 : 1 })}
                  >
                    {part.toggle.label}: {get(mii, part.toggle.key) ? 'on' : 'off'}
                  </Button>
                </Panel>
              ) : null}

              {part.colors || part.adjust ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {part.colors ? (
                    <Panel>
                      <Swatches
                        label="Colour"
                        swatches={part.colors.swatches}
                        names={part.colors.names}
                        value={get(mii, part.colors.key)}
                        onPick={v => change({ [part.colors!.key]: v })}
                      />
                    </Panel>
                  ) : null}
                  {part.adjust ? (
                    <Panel className={cn(!part.colors && 'md:col-span-2')}>
                      {part.adjust.map(adj => (
                        <AdjustSlider key={adj.key} adj={adj} value={get(mii, adj.key)} onChange={v => change({ [adj.key]: v })} />
                      ))}
                    </Panel>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Reveal>
      </Split>
    </AppShell>
  );
}
