'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotionConfig, useSpring } from 'motion/react';

/**
 * Amicro's MagneticButton, as a wrapper: the button inside leans toward the mouse when it's near and springs
 * back. It wraps the site's own buttons, so their look, focus and clicks stay as they are.
 */
export function Magnetic({ children, range = 60, strength = 0.25 }: { children: ReactNode; range?: number; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useReducedMotionConfig();
  const spring = { stiffness: 150, damping: 15, mass: 0.6 };
  const x = useSpring(0, spring);
  const y = useSpring(0, spring);
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.span
      ref={ref}
      className="magnetic"
      style={{ x, y }}
      onPointerMove={e => {
        if (still || e.pointerType !== 'mouse' || !ref.current) return;
        const { left, top, width, height } = ref.current.getBoundingClientRect();
        const dx = e.clientX - (left + width / 2);
        const dy = e.clientY - (top + height / 2);
        if (Math.hypot(dx, dy) > range) return reset();
        x.set(dx * strength);
        y.set(dy * strength);
      }}
      onPointerLeave={reset}
    >
      {children}
    </motion.span>
  );
}
