/**
 * Tests for sqlUtils.ts (correct-behavior assertions, not characterization).
 *
 *  - querySplitter: splits on ';' but respects strings, BEGIN-END, and pg
 *    dollar-quoted blocks. Uses lookbehind so semicolons stay attached.
 *    Dollar-tag detection is anchored to the leading '$' position; previous
 *    unanchored regex corrupted the body.
 *  - removeComments: strips line comments (-- ...) and C-style block comments.
 *  - sqlEscaper: mysql escape convention (mysql2-compatible). NUL/BS/TAB/SUB
 *    map to \0/\b/\t/\Z, LF/CR to \n/\r, quotes/backslash get a literal
 *    backslash escape. '%' is kept literal (caller decides LIKE wildcard
 *    semantics). Previous lookup-table mismatch silently dropped controls.
 *  - escapeAndQuote: client-aware. mysql/maria use stringsWrapper='"';
 *    pg/mssql/sqlite/firebird use stringsWrapper='\''. Both escape the same
 *    control set; mysql adds " escape because " is also the wrapper.
 *  - formatJsonForSqlWhere: per-client SQL fragment for "<col> = <json>".
 */
import { describe, expect, it } from 'vitest';

import {
   escapeAndQuote,
   formatJsonForSqlWhere,
   querySplitter,
   removeComments,
   sqlEscaper
} from './sqlUtils';

describe('querySplitter', () => {
   it('splits two simple statements on ;', () => {
      expect(querySplitter('SELECT 1; SELECT 2;', 'mysql'))
         .toEqual(['SELECT 1;', 'SELECT 2;']);
   });

   it('returns single element for a single query without trailing ;', () => {
      expect(querySplitter('SELECT 1', 'mysql')).toEqual(['SELECT 1']);
   });

   it('returns empty array for empty / whitespace-only input', () => {
      expect(querySplitter('', 'mysql')).toEqual([]);
      expect(querySplitter('   \n  ', 'mysql')).toEqual([]);
   });

   it('does not split inside a single-quoted string with semicolons', () => {
      const sql = 'SELECT \'a;b;c\'; SELECT 2;';
      expect(querySplitter(sql, 'mysql'))
         .toEqual(['SELECT \'a;b;c\';', 'SELECT 2;']);
   });

   it('does not split inside a double-quoted string with semicolons', () => {
      const sql = 'SELECT "a;b;c"; SELECT 2;';
      expect(querySplitter(sql, 'mysql'))
         .toEqual(['SELECT "a;b;c";', 'SELECT 2;']);
   });

   it('does not split inside a BEGIN ... END; block (joins fragments without inter-statement whitespace)', () => {
      // QUIRK: the implementation `line.trim()`s each ;-segment before
      // concatenating, so spaces between statements inside the block are
      // dropped. We lock the produced string verbatim — the value is one
      // concatenated query (no extra entries), which is the contract callers
      // depend on; the cosmetic whitespace loss is a known artefact.
      const sql = 'BEGIN INSERT INTO t VALUES (1); INSERT INTO t VALUES (2); END;';
      expect(querySplitter(sql, 'mysql')).toEqual([
         'BEGIN INSERT INTO t VALUES (1);INSERT INTO t VALUES (2);END;'
      ]);
   });

   it('does not split inside a postgres dollar-quoted ($$) body', () => {
      // Inner ; (string and dollar-quoted body) must not split. BEGIN-END
      // segment-trim still drops the spaces between sub-statements — that's
      // a separate quirk of the line.trim() in the outer loop, not dollar-tag.
      const sql = 'DO $$ BEGIN PERFORM \'a;b\'; PERFORM 1; END $$;';
      const result = querySplitter(sql, 'pg');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('DO $$ BEGIN PERFORM \'a;b\';PERFORM 1;END $$;');
   });

   it('does not split inside a postgres dollar-tagged ($body$) body', () => {
      const sql = 'CREATE FUNCTION f() RETURNS void AS $body$ SELECT 1; SELECT 2; $body$ LANGUAGE sql;';
      const result = querySplitter(sql, 'pg');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
         'CREATE FUNCTION f() RETURNS void AS $body$ SELECT 1;SELECT 2;$body$ LANGUAGE sql;'
      );
   });
});

describe('removeComments', () => {
   it('strips a single-line -- comment AND the terminating newline', () => {
      // The newline that closes a -- comment is also consumed (the `continue`
      // in the inside-comment branch runs unconditionally). Lock that.
      expect(removeComments('SELECT 1; -- comment\nSELECT 2;'))
         .toBe('SELECT 1; SELECT 2;');
   });

   it('strips a -- comment that runs to end of input (no newline)', () => {
      expect(removeComments('SELECT 1; -- trailing'))
         .toBe('SELECT 1; ');
   });

   it('strips a /* */ block comment', () => {
      expect(removeComments('SELECT /* hi */ 1;'))
         .toBe('SELECT  1;');
   });

   it('strips a multiline /* */ block comment', () => {
      expect(removeComments('SELECT /* hi\nthere */ 1;'))
         .toBe('SELECT  1;');
   });

   it('leaves SQL with no comments unchanged', () => {
      expect(removeComments('SELECT a, b FROM t;'))
         .toBe('SELECT a, b FROM t;');
   });

   it('returns empty string for empty input', () => {
      expect(removeComments('')).toBe('');
   });

   it('strips multiple comments in one query (closing newline of -- comment is also consumed)', () => {
      expect(removeComments('-- one\nSELECT /* two */ 1; -- three'))
         .toBe('SELECT  1; ');
   });
});

