'use client';

import { useMemo, useRef, useState } from 'react';
import { FolderOpenIcon, RotateCcwIcon, SaveIcon } from 'lucide-react';
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
import { HoldButton } from '@/components/ui/hold-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { TexturesView } from './TexturesView';

const SECTIONS = [...new Set(EFFECT_GROUPS.map(g => g.section))];
type Section = (typeof SECTIONS)[number] | 'all' | 'textures';
// How many of a group's colors the strip under each card shows, most used first.
const STRIP = 8;

interface Archive {
  name: string;
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
      setArchive({ name: file.name, nodes, breff, breft });
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

  const card = (group: EffectGroup) => {
    const colors = shown.get(group.id);
    const count = byGroup.get(group.id)?.length ?? 0;
    const pick = picks[group.id];
    const main = colors?.now[0];
    const valid = pick ? fromHex(pick.hex) : null;
    const strip = (colors?.after ?? []).slice(0, STRIP);
    const id = `fx-${group.id}`;
    return (
      <Card key={group.id} size="sm" className={cn('gap-3', valid && 'ring-foreground/40')}>
        <CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-x-3">
          {/* The swatch is the game color itself, so it keeps its own color in either site theme. */}
          <label className="border-input relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-md border" title="Pick a color">
            <input
              type="color"
              aria-label={`${group.label} color`}
              disabled={!count}
              value={valid ? toHex(valid) : main ? toHex(main) : '#000000'}
              onChange={e => setPick(group.id, { hex: e.target.value })}
              className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer border-0 p-0"
            />
            {/* The file's own main color, in the corner, once a new one is picked. */}
            {valid && main ? (
              <i
                className="ring-card pointer-events-none absolute right-0 bottom-0 size-3.5 rounded-tl ring-1"
                style={{ background: toHex(main) }}
                title={`Was ${toHex(main)}`}
              />
            ) : null}
          </label>
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="truncate" title={`${count} effects in the game file`}>
              {group.label}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs" title={group.about}>
              {group.about}
            </CardDescription>
          </div>
          {pick ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Reset ${group.label}`}
              title="Back to the file's colors"
              onClick={() => setPick(group.id, null)}
            >
              Reset
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-white`}
                checked={pick?.keepWhite ?? false}
                disabled={!count}
                onCheckedChange={v => setPick(group.id, { keepWhite: v === true })}
              />
              <Label
                htmlFor={`${id}-white`}
                className="text-muted-foreground font-normal"
                title="Leave near-white parts, like a spark's bright core, as they are"
              >
                Keep white parts
              </Label>
            </div>
          </div>
          <span
            className="flex h-2 overflow-hidden rounded-full border"
            aria-label={`Colors in its ${count} effects: ${strip.map(toHex).join(', ')}`}
          >
            {strip.map((c, i) => (
              <i key={i} className="flex-1 transition-[background-color] duration-200 ease-(--ease-out)" style={{ background: toHex(c) }} title={toHex(c)} />
            ))}
          </span>
        </CardContent>
      </Card>
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
            <b className="text-foreground font-medium">{archive.name}</b>
            {dirty ? ', changes not saved' : ''}
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
          <Button variant="outline" onClick={() => browse.current?.click()}>
            <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
            Open
          </Button>
          <Button disabled={!archive || saving} onClick={save}>
            {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" aria-hidden="true" />}
            {saving ? 'Saving' : 'Save common.szs'}
          </Button>
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
            className={cn('border border-dashed transition-colors', dragging && 'border-foreground bg-muted')}
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
              <EmptyTitle>Drop a common.szs here</EmptyTitle>
              <EmptyDescription>
                Mario Kart Wii’s Race/Common.szs, or a mod’s copy of it. It stays on your computer: nothing is uploaded.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => browse.current?.click()}>Choose common.szs</Button>
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
              <div className="flex flex-col gap-4 rounded-lg border p-4">
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
                    <b className="text-foreground font-medium">Click a color square</b> and pick a new color. The bar under each card shows the colors
                    it uses now.
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
              {SECTIONS.filter(sec => section === 'all' || sec === section).map(sec => (
                <section key={sec} className="flex flex-col gap-3">
                  <h2 className="text-base font-semibold">{sec}</h2>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {EFFECT_GROUPS.filter(g => g.section === sec).map(card)}
                  </div>
                </section>
              ))}
            </Reveal>
          </Split>
        )}
      </div>
    </AppShell>
  );
}
