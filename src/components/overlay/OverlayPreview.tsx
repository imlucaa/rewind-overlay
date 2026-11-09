'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Skeleton } from '@/components/amicro/Loaders';

// The overlay lays out at least FRAME px wide, then is scaled down to the stage, so the card always fits.
const FRAME = 760;

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

  return (
    <div className="stage" ref={stage} data-backdrop={backdrop}>
      <iframe ref={frame} src={src} title="Overlay preview" onLoad={() => setLoading(null)} />
      {loading === src && url ? <Skeleton className="stage-skeleton" /> : null}
      {url ? null : <p className="stage-empty">{emptyMessage}</p>}
    </div>
  );
}