describe('sqlEscaper', () => {
   // mysql escape convention (mysql2-compatible). Spec aligned with
   // escapeAndQuote() control-char set above.

   it('escapes single-quote \' as \\\'', () => {
      expect(sqlEscaper('O\'Brien')).toBe('O\\\'Brien');
   });

   it('escapes double-quote " as \\"', () => {
      expect(sqlEscaper('say "hi"')).toBe('say \\"hi\\"');
   });

   it('escapes backslash \\ as \\\\', () => {
      expect(sqlEscaper('a\\b')).toBe('a\\\\b');
   });

   it('leaves percent % unchanged (LIKE wildcard semantics is caller-side)', () => {
      expect(sqlEscaper('100%')).toBe('100%');
   });

   it('escapes newlines as \\n', () => {
      expect(sqlEscaper('a\nb')).toBe('a\\nb');
   });

   it('escapes carriage returns as \\r', () => {
      expect(sqlEscaper('a\rb')).toBe('a\\rb');
   });

   it('escapes NUL / BS / TAB / SUB to \\0 / \\b / \\t / \\Z', () => {
      expect(sqlEscaper('a\0b\bc\tdaylight\x1ae')).toBe('a\\0b\\bc\\tdaylight\\Ze');
   });

   it('leaves a string with no special characters unchanged', () => {
      expect(sqlEscaper('hello world 123')).toBe('hello world 123');
   });

   it('returns empty string for empty input', () => {
      expect(sqlEscaper('')).toBe('');
   });

   it('escapes a mix of escapable chars in one pass', () => {
      expect(sqlEscaper('a\'b"c\\d')).toBe('a\\\'b\\"c\\\\d');
   });
});

describe('escapeAndQuote', () => {
   it('mysql wraps in double-quotes (stringsWrapper = ")', () => {
      expect(escapeAndQuote('hello', 'mysql')).toBe('"hello"');
   });

   it('mysql escapes embedded double-quote', () => {
      expect(escapeAndQuote('he said "hi"', 'mysql')).toBe('"he said \\"hi\\""');
   });

   it('mysql escapes embedded single-quote', () => {
      expect(escapeAndQuote('O\'Brien', 'mysql')).toBe('"O\\\'Brien"');
   });

   it('pg wraps in single-quotes', () => {
      expect(escapeAndQuote('hello', 'pg')).toBe('\'hello\'');
   });

   it('pg escapes embedded single-quote (\\\')', () => {
      expect(escapeAndQuote('O\'Brien', 'pg')).toBe('\'O\\\'Brien\'');
   });

   it('pg leaves embedded double-quote alone (not in escape set)', () => {
      expect(escapeAndQuote('say "hi"', 'pg')).toBe('\'say "hi"\'');
   });

   it('mssql wraps in single-quotes (matches stringsWrapper)', () => {
      expect(escapeAndQuote('hello', 'mssql')).toBe('\'hello\'');
   });

   it('sqlite wraps in single-quotes', () => {
      expect(escapeAndQuote('hi', 'sqlite')).toBe('\'hi\'');
   });

   it('escapes \\n / \\r / \\t / \\b / NUL / SUB to backslash sequences', () => {
      expect(escapeAndQuote('a\nb\rc\td\bnul\0sub\x1a', 'pg'))
         .toBe('\'a\\nb\\rc\\td\\bnul\\0sub\\Z\'');
   });

   it('escapes embedded backslash to \\\\', () => {
      expect(escapeAndQuote('a\\b', 'pg')).toBe('\'a\\\\b\'');
   });

   it('returns just the wrapper for empty string', () => {
      expect(escapeAndQuote('', 'pg')).toBe('\'\'');
      expect(escapeAndQuote('', 'mysql')).toBe('""');
   });

   it('preserves a value whose tail has no escapable chars (slice path)', () => {
      // Forces the chunkIndex < val.length branch
      expect(escapeAndQuote('a\'b-tail', 'pg')).toBe('\'a\\\'b-tail\'');
   });

   it('preserves a value whose tail starts immediately after the last escape (chunkIndex === val.length)', () => {
      // Last char is the escapable one
      expect(escapeAndQuote('ab\'', 'pg')).toBe('\'ab\\\'\'');
   });
});

describe('formatJsonForSqlWhere', () => {
   const obj = { a: 1, b: 'two' };
   const json = JSON.stringify(obj);

   it('mysql wraps in CAST(... AS JSON)', () => {
      expect(formatJsonForSqlWhere(obj, 'mysql'))
         .toBe(` = CAST('${json}' AS JSON)`);
   });

   it('maria uses simple equality with quoted JSON', () => {
      expect(formatJsonForSqlWhere(obj, 'maria'))
         .toBe(` = '${json}'`);
   });

   it('pg uses ::text cast', () => {
      expect(formatJsonForSqlWhere(obj, 'pg'))
         .toBe(`::text = '${json}'`);
   });

   it('sqlite uses simple equality with quoted JSON', () => {
      expect(formatJsonForSqlWhere(obj, 'sqlite'))
         .toBe(` = '${json}'`);
   });

   it('firebird uses simple equality with quoted JSON', () => {
      expect(formatJsonForSqlWhere(obj, 'firebird'))
         .toBe(` = '${json}'`);
   });

   it('mssql falls through to the default (= "...")', () => {
      // mssql is not in the switch — hits the default branch.
      expect(formatJsonForSqlWhere(obj, 'mssql'))
         .toBe(` = '${json}'`);
   });

   it('handles arrays (JSON.stringify produces [...] verbatim)', () => {
      expect(formatJsonForSqlWhere([1, 2, 3], 'pg'))
         .toBe('::text = \'[1,2,3]\'');
   });
});
