// shortcut: Next 16.4's static export writes route segment prefetch data as `__next.<segment>/<file>.txt`, while
// its client requests `__next.<segment>.<file>.txt`, so client-side navigation prefetches 404 on a static host.
// This copies each file to the name the client asks for. Remove once Next writes matching names.
import { copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '..', 'out');
let copied = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('__next.'))
      for (const file of await readdir(full, { withFileTypes: true }))
        if (file.isFile()) {
          await copyFile(path.join(full, file.name), path.join(dir, `${entry.name}.${file.name}`));
          copied++;
        }
    await walk(full);
  }
}

await walk(out);
console.log(`flatten-segments: ${copied} prefetch file(s) copied`);
