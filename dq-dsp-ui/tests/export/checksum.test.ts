/**
 * CRC-32 golden tests — web UI checksum.ts vs firmware crc32_ieee.
 *
 * The vectors below are the SAME ones pinned by the firmware host test
 * `dq-dsp-firmware/tests/golden_crc.c`. Keeping both in sync guarantees the
 * web UI and firmware compute identical CRCs (used for config integrity).
 *
 * Run with: npx vitest run tests/export/checksum.test.ts
 */

import { describe, it, expect } from 'vitest';
import { crc32 } from '../../src/export/checksum';

const enc = (s: string) => new TextEncoder().encode(s);

describe('crc32 (IEEE 802.3)', () => {
  it('matches canonical check value CRC("123456789") == 0xCBF43926', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
  });

  it('empty input == 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('single byte "a"', () => {
    expect(crc32(enc('a'))).toBe(0xe8b7be43);
  });

  it('"abc"', () => {
    expect(crc32(enc('abc'))).toBe(0x352441c2);
  });

  it('binary blob', () => {
    const blob = new Uint8Array([0x00, 0xff, 0x10, 0x01, 0x80, 0x7f, 0x00, 0x11]);
    expect(crc32(blob)).toBe(0x11e607d6);
  });

  it('0x00..0xFF block', () => {
    const big = new Uint8Array(256);
    for (let i = 0; i < 256; i++) big[i] = i;
    expect(crc32(big)).toBe(0x29058c73);
  });
});