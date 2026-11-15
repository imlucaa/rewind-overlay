// Wii (GX) texture formats: pixels are stored in tiles (blocks) of a few rows, left to right, top to bottom; the image
// is padded up to whole tiles. Decoding gives RGBA bytes, row by row, for a canvas.

export const FORMATS: Record<number, { name: string; blockW: number; blockH: number; bits: number }> = {
  0: { name: 'I4', blockW: 8, blockH: 8, bits: 4 },
  1: { name: 'I8', blockW: 8, blockH: 4, bits: 8 },
  2: { name: 'IA4', blockW: 8, blockH: 4, bits: 8 },
  3: { name: 'IA8', blockW: 4, blockH: 4, bits: 16 },
  4: { name: 'RGB565', blockW: 4, blockH: 4, bits: 16 },
  5: { name: 'RGB5A3', blockW: 4, blockH: 4, bits: 16 },
  6: { name: 'RGBA8', blockW: 4, blockH: 4, bits: 32 },
};

export const RGB5A3 = 5;

const roundUp = (n: number, to: number) => Math.ceil(n / to) * to;

/** Bytes of image data for a texture, padded to whole tiles. */
export function dataSize(format: number, width: number, height: number): number {
  const f = FORMATS[format];
  if (!f) throw new Error(`Texture format ${format} isn't supported.`);
  return (roundUp(width, f.blockW) * roundUp(height, f.blockH) * f.bits) / 8;
}

const expand5 = (v: number) => (v << 3) | (v >> 2);
const expand6 = (v: number) => (v << 2) | (v >> 4);
const expand4 = (v: number) => v * 0x11;
const expand3 = (v: number) => (v << 5) | (v << 2) | (v >> 1);

/** Calls `pixel(x, y, i)` for every pixel slot in tile order; i counts pixels from the start of the data. */
function eachTilePixel(format: number, width: number, height: number, pixel: (x: number, y: number, i: number) => void) {
  const { blockW, blockH } = FORMATS[format];
  let i = 0;
  for (let by = 0; by < height; by += blockH)
    for (let bx = 0; bx < width; bx += blockW)
      for (let y = by; y < by + blockH; y++) for (let x = bx; x < bx + blockW; x++) pixel(x, y, i++);
}

export function decodeTexture(format: number, width: number, height: number, data: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
  if (data.length < dataSize(format, width, height)) throw new Error('The texture data is cut short.');
  const out = new Uint8ClampedArray(width * height * 4);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const put = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  };
  if (format === 6) {
    // RGBA8: each 4×4 tile is 32 bytes of AR pairs, then 32 bytes of GB pairs.
    let tile = 0;
    for (let by = 0; by < height; by += 4)
      for (let bx = 0; bx < width; bx += 4, tile += 64)
        for (let p = 0; p < 16; p++) {
          const x = bx + (p % 4);
          const y = by + (p >> 2);
          put(x, y, data[tile + p * 2 + 1], data[tile + 32 + p * 2], data[tile + 32 + p * 2 + 1], data[tile + p * 2]);
        }
    return out;
  }
  eachTilePixel(format, width, height, (x, y, i) => {
    switch (format) {
      case 0: {
        const v = expand4((data[i >> 1] >> (i & 1 ? 0 : 4)) & 0xf);
        return put(x, y, v, v, v, v);
      }
      case 1:
        return put(x, y, data[i], data[i], data[i], data[i]);
      case 2: {
        const a = expand4(data[i] >> 4);
        const v = expand4(data[i] & 0xf);
        return put(x, y, v, v, v, a);
      }
      case 3:
        return put(x, y, data[i * 2 + 1], data[i * 2 + 1], data[i * 2 + 1], data[i * 2]);
      case 4: {
        const v = view.getUint16(i * 2);
        return put(x, y, expand5(v >> 11), expand6((v >> 5) & 0x3f), expand5(v & 0x1f), 255);
      }
      case 5: {
        const v = view.getUint16(i * 2);
        return v & 0x8000
          ? put(x, y, expand5((v >> 10) & 0x1f), expand5((v >> 5) & 0x1f), expand5(v & 0x1f), 255)
          : put(x, y, expand4((v >> 8) & 0xf), expand4((v >> 4) & 0xf), expand4(v & 0xf), expand3((v >> 12) & 7));
      }
    }
  });
  return out;
}

/**
 * RGB5A3 from RGBA pixels: fully opaque pixels get 5 bits per color, see-through ones 4 bits per color and 3 of
 * alpha. Two bytes a pixel.
 */
export function encodeRgb5a3(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(dataSize(RGB5A3, width, height));
  const view = new DataView(out.buffer);
  eachTilePixel(RGB5A3, width, height, (x, y, i) => {
    if (x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    const [r, g, b, a] = [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
    const value = a >= 0xe0 ? 0x8000 | ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3) : ((a >> 5) << 12) | ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    view.setUint16(i * 2, value);
  });
  return out;
}
