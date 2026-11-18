'use client';

import { useMemo, useRef, useState } from 'react';
import { FileUpIcon, FolderOpenIcon, RotateCcwIcon, SaveIcon, SearchIcon } from 'lucide-react';
import { AppShell, Reveal, Split, Tab } from '@/components/layout/AppShell';
import { download } from '@/hooks/useExport';
import { isYaz0, yaz0Decode, yaz0Encode } from '@/lib/szs/yaz0';
import { readU8, writeU8, type U8Node } from '@/lib/szs/u8';
import { fromHex, groupColors, readBreff, recolorGroup, toHex, type Effect, type Rgb } from '@/lib/szs/breff';
import { EFFECT_GROUPS, groupOf, type EffectGroup } from '@/lib/szs/effectGroups';
import { readBreft, writeBreft, type Breft, type Texture } from '@/lib/szs/breft';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HexColorPopover } from '@/components/ui/hex-color-picker';
import { HoldButton } from '@/components/ui/hold-button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { TexturesView } from './TexturesView';

const SECTIONS = [...new Set(EFFECT_GROUPS.map(g => g.section))];
type Section = (typeof SECTIONS)[number] | 'all' | 'textures';
// How many of a group's colors the strip under each card shows, most used first.
const STRIP = 8;

interface Archive {
  name: string;
  /** Bytes, for the header line. */
  size: number;
  nodes: U8Node[];
  /** The race effects (Effect/RKRace.breff), or -1. */
  breff: number;
  /** Their textures (Effect/RKRace.breft), or -1. */
  breft: number;
}

interface Pick {
  hex: string;
  keepWhite: boolean;
}

const isBreff = (node: U8Node) => !node.dir && node.name.toLowerCase().endsWith('.breff');
const isBreft = (node: U8Node) => !node.dir && node.name.toLowerCase().endsWith('.breft');

/** The effect colors with the picks applied. */
function applyPicks(data: Uint8Array, byGroup: ReadonlyMap<string, Effect[]>, picks: Record<string, Pick>): Uint8Array<ArrayBuffer> {
  const out = data.slice();
  for (const [id, pick] of Object.entries(picks)) {
    const color = fromHex(pick.hex);
    const effects = byGroup.get(id);
    if (color && effects) recolorGroup(out, effects, color, pick.keepWhite);
  }
  return out;
}

