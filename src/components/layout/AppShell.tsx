'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { MotionRoot } from '@/components/amicro/MotionRoot';
import { presets } from '@/components/amicro/presets';
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

// Set once the first page has shown: a later AppShell is a move to the other tool, which slides in like a tab.
let shownOnce = false;

/** The site's frame: sidebar, top bar, main panel and a side column, as on the original page. */
export function AppShell({ tabs, tabsLabel, actions, status, aside, asideLabel, className, viewKey, children }: AppShellProps) {
  // Not on the first tab shown: that one comes in with the opening animation.
  const [firstKey] = useState(viewKey);
  const [switched, setSwitched] = useState(() => shownOnce);
  if (!switched && viewKey !== firstKey) setSwitched(true);
  useEffect(() => {
    shownOnce = true;
  }, []);
  return (
    <MotionRoot>
    <div className={className ? `app ${className}` : 'app'}>
      <aside className="sidebar">
        <SiteNav />
        <LayoutGroup id="tabs">
          <nav className="nav" aria-label={tabsLabel}>
            {tabs}
          </nav>
        </LayoutGroup>
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
    </MotionRoot>
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
      {/* Amicro's hover-card highlight (one shared layoutId): it glides from the old tab to the new one. */}
      {current ? <motion.span className="tab-pill" layoutId="tab-pill" transition={presets.smooth} aria-hidden="true" /> : null}
      <span className="tab-text">{children}</span>
    </button>
  );
}
