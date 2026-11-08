'use client';

import { useEffect, useRef, useState } from 'react';
import { songBlob } from '@/lib/music/library';
import { SAMPLE_RATE, type LoopPoints } from '@/lib/music/pack';
import { snapLoopEnd } from '@/lib/music/loop';
import { formatDuration, formatTime } from '@/lib/music/format';
import type { SongWave } from '@/lib/music/render';

interface Props {
  songId: string;
  loop: LoopPoints | null;
  /** Seconds the preview is at, when it's playing this track; null otherwise. */
  playhead: number | null;
  onChange: (loop: LoopPoints | null) => void;
  onHearJump: (loop: LoopPoints) => void;
}

type Found = LoopPoints & { score: number };

const MIN_LOOP = 1;
const HEIGHT = 84;
const round = (s: number) => Math.round(s * 1000) / 1000;

/**
 * The song's waveform with the loop marked: drag either edge, type the times, let it find loops, or snap the end to
 * where the music lines up with the start. Everything is in seconds of the original song.
 */
export function LoopEditor({ songId, loop, playhead, onChange, onHearJump }: Props) {
  const [wave, setWave] = useState<SongWave | null>(null);
  const [status, setStatus] = useState('Reading the song…');
  const [found, setFound] = useState<{ songId: string; loops: Found[] } | null>(null);
  const [finding, setFinding] = useState(false);
  const [draft, setDraft] = useState<LoopPoints | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<'start' | 'end' | null>(null);

  useEffect(() => {
    // The parent keys this editor by track and song, so it starts fresh with each song.
    let live = true;
    void (async () => {
      try {
        const blob = await songBlob(songId);
        if (!blob) throw new Error('The song is no longer in your library.');
        const { songWave } = await import('@/lib/music/render');
        const w = await songWave(songId, blob);
        if (!live) return;
        setWave(w);
        setStatus('');
      } catch (e) {
        if (live) setStatus(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [songId]);

  const duration = wave?.duration ?? 0;
  const shown = draft ?? loop ?? (duration ? { start: 0, end: duration } : null);
  const shownStart = shown?.start ?? 0;
  const shownEnd = shown?.end ?? 0;

  // Min and max of each pixel column, worked out once per song and width.
  const peaks = useRef<{ key: string; min: Float32Array; max: Float32Array } | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !wave || !shownEnd) return;
    const width = c.clientWidth;
    const ratio = window.devicePixelRatio || 1;
    c.width = Math.round(width * ratio);
    c.height = Math.round(HEIGHT * ratio);
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(ratio, ratio);
    const key = `${songId}|${width}`;
    if (peaks.current?.key !== key) {
      const min = new Float32Array(width), max = new Float32Array(width);
      const per = wave.mono.length / width;
      for (let x = 0; x < width; x++) {
        let lo = 0, hi = 0;
        const end = Math.min(wave.mono.length, Math.floor((x + 1) * per));
        for (let i = Math.floor(x * per); i < end; i += 4) {
          const v = wave.mono[i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        min[x] = lo;
        max[x] = hi;
      }
      peaks.current = { key, min, max };
    }
    const { min, max } = peaks.current;
    const style = getComputedStyle(c);
    const accent = style.getPropertyValue('--accent').trim() || '#7c9cff';
    const soft = style.getPropertyValue('--soft').trim() || '#666';
    const toX = (s: number) => (s / duration) * width;
    const a = toX(shownStart), b = toX(shownEnd);
    const mid = HEIGHT / 2;
    g.clearRect(0, 0, width, HEIGHT);
    g.fillStyle = accent + '22';
    g.fillRect(a, 0, b - a, HEIGHT);
    for (let x = 0; x < width; x++) {
      g.fillStyle = x >= a && x <= b ? accent : soft;
      const top = mid - max[x] * mid * 0.95;
      g.fillRect(x, top, 1, Math.max(1, (max[x] - min[x]) * mid * 0.95));
    }
    for (const x of [a, b]) {
      g.fillStyle = '#fff';
      g.fillRect(Math.min(width - 2, Math.max(0, x - 1)), 0, 2, HEIGHT);
      g.fillRect(Math.min(width - 8, Math.max(0, x - 4)), 0, 8, 10);
    }
    if (playhead !== null) {
      g.fillStyle = '#4ade80';
      g.fillRect(toX(playhead), 0, 1, HEIGHT);
    }
  }, [wave, shownStart, shownEnd, duration, playhead, songId]);

  if (!wave || !shown) return <p className="note loop-status">{status}</p>;

  const clamp = (l: LoopPoints, moved: 'start' | 'end'): LoopPoints => {
    let { start, end } = l;
    start = Math.max(0, Math.min(start, duration - MIN_LOOP));
    end = Math.min(duration, Math.max(end, MIN_LOOP));
    if (end - start < MIN_LOOP) {
      if (moved === 'start') start = end - MIN_LOOP;
      else end = start + MIN_LOOP;
    }
    return { start: round(start), end: round(end) };
  };
  // A loop over the whole song is the same as no loop.
  const commit = (l: LoopPoints) => onChange(l.start <= 0.001 && l.end >= duration - 0.001 ? null : l);

  const timeAt = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return (Math.min(rect.width, Math.max(0, clientX - rect.left)) / rect.width) * duration;
  };

  const findLoops = async () => {
    setFinding(true);
    setStatus('Looking for parts of the song that repeat…');
    try {
      const { findSongLoops } = await import('@/lib/music/render');
      const loops = await findSongLoops(wave);
      setFound({ songId, loops });
      if (loops[0]) commit(clamp(loops[0], 'end'));
      setStatus(loops.length ? 'Best match picked. Try the others below, and listen to the jump.' : 'No clear repeat in this song. Drag the edges to set a loop yourself.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setFinding(false);
    }
  };

  const snapEnd = () => {
    const snapped = snapLoopEnd(wave.mono, SAMPLE_RATE, Math.round(shown.start * SAMPLE_RATE), Math.round(shown.end * SAMPLE_RATE));
    const end = round(snapped.end / SAMPLE_RATE);
    // A poor match isn't worth moving to.
    if (snapped.score >= 0.5) commit(clamp({ start: shown.start, end }, 'end'));
    const moved = Math.round((end - shown.end) * 1000);
    setStatus(
      snapped.score < 0.5
        ? 'The music here doesn’t line up with the start. Try moving the end to the same beat as the start.'
        : `End ${moved === 0 ? 'was already in place' : `moved ${moved > 0 ? '+' : ''}${moved} ms`}. The waveform lines up ${Math.round(snapped.score * 100)}%.`,
    );
  };

  const candidates = found?.songId === songId ? found.loops : [];

  return (
    <div className="loop-editor">
      <p className="note">When the song reaches the end line it jumps back to the start line. Drag the white lines, or press Find loop.</p>
      <canvas
        ref={canvas}
        className="loop-wave"
        style={{ height: HEIGHT }}
        aria-label="Song waveform. Drag the white edges to set where the loop starts and ends."
        onPointerDown={e => {
          const t = timeAt(e.clientX);
          drag.current = Math.abs(t - shown.start) <= Math.abs(t - shown.end) ? 'start' : 'end';
          e.currentTarget.setPointerCapture(e.pointerId);
          setDraft(clamp({ ...shown, [drag.current]: t }, drag.current));
        }}
        onPointerMove={e => {
          if (!drag.current) return;
          setDraft(clamp({ ...shown, [drag.current]: timeAt(e.clientX) }, drag.current));
        }}
        onPointerUp={() => {
          if (draft) commit(draft);
          drag.current = null;
          setDraft(null);
        }}
      />
      <div className="loop-times">
        <label>
          Start
          <input
            type="number"
            min={0}
            step={0.01}
            value={shown.start.toFixed(2)}
            onChange={e => e.target.value && commit(clamp({ ...shown, start: Number(e.target.value) }, 'start'))}
          />
        </label>
        <label>
          End
          <input
            type="number"
            min={0}
            step={0.01}
            value={shown.end.toFixed(2)}
            onChange={e => e.target.value && commit(clamp({ ...shown, end: Number(e.target.value) }, 'end'))}
          />
        </label>
        <span className="loop-length">
          {formatTime(shown.start)} → {formatTime(shown.end)} · loops {formatDuration(shown.end - shown.start)}
        </span>
      </div>
      <div className="loop-actions">
        <button className="button" type="button" disabled={finding} onClick={() => void findLoops()}>
          {finding ? 'Finding…' : 'Find loop'}
        </button>
        <button className="button" type="button" disabled={!loop} onClick={snapEnd} title="Moves the end line a tiny bit so the jump back sounds smooth">
          Smooth the jump
        </button>
        <button className="button" type="button" onClick={() => onHearJump(shown)}>
          Hear the jump back
        </button>
        <button className="link-button" type="button" disabled={!loop} onClick={() => onChange(null)}>
          Repeat whole song
        </button>
      </div>
      {candidates.length > 1 ? (
        <ul className="loop-candidates" aria-label="Loops found">
          {candidates.map((c, i) => {
            const current = !!loop && Math.abs(loop.start - round(c.start)) < 0.01 && Math.abs(loop.end - round(c.end)) < 0.01;
            return (
              <li key={i}>
                <button type="button" aria-pressed={current} onClick={() => commit(clamp(c, 'end'))}>
                  <span>
                    {formatTime(c.start)} → {formatTime(c.end)}
                  </span>
                  <small>{Math.round(c.score * 100)}% smooth</small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {status ? <p className="note loop-status">{status}</p> : null}
    </div>
  );
}
