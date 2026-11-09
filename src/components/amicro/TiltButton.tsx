'use client';

import type { ComponentProps } from 'react';
import { motion, useMotionValue, useReducedMotionConfig, useSpring, useTransform } from 'motion/react';

type Props = ComponentProps<typeof motion.button> & { maxTilt?: number };

/** Amicro's TiltCard as a button: it tips toward the mouse in 3D. A small tilt, for the look cards. */
export function TiltButton({ maxTilt = 8, style, onPointerMove, onPointerLeave, ...rest }: Props) {
  const still = useReducedMotionConfig();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { damping: 20, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [maxTilt, -maxTilt]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-maxTilt, maxTilt]), spring);
  return (
    <motion.button
      {...rest}
      style={{ ...style, rotateX, rotateY, transformPerspective: 700 }}
      onPointerMove={e => {
        onPointerMove?.(e);
        if (still || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={e => {
        onPointerLeave?.(e);
        px.set(0);
        py.set(0);
      }}
    />
  );
}
