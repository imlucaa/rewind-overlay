'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SwapIcon } from '@/components/ui/swap-icon';

const noSubscribe = () => () => {};

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
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <SwapIcon active={dark} on={<SunIcon />} off={<MoonIcon />} />
      {compact ? null : label}
    </Button>
  );
}
