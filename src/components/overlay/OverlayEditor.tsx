'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { AppShell, Tab } from '@/components/layout/AppShell';
import { Row } from '@/components/ui/controls';
import { useStoredState } from '@/hooks/useStoredState';
import { overlayUrl } from '@/lib/overlay/link';
import { SECTIONS } from '@/lib/overlay/sections';
import {
  STORE_KEY, applyStyle, defaults, isComplete, isHud, load, missingMessage, resetLook, setPath, unitLabel, type Settings,
} from '@/lib/overlay/settings';
import { siteRoot } from '@/lib/paths';
import { SettingControl } from './SettingControl';
import { OverlayPreview } from './OverlayPreview';

const noSubscribe = () => () => {};

/** The overlay editor: options on the left, the live overlay on the right, and the link for OBS. */
export function OverlayEditor() {
  const [settings, setSettings, ready] = useStoredState<Settings>(STORE_KEY, load, defaults);
  const [currentTitle, setCurrentTitle] = useState(SECTIONS[0].title);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
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
      setNote('Paste it into an OBS Browser source (1920 × 1080).');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const ms = settings.animations.durationMs;
  const playGain = current.playsGain
    ? { gain: settings.preview.gain, ms, everyMs: isHud(settings) ? 4000 : Math.max(4000, ms + 2800) }
    : null;

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
          <a className="button hide-small" href={url ?? '#'} target="_blank" rel="noopener" aria-disabled={!url}>
            Open
          </a>
          <button className="button primary" type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </>
      }
      asideLabel="Preview"
      aside={
        <>
          <OverlayPreview url={url} emptyMessage={ready ? missingMessage(settings) : ''} playGain={playGain} />
          <p className="note" role="status">
            {note}
          </p>
        </>
      }
    >
      <div className="rows" key={current.title}>
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
              <div key={r.label}>{control}</div>
            ) : (
              <Row key={r.label + r.control.kind + ('path' in r.control ? r.control.path : '')} label={label} hint={r.hint}>
                {control}
              </Row>
            );
          })}
      </div>
      <button className="link-button" type="button" onClick={() => setSettings(resetLook)}>
        Reset look
      </button>
    </AppShell>
  );
}
