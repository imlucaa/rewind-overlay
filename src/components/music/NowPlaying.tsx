'use client';

import { formatDuration } from '@/lib/music/format';
import type { Preview } from '@/hooks/usePreview';
import { Slider } from '@/components/ui/slider';
import { PauseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The progress of whatever is playing, with seeking. */
export function NowPlaying({ preview }: { preview: Preview }) {
  if (!preview.loadedKey) return null;
  const { position, duration } = preview.time;
  return (
    <div role="region" aria-label="Now playing" className="pointer-events-none sticky bottom-0 z-20 flex justify-center px-3 pb-3">
      <div className="glass pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-(--ease-out) flex h-14 w-full max-w-3xl items-center gap-4 rounded-full px-4">
        {preview.playing ? (
          <Button variant="ghost" size="icon" aria-label="Pause" onClick={preview.pause}>
            <PauseIcon aria-hidden="true" />
          </Button>
        ) : null}
        <div className="flex w-40 min-w-0 shrink-0 flex-col sm:w-64">
          <strong className="truncate text-sm font-medium">{preview.title}</strong>
          <small className="text-muted-foreground text-xs">{preview.playing ? 'Playing' : 'Paused'}</small>
        </div>
        <Slider aria-label="Position" min={0} max={duration || 0} step={0.1} value={[Math.min(position, duration || 0)]} onValueChange={([v]) => preview.seek(v)} />
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatDuration(position)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
