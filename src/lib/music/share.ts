// A pack's track choices in a link (music-pack/#pack=...): the assignments file, compressed, so someone else can
// open the same choices. The songs aren't in it; the other person's songs are matched by file name and size.

const PREFIX = '#pack=';

async function squeeze(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (code: string): Uint8Array => {
  const text = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(text, c => c.charCodeAt(0));
};

/** The link for an assignments file's text. */
export async function shareLink(packFileText: string, pageUrl: string): Promise<string> {
  const packed = await squeeze(new TextEncoder().encode(packFileText), new CompressionStream('deflate-raw'));
  return pageUrl.split('#')[0] + PREFIX + toBase64Url(packed);
}

/** The assignments file's text from a page address, or null when it has no shared pack. */
export async function readShareLink(hash: string): Promise<string | null> {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const bytes = await squeeze(fromBase64Url(hash.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(bytes);
  } catch {
    throw new Error('That share link is broken or cut short.');
  }
}
