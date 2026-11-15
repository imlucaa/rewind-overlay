// U8, the archive inside a .szs: a 32-byte header, a flat list of 12-byte nodes (the first is the root folder), the
// names, then the file data. A folder node holds its parent's index and the index just past its last node, so the
// tree is the node order. Files are kept in that order when the archive is written again; only their data changes.

const MAGIC = 0x55aa382d;
const HEADER_SIZE = 0x20;
const ALIGN = 0x20;

export interface U8Node {
  name: string;
  /** Folder names joined with "/", without the root. */
  path: string;
  dir: boolean;
  /** A file's bytes; null for a folder. */
  data: Uint8Array<ArrayBuffer> | null;
  /** For a folder: its parent's index and the index just past its last node. */
  parent: number;
  end: number;
}

const align = (n: number) => Math.ceil(n / ALIGN) * ALIGN;

export function readU8(buf: Uint8Array): U8Node[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < HEADER_SIZE || view.getUint32(0) !== MAGIC) throw new Error('Not a U8 archive.');
  const root = view.getUint32(4);
  const count = view.getUint32(root + 8);
  if (root + count * 12 > buf.length) throw new Error('The archive is damaged: its file list runs past the end.');
  const strings = root + count * 12;
  const name = (offset: number) => {
    let end = strings + offset;
    while (end < buf.length && buf[end] !== 0) end++;
    return new TextDecoder('latin1').decode(buf.subarray(strings + offset, end));
  };
  const nodes: U8Node[] = [];
  // Open folders: their path and the index where they end.
  const open: { path: string; end: number }[] = [];
  for (let i = 0; i < count; i++) {
    const at = root + i * 12;
    const dir = buf[at] === 1;
    const nodeName = name(view.getUint32(at) & 0xffffff);
    const a = view.getUint32(at + 4);
    const b = view.getUint32(at + 8);
    while (open.length && open[open.length - 1].end <= i) open.pop();
    const parentPath = open.length ? open[open.length - 1].path : '';
    const path = i === 0 ? '' : parentPath ? `${parentPath}/${nodeName}` : nodeName;
    if (!dir && a + b > buf.length) throw new Error(`The archive is damaged: ${path} runs past the end.`);
    nodes.push({ name: nodeName, path, dir, data: dir ? null : buf.slice(a, a + b), parent: dir ? a : 0, end: dir ? b : 0 });
    if (dir) open.push({ path, end: b });
  }
  return nodes;
}

export function writeU8(nodes: readonly U8Node[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const nameOffsets: number[] = [];
  const names: Uint8Array[] = [];
  let stringsSize = 0;
  for (const node of nodes) {
    nameOffsets.push(stringsSize);
    const bytes = encoder.encode(node.name);
    names.push(bytes);
    stringsSize += bytes.length + 1;
  }
  const headerSize = nodes.length * 12 + stringsSize;
  const dataStart = align(HEADER_SIZE + headerSize);
  const fileOffsets: number[] = [];
  let end = dataStart;
  for (const node of nodes) {
    fileOffsets.push(end);
    if (node.data) end = align(end + node.data.length);
  }
  const out = new Uint8Array(end);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC);
  view.setUint32(4, HEADER_SIZE);
  view.setUint32(8, headerSize);
  view.setUint32(12, dataStart);
  const strings = HEADER_SIZE + nodes.length * 12;
  nodes.forEach((node, i) => {
    const at = HEADER_SIZE + i * 12;
    view.setUint32(at, ((node.dir ? 1 : 0) << 24) | nameOffsets[i]);
    view.setUint32(at + 4, node.dir ? node.parent : fileOffsets[i]);
    view.setUint32(at + 8, node.dir ? node.end : node.data!.length);
    out.set(names[i], strings + nameOffsets[i]);
    if (node.data) out.set(node.data, fileOffsets[i]);
  });
  return out;
}
