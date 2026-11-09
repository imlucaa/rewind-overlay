'use client';

import { motion } from 'motion/react';
import { easeOutExpo } from './presets';

/**
 * Amicro's TextReveal for one line: the text slides up out of a mask. Keyed by the text, so a new heading
 * (another track picked) reveals again.
 */
export function TextReveal({ text, as: Tag = 'h2', className }: { text: string; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <Tag className={className ? `text-reveal ${className}` : 'text-reveal'}>
      <motion.span key={text} initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: easeOutExpo }}>
        {text}
      </motion.span>
    </Tag>
  );
}
