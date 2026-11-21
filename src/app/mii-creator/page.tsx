import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MiiCreatorApp } from '@/components/mii/MiiCreatorApp';

export const metadata: Metadata = {
  title: 'Mii Creator',
  description: 'Make or edit a Wii Mii in the browser, like Wheel Wizard’s Mii editor, and download it as a .mii file.',
};

export default function MiiCreatorPage() {
  // The creator reads ?fc= (a player's friend code) to open their Mii.
  return (
    <Suspense>
      <MiiCreatorApp />
    </Suspense>
  );
}
