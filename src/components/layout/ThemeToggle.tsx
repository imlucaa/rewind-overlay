'use client';

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SwapIcon } from '@/components/ui/swap-icon';

const noSubscribe = () => () => {};

/**
 * Swaps the theme inside a view transition, so the page crossfades (styles/motion.css) instead of the whole screen
 * jumping from black to white in one frame. The class goes on <html> by hand so the browser's "after" snapshot already
 * has the new theme; next-themes then saves the choice. While it swaps, every CSS transition is switched off: otherwise
 * each button and card would also tween its own colors under the crossfade, which is what made switching feel heavy.
 * Browsers without view transitions just switch.
 */
function switchTheme(next: 'light' | 'dark', setTheme: (theme: string) => void) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    root.style.colorScheme = next;
    setTheme(next);
  };
  const still = document.createElement('style');
  still.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(still);
  const done = () => requestAnimationFrame(() => still.remove());
  if (!document.startViewTransition) {
    apply();
    return done();
  }
  document.startViewTransition(() => flushSync(apply)).finished.finally(done);
}

/** Switches between light and dark. Sun and moon: the glyphs people already read as "theme". */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser; the server copy shows a neutral label so the two match.
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  const dark = ready && resolvedTheme === 'dark';
  const label = !ready ? 'Theme' : dark ? 'Light mode' : 'Dark mode';
  return (
    <Button
      variant="ghost"
      size={compact ? 'icon' : 'default'}
      className={compact ? 'text-muted-foreground size-8 rounded-full' : 'w-full justify-start'}
      aria-label={compact ? label : undefined}
      onClick={() => switchTheme(dark ? 'light' : 'dark', setTheme)}
    >
      <SwapIcon active={dark} on={<SunIcon />} off={<MoonIcon />} />
      {compact ? null : label}
    </Button>
  );
}
