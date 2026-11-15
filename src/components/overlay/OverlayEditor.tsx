'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppShell, Reveal, Split, Tab } from '@/components/layout/AppShell';
import { CheckIcon, ExternalLinkIcon, LinkIcon, PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SwapIcon } from '@/components/ui/swap-icon';
import { Row, Rows, Slider } from '@/components/ui/controls';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStoredState } from '@/hooks/useStoredState';
import { overlayUrl } from '@/lib/overlay/link';
import { SECTIONS } from '@/lib/overlay/sections';
import {
  STORE_KEY,
  applyStyle,
  defaults,
  isComplete,
  isHud,
  load,
  missingMessage,
  resetLook,
  setPath,
  unitLabel,
  type Settings,
} from '@/lib/overlay/settings';
import { siteRoot } from '@/lib/paths';
import { SettingControl } from './SettingControl';
import { BACKDROPS, OverlayPreview, type Backdrop } from './OverlayPreview';

const noSubscribe = () => () => {};

/** The overlay editor: options on the left, the live overlay on the right, and the link for OBS. */
export function OverlayEditor() {
  const [settings, setSettings, ready] = useStoredState<Settings>(STORE_KEY, load, defaults);
  const [currentTitle, setCurrentTitle] = useState(SECTIONS[0].title);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>('grid');
  const playRef = useRef<((gain: number, ms: number) => void) | null>(null);
  const root = useSyncExternalStore(noSubscribe, siteRoot, () => null);

  const sections = useMemo(() => SECTIONS.filter(s => !s.when || s.when(settings)), [settings]);
  const current = sections.find(s => s.title === currentTitle) ?? sections[0];
  const complete = isComplete(settings);
  const url = ready && complete && root ? overlayUrl(settings, root) : null;

  const change = (path: string, value: unknown) => {
    setNote('');
    setSettings(s => setPath(s, path, value));
  };
  const pickBadge = (kind: string) =>
    setSettings(s => {
      const next = setPath(s, 'plus.rankBadge', kind !== 'off');
      return kind === 'off' ? next : setPath(next, 'plus.rankBadgeKind', kind);
    });

  const copy = async () => {
    if (!url) {
      setCurrentTitle(SECTIONS[0].title);
      setNote(missingMessage(settings));
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote('');
      toast.success('Link copied', { description: 'Paste it into an OBS Browser source (1920 × 1080).' });
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const ms = settings.animations.durationMs;
  const playGain = current.playsGain
    ? {
        gain: settings.preview.gain,
        ms,
        everyMs: isHud(settings) ? 4000 : Math.max(4000, ms + 2800),
      }
    : null;

  const settingsPanel = (
    <Reveal id={current.title} className="flex flex-col gap-4">
      <h2 className="sr-only">{current.title}</h2>
      <Rows key={current.title}>
        {current.rows
          .filter(r => !r.when || r.when(settings))
          .map(r => {
            const label = unitLabel(settings, r.label);
            const control = (
              <SettingControl
                control={r.control}
                label={label}
                settings={settings}
                onChange={change}
                onBadge={pickBadge}
                onStyle={style => setSettings(s => applyStyle(s, style))}
              />
            );
            return r.control.kind === 'style' ? (
              <div key={r.label} className="py-3">
                {control}
              </div>
            ) : (
              <Row
                key={r.label + r.control.kind + ('path' in r.control ? r.control.path : '')}
                label={label}
                hint={r.hint && unitLabel(settings, r.hint)}
              >
                {control}
              </Row>
            );
          })}
      </Rows>
      <Button variant="link" className="text-muted-foreground self-start px-0" onClick={() => setSettings(resetLook)}>
        Reset look
      </Button>
    </Reveal>
  );

  return (
    <AppShell
      tabsLabel="Settings"
      tabs={sections.map(s => (
        <Tab key={s.title} current={s === current} onSelect={() => setCurrentTitle(s.title)}>
          {s.title}
        </Tab>
      ))}
      actions={
        <>
          {url ? (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noopener">
                <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                Open overlay
              </a>
            </Button>
          ) : null}
          <Button onClick={copy}>
            <SwapIcon active={copied} on={<CheckIcon />} off={<LinkIcon />} />
            {copied ? 'Copied' : 'Copy link for OBS'}
          </Button>
        </>
      }
    >
      <Split side={settingsPanel} sideLabel="Settings" sidePosition="start" pinned="main">
        {/* The stage: the overlay as OBS will show it, with the race test right under it. */}
        <OverlayPreview url={url} emptyMessage={ready ? missingMessage(settings) : ''} playGain={playGain} playRef={playRef} backdrop={backdrop} />
        {/* The preview already says what's missing, so only other notes show here. */}
        <p className="text-muted-foreground text-sm empty:hidden" role="status">
          {url ? note : ''}
        </p>
        {url ? (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <h2 className="text-sm font-medium">Test race</h2>
                <p className="text-muted-foreground text-xs">{unitLabel(settings, 'Play a race result on the preview')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[25, 100, 300, -40].map(g => (
                  <Button
                    key={g}
                    variant="outline"
                    size="sm"
                    className="tabular-nums"
                    aria-label={`Play a ${g > 0 ? '+' + g : '−' + -g} result`}
                    onClick={() => {
                      change('preview.gain', g);
                      playRef.current?.(g, ms);
                    }}
                  >
                    {g > 0 ? '+' + g : '−' + -g}
                  </Button>
                ))}
                <Button size="sm" onClick={() => playRef.current?.(settings.preview.gain, ms)}>
                  <PlayIcon data-icon="inline-start" aria-hidden="true" />
                  Play again
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <Slider
                label={unitLabel(settings, 'VR gained')}
                value={settings.preview.gain}
                min={-100}
                max={300}
                step={1}
                unit={unitLabel(settings, ' VR')}
                onChange={v => change('preview.gain', v)}
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Background (preview only)</span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={backdrop}
                  onValueChange={v => v && setBackdrop(v as Backdrop)}
                  aria-label="Preview background"
                >
                  {BACKDROPS.map(([v, text]) => (
                    <ToggleGroupItem key={v} value={v}>
                      {text}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </div>
        ) : null}
      </Split>
    </AppShell>
  );
}
