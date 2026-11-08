'use client';

import { useEffect, useRef, useState } from 'react';
import { useStoredState } from '@/hooks/useStoredState';
import {
  FONTS, INTROS, MAX_FONT_BYTES, THEMES, THEME_KEY, applyTheme, customVars, defaultTheme, parseTheme, playIntro, type CustomColors,
  type SiteTheme,
} from '@/lib/siteTheme';
import { ColorField, Select } from '@/components/ui/controls';

/** "Site look" at the bottom of the sidebar: the site's theme, accent colour and font. */
export function SiteLook() {
  const [theme, setTheme] = useStoredState<SiteTheme>(THEME_KEY, parseTheme, defaultTheme);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [fontDraft, setFontDraft] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const set = (patch: Partial<SiteTheme>) => setTheme(t => ({ ...t, ...patch }));
  const setCustom = (patch: Partial<CustomColors>) =>
    setTheme(t => {
      const custom = { ...t.custom, ...patch };
      return { ...t, theme: 'custom', custom, vars: customVars(custom) };
    });

  const loadFile = async (f: File) => {
    if (f.size > MAX_FONT_BYTES) return setMessage('That font is over 1.5 MB, too big to keep in the browser. Try a .woff2.');
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
    try {
      await new FontFace('Site font check', `url(${data})`).load();
    } catch {
      return setMessage('That file isn’t a font this browser can use (try .ttf, .otf, .woff or .woff2).');
    }
    try {
      set({ font: 'file', fontFile: data, fontFileName: f.name });
      setMessage(`Using ${f.name}.`);
    } catch {
      setMessage('The browser wouldn’t store that font (storage full?).');
    }
  };

  return (
    <div className="site-look" ref={root}>
      <button type="button" className="site-look-button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" />
        </svg>
        Site look
      </button>
      {open ? (
        <div className="site-look-panel" role="dialog" aria-label="Site look">
          <label>
            <span>Theme</span>
            <Select label="Theme" value={theme.theme} options={THEMES} onChange={v => set({ theme: v })} />
          </label>
          {theme.theme === 'custom' ? (
            <div className="site-look-custom">
              {(
                [
                  ['bg', 'Background'],
                  ['surface', 'Panels'],
                  ['text', 'Text'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <ColorField label={label} value={theme.custom[key]} onChange={v => setCustom({ [key]: v })} />
                </label>
              ))}
            </div>
          ) : null}
          <label>
            <span>Accent</span>
            <div className="site-look-accent">
              <ColorField label="Accent colour" value={theme.accent ?? (theme.theme === 'custom' ? theme.custom.text : ({ light: '#18181b', midnight: '#7aa2ff', grape: '#c084fc' } as Record<string, string>)[theme.theme] ?? '#fafafa')} onChange={v => set({ accent: v })} />
              <button className="link-button" type="button" disabled={!theme.accent} onClick={() => set({ accent: null })}>
                Theme’s own
              </button>
            </div>
          </label>
          <label>
            <span>Font</span>
            <Select
              label="Font"
              value={theme.font}
              options={FONTS}
              onChange={v => {
                setMessage('');
                if (v === 'file' && !theme.fontFile) file.current?.click();
                else set({ font: v });
              }}
            />
          </label>
          {theme.font === 'google' ? (
            <form
              className="site-look-row"
              onSubmit={e => {
                e.preventDefault();
                set({ googleFont: (fontDraft ?? theme.googleFont).trim() });
                setFontDraft(null);
              }}
            >
              <input
                type="text"
                aria-label="Google Fonts name"
                placeholder="e.g. Rubik, Nunito, Poppins"
                value={fontDraft ?? theme.googleFont}
                onChange={e => setFontDraft(e.target.value)}
              />
              <button className="button" type="submit">
                Use
              </button>
            </form>
          ) : null}
          {theme.font === 'file' ? (
            <div className="site-look-row">
              <small>{theme.fontFileName || 'No file yet'}</small>
              <button className="button" type="button" onClick={() => file.current?.click()}>
                Choose file
              </button>
            </div>
          ) : null}
          <input
            ref={file}
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/*"
            hidden
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void loadFile(f);
            }}
          />
          <label>
            <span>Opening animation</span>
            <div className="site-look-row">
              <Select
                label="Opening animation"
                value={theme.intro}
                options={INTROS}
                onChange={v => {
                  set({ intro: v });
                  playIntro(v);
                }}
              />
              <button className="button" type="button" disabled={theme.intro === 'off'} onClick={() => playIntro(theme.intro)}>
                ▶ Preview
              </button>
            </div>
          </label>
          {message ? <p className="note">{message}</p> : null}
          <button
            className="link-button"
            type="button"
            onClick={() => {
              setTheme(defaultTheme());
              setMessage('');
            }}
          >
            Reset site look
          </button>
        </div>
      ) : null}
    </div>
  );
}
