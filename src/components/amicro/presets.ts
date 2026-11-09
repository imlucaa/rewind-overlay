// Amicro's spring presets (registry/lib/presets.ts), the ones this site uses.
export const presets = {
  snappy: { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 },
  smooth: { type: 'spring', stiffness: 220, damping: 24, mass: 1 },
} as const;

/** Amicro's easeOutExpo, used by its reveals. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
