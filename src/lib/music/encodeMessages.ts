// Messages between the page and the music worker.

export type WorkerRequest =
  | {
      kind: 'encode';
      id: number;
      /** Decoded audio, already at the output rate. */
      channels: Float32Array[];
      /** 1 for none; otherwise a keep-pitch speed change. */
      stretchSpeed: number;
      gainDb: number;
      rate: number;
      /** Samples of `channels` (before any stretch). Null loops the whole song. */
      loop: { start: number; end: number } | null;
      /** Write a file that plays once and stops (short jingles). */
      playsOnce?: boolean;
    }
  | { kind: 'find-loop'; id: number; mono: Float32Array; rate: number };

export type WorkerResponse =
  | { id: number; kind: 'progress'; value: number }
  | { id: number; kind: 'done'; bytes: Uint8Array }
  | { id: number; kind: 'loop'; loops: { start: number; end: number; score: number }[] }
  | { id: number; kind: 'error'; message: string };
