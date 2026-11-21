import { AudioLinesIcon, GlobeIcon, MonitorPlayIcon, MusicIcon, PaletteIcon, SmilePlusIcon } from 'lucide-react';

// The tools. Icons say what each one makes: a stream overlay, music, colors, sound effects; then the rooms and rankings.
export const TOOLS = [
  { href: '/', label: 'Overlay', icon: MonitorPlayIcon, about: 'VR and MMR overlay for OBS' },
  { href: '/music-pack/', label: 'Music Pack', icon: MusicIcon, about: 'Swap the race music for your own songs' },
  { href: '/common-szs/', label: 'common.szs', icon: PaletteIcon, about: 'Recolor drifts, boosts and other effects' },
  { href: '/sounds/', label: 'Sounds', icon: AudioLinesIcon, about: 'Swap the trick, boost and other sounds' },
  { href: '/rooms/', label: 'Rooms', icon: GlobeIcon, about: 'Live rooms, the leaderboard and player profiles' },
  { href: '/mii-creator/', label: 'Mii Creator', icon: SmilePlusIcon, about: 'Make or edit a Wii Mii and download it' },
] as const;

/** The tool a path belongs to (the overlay for anything else). */
export function toolFor(path: string) {
  return TOOLS.find(t => (t.href === '/' ? path === '/' : path.startsWith(t.href.replace(/\/$/, '')))) ?? TOOLS[0];
}
