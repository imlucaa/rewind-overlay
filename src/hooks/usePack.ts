'use client';

import { useState } from 'react';
import { useStoredState } from './useStoredState';
import { PACK_KEY, emptyPack, parsePack, type PackState } from '@/lib/music/packState';

const HISTORY = 100;
/** Changes with the same key this close together (dragging a slider) are one undo step. */
const MERGE_MS = 1500;

interface History {
  past: PackState[];
  future: PackState[];
  lastKey: string | null;
  lastAt: number;
}

/** The pack's name and assignments, saved in this browser, with undo and redo. */
export function usePack() {
  const [pack, setPack, ready] = useStoredState<PackState>(PACK_KEY, parsePack, emptyPack);
  const [history, setHistory] = useState<History>({ past: [], future: [], lastKey: null, lastAt: 0 });

  const update = (change: (pack: PackState) => PackState, mergeKey?: string) => {
    const next = change(pack);
    if (next === pack) return;
    const now = Date.now();
    const merge = mergeKey !== undefined && history.lastKey === mergeKey && now - history.lastAt < MERGE_MS;
    setHistory(h => ({
      past: merge ? h.past : [...h.past.slice(-(HISTORY - 1)), pack],
      future: [],
      lastKey: mergeKey ?? null,
      lastAt: now,
    }));
    setPack(next);
  };

  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory(h => ({ past: h.past.slice(0, -1), future: [...h.future, pack], lastKey: null, lastAt: 0 }));
    setPack(previous);
  };

  const redo = () => {
    const next = history.future.at(-1);
    if (!next) return;
    setHistory(h => ({ past: [...h.past, pack], future: h.future.slice(0, -1), lastKey: null, lastAt: 0 }));
    setPack(next);
  };

  return { pack, ready, update, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}

export type PackApi = ReturnType<typeof usePack>;
