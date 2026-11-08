'use client';

import { useState, type ReactNode } from 'react';
import { SiteNav } from './SiteNav';
import { SiteLook } from './SiteLook';

interface AppShellProps {
  /** The page's own tabs, under the site links. */
  tabs: ReactNode;
  tabsLabel: string;
  /** Right side of the top bar. */
  actions?: ReactNode;
  /** Left side of the top bar. */
  status?: ReactNode;
  /** The right-hand column (overlay preview, or the selected track). */
  aside?: ReactNode;
  asideLabel?: string;
  /** Extra class on the frame, for a page's own layout tweaks. */
  className?: string;
  /** The open tab: when it changes, the new content slides in. */
  viewKey?: string;
  children: ReactNode;
}

/** The site's frame: sidebar, top bar, main panel and a side column, as on the original page. */
export function AppShell({ tabs, tabsLabel, actions, status, aside, asideLabel, className, viewKey, children }: AppShellProps) {
  // Not on the first tab shown: that one comes in with the opening animation.
  const [firstKey] = useState(viewKey);
  const [switched, setSwitched] = useState(false);
  if (!switched && viewKey !== firstKey) setSwitched(true);
  return (
    <div className={className ? `app ${className}` : 'app'}>
      <aside className="sidebar">
        <SiteNav />
        <nav className="nav" aria-label={tabsLabel}>
          {tabs}
        </nav>
        <SiteLook />
      </aside>
      <header className="topbar">
        <div className="status">{status}</div>
        <div className="actions">{actions}</div>
      </header>
      <main className="panel">
        <div key={viewKey} className={switched ? 'view switched' : 'view'}>
          {children}
        </div>
      </main>
      <section className="preview" aria-label={asideLabel}>
        <div className="preview-inner">{aside}</div>
      </section>
    </div>
  );
}

interface TabProps {
  current: boolean;
  onSelect: () => void;
  children: ReactNode;
}

export function Tab({ current, onSelect, children }: TabProps) {
  return (
    <button type="button" aria-current={current} onClick={onSelect}>
      {children}
    </button>
  );
}
