'use client';

import type { ReactNode } from 'react';
import { styleOf, type Settings, type Style } from '@/lib/overlay/settings';
import { asset } from '@/lib/paths';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// A small drawing of each look: a mini card, a slim pill, or the number in the game's own digits. They sit on a dark
// strip in both site themes, since they show the overlay as it looks on a stream.
const CardLook = (
  <span className="flex h-[30px] w-[112px] max-w-full items-center gap-1.5 rounded-lg border-[1.5px] border-zinc-300 bg-zinc-900 px-2">
    <i className="size-3.5 shrink-0 rounded-full bg-zinc-600" />
    <span className="grid min-w-0 flex-1 gap-[3px]">
      <b className="h-[3px] rounded-sm bg-zinc-500" />
      <b className="h-[3px] w-3/5 rounded-sm bg-zinc-700" />
    </span>
    <em className="text-[10px] font-bold text-zinc-100 not-italic">9,044</em>
  </span>
);

const SlimLook = (
  <span className="flex h-7 w-[104px] max-w-full items-center justify-between gap-1.5 rounded-full border-[1.5px] border-zinc-300 bg-zinc-900 px-2.5">
    <span className="grid min-w-0 flex-1 gap-[3px]">
      <i className="h-1.5 w-[9px] rounded-[1px] bg-zinc-500" />
      <b className="h-[3px] w-[70%] rounded-sm bg-zinc-500" />
    </span>
    <em className="text-[13px] font-semibold text-zinc-100 not-italic">3945</em>
  </span>
);

const HudLook = (
  <span className="flex h-[26px] max-w-full">
    {[...'9044'].map((d, i) => (
      // eslint-disable-next-line @next/next/no-img-element -- tiny static digit sprites, no optimisation to gain
      <img key={i} src={asset(`overlay/font/${d}.png`)} alt="" width={20} height={26} className="-ml-0.5 h-full w-auto min-w-0 brightness-150 grayscale" />
    ))}
  </span>
);

const LOOKS: readonly { style: Style; title: string; sub: string; look: ReactNode }[] = [
  { style: 'card', title: 'Card', sub: 'Border, background, Mii', look: CardLook },
  { style: 'slim', title: 'Slim', sub: 'Thin pill, flag, division', look: SlimLook },
  { style: 'hud', title: 'Race HUD', sub: 'Game font, no card', look: HudLook },
];

export function StylePicker({ settings, onPick }: { settings: Settings; onPick: (style: Style) => void }) {
  const current = styleOf(settings);
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={2}
      aria-label="Style"
      value={current}
      // Clicking the picked look again would clear it: keep one picked.
      onValueChange={v => v && onPick(v as Style)}
      className="grid w-full grid-cols-3 py-3"
    >
      {LOOKS.map(({ style, title, sub, look }) => (
        <ToggleGroupItem key={style} value={style} className="group h-auto flex-col items-stretch gap-0 p-2 text-left data-[state=on]:border-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-foreground data-[state=on]:hover:bg-muted data-[state=on]:hover:text-foreground">
          <span className="mb-2 grid h-16 place-items-center overflow-hidden rounded-md bg-zinc-950 px-1.5">
            <span className="opacity-60 transition-opacity group-hover:opacity-90 group-data-[state=on]:opacity-100">{look}</span>
          </span>
          <strong className="text-sm font-semibold">{title}</strong>
          <small className="text-muted-foreground text-xs font-normal whitespace-normal">{sub}</small>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
