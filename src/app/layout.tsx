import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/styles/site.css';
import '@/styles/music.css';
import { themeBootScript } from '@/lib/siteTheme';

export const metadata: Metadata = {
  title: { default: 'Overlay', template: '%s · Overlay' },
  description: 'Retro Rewind VR and RR Lounge MMR overlay for OBS, and a music pack maker, in the browser.',
};

export const viewport: Viewport = { themeColor: '#09090b' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script changes <html> before React loads, so its attributes differ from the server copy on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
