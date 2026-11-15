'use client';

import { useMemo, useRef, useState } from 'react';
import { AppShell, Tab } from '@/components/layout/AppShell';
import { download } from '@/hooks/useExport';
import { isYaz0, yaz0Decode, yaz0Encode } from '@/lib/szs/yaz0';
import { readU8, writeU8, type U8Node } from '@/lib/szs/u8';
import { fromHex, groupColors, readBreff, recolorGroup, toHex, type Effect, type Rgb } from '@/lib/szs/breff';
import { EFFECT_GROUPS, groupOf, type EffectGroup } from '@/lib/szs/effectGroups';
import { readBreft, writeBreft, type Breft, type Texture } from '@/lib/szs/breft';
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
    return new Map(EFFECT_GROUPS.map(g => [g.id, { now: groupColors(original, byGroup.get(g.id) ?? []), after: groupColors(after, byGroup.get(g.id) ?? []) }]));
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
      if (change) next[id] = { ...(current[id] ?? { hex: '', keepWhite: false }), ...change };
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
        nodes[archive.breff] = { ...nodes[archive.breff], data: applyPicks(original, byGroup, picks) };
        if (textureFile && texturesChanged) nodes[archive.breft] = { ...nodes[archive.breft], data: writeBreft({ ...textureFile, textures }) };
        download(new Blob([yaz0Encode(writeU8(nodes))]), archive.name);
        setDirty(false);
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
    return (
      <li key={group.id} className="fx-card" data-changed={valid ? true : undefined}>
        <label className="fx-swatch" title="Pick a color">
          <input
            type="color"
            aria-label={`${group.label} color`}
            disabled={!count}
            value={valid ? toHex(valid) : main ? toHex(main) : '#000000'}
            onChange={e => setPick(group.id, { hex: e.target.value })}
          />
          {/* The file's own main color, in the corner, once a new one is picked. */}
          {valid && main ? <i style={{ background: toHex(main) }} title={`Was ${toHex(main)}`} /> : null}
        </label>
        <div className="fx-body">
          <div className="fx-head">
            <strong title={`${count} effects in the game file`}>{group.label}</strong>
            {pick ? (
              <button type="button" className="fx-reset" aria-label={`Reset ${group.label}`} title="Back to the file's colors" onClick={() => setPick(group.id, null)}>
                Reset
              </button>
            ) : null}
          </div>
          <p className="fx-about" title={group.about}>
            {group.about}
          </p>
          <div className="fx-pick">
            <input
              type="text"
              spellCheck={false}
              aria-label={`${group.label} hex`}
              aria-invalid={pick?.hex && !valid ? true : undefined}
              placeholder={main ? toHex(main) : '#hex'}
              disabled={!count}
              value={pick?.hex ?? ''}
              onChange={e => setPick(group.id, { hex: e.target.value })}
            />
            <label title="Leave near-white parts, like a spark's bright core, as they are">
              <input type="checkbox" checked={pick?.keepWhite ?? false} disabled={!count} onChange={e => setPick(group.id, { keepWhite: e.target.checked })} />
              Keep white parts
            </label>
          </div>
        </div>
        <span className="fx-strip" aria-label={`Colors in its ${count} effects: ${strip.map(toHex).join(', ')}`}>
          {strip.map(c => (
            <i key={toHex(c)} style={{ background: toHex(c) }} title={toHex(c)} />
          ))}
        </span>
      </li>
    );
  };

  const changedIn = (sec: Section) =>
    sec === 'textures' ? texturesChanged : EFFECT_GROUPS.filter(g => (sec === 'all' || g.section === sec) && picks[g.id] && fromHex(picks[g.id].hex)).length;

  return (
    <AppShell
      className="music szs"
      viewKey={section}
      tabsLabel="Effect groups"
      tabs={(['all', ...SECTIONS, ...(textures.length ? ['textures'] : [])] as Section[]).map(sec => (
        <Tab key={sec} current={section === sec} onSelect={() => setSection(sec)}>
          {sec === 'all' ? 'All effects' : sec === 'textures' ? 'Textures' : sec}
          {changedIn(sec) ? <span className="fx-tab-count">{changedIn(sec)}</span> : null}
        </Tab>
      ))}
      status={
        <span className="stats">
          {archive ? (
            <>
              <b>{archive.name}</b> · {changed} group{changed === 1 ? '' : 's'} recolored · {texturesChanged} texture{texturesChanged === 1 ? '' : 's'} replaced
              {dirty ? ' · not saved' : ''}
            </>
          ) : (
            'No file open'
          )}
        </span>
      }
      actions={
        <>
          {changed || texturesChanged ? (
            <button
              className="button hide-small"
              type="button"
              onClick={() => {
                if (window.confirm('Put every color and texture back to the file’s own?')) {
                  setPicks({});
                  setTextures(textureFile?.textures ?? []);
                }
              }}
            >
              Reset all
            </button>
          ) : null}
          <button className="button hide-small" type="button" onClick={() => browse.current?.click()}>
            Open
          </button>
          <button className="button primary" type="button" disabled={!archive || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save common.szs'}
          </button>
        </>
      }
    >
      <div className="music-view">
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
          <p className="note warn" role="alert">
            {error}
          </p>
        ) : null}

        {!archive ? (
          <div
            className="dropzone"
            data-dragging={dragging}
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
            <strong>Drop a common.szs here</strong>
            <small>Mario Kart Wii’s Race/Common.szs, or a mod’s copy of it. Nothing is uploaded.</small>
            <button className="button" type="button" onClick={() => browse.current?.click()}>
              Browse files
            </button>
          </div>
        ) : section === 'textures' && textureFile ? (
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
        ) : (
          <>
            <ol className="fx-steps">
              <li>
                <b>Click a color square</b> and pick a new color. The bar under each card shows the colors it uses now.
              </li>
              <li>
                <b>Save common.szs</b> (top right).
              </li>
              <li>
                <b>Put the saved file in your game or mod</b> in place of the old one. Keep a copy of the old one in case you want it back.
              </li>
            </ol>
            {SECTIONS.filter(sec => section === 'all' || sec === section).map(sec => (
              <section key={sec} className="fx-section">
                <h2 className="sub">{sec}</h2>
                <ul className="fx-grid">{EFFECT_GROUPS.filter(g => g.section === sec).map(card)}</ul>
              </section>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
