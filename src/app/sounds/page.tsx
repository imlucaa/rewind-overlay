import type { Metadata } from 'next';
import { SoundsApp } from '@/components/sounds/SoundsApp';

export const metadata: Metadata = {
  title: 'Sounds',
  description: 'Replace Mario Kart Wii’s trick, boost and other sounds in revo_kart.brsar with your own audio, in the browser.',
};

export default function SoundsPage() {
  return <SoundsApp />;
}
