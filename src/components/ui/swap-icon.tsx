import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwapIconProps {
  /** Which icon shows: `on` when true, `off` when false. */
  active: boolean;
  on: ReactNode;
  off: ReactNode;
  className?: string;
}

/**
 * Two icons in one spot that crossfade when the state flips (copied, light or dark). A short blur bridges the two so
 * the eye reads one icon changing, not two swapping. Use inside a Button; it sizes like a single icon.
 */
export function SwapIcon({ active, on, off, className }: SwapIconProps) {
  const layer = 'col-start-1 row-start-1 transition-[opacity,scale,filter] duration-200 ease-(--ease-out)';
  const hidden = 'scale-90 opacity-0 blur-[2px]';
  return (
    <span data-icon="inline-start" aria-hidden="true" className={cn('grid place-items-center', className)}>
      <span className={cn(layer, active ? null : hidden)}>{on}</span>
      <span className={cn(layer, active ? hidden : null)}>{off}</span>
    </span>
  );
}
