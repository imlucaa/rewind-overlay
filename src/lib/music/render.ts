// Browser side of the music work: decode a song at the right rate, hand it to the worker, get a .brstm (or a
// found loop) back.
import type { Assignment, LoopPoints } from './pack.ts';
import { SAMPLE_RATE } from './pack.ts';
import type { WorkerRequest, WorkerResponse } from './encodeMessages.ts';

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    const created = new Worker(new URL('../../workers/encode.worker.ts', import.meta.url), { type: 'module' });
    worker = created;
  }
  return worker;
}

/** Sends a request and resolves with the worker's final answer for it. */
function ask(request: WorkerRequest, onProgress?: (value: number) => void): Promise<WorkerResponse> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const listen = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.id !== request.id) return;
      if (data.kind === 'progress') return onProgress?.(data.value);
      w.removeEventListener('message', listen);
      if (data.kind === 'error') reject(new Error(data.message));
      else resolve(data);
    };
    w.addEventListener('message', listen);
    // Copied, not transferred: the arrays belong to the decoded AudioBuffer.
    w.postMessage(request);
  });
}

async function decode(blob: Blob, rate: number): Promise<Float32Array[]> {
  const context = new OfflineAudioContext(2, 1, rate);
  let audio: AudioBuffer;
  try {
    audio = await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error('This browser can’t decode the file. Try converting it to MP3 or WAV.');
  }
  return Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, c) => audio.getChannelData(c));
}

/**
 * Speed without keeping pitch is done by decoding at SAMPLE_RATE / speed and playing it at SAMPLE_RATE, like a
 * record played faster: every sample keeps its place and the browser's own resampler does the work. Keeping the
 * pitch decodes at SAMPLE_RATE and time-stretches in the worker. Loop points (seconds of the original song) are
 * turned into samples of the decoded audio.
 */
export async function renderBrstm(blob: Blob, assignment: Assignment, onProgress?: (value: number) => void): Promise<Uint8Array> {
  const pitchShift = !assignment.keepPitch && assignment.speed !== 1;
  const decodeRate = pitchShift ? Math.round(SAMPLE_RATE / assignment.speed) : SAMPLE_RATE;
  const decoded = await decode(blob, decodeRate);
  // Skip the start: the file begins later, and the loop points move back by as much (a loop starting inside the cut
  // part starts at the new beginning).
  const trim = Math.min(decoded[0].length - 1, Math.max(0, Math.round((assignment.trimStart ?? 0) * decodeRate)));
  const fade = Math.round((assignment.fadeIn ?? 0) * decodeRate);
  const channels = trim || fade ? decoded.map(ch => ch.slice(trim)) : decoded;
  for (const ch of fade ? channels : []) for (let i = 0; i < Math.min(fade, ch.length); i++) ch[i] *= i / fade;
  const start = assignment.loop ? Math.max(0, Math.round(assignment.loop.start * decodeRate) - trim) : 0;
  const end = assignment.loop ? Math.round(assignment.loop.end * decodeRate) - trim : 0;
  const loop = assignment.loop && end > start + 1 ? { start, end } : null;
  const stretchSpeed = assignment.keepPitch ? assignment.speed : 1;
  const answer = await ask({ kind: 'encode', id: nextId++, channels, stretchSpeed, gainDb: assignment.volumeDb, rate: SAMPLE_RATE, loop, playsOnce: assignment.playsOnce }, onProgress);
  if (answer.kind !== 'done') throw new Error('The encoder gave no file.');
  return answer.bytes;
}

export interface SongWave {
  /** Mono at SAMPLE_RATE. */
  mono: Float32Array;
  duration: number;
}

// The last few songs opened in the loop editor, so switching tracks doesn't decode again.
const waves = new Map<string, Promise<SongWave>>();

/** The song as mono samples, for the loop editor's waveform, snapping and finding. */
export function songWave(songId: string, blob: Blob): Promise<SongWave> {
  let wave = waves.get(songId);
  if (!wave) {
    wave = decode(blob, SAMPLE_RATE).then(channels => {
      const mono = new Float32Array(channels[0].length);
      for (const ch of channels) for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / channels.length;
      return { mono, duration: mono.length / SAMPLE_RATE };
    });
    wave.catch(() => waves.delete(songId));
    waves.set(songId, wave);
    if (waves.size > 3) waves.delete(waves.keys().next().value!);
  }
  return wave;
}

/** Up to five loops in seconds, best first; empty when the song has no clear repeat. */
export async function findSongLoops(wave: SongWave): Promise<(LoopPoints & { score: number })[]> {
  // Copied, so the cached samples stay here.
  const answer = await ask({ kind: 'find-loop', id: nextId++, mono: wave.mono.slice(), rate: SAMPLE_RATE });
  if (answer.kind !== 'loop') return [];
  return answer.loops.map(l => ({ start: l.start / SAMPLE_RATE, end: l.end / SAMPLE_RATE, score: l.score }));
}
