'use client';

import { formatDuration } from '@/lib/music/format';
import type { Preview } from '@/hooks/usePreview';

/** The progress of whatever is playing, with seeking. */
export function NowPlaying({ preview }: { preview: Preview }) {
  if (!preview.loadedKey) return null;
  const { position, duration } = preview.time;
  return (
    <div className="now-playing">
      <small>{preview.playing ? 'Playing' : 'Paused'}</small>
      <strong>{preview.title}</strong>
      <input
        type="range"
        aria-label="Position"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(position, duration || 0)}
        onChange={e => preview.seek(Number(e.target.value))}
      />
      <span>
        {formatDuration(position)} / {formatDuration(duration)}
      </span>
    </div>
  );
}
