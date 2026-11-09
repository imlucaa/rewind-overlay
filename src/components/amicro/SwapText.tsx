'use client';

import { AnimatePresence, motion } from 'motion/react';
import { presets } from './presets';

/** A label that rolls to its new text (Copy link → Copied) instead of jumping. */
export function SwapText({ text }: { text: string }) {
  return (
    <span className="swap-text">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={presets.snappy}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
