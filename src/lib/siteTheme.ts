// The site's own look (not the overlay's): colour theme, accent and font. Kept in localStorage and put on <html>
// before the page draws (see layout.tsx), so a reload doesn't flash the default look.

export const THEME_KEY = 'rewind-site-theme';

export type ThemeName = 'dark' | 'light' | 'midnight' | 'grape' | 'custom';

/** The colours picked for the Custom theme. */
export interface CustomColors {
  bg: string;
  surface: string;
  text: string;
}
export type FontChoice = 'general' | 'inter' | 'system' | 'google' | 'file';
export type IntroName = 'zoom' | 'slide' | 'reveal' | 'fade' | 'off';
export type MotionChoice = 'system' | 'full' | 'reduced';

export interface SiteTheme {
  theme: ThemeName;
  custom: CustomColors;
  /** The Custom theme's CSS variables, worked out from `custom` when it changes (the head script applies these). */
  vars: Record<string, string>;
  /** #rrggbb, or null for the theme's own. */
  accent: string | null;
  font: FontChoice;
  /** A Google Fonts family name, for font 'google'. */
  googleFont: string;
  /** The uploaded font, as a data: URL, for font 'file'. */
  fontFile: string;
  fontFileName: string;
  /** How the site appears when it opens. */
  intro: IntroName;
  /** Less space: tighter rows, hints only on hover. */
  compact: boolean;
  /** How much moves: as the system says (reduce motion setting), everything, or nothing. */
  motion: MotionChoice;
}

export const THEMES: readonly (readonly [ThemeName, string])[] = [
  ['dark', 'Dark'],
  ['light', 'Light'],
  ['midnight', 'Midnight'],
  ['grape', 'Grape'],
  ['custom', 'Custom…'],
];

export const INTROS: readonly (readonly [IntroName, string])[] = [
  ['zoom', 'Zoom in'],
  ['slide', 'Slide in'],
  ['reveal', 'Wipe down'],
  ['fade', 'Fade in'],
  ['off', 'None'],
];

export const MOTIONS: readonly (readonly [MotionChoice, string])[] = [
  ['system', 'Like my system'],
  ['full', 'All animations'],
  ['reduced', 'Less movement'],
];

/** How long the longest opening animation runs, delays included; data-intro comes off after this. */
const INTRO_MS = 1400;
let introTimer: ReturnType<typeof setTimeout> | undefined;

/** Plays an opening animation again (the Site look play button). */
export function playIntro(name: IntroName): void {
  const root = document.documentElement;
  clearTimeout(introTimer);
  delete root.dataset.intro;
  if (name === 'off') return;
  void root.offsetWidth; // let the browser see it gone, so the animation starts over
  root.dataset.intro = name;
  introTimer = setTimeout(() => delete root.dataset.intro, INTRO_MS);
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Mixes two #rrggbb colours: `amount` 0 is a, 1 is b. */
function mix(a: string, b: string, amount: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((x >> shift) & 255) * (1 - amount) + ((y >> shift) & 255) * amount).toString(16).padStart(2, '0');
  return '#' + channel(16) + channel(8) + channel(0);
}

const isLight = (hex: string): boolean => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
};

/** Every colour the site uses, from the three picked ones: lines, hovers and quieter text sit between them. */
export function customVars(c: CustomColors): Record<string, string> {
  return {
    '--bg': c.bg,
    '--surface': c.surface,
    '--hover': mix(c.surface, c.text, 0.06),
    '--line': mix(c.surface, c.text, 0.1),
    '--line-strong': mix(c.surface, c.text, 0.17),
    '--text': c.text,
    '--muted': mix(c.text, c.bg, 0.35),
    '--soft': mix(c.text, c.bg, 0.55),
    '--accent': c.text,
    '--accent-ink': c.bg,
    'color-scheme': isLight(c.bg) ? 'light' : 'dark',
  };
}

const DEFAULT_CUSTOM: CustomColors = { bg: '#0a0a0b', surface: '#111113', text: '#ededef' };

export const FONTS: readonly (readonly [FontChoice, string])[] = [
  ['general', 'General Sans'],
  ['inter', 'Inter'],
  ['system', 'System font'],
  ['google', 'Google Fonts…'],
  ['file', 'Your font file…'],
];

/** Font files are kept in localStorage, which holds about 5 MB per site. */
export const MAX_FONT_BYTES = 1.5 * 1024 * 1024;

export const defaultTheme = (): SiteTheme => ({
  theme: 'dark', custom: { ...DEFAULT_CUSTOM }, vars: customVars(DEFAULT_CUSTOM), accent: null, font: 'general', googleFont: '', fontFile: '', fontFileName: '', intro: 'zoom', compact: false, motion: 'system',
});

