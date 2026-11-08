'use client';

import { useCallback, useSyncExternalStore } from 'react';

// State kept in localStorage, read through useSyncExternalStore: the pre-rendered page uses the fallback, the browser
// then shows the stored value without an extra effect pass, and other tabs' changes come through the storage event.
// If storage is blocked (private mode, site settings) values live in memory for the visit.

const memory = new Map<string, string>();
const cache = new Map<string, { raw: string | null; value: unknown }>();
const serverValues = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, raw: string): void {
  try {
    localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
  }
}

function subscribe(key: string, onChange: () => void): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(onChange);
  listeners.set(key, set);
  const onStorage = (e: StorageEvent) => e.key === key && onChange();
  window.addEventListener('storage', onStorage);
  return () => {
    set.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const noSubscribe = () => () => {};

export function useStoredState<T>(key: string, parse: (text: string | null) => T, fallback: () => T) {
  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T;
    const value = parse(raw);
    cache.set(key, { raw, value });
    return value;
  }, [key, parse]);

  const getServerSnapshot = useCallback((): T => {
    if (!serverValues.has(key)) serverValues.set(key, fallback());
    return serverValues.get(key) as T;
  }, [key, fallback]);

  const value = useSyncExternalStore(useCallback(cb => subscribe(key, cb), [key]), getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = getSnapshot();
      const value = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (Object.is(value, current)) return;
      const raw = JSON.stringify(value);
      writeRaw(key, raw);
      cache.set(key, { raw, value });
      for (const listener of listeners.get(key) ?? []) listener();
    },
    [key, getSnapshot],
  );

  return [value, setValue, ready] as const;
}
