'use client';

import { motion } from 'motion/react';

/** Amicro's BounceDots, sized for a button label. */
export function BounceDots() {
  return (
    <span className="bounce-dots" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <motion.i key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }} />
      ))}
    </span>
  );
}

/** Amicro's ShimmerLine, full width: something is working (opening a pack, encoding). */
export function ShimmerLine() {
  return (
    <span className="shimmer-line" aria-hidden="true">
      <motion.i animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
    </span>
  );
}

/** Amicro's Skeleton: a soft block with a light sweeping across, while something loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={className ? `skeleton ${className}` : 'skeleton'} aria-hidden="true">
      <motion.i initial={{ x: '-150%' }} animate={{ x: '150%' }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} />
    </span>
  );
}