export function parseTheme(text: string | null): SiteTheme {
  const out = defaultTheme();
  try {
    const raw = text ? JSON.parse(text) : null;
    if (!raw || typeof raw !== 'object') return out;
    if (THEMES.some(([t]) => t === raw.theme)) out.theme = raw.theme;
    if (raw.custom && typeof raw.custom === 'object') {
      const c = raw.custom as Record<string, unknown>;
      out.custom = {
        bg: typeof c.bg === 'string' && HEX.test(c.bg) ? c.bg : DEFAULT_CUSTOM.bg,
        surface: typeof c.surface === 'string' && HEX.test(c.surface) ? c.surface : DEFAULT_CUSTOM.surface,
        text: typeof c.text === 'string' && HEX.test(c.text) ? c.text : DEFAULT_CUSTOM.text,
      };
      out.vars = customVars(out.custom);
    }
    if (typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent)) out.accent = raw.accent;
    if (FONTS.some(([f]) => f === raw.font)) out.font = raw.font;
    if (typeof raw.googleFont === 'string') out.googleFont = raw.googleFont.slice(0, 60);
    if (typeof raw.fontFile === 'string' && raw.fontFile.startsWith('data:')) out.fontFile = raw.fontFile;
    if (typeof raw.fontFileName === 'string') out.fontFileName = raw.fontFileName.slice(0, 120);
    if (INTROS.some(([i]) => i === raw.intro)) out.intro = raw.intro;
    out.compact = raw.compact === true;
    if (MOTIONS.some(([m]) => m === raw.motion)) out.motion = raw.motion;
  } catch {
    // damaged: the default look
  }
  return out;
}

/**
 * Puts a theme on the page. Self-contained (no imports, no outer names) because its source is also inlined into
 * the page head to run before first paint.
 */
export function applyTheme(t: SiteTheme): void {
  const root = document.documentElement;
  root.dataset.theme = t.theme;
  if (t.compact) root.dataset.compact = '';
  else delete root.dataset.compact;
  if (t.motion === 'full' || t.motion === 'reduced') root.dataset.motion = t.motion;
  else delete root.dataset.motion;
  for (const [name, value] of Object.entries(t.vars ?? {})) {
    if (t.theme === 'custom') root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
  if (t.accent) {
    const n = parseInt(t.accent.slice(1), 16);
    const light = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-ink', light ? '#0a0a0b' : '#ffffff');
  } else if (t.theme !== 'custom') {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-ink');
  }
  const linkId = 'site-font-link';
  const old = document.getElementById(linkId);
  const family =
    t.font === 'inter' ? 'Inter' : t.font === 'google' ? t.googleFont.trim() : t.font === 'file' && t.fontFile ? 'Site custom font' : '';
  const remote = t.font === 'inter' || (t.font === 'google' && family);
  if (remote) {
    const href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@400;500;600&display=swap';
    if (!old || old.getAttribute('href') !== href) {
      old?.remove();
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  } else old?.remove();
  if (t.font === 'file' && t.fontFile) {
    const face = new FontFace('Site custom font', 'url(' + t.fontFile + ')');
    face.load().then(f => document.fonts.add(f)).catch(() => undefined);
  }
  if (t.font === 'system') root.style.setProperty('--font', 'system-ui, "Segoe UI", sans-serif');
  else if (family) root.style.setProperty('--font', '"' + family.replace(/"/g, '') + '", "General Sans", system-ui, sans-serif');
  else root.style.removeProperty('--font');
}

/**
 * Runs in the page head, before anything draws: the saved theme, accent and font family. Font files and Google
 * Fonts load once the page script runs applyTheme. Kept tiny and hand-written, as it's inlined as text.
 */
export const themeBootScript = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)})||"{}"),r=document.documentElement;if(t.compact===true)r.dataset.compact="";if(/^(full|reduced)$/.test(t.motion))r.dataset.motion=t.motion;if(/^(light|midnight|grape|custom)$/.test(t.theme))r.dataset.theme=t.theme;if(t.theme==="custom"&&t.vars)for(var k in t.vars){var v=String(t.vars[k]);if(/^(--[a-z-]+|color-scheme)$/.test(k)&&/^(#[0-9a-f]{6}|light|dark)$/i.test(v))r.style.setProperty(k,v)}if(/^#[0-9a-f]{6}$/i.test(t.accent||"")){var n=parseInt(t.accent.slice(1),16);r.style.setProperty("--accent",t.accent);r.style.setProperty("--accent-ink",.299*(n>>16)+.587*(n>>8&255)+.114*(n&255)>150?"#0a0a0b":"#ffffff")}var f=t.font==="inter"?"Inter":t.font==="google"?String(t.googleFont||"").trim():t.font==="file"&&t.fontFile?"Site custom font":"";if(t.font==="system")r.style.setProperty("--font","system-ui, sans-serif");else if(f)r.style.setProperty("--font",'"'+f.replace(/"/g,"")+'", "General Sans", system-ui, sans-serif');var i=/^(slide|reveal|fade|off)$/.test(t.intro)?t.intro:"zoom";if(i!=="off"){r.dataset.intro=i;setTimeout(function(){delete r.dataset.intro},${INTRO_MS})}}catch(e){}`;
