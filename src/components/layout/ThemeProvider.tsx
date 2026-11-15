'use client';

import type { ComponentProps } from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';

/** Light or dark, following the system until the visitor picks one; kept in localStorage. */
export function ThemeProvider(props: ComponentProps<typeof NextThemes>) {
  return <NextThemes {...props} />;
}