/** Opens a common.szs, recolors its race effects (sparks, boosts, items, splashes), and saves a new common.szs. */
export function CommonEditorApp() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [section, setSection] = useState<Section>('all');
  const [query, setQuery] = useState('');
  // The last color picked with each section's Color all, so its picker reopens on it.
  const [allColor, setAllColor] = useState<Record<string, string>>({});
  const [textureFile, setTextureFile] = useState<Breft | null>(null);
  const [textures, setTextures] = useState<Texture[]>([]);
  const browse = useRef<HTMLInputElement>(null);

  const original = archive && archive.breff >= 0 ? archive.nodes[archive.breff].data! : null;
  const byGroup = useMemo(() => {
    const map = new Map<string, Effect[]>();
    for (const effect of effects) {
      const group = groupOf(effect.name);
      if (group) map.set(group.id, [...(map.get(group.id) ?? []), effect]);
    }
    return map;
  }, [effects]);
  // Each group's colors as they'll be saved: the file's own, or after its pick.
  const shown = useMemo(() => {
    if (!original) return new Map<string, { now: Rgb[]; after: Rgb[] }>();
    const after = applyPicks(original, byGroup, picks);
    return new Map(
      EFFECT_GROUPS.map(g => [
        g.id,
        {
          now: groupColors(original, byGroup.get(g.id) ?? []),
          after: groupColors(after, byGroup.get(g.id) ?? []),
        },
      ]),
    );
  }, [original, byGroup, picks]);

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const nodes = readU8(isYaz0(bytes) ? yaz0Decode(bytes) : bytes);
      const breff = nodes.findIndex(isBreff);
      if (breff < 0) throw new Error('it has no effect file (.breff). Open Race/Common.szs.');
      setEffects(readBreff(nodes[breff].data!));
      const breft = nodes.findIndex(isBreft);
      const parsed = breft >= 0 ? readBreft(nodes[breft].data!) : null;
      setTextureFile(parsed);
      setTextures(parsed?.textures ?? []);
      setArchive({ name: file.name, size: file.size, nodes, breff, breft });
      setPicks({});
      setDirty(false);
      setError('');
    } catch (err) {
      setError(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const setPick = (id: string, change: Partial<Pick> | null) => {
    setPicks(current => {
      const next = { ...current };
      if (change)
        next[id] = {
          ...(current[id] ?? { hex: '', keepWhite: false }),
          ...change,
        };
      else delete next[id];
      return next;
    });
    setDirty(true);
  };

  const setMany = (ids: string[], hex: string | null) => {
    setPicks(current => {
      const next = { ...current };
      for (const id of ids) {
        if (hex === null) delete next[id];
        else next[id] = { ...(current[id] ?? { hex: '', keepWhite: false }), hex };
      }
      return next;
    });
    setDirty(true);
  };

  const save = () => {
    if (!archive || !original) return;
    setSaving(true);
    // Let "Saving…" show before the compression holds the page for a moment.
    setTimeout(() => {
      try {
        const nodes = archive.nodes.slice();
        nodes[archive.breff] = {
          ...nodes[archive.breff],
          data: applyPicks(original, byGroup, picks),
        };
        if (textureFile && texturesChanged)
          nodes[archive.breft] = {
            ...nodes[archive.breft],
            data: writeBreft({ ...textureFile, textures }),
          };
        download(new Blob([yaz0Encode(writeU8(nodes))]), archive.name);
        setDirty(false);
        toast.success(`Saved ${archive.name}`, { description: 'Put it in your game or mod in place of the old one.' });
      } catch (err) {
        setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setSaving(false);
      }
    }, 0);
  };

  const changed = Object.values(picks).filter(p => fromHex(p.hex)).length;
  const texturesChanged = textureFile ? textures.filter((t, i) => t !== textureFile.textures[i]).length : 0;

  // One effect group per row: the swatch you click, what it is, the colors it uses now, then the exact hex, whether to
  // keep its white parts, and a reset once it's changed. Rows scan top to bottom; the old card grid wrapped and clipped.
  const row = (group: EffectGroup) => {
    const colors = shown.get(group.id);
    const count = byGroup.get(group.id)?.length ?? 0;
    const pick = picks[group.id];
    const main = colors?.now[0];
    const valid = pick ? fromHex(pick.hex) : null;
    const strip = (colors?.after ?? []).slice(0, STRIP);
    const id = `fx-${group.id}`;
    return (
      <div
        key={group.id}
        className="hover:bg-muted/40 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b px-4 py-3.5 transition-colors last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        {/* The swatch is the game color itself, so it keeps its own color in either site theme. */}
        <HexColorPopover
          value={valid ? toHex(valid) : main ? toHex(main) : '#000000'}
          onChange={hex => setPick(group.id, { hex })}
          disabled={!count}
        >
        <button
          type="button"
          aria-label={`${group.label} color`}
          className={cn(
            'border-input relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-[scale] duration-150 ease-(--ease-out) active:scale-[0.97]',
            valid && 'ring-foreground ring-offset-card ring-2 ring-offset-2',
          )}
          title="Pick a color"
          style={{ background: valid ? toHex(valid) : main ? toHex(main) : '#000000' }}
        >
          {/* Before and after: once a new color is picked, the left half keeps the file's own color. */}
          {valid && main ? (
            <i
              className="border-card pointer-events-none absolute inset-y-0 left-0 w-1/2 border-r-2"
              style={{ background: toHex(main) }}
              title={`Was ${toHex(main)}`}
            />
          ) : null}
        </button>
        </HexColorPopover>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium" title={`${count} effects in the game file`}>
              {group.label}
            </span>
            {valid ? <Badge variant="secondary">Changed</Badge> : null}
          </div>
          <p className="text-muted-foreground text-[13px] leading-snug">{group.about}</p>
          <span
            className="mt-1 flex h-1.5 w-full max-w-60 overflow-hidden rounded-full"
            aria-label={`Colors in its ${count} effects: ${strip.map(toHex).join(', ')}`}
          >
            {strip.map((c, i) => (
              <i key={i} className="flex-1 transition-[background-color] duration-200 ease-(--ease-out)" style={{ background: toHex(c) }} title={toHex(c)} />
            ))}
          </span>
        </div>

        <div className="col-span-2 flex items-center justify-end gap-4 md:col-span-1">
          <Input
            spellCheck={false}
            aria-label={`${group.label} hex`}
            aria-invalid={pick?.hex && !valid ? true : undefined}
            placeholder={main ? toHex(main) : '#hex'}
            disabled={!count}
            value={pick?.hex ?? ''}
            onChange={e => setPick(group.id, { hex: e.target.value })}
            className="w-28 font-mono text-xs"
          />
          <div className="flex items-center gap-2" title="Leave near-white parts, like a spark's bright core, as they are">
            <Switch
              id={`${id}-white`}
              checked={pick?.keepWhite ?? false}
              disabled={!count}
              onCheckedChange={v => setPick(group.id, { keepWhite: v })}
            />
            <Label htmlFor={`${id}-white`} className="text-muted-foreground font-normal whitespace-nowrap">
              Keep white
            </Label>
          </div>
          {/* Always takes its space, so the controls line up down the list whether a row is changed or not. */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Reset ${group.label} to the file's colors`}
            title="Back to the file's colors"
            className={pick ? undefined : 'invisible'}
            onClick={() => setPick(group.id, null)}
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  };

  const changedIn = (sec: Section) =>
    sec === 'textures'
      ? texturesChanged
      : EFFECT_GROUPS.filter(g => (sec === 'all' || g.section === sec) && picks[g.id] && fromHex(picks[g.id].hex)).length;

  return (
    <AppShell
      tabsLabel="Effect groups"
      tabs={(['all', ...SECTIONS, ...(textures.length ? ['textures'] : [])] as Section[]).map(sec => (
        <Tab key={sec} current={section === sec} onSelect={() => setSection(sec)}>
          {sec === 'all' ? 'All effects' : sec === 'textures' ? 'Textures' : sec}
          {changedIn(sec) ? (
            <Badge variant="secondary" className="tabular-nums" aria-label={`${changedIn(sec)} changed`}>
              {changedIn(sec)}
            </Badge>
          ) : null}
        </Tab>
      ))}
      status={
        archive ? (
          <span>
            <b className="text-foreground font-medium">{archive.name}</b>, {(archive.size / 1024 / 1024).toFixed(1)} MB
            {changed + texturesChanged
              ? `, ${changed + texturesChanged} change${changed + texturesChanged === 1 ? '' : 's'}${dirty ? ' not saved yet' : ' saved'}`
              : ', nothing changed yet'}
          </span>
        ) : undefined
      }
      actions={
        <>
          {changed || texturesChanged ? (
            <HoldButton
              variant="ghost"
              aria-label="Hold to put every color and texture back to the file’s own"
              onConfirm={() => {
                setPicks({});
                setTextures(textureFile?.textures ?? []);
                toast('Colors and textures reset', { description: 'Back to the file’s own.' });
              }}
            >
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Hold to reset all
            </HoldButton>
          ) : null}
          {archive ? (
            <>
              <Button variant="outline" onClick={() => browse.current?.click()}>
                <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
                Open another
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" aria-hidden="true" />}
                {saving ? 'Saving' : 'Save common.szs'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <input
          ref={browse}
          type="file"
          accept=".szs,.u8,.arc"
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

        {!archive ? (
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
              <EmptyTitle className="text-xl">Drop a common.szs here</EmptyTitle>
              <EmptyDescription>
                Mario Kart Wii’s Race/Common.szs, or a mod’s copy of it. It stays on your computer: nothing is uploaded.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="lg" onClick={() => browse.current?.click()}>
                <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
                Choose common.szs
              </Button>
              <ol className="text-muted-foreground mt-4 flex list-decimal flex-col gap-1.5 pl-5 text-left text-sm">
                <li>Open the file and pick new colors for drifts, boosts, items and more.</li>
                <li>Save it, then put it in your game or mod in place of the old one.</li>
                <li>Keep the original somewhere safe in case you want it back.</li>
              </ol>
            </EmptyContent>
          </Empty>
        ) : section === 'textures' && textureFile ? (
          <Reveal id="textures">
            <TexturesView
              textures={textures}
              original={textureFile.textures}
              effects={effects}
              onChange={(index, texture) => {
                setTextures(current => current.map((t, i) => (i === index ? texture : t)));
                setDirty(true);
              }}
              onUntint={ids => ids.forEach(id => setPick(id, { hex: '#ffffff' }))}
            />
          </Reveal>
        ) : (
          <Split
            sideLabel="Your file"
            side={
              <div className="bg-card flex flex-col gap-4 rounded-xl border p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold tabular-nums">{changed}</span>
                    <span className="text-muted-foreground text-xs">effect group{changed === 1 ? '' : 's'} recolored</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold tabular-nums">{texturesChanged}</span>
                    <span className="text-muted-foreground text-xs">texture{texturesChanged === 1 ? '' : 's'} replaced</span>
                  </div>
                </div>
                <Separator />
                <h2 className="text-sm font-medium">How to use it</h2>
                <ol className="text-muted-foreground flex list-decimal flex-col gap-2 pl-5 text-sm">
                  <li>
                    <b className="text-foreground font-medium">Click a swatch</b> and pick a new color. The strip under each name shows the colors it
                    uses now.
                  </li>
                  <li>
                    <b className="text-foreground font-medium">Save common.szs</b> (top right).
                  </li>
                  <li>
                    <b className="text-foreground font-medium">Put the saved file in your game or mod</b> in place of the old one. Keep a copy of the
                    old one in case you want it back.
                  </li>
                </ol>
              </div>
            }
          >
            <Reveal id={section} className="flex flex-col gap-6">
              <div className="relative">
                <SearchIcon aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  aria-label="Find an effect"
                  placeholder="Find an effect, like spark or boost"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {SECTIONS.filter(sec => section === 'all' || sec === section).map(sec => {
                const q = query.trim().toLowerCase();
                const all = EFFECT_GROUPS.filter(g => g.section === sec);
                const groups = q ? all.filter(g => (g.label + ' ' + g.about).toLowerCase().includes(q)) : all;
                if (!groups.length) return null;
                const ids = groups.map(g => g.id);
                return (
                  <section key={sec} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-lg font-semibold tracking-tight">{sec}</h2>
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {groups.length} effect{groups.length === 1 ? '' : 's'}
                          {changedIn(sec) ? `, ${changedIn(sec)} changed` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* One color for every effect listed in this section (after the search filter). */}
                        <HexColorPopover value={allColor[sec] ?? '#ffffff'} onChange={hex => { setAllColor(c => ({ ...c, [sec]: hex })); setMany(ids, hex); }}>
                        <button
                          type="button"
                          aria-label={`One color for every effect in ${sec}`}
                          className="hover:bg-muted relative flex h-8 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2.5 text-sm font-medium transition-colors"
                        >
                          <span aria-hidden="true" className="size-4 rounded-full border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
                          Color all
                        </button>
                        </HexColorPopover>
                        {changedIn(sec) ? (
                          <Button variant="ghost" size="sm" onClick={() => setMany(ids, null)}>
                            <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                            Reset section
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="bg-card overflow-hidden rounded-xl border">{groups.map(row)}</div>
                  </section>
                );
              })}
              {query.trim() &&
              !EFFECT_GROUPS.some(
                g => (section === 'all' || g.section === section) && (g.label + ' ' + g.about).toLowerCase().includes(query.trim().toLowerCase()),
              ) ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No effect matches “{query.trim()}”. Try a word like spark, smoke or boost.
                </p>
              ) : null}
            </Reveal>
          </Split>
        )}
      </div>
    </AppShell>
  );
}
