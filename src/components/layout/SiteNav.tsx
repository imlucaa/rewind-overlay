'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PAGES = [
  { href: '/', label: 'Overlay' },
  { href: '/music-pack/', label: 'Music Pack' },
] as const;

/** Switches between the site's two tools. */
export function SiteNav() {
  const path = usePathname();
  const isCurrent = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, '')));
  return (
    <nav className="site-nav" aria-label="Tools">
      {PAGES.map(page => (
        <Link key={page.href} href={page.href} className="brand" aria-current={isCurrent(page.href) ? 'page' : undefined}>
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
