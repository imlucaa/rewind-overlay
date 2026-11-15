'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// The overlay lays out at least FRAME px wide, then is scaled down to the stage, so the card always fits.
const FRAME = 760;

// Grid: faint lines on near-black, so see-through parts of the overlay read as see-through, as they will in OBS.
const BACKDROP_CLASS: Record<Backdrop, string> = {
  grid: 'bg-[#0d0d0f] bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]',
  black: 'bg-black',
  white: 'bg-white',
  green: 'bg-[#00b140]',
};

interface Props {
  /** The overlay link, or null while it can't be made (no friend code or name yet). */
  url: string | null;
  emptyMessage: string;
  /** While set, the overlay acts out a race result with this change every few seconds. */
  playGain: { gain: number; ms: number; everyMs: number } | null;
  /** Filled with a function that acts out one race result now (the Test race button). */
  playRef?: RefObject<((gain: number, ms: number) => void) | null>;
  /** What's behind the overlay in the preview. */
  backdrop?: Backdrop;
}

export type Backdrop = 'grid' | 'black' | 'white' | 'green';
export const BACKDROPS: readonly (readonly [Backdrop, string])[] = [
  ['grid', 'Grid'],
  ['black', 'Black'],
  ['white', 'White'],
  ['green', 'Green screen'],
];

/** The real overlay in a frame, as OBS will show it. */
export function OverlayPreview({ url, emptyMessage, playGain, playRef, backdrop = 'grid' }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState('about:blank');
  // The first overlay to load (not later rebuilds, which would flash), shown as a skeleton until its frame is in.
  const [loading, setLoading] = useState<string | null>(null);

  // Rebuilding the overlay on every keystroke would flicker: wait until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = url ?? 'about:blank';
      setSrc(old => {
        if (old === 'about:blank' && next !== 'about:blank') setLoading(next);
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    const el = stage.current;
    const iframe = frame.current;
    if (!el || !iframe) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.min(1, width / FRAME);
      iframe.style.width = width / scale + 'px';
      iframe.style.height = height / scale + 'px';
      iframe.style.transform = `scale(${scale})`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playRef) return;
    playRef.current = (gain, ms) => frame.current?.contentWindow?.postMessage({ ww: 'play-gain', gain, ms }, '*');
    return () => {
      playRef.current = null;
    };
  }, [playRef]);

  const gain = playGain?.gain;
  const ms = playGain?.ms;
  const everyMs = playGain?.everyMs;
  useEffect(() => {
    if (gain === undefined || ms === undefined || everyMs === undefined) return;
    const play = () => frame.current?.contentWindow?.postMessage({ ww: 'play-gain', gain, ms }, '*');
    play();
    const timer = setInterval(play, everyMs);
    return () => clearInterval(timer);
  }, [gain, ms, everyMs, src]);

  const waiting = loading === src && !!url;
  return (
    <div ref={stage} className={cn('relative aspect-video overflow-hidden rounded-xl border', BACKDROP_CLASS[backdrop])}>
      {/* color-scheme light keeps the frame see-through in dark mode, as in OBS. */}
      <iframe
        ref={frame}
        src={src}
        title="Overlay preview"
        onLoad={() => setLoading(null)}
        className={cn(
          // Its transform is set from script (the scale), so only opacity and blur transition here.
          'absolute top-0 left-0 size-full origin-top-left border-0 bg-transparent transition-[opacity,filter] duration-300 ease-(--ease-out) [color-scheme:light]',
          waiting && 'opacity-0 blur-sm',
        )}
      />
      {/* Stays mounted so it can fade out as the overlay fades in, rather than vanishing first. */}
      <Skeleton
        aria-label={waiting ? 'Loading the overlay' : undefined}
        aria-hidden={!waiting}
        className={cn('absolute inset-4 rounded-md transition-opacity duration-300 ease-(--ease-out)', !waiting && 'pointer-events-none opacity-0')}
      />
      {url || !emptyMessage ? null : (
        <p className="pointer-events-none absolute inset-0 grid place-items-center p-5 text-center text-sm text-zinc-400">{emptyMessage}</p>
      )}
    </div>
  );
}
