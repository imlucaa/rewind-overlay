import type { Metadata } from 'next';
import { OnlineApp } from '@/components/online/OnlineApp';

export const metadata: Metadata = {
  title: 'Rooms',
  description: 'Retro Rewind rooms, the VR leaderboard and player profiles, live from rwfc.net.',
};

export default function OnlinePage() {
  return <OnlineApp />;
}
