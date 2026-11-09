'use client';

import { styleOf, type Settings, type Style } from '@/lib/overlay/settings';
import { asset } from '@/lib/paths';
import { TiltButton } from '@/components/amicro/TiltButton';

// A small drawing of each look: a mini card, a slim pill, or the number in the game's own digits.
const CardLook = (
  <span className="mini-card">
    <i />
    <span>
      <b />
      <b />
    </span>
    <em>9,044</em>
  </span>
);

const SlimLook = (
  <span className="mini-slim">
    <span>
      <i />
      <b />
    </span>
    <em>3945</em>
  </span>
);

const HudLook = (
  <span className="mini-hud">
    {[...'9044'].map((d, i) => (
      // eslint-disable-next-line @next/next/no-img-element -- tiny static digit sprites, no optimisation to gain
      <img key={i} src={asset(`overlay/font/${d}.png`)} alt="" />
    ))}
  </span>
);

const LOOKS: readonly { style: Style; title: string; sub: string; look: React.ReactNode }[] = [
  { style: 'card', title: 'Card', sub: 'Border, background, Mii', look: CardLook },
  { style: 'slim', title: 'Slim', sub: 'Thin pill, flag, division', look: SlimLook },
  { style: 'hud', title: 'Race HUD', sub: 'Game font, no card', look: HudLook },
];

export function StylePicker({ settings, onPick }: { settings: Settings; onPick: (style: Style) => void }) {
  const current = styleOf(settings);
  return (
    <div className="styles" role="radiogroup" aria-label="Style">
      {LOOKS.map(({ style, title, sub, look }) => (
        <TiltButton key={style} type="button" role="radio" aria-checked={current === style} data-spotlight onClick={() => onPick(style)}>
          <span className="look">{look}</span>
          <strong>{title}</strong>
          <small>{sub}</small>
        </TiltButton>
      ))}
    </div>
  );
}
