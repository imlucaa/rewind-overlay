// BREFT, the textures of a BREFF (Effect/RKRace.breft in common.szs). Same frame as a BREFF: 0x18 holds the offset
// from 0x18 to the table (u32 size, u16 count, u16 pad, then per texture u16 name length with its NUL, the name, u32
// offset and u32 data size, both from the table's start). Each texture is a 32-byte header (u32 0, u16 width,
// u16 height, u32 data size, u8 GX format, palette and mipmap fields) and its pixel data, packed back to back.
// Checked against Mario Kart Wii's RKRace.breft (no palettes or mipmaps there).

import { dataSize } from './gx.ts';

const HEADER = 0x20;

export interface Texture {
  name: string;
  width: number;
  height: number;
  format: number;
  /** The 32-byte header as stored, so fields this doesn't change are kept. */
  header: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

export interface Breft {
  /** Everything before the table: the file header and the project name. */
  head: Uint8Array<ArrayBuffer>;
  tableSize: number;
  textures: Texture[];
}

export function readBreft(file: Uint8Array): Breft {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (file.length < 0x40 || view.getUint32(0) !== 0x52454654) throw new Error('Not a BREFT file.');
  const table = 0x18 + view.getUint32(0x18);
  const count = view.getUint16(table + 4);
  const textures: Texture[] = [];
  let at = table + 8;
  for (let i = 0; i < count; i++) {
    const nameLength = view.getUint16(at);
    const name = new TextDecoder('latin1').decode(file.subarray(at + 2, at + 1 + nameLength));
    const start = table + view.getUint32(at + 2 + nameLength);
    const size = view.getUint32(at + 6 + nameLength);
    at += 10 + nameLength;
    if (start + HEADER + size > file.length) throw new Error(`${name} runs past the end of the file.`);
    textures.push({
      name,
      width: view.getUint16(start + 4),
      height: view.getUint16(start + 6),
      format: file[start + 12],
      header: file.slice(start, start + HEADER),
      data: file.slice(start + HEADER, start + HEADER + size),
    });
  }
  return { head: file.slice(0, table), tableSize: view.getUint32(table), textures };
}

/** A new texture in place of one: same name, new size, format and pixels. */
export function replaceTexture(texture: Texture, width: number, height: number, format: number, data: Uint8Array<ArrayBuffer>): Texture {
  if (data.length !== dataSize(format, width, height)) throw new Error('The pixel data doesn’t match the size and format.');
  const header = texture.header.slice();
  const view = new DataView(header.buffer);
  view.setUint16(4, width);
  view.setUint16(6, height);
  view.setUint32(8, data.length);
  header[12] = format;
  return { ...texture, width, height, format, header, data };
}

export function writeBreft({ head, tableSize, textures }: Breft): Uint8Array<ArrayBuffer> {
  const total = head.length + tableSize + textures.reduce((n, t) => n + HEADER + t.data.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(head);
  view.setUint32(8, total);
  view.setUint32(0x14, total - 0x18);
  const table = head.length;
  view.setUint32(table, tableSize);
  view.setUint16(table + 4, textures.length);
  let at = table + 8;
  let offset = tableSize;
  for (const texture of textures) {
    const name = new TextEncoder().encode(texture.name);
    view.setUint16(at, name.length + 1);
    out.set(name, at + 2);
    view.setUint32(at + 3 + name.length, offset);
    view.setUint32(at + 7 + name.length, texture.data.length);
    at += 11 + name.length;
    out.set(texture.header, table + offset);
    out.set(texture.data, table + offset + HEADER);
    offset += HEADER + texture.data.length;
  }
  if (at > table + tableSize) throw new Error('The texture names don’t fit the table.');
  return out;
}
