/// <reference lib="webworker" />
// Off the page's thread: finding loops, and encoding a song (keep-pitch speed, loop, volume, 16-bit, BRSTM).
import { writeBrstm } from '../lib/music/brstm.ts';
import { crossfadeLoop, findLoops } from '../lib/music/loop.ts';
import { stretch, toPcm16 } from '../lib/music/pcm.ts';
import type { WorkerRequest, WorkerResponse } from '../lib/music/encodeMessages.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const reply = (message: WorkerResponse, transfer: Transferable[] = []): void => scope.postMessage(message, transfer);

// A keep-pitch speed change reshapes the waveform, so the loop jump gets a short blend (Music Pack Maker does too).
const STRETCHED_JUMP_BLEND_SECONDS = 0.03;

scope.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  const { id } = data;
  try {
    if (data.kind === 'find-loop') {
      reply({ id, kind: 'loop', loops: findLoops(data.mono, data.rate) });
      return;
    }
    const { channels, stretchSpeed, gainDb, rate, loop, playsOnce } = data;
    let timed = stretchSpeed !== 1 ? stretch(channels, stretchSpeed) : channels;
    let loopStart = 0;
    if (loop) {
      const length = timed[0].length;
      const end = Math.min(length, Math.round(loop.end / stretchSpeed));
      loopStart = Math.min(end - 1, Math.round(loop.start / stretchSpeed));
      // The file ends where the loop does: the game jumps back from its last sample.
      timed = timed.map(ch => ch.slice(0, end));
      if (stretchSpeed !== 1) loopStart = crossfadeLoop(timed, loopStart, end, Math.round(STRETCHED_JUMP_BLEND_SECONDS * rate));
    }
    const bytes = writeBrstm(toPcm16(timed, gainDb), rate, !playsOnce, (done, total) => reply({ id, kind: 'progress', value: done / total }), loopStart);
    reply({ id, kind: 'done', bytes }, [bytes.buffer]);
  } catch (error) {
    reply({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
