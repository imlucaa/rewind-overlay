'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
    <div className="flex flex-col gap-4">
      <FieldGroup className="flex-row flex-wrap items-end gap-4">
        <Field className="w-56">
          <FieldLabel>Show textures for</FieldLabel>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger aria-label="Show textures for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Every texture</SelectItem>
                {EFFECT_GROUPS.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-56">
          <FieldLabel>Your picture’s size</FieldLabel>
          <Select value={String(scale)} onValueChange={v => setScale(Number(v) as (typeof SCALES)[number])}>
            <SelectTrigger aria-label="Your picture’s size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SCALES.map(s => (
                  <SelectItem key={s} value={String(s)}>
                    {s === 1 ? 'Same as now' : s === 2 ? '2× (sharper)' : '4× (sharpest)'}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal" className="w-auto pb-2">
          <Checkbox id="tx-shape" checked={asShape} onCheckedChange={v => setAsShape(v === true)} />
          <FieldLabel htmlFor="tx-shape" className="font-normal" title="For a dark drawing on a white background: the lines turn white and the background see-through">
            My picture is a dark drawing on white
          </FieldLabel>
        </Field>
      </FieldGroup>
      <p className="text-muted-foreground max-w-[80ch] text-sm">
        <b className="text-foreground font-medium">Replace</b> swaps in your own picture. Effects want a light shape on a see-through background (PNG): a white
        background shows as a square in the game. For black line art on white, tick the box above. The game paints the effect’s color over it;{' '}
        <b className="text-foreground font-medium">Remove tint</b> keeps your picture’s colors.
      </p>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
      {shown.length === 0 ? <p className="text-muted-foreground text-sm">No textures for this group. Pick another, or Every texture.</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {shown.map(({ texture, index }) => {
          const changed = texture !== original[index];
          const groups = [...(usedBy.get(texture.name) ?? [])];
          const others = groups.filter(id => id !== group).map(id => EFFECT_GROUPS.find(g => g.id === id)!.label);
          const plain = PLAIN_NAMES[texture.name];
          return (
            <Card key={texture.name} size="sm" className={cn('gap-3', changed && 'ring-foreground/40')}>
              {/* Checkerboard behind the texture so see-through parts show as see-through. */}
              <div className="relative mx-3 grid aspect-square place-items-center overflow-hidden rounded-md bg-[repeating-conic-gradient(#26262a_0%_25%,#1a1a1d_0%_50%)] bg-[length:14px_14px] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a texture decoded in the browser: a data URL, nothing to optimize */}
                {previews[index] ? <img src={previews[index]} alt={`${plain ?? texture.name} texture`} width={texture.width} height={texture.height} className="size-full object-contain [image-rendering:pixelated]" /> : null}
                {changed ? <Badge className="absolute top-1.5 left-1.5">Yours</Badge> : null}
              </div>
              <CardHeader>
                <CardTitle className="truncate" title={texture.name}>
                  {plain ?? texture.name}
                </CardTitle>
                <CardDescription className="flex flex-col gap-0.5 text-xs" title={FORMATS[texture.format]?.name}>
                  <span>
                    {plain ? <code className="mr-1.5 font-mono">{texture.name}</code> : null}
                    {texture.width}×{texture.height}
                    {!changed && TINTED.has(texture.format) ? ' · grey, takes the effect’s color' : ''}
                  </span>
                  {others.length ? (
                    <span className="truncate" title={others.join(', ')}>
                      {group === 'all' ? 'Used by' : 'Also used by'} {others.join(', ')}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    target.current = index;
                    pickFile.current?.click();
                  }}
                >
                  Replace
                </Button>
                {changed && groups.length ? (
                  <Button size="sm" variant="outline" title="Sets the color of the effects using it to white, so your picture shows as it is" onClick={() => onUntint(groups)}>
                    Remove tint
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" title="Download as PNG" onClick={() => toCanvas(texture).toBlob(blob => blob && download(blob, `${texture.name}.png`), 'image/png')}>
                  Download
                </Button>
                {changed ? (
                  <Button size="sm" variant="ghost" onClick={() => onChange(index, original[index])}>
                    Undo
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
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
