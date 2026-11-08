// A minimal ZIP writer (stored, no compression: BRSTM audio barely compresses). Each file goes into a Blob as soon
// as it's added, so a pack of hundreds of songs never sits in memory as one buffer (browsers keep big Blobs on disk).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): [time: number, day: number] {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time, day];
}

export class ZipWriter {
  private readonly parts: Blob[] = [];
  private readonly central: Uint8Array[] = [];
  private readonly time: number;
  private readonly day: number;
  private offset = 0;
  private count = 0;

  constructor(date = new Date()) {
    [this.time, this.day] = dosDateTime(date);
  }

  add(path: string, data: Uint8Array): void {
    const name = new TextEncoder().encode(path);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // version needed
    l.setUint16(6, 0x0800, true); // UTF-8 names
    l.setUint16(8, 0, true); // stored
    l.setUint16(10, this.time, true);
    l.setUint16(12, this.day, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    this.parts.push(new Blob([local, data as Uint8Array<ArrayBuffer>]));

    const record = new Uint8Array(46 + name.length);
    const c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(12, this.time, true);
    c.setUint16(14, this.day, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, this.offset, true);
    record.set(name, 46);
    this.central.push(record);
    this.offset += local.length + data.length;
    this.count++;
  }

  get size(): number {
    return this.count;
  }

  blob(): Blob {
    const centralSize = this.central.reduce((n, r) => n + r.length, 0);
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, this.count, true);
    e.setUint16(10, this.count, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...(this.central as Uint8Array<ArrayBuffer>[]), end], { type: 'application/zip' });
  }
}
