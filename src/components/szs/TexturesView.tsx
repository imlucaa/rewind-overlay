'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { download } from '@/hooks/useExport';
import { replaceTexture, type Texture } from '@/lib/szs/breft';
import { FORMATS, RGB5A3, decodeTexture, encodeRgb5a3 } from '@/lib/szs/gx';
import type { Effect } from '@/lib/szs/breff';
import { EFFECT_GROUPS, groupOf } from '@/lib/szs/effectGroups';

// Grayscale formats: the game colors them with the effect's colors.
const TINTED = new Set([0, 1, 2, 3]);
const SCALES = [1, 2, 4] as const;
// Big textures cost the Wii memory, and RKRace.breft is loaded for every race.
const MAX_SIDE = 256;
// Plain names for the textures people look for first, going by what each one looks like.
const PLAIN_NAMES: Record<string, string> = {
  rk_hamon: 'Trick ring',
  rk_wave: 'Shimmer',
  rk_glow0: 'Glow',
  rk_kira: 'Sparkle',
  kiraC2: 'Sparkle streak',
  flash5_4: 'Flash',
  waveFlash1: 'Starburst',
};

interface Props {
  textures: readonly Texture[];
  original: readonly Texture[];
  effects: readonly Effect[];
  onChange: (index: number, texture: Texture) => void;
  /** Sets these groups' color to white, so a color image shows as it is. */
  onUntint: (groupIds: string[]) => void;
}

function toCanvas(texture: Texture): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = texture.width;
  canvas.height = texture.height;
  canvas.getContext('2d')!.putImageData(new ImageData(decodeTexture(texture.format, texture.width, texture.height, texture.data), texture.width, texture.height), 0, 0);
  return canvas;
}

/**
 * Draws the image centered in a width×height box, as large as fits, with see-through padding. With `asShape`, a dark
 * drawing on a light background becomes a white shape on a see-through one, like the game's own effect textures:
 * the darker a pixel, the more solid it gets.
 */
async function imageToTexture(file: File, base: Texture, width: number, height: number, asShape: boolean): Promise<Texture> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  if (asShape)
    for (let i = 0; i < pixels.length; i += 4) {
      const light = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      pixels[i + 3] = Math.round(((255 - light) * pixels[i + 3]) / 255);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    }
  return replaceTexture(base, width, height, RGB5A3, encodeRgb5a3(pixels, width, height));
}

/** The textures of the race effects: preview, replace with your own image, download. */
export function TexturesView({ textures, original, effects, onChange, onUntint }: Props) {
  const [group, setGroup] = useState('trick');
  const [scale, setScale] = useState<(typeof SCALES)[number]>(2);
  const [asShape, setAsShape] = useState(false);
  const [error, setError] = useState('');
  const pickFile = useRef<HTMLInputElement>(null);
  const target = useRef(-1);

  // Which effect groups use each texture.
  const usedBy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const effect of effects) {
      const id = groupOf(effect.name)?.id;
      if (!id) continue;
      for (const t of effect.textures) map.set(t, (map.get(t) ?? new Set()).add(id));
    }
    return map;
  }, [effects]);

  const previews = useTexturePreviews(textures);
  const shown = textures
    .map((texture, index) => ({ texture, index }))
    .filter(({ texture }) => group === 'all' || usedBy.get(texture.name)?.has(group));

  const replace = async (file: File | undefined) => {
    const index = target.current;
    if (!file || index < 0) return;
    const base = original[index];
    const width = Math.min(MAX_SIDE, base.width * scale);
    const height = Math.min(MAX_SIDE, base.height * scale);
    try {
      onChange(index, await imageToTexture(file, textures[index], width, height, asShape));
      setError('');
    } catch (err) {
      setError(`${file.name}: ${err instanceof Error ? err.message : 'couldn’t read this image.'}`);
    }
  };

  return (
    <div className="tx-view">
      <div className="tx-bar">
        <label>
          Show
          <select value={group} onChange={e => setGroup(e.target.value)}>
            <option value="all">Every texture</option>
            {EFFECT_GROUPS.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Your picture’s size
          <select value={scale} onChange={e => setScale(Number(e.target.value) as (typeof SCALES)[number])}>
            {SCALES.map(s => (
              <option key={s} value={s}>
                {s === 1 ? 'Same as now' : s === 2 ? '2× (sharper)' : '4× (sharpest)'}
              </option>
            ))}
          </select>
        </label>
        <label title="For a dark drawing on a white background: the lines turn white and the background see-through">
          <input type="checkbox" checked={asShape} onChange={e => setAsShape(e.target.checked)} />
          Dark drawing on white → white shape
        </label>
      </div>
      <p className="note">
        <b>Replace</b> swaps in your own picture. Effects want a light shape on a see-through background (PNG): a white background shows as a square in the game. For black
        line art on white, tick <b>Dark drawing on white</b>. The game paints the effect’s color over it; <b>Remove tint</b> keeps your picture’s colors.
      </p>
      {error ? (
        <p className="note warn" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={pickFile}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={e => {
          void replace(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ul className="tx-grid">
        {shown.map(({ texture, index }) => {
          const changed = texture !== original[index];
          const groups = [...(usedBy.get(texture.name) ?? [])];
          const others = groups.filter(id => id !== group).map(id => EFFECT_GROUPS.find(g => g.id === id)!.label);
          const plain = PLAIN_NAMES[texture.name];
          return (
            <li key={texture.name} className="tx-card" data-changed={changed || undefined}>
              <div className="tx-preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- a texture decoded in the browser: a data URL, nothing to optimize */}
                {previews[index] ? <img src={previews[index]} alt={`${plain ?? texture.name} texture`} width={texture.width} height={texture.height} /> : null}
                {changed ? <span className="tx-badge">Yours</span> : null}
              </div>
              <div className="tx-info">
                <strong title={texture.name}>{plain ?? texture.name}</strong>
                <small title={FORMATS[texture.format]?.name}>
                  {plain ? <code>{texture.name}</code> : null}
                  {texture.width}×{texture.height}
                  {!changed && TINTED.has(texture.format) ? ' · grey, takes the effect’s color' : ''}
                </small>
                {others.length ? (
                  <small className="tx-used" title={others.join(', ')}>
                    {group === 'all' ? 'Used by' : 'Also used by'} {others.join(', ')}
                  </small>
                ) : null}
              </div>
              <div className="tx-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    target.current = index;
                    pickFile.current?.click();
                  }}
                >
                  Replace
                </button>
                {changed && groups.length ? (
                  <button className="button" type="button" title="Sets the color of the effects using it to white, so your picture shows as it is" onClick={() => onUntint(groups)}>
                    Remove tint
                  </button>
                ) : null}
                <span className="tx-links">
                  <button className="tx-link" type="button" title="Download as PNG" onClick={() => toCanvas(texture).toBlob(blob => blob && download(blob, `${texture.name}.png`), 'image/png')}>
                    Download
                  </button>
                  {changed ? (
                    <button className="tx-link" type="button" onClick={() => onChange(index, original[index])}>
                      Undo
                    </button>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** PNG data URLs of the textures, made after the first paint and again for each one that changes. */
function useTexturePreviews(textures: readonly Texture[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const made = useRef(new Map<Texture, string>());
  useEffect(() => {
    const next = textures.map(t => {
      let url = made.current.get(t);
      if (!url) {
        try {
          url = toCanvas(t).toDataURL();
        } catch {
          url = '';
        }
        made.current.set(t, url);
      }
      return url;
    });
    setUrls(next);
  }, [textures]);
  return urls;
}
