'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toolFor } from './tools';

// Every row of the frame shares this width, so the tool bar, the header and the panels line up.
export const CONTAINER = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8';

interface AppShellProps {
  /** The page's own views (Tab elements), as a segmented bar under the title. */
  tabs: ReactNode;
  tabsLabel: string;
  /** Under the page title: what's open, counts. Defaults to what the tool does. */
  status?: ReactNode;
  /** Right side of the page header. */
  actions?: ReactNode;
  /** Pinned to the bottom of the window (the music player); it styles its own bar and can render nothing. */
  dock?: ReactNode;
  children: ReactNode;
}

/**
 * A tool page's frame (the tool island above it lives in the root layout): a page header with the title and the page's main actions, a strip of
 * the page's views, then the page itself.
 */
export function AppShell({ tabs, tabsLabel, status, actions, dock, children }: AppShellProps) {
  const tool = toolFor(usePathname());
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);

  // Moves the pill to the open tab after every render (tabs change on click), and when the bar resizes.
  useLayoutEffect(() => {
    const bar = nav.current;
    const el = pill.current;
    if (!bar || !el) return;
    const place = () => {
      const open = bar.querySelector<HTMLElement>('[aria-current]');
      el.style.opacity = open ? '1' : '0';
      if (!open) return;
      el.style.translate = `${open.offsetLeft}px 0`;
      el.style.width = `${open.offsetWidth}px`;
    };
    place();
    // After the first placement, let it slide.
    requestAnimationFrame(() => el.removeAttribute('data-still'));
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    return () => observer.disconnect();
  });

  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col">
      {/* One header block: title and actions on a line, the page's views as a segmented bar under them. */}
      <div className={cn(CONTAINER, 'flex flex-col gap-4 pt-6')}>
        <div className="reveal flex flex-wrap items-center justify-between gap-x-6 gap-y-3" style={{ '--delay': '0ms' } as CSSProperties}>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-semibold tracking-tight">{tool.label}</h1>
            <div className="text-muted-foreground text-sm">{status ?? tool.about}</div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <nav
          ref={nav}
          aria-label={tabsLabel}
          style={{ '--delay': '60ms' } as CSSProperties}
          className="reveal bg-muted/60 w-fit max-w-full overflow-x-auto rounded-xl border p-1 [scrollbar-width:none]"
        >
          <div className="relative flex items-center gap-0.5">
            <span ref={pill} aria-hidden="true" className="tab-pill" data-still="" />
            {tabs}
          </div>
        </nav>
      </div>

      {/* Not keyed by the open view: remounting would reload the overlay preview on every tab switch. */}
      <main className={cn(CONTAINER, 'reveal flex-1 py-6')} style={{ '--delay': '100ms' } as CSSProperties}>
        {children}
      </main>

      {dock}
    </div>
  );
}

interface TabProps {
  current: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** One of the page's views, a segment of the bar under the title. The pill behind the open one slides to it. */
export function Tab({ current, onSelect, children }: TabProps) {
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={onSelect}
      className={cn(
        'text-muted-foreground hover:text-foreground relative flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-[280ms] ease-(--ease-drawer) focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10',
        current && 'text-foreground',
      )}
    >
      {children}
    </button>
  );
}

interface SplitProps {
  /** The narrow column: settings beside a preview, or details beside a list. */
  side: ReactNode;
  sideLabel: string;
  /** Which edge the narrow column sits on from laptop width up. Phones stack the wide column first. */
  sidePosition?: 'start' | 'end';
  /** The column that stays on screen while the other scrolls. */
  pinned?: 'side' | 'main';
  children: ReactNode;
}

const PIN = 'lg:sticky lg:top-16 lg:max-h-[calc(100svh-5rem)] lg:self-start lg:overflow-y-auto';

/** Two columns from laptop width up: a wide one (children) and a narrow one (side); stacked on smaller screens. */
export function Split({ side, sideLabel, sidePosition = 'end', pinned = 'side', children }: SplitProps) {
  const start = sidePosition === 'start';
  return (
    <div
      className={cn(
        'grid gap-6 lg:gap-8',
        start
          ? 'lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:grid-cols-[minmax(0,1fr)_420px]',
      )}
    >
      {/* Source order follows the desktop order (for the keyboard); on phones the side drops under the wide column. */}
      {start ? (
        <section aria-label={sideLabel} className={cn('order-2 flex min-w-0 flex-col gap-4 lg:order-none', pinned === 'side' && PIN)}>
          {side}
        </section>
      ) : null}
      <div className={cn('flex min-w-0 flex-col gap-4', pinned === 'main' && PIN)}>{children}</div>
      {start ? null : (
        <section aria-label={sideLabel} className={cn('flex min-w-0 flex-col gap-4', pinned === 'side' && PIN)}>
          {side}
        </section>
      )}
    </div>
  );
}

interface RevealProps {
  /** Changes when the content does (the open tab): the new content rises in. */
  id: string;
  className?: string;
  children: ReactNode;
}

/** Content that rises in when it changes, so switching tabs moves instead of jumping. */
export function Reveal({ id, className, children }: RevealProps) {
  return (
    <div key={id} data-swap="" className={cn('reveal', className)}>
      {children}
    </div>
  );
}
