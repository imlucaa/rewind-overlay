'use client';

import { useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HoldButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  /** Runs once the button has been held all the way. */
  onConfirm: () => void;
  children: ReactNode;
}

/**
 * A button for things that are hard to undo: hold it (pointer, Space or Enter) while a fill sweeps across, and the
 * action runs when the fill reaches the end. Let go early and it snaps back. Slow on purpose while you decide, fast
 * when you change your mind. The fill timing lives in styles/motion.css (.hold-fill).
 */
export function HoldButton({ onConfirm, children, className, ...props }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const start = () => setHolding(true);
  const stop = () => setHolding(false);
  return (
    <Button
      {...props}
      data-holding={holding || undefined}
      className={cn('relative overflow-hidden', className)}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={e => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start();
      }}
      onKeyUp={e => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      }}
      onBlur={stop}
    >
      <span
        aria-hidden="true"
        className="hold-fill bg-destructive/20 absolute inset-0"
        onTransitionEnd={e => {
          if (e.propertyName === 'clip-path' && holding) {
            setHolding(false);
            onConfirm();
          }
        }}
      />
      <span className="relative flex items-center gap-1.5">{children}</span>
    </Button>
  );
}
