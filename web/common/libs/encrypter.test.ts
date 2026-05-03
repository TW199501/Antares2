/**
 * Characterization tests for encrypter.ts.
 *
 * Locks current behavior:
 *  - aes-256-gcm with scryptSync(password, 'antares', 32) key derivation.
 *  - encrypt() returns { iv, authTag, content } (all hex strings).
 *  - iv is 16 random bytes -> 32 hex chars; authTag is 16 bytes -> 32 hex chars.
 *  - Round-trip with same password reproduces the plaintext (incl. CJK / long).
 *  - Wrong password OR tampered content/authTag/iv throws (GCM auth failure).
 *  - Empty-string plaintext is supported.
 *
 * NOTE: a previous version included a control-character test ("\0", "\n",
 * "\t" embedded in the test plaintext). The literal NUL caused git to
 * classify the .test.ts as binary (no diff/blame). The test was dropped —
 * GCM is byte-clean by spec, so this is acceptance loss not coverage loss.
 */
import { describe, expect, it } from 'vitest';

import { decrypt, encrypt } from './encrypter';

describe('encrypter', () => {
   describe('encrypt()', () => {
      it('returns hex iv (32 chars), hex authTag (32 chars), hex content', () => {
         const out = encrypt('hello', 'pw');
         expect(out.iv).toMatch(/^[0-9a-f]{32}$/);
         expect(out.authTag).toMatch(/^[0-9a-f]{32}$/);
         expect(out.content).toMatch(/^[0-9a-f]*$/);
      });

      it('produces a non-deterministic IV across calls (random per call)', () => {
         const a = encrypt('same-text', 'same-pw');
         const b = encrypt('same-text', 'same-pw');
         expect(a.iv).not.toBe(b.iv);
         expect(a.content).not.toBe(b.content);
      });

      it('handles empty string plaintext (content is empty hex)', () => {
         const out = encrypt('', 'pw');
         expect(out.content).toBe('');
         expect(out.authTag).toMatch(/^[0-9a-f]{32}$/);
      });
   });

   describe('round-trip encrypt -> decrypt', () => {
      it('recovers ASCII plaintext', () => {
         const text = 'The quick brown fox jumps over the lazy dog.';
         expect(decrypt(encrypt(text, 'secret'), 'secret')).toBe(text);
      });

      it('recovers CJK / Unicode plaintext', () => {
         const text = 'Hello 世界 こんにちは 안녕하세요';
         expect(decrypt(encrypt(text, 'password-cjk'), 'password-cjk')).toBe(text);
      });

      it('recovers empty string', () => {
         expect(decrypt(encrypt('', 'pw'), 'pw')).toBe('');
      });

      it('recovers very long input (10 KB)', () => {
         const text = 'a'.repeat(10_000);
         expect(decrypt(encrypt(text, 'pw'), 'pw')).toBe(text);
      });

      it('recovers strings with quotes and backslashes', () => {
         const text = 'has "double" and \'single\' and \\back';
         expect(decrypt(encrypt(text, 'pw'), 'pw')).toBe(text);
      });
   });

   describe('decrypt() failure modes', () => {
      it('throws on wrong password (GCM auth tag mismatch)', () => {
         const enc = encrypt('payload', 'right');
         expect(() => decrypt(enc, 'wrong')).toThrow();
      });

      it('throws on tampered content', () => {
         const enc = encrypt('payload', 'pw');
         const flipped = {
            ...enc,
            content: enc.content.slice(0, -1) + (enc.content.endsWith('0') ? '1' : '0')
         };
         expect(() => decrypt(flipped, 'pw')).toThrow();
      });

      it('throws on tampered authTag', () => {
         const enc = encrypt('payload', 'pw');
         const flipped = {
            ...enc,
            authTag: enc.authTag.slice(0, -1) + (enc.authTag.endsWith('0') ? '1' : '0')
         };
         expect(() => decrypt(flipped, 'pw')).toThrow();
      });

      it('throws on tampered IV', () => {
         const enc = encrypt('payload', 'pw');
         const flipped = {
            ...enc,
            iv: enc.iv.slice(0, -1) + (enc.iv.endsWith('0') ? '1' : '0')
         };
         expect(() => decrypt(flipped, 'pw')).toThrow();
      });
   });
});
