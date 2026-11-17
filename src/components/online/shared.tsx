'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { CheckIcon, CopyIcon, DownloadIcon, RefreshCwIcon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SwapIcon } from '@/components/ui/swap-icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { download } from '@/hooks/useExport';
import { useNow, useWatchlist } from '@/hooks/useRwfc';
import { miiBytes, safeFileName, signed, timeAgo } from '@/lib/rwfc/api';
import { ZipWriter } from '@/lib/music/zip';
import { cn } from '@/lib/utils';

/** A player's Mii portrait, or their initial while it loads or when they have none. */
export function PlayerAvatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  return (
    <Avatar className={cn('bg-muted size-9', className)}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className="text-muted-foreground text-xs font-semibold">{[...name.trim()][0]?.toUpperCase() ?? '?'}</AvatarFallback>
    </Avatar>
  );
}

/** Copies `value`, says so in a toast, and turns its icon into a check for a moment. */
export function CopyButton({
  value,
  label,
  children,
  size = 'icon-sm',
}: {
  value: string;
  label: string;
  children?: ReactNode;
  size?: 'icon-sm' | 'sm' | 'xs';
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success(`Copied ${label}`, { description: value });
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('Couldn’t copy', { description: 'Your browser blocked the clipboard. Select the text and copy it instead.' });
    }
  };
  const icon = <SwapIcon active={done} on={<CheckIcon />} off={<CopyIcon />} />;
  if (children)
    return (
      <Button variant="outline" size={size === 'icon-sm' ? 'sm' : size} onClick={copy}>
        {icon}
        {children}
      </Button>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={copy} className="text-muted-foreground">
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy {label}</TooltipContent>
    </Tooltip>
  );
}

/** A VR change: green up, red down, muted at zero. */
export function Gain({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={cn('text-muted-foreground', className)}>–</span>;
  return (
    <span className={cn('tabular-nums', value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-muted-foreground', className)}>
      {signed(value)}
    </span>
  );
}

/** "Updated 20 s ago" and a refresh button that spins while loading. */
export function RefreshBar({
  updatedAt,
  busy,
  onRefresh,
  auto,
}: {
  updatedAt: number;
  busy: boolean;
  onRefresh: () => void;
  auto?: string;
}) {
  const now = useNow();
  const ago = updatedAt && now ? timeAgo(new Date(updatedAt).toISOString(), now) : '';
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
      <span aria-live="polite">
        {ago ? `Updated ${ago}` : busy ? 'Loading' : ''}
        {auto && ago ? `, ${auto}` : ''}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh now" onClick={onRefresh} disabled={busy}>
            <RefreshCwIcon aria-hidden="true" className={cn(busy && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh now</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** A labelled number in a stat strip. */
export function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={hint}>
      <span className="text-muted-foreground text-[13px]">{label}</span>
      <span className="truncate text-xl font-semibold tracking-[-0.01em] tabular-nums">{children}</span>
    </div>
  );
}

// ---------- Mii downloads ----------

/** Saves a player's Mii as <name>.mii (the 74-byte file Mii tools and Dolphin's Mii import read). */
export function saveMii(name: string, base64: string | null | undefined) {
  const bytes = miiBytes(base64);
  if (!bytes) {
    toast.error('No Mii to download', { description: `rwfc.net has no Mii saved for ${name}.` });
    return;
  }
  download(new Blob([bytes], { type: 'application/octet-stream' }), `${safeFileName(name)}.mii`);
  toast.success(`Downloaded ${name}’s Mii`, { description: `${safeFileName(name)}.mii` });
}

/** Every player's Mii in one zip, named after them (repeats get (2), (3)...). Players without one are left out. */
export function saveMiiZip(zipName: string, players: { name: string; mii: string | null | undefined }[]) {
  const zip = new ZipWriter();
  const used = new Map<string, number>();
  let count = 0;
  for (const p of players) {
    const bytes = miiBytes(p.mii);
    if (!bytes) continue;
    const base = safeFileName(p.name);
    const n = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), n);
    zip.add(`${base}${n > 1 ? ` (${n})` : ''}.mii`, bytes);
    count++;
  }
  if (!count) {
    toast.error('No Miis to download', { description: 'None of these players have a Mii saved on rwfc.net.' });
    return;
  }
  download(zip.blob(), `${safeFileName(zipName)}.zip`);
  toast.success(`Downloaded ${count} Mii${count === 1 ? '' : 's'}`, { description: `${safeFileName(zipName)}.zip` });
}

/** An icon button that downloads one player's Mii file. */
export function MiiButton({ name, mii }: { name: string; mii: string | null | undefined }) {
  const has = !!miiBytes(mii);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Download ${name}’s Mii`}
          disabled={!has}
          onClick={e => {
            e.stopPropagation();
            saveMii(name, mii);
          }}
          className="text-muted-foreground"
        >
          <DownloadIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{has ? 'Download Mii (.mii)' : 'No Mii saved for this player'}</TooltipContent>
    </Tooltip>
  );
}

/** The profile's Download Mii button. */
export function MiiActions({ name, mii }: { name: string; mii: string | null | undefined }) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!miiBytes(mii)}
      onClick={() => saveMii(name, mii)}
      title="The .mii file Mii tools and Dolphin can import"
    >
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      Download Mii
    </Button>
  );
}

// ---------- keyboard ----------

/** "/" focuses this search box from anywhere on the page, unless you're already typing somewhere. */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}

/** The "/" key cap shown in an empty search box. */
export function SlashHint() {
  return (
    <kbd className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-sans text-[11px] max-sm:hidden" title="Press / to search">
      /
    </kbd>
  );
}

// ---------- watching ----------

/** A star that adds a player to (or takes them off) your watch list. */
export function WatchButton({ fc, name, size = 'icon-sm' }: { fc: string; name: string; size?: 'icon-sm' | 'sm' }) {
  const { watching, toggle } = useWatchlist();
  const on = watching(fc);
  const press = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle({ fc, name });
    toast(on ? `Stopped watching ${name}` : `Watching ${name}`, {
      description: on ? undefined : 'They’ll show at the top of the Rooms tab whenever they’re in a room.',
    });
  };
  const icon = <StarIcon aria-hidden="true" className={cn(on && 'fill-current')} />;
  if (size === 'sm')
    return (
      <Button variant="outline" size="sm" onClick={press} aria-pressed={on}>
        <StarIcon data-icon="inline-start" aria-hidden="true" className={cn(on && 'fill-current')} />
        {on ? 'Watching' : 'Watch'}
      </Button>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={on ? `Stop watching ${name}` : `Watch ${name}`}
          aria-pressed={on}
          onClick={press}
          className={cn(on ? 'text-foreground' : 'text-muted-foreground')}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{on ? 'Stop watching' : 'Watch: see when they’re online'}</TooltipContent>
    </Tooltip>
  );
}
