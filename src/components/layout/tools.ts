import { MonitorPlayIcon, MusicIcon, PaletteIcon } from 'lucide-react';

// The three tools. Icons say what each one makes: a stream overlay, music, colors.
export const TOOLS = [
  { href: '/', label: 'Overlay', icon: MonitorPlayIcon, about: 'VR and MMR overlay for OBS' },
  { href: '/music-pack/', label: 'Music Pack', icon: MusicIcon, about: 'Swap the race music for your own songs' },
  { href: '/common-szs/', label: 'common.szs', icon: PaletteIcon, about: 'Recolor drifts, boosts and other effects' },
] as const;

/** The tool a path belongs to (the overlay for anything else). */
export function toolFor(path: string) {
  return TOOLS.find(t => (t.href === '/' ? path === '/' : path.startsWith(t.href.replace(/\/$/, '')))) ?? TOOLS[0];
}
