'use client';

import { useMemo, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatVr, signed, type VrPoint } from '@/lib/rwfc/api';
import { cn } from '@/lib/utils';

const W = 600;
const H = 180;

/** At most `max` points, keeping the last point of each bucket so the line still ends on today's VR. */
function thin(points: VrPoint[], max: number) {
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.min(points.length - 1, Math.floor((i + 1) * step) - 1)]);
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * VR over time: one series, so one line in the text color with a faint fill to the baseline, no legend (the card
 * title names it). A crosshair and tooltip follow the pointer; arrow keys step through the points.
 */
export function VrChart({ history, className }: { history: VrPoint[]; className?: string }) {
  const points = useMemo(() => thin(history, 240), [history]);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const values = points.map(p => p.totalVR);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A little room above and below, so the line never sits on the frame.
  const pad = Math.max(1, (hi - lo) * 0.12);
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.totalVR).toFixed(1)}`).join('');
  const area = `${line}L${W},${H}L0,${H}Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.totalVR - first.totalVR;
  const at = hover === null ? null : points[hover];

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !points.length) return;
    setHover(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (points.length - 1)));
  };

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-start gap-3">
        <div
          ref={box}
          role="img"
          tabIndex={0}
          aria-label={`VR from ${formatVr(first.totalVR)} on ${day(first.date)} to ${formatVr(last.totalVR)} on ${day(last.date)}, ${signed(change)} overall. Lowest ${formatVr(lo)}, highest ${formatVr(hi)}.`}
          className="relative h-44 flex-1 touch-pan-y rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onPointerMove={e => pick(e.clientX)}
          onPointerDown={e => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const d = e.key === 'ArrowLeft' ? -1 : 1;
              setHover(h => Math.min(points.length - 1, Math.max(0, (h ?? points.length - 1) + d)));
            }
            if (e.key === 'Escape') setHover(null);
          }}
        >
          {/* Recessive grid: three hairlines. */}
          {[0, 0.5, 1].map(f => (
            <div key={f} className="border-border/70 absolute inset-x-0 border-t" style={{ top: `${f * 100}%` }} aria-hidden="true" />
          ))}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="text-foreground absolute inset-0 size-full overflow-visible"
            aria-hidden="true"
          >
            <path d={area} fill="currentColor" opacity={0.07} />
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {at && hover !== null ? (
            <>
              <div
                className="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px"
                style={{ left: `${(x(hover) / W) * 100}%` }}
                aria-hidden="true"
              />
              <div
                className="bg-foreground ring-card pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(at.totalVR) / H) * 100}%` }}
                aria-hidden="true"
              />
              <div
                className={cn(
                  'bg-popover text-popover-foreground pointer-events-none absolute top-1 z-10 flex flex-col rounded-md border px-2.5 py-1.5 text-xs shadow-md',
                  hover > points.length / 2 ? '-translate-x-[calc(100%+10px)]' : 'translate-x-2.5',
                )}
                style={{ left: `${(x(hover) / W) * 100}%` }}
                aria-live="polite"
              >
                <span className="text-muted-foreground">{when(at.date)}</span>
                <span className="text-sm font-semibold tabular-nums">{formatVr(at.totalVR)} VR</span>
                {at.vrChange ? (
                  <span className={cn('tabular-nums', at.vrChange > 0 ? 'text-gain' : 'text-loss')}>{signed(at.vrChange)} that race</span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        <div className="text-muted-foreground flex h-44 flex-col justify-between text-right text-[11px] tabular-nums" aria-hidden="true">
          <span>{formatVr(Math.round(max))}</span>
          <span>{formatVr(Math.round((max + min) / 2))}</span>
          <span>{formatVr(Math.round(min))}</span>
        </div>
      </div>
      <figcaption className="text-muted-foreground flex justify-between pr-12 text-[11px]">
        <span>{day(first.date)}</span>
        <span>{day(last.date)}</span>
      </figcaption>
    </figure>
  );
}

/** How often a player finishes in each place: one series of bars, 1st through 12th, with a tooltip per bar. */
export function FinishChart({ positions }: { positions: { position: number; count: number }[] }) {
  const counts = Array.from({ length: 12 }, (_, i) => positions.find(p => p.position === i + 1)?.count ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const top = Math.max(1, ...counts);
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%');
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-32 items-end gap-0.5" role="list" aria-label={`Finishing places over ${formatVr(total)} races`}>
        {counts.map((n, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                role="listitem"
                tabIndex={0}
                aria-label={`${ordinal(i + 1)}: ${formatVr(n)} races, ${pct(n)}`}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {i === 0 && n ? <span className="text-muted-foreground mb-1 text-center text-[11px] tabular-nums">{pct(n)}</span> : null}
                <div
                  className={cn(
                    'rounded-t-[4px] transition-opacity group-hover:opacity-100',
                    i === 0 ? 'bg-foreground' : 'bg-foreground/55 opacity-90',
                  )}
                  style={{ height: `${Math.max(n ? 2 : 0, (n / top) * 100)}%` }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {ordinal(i + 1)}: {formatVr(n)} races ({pct(n)})
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <figcaption className="text-muted-foreground flex gap-0.5 text-center text-[11px] tabular-nums" aria-hidden="true">
        {counts.map((_, i) => (
          <span key={i} className="flex-1">
            {i + 1}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
