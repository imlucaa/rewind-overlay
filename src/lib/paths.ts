// The site is served under a base path on GitHub Pages (/rewind-overlay). Static files in public/ need it added.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const asset = (path: string): string => `${BASE_PATH}/${path.replace(/^\//, '')}`;

/** The site's root address, e.g. https://imlucaa.github.io/rewind-overlay/. Browser only. */
export const siteRoot = (): string => `${location.origin}${BASE_PATH}/`;
