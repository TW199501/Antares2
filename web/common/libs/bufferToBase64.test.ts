import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { bufferToBase64 } from './bufferToBase64';

/**
 * Characterization tests for bufferToBase64.
 *
 * Implementation walks the buffer as a sequence of byte codes, builds a
 * "binary"-encoded string (each char-code = one byte), and re-encodes that
 * via Node's Buffer to produce a base64 string. Accepts both Buffer and
 * Uint8Array (Array.prototype.map.call works on any indexed iterable with a
 * numeric length).
 */
describe('bufferToBase64', () => {
   it('returns an empty string for an empty Buffer', () => {
      expect(bufferToBase64(Buffer.alloc(0))).toBe('');
   });

   it('encodes a single ASCII byte (0x41 -> "A" -> "QQ==")', () => {
      // Cross-check: Buffer.from('A').toString('base64') === 'QQ=='
      expect(bufferToBase64(Buffer.from([0x41]))).toBe('QQ==');
   });

   it('encodes the ASCII string "Man" to "TWFu" (canonical RFC 4648 example)', () => {
      expect(bufferToBase64(Buffer.from('Man', 'utf8'))).toBe('TWFu');
   });

   it('encodes 3 bytes with no padding ("foo" -> "Zm9v")', () => {
      expect(bufferToBase64(Buffer.from('foo', 'utf8'))).toBe('Zm9v');
   });

   it('encodes 1 byte with double padding ("f" -> "Zg==")', () => {
      expect(bufferToBase64(Buffer.from('f', 'utf8'))).toBe('Zg==');
   });

   it('encodes 2 bytes with single padding ("fo" -> "Zm8=")', () => {
      expect(bufferToBase64(Buffer.from('fo', 'utf8'))).toBe('Zm8=');
   });

   it('handles binary content with high-bit (0x80-0xFF) bytes', () => {
      const buf = Buffer.from([0x00, 0x7f, 0x80, 0xff]);
      // Cross-check via standard Buffer base64 encoding for the same payload
      const expected = Buffer.from(buf).toString('base64');
      expect(bufferToBase64(buf)).toBe(expected);
   });

   it('matches Buffer#toString("base64") output for arbitrary byte patterns', () => {
      const buf = Buffer.from([
         0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0xfe, 0xfd
      ]);
      expect(bufferToBase64(buf)).toBe(buf.toString('base64'));
   });

   it('accepts a Uint8Array (Array.prototype.map.call works on any indexed iterable)', () => {
      const u8 = new Uint8Array([0x66, 0x6f, 0x6f]); // "foo"
      // Cast: function signature is `Buffer`, but the implementation only
      // requires indexed numeric access — Uint8Array satisfies it.
      expect(bufferToBase64(u8 as unknown as Buffer)).toBe('Zm9v');
   });

   it('encodes a large buffer (>=10 KB) deterministically', () => {
      const size = 10 * 1024 + 7; // not a multiple of 3 — exercises padding
      const buf = Buffer.alloc(size);
      for (let i = 0; i < size; i++)
         buf[i] = i & 0xff;
      expect(bufferToBase64(buf)).toBe(buf.toString('base64'));
   });
});
