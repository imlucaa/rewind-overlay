'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

// Site look › Motion puts data-motion on <html>: "full" plays everything, "reduced" nothing, unset follows the system.
const subscribe = (cb: () => void) => {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => observer.disconnect();
};
const motionSetting = () => document.documentElement.dataset.motion ?? '';

/**
 * Motion settings for every Amicro piece, plus the spotlight: one pointer listener for the whole page tells the
 * [data-spotlight] card under the mouse where the pointer is. CSS draws the glow, so nothing re-renders.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  const setting = useSyncExternalStore(subscribe, motionSetting, () => '');
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);
  return (
    <MotionConfig reducedMotion={setting === 'full' ? 'never' : setting === 'reduced' ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  );
}
