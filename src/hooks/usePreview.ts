'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { songBlob } from '@/lib/music/library';
import type { LoopPoints } from '@/lib/music/pack';

export interface PreviewSettings {
  speed: number;
  keepPitch: boolean;
  volumeDb: number;
  /** Seconds of the song. Playback jumps back from the end to the start, as in the game. */
  loop?: LoopPoints | null;
  /** Seconds skipped at the start. */
  trimStart?: number;
  /** Seconds of fade in from the start. */
  fadeIn?: number;
}

const NORMAL: PreviewSettings = { speed: 1, keepPitch: true, volumeDb: 0 };

/**
 * One audio player for the page. Speed and pitch use the browser's own playback rate (with or without keeping
 * pitch), which matches what the export bakes in; volume goes through a gain node so boosts above 0 dB are heard.
 */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const url = useRef('');
  const loop = useRef<LoopPoints | null>(null);
  const frame = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState({ position: 0, duration: 0 });

  const element = useCallback((): HTMLAudioElement => {
    if (!audio.current) {
      const a = new Audio();
      a.ontimeupdate = () => setTime({ position: a.currentTime, duration: a.duration || 0 });
      a.onended = a.onpause = () => {
        cancelAnimationFrame(frame.current);
        setPlaying(null);
      };
      // Checked every frame (timeupdate is too coarse): the jump back lands within a frame of the loop end.
      a.onplay = () => {
        const watch = () => {
          const l = loop.current;
          if (l && a.currentTime >= l.end) a.currentTime = l.start + (a.currentTime - l.end);
          frame.current = requestAnimationFrame(watch);
        };
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(watch);
      };
      audio.current = a;
    }
    return audio.current;
  }, []);

  const apply = useCallback((settings: PreviewSettings) => {
    const a = audio.current;
    if (!a) return;
    a.preservesPitch = settings.keepPitch;
    a.playbackRate = settings.speed;
    loop.current = settings.loop ?? null;
    if (gain.current) gain.current.gain.value = Math.pow(10, settings.volumeDb / 20);
  }, []);

  /** Plays `key` (a song, or a track using one), loading the song if it isn't loaded. */
  const play = useCallback(
    async (key: string, songId: string, title: string, settings: PreviewSettings = NORMAL, from?: number) => {
      const a = element();
      if (loaded !== key + songId) {
        const blob = await songBlob(songId);
        if (!blob) return;
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        a.src = url.current;
        setLoaded(key + songId);
        setTime({ position: 0, duration: 0 });
      }
      if (!context.current) {
        const ctx = new AudioContext();
        gain.current = ctx.createGain();
        ctx.createMediaElementSource(a).connect(gain.current).connect(ctx.destination);
        context.current = ctx;
      }
      if (context.current.state === 'suspended') await context.current.resume();
      apply(settings);
      setTitle(title);
      // From the top (not resuming, not a jump to a spot): where the export starts, fading in like it.
      const trim = settings.trimStart ?? 0;
      const fromTop = from === undefined && (a.currentTime < trim || a.ended || loaded !== key + songId);
      const start = from ?? (fromTop && trim ? trim : undefined);
      if (start !== undefined) {
        if (a.readyState < 1) await new Promise(resolve => a.addEventListener('loadedmetadata', resolve, { once: true }));
        a.currentTime = Math.max(0, start);
      }
      const fade = settings.fadeIn ?? 0;
      if (fromTop && fade && gain.current && context.current) {
        const g = gain.current.gain;
        const now = context.current.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(Math.pow(10, settings.volumeDb / 20), now + fade / settings.speed);
      }
      await a.play();
      setPlaying(key);
    },
    [apply, element, loaded],
  );

  const pause = useCallback(() => audio.current?.pause(), []);
  const seek = useCallback((seconds: number) => {
    if (audio.current) audio.current.currentTime = seconds;
  }, []);

  useEffect(
    () => () => {
      audio.current?.pause();
      cancelAnimationFrame(frame.current);
      if (url.current) URL.revokeObjectURL(url.current);
      void context.current?.close();
    },
    [],
  );

  return { playing, loadedKey: loaded, title, time, play, pause, seek, apply };
}

export type Preview = ReturnType<typeof usePreview>;
