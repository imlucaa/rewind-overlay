import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yaz0Decode, yaz0Encode } from './yaz0.ts';
import { readU8, writeU8, type U8Node } from './u8.ts';

test('yaz0 decodes a hand-made file: 3 literals, then a copy of 6 from 3 back', () => {
  const file = Uint8Array.from([0x59, 0x61, 0x7a, 0x30, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0b11100000, 65, 66, 67, 0x40, 0x02]);
  assert.equal(new TextDecoder().decode(yaz0Decode(file)), 'ABCABCABC');
});

test('yaz0 round trips, and shrinks repeated data', () => {
  const random = Uint8Array.from({ length: 5000 }, (_, i) => (Math.imul(i, 2654435761) >>> 24) & 0xff);
  const repeated = new Uint8Array(20000).map((_, i) => i % 7 === 0 ? 1 : i % 300);
  for (const data of [random, repeated, new Uint8Array(0), Uint8Array.from([1, 2])]) assert.deepEqual(yaz0Decode(yaz0Encode(data)), data);
  assert.ok(yaz0Encode(repeated).length < repeated.length / 4);
});

test('u8 round trips folders and files, keeping their order', () => {
  const nodes: U8Node[] = [
    { name: '', path: '', dir: true, data: null, parent: 0, end: 5 },
    { name: '.', path: '.', dir: true, data: null, parent: 0, end: 5 },
    { name: 'ItemSlot.bin', path: './ItemSlot.bin', dir: false, data: Uint8Array.from([1, 2, 3]), parent: 0, end: 0 },
    { name: 'sub', path: './sub', dir: true, data: null, parent: 1, end: 5 },
    { name: 'a.brres', path: './sub/a.brres', dir: false, data: new Uint8Array(70).fill(9), parent: 0, end: 0 },
  ];
  const written = writeU8(nodes);
  const read = readU8(written);
  assert.deepEqual(read, nodes);
  assert.deepEqual(writeU8(read), written);
});
