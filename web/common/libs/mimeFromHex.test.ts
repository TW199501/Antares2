import { describe, expect, it } from 'vitest';

import { mimeFromHex } from './mimeFromHex';

/**
 * Characterization tests for mimeFromHex.
 *
 * Implementation matches the leading hex bytes of a file against a fixed
 * signature table, in this priority order:
 *   - 2-byte (first 4 hex chars):
 *       424D → bmp,  1F8B → tar.gz, 0B77 → ac3,  7801 → dmg,  4D5A → exe
 *       1FA0 / 1F9D → Z (compress)
 *   - 3-byte (first 6 hex chars):
 *       FFD8FF → jpg, 4949BC → jxr, 425A68 → bz2
 *   - 4-byte (full 8 hex chars):
 *       89504E47 → png, 47494638 → gif, 25504446 → pdf, 504B0304 → zip,
 *       425047FB → bpg, 4D4D002A → tif, 00000100 → ico
 *   - otherwise → { ext: '', mime: 'unknown <hex>' }
 *
 * Comparison is string-equality on uppercase hex; lowercase input does NOT
 * match the table and falls through to "unknown ...". This is locked in.
 */
describe('mimeFromHex', () => {
   describe('2-byte signatures', () => {
      it('detects BMP (424D)', () => {
         expect(mimeFromHex('424D000000')).toEqual({
            ext: 'bmp',
            mime: 'image/bmp'
         });
      });

      it('detects gzip / tar.gz (1F8B)', () => {
         expect(mimeFromHex('1F8B0800')).toEqual({
            ext: 'tar.gz',
            mime: 'application/gzip'
         });
      });

      it('detects AC3 (0B77)', () => {
         expect(mimeFromHex('0B77FFFF')).toEqual({
            ext: 'ac3',
            mime: 'audio/vnd.dolby.dd-raw'
         });
      });

      it('detects DMG (7801)', () => {
         expect(mimeFromHex('780100')).toEqual({
            ext: 'dmg',
            mime: 'application/x-apple-diskimage'
         });
      });

      it('detects EXE (4D5A — "MZ")', () => {
         expect(mimeFromHex('4D5A9000')).toEqual({
            ext: 'exe',
            mime: 'application/x-msdownload'
         });
      });

      it('detects compress (Z) for both 1FA0 and 1F9D', () => {
         expect(mimeFromHex('1FA00000')).toEqual({
            ext: 'Z',
            mime: 'application/x-compress'
         });
         expect(mimeFromHex('1F9D0000')).toEqual({
            ext: 'Z',
            mime: 'application/x-compress'
         });
      });
   });

   describe('3-byte signatures', () => {
      it('detects JPEG (FFD8FF)', () => {
         expect(mimeFromHex('FFD8FFE0')).toEqual({
            ext: 'jpg',
            mime: 'image/jpeg'
         });
      });

      it('detects JPEG XR (4949BC)', () => {
         expect(mimeFromHex('4949BC01')).toEqual({
            ext: 'jxr',
            mime: 'image/vnd.ms-photo'
         });
      });

      it('detects bzip2 (425A68)', () => {
         expect(mimeFromHex('425A6839')).toEqual({
            ext: 'bz2',
            mime: 'application/x-bzip2'
         });
      });
   });

   describe('4-byte signatures', () => {
      it('detects PNG (89504E47)', () => {
         expect(mimeFromHex('89504E47')).toEqual({
            ext: 'png',
            mime: 'image/png'
         });
      });

      it('detects GIF (47494638)', () => {
         expect(mimeFromHex('47494638')).toEqual({
            ext: 'gif',
            mime: 'image/gif'
         });
      });

      it('detects PDF (25504446)', () => {
         expect(mimeFromHex('25504446')).toEqual({
            ext: 'pdf',
            mime: 'application/pdf'
         });
      });

      it('detects ZIP (504B0304)', () => {
         expect(mimeFromHex('504B0304')).toEqual({
            ext: 'zip',
            mime: 'application/zip'
         });
      });

      it('detects BPG (425047FB)', () => {
         expect(mimeFromHex('425047FB')).toEqual({
            ext: 'bpg',
            mime: 'image/bpg'
         });
      });

      it('detects TIFF (4D4D002A)', () => {
         expect(mimeFromHex('4D4D002A')).toEqual({
            ext: 'tif',
            mime: 'image/tiff'
         });
      });

      it('detects ICO (00000100)', () => {
         expect(mimeFromHex('00000100')).toEqual({
            ext: 'ico',
            mime: 'image/x-icon'
         });
      });
   });

   describe('fallback / unknown', () => {
      it('returns { ext: "", mime: "unknown <hex>" } for a hex that matches no signature', () => {
         expect(mimeFromHex('CAFEBABE')).toEqual({
            ext: '',
            mime: 'unknown CAFEBABE'
         });
      });

      it('treats lowercase signatures as unknown (matcher is case-sensitive on uppercase)', () => {
         // Locks in current behavior: 'ffd8ff' (lowercase) does NOT match
         // the 'FFD8FF' table entry — caller is expected to supply uppercase.
         expect(mimeFromHex('ffd8ffe0')).toEqual({
            ext: '',
            mime: 'unknown ffd8ffe0'
         });
      });

      it('handles an empty input string by falling through to unknown', () => {
         expect(mimeFromHex('')).toEqual({ ext: '', mime: 'unknown ' });
      });
   });
});
