import type { NextConfig } from 'next';

// GitHub Pages serves the site from /rewind-overlay/. BASE_PATH='' builds it for a root domain or local preview.
const basePath = process.env.BASE_PATH ?? '/rewind-overlay';

const config: NextConfig = {
  output: 'export',
  basePath,
  // music-pack/ becomes music-pack/index.html, so a refresh on GitHub Pages finds the page.
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default config;
