/**
 * Characterization tests for langDetector.ts.
 *
 * Locks current behavior (priority order: text → json → html → svg → xml → markdown → text):
 *  - Empty / whitespace-only input → 'text' (short-circuit before parsing).
 *  - JSON detection requires the trimmed input to *start* with '{' or '['
 *    AND parse via JSON.parse — anything else falls through.
 *  - HTML detection: the string must (a) parse to a body with at least one
 *    Element child AND (b) contain a literal `<tag>` (no attrs) for one of
 *    the known tags. Self-closing or attributed tags do not match.
 *  - SVG detection: any string containing '<svg' (case-insensitive) that
 *    parses as XML without a parsererror returns 'svg'.
 *  - XML: parses cleanly via DOMParser without parsererror.
 *  - Markdown: presence of any of the known marker substrings ('# ', '`', '- ',
 *    '+ ', '* ', '1. ', '**', '__', '~~', '>> ', '](http', '![', '[ ]', '[x]').
 *  - Otherwise: 'text'.
 *
 * Note: detection is intentionally LOOSE. plain text containing a backtick
 * is reported as 'markdown' (the marker list includes a single '`'). This is
 * locked, not a bug to fix.
 */
import { describe, expect, it } from 'vitest';

import { langDetector } from './langDetector';

describe('langDetector', () => {
   describe('empty / whitespace', () => {
      it('returns text for empty string', () => {
         expect(langDetector('')).toBe('text');
      });

      it('returns text for whitespace-only', () => {
         expect(langDetector('   \n\t ')).toBe('text');
      });
   });

   describe('json', () => {
      it('detects an object literal', () => {
         expect(langDetector('{"a":1}')).toBe('json');
      });

      it('detects an array literal', () => {
         expect(langDetector('[1, 2, 3]')).toBe('json');
      });

      it('detects after leading whitespace (trim before first-char check)', () => {
         expect(langDetector('   { "k": "v" }')).toBe('json');
      });

      it('returns text for invalid JSON that still starts with {', () => {
         // Starts with '{' but JSON.parse throws → falls through; no other
         // detector matches → 'text'.
         expect(langDetector('{ not valid json')).toBe('text');
      });

      it('does not detect JSON when input does not start with { or [', () => {
         expect(langDetector('"just-a-string"')).toBe('text');
      });
   });

   describe('html', () => {
      it('detects a basic html snippet with a known tag', () => {
         expect(langDetector('<div>hello</div>')).toBe('html');
      });

      it('detects html with multiple tags', () => {
         expect(langDetector('<p>one</p><p>two</p>')).toBe('html');
      });

      it('detects nested html', () => {
         expect(langDetector('<section><h1>t</h1><p>x</p></section>')).toBe('html');
      });
   });

   describe('svg', () => {
      it('detects a self-closing svg root', () => {
         expect(langDetector('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe('svg');
      });

      it('reports html (not svg) when input contains a literal <svg> tag with no attrs', () => {
         // QUIRK: isHTML runs before isSVG, and 'svg' is in the html-tag list.
         // A bare `<svg>` matches the html branch first. To get 'svg', the
         // root element must carry attrs (e.g. xmlns) so the literal `<svg>`
         // doesn't appear in the input string.
         expect(langDetector('<svg><circle cx="10" cy="10" r="5"/></svg>')).toBe('html');
      });
   });

   describe('xml', () => {
      it('detects a simple xml document without an svg/html marker', () => {
         expect(langDetector('<?xml version="1.0"?><root><child/></root>')).toBe('xml');
      });

      it('detects custom-element xml', () => {
         expect(langDetector('<note><to>You</to><from>Me</from></note>')).toBe('xml');
      });
   });

   describe('markdown', () => {
      it('detects a heading marker (# )', () => {
         expect(langDetector('# Hello world')).toBe('markdown');
      });

      it('detects a list marker (- )', () => {
         expect(langDetector('- item one\n- item two')).toBe('markdown');
      });

      it('detects bold (**...**)', () => {
         expect(langDetector('this is **bold** text')).toBe('markdown');
      });

      it('detects strikethrough (~~...~~)', () => {
         expect(langDetector('a ~~strike~~ b')).toBe('markdown');
      });

      it('detects link syntax ](http', () => {
         expect(langDetector('see [docs](https://example.com)')).toBe('markdown');
      });

      it('detects checklist [x]', () => {
         expect(langDetector('todo [x] done')).toBe('markdown');
      });
   });

   describe('text fallback', () => {
      it('returns text for plain prose with no markdown marker', () => {
         expect(langDetector('hello world this is plain prose')).toBe('text');
      });

      it('returns text for SQL-looking input (no dialect-specific detector exists)', () => {
         // The current API only routes by structural shape — SELECT/FROM
         // text without quotes / backticks / # falls through to 'text'.
         expect(langDetector('SELECT id, name FROM users WHERE id = 1')).toBe('text');
      });
   });
});
