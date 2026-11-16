import type { Metadata } from 'next';
import { SoundsApp } from '@/components/sounds/SoundsApp';

export const metadata: Metadata = {
  title: 'Sounds',
  description: 'Replace Mario Kart Wii’s sound effects in revo_kart.brsar with your own audio, in the browser.',
};

export default function SoundsPage() {
  return <SoundsApp />;
}
