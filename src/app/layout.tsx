import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { Backdrop } from '@/components/layout/Backdrop';
import { ToolIsland } from '@/components/layout/ToolIsland';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: { default: 'Overlay', template: '%s · Overlay' },
  description: 'Retro Rewind VR and RR Lounge MMR overlay for OBS, a music pack maker and a common.szs editor, in the browser.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class on <html> before React loads, so it differs from the server copy on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <Backdrop />
            <ToolIsland />
            {children}
            {/* On phones toasts span the bottom; lift them over the music player bar. */}
            <Toaster position="bottom-right" mobileOffset={{ bottom: 84 }} />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
