'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOOLS, toolFor } from './tools';
import { ThemeToggle } from './ThemeToggle';

/**
 * The tool switcher: a notch hanging from the top edge (styles and animation in src/styles/notch.css). It lives in the
 * root layout, so it stays mounted across pages and moving between tools animates.
 */
export function ToolIsland() {
  const tool = toolFor(usePathname());
  const reach = TOOLS.length - 1;
  return (
    <header className="pointer-events-none sticky top-0 z-30 flex justify-center">
      <nav aria-label="Tools" className="notch pointer-events-auto">
        {TOOLS.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t === tool ? 'page' : undefined}
            className="notch-link"
            style={{ '--offset': i, '--reach': reach } as CSSProperties}
          >
            <span className="notch-pill" aria-hidden="true" />
            <t.icon aria-hidden="true" className="notch-icon" />
            <span className="notch-label">
              <span className="notch-label-text">{t.label}</span>
            </span>
          </Link>
        ))}
        <span aria-hidden="true" className="bg-foreground/15 mx-1 h-4 w-px" />
        <ThemeToggle compact />
      </nav>
    </header>
  );
}
